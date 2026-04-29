import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        // Fetch orders in production-related statuses
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                customer_name,
                status,
                production_deadline,
                priority_score,
                manual_priority_override,
                assigned_designer_id,
                page_count,
                has_express_tag,
                is_vip_customer,
                print_file_url,
                created_at,
                paid_at,
                customers (
                    name,
                    notes
                ),
                designer:assigned_designer_id (
                    full_name
                )
            `)
            .in('status', ['confirmed', 'in_production', 'quality_check'])
            .order('priority_score', { ascending: true });

        if (error) throw error;

        const queueItems = orders.map((order: any) => ({
            order_id: order.id,
            customer_name: order.customer_name,
            product_title: "Фотокнига", // Simplified or join with products if needed
            page_count: order.page_count || 0,
            has_express_tag: order.has_express_tag || false,
            is_vip_customer: order.is_vip_customer || false,
            production_deadline: order.production_deadline,
            priority_score: order.priority_score,
            manual_priority_override: order.manual_priority_override,
            assigned_designer_id: order.assigned_designer_id,
            assigned_designer_name: (order as any).designer?.full_name || 'Не призначено',
            status: order.status,
            paid_at: order.paid_at,
            created_at: order.created_at,
            print_file_url: order.print_file_url
        }));

        return NextResponse.json(queueItems);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
