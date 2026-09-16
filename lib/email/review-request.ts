import { render } from '@react-email/components';
import crypto from 'crypto';
import ReviewRequestEmail from '@/emails/ReviewRequestEmail';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';
import {
    logOutgoingEmail,
    readSendOutcome,
    sendOutcomeFromError,
    htmlToTextSnapshot,
} from '@/lib/email/log-outgoing';

/**
 * Лист «поділіться враженнями» — складання, відправка, журнал.
 *
 * НАВІЩО ОКРЕМИЙ МОДУЛЬ. Маршрут /api/reviews/request існував із самого
 * початку, але не надіслав жодного листа за весь час: він написаний як
 * виконавець, який чекає POST із конкретним orderId, а того, хто б вирішував
 * «кому і коли», не було ніколи. Тепер такий крон зʼявився, і обидва входи
 * мусять слати однаково — інакше вони розійдуться так само, як розійшлося
 * реферальне посилання в пʼяти місцях (Діана, 16.09.2026).
 *
 * Токен підписаний і живе 30 днів. Це єдиний доказ того, що відгук лишає
 * саме той, хто отримав замовлення, тож секрет і строк тут не декоративні.
 */

export const REVIEW_TOKEN_TTL_DAYS = 30;
/** Тип у журналі автоматизацій — він же захист від повторного прохання. */
export const REVIEW_AUTOMATION_TYPE = 'review_request';

export interface ReviewOrder {
    id: string;
    order_number?: string | null;
    customer_name?: string | null;
    customer_email: string;
    items?: any;
}

function reviewSecret(): string {
    return process.env.REVIEW_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'tm-review-secret';
}

export function buildReviewToken(orderId: string, now: number = Date.now()): string {
    const expiresAt = now + REVIEW_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    const payload = `${orderId}:${expiresAt}`;
    const sig = crypto.createHmac('sha256', reviewSecret()).update(payload).digest('hex');
    return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

/** Назва товару для теми листа: перша позиція замовлення. */
export function reviewProductName(items: any): string {
    return Array.isArray(items) && items[0]?.name ? String(items[0].name) : 'ваш товар';
}

export interface ReviewSendResult {
    sent: boolean;
    reviewUrl: string;
    error?: string;
}

/**
 * Надсилає прохання про відгук і лишає два сліди.
 *
 * email_logs — журнал доставки, пишеться ЗАВЖДИ, і на успіх, і на відмову.
 * email_automation_log — захист від повторів, пишеться тільки після успіху:
 * інакше відмова Brevo назавжди закрила б цьому замовленню прохання, хоча
 * лист людина не бачила.
 */
export async function sendReviewRequest(order: ReviewOrder): Promise<ReviewSendResult> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua';
    const token = buildReviewToken(order.id);
    const reviewUrl = `${appUrl}/uk/review?token=${token}`;

    const firstName = String(order.customer_name || '').split(' ')[0] || '';
    const productName = reviewProductName(order.items);
    const orderNumber = order.order_number || order.id.substring(0, 8).toUpperCase();
    const subject = `Як вам ${productName}? Поділіться враженнями ⭐`;

    let html = '';
    let outcome;
    try {
        html = await render(ReviewRequestEmail({
            firstName, orderNumber, productName, reviewUrl, appUrl,
        }));
        const res = await sendBrevoEmail({
            to: order.customer_email,
            toName: order.customer_name || order.customer_email,
            subject,
            html,
        });
        outcome = readSendOutcome(res);
    } catch (e: any) {
        console.error('[review-request] send failed for', order.customer_email, e?.message || e);
        outcome = sendOutcomeFromError(e);
    }

    await logOutgoingEmail({
        orderId: order.id,
        to: order.customer_email,
        template: REVIEW_AUTOMATION_TYPE,
        subject,
        body: html ? htmlToTextSnapshot(html) : 'Лист не склався: шаблон відгуку не відрендерився.',
        outcome,
    });

    if (outcome.sent) {
        const admin = getAdminClient();
        await admin.from('email_automation_log').insert({
            email: order.customer_email,
            automation_type: REVIEW_AUTOMATION_TYPE,
            meta: { order_id: order.id },
        });
    }

    return { sent: outcome.sent, reviewUrl, error: outcome.error || undefined };
}
