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

    // Chat tasks captured by Софія in the work group chats («13808
    // обов'язково 12.08 відправити»). One ORDER = one card (Diana,
    // 2026-08-11): the follow-up «Фоток не було ще» belongs on the same task
    // as the question it answers, not on a second card. The card carries the
    // whole message thread in order, and counts as closed when the LATEST
    // event on the order is a completion report — an intermediate reply
    // reopens nothing and closes nothing, it just becomes the current state.
    // Last 14 days — older chat instructions are stale by definition.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historyRows } = await supabase
        .from('order_history')
        .select('id, order_id, action, notes, details, created_at')
        .in('action', ['work_chat_note', 'work_chat_done'])
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(300);

    const orderIds = [...new Set((historyRows || []).map(r => r.order_id).filter(Boolean))];
    const orderById = new Map<string, any>();
    if (orderIds.length) {
        const { data: orders } = await supabase
            .from('orders')
            // The deadline rides along because the next step often depends on
            // it: «запитати виробництво, коли будуть фото» is a different
            // conversation three days before the deadline than three weeks.
            // custom_attributes carries the AI-suggested next action
            // (chat_task.recommendation), refreshed on every captured message.
            .select('id, order_number, customer_name, deadline, order_status, custom_attributes')
            .in('id', orderIds);
        for (const o of orders || []) orderById.set(o.id, o);
    }

    // Group into threads: by order for linked rows, one thread per row for
    // instructions whose order was never resolved.
    const threads = new Map<string, any[]>();
    for (const r of historyRows || []) {
        const key = r.order_id ? `order:${r.order_id}` : `row:${r.id}`;
        const list = threads.get(key) || [];
        list.push(r);
        threads.set(key, list);
    }

    const chatTasks = [...threads.values()].map(rows => {
        const first = rows[0];
        const last = rows[rows.length - 1];
        const order = first.order_id ? orderById.get(first.order_id) : null;

        return {
            id: first.id,
            order_id: first.order_id,
            order_number: order?.order_number || null,
            customer_name: order?.customer_name || null,
            deadline: order?.deadline || null,
            order_status: order?.order_status || null,
            recommendation: (order?.custom_attributes as any)?.chat_task?.recommendation || null,
            messages: rows.map(r => ({
                text: r.notes,
                chat: r.details?.chat || null,
                sender: r.details?.sender || null,
                at: r.created_at,
                done: r.action === 'work_chat_done',
            })),
            created_at: first.created_at,
            updated_at: last.created_at,
            done: last.action === 'work_chat_done',
        };
    })
        .filter(t => all || !t.done)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));

    return NextResponse.json({ entries: data || [], fault_options: FAULT_OPTIONS, chat_tasks: chatTasks });
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

    // Close a chat-task thread from the admin card (Diana, 2026-08-11:
    // «додай якусь кнопочку щоб можна було додати виконане»). The closing is
    // the same event a chat report would produce — a work_chat_done row — so
    // the thread shows WHO closed it and when, and reopens the moment a new
    // instruction arrives.
    if (body?.action === 'chat_task_done') {
        const orderId = String(body?.order_id || '').trim();
        if (!orderId) return NextResponse.json({ error: 'order_id is required' }, { status: 400 });

        const { error: doneError } = await supabase.from('order_history').insert({
            order_id: orderId,
            action: 'work_chat_done',
            notes: 'Виконано (позначено вручну в адмінці).',
            details: { sender: 'адмінка', chat: null },
            added_by: null,
        });
        if (doneError) return NextResponse.json({ error: doneError.message }, { status: 500 });

        // The recommendation has served its purpose along with the thread.
        const { data: order } = await supabase
            .from('orders')
            .select('id, custom_attributes')
            .eq('id', orderId)
            .maybeSingle();
        if (order && (order.custom_attributes as any)?.chat_task) {
            await supabase
                .from('orders')
                .update({ custom_attributes: { ...(order.custom_attributes as any), chat_task: null } })
                .eq('id', orderId);
        }

        return NextResponse.json({ ok: true });
    }

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
