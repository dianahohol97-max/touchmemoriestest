import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
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
            // Strip PostgREST filter metacharacters so the search term can't
            // inject extra `.or()` terms (staff-gated, but cheap to close).
            const s = search.replace(/[,()*]/g, ' ').trim();
            // Email and ТТН are here because the list page's own filter matches
            // on them too — a search that finds a row in one place and not the
            // other is worse than no search at all.
            if (s) query = query.or(
                `order_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,`
                + `customer_email.ilike.%${s}%,ttn.ilike.%${s}%`,
            );
        }

        // Date window, so filtering by an old range reaches past the newest
        // `limit` rows instead of searching an already-truncated page.
        if (from) query = query.gte('created_at', `${from}T00:00:00`);
        if (to) query = query.lte('created_at', `${to}T23:59:59.999`);

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
