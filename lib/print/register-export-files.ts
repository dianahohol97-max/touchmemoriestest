import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Registration of Railway-rendered print files in order_files — shared between
 * /api/print/render-order (the synchronous await path) and
 * /api/print/render-complete (the service's completion callback).
 *
 * Why two callers exist: render-order awaits the Railway render, but a big book
 * (40+ spreads) renders longer than the route's maxDuration — Vercel kills the
 * function mid-await and the finished files were never indexed (TM-001113: all
 * 85 files sat in storage, order_files had zero rows, admin showed no макет).
 * The render service now reports completion itself; both paths register through
 * this module, and registration is idempotent so double delivery is harmless.
 */

// NO `wish` here, on purpose (TM-001138). Wishbook print files are the
// server-generated engraving covers (cover.jpg / cover_bw.jpg from
// generate-wishbook-cover) — never Railway renders: its pages are physical
// coloured paper. Listing wishbook as "renderable" made pruneStaleExports
// treat the generated cover as a stale render and DELETE it the moment any
// re-render ran, leaving the order with 11 blank spreads and no cover.
export const RAILWAY_RENDERABLE = /photobook|fotoknig|travel|magazine|zhurnal|fotozhurnal|journal|planner|calendar|kalendar/i;

/**
 * Server-generated engraving covers: cover.jpg (colour) and cover_bw.jpg (the
 * monochrome макет production engraves from). They are produced by
 * /api/orders/[id]/generate-wishbook-cover and /api/orders/[id]/generate-cover-bw,
 * NEVER by Railway, so they can never appear in a render's keepPaths — and
 * pruneStaleExports would therefore delete them on the next re-render. That is
 * exactly how TM-001138 lost its engraved cover. Railway's own cover is
 * `00_cover.jpg`, which does not match: the anchor requires the file name to
 * start at `cover`.
 */
const SERVER_GENERATED_COVER = /(^|\/)cover(_bw)?\.jpg$/i;

export function exportRowsFromPaths(orderId: string, productType: string | null, uploaded: string[]) {
  return uploaded.map((path) => {
    const fileName = path.split('/').pop() || path;
    const isCover = /(^|\/)00_cover(_front|_back)?\.jpg$/i.test(path) || /cover/i.test(fileName);
    // Travel books / magazines export one file per page — named NN.jpg per
    // the print partner's rule (legacy renders used NN_page.jpg; both are
    // recognised so old rows keep their category). Photobooks export 2-page
    // spreads (NN_spread.jpg).
    const isPage = /_page\.jpg$/i.test(fileName) || /^\d+\.jpe?g$/i.test(fileName);
    // 00_cover -> page 1, 01_spread -> page 2, ... (cover first).
    const m = fileName.match(/^(\d+)_/);
    const pageNumber = m ? parseInt(m[1], 10) + 1 : null;
    return {
      order_id: orderId,
      file_path: path,
      file_name: fileName,
      file_type: 'export',
      file_category: isCover ? 'book-cover' : isPage ? 'book-page' : 'book-spread',
      product_type: productType || 'photobook',
      bucket_name: 'photobook-uploads',
      mime_type: 'image/jpeg',
      page_number: pageNumber,
    };
  });
}

/**
 * Insert order_files rows for freshly rendered paths. Idempotent: this
 * project's own paths are deleted first (re-renders upsert the SAME storage
 * paths, so without the sweep every re-render appended a duplicate row set —
 * TM-001108 carried 30 rows for 15 files).
 */
export async function registerExportFiles(
  admin: SupabaseClient,
  orderId: string,
  productType: string | null,
  uploaded: string[],
): Promise<string | null> {
  if (!uploaded.length) return null;
  const { error: dupErr } = await admin
    .from('order_files')
    .delete()
    .eq('order_id', orderId)
    .eq('file_type', 'export')
    .in('file_path', uploaded);
  if (dupErr) console.error('[register-export] stale row cleanup failed', { orderId, error: dupErr.message });

  const { error: ofErr } = await admin.from('order_files').insert(exportRowsFromPaths(orderId, productType, uploaded));
  if (ofErr) {
    console.error('[register-export] order_files insert failed', { orderId, error: ofErr.message });
    return ofErr.message;
  }
  return null;
}

/**
 * Replace mode: once a fresh render exists, remove every OLDER export of a
 * renderable (book/calendar) product for this order that is not part of the
 * new set — from storage AND the DB. Self-composed exports (poster/map/magnet)
 * and unknown product types are never touched.
 */
export async function pruneStaleExports(
  admin: SupabaseClient,
  orderId: string,
  keepPaths: string[],
): Promise<void> {
  if (!keepPaths.length) return;
  const newSet = new Set(keepPaths);
  const { data: oldFiles } = await admin
    .from('order_files')
    .select('id, file_path, bucket_name, product_type, file_category')
    .eq('order_id', orderId)
    .eq('file_type', 'export');
  const stale = (oldFiles || []).filter((f: any) =>
    !newSet.has(f.file_path) &&
    !SERVER_GENERATED_COVER.test(String(f.file_path || '')) &&
    RAILWAY_RENDERABLE.test(String(f.product_type || '')),
  );
  if (!stale.length) return;
  const byBucket = new Map<string, string[]>();
  for (const f of stale as any[]) {
    const b = f.bucket_name || 'photobook-uploads';
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b)!.push(f.file_path);
  }
  for (const [bucket, paths] of byBucket) {
    try { await admin.storage.from(bucket).remove(paths); }
    catch (e: any) { console.error('[register-export] storage cleanup failed', { orderId, bucket, error: e?.message }); }
  }
  await admin.from('order_files').delete().in('id', (stale as any[]).map((f) => f.id));
}
