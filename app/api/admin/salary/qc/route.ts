import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const staffId = searchParams.get('staff_id');

    let query = supabase.from('qc_error_log').select('*, staff:staff_id(name, color, initials)');

    if (from) query = query.gte('error_date', from);
    if (to) query = query.lte('error_date', to);
    if (staffId) query = query.eq('staff_id', staffId);

    const { data, error } = await query.order('error_date', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { staff_id, error_date, description, points } = body;

        const { data, error } = await supabase
            .from('qc_error_log')
            .insert({ staff_id, error_date, description, points })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
