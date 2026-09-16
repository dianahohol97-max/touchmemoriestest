import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import OrderCancelledEmail from '@/emails/OrderCancelledEmail';
import PaymentReminderEmail from '@/emails/PaymentReminderEmail';
import { refundOrderBonus } from '@/lib/referral/referral';
import { reverseAgencyCommission } from '@/lib/agency/commission';
import { reverseSalesCommission } from '@/lib/sales/commission';
import { buildCancellationHistoryRow } from '@/lib/orders/cancellation';
import { logOutgoingEmail, readSendOutcome, sendOutcomeFromError, htmlToTextSnapshot } from '@/lib/email/log-outgoing';

export const dynamic = 'force-dynamic';

// How long (in hours) before an unpaid order is cancelled.
const CANCEL_AFTER_HOURS = 24;

// Send a reminder to pending orders at least this old (but not yet cancelled).
// Cron runs once daily (Hobby plan limit), so we remind any pending order
// between REMIND_AFTER_HOURS and CANCEL_AFTER_HOURS old that hasn't been reminded.
const REMIND_AFTER_HOURS = 3;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const now = new Date();
    const hasBrevo = !!getBrevoApiKey();

    const stats = { reminded: 0, cancelled: 0, errors: 0 };

    // ── Step 3: Payment reminder ──────────────────────────────────────────────
    // Pending orders between REMIND_AFTER_HOURS and CANCEL_AFTER_HOURS old,
    // no reminder sent yet.
    const remindAfter = new Date(now.getTime() - REMIND_AFTER_HOURS * 3600_000);
    const remindBefore = new Date(now.getTime() - CANCEL_AFTER_HOURS * 3600_000);
    const remindFloor = new Date(now.getTime() - 7 * 24 * 3600_000);

    const { data: remindCandidates } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, total, monobank_invoice_id, payment_reminder_sent_at')
        // A mirrored KeyCRM order is a read-only copy of an Instagram order that
        // is paid and fiscalised in the CRM. Reminding its customer to pay would
        // chase money the site never had a claim on.
        .neq('source', 'keycrm')
        .eq('payment_status', 'pending')
        .eq('order_status', 'new')
        .is('payment_reminder_sent_at', null)
        .lt('created_at', remindAfter.toISOString())
        .gt('created_at', remindBefore.toISOString())
        .gt('created_at', remindFloor.toISOString())
        .limit(50);

    for (const order of remindCandidates || []) {
        try {
            if (hasBrevo && order.customer_email) {
                const expiresInHours = Math.max(1, CANCEL_AFTER_HOURS - REMIND_AFTER_HOURS);
                // Build a fresh payment link if we have an invoice id, otherwise link to order track page
                const paymentUrl = order.monobank_invoice_id
                    ? `${APP_URL}/uk/track?order=${order.order_number}`
                    : `${APP_URL}/uk/catalog`;

                const html = await render(PaymentReminderEmail({
                    customerName: order.customer_name || '',
                    orderNumber: order.order_number,
                    orderTotal: Number(order.total) || 0,
                    paymentUrl,
                    expiresInHours,
                }));

                // Журнал вихідних: обидва листи цього крона стосуються
                // конкретного замовлення, тож стають у його історію листування
                // поряд із «замовлення прийнято» (Діана, 16.09.2026).
                const subject = `Нагадування: оплатіть замовлення ${order.order_number}`;
                let outcome;
                try {
                    outcome = readSendOutcome(await sendBrevoEmail({
                        to: order.customer_email,
                        toName: order.customer_name || '',
                        subject,
                        html,
                    }));
                } catch (e: any) {
                    console.error(`[unpaid-orders] reminder send failed for ${order.order_number}:`, e?.message || e);
                    outcome = sendOutcomeFromError(e);
                }

                await logOutgoingEmail({
                    orderId: order.id,
                    to: order.customer_email,
                    template: 'payment_reminder',
                    subject,
                    body: htmlToTextSnapshot(html),
                    outcome,
                });

                // Поведінка як раніше: невдала відправка НЕ ставить позначку
                // «нагадано», тож завтра крон спробує ще раз. Журнал уже
                // записаний, тому слід про спробу лишається в обох випадках.
                if (!outcome.sent) throw new Error(outcome.error || 'Не вдалося надіслати нагадування');
            }

            // Mark reminder sent (even if no email — to prevent re-processing)
            await supabase
                .from('orders')
                .update({ payment_reminder_sent_at: now.toISOString() })
                .eq('id', order.id);

            await supabase.from('order_history').insert({
                order_id: order.id,
                action: 'payment_reminder_sent',
                notes: order.customer_email
                    ? `Email-нагадування про оплату надіслано на ${order.customer_email}`
                    : 'Нагадування (email не вказано)',
            });

            stats.reminded++;
        } catch (e) {
            console.error(`[unpaid-orders] remind error for ${order.order_number}:`, e);
            stats.errors++;
        }
    }

    // ── Steps 1 + 2: Cancel overdue + email ──────────────────────────────────
    // Orders pending between 24 hours and 7 days old. The 7-day lower bound
    // prevents the cron from cancelling old/historical/test orders on its first
    // run — only genuinely recent unpaid orders are auto-cancelled.
    const cancelBefore = new Date(now.getTime() - CANCEL_AFTER_HOURS * 3600_000);
    const cancelAfter = new Date(now.getTime() - 7 * 24 * 3600_000);

    const { data: cancelCandidates } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, total, customer_id, used_bonus')
        .eq('payment_status', 'pending')
        .eq('order_status', 'new')
        .lt('created_at', cancelBefore.toISOString())
        .gt('created_at', cancelAfter.toISOString())
        .limit(100);

    for (const order of cancelCandidates || []) {
        try {
            // Cancel the order atomically — only if still pending/new
            const { data: updated } = await supabase
                .from('orders')
                .update({
                    order_status: 'cancelled',
                    payment_status: 'cancelled',
                    updated_at: now.toISOString(),
                })
                .eq('id', order.id)
                .eq('payment_status', 'pending')
                .eq('order_status', 'new')
                .select('id');

            if (!updated || updated.length === 0) {
                // Already changed by someone else — skip
                continue;
            }

            // Причина скасування в тому самому форматі, що й у адмінці: та сама
            // дія order_cancelled і той самий код причини, тож картка показує
            // її зверху однаково, ким би замовлення не було скасоване. Автор
            // порожній свідомо — за кроном людини немає, і підставляти сюди
            // когось означало б звинуватити невинного.
            const { error: reasonError } = await supabase.from('order_history').insert(
                buildCancellationHistoryRow(order.id, {
                    state: 'not_paid',
                    note: `Замовлення автоматично скасовано через несплату протягом ${CANCEL_AFTER_HOURS} годин.`,
                    source: 'cron',
                }),
            );
            if (reasonError) console.error(`[unpaid-orders] history insert failed for ${order.order_number}:`, reasonError.message);

            // Give back any bonuses this order had spent. They are debited at
            // SUBMIT, before payment, so without this an unpaid order that the
            // cron cancels a day later silently destroyed the customer's
            // balance — the worst version of the bug, because it needs no
            // admin action to happen and nobody is watching when it does.
            // Idempotent, so a retried cron run cannot credit twice.
            try {
                await refundOrderBonus(supabase, {
                    orderId: order.id,
                    customerId: (order as any).customer_id || null,
                    usedBonus: Number((order as any).used_bonus) || 0,
                    orderNumber: order.order_number,
                });
            } catch (e) {
                console.error(`[unpaid-orders] bonus refund failed for ${order.order_number} (order still cancelled):`, e);
            }

            // Та сама дія, що й при скасуванні руками в адмінці: зняти
            // невиплачену партнерську комісію. Тут вона майже завжди нічого не
            // знаходить, бо нарахування зʼявляється тільки після оплати, а крон
            // бере неоплачені. Майже — бо замовлення, якому адмін повернув
            // статус «очікує оплати», під цю вибірку підпадає, і тоді
            // нарахування за ним існує. Ідемпотентно.
            try {
                await reverseAgencyCommission(supabase, { orderId: order.id });
            } catch (e) {
                console.error(`[unpaid-orders] commission reversal failed for ${order.order_number} (order still cancelled):`, e);
            }

            // І комісія менеджера за тим самим замовленням, з тієї ж причини:
            // нараховуються вони разом, а зніматися мають теж разом.
            try {
                await reverseSalesCommission(supabase, { orderId: order.id });
            } catch (e) {
                console.error(`[unpaid-orders] sales commission reversal failed for ${order.order_number} (order still cancelled):`, e);
            }

            // Send cancellation email
            if (hasBrevo && order.customer_email) {
                const html = await render(OrderCancelledEmail({
                    customerName: order.customer_name || '',
                    orderNumber: order.order_number,
                    orderTotal: Number(order.total) || 0,
                    catalogUrl: `${APP_URL}/uk/catalog`,
                }));

                const subject = `Замовлення ${order.order_number} скасовано`;
                let outcome;
                try {
                    outcome = readSendOutcome(await sendBrevoEmail({
                        to: order.customer_email,
                        toName: order.customer_name || '',
                        subject,
                        html,
                    }));
                } catch (e: any) {
                    console.error(`[unpaid-orders] cancellation send failed for ${order.order_number}:`, e?.message || e);
                    outcome = sendOutcomeFromError(e);
                }

                await logOutgoingEmail({
                    orderId: order.id,
                    to: order.customer_email,
                    template: 'order_cancelled',
                    subject,
                    body: htmlToTextSnapshot(html),
                    outcome,
                });

                // Замовлення на цей момент уже скасоване — як і раніше, збій
                // листа рахується помилкою прогону, а не скасуванням скасування.
                if (!outcome.sent) throw new Error(outcome.error || 'Не вдалося надіслати лист про скасування');
            }

            stats.cancelled++;
        } catch (e) {
            console.error(`[unpaid-orders] cancel error for ${order.order_number}:`, e);
            stats.errors++;
        }
    }

    console.log('[unpaid-orders cron]', stats);
    return NextResponse.json({ success: true, ...stats });
}
