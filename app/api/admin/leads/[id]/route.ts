import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/leads/[id] → lead + message thread
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
    const { id } = await params;

    const admin = getAdminClient();
    const { data: lead } = await admin.from('leads').select('*').eq('id', id).maybeSingle();
    if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const { data: messages } = await admin
        .from('lead_messages')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: true });

    return NextResponse.json({ lead, messages: messages || [] });
}

// PATCH /api/admin/leads/[id] → update status / notes / business_type / contact
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
    const { id } = await params;

    const body = await request.json();
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };

    if (typeof body.status === 'string' &&
        ['new', 'contacted', 'replied', 'qualified', 'won', 'lost'].includes(body.status)) {
        patch.status = body.status;
    }
    if (typeof body.business_type === 'string') patch.business_type = body.business_type;
    if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 5000);
    if (typeof body.contact_name === 'string') patch.contact_name = body.contact_name.slice(0, 120);
    if (typeof body.email === 'string') patch.email = body.email.trim().toLowerCase().slice(0, 200) || null;
    if (typeof body.phone === 'string') patch.phone = body.phone.slice(0, 50);

    const admin = getAdminClient();
    const { error } = await admin.from('leads').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

// DELETE /api/admin/leads/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
    const { id } = await params;
    const admin = getAdminClient();
    const { error } = await admin.from('leads').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
