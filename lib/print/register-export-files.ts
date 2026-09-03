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
 * start at `cover`. `insert_photo.jpg` — the standalone фотовставка photo from
 * generate-cover-bw — is protected for the same reason.
 */
const SERVER_GENERATED_COVER = /(^|\/)(cover(_bw)?|insert_photo)\.jpg$/i;

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
    let pageNumber = m ? parseInt(m[1], 10) + 1 : null;
    // Travel books / journals use the workshop's flat names — cover.jpg,
    // f1.jpg, 01.jpg… f2.jpg — none of which carry the NN_ prefix, so every
    // file of such an order used to land with a null page_number and the
    // admin listed them alphabetically (pages before the cover). Number them
    // in physical order instead: cover, front endpaper, pages, back endpaper.
    if (pageNumber === null) {
      if (/^cover\.jpe?g$/i.test(fileName)) pageNumber = 1;
      else if (/^f1\.jpe?g$/i.test(fileName)) pageNumber = 2;
      else if (/^f2\.jpe?g$/i.test(fileName)) pageNumber = 999;
      else {
        const flat = fileName.match(/^(\d+)\.jpe?g$/i);
        if (flat) pageNumber = parseInt(flat[1], 10) + 2;
      }
    }
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
 * Дістає id макета зі шляху друкованого файлу.
 *
 * Рендер кладе файли в `drafts/{userId}/{projectId}/print/{file}.jpg`, тож id
 * макета — це передостанній сегмент перед `print`. Якщо шлях іншої форми,
 * повертаємо null: краще не впізнати макет, ніж помилково вирішити, що файл
 * чужий, і видалити його.
 */
export function projectIdFromExportPath(path: string): string | null {
    const parts = String(path || '').split('/');
    const printAt = parts.lastIndexOf('print');
    if (printAt < 1) return null;
    const candidate = parts[printAt - 1];
    return /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : null;
}

/**
 * Прибирає друковані файли макетів, яких на замовленні вже немає.
 *
 * Це інша поломка, ніж та, яку ловить pruneStaleExports нижче, і вона
 * протилежна за причиною. Там прибирання СВІДОМО обмежене макетами, що саме
 * відрендерилися, — інакше рендер однієї книги зносить готові файли решти.
 * Але саме це обмеження й ламало сценарій виправлення дизайнером: дизайнер
 * копіює макет клієнта у свої чернетки, тобто отримує НОВИЙ id, ставить копію
 * на замовлення й запускає рендер. Новий набір лягає під новим id, прибирання
 * бачить у своїй області тільки новий id, а двадцять файлів старого макета
 * лишаються на замовленні назавжди.
 *
 * Наслідок у картці: кожна сторінка двічі поспіль, дві обкладинки, набір
 * подвоївся. У друк пішло б удвічі більше аркушів, і половина з них — стара
 * версія з текстом на зрізі, заради виправлення якого все й робилося.
 *
 * Тут перевірка не «що зараз відрендерилось», а «які макети взагалі належать
 * цьому замовленню». Файл, чий id макета не збігається з жодним із них, не
 * може бути потрібен: цей макет уже не має стосунку до замовлення.
 *
 * Обережність. Нічого не робимо, поки не знаємо жодного макета замовлення —
 * інакше збій читання перетворився б на видалення всього. Файли, з чийого
 * шляху id не читається, теж не чіпаємо. Обкладинки, згенеровані сервером,
 * і нерендерні типи виробів захищені так само, як у прибиранні нижче.
 */
export async function pruneExportsOfDetachedProjects(
    admin: SupabaseClient,
    orderId: string,
): Promise<number> {
    const { data: projects, error: projErr } = await admin
        .from('projects')
        .select('id')
        .eq('order_id', orderId);
    if (projErr) {
        console.error('[register-export] detached sweep: cannot read projects', { orderId, error: projErr.message });
        return 0;
    }
    const current = new Set((projects || []).map((p: any) => String(p.id)));
    if (current.size === 0) return 0;

    const { data: files } = await admin
        .from('order_files')
        .select('id, file_path, bucket_name, product_type')
        .eq('order_id', orderId)
        .eq('file_type', 'export');

    const orphans = (files || []).filter((f: any) => {
        const path = String(f.file_path || '');
        if (SERVER_GENERATED_COVER.test(path)) return false;
        if (!RAILWAY_RENDERABLE.test(String(f.product_type || ''))) return false;
        const owner = projectIdFromExportPath(path);
        return !!owner && !current.has(owner);
    });
    if (!orphans.length) return 0;

    // ЗНІМАЄМО РЯДКИ, ФАЙЛИ У СХОВИЩІ ЛИШАЄМО.
    //
    // Це навмисна відмінність від pruneStaleExports нижче, і вона важлива.
    // Сусід прибирає файли ВЛАСНОГО макета, який щойно перерендерився: старий
    // набір за тими самими шляхами вже перезаписаний, тримати його безглуздо.
    // Тут інша ситуація — це файли ЧУЖОГО, відчепленого макета, найчастіше
    // оригіналу клієнта, якого замінили виправленням дизайнера. Саме на цей
    // випадок replace-layout свідомо лишає обʼєкти у сховищі: якщо новий
    // рендер упаде, файли на місці й реєстрацію можна повернути. Видаляти їх
    // звідси означало б скасувати той запобіжник і лишити замовлення взагалі
    // без файлів.
    //
    // Дублювання в картці й у ZIP породжують саме рядки в order_files, тож
    // прибрати рядки достатньо. Обʼєкти у сховищі місця майже не займають і є
    // єдиною страховкою на випадок невдалого рендеру.
    await admin.from('order_files').delete().in('id', (orphans as any[]).map((f) => f.id));
    console.log('[register-export] detached sweep unlinked', { orderId, count: orphans.length });
    return orphans.length;
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
  /**
   * Прибирати тільки файли ТИХ виробів, які цього разу справді відрендерилися.
   *
   * Прибирання рахує застарілим усе, чого немає в новому наборі. Поки в
   * замовленні була одна книга, це було правильно. У замовленні з кількома
   * книгами це стало руйнівним, і двома різними способами:
   *
   *   · рендер ОДНОГО виробу приносить у наборі лише його файли, тож усі інші
   *     книги вважаються застарілими;
   *   · рендер УСЬОГО замовлення, у якому частина книг впала, приносить набір
   *     лише тих, що вдалися, — і зносить готові макети тих, що впали саме
   *     зараз, хоча вчора вони були цілі.
   *
   * У TM-001234 (пʼять тревелбуків) це сталося двічі за два дні: спершу зникли
   * 32 сторінки готової книги, потім 12 сторінок іншої. Захист «нічого не
   * видаляти, якщо набір порожній» від цього не рятує: набір НЕ порожній, у
   * ньому просто не всі.
   *
   * Тому прибирання обмежене списком макетів, які в цьому запуску дійшли до
   * кінця. Порожній або відсутній список означає старý поведінку — усе
   * замовлення, — і використовується лише там, де рендер справді один на все.
   */
  scopeToProjectIds?: string[],
): Promise<void> {
  if (!keepPaths.length) return;
  const newSet = new Set(keepPaths);
  const scopes = (scopeToProjectIds || []).filter(Boolean);
  const { data: oldFiles } = await admin
    .from('order_files')
    .select('id, file_path, bucket_name, product_type, file_category')
    .eq('order_id', orderId)
    .eq('file_type', 'export');
  const stale = (oldFiles || []).filter((f: any) =>
    !newSet.has(f.file_path) &&
    (!scopes.length || scopes.some(id => String(f.file_path || '').includes(id))) &&
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
