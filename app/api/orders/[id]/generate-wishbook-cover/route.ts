import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  renderWishbookCoverPng,
  specFromOrderOptions,
} from '@/lib/print/wishbook-cover';

// next/og + sharp both need the Node runtime; rendering takes a couple seconds.
export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'photobook-uploads';

function isWishbookItem(item: any): boolean {
  const slug = String(item?.slug || item?.product_type || '').toLowerCase();
  const name = String(item?.product_name || item?.name || '').toLowerCase();
  return (
    slug.includes('wish') || slug.includes('pobazhan') || slug.includes('guest') ||
    name.includes('побажан')
  );
}

/**
 * POST /api/orders/[id]/generate-wishbook-cover
 *
 * Generates the print cover.jpg for a wishbook order entirely on the server,
 * from the design captured in items[].options, and attaches it to the order
 * (storage + order_files). This makes the wishbook print file independent of
 * the customer's browser — it can never go missing again.
 *
 * Idempotent: if a cover.jpg order_files row already exists for the order, it
 * skips (unless ?force=1). Safe to call from checkout, the cron safety-net, or
 * the admin order page.
 *
 * Auth: callable by the customer's checkout session (right after their order is
 * created) and by staff. It only ever WRITES a generated cover for the given
 * order — no data exposure. Uses the service role for storage + DB.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'order id required' }, { status: 400 });

  const force = req.nextUrl.searchParams.get('force') === '1';
  const admin = getAdminClient();

  // 1. Load the order.
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, order_number, items, customer_id')
    .eq('id', id)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 });
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const wishItemIndex = items.findIndex(isWishbookItem);
  if (wishItemIndex < 0) {
    return NextResponse.json({ error: 'no wishbook item in order' }, { status: 400 });
  }
  const wishItem = items[wishItemIndex];

  // 2. Skip if a cover already exists (unless forced).
  if (!force) {
    const { count } = await admin
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', id)
      .eq('file_name', 'cover.jpg');
    if ((count ?? 0) > 0) {
      return NextResponse.json({ ok: true, skipped: 'cover already exists' });
    }
  }

  // 3. Build the spec + render the cover.
  let jpeg: Buffer;
  let specSize: string;
  try {
    const spec = specFromOrderOptions(wishItem.options || {});
    specSize = spec.sizeKey;
    if (!spec.title) {
      // A wishbook with no title is still printable (blank cover), but flag it.
      console.warn(`[wishbook-cover] order ${order.order_number} has no title`);
    }
    const png = await renderWishbookCoverPng(spec);
    // PNG → JPEG, sRGB, max quality (production spec: minimal compression).
    jpeg = await sharp(Buffer.from(png))
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 98, chromaSubsampling: '4:4:4' })
      .withMetadata({ density: 300 })
      .toBuffer();
  } catch (e: any) {
    console.error('[wishbook-cover] render failed:', e?.message || e);
    return NextResponse.json({ error: 'render failed', detail: String(e?.message || e) }, { status: 500 });
  }

  // 4. Upload to storage. Path mirrors the editor's pattern:
  //    {userKey}/{orderId}/cover.jpg
  const userKey = order.customer_id || 'server';
  const path = `${userKey}/${order.id}/cover.jpg`;

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, jpeg, { cacheControl: '31536000', upsert: true, contentType: 'image/jpeg' });

  if (upErr) {
    console.error('[wishbook-cover] upload failed:', upErr.message);
    return NextResponse.json({ error: 'upload failed', detail: upErr.message }, { status: 500 });
  }

  // 5. Create / refresh the order_files row.
  //    Remove any stale cover row first when forcing, then insert.
  if (force) {
    await admin.from('order_files').delete().eq('order_id', id).eq('file_name', 'cover.jpg');
  }
  const { error: ofErr } = await admin.from('order_files').insert({
    order_id: id,
    file_path: path,
    file_name: 'cover.jpg',
    file_type: 'export',
    file_category: 'book-cover',
    product_type: 'wishbook',
    bucket_name: BUCKET,
    file_size: jpeg.length,
    mime_type: 'image/jpeg',
    page_number: 1,
  });

  if (ofErr) {
    console.error('[wishbook-cover] order_files insert failed:', ofErr.message);
    return NextResponse.json({ error: 'order_files insert failed', detail: ofErr.message }, { status: 500 });
  }

  // 6. Clear any "missing print files" warning we may have flagged earlier,
  //    since the cover now exists.
  const { data: cur } = await admin.from('orders').select('notes').eq('id', id).maybeSingle();
  if (cur?.notes && cur.notes.includes('файли для друку не завантажились')) {
    const cleaned = cur.notes
      .split('\n')
      .filter((line: string) => !line.includes('файли для друку не завантажились'))
      .join('\n')
      .trim();
    await admin.from('orders').update({ notes: cleaned || null }).eq('id', id);
  }

  return NextResponse.json({ ok: true, path, size: jpeg.length, format: specSize });
}
