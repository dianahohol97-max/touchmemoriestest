import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { REPRINT_STATUSES, OPEN_STATUSES, FAULT_OPTIONS, type ReprintStatus } from '@/lib/automation/reprints';

export const dynamic = 'force-dynamic';

/**
 * The defect / reprint queue, for the admin panel.
 *
 * GET   — the queue. `?all=1` includes closed entries; default is open only,
 *         because the queue is a to-do list, not an archive.
 * POST  — open an entry by hand. An order number links it to the order when one
 *         matches, but a defect can be recorded before any order is found.
 * PATCH — move an entry through its lifecycle or edit its facts. Closing
 *         stamps resolved_at once and never re-stamps it.
 */

export async function GET(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const all = new URL(request.url).searchParams.get('all') === '1';

    let query = supabase
        .from('reprint_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

    if (!all) query = query.in('status', OPEN_STATUSES);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ entries: data || [], fault_options: FAULT_OPTIONS });
}

export async function POST(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const orderNumber = String(body?.order_number || '').trim();

    // Link to the real order when the number resolves — the queue card then
    // opens the order with one click — but never require it: a defect reported
    // by photo in direct messages is real before anyone finds its order.
    let order: any = null;
    if (orderNumber) {
        const { data } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, items')
            .eq('order_number', orderNumber)
            .maybeSingle();
        order = data;
    }

    const { data: created, error } = await supabase
        .from('reprint_queue')
        .insert({
            order_id: order?.id || null,
            order_number: order?.order_number || orderNumber || null,
            customer_name: order?.customer_name || String(body?.customer_name || '').trim() || null,
            source: 'manual',
            items_summary: order && Array.isArray(order.items)
                ? order.items.map((i: any) => i?.product_name).filter(Boolean).slice(0, 3).join(', ')
                : String(body?.items_summary || '').trim() || null,
            reason: String(body?.reason || '').trim() || null,
            fault: String(body?.fault || '').trim() || null,
            notes: String(body?.notes || '').trim() || null,
            status: 'new',
            created_by: 'admin',
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, entry: created, order_linked: Boolean(order) });
}

export async function PATCH(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body?.status !== undefined) {
        const status = String(body.status) as ReprintStatus;
        if (!REPRINT_STATUSES.includes(status)) {
            return NextResponse.json(
                { error: `Статус «${status}» не існує. Доступні: ${REPRINT_STATUSES.join(', ')}` },
                { status: 400 },
            );
        }
        patch.status = status;
    }

    for (const field of ['reason', 'fault', 'notes'] as const) {
        if (body?.[field] !== undefined) patch[field] = String(body[field]).trim() || null;
    }

    if (body?.reprint_cost !== undefined) {
        const cost = Number(body.reprint_cost);
        patch.reprint_cost = Number.isFinite(cost) && cost >= 0 ? cost : null;
    }

    const supabase = getAdminClient();

    // Closing stamps resolved_at exactly once: reopening and re-closing keeps
    // the FIRST resolution date, since that is when the customer's problem was
    // actually dealt with.
    if (patch.status && !OPEN_STATUSES.includes(patch.status)) {
        const { data: current } = await supabase
            .from('reprint_queue')
            .select('resolved_at')
            .eq('id', id)
            .maybeSingle();

        if (current && !current.resolved_at) patch.resolved_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
        .from('reprint_queue')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, entry: updated });
}
