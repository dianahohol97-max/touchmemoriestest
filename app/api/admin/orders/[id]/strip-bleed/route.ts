import { NextResponse } from 'next/server';
import Jimp from 'jimp';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { deriveGeometry, normalizeSizeKey, mmToPx, type SizeRow } from '@/lib/print/geometry';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/orders/[id]/strip-bleed
 *
 * Cuts the bleed ring off an order's rendered spreads, leaving the file at the
 * finished trim size.
 *
 * Why this exists: the render service pads every spread out to the sheet size
 * with SYNTHESIZED pixels — a shifted copy of the spread before #46, a mirrored
 * edge after it. Either way those pixels are not the customer's design. For
 * orders that go to print without a bleed allowance, the honest file is the
 * customer's layout at exactly the finished size, and that is precisely the
 * centre of what we already have: the renderer scales the capture to the
 * finished size FIRST and only then pads. Cropping the padding back off returns
 * the original content pixel-for-pixel — nothing is resampled, nothing is
 * invented.
 *
 * Covers are skipped on purpose: their extra 18–20 mm is fold-in that physically
 * wraps the board, not bleed. Cutting it would ruin the cover.
 *
 * PHOTOBOOK SPREADS ARE NOW REFUSED (TM-001233, 2026-08-24). The premise above —
 * «orders that go to print without a bleed allowance» — does not describe our
 * printing house. Its file checker demands the SHEET: a 20×30 slimbook must
 * arrive as 420×305 mm, and 400×300 comes back «ширина 400 і не є рівна 420».
 * The same rejection already happened on 2026-08-20 for a 20×20 («400 і не є
 * рівна 405»), which is why the render service was changed to output the sheet.
 * Cropping the ring back off undoes exactly that fix, and TM-001233 was rejected
 * by the printer because this endpoint ran on it. Page-split products
 * (travel books, magazines) still pass through: there the contract really is the
 * exact finished page, and the renderer already produces it, so the crop is a
 * no-op safety net rather than a way to break a book.
 *
 * Idempotent: a file already at the finished size is reported as `skipped`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  // Cropping runs in BATCHES. Decoding a 4961×3602 JPEG in jimp takes seconds,
  // and an 18-spread book in one invocation blew the function's time budget —
  // it died with no response at all, so the admin only saw «Не вдалося
  // обрізати» with nothing to go on. The caller walks `nextOffset` until it
  // reaches `total`, so each request stays comfortably inside the limit.
  const url = new URL(req.url);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(6, Math.max(1, parseInt(url.searchParams.get('limit') || '3', 10) || 3));

  const { id } = await params;
  const admin = getAdminClient();

  const { data: order } = await admin.from('orders').select('id, order_number').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

  // Size comes from the linked project, same resolution order /print uses.
  const { data: projects } = await admin
    .from('projects')
    .select('product_type, format, overlays_data')
    .eq('order_id', id)
    .order('updated_at', { ascending: false });
  const proj = (projects || [])[0] as any;
  if (!proj) return NextResponse.json({ error: 'До замовлення не привʼязано макет — розмір визначити нічим' }, { status: 400 });

  const config = proj?.overlays_data?.config || {};
  const PRODUCT_SIZE: Record<string, string> = { travelbook: '20x30' };
  const sizeKey = normalizeSizeKey(String(
    config.selectedSize || proj.format || PRODUCT_SIZE[String(proj.product_type || '')] || ''
  ));

  const { data: sizeRows } = await admin
    .from('photobook_sizes')
    .select('name, width_cm, height_cm, spread_width_mm, spread_height_mm, cover_width_mm, cover_height_mm, bleed_top_mm, bleed_bottom_mm, bleed_left_mm, bleed_right_mm, cover_fold_margin_mm');
  const row = ((sizeRows || []) as SizeRow[]).find((s) => normalizeSizeKey(String(s.name || '')) === sizeKey) || null;
  const geo = deriveGeometry(sizeKey, row);
  if (!geo) {
    return NextResponse.json({ error: `Не вдалося визначити геометрію для розміру «${sizeKey || '?'}» — відмовляюсь різати наосліп` }, { status: 400 });
  }

  const { data: files } = await admin
    .from('order_files')
    .select('id, file_name, file_path, file_category, bucket_name')
    .eq('order_id', id)
    .eq('file_type', 'export');

  // Spreads are two pages wide; travel-book/magazine page files are one.
  // Covers and the acrylic insert are not spreads and are left alone.
  const targets = (files || [])
    .filter((f: any) => /_(spread|page)\.jpe?g$/i.test(String(f.file_name || '')))
    .sort((a: any, b: any) => String(a.file_name).localeCompare(String(b.file_name)));
  if (targets.length === 0) {
    return NextResponse.json({ error: 'Немає розворотів чи сторінок для обрізки (обкладинки й вставки не чіпаємо)' }, { status: 400 });
  }

  // A two-page spread goes to the printer as the SHEET, bleed included. Nothing
  // here may cut that down — see the header comment and TM-001233.
  const spreads = targets.filter((f: any) => /_spread\.jpe?g$/i.test(String(f.file_name)));
  if (spreads.length === targets.length) {
    return NextResponse.json({
      error: `Це фотокнига — друкарня приймає розворот у розмірі аркуша ${geo.sheet.w}×${geo.sheet.h} мм разом із вилетом. `
        + `Обрізаний до готових ${geo.finished.w}×${geo.finished.h} мм файл вона відхиляє: «ширина ${geo.finished.w} і не є рівна ${geo.sheet.w}». `
        + `Саме через це не пройшло TM-001233. Якщо файли вже обрізані, натисніть «Перегенерувати макет (Railway)».`,
    }, { status: 400 });
  }

  const batch = targets.slice(offset, offset + limit);
  const report: any[] = [];
  for (const f of batch) {
    const bucket = f.bucket_name || 'photobook-uploads';
    if (/_spread\.jpe?g$/i.test(String(f.file_name))) {
      report.push({ file: f.file_name, status: 'skipped', reason: `розворот фотокниги друкується аркушем ${geo.sheet.w}×${geo.sheet.h} мм — виліт лишається` });
      continue;
    }
    const isSinglePage = /_page\.jpe?g$/i.test(String(f.file_name)) || /^\d+\.jpe?g$/i.test(String(f.file_name));
    const targetW = mmToPx(isSinglePage ? geo.page.w : geo.finished.w);
    const targetH = mmToPx(isSinglePage ? geo.page.h : geo.finished.h);

    try {
      const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(f.file_path);
      if (dlErr || !blob) throw new Error(dlErr?.message || 'download failed');
      const img = await Jimp.read(Buffer.from(await blob.arrayBuffer()));
      const W = img.getWidth(), H = img.getHeight();

      if (W === targetW && H === targetH) {
        report.push({ file: f.file_name, status: 'skipped', reason: 'вже у готовому розмірі', size: `${W}×${H}` });
        continue;
      }
      const dx = W - targetW, dy = H - targetH;
      if (dx < 0 || dy < 0) {
        report.push({ file: f.file_name, status: 'error', reason: `файл ${W}×${H} менший за готовий ${targetW}×${targetH}` });
        continue;
      }
      // A ring should be a few percent, not a different layout. Anything bigger
      // means this file is not what we think it is — leave it alone.
      if (dx > W * 0.15 || dy > H * 0.15) {
        report.push({ file: f.file_name, status: 'error', reason: `припуск ${dx}×${dy} px завеликий для ${W}×${H} — не чіпаю` });
        continue;
      }

      // Match the renderer's own split: it used floor(d/2) on the leading edge
      // and gave the remainder to the trailing one.
      const left = Math.floor(dx / 2), top = Math.floor(dy / 2);
      const out = await img.crop(left, top, targetW, targetH)
        .quality(95)
        .getBufferAsync(Jimp.MIME_JPEG);

      const { error: upErr } = await admin.storage
        .from(bucket)
        .upload(f.file_path, out, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
      if (upErr) throw new Error(upErr.message);

      await admin.from('order_files').update({ file_size: out.length }).eq('id', f.id);
      report.push({ file: f.file_name, status: 'ok', from: `${W}×${H}`, to: `${targetW}×${targetH}`, cropped: `${left}/${top}` });
    } catch (e: any) {
      report.push({ file: f.file_name, status: 'error', reason: String(e?.message || e) });
    }
  }

  const ok = report.filter((r) => r.status === 'ok').length;
  const skipped = report.filter((r) => r.status === 'skipped').length;
  const failed = report.filter((r) => r.status === 'error').length;

  const nextOffset = offset + batch.length;

  return NextResponse.json({
    ok: failed === 0,
    orderNumber: order.order_number,
    sizeKey,
    finished: `${geo.finished.w}×${geo.finished.h} мм`,
    page: `${geo.page.w}×${geo.page.h} мм`,
    total: targets.length,
    nextOffset,
    done: nextOffset >= targets.length,
    cropped: ok,
    skipped,
    failed,
    summary: `обрізано ${ok}, пропущено ${skipped}, помилок ${failed}`,
    report,
  });
}
