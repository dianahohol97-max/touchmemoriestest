import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * The imported CRM base (crm_imported_customers).
 *
 * Until now nothing in the admin read this table: "Клієнти (CRM)" shows
 * `customers` (people who ordered on the site) and "Підписники" shows
 * `subscribers`. So the 5364 contacts pulled from KeyCRM existed only as a
 * number in the import screen's success message.
 *
 * Served through the service-role client for the same reason as the customer
 * list — RLS on this table opens only for admin_users, and most of the team
 * reaches the panel through a `staff` row.
 */

const PAGE_SIZE = 50;

export async function GET(req: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim();
    const source = (url.searchParams.get('source') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const from = (page - 1) * PAGE_SIZE;

    const admin = getAdminClient();

    let query = admin
        .from('crm_imported_customers')
        .select('id, email, name, phone, last_order_at, order_count, total_spend, source, imported_at', { count: 'exact' })
        .order('last_order_at', { ascending: false, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

    if (source) query = query.eq('source', source);
    if (search) {
        // Escape the PostgREST pattern metacharacters so a stray % or _ in the
        // box matches literally instead of turning into a wildcard.
        const safe = search.replace(/[%_,()\\]/g, ' ').trim();
        if (safe) query = query.or(`email.ilike.%${safe}%,name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data || [];

    // Mark who is already reachable by the manual newsletter and who opted out,
    // because that is the difference between a contact you can mail and one you
    // only hold in the archive.
    const emails = rows.map((r: any) => String(r.email || '').toLowerCase()).filter(Boolean);
    const status = new Map<string, boolean>();
    if (emails.length > 0) {
        const { data: subs } = await admin
            .from('subscribers')
            .select('email, is_active')
            .in('email', emails);
        for (const s of subs || []) {
            status.set(String((s as any).email).toLowerCase(), (s as any).is_active !== false);
        }
    }

    const contacts = rows.map((r: any) => {
        const key = String(r.email || '').toLowerCase();
        return {
            ...r,
            subscriber_state: status.has(key) ? (status.get(key) ? 'active' : 'unsubscribed') : 'none',
        };
    });

    // Totals for the header tiles, over the whole table rather than this page.
    const [{ count: total }, { count: withDate }] = await Promise.all([
        admin.from('crm_imported_customers').select('id', { count: 'exact', head: true }),
        admin.from('crm_imported_customers').select('id', { count: 'exact', head: true }).not('last_order_at', 'is', null),
    ]);

    return NextResponse.json({
        contacts,
        page,
        pageSize: PAGE_SIZE,
        matched: count ?? 0,
        total: total ?? 0,
        withOrderDate: withDate ?? 0,
    });
}
