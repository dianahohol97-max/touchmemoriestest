import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { calculateSalary } from '@/lib/salary/calculator';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
        return NextResponse.json({ error: 'Date range is required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('salary_calculations')
        .select(`
            *,
            staff:staff_id(*)
        `)
        .gte('date_from', from)
        .lte('date_to', to)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const { from, to, staff_id } = await req.json();

        if (!from || !to) {
            return NextResponse.json({ error: 'Period is required' }, { status: 400 });
        }

        // Get active staff
        let staffQuery = supabase.from('staff').select('id').eq('is_active', true);
        if (staff_id) staffQuery = staffQuery.eq('id', staff_id);

        const { data: staffList } = await staffQuery;
        if (!staffList) return NextResponse.json({ error: 'No staff found' }, { status: 404 });

        const results = [];

        for (const staff of staffList) {
            const { total, breakdown } = await calculateSalary(staff.id, from, to);

            // Check if calculation already exists and is locked
            const { data: existing } = await supabase
                .from('salary_calculations')
                .select('id, is_locked')
                .eq('staff_id', staff.id)
                .eq('date_from', from)
                .eq('date_to', to)
                .single();

            if (existing?.is_locked) continue;

            if (existing) {
                const { data: updated } = await supabase
                    .from('salary_calculations')
                    .update({
                        total_amount: total,
                        breakdown,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                results.push(updated);
            } else {
                const { data: inserted } = await supabase
                    .from('salary_calculations')
                    .insert({
                        staff_id: staff.id,
                        date_from: from,
                        date_to: to,
                        total_amount: total,
                        breakdown,
                        status: 'draft'
                    })
                    .select()
                    .single();
                results.push(inserted);
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (e: any) {
        console.error('Salary POST Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
