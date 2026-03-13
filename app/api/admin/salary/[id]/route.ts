import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { status, is_locked, notes, breakdown, total_amount } = body;

        const updateData: any = {};
        if (status !== undefined) updateData.status = status;
        if (is_locked !== undefined) updateData.is_locked = is_locked;
        if (notes !== undefined) updateData.notes = notes;
        if (breakdown !== undefined) updateData.breakdown = breakdown;
        if (total_amount !== undefined) updateData.total_amount = total_amount;

        updateData.updated_at = new Date().toISOString();
        if (status === 'paid') updateData.paid_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('salary_calculations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    // Alias for full updates if needed
    return PATCH(req, { params });
}
