import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

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

  const stats = { scanned: 0, flagged: 0, alreadyFlagged: 0, ok: 0, generated: 0, errors: 0 };

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, order_number, items, notes')
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
      stats.ok++;
      continue;
    }

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
