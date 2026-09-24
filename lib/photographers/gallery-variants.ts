import {
  GALLERY_VARIANT_MAX_TRIES,
  GALLERY_VARIANT_RETRY_MS,
  allGalleryVariantPaths,
  galleryVariantPath,
  rowNeedsVariants,
} from './gallery-variant-paths';
import type { StoredFile } from './remove-files';
import type { RenderedVariants } from './gallery-variants-render';

/**
 * Черга екранних копій для фото галерей: хто, коли і в якому порядку їх
 * робить. Сама нарізка — у gallery-variants-render.ts (sharp), шляхи — у
 * gallery-variant-paths.ts. Залежності передаються ззовні, щоб тести ганяли
 * порядок кроків без справжнього сховища (tests/gallery-variants.test.ts).
 *
 * ЧОМУ СЕРВЕР, А НЕ БРАУЗЕР ФОТОГРАФА. Браузер під час аплоаду й так зайнятий:
 * чотири паралельні завантаження по 10–20 МБ. Розкодувати там ще й кожен
 * оригінал на 24–45 Мп — це сотні мегабайтів растру на вкладку і ризик, що
 * впаде саме аплоад, а він важливіший за мініатюру. До того ж старі фото
 * доганяти однаково треба на сервері, і одна реалізація для нових і старих
 * фото — це одна поведінка, а не дві, які з часом розійдуться.
 *
 * ПОРЯДОК, ЯКИЙ НЕ ДАЄ КОПІЯМ СТАТИ СИРОТАМИ.
 *   1. Спершу рядок отримує позначку спроби (`variant_tries` + 1). Відтепер
 *      будь-яке видалення цього фото прибирає і шляхи копій
 *      (galleryFilesToRemove), навіть якщо копії ще не записані.
 *   2. Позначка ставиться умовно, за старим значенням лічильника: із двох
 *      паралельних обробників (кабінет і крон) працює лише один.
 *   3. Після запису копій рядок оновлюється з `.select('id')`. Нуль рядків
 *      означає, що фото видалили, поки ми різали, — тоді ми самі стираємо щойно
 *      записані копії.
 *   4. Галереї, у яких термін уже минув, у чергу не потрапляють зовсім: там
 *      працює крон очищення, і різати фото, яке от-от зітруть, — це гонка.
 */

export interface GalleryVariantDeps {
  db: any;
  readOriginal: (path: string, provider: string | null) => Promise<Buffer | null>;
  put: (path: string, body: Buffer, provider: string | null) => Promise<string | null>;
  removeFiles: (files: StoredFile[]) => Promise<string | null>;
  render: (original: Buffer) => Promise<RenderedVariants>;
  now?: () => Date;
}

export interface QueueRow {
  id: string;
  gallery_id: string;
  storage_path: string;
  storage_provider: string | null;
  media_type: string | null;
  variants_at: string | null;
  variant_tries: number | null;
  variant_tried_at: string | null;
}

export const QUEUE_COLUMNS = 'id, gallery_id, storage_path, storage_provider, media_type, variants_at, variant_tries, variant_tried_at';

export type RowOutcome =
  | { outcome: 'made'; bytes: number }
  | { outcome: 'failed'; error: string }
  | { outcome: 'gone' }
  | { outcome: 'busy' };

export async function makeVariantsForRow(deps: GalleryVariantDeps, row: QueueRow): Promise<RowOutcome> {
  const now = deps.now?.() ?? new Date();
  if (!rowNeedsVariants(row, now.getTime())) return { outcome: 'busy' };
  const tries = Number(row.variant_tries) || 0;

  // 1–2. Позначка спроби, умовна за лічильником.
  const { data: claimed, error: claimErr } = await deps.db
    .from('photographer_gallery_photos')
    .update({ variant_tries: tries + 1, variant_tried_at: now.toISOString() })
    .eq('id', row.id)
    .eq('variant_tries', tries)
    .is('variants_at', null)
    .select('id');
  if (claimErr) return { outcome: 'failed', error: claimErr.message || String(claimErr) };
  if (!claimed || claimed.length === 0) return { outcome: 'busy' };

  const fail = async (error: string): Promise<RowOutcome> => {
    await deps.db
      .from('photographer_gallery_photos')
      .update({ variant_error: error.slice(0, 300) })
      .eq('id', row.id);
    return { outcome: 'failed', error };
  };

  const original = await deps.readOriginal(row.storage_path, row.storage_provider);
  if (!original) return fail('оригінал не прочитався зі сховища');

  let rendered: RenderedVariants;
  try {
    rendered = await deps.render(original);
  } catch (e: any) {
    return fail(`sharp: ${e?.message || e}`);
  }

  let bytes = 0;
  for (const v of rendered.variants) {
    const err = await deps.put(galleryVariantPath(row.storage_path, v.edge), v.body, row.storage_provider);
    // Частина копій уже може лежати в сховищі — це не сироти: позначка
    // спроби стоїть, і видалення фото прибере всі шляхи.
    if (err) return fail(`запис копії ${v.edge}: ${err}`);
    bytes += v.body.length;
  }

  // 3. Позначка готовності. Нуль рядків — фото видалили, поки ми різали.
  const { data: done, error: doneErr } = await deps.db
    .from('photographer_gallery_photos')
    .update({
      width: rendered.width,
      height: rendered.height,
      variants_at: (deps.now?.() ?? new Date()).toISOString(),
      variant_bytes: bytes,
      variant_error: null,
    })
    .eq('id', row.id)
    .select('id');
  if (doneErr) return { outcome: 'failed', error: doneErr.message || String(doneErr) };
  if (!done || done.length === 0) {
    const files = allGalleryVariantPaths(row.storage_path).map(path => ({ path, provider: row.storage_provider }));
    const rmErr = await deps.removeFiles(files);
    if (rmErr) console.error('[gallery-variants] copies of a deleted photo not removed', { id: row.id, error: rmErr });
    return { outcome: 'gone' };
  }
  return { outcome: 'made', bytes };
}

/**
 * Черговий шматок черги. Усі умови стоять У ЗАПИТІ, до `.limit()` (гоча 13):
 * фото, для якого копії вже є або спроби вичерпано, не займає місця в
 * порції, і черга не стає «вічно першими» зламаними рядками.
 */
export async function pendingVariantRows(
  db: any,
  scope: (q: any) => any,
  limit: number,
  now: Date,
): Promise<{ rows: QueueRow[]; error: string | null }> {
  const cooldown = new Date(now.getTime() - GALLERY_VARIANT_RETRY_MS).toISOString();
  const { data, error } = await scope(
    db.from('photographer_gallery_photos').select(QUEUE_COLUMNS),
  )
    .eq('media_type', 'photo')
    .is('variants_at', null)
    .lt('variant_tries', GALLERY_VARIANT_MAX_TRIES)
    .or(`variant_tried_at.is.null,variant_tried_at.lt.${cooldown}`)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);
  if (error) return { rows: [], error: error.message || String(error) };
  return { rows: (data || []) as QueueRow[], error: null };
}

/** Скільки фото в межах `scope` ще не мають копій і можуть їх отримати. */
export async function countPendingVariants(db: any, scope: (q: any) => any): Promise<number | null> {
  const { count, error } = await scope(
    db.from('photographer_gallery_photos').select('id', { count: 'exact', head: true }),
  )
    .eq('media_type', 'photo')
    .is('variants_at', null)
    .lt('variant_tries', GALLERY_VARIANT_MAX_TRIES);
  return error ? null : count ?? null;
}

export interface VariantRunReport {
  made: number;
  failed: number;
  gone: number;
  busy: number;
  bytes: number;
  errors: { id: string; error: string }[];
  /** Фото, які ще чекають у межах цього scope (null — не вдалося порахувати). */
  remaining: number | null;
  /** Порцію обірвав бюджет часу, а не порожня черга. */
  stoppedByBudget: boolean;
}

export interface VariantRunOptions {
  /** Фільтр по галереї чи галереях — `q => q.eq('gallery_id', id)`. */
  scope: (q: any) => any;
  /** Скільки фото за один прохід найбільше. */
  maxPhotos?: number;
  /** Не починати нових фото після стількох мс. */
  budgetMs?: number;
  /** Скільки фото ріжемо одночасно: кожне тримає свій растр у памʼяті. */
  concurrency?: number;
}

/**
 * Одна порція копій. Перезапуск безпечний: фото з готовими копіями в чергу
 * не потрапляють, шляхи копій визначені оригіналом, тож повтор перезаписує
 * той самий файл, а не кладе поруч другий.
 */
export async function runGalleryVariants(deps: GalleryVariantDeps, opts: VariantRunOptions): Promise<VariantRunReport> {
  const maxPhotos = opts.maxPhotos ?? 120;
  const budgetMs = opts.budgetMs ?? 45_000;
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  const started = Date.now();
  const report: VariantRunReport = { made: 0, failed: 0, gone: 0, busy: 0, bytes: 0, errors: [], remaining: null, stoppedByBudget: false };

  let handled = 0;
  while (handled < maxPhotos) {
    if (Date.now() - started > budgetMs) { report.stoppedByBudget = true; break; }
    const { rows, error } = await pendingVariantRows(deps.db, opts.scope, Math.min(30, maxPhotos - handled), deps.now?.() ?? new Date());
    if (error) { report.errors.push({ id: '-', error }); break; }
    if (rows.length === 0) break;

    let cursor = 0;
    const worker = async () => {
      while (cursor < rows.length) {
        if (Date.now() - started > budgetMs) { report.stoppedByBudget = true; return; }
        const row = rows[cursor++];
        let res: RowOutcome;
        try {
          res = await makeVariantsForRow(deps, row);
        } catch (e: any) {
          res = { outcome: 'failed', error: e?.message || String(e) };
        }
        handled++;
        if (res.outcome === 'made') { report.made++; report.bytes += res.bytes; }
        else if (res.outcome === 'failed') { report.failed++; report.errors.push({ id: row.id, error: res.error }); }
        else if (res.outcome === 'gone') report.gone++;
        else report.busy++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
    if (report.stoppedByBudget) break;
  }

  report.remaining = await countPendingVariants(deps.db, opts.scope);
  return report;
}

/**
 * Галереї, де копії робити можна: файли не стерті, термін не минув (з запасом
 * у годину, щоб не різати фото, яке зараз зітре крон очищення).
 */
export async function liveGalleryIds(db: any, now: Date, only?: string[]): Promise<{ ids: string[]; error: string | null }> {
  let q = db
    .from('photographer_galleries')
    .select('id')
    .is('files_purged_at', null)
    .gt('expires_at', new Date(now.getTime() + 60 * 60 * 1000).toISOString());
  if (only && only.length) q = q.in('id', only);
  // Свідомий ліміт: живих галерей десятки, тисяча — далеко за межею.
  const { data, error } = await q.limit(1000);
  if (error) return { ids: [], error: error.message || String(error) };
  return { ids: (data || []).map((g: any) => g.id), error: null };
}

/** Скільки годин назад дивиться страховка для свіжих аплоадів. */
export const RECENT_UPLOAD_HOURS = 48;

/**
 * Страховка для свіжих аплоадів: фото за останні RECENT_UPLOAD_HOURS без копій
 * у всіх живих галереях. Кабінет просить копії одразу після аплоаду, але
 * фотограф міг закрити вкладку раніше.
 *
 * Окремого крона для цього немає свідомо: у проєкті вже 34 крони, і 35-й
 * підійшов би впритул до ліміту тарифу (Діана, 2026-09-24). Тому це їде
 * «попутником» у /api/cron/telegram-webhook-sync, який і так ходить кожні
 * 15 хвилин. Бюджет малий: коли свіжих фото без копій немає, а так буває
 * майже завжди, це два легкі запити.
 *
 * Історію тут НЕ доганяють: галереї, що були до копій, заповнює явний
 * бекфіл по одній галереї (/api/admin/photographers/gallery-variants), у
 * порядку, який обирає Діана.
 */
export async function catchUpRecentVariants(deps: GalleryVariantDeps, budgetMs = 20_000): Promise<VariantRunReport | { skipped: string }> {
  const now = deps.now?.() ?? new Date();
  const live = await liveGalleryIds(deps.db, now);
  if (live.error) return { skipped: live.error };
  if (!live.ids.length) return { skipped: 'no live galleries' };
  const since = new Date(now.getTime() - RECENT_UPLOAD_HOURS * 3600 * 1000).toISOString();
  return runGalleryVariants(deps, {
    scope: q => q.in('gallery_id', live.ids).gte('created_at', since),
    maxPhotos: 30,
    budgetMs,
  });
}
