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

        await sendEmail({
            to: order.customer_email,
            subject: cleanSubject,
            html: `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${cleanBody.replace(/\n/g, '<br/>')}</div>`,
        });

        return NextResponse.json({ success: true, message: 'Email sent successfully' });
    } catch (error: any) {
        console.error('Email send error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
