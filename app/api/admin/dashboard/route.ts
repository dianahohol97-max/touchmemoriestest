import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard
 *
 * Dashboard stats + active-order queue. Previously AdminDashboard.tsx queried
 * the orders/customers tables directly with the anon (cookie-bound) client,
 * relying on the orders RLS is_admin() policy. That was fragile: if the
 * session cookie wasn't attached yet (race on first paint) or the JWT email
 * claim was momentarily unavailable, is_admin() returned false and every
 * count silently came back 0 — the admin saw an empty store even though 18
 * orders existed. Routing through requireAdmin() + service role removes the
 * RLS dependency and makes the numbers deterministic.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getAdminClient();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [ordersRes, queueRes, clientsRes] = await Promise.all([
      supabase.from('orders').select('id,order_status,payment_status,total,with_designer,created_at'),
      supabase.from('orders')
        .select('id,order_number,customer_name,order_status,payment_status,total,source,created_at,with_designer,items')
        .not('order_status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('customers').select('id').gte('created_at', weekAgo),
    ]);

    if (ordersRes.error) {
      console.error('[Dashboard API] orders error:', ordersRes.error);
      return NextResponse.json({ error: ordersRes.error.message }, { status: 500 });
    }

    const orders = ordersRes.data || [];
    const todayOrders = orders.filter(o => o.created_at >= todayIso);

    const stats = {
      today: todayOrders.length,
      todayRevenue: todayOrders.reduce((s, o) => s + Number(o.total || 0), 0),
      awaitingPayment: orders.filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled').length,
      awaitingPaymentSum: orders.filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0), 0),
      inProgress: orders.filter(o => ['new', 'pending', 'in_progress'].includes(o.order_status)).length,
      needDesigner: orders.filter(o => o.with_designer && !['completed', 'cancelled'].includes(o.order_status)).length,
      newClients: (clientsRes.data || []).length,
    };

    return NextResponse.json({ stats, queue: queueRes.data || [] });
  } catch (err: any) {
    console.error('[Dashboard API] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
