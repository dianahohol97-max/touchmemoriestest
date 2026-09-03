import { NextResponse } from 'next/server';
import { requireAnySection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

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
    const { data, error } = await admin
        .from('orders')
        .select(`
            *,
            manager:staff!orders_manager_id_fkey(id, name, initials, color),
            designer:staff!orders_designer_id_fkey(id, name, initials, color),
            order_tag_assignments(order_tags(*))
        `)
        .in('order_status', PRODUCTION_STATUSES as unknown as string[])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[production] read failed', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ orders: data || [] });
}
