import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import { requireStaff } from '@/lib/auth/guards';

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

        // Лист має лишити слід у «Листуванні з клієнтом». Досі не лишав: картка
        // читає email_logs, а цей шлях туди не писав нічого, тож менеджер
        // відповідав клієнту і через хвилину не міг довести ні що відповів, ні
        // що саме написав. Сусідній маршрут /api/admin/orders/[id]/emails
        // логує з першого дня — розходилися саме ці два.
        //
        // template='manual' навмисно той самий, що й там: картка за ним
        // показує тіло листа і підписує його «Лист від магазину».
        try {
            await supabase.from('email_logs').insert({
                order_id: orderId,
                customer_email: order.customer_email,
                template: 'manual',
                subject: cleanSubject,
                body: cleanBody,
                status: result?.success === false ? 'failed' : 'sent',
                error: result?.success === false
                    ? String((result as any)?.error?.message || (result as any)?.error || 'send failed').slice(0, 300)
                    : null,
                sent_at: new Date().toISOString(),
            });
        } catch (e) {
            // Журнал не має права завалити відправку — лист уже пішов.
            console.error('[order-send-email] log insert failed (email still sent):', e);
        }

        // Невдача більше не видає себе за успіх. sendEmail не кидає виняток —
        // він повертає { success: false }, а маршрут це ігнорував і завжди
        // відповідав «Email sent successfully». Менеджер бачив тост «Лист
        // надіслано» і йшов далі, хоча Brevo відмовив.
        if (result?.success === false) {
            const reason = String((result as any)?.error?.message || (result as any)?.error || 'Не вдалося надіслати лист');
            console.error('[order-send-email] send failed:', reason);
            return NextResponse.json({ error: reason }, { status: 502 });
        }

        return NextResponse.json({ success: true, message: 'Email sent successfully' });
    } catch (error: any) {
        console.error('Email send error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
