import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveOrderDeadline } from '@/lib/automation/deadline-resolver';

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

    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, order_status, payment_status, source, deadline, paid_at, created_at, notes, client_comment, custom_attributes, items, total, designer_id, with_designer')
        .gte('created_at', readFrom.toISOString())
        .not('order_status', 'in', '("cancelled","refunded","delivered")')
        .order('deadline', { ascending: true })
        .limit(500);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const activeCount = (data || []).filter(o =>
        ['confirmed', 'in_production', 'quality_check'].includes(o.order_status || '')
    ).length;

    const days: Record<string, any[]> = {};
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        days[dayKey(d)] = [];
    }

    const overdue: any[] = [];
    let unplaced = 0;

    for (const order of data || []) {
        const resolved = resolveOrderDeadline(order, { activeOrdersCount: activeCount, now });
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
            items_summary: Array.isArray(order.items)
                ? order.items.map((i: any) => i?.product_name).filter(Boolean).slice(0, 3).join(', ')
                : '',
            needs_designer: Boolean(order.with_designer && !order.designer_id),
            stored_deadline: Boolean(order.deadline),
        };

        if (deadline < weekStart) {
            // Only the current week carries the overdue rail. On a future week
            // everything earlier than it is simply another week's work, and
            // listing it as overdue would brand this week's healthy queue as
            // late the moment somebody clicked forward.
            if (weekOffset === 0) overdue.push(card);
            else unplaced++;
            continue;
        }

        const key = dayKey(deadline);
        if (days[key]) days[key].push(card);
        else unplaced++;
    }

    return NextResponse.json({
        week_start: dayKey(weekStart),
        week_offset: weekOffset,
        days,
        overdue,
        beyond_this_week: unplaced,
    });
}
