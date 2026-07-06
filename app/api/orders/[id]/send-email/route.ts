import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireAdmin();
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

        // Send via the same Brevo channel every other customer email uses
        // (the old Resend client had no API key configured -> every send 500'd).
        await sendEmail({
            to: order.customer_email,
            subject: subject,
            html: `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`,
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
