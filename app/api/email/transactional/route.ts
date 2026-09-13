import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { sendEmail } from '@/lib/email/resend';
import OrderPlacedEmail from '@/components/email/OrderPlacedEmail';
import OrderShippedEmail from '@/components/email/OrderShippedEmail';
import OrderPaidEmail from '@/components/email/OrderPaidEmail';
import { getAutomationConfig } from '@/lib/email/automation-config';
import { logOutgoingEmail, readSendOutcome, htmlToTextSnapshot, readActor, isDuplicateGuardedAction, findRecentSuccessfulSend, DUPLICATE_WINDOW_HOURS } from '@/lib/email/log-outgoing';

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

        // ЗАХИСТ ВІД ПОВТОРІВ — тут, а не латками по маршрутах-викликачах.
        //
        // Одну оплату підтверджують чотири різні шляхи: вебхук Monobank,
        // check-payment, ручне «Позначити оплаченим» і створення замовлення в
        // адмінці. Кожен із них колись отримував власну перевірку, і кожна
        // бачила лише свій шлях — саме тому клієнтові приходило два однакові
        // листи про одну й ту саму оплату. Спільне в них рівно одне: усі вони
        // приходять СЮДИ. Отже, і правило має бути одне і стояти тут.
        //
        // Перевіряється факт, а не намір: у журналі вже є успішно надісланий
        // лист із тією самою дією за цим замовленням. Провалена спроба не
        // блокує — її треба повторити.
        //
        // Відповідь навмисно успішна, а не помилка: викликач зробив усе
        // правильно, лист у клієнта вже є, і падіння тут змусило б Monobank
        // повторювати вебхук по колу.
        if (isDuplicateGuardedAction(action)) {
            const already = await findRecentSuccessfulSend({ orderId: order.id, template: `order_${action}` });
            if (already) {
                console.log('[transactional] duplicate suppressed', { orderId: order.id, action, firstSentAt: already.sent_at });
                return NextResponse.json({
                    success: true,
                    skipped: true,
                    duplicate: true,
                    firstSentAt: already.sent_at,
                    message: `Лист '${action}' за цим замовленням уже надіслано за останні ${DUPLICATE_WINDOW_HOURS} годин.`,
                });
            }
        }

        let subject = '';
        let htmlContent = '';

        // Token substitution for admin-edited subject/body.
        const sub = (t: string | null | undefined) =>
            (t || '')
                .replace(/\{order\}/g, String(order.order_number ?? ''))
                .replace(/\{name\}/g, String(order.customer_name ?? ''));

        if (action === 'placed') {
            const cfg = await getAutomationConfig('order_placed');
            if (cfg && !cfg.enabled) {
                return NextResponse.json({ success: true, skipped: true, message: 'order_placed disabled in admin' });
            }
            subject = cfg?.subject ? sub(cfg.subject) : `Дякуємо за замовлення №${order.order_number}!`;
            htmlContent = await render(OrderPlacedEmail({
                orderNumber: order.order_number,
                customerName: order.customer_name,
                items: order.items,
                totals: {
                    subtotal: Number(order.subtotal),
                    delivery: Number(order.delivery_cost || 0),
                    total: Number(order.total)
                },
                deliveryAddress: `${order.delivery_method}, ${order.delivery_address?.city || ''} ${order.delivery_address?.warehouse || ''}`,
                body: cfg?.body ? sub(cfg.body) : undefined,
                // Unpaid order → give the customer a payment button. This is the
                // net for lost Monobank redirects (IG webview etc.): TM-001043's
                // customer finished checkout and had NOWHERE on the site to pay.
                paymentUrl: order.payment_status !== 'paid'
                    ? (order.monobank_payment_url || (order.monobank_invoice_id ? `https://pay.monobank.ua/${order.monobank_invoice_id}` : undefined))
                    : undefined,
            }));
        } else if (action === 'shipped') {
            const cfg = await getAutomationConfig('order_shipped');
            if (cfg && !cfg.enabled) {
                return NextResponse.json({ success: true, skipped: true, message: 'order_shipped disabled in admin' });
            }
            subject = cfg?.subject ? sub(cfg.subject) : `Ваше замовлення №${order.order_number} відправлено!`;
            htmlContent = await render(OrderShippedEmail({
                orderNumber: order.order_number,
                customerName: order.customer_name,
                ttn: order.ttn || 'Очікується',
                deliveryMethod: order.delivery_method,
                deliveryAddress: `${order.delivery_address?.city || ''}, ${order.delivery_address?.warehouse || ''}`,
                body: cfg?.body ? sub(cfg.body) : undefined,
            }));
        } else if (action === 'paid') {
            const isPrepay = order.payment_type === 'split';
            const cfg = await getAutomationConfig(isPrepay ? 'order_paid_prepayment' : 'order_paid_full');
            if (cfg && !cfg.enabled) {
                return NextResponse.json({ success: true, skipped: true, message: 'order_paid disabled in admin' });
            }
            const total = Number(order.total) || 0;
            const prepaid = Number(order.prepaid_amount || 0);
            const paidAmount = isPrepay ? prepaid : total;
            const remainingAmount = isPrepay
                ? Number(order.cod_amount ?? order.pickup_unpaid_balance ?? (total - prepaid)) || 0
                : 0;
            subject = cfg?.subject
                ? sub(cfg.subject)
                : (isPrepay
                    ? `Передоплату за замовлення №${order.order_number} отримано`
                    : `Оплату за замовлення №${order.order_number} отримано`);
            htmlContent = await render(OrderPaidEmail({
                orderNumber: order.order_number,
                customerName: order.customer_name,
                variant: isPrepay ? 'prepayment' : 'full',
                paidAmount,
                remainingAmount,
                total,
                body: cfg?.body ? sub(cfg.body) : undefined,
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
        const outcome = readSendOutcome(result);

        // Рядок журналу пишеться в обох випадках — картка «Листування» читає
        // саме цю таблицю. Тепер через спільну функцію, тож сюди нарешті
        // потрапляють і знімок тексту, і provider_message_id, і автор; раніше
        // ця вставка не писала жодного з трьох.
        //
        // Автор приходить у тілі запиту, а не з сесії. Маршрут смикають
        // сервер-до-сервера (кнопка «Надіслати посилання клієнту» і
        // create-invoice) з cron-секретом, тож куки сюди не доїжджають і
        // resolveActingStaff тут завжди повернув би порожньо. Приймати автора
        // від такого виклику безпечно рівно настільки, наскільки безпечний сам
        // секрет: хто ним володіє, і так може надіслати будь-що.
        await logOutgoingEmail({
            orderId: order.id,
            to: order.customer_email,
            template: `order_${action}`,
            subject,
            body: htmlToTextSnapshot(htmlContent),
            actor: readActor(body?.sentBy),
            outcome,
        });

        if (!outcome.sent) {
            // Причина від Brevo, а не глухе «Failed to send email». Саме цей
            // рядок бачить менеджер у картці замовлення, і «не вдалося» без
            // причини не давало йому жодного наступного кроку.
            console.error('Email sending failed in transactional route:', outcome.error);
            return NextResponse.json({ error: outcome.error, success: false }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            providerMessageId: outcome.providerMessageId,
            message: `Transactional email '${action}' sent to ${order.customer_email}`,
        });

    } catch (err: any) {
        console.error('Transactional email error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
