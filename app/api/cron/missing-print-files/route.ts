import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { findMonoCoverItem } from '@/lib/print/cover-eligibility';
import { generateOrderPrintSheets } from '@/lib/print/generate-sheets';
import { reconcileOrderPageCount } from '@/lib/print/reconcile-page-count';
import { auditOrderPrintQuality } from '@/lib/print/audit-print-quality';

export const dynamic = 'force-dynamic';
// Sheet repair below composes JPEGs with Jimp, which needs the Node runtime and
// real time — a 48-photo polaroid order is a minute of work on its own.
export const runtime = 'nodejs';
export const maxDuration = 60;

// At most one order is re-imposed per run. The generator is the slow part, and
// a cron that times out half-way leaves a partial set of sheets on the order.
// One per run always finishes, and the next run picks up the following order.
const SHEET_REPAIRS_PER_RUN = 1;

// Так само один за прохід: перевірка якості декодує великі JPEG, і разом із
// перескладанням аркушів вона мусить уміститись у ті самі 60 секунд.
const QUALITY_AUDITS_PER_RUN = 1;
// Дивимось лише свіжі файли. Замовлення живе у вікні крона до 72 годин, і без
// цього обмеження чистий комплект перевірявся б щогодини заново. Три години
// означають, що кожен комплект перевіриться кілька разів одразу після появи —
// і що перегенерований файл теж потрапить під перевірку.
const QUALITY_FRESH_MS = 3 * 3600_000;

/**
 * GET /api/cron/missing-print-files
 *
 * Safety net for constructor orders that ended up with no print files.
 *
 * The primary guard lives in the editor + checkout (it warns the customer and
 * flags the order when the html2canvas export fails). But that path depends on
 * the customer's browser actually reaching checkout — if they close the tab,
 * lose connection mid-upload, or the flag write fails, an order can still land
 * with zero order_files and nobody notices until production.
 *
 * This cron scans recent orders that REQUIRE print files (photobook, wishbook,
 * journal, travelbook, planner, graduation) but have zero order_files rows, and
 * prepends a ⚠️ warning to the order's notes so a manager catches it on the
 * admin order page. Idempotent — never double-flags.
 *
 * Window: orders between 1h and 72h old. The 1h floor gives checkout time to
 * link files (covers the normal case); the 72h ceiling keeps the scan cheap and
 * avoids re-checking ancient orders every day.
 */

// Slugs whose orders are unprintable without a customer-built design file.
const PRINT_FILE_SLUG_PATTERNS = [
  'wish', 'pobazhan', 'guest',
  'photobook', 'fotoknig', 'velyur', 'velour', 'tkanina', 'shkir',
  'magazine', 'zhurnal', 'journal',
  'travelbook', 'travel-book',
  'planner', 'graduation',
  // Gang-printed products: rendered prints must exist in order_files or the
  // A4 sheet generator has nothing to work with (TM-001034 slipped through
  // because these were missing from this list).
  'photo-print', 'photoprint', 'fotodruk', 'polaroid', 'magnet',
];

const WARNING_MARKER = 'файли для друку не завантажились';
// Мусить бути шматком самого попередження, інакше перевірка «вже позначено» не
// спрацює й замовлення переflagується щогодини.
const QUALITY_MARKER = 'Перевірте макет:';

function itemNeedsPrintFiles(item: any): boolean {
  const slug = String(item?.slug || '').toLowerCase();
  if (!slug) return false;
  return PRINT_FILE_SLUG_PATTERNS.some(p => slug.includes(p));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  const now = Date.now();
  const floor = new Date(now - 72 * 3600_000).toISOString(); // 72h ago
  const ceiling = new Date(now - 1 * 3600_000).toISOString(); // 1h ago

  const stats = { scanned: 0, flagged: 0, alreadyFlagged: 0, ok: 0, generated: 0, errors: 0, sheetsRepaired: 0, sheetsPending: 0, pagesReconciled: 0, qualityChecked: 0, qualityFlagged: 0 };

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, order_number, items, notes')
    // Mirrored KeyCRM orders never had files uploaded here and are produced
    // from the CRM side, so flagging them would be pure noise.
    .neq('source', 'keycrm')
    .gt('created_at', floor)
    .lt('created_at', ceiling)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'query failed', detail: error.message }, { status: 500 });
  }

  for (const order of orders || []) {
    const items = Array.isArray(order.items) ? order.items : [];
    const needsFiles = items.some(itemNeedsPrintFiles);
    if (!needsFiles) continue;

    stats.scanned++;

    // Does the order line still describe the design? A spread added during
    // checkout leaves the two disagreeing, and the printer follows the design —
    // see reconcileOrderPageCount. Runs before the flagging below because it is
    // about a complete order, not a missing one.
    try {
        const fixed = await reconcileOrderPageCount(order.id);
        if (fixed) {
            stats.pagesReconciled++;
            console.log('[missing-print-files] pages reconciled', fixed);
        }
    } catch (e) {
        console.error('[missing-print-files] page reconcile failed', order.order_number, e);
    }

    // Already flagged? skip.
    if ((order.notes || '').includes(WARNING_MARKER)) {
      stats.alreadyFlagged++;
      continue;
    }

    // Does this order have any print files at all?
    const { count, error: countErr } = await admin
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id);

    if (countErr) { stats.errors++; continue; }

    if ((count ?? 0) > 0) {
      // Having files is not the same as being ready to print. A gang-printed
      // order (полароїд, нестандартний фотодрук, магніти) needs its photos
      // IMPOSED onto sheets — that is the artefact the workshop prints. Those
      // sheets were only ever requested by the customer's browser at checkout,
      // one line before it redirects to Monobank, so they almost never got
      // built: six of the seven such orders in the last 45 days had all their
      // per-photo files and not one sheet, and the designer rebuilt the sheets
      // by hand in Canva (Diana, 2026-08-18). This check makes the sheets a
      // property of the order rather than of a browser that stayed open.
      const { count: sourceCount } = await admin
        .from('order_files')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', order.id)
        .in('file_category', ['photo-print', 'polaroid-print', 'photomagnets']);

      if ((sourceCount ?? 0) > 0) {
        const { count: sheetCount } = await admin
          .from('order_files')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', order.id)
          .eq('file_category', 'print_sheet');

        if ((sheetCount ?? 0) === 0) {
          if (stats.sheetsRepaired >= SHEET_REPAIRS_PER_RUN) {
            // Counted, not silently dropped: a backlog has to be visible in the
            // response, otherwise "sheetsRepaired: 1" reads as "all done".
            stats.sheetsPending++;
          } else {
            try {
              // force: print_file_generated_at may already be stamped by another
              // part of the pipeline, and the generator treats that stamp alone
              // as "done" — without force it would skip an order that has no
              // sheets at all, which is the very case being repaired here.
              const res = await generateOrderPrintSheets(order.id, { force: true });
              if (res.ok && (res.sheets ?? 0) > 0) stats.sheetsRepaired++;
              else stats.errors++;
            } catch (e) {
              console.error('[missing-print-files] sheet generation failed', order.order_number, e);
              stats.errors++;
            }
          }
        }
      }

      // The order has its print files, but a soft-cover book with гравіювання
      // or флекс also needs the monochrome engraving макет — Railway never
      // produces one, it photographs the design in colour. Nothing else in the
      // pipeline notices it is missing, because the order does have files.
      if (findMonoCoverItem(items)) {
        const { count: bwCount } = await admin
          .from('order_files')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', order.id)
          .eq('file_name', 'cover_bw.jpg');
        if ((bwCount ?? 0) === 0) {
          try {
            const base = process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua';
            const res = await fetch(`${base}/api/orders/${order.id}/generate-cover-bw`, { method: 'POST' });
            if (res.ok) stats.generated++;
          } catch { /* next hour tries again */ }
        }
      }
      // Файли є — але чи можна їх друкувати? Розмір і порожнеча, більше нічого.
      // Саме цього бракувало, коли друкарня відхилила TM-001233 за 400×300
      // замість 420×305, а обкладинка TM-001232 приїхала бежевим прямокутником:
      // обидва файли існували й були правильно названі.
      if (
        stats.qualityChecked < QUALITY_AUDITS_PER_RUN
        && !(order.notes || '').includes(QUALITY_MARKER)
      ) {
        try {
          const { data: newest } = await admin
            .from('order_files')
            .select('created_at')
            .eq('order_id', order.id)
            .eq('file_type', 'export')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const freshEnough = newest?.created_at
            && (now - new Date(newest.created_at).getTime()) < QUALITY_FRESH_MS;
          if (freshEnough) {
            const report = await auditOrderPrintQuality(order.id);
            if (report.checked > 0) stats.qualityChecked++;
            if (report.problems.length) {
              const warn = `⚠️ Перевірте макет: ${report.problems.join('; ')}. Не в друк, поки не перегенеруєте.`;
              const { data: cur } = await admin.from('orders').select('notes').eq('id', order.id).maybeSingle();
              const prev = (cur?.notes || '').trim();
              await admin.from('orders')
                .update({ notes: prev ? `${warn}\n${prev}` : warn })
                .eq('id', order.id);
              stats.qualityFlagged++;
              console.warn('[missing-print-files] print quality problem', order.order_number, report.problems);
            }
          }
        } catch (e) {
          console.error('[missing-print-files] quality audit failed', order.order_number, e);
        }
      }

      stats.ok++;
      continue;
    }

    // The customer's design often lives in the linked constructor `projects`
    // row, NOT in order_files — the print files are only rendered on payment.
    // So an order with 0 order_files can still have a complete design (e.g. it
    // is simply unpaid). Do NOT tell staff "макет відсутній, попросіть клієнта
    // оформити ще раз" when a real design with photos is sitting right there.
    const { data: designProjs } = await admin
      .from('projects')
      .select('id, uploaded_photos')
      .eq('order_id', order.id)
      .limit(1);
    const hasDesign = (designProjs || []).some(
      (p: any) => Array.isArray(p?.uploaded_photos) && p.uploaded_photos.length > 0,
    );
    if (hasDesign) { stats.ok++; continue; }

    // Zero files on an order that needs them. For a wishbook we can generate
    // the cover server-side from the order options — try that FIRST and only
    // flag if it fails. For other products (photobooks etc.) we can't
    // regenerate without the customer's photos, so we flag for manual follow-up.
    const isWishbook = items.some((it: any) => {
      const s = `${it?.slug || ''} ${it?.product_type || ''} ${it?.product_name || it?.name || ''}`.toLowerCase();
      return s.includes('wish') || s.includes('pobazhan') || s.includes('guest') || s.includes('побажан');
    });
    if (isWishbook) {
      try {
        const base = process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua';
        const res = await fetch(`${base}/api/orders/${order.id}/generate-wishbook-cover`, { method: 'POST' });
        if (res.ok) { stats.generated++; continue; }
      } catch { /* fall through to flagging */ }
    }

    // Zero files on an order that needs them → flag it.
    const warning =
      `⚠️ УВАГА: ${WARNING_MARKER} — макет з конструктора відсутній. ` +
      `Зв'яжіться з клієнтом і попросіть оформити дизайн ще раз або надіслати фото перед друком. ` +
      `(виявлено автоматичною перевіркою)`;
    const existing = (order.notes || '').trim();
    const newNotes = existing ? `${warning}\n\n${existing}` : warning;

    const { error: updErr } = await admin
      .from('orders')
      .update({ notes: newNotes })
      .eq('id', order.id);

    if (updErr) { stats.errors++; continue; }
    stats.flagged++;
  }

  // ─── Second watchdog: paid designer orders nobody picked up ─────────────
  // TM-001037/1040 sat unassigned for a week with the 14–18 day promise
  // ticking. Flag any PAID with_designer order that has no designer after
  // 24h — same notes-warning pattern, idempotent via marker.
  const DESIGNER_MARKER = '[дизайнер не призначений]';
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: unassigned } = await admin
    .from('orders')
    .select('id, order_number, notes')
    .eq('payment_status', 'paid')
    .eq('with_designer', true)
    .is('designer_id', null)
    .lt('created_at', dayAgo)
    .limit(50);
  for (const o of unassigned || []) {
    if ((o.notes || '').includes(DESIGNER_MARKER)) continue;
    const w = `⚠️ УВАГА: ${DESIGNER_MARKER} — оплачене замовлення з дизайнером понад 24 год без виконавця. Призначте дизайнера (Кабінет дизайнера → взяти в роботу). (виявлено автоматичною перевіркою)`;
    const prev = (o.notes || '').trim();
    const { error: e2 } = await admin.from('orders').update({ notes: prev ? `${w}\n\n${prev}` : w }).eq('id', o.id);
    if (!e2) (stats as any).designerFlagged = ((stats as any).designerFlagged || 0) + 1;
  }

  return NextResponse.json({ success: true, ...stats });
}
