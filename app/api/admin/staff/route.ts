import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

type SB = ReturnType<typeof getAdminClient>;

// Some staff columns (e.g. daily_base_rate / commission_percentage / piece_rate)
// may not yet exist on every environment's `staff` table — the form/type carry
// them but a migration may be pending on prod. Rather than fail the whole save
// with a generic error, we drop any column Postgres reports as missing (42703)
// and retry, so adding a teammate never gets blocked by a not-yet-migrated rate
// field. Once the migration lands, the full row inserts on the first attempt.
async function insertResilient(supabase: SB, row: Record<string, any>) {
    let payload = { ...row };
    for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase.from('staff').insert([payload]).select().single();
        if (!error) return { data, dropped: Object.keys(row).filter(k => !(k in payload)) };
        if (error.code === '42703') {
            const col = /column "([^"]+)"/.exec(error.message || '')?.[1];
            if (col && col in payload) { delete (payload as any)[col]; continue; }
        }
        return { error };
    }
    return { error: { message: 'Too many unknown columns' } as any };
}

async function updateResilient(supabase: SB, id: string, updates: Record<string, any>) {
    let payload = { ...updates };
    for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase.from('staff').update(payload).eq('id', id).select().single();
        if (!error) return { data };
        if (error.code === '42703') {
            const col = /column "([^"]+)"/.exec(error.message || '')?.[1];
            if (col && col in payload) { delete (payload as any)[col]; continue; }
        }
        return { error };
    }
    return { error: { message: 'Too many unknown columns' } as any };
}

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();

        // Empty-string UUID/FK values must become null, not '' (invalid uuid).
        if (body.role_id === '') body.role_id = null;

        // Ensure initials are created if not provided directly
        if (!body.initials && body.name) {
            body.initials = body.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
        }

        const { data, error } = await insertResilient(supabase, body);
        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing staff ID' }, { status: 400 });
        }

        if (updates.role_id === '') updates.role_id = null;

        const { data, error } = await updateResilient(supabase, id, updates);
        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
