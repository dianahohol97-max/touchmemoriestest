import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Bulk-import legacy-CRM customers (email, name, phone, last order date, order
// count, total spend) so the win-back automation can target real lapsed
// buyers. Rows are parsed client-side from CSV; this route validates the admin
// session and upserts via the crm_import_upsert() SQL function (dedup + keep
// the latest date per email).
export async function POST(req: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const cookieClient = await createClient();
    const { data: { user } } = await cookieClient.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getAdminClient();
    const { data: adminRow } = await admin
        .from('admin_users')
        .select('id')
        .eq('email', user.email.toLowerCase())
        .maybeSingle();
    if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
    const source: string = typeof body?.source === 'string' && body.source.trim() ? body.source.trim() : 'keycrm';
    const addToSubscribers: boolean = body?.addToSubscribers === true;
    if (rows.length === 0) return NextResponse.json({ error: 'No rows' }, { status: 400 });
    if (rows.length > 100000) return NextResponse.json({ error: 'Too many rows (max 100000)' }, { status: 400 });

    // Upsert in chunks so a huge file doesn't build one giant jsonb payload.
    const CHUNK = 2000;
    let imported = 0;
    try {
        for (let i = 0; i < rows.length; i += CHUNK) {
            const slice = rows.slice(i, i + CHUNK);
            const { data, error } = await admin.rpc('crm_import_upsert', { p_rows: slice, p_source: source });
            if (error) throw error;
            imported += Number(data) || 0;
        }
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Import failed', imported }, { status: 500 });
    }

    // Optionally mirror the contacts into `subscribers`, because that is the
    // only table the manual newsletter (/api/admin/send-newsletter) reads —
    // crm_imported_customers alone feeds the automatic win-back and nothing
    // else, so without this step an imported base can never be mailed by hand.
    // Opt-in on purpose: it puts real people on a marketing list.
    let subscribersAdded = 0;
    if (addToSubscribers) {
        // Deduplicate inside the payload first; subscribers.email is UNIQUE on
        // the raw value, so everything is lower-cased before it goes in.
        const seen = new Set<string>();
        const subRows: { email: string; name: string | null; source: string; is_active: boolean }[] = [];
        for (const r of rows) {
            const email = String(r?.email || '').trim().toLowerCase();
            if (!email || !/.+@.+\..+/.test(email) || seen.has(email)) continue;
            seen.add(email);
            subRows.push({ email, name: String(r?.name || '').trim() || null, source, is_active: true });
        }

        try {
            const SUB_CHUNK = 500;
            for (let i = 0; i < subRows.length; i += SUB_CHUNK) {
                // ignoreDuplicates → ON CONFLICT DO NOTHING. Existing rows are
                // left completely untouched, so anyone who already pressed
                // "Відписатися" (is_active = false) is never resurrected.
                const { data, error } = await admin
                    .from('subscribers')
                    .upsert(subRows.slice(i, i + SUB_CHUNK), { onConflict: 'email', ignoreDuplicates: true })
                    .select('email');
                if (error) throw error;
                subscribersAdded += data?.length || 0;
            }
        } catch (e: any) {
            // The CRM import itself already succeeded — report the partial state
            // instead of pretending the whole request failed.
            return NextResponse.json(
                { imported, received: rows.length, subscribersAdded, subscribersError: e?.message || 'Не вдалося додати у підписників' },
                { status: 207 },
            );
        }
    }

    return NextResponse.json({ imported, received: rows.length, subscribersAdded });
}
