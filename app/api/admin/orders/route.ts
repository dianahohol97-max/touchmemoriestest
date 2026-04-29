import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '200');

        let query = supabase
            .from('orders')
            .select(`
                *,
                customers(id, name, phone, email),
                manager:staff!orders_manager_id_fkey(id, name, initials, color),
                designer:staff!orders_designer_id_fkey(id, name, initials, color),
                order_tag_assignments(order_tags(*))
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status && status !== 'all') {
            query = query.eq('order_status', status);
        }

        if (search) {
            query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Orders API] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ orders: data || [] });
    } catch (err: any) {
        console.error('[Orders API] Exception:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
// audit Wed Apr  1 11:08:21 UTC 2026
