import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { renderWishbookCoverPng, specFromOrderOptions } from '@/lib/print/wishbook-cover';
import { findMonoCoverItem } from '@/lib/print/cover-eligibility';

// next/og + sharp both need the Node runtime; rendering takes a couple seconds.
export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'photobook-uploads';

/**
 * POST /api/orders/[id]/generate-cover-bw
 *
 * The black-and-white engraving макет for a book with a SOFT cover — велюр,
 * шкірзамінник, тканина — that is not a книга побажань. Front cover only, white
 * background, black text, at the print sheet's own scale.
 *
 * Why it is a separate file rather than part of the render: the cover a soft
 * photobook ships with comes from Railway (00_cover.jpg), which photographs the
 * design in colour. Production still has to engrave that напис, and it works
 * from a monochrome макет — until now only the книга побажань produced one, so a
 * велюрова фотокнига went to production with nothing to engrave from.
 *
 * Deliberately narrow: only гравіювання and флекс. An acryl / photo insert /
 * metal plate carries the customer's photo, which this renderer cannot draw —
 * see canRenderMonoCover().
 *
 * Idempotent: skips when a cover_bw.jpg row already exists, unless ?force=1
 * (staff only, mirroring generate-wishbook-cover).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'order id required' }, { status: 400 });

  let force = req.nextUrl.searchParams.get('force') === '1';
  if (force) {
    const guard = await requireStaff();
    if (!guard.ok) force = false; // silently fall back to idempotent behaviour
  }
  const admin = getAdminClient();

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, order_number, items, customer_id')
    .eq('id', id)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 });
  }

  // 1. Which item, if any, needs an engraving макет.
  const items = Array.isArray(order.items) ? order.items : [];
  const target = findMonoCoverItem(items);

  if (!target) {
    return NextResponse.json({ ok: true, skipped: 'no soft-cover engraved item in order' });
  }

  // 2. Skip when the макет already exists.
  if (!force) {
    const { count } = await admin
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', id)
      .eq('file_name', 'cover_bw.jpg');
    if ((count ?? 0) > 0) {
      return NextResponse.json({ ok: true, skipped: 'cover_bw already exists' });
    }
  }

  // 3. Exact inscription layout from the saved project. Without it the напис is
  //    centred at an estimated size, which is not what the customer arranged.
  let editorLayout: { xPct?: number; yPct?: number; fontPxEditor?: number; color?: string } | null = null;
  try {
    const { data: proj } = await admin
      .from('projects')
      .select('cover_data')
      .eq('order_id', id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const cd: any = proj?.cover_data;
    if (cd && (cd.decoText || '').trim()) {
      editorLayout = {
        xPct: typeof cd.textX === 'number' ? cd.textX : undefined,
        yPct: typeof cd.textY === 'number' ? cd.textY : undefined,
        fontPxEditor: typeof cd.textFontSize === 'number' ? cd.textFontSize : undefined,
        color: typeof cd.decoColor === 'string' && cd.decoColor.startsWith('#') ? cd.decoColor : undefined,
      };
    }
  } catch { /* no project — the estimated layout still renders */ }

  // 4. Render.
  let jpegBw: Buffer;
  try {
    const spec = specFromOrderOptions(target.options || {});
    spec.layout = editorLayout;
    if (!spec.title) {
      // Nothing to engrave — an empty white sheet would only confuse production.
      return NextResponse.json({ ok: true, skipped: 'no inscription on this cover' });
    }
    const png = await renderWishbookCoverPng(spec, { mono: true });
    jpegBw = await sharp(Buffer.from(png))
      .flatten({ background: '#ffffff' })
      .grayscale()
      .jpeg({ quality: 98, chromaSubsampling: '4:4:4' })
      .withMetadata({ density: 300 })
      .toBuffer();
  } catch (e: any) {
    console.error('[cover-bw] render failed:', e?.message || e);
    return NextResponse.json({ error: 'render failed', detail: String(e?.message || e) }, { status: 500 });
  }

  // 5. Upload next to the Railway render, under the same {userKey}/{orderId}/.
  const userKey = order.customer_id || 'server';
  const path = `${userKey}/${order.id}/cover_bw.jpg`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, jpegBw, { cacheControl: '31536000', upsert: true, contentType: 'image/jpeg' });

  if (upErr) {
    console.error('[cover-bw] upload failed:', upErr.message);
    return NextResponse.json({ error: 'upload failed', detail: upErr.message }, { status: 500 });
  }

  // 6. Register it. pruneStaleExports exempts cover_bw.jpg by name, so the next
  //    Railway re-render will not delete it (that is what happened to
  //    TM-001138's cover before the exemption existed).
  if (force) {
    await admin.from('order_files').delete().eq('order_id', id).eq('file_name', 'cover_bw.jpg');
  }
  const { error: ofErr } = await admin.from('order_files').insert([{
    order_id: id,
    file_path: path,
    file_name: 'cover_bw.jpg',
    file_type: 'export',
    file_category: 'book-cover',
    product_type: String(target.slug || target.product_type || 'photobook'),
    bucket_name: BUCKET,
    file_size: jpegBw.length,
    mime_type: 'image/jpeg',
    page_number: 1,
  }]);

  if (ofErr) {
    console.error('[cover-bw] order_files insert failed:', ofErr.message);
    return NextResponse.json({ error: 'order_files insert failed', detail: ofErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, size: jpegBw.length });
}
