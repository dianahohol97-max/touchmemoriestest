import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveActingStaff } from '@/lib/auth/guards';
import { logOutgoingEmail, failedOutcome } from '@/lib/email/log-outgoing';

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

    // Хто натиснув. Резолвиться ТУТ, бо саме сюди доїжджають куки менеджера:
    // наступний крок — сервер-до-сервера з cron-секретом, і там сесії вже не
    // буде. Автор їде в тілі, щоб рядок журналу підписав транзакційний
    // маршрут, який його й пише.
    const actor = await resolveActingStaff();

    const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
    let res: Response;
    try {
        res = await fetch(`${base}/api/email/transactional`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
            body: JSON.stringify({ action: 'placed', orderId: id, sentBy: actor }),
            signal: AbortSignal.timeout(15000),
        });
    } catch (e: any) {
        // Транзакційний маршрут не відповів узагалі — таймаут або обірвана
        // мережа. Рядка журналу не написав ніхто, тож пишемо звідси: інакше
        // менеджер отримає помилку, а в історії листування не буде нічого.
        const reason = String(e?.message || e || 'Лист не надіслано');
        await logOutgoingEmail({
            orderId: id,
            to: order.customer_email,
            template: 'order_placed',
            subject: `Замовлення №${order.order_number} — посилання на оплату`,
            body: 'Лист із кнопкою «Оплатити замовлення». Текст будується в /api/email/transactional і до відправки не дійшов.',
            actor,
            outcome: failedOutcome(reason),
        });
        return NextResponse.json({ error: `Не вдалося надіслати лист: ${reason}` }, { status: 502 });
    }

    const detail = await res.json().catch(() => ({} as any));
    if (!res.ok || detail?.success === false) {
        // Причина від Brevo проходить наскрізь. Раніше сюди доходило глухе
        // «Failed to send email», і менеджер не мав що з цим робити.
        return NextResponse.json(
            { error: detail?.error || 'Не вдалося надіслати лист' },
            { status: res.status === 200 ? 502 : res.status },
        );
    }

    return NextResponse.json({
        ok: true,
        message: `Лист із посиланням на оплату надіслано на ${order.customer_email}`,
    });
}
