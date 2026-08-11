import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveOrderDeadline } from '@/lib/automation/deadline-resolver';
import { fetchProductTermsBySlug } from '@/lib/automation/product-terms';
import { isTestOrder } from '@/lib/automation/test-orders';

export const dynamic = 'force-dynamic';

/**
 * Orders on the production calendar for one week.
 *
 * Grouped by the day they must be FINISHED, not by the day the customer expects
 * them: those differ by the time the parcel spends travelling, and it is the
 * finish date the workshop plans around.
 *
 * Orders from both intakes appear. An Instagram order mirrored in from KeyCRM
 * occupies the same day and the same hands as a website order, and a calendar
 * that hides half the load is worse than no calendar — the gaps read as free
 * capacity.
 *
 * A missing deadline is resolved on the fly rather than shown as a blank. The
 * calendar is a planning surface: an order with no date must still appear
 * somewhere, or it gets planned around as though it did not exist.
 */

function startOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Monday-based: the workshop week starts on Monday, and a Sunday-first grid
    // splits the working week across two screens.
    const shift = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - shift);
    return d;
}

function dayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export async function GET(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const weekOffset = Number(url.searchParams.get('week') || 0) || 0;

    const now = new Date();
    const weekStart = startOfWeek(now);
    weekStart.setDate(weekStart.getDate() + weekOffset * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const supabase = getAdminClient();

    // Read wider than the week: an order whose deadline has already passed but
    // which is still unfinished belongs on this week's board, not in the past
    // where nobody looks.
    const readFrom = new Date(weekStart);
    readFrom.setDate(readFrom.getDate() - 60);

    // 'shipped' is excluded along with the closed states: a shipped order has
    // nothing left to produce, and a board full of parcels already on their way
    // buries the work that is actually pending.
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, order_status, payment_status, source, deadline, paid_at, created_at, notes, client_comment, custom_attributes, items, total, designer_id, with_designer')
        .gte('created_at', readFrom.toISOString())
        .not('order_status', 'in', '("cancelled","refunded","delivered","shipped","completed")')
        .order('deadline', { ascending: true })
        .limit(500);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // The handover line (Diana, 2026-08-11). Site orders placed BEFORE the
    // automation cutoff were carried into the CRM by hand and their production
    // is tracked there — putting them on this board would double every one of
    // them as "work" and flood the overdue rail with orders that are actually
    // mid-production in the CRM. So the board shows: every mirrored CRM order
    // (that is where the current queue lives), and site orders only from the
    // cutoff onwards — the ones the automation owns. As the old orders ship,
    // the board becomes the complete picture by itself.
    const cutoffRaw = String(process.env.KEYCRM_SYNC_FROM || '').trim();
    const cutoff = cutoffRaw ? new Date(cutoffRaw).getTime() : NaN;

    const visible = (data || []).filter(o => {
        // Test orders («Киця Кицюня») are not production work.
        if (isTestOrder(o)) return false;
        if (o.source === 'keycrm') return true;
        if (!Number.isFinite(cutoff)) return true;
        return new Date(o.created_at).getTime() >= cutoff;
    });

    const activeCount = visible.filter(o =>
        ['confirmed', 'in_production', 'quality_check'].includes(o.order_status || '')
    ).length;

    const productTermsBySlug = await fetchProductTermsBySlug();

    const days: Record<string, any[]> = {};
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        days[dayKey(d)] = [];
    }

    const overdue: any[] = [];
    // Orders whose customer-named date is closing in (Diana, 2026-08-11): a
    // ship-by date from the comments less than four days out gets lifted to its
    // own rail at the top, because inside a day column it reads as just another
    // card until the day it is already late.
    const shipSoon: any[] = [];
    const SHIP_SOON_DAYS = 4;
    let unplaced = 0;

    // Overdue means "earlier than TODAY", not "earlier than Monday": on a
    // Wednesday, Monday's unfinished orders are late even though their day
    // column is still on screen. Only the current week carries the rail —
    // on a future week everything earlier is simply another week's work.
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    for (const order of visible) {
        const resolved = resolveOrderDeadline(order, { activeOrdersCount: activeCount, now, productTermsBySlug });
        const deadline = order.deadline ? new Date(order.deadline) : resolved.deadline;

        const card = {
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name,
            source: order.source,
            order_status: order.order_status,
            payment_status: order.payment_status,
            total: order.total,
            deadline: deadline.toISOString(),
            // Why this date, in the customer's own words where there are any.
            reason: order.deadline ? resolved.reason : 'standard',
            evidence: resolved.evidence,
            requested_date: resolved.requestedDate ? resolved.requestedDate.toISOString() : null,
            // The stage as a human names it: the CRM's own label when the order
            // lives there too, otherwise the site's status. Refreshed by the
            // half-hourly reconcile and the hourly mirror respectively.
            crm_status: (order.custom_attributes as any)?.keycrm?.status_label || null,
            items_summary: Array.isArray(order.items)
                ? order.items.map((i: any) => i?.product_name).filter(Boolean).slice(0, 3).join(', ')
                : '',
            needs_designer: Boolean(order.with_designer && !order.designer_id),
            stored_deadline: Boolean(order.deadline),
        };

        // The customer's date measured in whole days from today, so a date that
        // is literally today counts as zero days left, not as already negative
        // by breakfast time.
        let onOverdueRail = false;
        if (card.requested_date) {
            const daysLeft = (new Date(card.requested_date).getTime() - startOfToday.getTime()) / (24 * 3600 * 1000);
            if (daysLeft >= 0 && daysLeft < SHIP_SOON_DAYS) shipSoon.push(card);

            // A client date already behind us is the loudest case of all (Diana,
            // 2026-08-12): the promise to the customer is missed, even though
            // the production deadline was rescued forward to the nearest
            // achievable day. Without this the order sat quietly in its day
            // column while a date merely APPROACHING got its own rail.
            if (daysLeft < 0 && weekOffset === 0) {
                (card as any).client_date_passed = true;
                overdue.push(card);
                onOverdueRail = true;
            }
        }

        const overdueCutoff = weekOffset === 0 ? startOfToday : weekStart;

        if (deadline < overdueCutoff) {
            if (weekOffset === 0) {
                if (!onOverdueRail) overdue.push(card);
            } else unplaced++;
            continue;
        }

        if (deadline < weekStart) {
            unplaced++;
            continue;
        }

        const key = dayKey(deadline);
        if (days[key]) days[key].push(card);
        else unplaced++;
    }

    // Inside a day, urgent work floats above standard so the top of each column
    // is what must not slip.
    for (const key of Object.keys(days)) {
        days[key].sort((a, b) =>
            (a.reason === 'standard' ? 1 : 0) - (b.reason === 'standard' ? 1 : 0)
            || a.deadline.localeCompare(b.deadline));
    }

    return NextResponse.json({
        week_start: dayKey(weekStart),
        week_offset: weekOffset,
        days,
        overdue,
        ship_soon: shipSoon,
        beyond_this_week: unplaced,
    });
}
