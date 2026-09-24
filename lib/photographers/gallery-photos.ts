/**
 * Reading photographer_gallery_photos in full.
 *
 * A gallery holds up to MAX_PHOTOS_PER_GALLERY (2000) files, and PostgREST
 * returns at most 1000 rows per request WITHOUT saying so: the answer is
 * simply shorter than the truth (gotcha 14 in CLAUDE.md). Until 2026-09-24
 * the retention cron read one page, deleted only those files from storage,
 * then wiped every row of the gallery — everything past the thousandth file
 * stayed in R2 forever with no row pointing at it.
 *
 * So every read that means «all rows of these galleries» goes through here.
 * Pages are ordered by (created_at, id): created_at alone is not unique —
 * a batch upload inserts many rows within one millisecond — and without a
 * tiebreaker two pages can overlap or skip rows at their seam.
 *
 * No heavy imports on purpose: the cleanup tests drive this with a fake
 * client that caps responses at 1000 rows exactly like PostgREST does.
 */

export const GALLERY_PHOTOS_PAGE = 1000;

/**
 * Fuse against an endless loop. A gallery holds at most 2000 files, and the
 * widest read (favorites across all of a photographer's galleries) is far
 * below ten thousand. A client that ignores .range() and always answers a
 * full page would otherwise spin forever; hitting the fuse is an ERROR, not a
 * truncated success.
 */
export const GALLERY_PHOTOS_MAX_PAGES = 10;

/**
 * Every row matching `scope`, read page by page.
 *
 * `scope` adds the filters (`.eq('gallery_id', …)`, `.in(…)`, `.eq('favorite', true)`).
 * An error on ANY page fails the whole read — a partial list handed to a
 * caller that deletes by it is exactly the bug this file exists to prevent.
 */
export async function readGalleryPhotoRows<T = any>(
  db: any,
  columns: string,
  scope: (q: any) => any,
  maxPages: number = GALLERY_PHOTOS_MAX_PAGES,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let page = 0, from = 0; ; page++, from += GALLERY_PHOTOS_PAGE) {
    if (page >= maxPages) {
      return { rows: [], error: `читання фото галереї перевищило ${maxPages} сторінок по ${GALLERY_PHOTOS_PAGE} рядків` };
    }
    const { data, error } = await scope(
      db.from('photographer_gallery_photos').select(columns),
    )
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + GALLERY_PHOTOS_PAGE - 1);
    if (error) return { rows: [], error: error.message || String(error) };
    const got = (data || []) as T[];
    rows.push(...got);
    if (got.length < GALLERY_PHOTOS_PAGE) break;
  }
  return { rows, error: null };
}

/** All rows of one gallery, oldest first. */
export function readAllGalleryPhotos<T = any>(db: any, galleryId: string, columns: string) {
  return readGalleryPhotoRows<T>(db, columns, q => q.eq('gallery_id', galleryId));
}
