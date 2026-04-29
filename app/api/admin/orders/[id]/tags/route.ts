import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const params = await props.params;
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { tag_id } = body;

        const { data, error } = await supabase
            .from('order_tag_assignments')
            .insert([{ order_id: params.id, tag_id }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const params = await props.params;
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { tag_id } = body;

        const { error } = await supabase
            .from('order_tag_assignments')
            .delete()
            .match({ order_id: params.id, tag_id });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
