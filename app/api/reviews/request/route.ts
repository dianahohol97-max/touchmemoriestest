import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { getAdminClient } from '@/lib/supabase/admin';
import ReviewRequestEmail from '@/emails/ReviewRequestEmail';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const supabase = getAdminClient();
    if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

    const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, items')
        .eq('id', orderId)
        .single();

    if (!order || !order.customer_email) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!getBrevoApiKey()) {
        return NextResponse.json({ error: 'BREVO_API_KEY not set' }, { status: 500 });
    }

    const secret = process.env.REVIEW_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'tm-review-secret';
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const payload = `${orderId}:${expiresAt}`;
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${sig}`).toString('base64url');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua';
    const reviewUrl = `${appUrl}/uk/review?token=${token}`;

    const firstName = order.customer_name?.split(' ')[0] || '';
    const productName = Array.isArray(order.items) && order.items[0]?.name
        ? order.items[0].name : 'ваш товар';

    const html = await render(ReviewRequestEmail({
        firstName,
        orderNumber: order.order_number || order.id.substring(0, 8).toUpperCase(),
        productName, reviewUrl, appUrl,
    }));

    await sendBrevoEmail({
        to: order.customer_email,
        toName: order.customer_name || order.customer_email,
        subject: `Як вам ${productName}? Поділіться враженнями ⭐`,
        html,
    });

    await supabase.from('email_automation_log').insert({
        email: order.customer_email,
        automation_type: 'review_request',
        meta: { order_id: orderId },
    });

    return NextResponse.json({ ok: true, reviewUrl });
}
