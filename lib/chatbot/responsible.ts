import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Who is responsible for an order, in one line, for the digests.
 *
 * Diana, 2026-08-14: «в ці повідомлення підсумки включай відповідальних» — a
 * list of overdue orders without names tells you something is late but not
 * whom to ask.
 *
 * The answer comes from two places, because the shop has two intakes:
 *  · CRM orders carry «Відповідальні» (the designers) in
 *    custom_attributes.keycrm.assigned_names;
 *  · site orders carry designer_id pointing at the staff table.
 * When neither is set, the manager is named instead — better a person to ask
 * than a blank — and only when there is nobody at all does the line stay bare.
 */
export type ResponsibleLookup = (order: any) => string;

export async function buildResponsibleLookup(orders: any[]): Promise<ResponsibleLookup> {
    const designerIds = [...new Set(
        orders.map(o => o?.designer_id).filter(Boolean).map((id: any) => String(id)),
    )];

    const nameById = new Map<string, string>();
    if (designerIds.length) {
        try {
            const { data } = await getAdminClient()
                .from('staff')
                .select('id, name')
                .in('id', designerIds);
            for (const row of data || []) nameById.set(String((row as any).id), String((row as any).name || '').trim());
        } catch (e) {
            console.error('[responsible] staff lookup failed:', e);
        }
    }

    return (order: any): string => {
        const assigned = order?.custom_attributes?.keycrm?.assigned_names;
        if (Array.isArray(assigned) && assigned.length) {
            return assigned.map((n: any) => String(n || '').trim()).filter(Boolean).join(', ');
        }

        const fromStaff = order?.designer_id ? nameById.get(String(order.designer_id)) : '';
        if (fromStaff) return fromStaff;

        const manager = String(order?.custom_attributes?.keycrm?.manager_name || '').trim();
        return manager ? `${manager} (менеджер)` : '';
    };
}
