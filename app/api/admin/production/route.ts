import { NextResponse } from 'next/server';
import { requireAnySection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

/** Колонки дошки виробництва. Порядок той самий, що в UI. */
export const PRODUCTION_STATUSES = ['confirmed', 'in_production', 'shipped', 'delivered'] as const;

/**
 * GET /api/admin/production — замовлення для дошки виробництва.
 *
 * Дошка читала orders прямо з браузера. Політики на orders пускають
 * admin_users або дизайнера, якому це замовлення вже призначене, тож для
 * менеджера, виробництва й більшості дизайнерів дошка була просто порожня —
 * чотири колонки без жодної картки, і жодного пояснення, бо RLS повертає нуль
 * рядків, а не помилку.
 */
export async function GET() {
    const guard = await requireAnySection([['production', 'view'], ['orders', 'view']]);
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();

    // Сторінками, і це вже не запобіжник, а лікування. Учора під фільтр
    // статусів підпадало 518 замовлень, сьогодні 15.09.2026 їх 1 066 — межу
    // PostgREST у тисячу черга перейшла за добу, і 66 найстаріших рядків
    // сторінка виробництва вже не показувала. Помилки не було, просто приїхало
    // менше, і побачити це можна було лише звіркою з базою.
    try {
        const data = await fetchAllRows<any>((from, to) => admin
            .from('orders')
            .select(`
                *,
                manager:staff!orders_manager_id_fkey(id, name, initials, color),
                designer:staff!orders_designer_id_fkey(id, name, initials, color),
                order_tag_assignments(order_tags(*))
            `)
            .in('order_status', PRODUCTION_STATUSES as unknown as string[])
            .order('created_at', { ascending: false })
            .range(from, to), { label: 'виробництво' });
        return NextResponse.json({ orders: data });
    } catch (e: any) {
        console.error('[production] read failed', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
