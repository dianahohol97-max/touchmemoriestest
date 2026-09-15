import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { calculateSalary } from '@/lib/salary/calculator';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

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

/**
 * POST — перерахувати період і зберегти результат.
 *
 * Поля навмисно ті, що є в таблиці: сума лежить у `total`, а не в
 * `total_amount`. До 15.09.2026 код писав `total_amount`, такого стовпця в
 * бойовій базі немає, PostgREST відмовляв кожним записом, помилка не
 * перевірялася — і маршрут відповідав `success: true` зі списком із самих
 * null. У таблиці за весь час не з'явилося жодного рядка, а кнопка щоразу
 * казала, що період розраховано.
 */
export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { from, to, staff_id } = await req.json();

        if (!from || !to) {
            return NextResponse.json({ error: 'Period is required' }, { status: 400 });
        }

        // Get active staff
        let staffQuery = supabase.from('staff').select('id').eq('is_active', true);
        if (staff_id) staffQuery = staffQuery.eq('id', staff_id);

        const { data: staffList, error: staffError } = await staffQuery;
        if (staffError) {
            console.error('Salary POST: не вдалося прочитати список співробітників', staffError);
            return NextResponse.json({ error: staffError.message }, { status: 500 });
        }
        if (!staffList?.length) return NextResponse.json({ error: 'No staff found' }, { status: 404 });

        const results: any[] = [];
        // Кожен збій називається поіменно. Мовчазний перебір тут коштував
        // дорого: маршрут писав неіснуючі стовпці, помилку ніхто не дивився,
        // і екран казав «Період розраховано» над порожнім списком.
        const failures: string[] = [];

        for (const staff of staffList) {
            const { total, breakdown } = await calculateSalary(staff.id, from, to);

            // Check if calculation already exists and is locked
            const { data: existing, error: existingError } = await supabase
                .from('salary_calculations')
                .select('id, is_locked')
                .eq('staff_id', staff.id)
                .eq('date_from', from)
                .eq('date_to', to)
                .maybeSingle();

            if (existingError) {
                failures.push(`${staff.id}: ${existingError.message}`);
                continue;
            }

            if (existing?.is_locked) continue;

            if (existing) {
                const { data: updated, error } = await supabase
                    .from('salary_calculations')
                    .update({
                        total,
                        breakdown,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (error) { failures.push(`${staff.id}: ${error.message}`); continue; }
                results.push(updated);
            } else {
                const { data: inserted, error } = await supabase
                    .from('salary_calculations')
                    .insert({
                        staff_id: staff.id,
                        date_from: from,
                        date_to: to,
                        total,
                        breakdown,
                        status: 'draft'
                    })
                    .select()
                    .single();
                if (error) { failures.push(`${staff.id}: ${error.message}`); continue; }
                results.push(inserted);
            }
        }

        if (failures.length) {
            console.error('Salary POST: не збереглося', failures);
            return NextResponse.json({
                error: `Не збереглося розрахунків: ${failures.length}. Перший збій — ${failures[0]}`,
                saved: results.length,
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, results });
    } catch (e: any) {
        console.error('Salary POST Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
