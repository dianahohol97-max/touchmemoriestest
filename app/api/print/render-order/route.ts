import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { hasPrintWarning, printWarningLine, stripPrintWarning } from '@/lib/print/print-warning';
import { registerExportFiles, pruneStaleExports, pruneExportsOfDetachedProjects } from '@/lib/print/register-export-files';
import { resolveMissingPhotoPaths, countUnprintablePhotos } from '@/lib/print/resolve-photo-paths';
import { isRenderComplete } from '@/lib/print/render-result';

export const dynamic = 'force-dynamic';
// The Railway render of every spread can take 1–2 min for a large book; give the
// route room so a fire-and-forget trigger actually completes and registers files.
export const maxDuration = 300;

/**
 * Trigger the print render for a paid order.
 *
 * Called fire-and-forget from the Monobank webhook on the first transition to
 * paid (and reusable from an admin "re-render" button). It finds the saved
 * constructor project for this order, then asks the Railway render service to
 * screenshot every spread at 300 DPI and upload the JPEGs to Supabase storage.
 *
 * Guarded by CRON_SECRET like the other internal on-payment routes. Always
 * returns 200-ish JSON describing what happened; the caller ignores the body
 * and never lets a render problem break payment confirmation.
 */

// ── Universal print-artifact audit ──────────────────────────────────────────
// Runs for EVERY paid order (this route fires on the first paid transition and
// from the render-paid-orders backstop cron). For each order item it knows the
// class of print artifact production needs, and flags the order the moment a
// paid item has none — so a lost design/export surfaces in the admin within
// seconds of payment instead of at the print shop. This is deliberately
// server-side and constructor-agnostic: it does not trust any client-side
// save/upload code, so a bug in ANY current or future constructor is caught
// here as long as its product name matches a class below. Unknown products are
// not flagged (no false alarms), known ones fail LOUD.
const RX = {
  // no customer artwork needed at all
  exclude: /сертифікат|certificate|gift.?card/i,
  // books & calendars — rendered by Railway from a saved projects row
  book: /photobook|fotoknig|фотокниг|travel|тревел|magazine|журнал|zhurnal|journal|planner|планер|wish|побажан|альбом|книг|календар|calendar|kalendar/i,
  // client-composed single-file products — their print file is an export row
  self: /постер|poster|мапа|map\b|зорян|star.?map|монограм|monogram|зодіак|zodiac|портрет|portrait|cartoon|мультяш|pixar|піксар/i,
  // photo sets — customer photos as uploads (files may live only in storage)
  photoset: /фотодрук|фото.?друк|photo.?print|полароїд|polaroid|магніт|magnet|пазл|puzzle/i,
};

async function auditPrintArtifacts(admin: ReturnType<typeof getAdminClient>, orderId: string) {
  try {
    const { data: ord } = await admin
      .from('orders')
      .select('items, notes, customer_id, with_designer, designer_id')
      .eq('id', orderId)
      .maybeSingle();
    const items = Array.isArray((ord as any)?.items) ? (ord as any).items : [];
    if (!items.length) return;
    const notes: string = (ord as any)?.notes || '';
    // Раніше тут стояв ранній вихід «уже позначено». Тепер перевірка йде до
    // кінця навіть для позначеного замовлення: без цього ніхто б не побачив,
    // що підстав для попередження вже немає, і зняти його було б нікому.
    const alreadyFlagged = hasPrintWarning(notes);

    const [{ data: files }, { count: projCount }] = await Promise.all([
      admin.from('order_files').select('file_type, product_type, file_category').eq('order_id', orderId),
      admin.from('projects').select('id', { count: 'exact', head: true }).eq('order_id', orderId),
    ]);
    const rows = files || [];
    const hasProject = (projCount ?? 0) > 0;
    const isBookFile = (f: any) =>
      RX.book.test(String(f.product_type || '')) || /^book-/.test(String(f.file_category || ''));
    // legacy rows without product_type count for everyone (lenient — no false alarms)
    const hasBookExport = rows.some(f => f.file_type === 'export' && (!f.product_type || isBookFile(f)));
    const hasOtherExport = rows.some(f => f.file_type === 'export' && (!f.product_type || !isBookFile(f)));
    const hasAnyRow = rows.length > 0;

    // Photo sets sometimes live ONLY in storage (order-files/{customer}/{item}/…)
    // with no order_files rows at all — scan before declaring them missing.
    let hasStorageFiles = false;
    const needsStorageScan = !hasAnyRow && items.some((it: any) =>
      RX.photoset.test(`${it?.slug || ''} ${it?.name || it?.product_name || ''}`));
    if (needsStorageScan && (ord as any)?.customer_id) {
      try {
        const folder = String((ord as any).customer_id);
        const { data: subdirs } = await admin.storage.from('order-files').list(folder, { limit: 100 });
        for (const d of (subdirs || []) as any[]) {
          if (!d?.name || d.id) continue; // folders have id === null
          const { data: entries } = await admin.storage.from('order-files').list(`${folder}/${d.name}`, { limit: 1 });
          if (((entries || []) as any[]).some(f => f?.id)) { hasStorageFiles = true; break; }
        }
      } catch { /* scan unavailable — stay lenient below */ }
    }

    // Замовлення з дизайнером, у якого фото клієнта вже завантажені, а дизайнер
    // призначений, — це не «немає файлів», а «ще не зверстано». Попередження
    // писалося саме для протилежного випадку: клієнт збирав макет сам, і макет
    // дорогою загубився. Без цієї умови аудит позначав двадцять вісім
    // замовлень посеред нормальної роботи, і червона мітка переставала щось
    // означати.
    const designerInFlight = !!(ord as any)?.with_designer && !!(ord as any)?.designer_id && hasAnyRow;

    // Товар із полиці макета не потребує й потребувати не може. Фотоальбом на
    // 500 фото і картридж Instax верстати нічого, але слово «альбом» підпадає
    // під книжкове правило нижче, і аудит позначав такі замовлення весь час
    // свого існування: TM-001198, TM-001218, TM-001223, TM-001263. Ознака
    // береться з картки товару, а не з назви, бо назва тут якраз і обманює.
    const itemSlugs = items
      .map((it: any) => String(it?.slug || it?.product_slug || '').trim())
      .filter(Boolean);
    const stockSlugs = new Set<string>();
    if (itemSlugs.length) {
      const { data: prods } = await admin
        .from('products')
        .select('slug, fulfillment_type')
        .in('slug', itemSlugs);
      for (const p of (prods || []) as any[]) {
        if (p?.fulfillment_type === 'in_stock' && p?.slug) stockSlugs.add(String(p.slug));
      }
    }

    const missing: string[] = [];
    // Чи має аудит узагалі думку про це замовлення. Товар невідомого класу він
    // не позначає — і так само не має права знімати чуже попередження, бо про
    // потребу в макеті для такого товару нічого не знає.
    let sawKnownClass = false;
    if (!designerInFlight) {
      for (const it of items) {
        const slug = String(it?.slug || it?.product_slug || '').trim();
        if (slug && stockSlugs.has(slug)) continue;
        const label = `${it?.slug || ''} ${it?.name || it?.product_name || ''}`.trim();
        if (!label || RX.exclude.test(label)) continue;
        if (RX.book.test(label)) {
          sawKnownClass = true;
          if (!hasProject && !hasBookExport) missing.push(label);
        } else if (RX.self.test(label)) {
          sawKnownClass = true;
          if (!hasOtherExport) missing.push(label);
        } else if (RX.photoset.test(label)) {
          sawKnownClass = true;
          if (!hasAnyRow && !hasStorageFiles) missing.push(label);
        }
        // unknown product classes: no requirement, no false alarm
      }
    }

    if (!missing.length) {
      // Підстав більше немає — макет з'явився, або замовлення пішло в роботу до
      // дизайнера. Аудит прибирає СВІЙ рядок сам: доти попередження знімалося
      // тільки руками, і TM-001255 доїхало до відправки з міткою «нема файлів»
      // при збереженому проєкті й двадцяти експортах.
      if (alreadyFlagged && (designerInFlight || sawKnownClass)) {
        const cleaned = stripPrintWarning(notes);
        await admin.from('orders').update({ notes: cleaned || null }).eq('id', orderId);
        console.warn('[render-order] cleared a print warning that no longer holds', { orderId });
      }
      return;
    }
    if (alreadyFlagged) return; // вже позначено — другого рядка не пишемо

    // Текст будується з тієї самої константи, за якою його потім упізнають —
    // див. lib/print/print-warning. Власної фрази цей аудит більше не має:
    // рядок із спільним маркером бачать список замовлень, KeyCRM і зведення.
    const warn = printWarningLine(missing);
    await admin.from('orders')
      .update({ notes: notes.trim() ? `${warn}\n\n${notes.trim()}` : warn })
      .eq('id', orderId);
    console.warn('[render-order] flagged missing print artifacts', { orderId, missing });
  } catch (e) {
    console.error('[render-order] artifact audit failed', { orderId, e });
  }
}
/**
 * Mark an order whose design places photos we cannot find. Same short wording
 * as the artifact audit, because it lands in the CRM manager comment and has to
 * read at a glance.
 */
async function flagMissingPhotos(admin: ReturnType<typeof getAdminClient>, orderId: string, count: number) {
  try {
    const { data: ord } = await admin.from('orders').select('notes').eq('id', orderId).maybeSingle();
    const notes: string = (ord as any)?.notes || '';
    const warn = `⚠️ У макеті бракує ${count} фото — друк порожній. Не в друк, звʼяжіться з клієнтом.`;
    if (notes.includes('бракує') && notes.includes('фото')) return; // already flagged
    await admin.from('orders')
      .update({ notes: notes.trim() ? `${warn}\n\n${notes.trim()}` : warn })
      .eq('id', orderId);
  } catch (e) {
    console.error('[render-order] could not flag missing photos', { orderId, e });
  }
}

export async function POST(request: NextRequest) {
  // Internal auth — same secret the webhook uses for fiscalize / email.
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== (process.env.CRON_SECRET || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // `projectId` звужує рендер до ОДНОГО виробу.
  //
  // Замовлення може містити кілька книг (TM-001234 — пʼять тревелбуків, 114
  // сторінок разом), і рендер усіх підряд не вкладається у 300 секунд функції:
  // перші книги встигали віддати обкладинку, далі виклик уривався. Тому крім
  // «перегенерувати все» має бути «перегенерувати оцю» — і саме її дає кнопка
  // в секції виробу.
  const { orderId, projectId } = await request.json().catch(() => ({ orderId: undefined, projectId: undefined }));
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const renderUrl = process.env.RENDER_SERVICE_URL;       // https://...up.railway.app
  const renderToken = process.env.RENDER_SERVICE_TOKEN;   // shared secret with the service
  if (!renderUrl || !renderToken) {
    // Not configured yet — treat as a no-op so payment flow is unaffected.
    console.warn('[render-order] RENDER_SERVICE_URL/TOKEN not set, skipping render', { orderId });
    return NextResponse.json({ ok: false, skipped: 'service-not-configured' });
  }

  const admin = getAdminClient();

  // Find the design saved for this order. saveDesignToProjects writes order_id
  // onto the project at checkout. If a single order ever has multiple book
  // items, there can be multiple projects — render them all.
  let projectQuery = admin
    .from('projects')
    .select('id, user_id, cart_payload, name, product_type, pages_data, cover_data, overlays_data, uploaded_photos')
    .eq('order_id', orderId);
  if (projectId) projectQuery = projectQuery.eq('id', projectId);
  const { data: projects, error } = await projectQuery;

  if (error) {
    console.error('[render-order] project lookup failed', { orderId, error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!projects || projects.length === 0) {
    // No constructor project — audit whether that's legitimate (e.g. a poster
    // whose print file is an export row) or a real loss, and flag if so.
    await auditPrintArtifacts(admin, orderId);
    return NextResponse.json({ ok: true, rendered: 0, note: 'no project for order' });
  }

  // ALLOWLIST, on purpose. Only the book and calendar constructors have a
  // Railway render path (spreads / printSpec). Everything else — poster,
  // photo-print, photo-magnets, star map, and any FUTURE self-composed product
  // — builds its OWN print file client-side and uploads it as an export at
  // order time. Sending one of those to Railway screenshots the book /print
  // page with empty slots → a BLANK 00_cover.jpg, which "replace mode" below
  // then treats as the new export and DELETES the real client composite.
  //
  // A denylist would silently wreck the next new self-composed product the day
  // it ships. An allowlist fails SAFE instead: an unrecognised product_type is
  // skipped, and if it were actually a new BOOK type the design-loss safety net
  // above flags the order as "no print files" rather than replacing a good file
  // with a blank one.
  const RAILWAY_RENDERABLE = /photobook|fotoknig|travel|magazine|zhurnal|fotozhurnal|journal|planner|calendar|kalendar/i;
  // Wishbook is NOT in the allowlist above, on purpose (TM-001138). Its pages
  // are physical coloured paper (чорні/крафтові аркуші) that are never printed,
  // and its cover is server-generated by /api/orders/[id]/generate-wishbook-cover
  // (гравіювання layout + b/w variant for soft materials). Sending its project
  // to Railway produced 11 blank white spreads, and the prune below then deleted
  // the real engraved cover as "stale".
  const WISHBOOK = /wish|pobazhan|guest/i;

  const results: Array<{ projectId: string; ok: boolean; detail?: unknown }> = [];
  const allUploaded: string[] = []; // every path the render produced, across projects
  // Макети, які в ЦЬОМУ запуску дійшли до кінця. Прибирання застарілих файлів
  // обмежене саме ними: інакше книга, що впала цього разу, втрачає вчорашній
  // цілий макет (TM-001234 — двічі за два дні).
  const renderedProjectIds: string[] = [];
  for (const project of projects) {
    if (WISHBOOK.test(String(project.product_type || ''))) {
      // Make sure the generated cover exists (idempotent — skips when a
      // cover.jpg row is already registered). Fire-and-forget: the hourly
      // missing-print-files cron is the durable safety net.
      try {
        await fetch(`${request.nextUrl.origin}/api/orders/${orderId}/generate-wishbook-cover`, { method: 'POST' });
      } catch (e: any) {
        console.error('[render-order] wishbook cover trigger failed', { orderId, error: e?.message });
      }
      results.push({ projectId: project.id, ok: true, detail: 'wishbook: cover generated server-side, pages are physical paper (not rendered)' });
      continue;
    }
    if (!RAILWAY_RENDERABLE.test(String(project.product_type || ''))) {
      console.log('[render-order] skipping non-renderable (self-composed) product', { orderId, projectId: project.id, product_type: project.product_type });
      results.push({ projectId: project.id, ok: true, detail: `skipped: not railway-renderable (${project.product_type})` });
      continue;
    }
    // Pre-flight: does every PLACED photo still have a file behind it?
    //
    // The render service draws whatever the /print page shows, and a slot whose
    // photo path was lost shows nothing — the job "succeeds" and produces blank
    // white sheets (TM-001185: 22 of them, plus a cover with only the title).
    // Worse, the prune below would then delete the previous good export as
    // stale. Rebuild the lost pointers from storage first, and if any placed
    // photo is still unaccounted for, flag the order and DO NOT render it.
    let projectPhotos = Array.isArray((project as any).uploaded_photos) ? (project as any).uploaded_photos : [];
    try {
      const resolved = await resolveMissingPhotoPaths(admin, project as any);
      if (resolved.changed) {
        projectPhotos = resolved.photos;
        await admin.from('projects').update({ uploaded_photos: resolved.photos }).eq('id', project.id);
        console.warn('[render-order] recovered photo paths before render', {
          orderId, projectId: project.id, recovered: resolved.recovered,
        });
      }
    } catch (e: any) {
      console.error('[render-order] photo path recovery failed', { orderId, projectId: project.id, error: e?.message });
    }

    const unprintable = countUnprintablePhotos(project as any, projectPhotos);
    if (unprintable > 0) {
      console.error('[render-order] refusing to render a design with missing photos', {
        orderId, projectId: project.id, unprintable,
      });
      await flagMissingPhotos(admin, orderId, unprintable);
      results.push({ projectId: project.id, ok: false, detail: `skipped: ${unprintable} placed photos have no file` });
      continue;
    }

    try {
      const res = await fetch(`${renderUrl.replace(/\/$/, '')}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-render-token': renderToken,
        },
        body: JSON.stringify({ projectId: project.id }),
      });
      const detail = await res.json().catch(() => ({}));
      results.push({ projectId: project.id, ok: res.ok, detail });
      if (!res.ok) {
        console.error('[render-order] render failed', { orderId, projectId: project.id, status: res.status, detail });
        continue;
      }

      // Register the rendered JPEGs in order_files so the admin panel and the
      // designer cabinet show THESE 300-DPI layouts (file_type 'export') instead
      // of the old html2canvas snapshots. The render service uploads to the
      // photobook-uploads bucket; we record that bucket + path here (variant A:
      // keep the files where the service put them, just index them in the DB).
      const uploaded: string[] = Array.isArray(detail?.uploaded) ? detail.uploaded : [];
      // Частковий рендер. Сервіс більше не вмирає на першій невдалій сторінці,
      // а пропускає її й іде далі, тож відповідь 200 уже НЕ означає, що макет
      // зібрався весь: detail.ok каже, чи дійшов він до кінця, а detail.failed
      // перелічує, що впало. Такий набір реєструємо (файли є, виробництву вони
      // потрібні), але перерендереним не рахуємо — прибирання нижче знесло б
      // учорашній цілий макет заради сьогоднішніх пʼяти аркушів.
      const failedSpreads: Array<{ spread?: number; error?: string }> =
        Array.isArray(detail?.failed) ? detail.failed : [];
      const complete = isRenderComplete(detail);
      if (!complete) {
        console.error('[render-order] partial render — макет неповний, старі файли лишаємо', {
          orderId, projectId: project.id, uploaded: uploaded.length, failed: failedSpreads,
        });
        results[results.length - 1] = {
          projectId: project.id,
          ok: false,
          detail: { ...detail, note: `неповний макет: ${failedSpreads.length} аркушів не відрендерилось` },
        };
      }
      if (uploaded.length) {
        allUploaded.push(...uploaded);
        // Тільки тепер цей макет вважається перерендереним — і тільки його старі
        // файли можна прибирати.
        if (complete) renderedProjectIds.push(String(project.id));
        // Shared with /api/print/render-complete (the service's completion
        // callback that covers renders outliving this route's maxDuration).
        const ofErrMsg = await registerExportFiles(admin, orderId, project.product_type, uploaded);
        if (ofErrMsg) {
          // The render itself succeeded; surface the indexing problem but don't
          // fail the whole call — files exist in storage and can be re-indexed.
          // `complete` is carried through: a partial render stays not-ok even
          // when the indexing also had something to say.
          const prev = results[results.length - 1];
          results[results.length - 1] = {
            projectId: project.id,
            ok: complete,
            detail: { ...(typeof prev?.detail === 'object' && prev?.detail ? prev.detail : detail), orderFilesError: ofErrMsg },
          };
        }
      }
    } catch (e: any) {
      console.error('[render-order] render request threw', { orderId, projectId: project.id, error: e?.message });
      results.push({ projectId: project.id, ok: false, detail: e?.message });
    }
  }

  // Replace mode: once the fresh render exists, remove EVERY older export file
  // for this order that isn't part of the new set — both the client html2canvas
  // drafts (pb-…) and any previous Railway render — from storage AND the DB, so
  // the admin shows only the new spreads and no orphans pile up in storage.
  // Guarded inside by allUploaded.length so a failed render never deletes files.
  // При рендері одного виробу прибирання обмежене його ж файлами — інакше воно
  // зносить готові макети інших книг замовлення (див. коментар у pruneStaleExports).
  await pruneStaleExports(admin, orderId, allUploaded, renderedProjectIds);

  // А тепер те, чого попереднє прибирання не бачить за визначенням: файли
  // макетів, які до замовлення вже не належать. Дизайнер копіює макет клієнта у
  // свої чернетки, тобто під новим id, ставить копію на замовлення й запускає
  // рендер — і прибирання вище, обмежене макетами цього запуску, лишає весь
  // старий набір на місці. У картці кожна сторінка йшла двічі, у друк пішло б
  // удвічі більше аркушів, половина з них — стара версія. Працює незалежно від
  // того, який шлях привів сюди рендер.
  // Тільки після УСПІШНОГО рендеру. Якщо цього разу не зібралося нічого, на
  // замовленні краще лишити старий набір: він застарілий, але це принаймні
  // файли, а порожня картка не дає виробництву нічого.
  // Умова читає renderedProjectIds, а не allUploaded: відколи сервіс переживає
  // невдалу сторінку, «щось завантажилось» уже не означає «макет зібрався», і
  // частковий набір не має права нічого зносити.
  if (renderedProjectIds.length > 0) await pruneExportsOfDetachedProjects(admin, orderId);

  // A soft-cover book (велюр / шкірзамінник / тканина) with гравіювання or
  // флекс also needs the monochrome engraving макет, which Railway does not
  // produce — it photographs the design in colour. The endpoint decides for
  // itself whether this order qualifies and is idempotent, so calling it after
  // every render is safe. Runs AFTER the prune, and prune exempts cover_bw.jpg
  // by name, so the макет survives every future re-render.
  try {
    await fetch(`${request.nextUrl.origin}/api/orders/${orderId}/generate-cover-bw`, { method: 'POST' });
  } catch (e: any) {
    console.error('[render-order] cover-bw trigger failed', { orderId, error: e?.message });
  }

  // Even with projects present, individual items can still lack artifacts
  // (failed render, mixed order where the poster's export vanished, …) —
  // audit after rendering so freshly produced files count.
  await auditPrintArtifacts(admin, orderId);

  const okCount = results.filter(r => r.ok).length;
  return NextResponse.json({ ok: okCount === results.length, rendered: okCount, total: results.length, results });
}
