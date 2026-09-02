import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const params = await props.params;
    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { manager_id, designer_id } = body;
        const assigned_at = new Date().toISOString();

        // Start updates
        // Note: Supabase JS client doesn't support traditional transactions across multiple tables
        // natively via RPC unless we write a custom stored procedure. 
        // We will do sequenced promises instead for this MVP.

        // 1. Update the order table
        //
        // ЧІПАЄМО ЛИШЕ ТІ ПОЛЯ, ЩО ПРИЙШЛИ В ТІЛІ.
        // Раніше роут писав обидва завжди, тож виклик із самим manager_id
        // затирав дизайнера в null. Картка призначає по одному відповідальному
        // за раз — призначення менеджера знімало б щойно поставленого дизайнера
        // і навпаки. Явний null у тілі так і лишається зняттям призначення.
        const orderPatch: Record<string, any> = { assigned_at };
        if ('manager_id' in body) orderPatch.manager_id = manager_id || null;
        if ('designer_id' in body) orderPatch.designer_id = designer_id || null;
        // Keep the assignment in sync with the designer cabinet, which only
        // shows orders where with_designer = true AND designer_id = me. When a
        // designer is assigned here, mark the order as a designer order so it
        // appears for them. (Not cleared on un-assign — it may have been a
        // designer order originally.)
        if (designer_id) {
            orderPatch.with_designer = true;
        }
        const { data: orderUpdate, error: orderError } = await supabase
            .from('orders')
            .update(orderPatch)
            .eq('id', params.id)
            .select()
            .single();

        if (orderError) throw orderError;

        // Fetch staff details to put inside history context
        let actionMsg: string[] = [];
        if ('manager_id' in body) actionMsg.push(manager_id ? 'Призначено Менеджера' : 'Знято Менеджера');
        if ('designer_id' in body) actionMsg.push(designer_id ? 'Призначено Дизайнера' : 'Знято Дизайнера');

        // 2. Insert into history
        if (actionMsg.length > 0) {
            const { error: historyError } = await supabase
                .from('order_history')
                .insert([{
                    order_id: params.id,
                    action: actionMsg.join(' та '),
                    details: orderPatch,
                }]);

            if (historyError) throw historyError;
        }

        // 3. Log into staff_work_log for salary aggregations
        const workLogs: any[] = [];
        if (manager_id) {
            workLogs.push({ staff_id: manager_id, order_id: params.id, action: 'assigned_manager', notes: 'Assigned as manager' });
        }
        if (designer_id) {
            workLogs.push({ staff_id: designer_id, order_id: params.id, action: 'assigned_designer', notes: 'Assigned as designer' });
        }
        if (workLogs.length > 0) {
            const { error: logError } = await supabase.from('staff_work_log').insert(workLogs);
            if (logError) console.error("Error logging work log:", logError.message);
        }

        return NextResponse.json(orderUpdate);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
