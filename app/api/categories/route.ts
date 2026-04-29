import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const body = await req.json();
    const { data, error } = await supabase
        .from('categories')
        .insert([body])
        .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
