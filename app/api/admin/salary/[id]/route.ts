import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        // Сума лежить у стовпці `total`. Ім'я `total_amount` приймається як
        // синонім, бо саме його слав старий код, і десь могла лишитися вкладка,
        // відкрита до виправлення.
        const { status, is_locked, notes, breakdown, total, total_amount } = body;

        const updateData: any = {};
        if (status !== undefined) updateData.status = status;
        if (is_locked !== undefined) updateData.is_locked = is_locked;
        if (notes !== undefined) updateData.notes = notes;
        if (breakdown !== undefined) updateData.breakdown = breakdown;
        const amount = total !== undefined ? total : total_amount;
        if (amount !== undefined) updateData.total = amount;

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
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    // Alias for full updates if needed
    return PATCH(req, { params });
}
