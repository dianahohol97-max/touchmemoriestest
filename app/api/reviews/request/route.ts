import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getBrevoApiKey } from '@/lib/email/brevo';
import { sendReviewRequest } from '@/lib/email/review-request';

export const dynamic = 'force-dynamic';

/**
 * Прохання про відгук по ОДНОМУ замовленню.
 *
 * Це виконавець, а не планувальник: він шле тому, кого назвали. Хто саме
 * заслуговує листа сьогодні, вирішує /api/cron/review-requests — до
 * 16.09.2026 такого крона не існувало, і цей маршрут за весь час не надіслав
 * жодного листа, бо його ніхто не кликав.
 *
 * Складання листа й журнал живуть у lib/email/review-request, спільні з кроном.
 */
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

    const result = await sendReviewRequest(order as any);
    if (!result.sent) {
        return NextResponse.json({ error: result.error || 'Не вдалося надіслати' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, reviewUrl: result.reviewUrl });
}
