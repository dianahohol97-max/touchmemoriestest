import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

        // Send Email via Resend
        const data = await resend.emails.send({
            from: 'TouchMemories <hello@touchmemories.shop>', // Requires verified domain on Resend
            to: order.customer_email,
            subject: subject,
            text: body, // Add raw text fallback
            html: `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`,
        });

        if (data.error) {
            throw new Error(data.error.message);
        }

        // Optionally store the sent email into a history log, 
        // for now we'll update the order notes if we are going to build notes, or just return success
        // Since we are adding Customer Notes, we'll keep it simple here. We can just return success.

        return NextResponse.json({ success: true, message: 'Email sent successfully' });
    } catch (error: any) {
        console.error('Email send error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
