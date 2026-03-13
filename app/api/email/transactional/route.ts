import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { sendEmail } from '@/lib/email/resend';
import OrderPlacedEmail from '@/components/email/OrderPlacedEmail';
import OrderShippedEmail from '@/components/email/OrderShippedEmail';

import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const supabase = getAdminClient();
    try {
        const { action, orderId } = await req.json();

        if (!action || !orderId) {
            return NextResponse.json({ error: 'Missing action or orderId' }, { status: 400 });
        }

        // Fetch Order Source Data
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (!order.customer_email) {
            return NextResponse.json({ error: 'Customer has no email' }, { status: 400 });
        }

        let subject = '';
        let htmlContent = '';

        if (action === 'placed') {
            subject = `Дякуємо за замовлення №${order.order_number}!`;
            htmlContent = await render(OrderPlacedEmail({
                orderNumber: order.order_number,
                customerName: order.customer_name,
                items: order.items,
                totals: {
                    subtotal: Number(order.subtotal),
                    delivery: Number(order.delivery_cost || 0),
                    total: Number(order.total)
                },
                deliveryAddress: `${order.delivery_method}, ${order.delivery_address?.city || ''} ${order.delivery_address?.warehouse || ''}`
            }));
        } else if (action === 'shipped') {
            subject = `Ваше замовлення №${order.order_number} відправлено!`;
            htmlContent = await render(OrderShippedEmail({
                orderNumber: order.order_number,
                customerName: order.customer_name,
                ttn: order.ttn || 'Очікується',
                deliveryMethod: order.delivery_method,
                deliveryAddress: `${order.delivery_address?.city || ''}, ${order.delivery_address?.warehouse || ''}`
            }));
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Send Email
        const result = await sendEmail({
            to: order.customer_email,
            subject,
            html: htmlContent
        });

        if (!result.success) {
            console.error('Email sending failed in transactional route:', result.error);
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: `Transactional email '${action}' sent to ${order.customer_email}` });

    } catch (err: any) {
        console.error('Transactional email error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
