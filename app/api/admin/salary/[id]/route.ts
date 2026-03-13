import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
            .eq('id', params.id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    // Alias for full updates if needed
    return PATCH(req, { params });
}
