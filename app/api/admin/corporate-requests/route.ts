import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/corporate-requests?status=new
export async function GET(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const admin = getAdminClient();
    let q = admin.from('corporate_requests').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data || [] });
}

// PATCH /api/admin/corporate-requests  { id, status }
export async function PATCH(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id, status } = await request.json();
    if (!id || !['new', 'quoted', 'won', 'lost'].includes(status)) {
        return NextResponse.json({ error: 'Невірні параметри' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { error } = await admin.from('corporate_requests').update({ status }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
