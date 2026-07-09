import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/send-payment-link
 *
 * Emails the customer their Monobank payment link. Managers used to hit
 * «Копіювати» and paste the link into Instagram/Telegram by hand — the team
 * expected a button that actually sends it ('воно їх нікуди не надсилає').
 *
 * Reuses the existing 'placed' transactional email (OrderPlacedEmail with the
 * «Оплатити замовлення» button), so the customer gets the same branded letter
 * the checkout sends. Refuses on a paid order — nobody should be nudged to pay
 * twice — and on an order without an invoice, where there is nothing to pay.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const admin = getAdminClient();

    const { data: order } = await admin
        .from('orders')
        .select('id, order_number, payment_status, customer_email, monobank_invoice_id')
        .eq('id', id)
        .maybeSingle();

    if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
    if (order.payment_status === 'paid') {
        return NextResponse.json({ error: 'Замовлення вже оплачене' }, { status: 400 });
    }
    if (!order.customer_email) {
        return NextResponse.json({ error: 'У клієнта не вказано email' }, { status: 400 });
    }
    if (!order.monobank_invoice_id) {
        return NextResponse.json({ error: 'Немає рахунку Monobank — створіть його спочатку' }, { status: 400 });
    }

    const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
    const res = await fetch(`${base}/api/email/transactional`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
        body: JSON.stringify({ action: 'placed', orderId: id }),
        signal: AbortSignal.timeout(15000),
    });
    const detail = await res.json().catch(() => ({} as any));
    if (!res.ok) {
        return NextResponse.json({ error: detail?.error || 'Не вдалося надіслати лист' }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        message: `Лист із посиланням на оплату надіслано на ${order.customer_email}`,
    });
}
