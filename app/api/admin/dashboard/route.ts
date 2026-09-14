import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { countedRevenue, outstandingAmount } from '@/lib/orders/payment-state';
import { fetchAllRows } from '@/lib/supabase/paginate';

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
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getAdminClient();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Усі замовлення, сторінками.
    //
    // Без .range() PostgREST віддає рівно тисячу рядків і не каже про це
    // жодним словом. На 14.09.2026 замовлень 1107, тобто сто сім із них
    // дашборд просто не бачив: і в лічильнику «очікують оплати», і в сумі, і
    // в «у роботі». Помилка тиха і росте сама.
    const allOrders = await fetchAllRows<any>((from, to) => supabase
      .from('orders')
      .select('id,order_status,payment_status,total,paid_amount,with_designer,created_at')
      .order('created_at', { ascending: false })
      .range(from, to), { label: 'замовлення дашборда' });

    // Черга активних замовлень — свідомо перші двадцять, це екран, а не звіт.
    const queueRes = await supabase
      .from('orders')
      .select('id,order_number,customer_name,order_status,payment_status,total,source,created_at,with_designer,items,order_tag_assignments(order_tags(id,name,color,icon))')
      .not('order_status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(20);

    // Нові клієнти за тиждень, сторінками.
    //
    // Сьогодні їх 111 при межі PostgREST у 1000 (заміряно 14.09.2026), тобто
    // запас великий. Пагінація тут не через нинішнє число, а через правило:
    // `customers` росте від роботи магазину, і тиждень із тисячею реєстрацій
    // не потребує жодної зміни в коді, щоб настати.
    const newClients = await fetchAllRows<{ id: string }>((from, to) => supabase
        .from('customers')
        .select('id')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .range(from, to), { label: 'нові клієнти' });

    const orders = allOrders;
    const todayOrders = orders.filter(o => o.created_at >= todayIso);

    const stats = {
      today: todayOrders.length,
      // Гроші, що НАДІЙШЛИ, а не сума виставлених рахунків. Різниця не
      // косметична: за тридцять днів до 14.09.2026 сума замовлень 935 370 ₴,
      // а надійшло 744 136 ₴. Скасовані дають нуль — вони не дохід.
      todayRevenue: todayOrders.reduce((s, o) => s + countedRevenue(o), 0),
      awaitingPayment: orders.filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled').length,
      // Залишок, а не повна сума замовлення. На замовленні з передоплатою
      // половина вже в касі, і чекати треба другу половину. Через це плашка
      // показувала 607 739 ₴ там, де насправді чекають 328 567 ₴.
      awaitingPaymentSum: orders
        .filter(o => o.payment_status === 'pending' && o.order_status !== 'cancelled')
        .reduce((s, o) => s + outstandingAmount(o), 0),
      inProgress: orders.filter(o => ['new', 'pending', 'in_progress'].includes(o.order_status)).length,
      needDesigner: orders.filter(o => o.with_designer && !['completed', 'cancelled'].includes(o.order_status)).length,
      newClients: newClients.length,
    };

    return NextResponse.json({ stats, queue: queueRes.data || [] });
  } catch (err: any) {
    console.error('[Dashboard API] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
