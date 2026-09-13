import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import { requireStaff, resolveActingStaff } from '@/lib/auth/guards';
import { logOutgoingEmail, readSendOutcome } from '@/lib/email/log-outgoing';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    // Replying to a customer is a manager's job, not an admin's: the managers
    // (Катерина, Вероніка, …) are in `staff`, not `admin_users`, so requireAdmin
    // rejected them outright.
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();

    try {
        const { id: orderId } = await params;
        const { subject, body } = await request.json();

        // Fetch Order details for the recipient email
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (!order.customer_email) {
            return NextResponse.json({ error: 'Customer email not found' }, { status: 400 });
        }

        // Brevo rejects a message with no subject, and the modal lets the
        // manager leave it empty (only the template fills it) — that 400 came
        // back as a bare 'Помилка надсилання'. Fall back to a sane subject and
        // refuse an empty body loudly instead of sending a blank email.
        const cleanBody = String(body ?? '').trim();
        if (!cleanBody) {
            return NextResponse.json({ error: 'Порожній текст листа' }, { status: 400 });
        }
        const cleanSubject = String(subject ?? '').trim()
            || `Ваше замовлення ${order.order_number} — Touch.Memories`;

        const result = await sendEmail({
            to: order.customer_email,
            subject: cleanSubject,
            html: `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${cleanBody.replace(/\n/g, '<br/>')}</div>`,
        });

        // Лист має лишити слід у «Листуванні з клієнтом». Картка читає
        // email_logs, і template='manual' навмисно той самий, що й у сусіднього
        // маршруту /api/admin/orders/[id]/emails: за ним картка показує тіло
        // листа і підписує його «Лист від магазину».
        const outcome = readSendOutcome(result);
        await logOutgoingEmail({
            orderId,
            to: order.customer_email,
            template: 'manual',
            subject: cleanSubject,
            body: cleanBody,
            actor: await resolveActingStaff(),
            outcome,
        });

        // Невдача не видає себе за успіх. sendEmail не кидає виняток — він
        // повертає { success: false }, а маршрут це колись ігнорував і завжди
        // відповідав «Email sent successfully».
        if (!outcome.sent) {
            console.error('[order-send-email] send failed:', outcome.error);
            return NextResponse.json({ error: outcome.error }, { status: 502 });
        }

        return NextResponse.json({ success: true, providerMessageId: outcome.providerMessageId, message: 'Email sent successfully' });
    } catch (error: any) {
        console.error('Email send error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
