import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Use service role key to bypass RLS for administrative operations like duplicating any order
        const supabase = getAdminClient();

        // Fetch original order
        const { data: originalOrder, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !originalOrder) {
            return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
        }

        // Generate new order number PB-[YEAR]-[RANDOM]
        const year = new Date().getFullYear();
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        const newOrderNumber = `PB-${year}-${randomStr}`;

        // Create new order payload
        const newOrderData = {
            order_number: newOrderNumber,
            customer_id: originalOrder.customer_id,
            customer_name: originalOrder.customer_name,
            customer_phone: originalOrder.customer_phone,
            customer_email: originalOrder.customer_email,
            items: originalOrder.items,
            subtotal: originalOrder.subtotal,
            delivery_cost: originalOrder.delivery_cost,
            total: originalOrder.total,
            delivery_method: originalOrder.delivery_method,
            delivery_address: originalOrder.delivery_address,
            order_status: 'pending', // Reset status
            payment_status: 'pending', // Reset payment
            fiscal_status: 'pending', // Reset fiscal status
            notes: ` Повторне замовлення з ${originalOrder.order_number}\n\n`,
            created_at: new Date().toISOString()
            // Removed: ttn, mono_invoice_id, mono_payment_id, paid_at, fiscal_id, fiscal_url
        };

        const { data: newOrder, error: createError } = await supabase
            .from('orders')
            .insert([newOrderData])
            .select()
            .single();

        if (createError) throw createError;

        return NextResponse.json({ success: true, newOrderId: newOrder.id, newOrderNumber });

    } catch (error: any) {
        console.error('Error duplicating order:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
