import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = getAdminClient();
    const { id } = await params;

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            customers(id, name, email, phone),
            manager:staff!orders_manager_id_fkey(id, name, initials, color),
            designer:staff!orders_designer_id_fkey(id, name, initials, color),
            order_tag_assignments(order_tags(*))
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ order: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = getAdminClient();
    const { id } = await params;
    const body = await req.json();

    const { data, error } = await supabase
        .from('orders')
        .update(body)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ order: data });
}
