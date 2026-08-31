import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/staff/stats — замовлення й виручка кожного співробітника за
 * поточний місяць.
 *
 * Сторінка «Управління командою» рахувала це в браузері: на кожного
 * співробітника окремий запит до orders через анонімний клієнт. Не працювало з
 * двох причин одразу. По-перше, orders закриті RLS, і без валідної сесії запит
 * тихо повертає нуль рядків замість помилки. По-друге, фільтр звертався до
 * assigned_manager_id та assigned_designer_id — таких колонок у orders немає
 * взагалі, справжні звуться manager_id і designer_id, тож навіть із сесією
 * запит падав, а catch довкола нього перетворював падіння на чесні з вигляду
 * нулі. Тому в картці стояло «0 замовлень, 0 ₴» на всю команду.
 *
 * Тут це рахується на сервері, під requireAdmin, одним запитом на весь місяць
 * замість N запитів на N людей.
 */
export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const { data: orders, error } = await admin
        .from('orders')
        .select('total, manager_id, designer_id')
        .gte('created_at', monthStart);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stats: Record<string, { ordersThisMonth: number; revenueThisMonth: number }> = {};
    const bump = (staffId: string | null, total: number) => {
        if (!staffId) return;
        const row = stats[staffId] || (stats[staffId] = { ordersThisMonth: 0, revenueThisMonth: 0 });
        row.ordersThisMonth += 1;
        row.revenueThisMonth += total;
    };

    for (const o of orders || []) {
        const total = Number((o as any).total) || 0;
        const managerId = (o as any).manager_id || null;
        const designerId = (o as any).designer_id || null;
        bump(managerId, total);
        // Замовлення, де менеджер і дизайнер — одна людина, не рахуємо двічі.
        if (designerId && designerId !== managerId) bump(designerId, total);
    }

    return NextResponse.json({ stats });
}
