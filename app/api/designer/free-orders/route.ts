import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';
import { fetchAllRows } from '@/lib/supabase/paginate';

export async function GET() {
    // Auth: only authenticated staff (any role) should see the free-order
    // queue. Previously this endpoint was wide-open and used anon-fallback
    // service role, leaking customer_name + order details for every
    // designer-service order to anyone.
    const cookieClient = await createClient();
    const { data: { user } } = await cookieClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdminClient();

    // Allow admin or any staff member.
    let allowed = false;
    if (user.email) {
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('id')
            .ilike('email', likeEscape(user.email))
            .maybeSingle();
        if (adminRow) allowed = true;
    }

    if (!allowed && user.email) {
        const { data: staffRow } = await admin
            .from('staff')
            .select('id')
            .ilike('email', likeEscape(user.email))
            .maybeSingle();
        if (staffRow) allowed = true;
    }

    if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Сторінками. Вільних замовлень сьогодні 102 при межі PostgREST у тисячу
    // (заміряно 15.09.2026). Список наповнюється сам, від замовлень із
    // дизайнером, тож дивитися на сьогоднішнє число марно — гоча 14.
    try {
        const data = await fetchAllRows<any>((from, to) => admin
            .from('orders')
            .select('id, order_number, customer_name, items, order_status, created_at, designer_note')
            .eq('with_designer', true)
            .is('designer_id', null)
            .order('created_at', { ascending: false })
            .range(from, to), { label: 'вільні замовлення для дизайнера' });
        return NextResponse.json({ orders: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
