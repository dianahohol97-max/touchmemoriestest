import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

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
    const { data: adminRow } = await admin
        .from('admin_users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
    if (adminRow) allowed = true;

    if (!allowed && user.email) {
        const { data: staffRow } = await admin
            .from('staff')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
        if (staffRow) allowed = true;
    }

    if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await admin
        .from('orders')
        .select('id, order_number, customer_name, items, order_status, created_at, designer_note')
        .eq('with_designer', true)
        .is('designer_id', null)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: data || [] });
}
