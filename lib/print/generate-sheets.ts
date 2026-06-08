import Jimp from 'jimp';
import { getAdminClient } from '@/lib/supabase/admin';
import { PRINT_SIZES, mmToPx, bestGrid, detectSize } from './imposition';

// Customer-uploaded, print-ready per-photo exports live in order_files under
// these categories. Standard sizes (10×15 etc.) are printed one-up at the lab
// and are intentionally skipped here — only the tile sizes get ganged onto a
// sheet (detectSize returns null for anything else).
const PRINT_CATEGORIES = ['photo-print', 'polaroid-print', 'photomagnets'];
const SHEET_CATEGORY = 'print_sheet';
const BUCKET = 'order-files';
const JPEG_QUALITY = 92;

const blankSheet = (w: number, h: number): Promise<Jimp> =>
  new Promise((resolve, reject) => {
    // jimp 0.22 blank-image constructor (callback form)
    new (Jimp as any)(w, h, 0xffffffff, (err: Error | null, img: Jimp) => (err ? reject(err) : resolve(img)));
  });

export interface GenerateResult {
  ok: boolean;
  sheets?: number;
  skipped?: boolean;
  reason?: string;
}

/**
 * Build print-ready sheets for an order: take the customer's per-photo prints
 * from order_files, group them by (category, detected size), tile each group
 * into JPG sheets (count-per-sheet = product кратність), upload to Storage and
 * record them as order_files (file_category='print_sheet'). Idempotent unless
 * `force` — repeated calls after the first are no-ops.
 */
export async function generateOrderPrintSheets(orderId: string, opts: { force?: boolean } = {}): Promise<GenerateResult> {
  const admin = getAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('id, print_file_generated_at')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.print_file_generated_at && !opts.force) return { ok: true, skipped: true };

  const { data: files } = await admin
    .from('order_files')
    .select('file_path, bucket_name, file_category, page_number')
    .eq('order_id', orderId)
    .in('file_category', PRINT_CATEGORIES)
    .order('page_number', { ascending: true });
  if (!files || files.length === 0) return { ok: true, sheets: 0, reason: 'no_print_files' };

  // Load + classify each photo by its rendered pixel size.
  const groups = new Map<string, { sizeId: string; category: string; imgs: Jimp[] }>();
  for (const f of files) {
    try {
      const { data: blob } = await admin.storage.from(f.bucket_name || BUCKET).download(f.file_path);
      if (!blob) continue;
      const buf = Buffer.from(await blob.arrayBuffer());
      const img = await Jimp.read(buf);
      const size = detectSize(img.bitmap.width, img.bitmap.height, f.file_category);
      if (!size) continue; // standard / unrecognised → not ganged onto a sheet
      const key = `${f.file_category}:${size.id}`;
      if (!groups.has(key)) groups.set(key, { sizeId: size.id, category: f.file_category, imgs: [] });
      groups.get(key)!.imgs.push(img);
    } catch (e) {
      console.warn('[print-sheets] skip file', f.file_path, e);
    }
  }
  if (groups.size === 0) return { ok: true, sheets: 0, reason: 'no_tile_sizes' };

  // On force, clear previously generated sheets (rows + storage) to avoid dupes.
  if (opts.force) {
    const { data: old } = await admin
      .from('order_files')
      .select('file_path, bucket_name')
      .eq('order_id', orderId)
      .eq('file_category', SHEET_CATEGORY);
    if (old?.length) {
      await admin.storage.from(BUCKET).remove(old.map(o => o.file_path));
      await admin.from('order_files').delete().eq('order_id', orderId).eq('file_category', SHEET_CATEGORY);
    }
  }

  const records: any[] = [];
  let sheetIndex = 0;
  for (const { sizeId, category, imgs } of groups.values()) {
    const size = PRINT_SIZES.find(s => s.id === sizeId)!;
    const cellW = mmToPx(size.wMm), cellH = mmToPx(size.hMm);
    const { cols, rows } = bestGrid(size.perSheet, size.wMm, size.hMm);
    const sheetW = cols * cellW, sheetH = rows * cellH;

    for (let i = 0; i < imgs.length; i += size.perSheet) {
      const pageImgs = imgs.slice(i, i + size.perSheet);
      const sheet = await blankSheet(sheetW, sheetH);
      pageImgs.forEach((img, idx) => {
        const c = idx % cols, r = Math.floor(idx / cols);
        // Auto-rotate so orientation matches the cell, then exact-fit (cover).
        if ((img.bitmap.width >= img.bitmap.height) !== (cellW >= cellH)) img.rotate(90);
        img.cover(cellW, cellH);
        sheet.composite(img, c * cellW, r * cellH);
      });
      const out = await sheet.quality(JPEG_QUALITY).getBufferAsync(Jimp.MIME_JPEG);
      sheetIndex++;
      const fileName = `${category}-${size.id}-${String(sheetIndex).padStart(2, '0')}.jpg`;
      const path = `print-sheets/${orderId}/${fileName}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, out, {
        contentType: 'image/jpeg', upsert: true, cacheControl: '3600',
      });
      if (upErr) { console.warn('[print-sheets] upload failed', path, upErr); continue; }
      records.push({
        order_id: orderId,
        file_path: path,
        file_name: fileName,
        file_type: 'print_sheet',
        file_category: SHEET_CATEGORY,
        product_type: category,
        bucket_name: BUCKET,
        file_size: out.length,
        mime_type: 'image/jpeg',
        page_number: sheetIndex,
      });
    }
  }

  if (records.length) await admin.from('order_files').insert(records);
  await admin.from('orders').update({ print_file_generated_at: new Date().toISOString() }).eq('id', orderId);
  return { ok: true, sheets: records.length };
}
