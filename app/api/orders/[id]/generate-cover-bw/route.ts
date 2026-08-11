import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { renderWishbookCoverPng, specFromOrderOptions, parseVariantDims } from '@/lib/print/wishbook-cover';
import { findMonoCoverItem, isPhotoInsertDeco } from '@/lib/print/cover-eligibility';

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
  let editorExtras: Array<{ text: string; xPct?: number; yPct?: number; fontPxEditor?: number; color?: string; fontFamily?: string }> | null = null;
  let coverData: any = null;
  try {
    const { data: proj } = await admin
      .from('projects')
      .select('cover_data, uploaded_photos')
      .eq('order_id', id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const cd: any = proj?.cover_data;
    coverData = proj ? { ...cd, _uploadedPhotos: proj.uploaded_photos } : null;
    if (cd && (cd.decoText || '').trim()) {
      editorLayout = {
        xPct: typeof cd.textX === 'number' ? cd.textX : undefined,
        yPct: typeof cd.textY === 'number' ? cd.textY : undefined,
        fontPxEditor: typeof cd.textFontSize === 'number' ? cd.textFontSize : undefined,
        color: typeof cd.decoColor === 'string' && cd.decoColor.startsWith('#') ? cd.decoColor : undefined,
      };
    }
    // Написи the photobook editor stores as extraTexts, at their exact editor
    // positions. The options key «Текст на обкладинці» is just those texts
    // joined — so when the extras are available, the joined title must NOT
    // also render, or every напис would appear twice on the sheet.
    if (Array.isArray(cd?.extraTexts)) {
      const mapped = cd.extraTexts
        .filter((t2: any) => String(t2?.text || '').trim())
        .map((t2: any) => ({
          text: String(t2.text).trim(),
          xPct: typeof t2.x === 'number' ? t2.x : undefined,
          yPct: typeof t2.y === 'number' ? t2.y : undefined,
          fontPxEditor: typeof t2.fontSize === 'number' ? t2.fontSize : undefined,
          color: typeof t2.color === 'string' && t2.color.startsWith('#') ? t2.color : undefined,
          fontFamily: typeof t2.fontFamily === 'string' && t2.fontFamily ? t2.fontFamily : undefined,
        }));
      if (mapped.length) editorExtras = mapped;
    }
  } catch { /* no project — the estimated layout still renders */ }

  // 4. Render.
  let jpegBw: Buffer;
  let spec: ReturnType<typeof specFromOrderOptions>;
  try {
    spec = specFromOrderOptions(target.options || {});
    spec.layout = editorLayout;
    spec.extras = editorExtras;
    if (editorExtras && !(coverData?.decoText || '').trim()) {
      // The title was only the options-joined copy of these extras.
      spec.title = '';
    }
    if (!spec.title && !(editorExtras && editorExtras.length)) {
      // Nothing to engrave — an empty white sheet would only confuse
      // production. The INSERT PHOTO is a different matter: a фотовставка
      // cover with no напис still needs its cropped photo file, and returning
      // here used to skip it entirely (TM-001182 shipped with the cover render
      // and nothing production could mount).
      const insertOnly = await exportInsertPhoto({
        admin, orderId: id, userKey: order.customer_id || 'server', target, coverData, force,
      });
      return NextResponse.json({ ok: true, skipped: 'no inscription on this cover', insertPhoto: insertOnly });
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

  // 7. Фотовставка ships as its own PHOTO file at the insert's physical size —
  //    production mounts the printed photo, it does not cut it out of the cover
  //    render (Diana, TM-001171). Crop mirrors the editor: cover-fit into the
  //    insert frame, panned by photoCropX/photoCropY (object-position), zoomed
  //    by photoZoom about the frame centre. Best-effort: a failure here must
  //    not lose the engraving sheet uploaded above.
  const insertPath = await exportInsertPhoto({
    admin, orderId: id, userKey, target, coverData, force,
  });

  return NextResponse.json({ ok: true, path, size: jpegBw.length, insertPhoto: insertPath });
}

/**
 * Export the фотовставка photo as its own print file.
 *
 * Production mounts the printed photo into the insert window; it does not cut
 * it out of the cover render (Diana, TM-001171). Crop mirrors the editor:
 * cover-fit into the insert frame, panned by photoCropX/photoCropY
 * (object-position), zoomed by photoZoom about the frame centre.
 *
 * Called from every exit of the route that can legitimately end without an
 * engraving sheet — an insert cover with no напис (TM-001182) is exactly such
 * an exit, and it used to lose the photo. Best-effort throughout: a failure
 * here must never lose the engraving sheet the caller already uploaded.
 */
async function exportInsertPhoto(params: {
  admin: ReturnType<typeof getAdminClient>;
  orderId: string;
  userKey: string;
  target: any;
  coverData: any;
  force: boolean;
}): Promise<string | null> {
  const { admin, orderId: id, userKey, target, coverData, force } = params;
  let insertPath: string | null = null;
  try {
    const decoRaw = String(target.options?.['Декорація обкладинки'] || target.options?.['Оздоблення'] || '');
    const photoId = coverData?.photoId;
    if (isPhotoInsertDeco(decoRaw) && photoId) {
      const already = !force && (await admin
        .from('order_files')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', id)
        .eq('file_name', 'insert_photo.jpg')).count;
      if (!already) {
        const photos = Array.isArray(coverData?._uploadedPhotos) ? coverData._uploadedPhotos : [];
        const entry = photos.find((p: any) => p?.id === photoId && p?.path);
        if (!entry) {
          console.warn('[cover-bw] insert photo not found in uploaded_photos, id:', photoId);
        } else {
          const dl = await admin.storage.from(BUCKET).download(entry.path);
          if (dl.error || !dl.data) throw new Error(`insert photo download failed: ${dl.error?.message}`);
          const srcBuf = Buffer.from(await dl.data.arrayBuffer());
          const meta = await sharp(srcBuf).metadata();
          const pw = meta.width || Number(entry.width) || 0;
          const ph = meta.height || Number(entry.height) || 0;
          const dims = parseVariantDims(String(target.options?.['Варіант декорації'] || '')); // mm
          const tw = Math.round((dims.w * 300) / 25.4);
          const th = Math.round((dims.h * 300) / 25.4);
          if (pw > 0 && ph > 0) {
            const zoom = Math.max(0.3, Math.min(4, Number(coverData?.photoZoom) || 1));
            const cx = Math.max(0, Math.min(100, Number(coverData?.photoCropX ?? 50)));
            const cy = Math.max(0, Math.min(100, Number(coverData?.photoCropY ?? 50)));
            // cover-fit at zoom 1: the visible source region.
            const s0 = Math.max(tw / pw, th / ph);
            const vw0 = tw / s0, vh0 = th / s0;
            const left0 = (pw - vw0) * (cx / 100);
            const top0 = (ph - vh0) * (cy / 100);
            // scale(zoom) magnifies about the frame centre.
            const vw = vw0 / zoom, vh = vh0 / zoom;
            const left = Math.max(0, Math.min(pw - vw, left0 + (vw0 - vw) / 2));
            const top = Math.max(0, Math.min(ph - vh, top0 + (vh0 - vh) / 2));
            const insertJpeg = await sharp(srcBuf)
              .extract({
                left: Math.round(left),
                top: Math.round(top),
                width: Math.max(1, Math.round(vw)),
                height: Math.max(1, Math.round(vh)),
              })
              .resize(tw, th)
              .jpeg({ quality: 98, chromaSubsampling: '4:4:4' })
              .withMetadata({ density: 300 })
              .toBuffer();
            insertPath = `${userKey}/${id}/insert_photo.jpg`;
            const { error: insUpErr } = await admin.storage
              .from(BUCKET)
              .upload(insertPath, insertJpeg, { cacheControl: '31536000', upsert: true, contentType: 'image/jpeg' });
            if (insUpErr) throw new Error(`insert photo upload failed: ${insUpErr.message}`);
            if (force) {
              await admin.from('order_files').delete().eq('order_id', id).eq('file_name', 'insert_photo.jpg');
            }
            const { error: insOfErr } = await admin.from('order_files').insert([{
              order_id: id,
              file_path: insertPath,
              file_name: 'insert_photo.jpg',
              file_type: 'export',
              file_category: 'book-cover',
              product_type: String(target.slug || target.product_type || 'photobook'),
              bucket_name: BUCKET,
              file_size: insertJpeg.length,
              mime_type: 'image/jpeg',
              page_number: 1,
            }]);
            if (insOfErr) throw new Error(`insert photo order_files insert failed: ${insOfErr.message}`);
          }
        }
      }
    }
  } catch (e: any) {
    console.error('[cover-bw] insert photo generation failed:', e?.message || e);
    insertPath = null;
  }

  return insertPath;
}
