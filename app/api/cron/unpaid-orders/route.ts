import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import OrderCancelledEmail from '@/emails/OrderCancelledEmail';
import PaymentReminderEmail from '@/emails/PaymentReminderEmail';

export const dynamic = 'force-dynamic';

// How long (in hours) before an unpaid order is cancelled.
const CANCEL_AFTER_HOURS = 24;

// When to send a payment reminder before cancellation.
const REMIND_AFTER_HOURS = 3;   // send reminder ~3h after order created
const REMIND_WINDOW_HOURS = 1;  // run cron hourly, so ±1h window

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
    // Orders created 3–4 hours ago, still pending, no reminder sent yet.
    const remindAfter = new Date(now.getTime() - REMIND_AFTER_HOURS * 3600_000);
    const remindBefore = new Date(now.getTime() - (REMIND_AFTER_HOURS + REMIND_WINDOW_HOURS) * 3600_000);

    const { data: remindCandidates } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, total, monobank_invoice_id, payment_reminder_sent_at')
        .eq('payment_status', 'pending')
        .eq('order_status', 'new')
        .is('payment_reminder_sent_at', null)
        .lt('created_at', remindAfter.toISOString())
        .gt('created_at', remindBefore.toISOString())
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

                await sendBrevoEmail({
                    to: order.customer_email,
                    toName: order.customer_name || '',
                    subject: `Нагадування: оплатіть замовлення ${order.order_number}`,
                    html,
                });
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
    // Orders pending for more than 24 hours.
    const cancelBefore = new Date(now.getTime() - CANCEL_AFTER_HOURS * 3600_000);

    const { data: cancelCandidates } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, total')
        .eq('payment_status', 'pending')
        .eq('order_status', 'new')
        .lt('created_at', cancelBefore.toISOString())
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

            await supabase.from('order_history').insert({
                order_id: order.id,
                action: 'status_changed',
                notes: `Замовлення автоматично скасовано через несплату протягом ${CANCEL_AFTER_HOURS} годин`,
            });

            // Send cancellation email
            if (hasBrevo && order.customer_email) {
                const html = await render(OrderCancelledEmail({
                    customerName: order.customer_name || '',
                    orderNumber: order.order_number,
                    orderTotal: Number(order.total) || 0,
                    catalogUrl: `${APP_URL}/uk/catalog`,
                }));

                await sendBrevoEmail({
                    to: order.customer_email,
                    toName: order.customer_name || '',
                    subject: `Замовлення ${order.order_number} скасовано`,
                    html,
                });
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
