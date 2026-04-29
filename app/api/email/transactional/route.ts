import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { sendEmail } from '@/lib/email/resend';
import OrderPlacedEmail from '@/components/email/OrderPlacedEmail';
import OrderShippedEmail from '@/components/email/OrderShippedEmail';

import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // Either admin auth or internal cron-secret. Internal callers (Monobank
    // webhook, admin order creation) pass the secret to avoid the human-auth
    // path. External callers MUST be admin to prevent random spam blasts.
    const cronSecret = req.headers.get('x-cron-secret');
    const cronOk = !!process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;
    if (!cronOk) {
        const guard = await requireAdmin();
        if (!guard.ok) return guard.response;
    }

    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { action, orderId } = body;

        if (!action) {
            return NextResponse.json({ error: 'Missing action' }, { status: 400 });
        }

        // ─── 'custom' action ──────────────────────────────────────────────
        // Used by mass-email routes (wishlist-reminder etc.) to send a
        // pre-rendered email. Caller passes { action:'custom', to, subject,
        // html }. Both the cron secret OR admin auth is required (already
        // checked above), so this is not an open relay.
        if (action === 'custom') {
            const { to, subject: customSubject, html: customHtml } = body;
            if (!to || !customSubject || !customHtml) {
                return NextResponse.json({ error: 'custom action requires to, subject, html' }, { status: 400 });
            }
            const result = await sendEmail({ to, subject: customSubject, html: customHtml });
            if (!result.success) {
                console.error('Email sending failed in transactional/custom:', result.error);
                return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
            }
            return NextResponse.json({ success: true, message: `Custom email sent to ${to}` });
        }

        // ─── Order-keyed actions ──────────────────────────────────────────
        if (!orderId) {
            return NextResponse.json({ error: 'orderId required for this action' }, { status: 400 });
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
