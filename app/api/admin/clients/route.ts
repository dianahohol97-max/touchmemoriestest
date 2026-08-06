import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Customer list for /admin/clients.
 *
 * Two reasons this has to live on the server rather than in the page:
 *
 * 1. RLS. The `customers` policies grant a full read only to is_admin() /
 *    is_admin_user(), and BOTH resolve membership against `admin_users` alone.
 *    Everyone who reaches the admin panel through a `staff` row instead —
 *    which is most of the team, owners included — fell back to the
 *    "auth.uid() = auth_user_id" branch and saw exactly one customer: their
 *    own. The page looked empty rather than forbidden, so it read as data loss.
 *
 * 2. customers.total_orders and customers.total_spent are dead columns. Nothing
 *    in the codebase has ever written to them, so all 664 rows sit at 0 while
 *    real orders exist. Sorting and the VIP / average-cheque tiles were built
 *    on those zeros. The figures are computed from `orders` here instead.
 *
 * Orders are matched by customer_id when the order carries one and by email
 * otherwise, because guest checkout leaves customer_id null on roughly half of
 * them and those purchases still belong to the person in the CRM.
 */

const ORDER_PAGE = 1000;

export async function GET(req: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();

    // Drawer mode: the orders of one customer. Same RLS problem as the list —
    // `orders` opens up only for admin_users or for the designer assigned to
    // the order, so reading this from the page returned an empty history.
    const customerId = new URL(req.url).searchParams.get('customerId');
    if (customerId) {
        const { data: customer } = await admin
            .from('customers')
            .select('id, email')
            .eq('id', customerId)
            .maybeSingle();
        if (!customer) return NextResponse.json({ error: 'Клієнта не знайдено' }, { status: 404 });

        // Two plain queries instead of .or(): a PostgREST `or` filter is built
        // by string concatenation, and an email is user-supplied data that may
        // carry characters the filter grammar treats as syntax.
        const email = String((customer as any).email || '').toLowerCase();
        const [byId, byEmail] = await Promise.all([
            admin.from('orders').select('*').eq('customer_id', customerId),
            email
                ? admin.from('orders').select('*').ilike('customer_email', email)
                : Promise.resolve({ data: [] as any[], error: null }),
        ]);
        if (byId.error) return NextResponse.json({ error: byId.error.message }, { status: 500 });
        if ((byEmail as any).error) return NextResponse.json({ error: (byEmail as any).error.message }, { status: 500 });

        const seen = new Set<string>();
        const merged = [...(byId.data || []), ...((byEmail as any).data || [])]
            .filter(o => (seen.has(String(o.id)) ? false : (seen.add(String(o.id)), true)))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

        return NextResponse.json({ orders: merged });
    }

    const { data: customers, error: custErr } = await admin
        .from('customers')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (custErr) {
        return NextResponse.json({ error: custErr.message }, { status: 500 });
    }

    // Pull orders in pages so the route keeps working as the table grows.
    const orders: any[] = [];
    for (let from = 0; ; from += ORDER_PAGE) {
        const { data, error } = await admin
            .from('orders')
            .select('customer_id, customer_email, total, payment_status, created_at')
            .order('created_at', { ascending: false })
            .range(from, from + ORDER_PAGE - 1);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        orders.push(...(data || []));
        if (!data || data.length < ORDER_PAGE) break;
    }

    type Stats = { total_orders: number; total_spent: number; last_order_date: string | null };
    const byId = new Map<string, Stats>();
    const byEmail = new Map<string, Stats>();

    const bump = (bucket: Map<string, Stats>, key: string, order: any) => {
        const s = bucket.get(key) || { total_orders: 0, total_spent: 0, last_order_date: null };
        s.total_orders += 1;
        // Only paid money counts as spend; pending and cancelled orders would
        // otherwise inflate the VIP threshold and the average cheque.
        if (order.payment_status === 'paid') s.total_spent += Number(order.total) || 0;
        if (order.created_at && (!s.last_order_date || order.created_at > s.last_order_date)) {
            s.last_order_date = order.created_at;
        }
        bucket.set(key, s);
    };

    for (const o of orders) {
        if (o.customer_id) bump(byId, String(o.customer_id), o);
        else if (o.customer_email) bump(byEmail, String(o.customer_email).toLowerCase(), o);
    }

    const merge = (a: Stats | undefined, b: Stats | undefined): Stats => ({
        total_orders: (a?.total_orders || 0) + (b?.total_orders || 0),
        total_spent: (a?.total_spent || 0) + (b?.total_spent || 0),
        last_order_date: [a?.last_order_date, b?.last_order_date].filter(Boolean).sort().pop() || null,
    });

    const rows = (customers || []).map((c: any) => {
        const stats = merge(byId.get(String(c.id)), byEmail.get(String(c.email || '').toLowerCase()));
        return { ...c, ...stats };
    });

    rows.sort((a: any, b: any) => (b.total_spent - a.total_spent) || (b.total_orders - a.total_orders));

    return NextResponse.json({ customers: rows, count: rows.length });
}
