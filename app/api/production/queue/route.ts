import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * Production queue: orders in production-stage statuses, ordered by
 * computed priority.
 *
 * Schema reconciliation:
 *   - `status` → `order_status`
 *   - `production_deadline` → `deadline`
 *   - `assigned_designer_id` → `designer_id` (canonical column on orders)
 *   - `page_count`, `has_express_tag`, `print_file_url` live in
 *     `custom_attributes` JSONB (set by /api/automation/process-payment)
 *     or `items` JSONB — there are no separate columns
 *   - `is_vip_customer` is a join through `customers.is_vip`
 *   - designer info comes from `staff` (not from a foreign-key join via
 *     designer_id since Supabase doesn't know that relation exists
 *     without an FK constraint — we resolve in code)
 */
export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                customer_name,
                order_status,
                deadline,
                priority_score,
                designer_id,
                custom_attributes,
                items,
                created_at,
                paid_at,
                customer:customers(name, is_vip)
            `)
            .in('order_status', ['confirmed', 'in_production', 'quality_check'])
            .order('priority_score', { ascending: true, nullsFirst: false });

        if (error) throw error;

        // Resolve designer names in one round-trip rather than per-row joins.
        const designerIds = Array.from(new Set((orders || [])
            .map((o: any) => o.designer_id)
            .filter(Boolean)));
        const designerMap = new Map<string, string>();
        if (designerIds.length > 0) {
            const { data: designers } = await supabase
                .from('staff')
                .select('id, name')
                .in('id', designerIds);
            for (const d of designers || []) designerMap.set(d.id, d.name);
        }

        const queueItems = (orders || []).map((order: any) => {
            const attrs = order.custom_attributes || {};
            const firstItem = Array.isArray(order.items) ? order.items[0] : null;
            const customerRecord = Array.isArray(order.customer)
                ? order.customer[0]
                : order.customer;
            return {
                order_id: order.id,
                customer_name: customerRecord?.name || order.customer_name || '',
                product_title: firstItem?.product_name || 'Фотокнига',
                page_count: attrs.page_count || firstItem?.options?.['Кількість сторінок'] || 0,
                has_express_tag: !!(attrs.tags?.includes(' Відправити швидше') || attrs.has_express_tag),
                is_vip_customer: !!customerRecord?.is_vip,
                production_deadline: order.deadline,
                priority_score: order.priority_score,
                assigned_designer_id: order.designer_id,
                assigned_designer_name: order.designer_id ? (designerMap.get(order.designer_id) || 'Невідомий') : 'Не призначено',
                status: order.order_status,
                paid_at: order.paid_at,
                created_at: order.created_at,
                print_file_url: attrs.print_file_url || null,
            };
        });

        return NextResponse.json(queueItems);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
