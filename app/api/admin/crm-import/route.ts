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

    return NextResponse.json({ imported, received: rows.length });
}
