/**
 * The decision logic of removeFiles(), kept apart from the real S3 and
 * Supabase clients so tests can drive it (lib/photographers/storage.ts wires
 * the real ones in).
 *
 * The contract every caller relies on: `null` means EVERY file is gone from
 * storage. The retention cron deletes the rows right after, and a row is the
 * only way we can ever find a file again — so «probably gone» has to come
 * back as an error. Two silent holes existed until 2026-09-24:
 *
 *   – with R2 unconfigured, R2 keys were skipped and the function still
 *     returned null, so the cron deleted rows of files that were still there;
 *   – DeleteObjects answers HTTP 200 even when some keys were NOT deleted:
 *     those arrive in the response's `Errors` array, which nobody read.
 */

export interface StoredFile {
  path: string;
  provider?: string | null;
}

export interface RemoveFilesDeps {
  /** isR2Configured() */
  r2Enabled: boolean;
  /** Why R2 is off, for the error message. */
  r2Problem?: string;
  /** One DeleteObjects call (≤ 1000 keys). Resolves with the S3 response. */
  r2DeleteBatch: (keys: string[]) => Promise<{ Errors?: { Key?: string; Code?: string; Message?: string }[] } | undefined>;
  /** storage.from(bucket).remove(paths) — data lists the objects actually removed. */
  supabaseRemove: (paths: string[]) => Promise<{ data: { name?: string }[] | null; error: { message: string } | null }>;
  /**
   * Is this object still in the Supabase bucket? `null` = could not tell.
   * Needed because remove() omits paths that were already absent, so a
   * short answer alone cannot tell «refused» from «already gone» — and a
   * retry after a half-finished purge is exactly the «already gone» case.
   */
  supabaseExists: (path: string) => Promise<boolean | null>;
}

export const R2_DELETE_BATCH = 1000;
export const SUPABASE_REMOVE_BATCH = 100;

export async function removeFilesWith(deps: RemoveFilesDeps, files: StoredFile[]): Promise<string | null> {
  const r2Keys = files.filter(f => f.provider === 'r2').map(f => f.path);
  const sbKeys = files.filter(f => f.provider !== 'r2').map(f => f.path);

  // Refuse BEFORE touching anything: a half-done removal is still a failure,
  // but there is no reason to make it one.
  if (r2Keys.length && !deps.r2Enabled) {
    return `R2 не налаштовано${deps.r2Problem ? ` (${deps.r2Problem})` : ''}: ${r2Keys.length} файл(ів) лишилися б у сховищі без рядка в базі`;
  }

  for (let i = 0; i < r2Keys.length; i += R2_DELETE_BATCH) {
    const batch = r2Keys.slice(i, i + R2_DELETE_BATCH);
    let res;
    try {
      res = await deps.r2DeleteBatch(batch);
    } catch (e: any) {
      return e?.message || 'R2 delete failed';
    }
    const errors = res?.Errors || [];
    if (errors.length) {
      const first = errors[0];
      return `R2 не видалив ${errors.length} з ${batch.length} файлів (перший: ${first.Key || '?'} — ${first.Code || ''} ${first.Message || ''})`.trim();
    }
  }

  for (let i = 0; i < sbKeys.length; i += SUPABASE_REMOVE_BATCH) {
    const batch = sbKeys.slice(i, i + SUPABASE_REMOVE_BATCH);
    const { data, error } = await deps.supabaseRemove(batch);
    if (error) return error.message;
    if (!data) return 'Supabase remove() не повернув список видалених файлів';
    const removed = new Set(data.map(o => o.name));
    const missing = batch.filter(p => !removed.has(p));
    for (const path of missing) {
      const still = await deps.supabaseExists(path);
      if (still === null) return `Supabase: не вдалося перевірити, чи видалено ${path}`;
      if (still) return `Supabase не видалив ${path}`;
    }
  }
  return null;
}
