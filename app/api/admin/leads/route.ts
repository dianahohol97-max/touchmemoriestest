import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/leads?status=new&type=photographer&q=...
export async function GET(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const q = searchParams.get('q');

    const admin = getAdminClient();
    let query = admin.from('leads').select('*').order('created_at', { ascending: false }).limit(500);
    if (status && status !== 'all') query = query.eq('status', status);
    if (type && type !== 'all') query = query.eq('business_type', type);
    if (q) query = query.or(`business_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Lightweight stats for the dashboard header
    const { data: stats } = await admin.from('leads').select('status');
    const counts: Record<string, number> = {};
    (stats || []).forEach((r: any) => { counts[r.status] = (counts[r.status] || 0) + 1; });

    return NextResponse.json({ leads: data || [], counts });
}

// POST /api/admin/leads → manually add a lead (Instagram/LinkedIn/other)
export async function POST(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const businessName = String(body?.business_name || '').trim();
    if (!businessName) return NextResponse.json({ error: 'Вкажіть назву бізнесу' }, { status: 400 });

    const admin = getAdminClient();
    const email = body?.email ? String(body.email).trim().toLowerCase() : null;

    // Dedupe by email if provided
    if (email) {
        const { data: dup } = await admin.from('leads').select('id').ilike('email', email).maybeSingle();
        if (dup) return NextResponse.json({ error: 'Лід з таким email вже існує', lead_id: dup.id }, { status: 409 });
    }

    const { data, error } = await admin.from('leads').insert({
        business_type: body?.business_type || 'other',
        business_name: businessName.slice(0, 200),
        contact_name: body?.contact_name ? String(body.contact_name).slice(0, 120) : null,
        email,
        phone: body?.phone ? String(body.phone).slice(0, 50) : null,
        website: body?.website ? String(body.website).slice(0, 300) : null,
        instagram: body?.instagram ? String(body.instagram).slice(0, 200) : null,
        city: body?.city ? String(body.city).slice(0, 120) : null,
        source: body?.source || 'manual',
        status: 'new',
    }).select('id').maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, lead_id: data?.id });
}
