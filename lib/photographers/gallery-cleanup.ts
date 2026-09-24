import { readAllGalleryPhotos } from './gallery-photos';
import type { StoredFile } from './remove-files';

/**
 * Retention for photographer galleries: once expires_at has passed, the files
 * are deleted from storage, the photo rows go, and files_purged_at marks the
 * gallery done. The gallery row itself stays (the client link shows an
 * «expired» state with the photographer's contacts).
 *
 * The order is the whole point. A file is findable only through its row, so
 * rows are deleted strictly AFTER storage confirmed every file is gone, and
 * files_purged_at is set only after a recount shows the gallery empty. Every
 * step that fails leaves the gallery for the next run instead of guessing.
 * What went wrong before 2026-09-24:
 *
 *   – the photo list was one unpaginated read, i.e. at most 1000 of up to
 *     2000 files — the rest stayed in R2 with no row, forever;
 *   – rows were deleted with eq('gallery_id'), which also took any row added
 *     while the purge ran, whose file had never been deleted;
 *   – a failure on one gallery aborted the whole run with a 500.
 *
 * Dependencies are injected so tests can run it against a fake PostgREST that
 * caps answers at 1000 rows (tests/gallery-cleanup.test.ts).
 */

export interface GalleryCleanupDeps {
  /** Supabase-shaped client (the admin client in production). */
  db: any;
  removeFiles: (files: StoredFile[]) => Promise<string | null>;
  now?: () => Date;
  log?: (message: string, context: Record<string, unknown>) => void;
}

export type SkipStage = 'exception' | 'read' | 'files' | 'rows' | 'recount' | 'rows_remain' | 'mark';

export interface GallerySkip {
  gallery_id: string;
  stage: SkipStage;
  reason: string;
}

export type PurgeResult =
  | { ok: true; files: number }
  | ({ ok: false } & Omit<GallerySkip, 'gallery_id'>);

/**
 * `.in('id', …)` travels in the URL; 200 uuids is ~7 KB, comfortably under
 * any proxy's URL limit.
 */
export const ROW_DELETE_CHUNK = 200;

export async function purgeGallery(deps: GalleryCleanupDeps, galleryId: string): Promise<PurgeResult> {
  const { db } = deps;

  const { rows, error: readErr } = await readAllGalleryPhotos<{ id: string; storage_path: string; storage_provider: string | null }>(
    db, galleryId, 'id, storage_path, storage_provider',
  );
  if (readErr) return { ok: false, stage: 'read', reason: readErr };

  // Rows without a path point at nothing in storage; they still have to go.
  const files = rows
    .filter(r => r.storage_path)
    .map(r => ({ path: r.storage_path, provider: r.storage_provider }));
  if (files.length) {
    const rmErr = await deps.removeFiles(files);
    if (rmErr) return { ok: false, stage: 'files', reason: rmErr };
  }

  // Only the rows we just emptied — never eq('gallery_id'): a row inserted
  // after the read has a file nobody deleted.
  const ids = rows.map(r => r.id);
  for (let i = 0; i < ids.length; i += ROW_DELETE_CHUNK) {
    const { error } = await db
      .from('photographer_gallery_photos')
      .delete()
      .eq('gallery_id', galleryId)
      .in('id', ids.slice(i, i + ROW_DELETE_CHUNK));
    if (error) return { ok: false, stage: 'rows', reason: error.message || String(error) };
  }

  const { count, error: countErr } = await db
    .from('photographer_gallery_photos')
    .select('id', { count: 'exact', head: true })
    .eq('gallery_id', galleryId);
  if (countErr) return { ok: false, stage: 'recount', reason: countErr.message || String(countErr) };
  if (count == null) return { ok: false, stage: 'recount', reason: 'лічильник рядків не повернувся' };
  if (count > 0) {
    // Someone uploaded during the purge. The next run reads those rows and
    // deletes their files the normal way.
    return { ok: false, stage: 'rows_remain', reason: `після очищення в галереї лишилося ${count} рядків` };
  }

  const { error: markErr } = await db
    .from('photographer_galleries')
    .update({ files_purged_at: (deps.now?.() ?? new Date()).toISOString() })
    .eq('id', galleryId)
    .is('files_purged_at', null);
  if (markErr) return { ok: false, stage: 'mark', reason: markErr.message || String(markErr) };

  return { ok: true, files: files.length };
}

export interface CleanupReport {
  candidates: number;
  purgedGalleries: number;
  purgedFiles: number;
  skipped: GallerySkip[];
  /** Candidates left unprocessed because the time budget ran out. */
  deferred: number;
}

export interface CleanupOptions {
  /** How many galleries to purge per run at most. */
  batch?: number;
  /**
   * How many candidates to look at. Larger than `batch` on purpose: a
   * gallery that keeps failing stays a candidate, and with a window equal to
   * the batch 25 stuck galleries would starve every other one (gotcha 13).
   */
  window?: number;
  /** Stop starting new galleries after this many ms (the route has 60 s). */
  budgetMs?: number;
}

export async function cleanupExpiredGalleries(deps: GalleryCleanupDeps, opts: CleanupOptions = {}): Promise<CleanupReport> {
  const batch = opts.batch ?? 25;
  const window = opts.window ?? 200;
  const budgetMs = opts.budgetMs ?? 45_000;
  const started = Date.now();
  const now = deps.now?.() ?? new Date();

  const { data: galleries, error } = await deps.db
    .from('photographer_galleries')
    .select('id')
    .lt('expires_at', now.toISOString())
    .is('files_purged_at', null)
    .order('expires_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(window);
  if (error) throw new Error(error.message || String(error));

  const report: CleanupReport = {
    candidates: (galleries || []).length, purgedGalleries: 0, purgedFiles: 0, skipped: [], deferred: 0,
  };

  const list = galleries || [];
  for (let i = 0; i < list.length; i++) {
    if (report.purgedGalleries >= batch || Date.now() - started > budgetMs) {
      report.deferred = list.length - i;
      break;
    }
    const g = list[i];
    let res: PurgeResult;
    try {
      res = await purgeGallery(deps, g.id);
    } catch (e: any) {
      res = { ok: false, stage: 'exception', reason: e?.message || String(e) };
    }
    if (res.ok) {
      report.purgedGalleries++;
      report.purgedFiles += res.files;
    } else {
      const skip = { gallery_id: g.id, stage: res.stage, reason: res.reason };
      report.skipped.push(skip);
      deps.log?.('[cleanup-galleries] gallery skipped', skip);
    }
  }
  return report;
}
