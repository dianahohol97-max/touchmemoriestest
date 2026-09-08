const BREVO_API_URL = 'https://api.brevo.com/v3';

export function getBrevoApiKey() {
    return process.env.BREVO_API_KEY || process.env.BREVO_API_TOKEN || '';
}

import { buildUnsubscribeUrl, withUnsubscribeFooter, type UnsubscribeTarget } from './unsubscribe';
import { reserveEmailQuota, EmailQuotaError, type EmailKind } from './quota';

interface SendEmailParams {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    fromName?: string;
    fromEmail?: string;
    /**
     * Set on MARKETING mail only. Appends the visible unsubscribe footer and
     * the List-Unsubscribe headers that Gmail and Outlook turn into their own
     * one-click control. Leave undefined for transactional mail (order placed,
     * paid, shipped) — a customer does not opt out of those.
     */
    unsubscribe?: UnsubscribeTarget;
    /**
     * Which half of the daily budget this send draws on. Defaults to
     * transactional: every existing call site is an order or account email, and
     * those must keep working. Marketing senders pass 'marketing' explicitly so
     * they can only spend what is left above the transactional reserve.
     */
    kind?: EmailKind;
    /**
     * Set when the caller has ALREADY reserved a slot for this send (bulk
     * senders reserve the whole batch up front). Prevents double counting.
     */
    quotaReserved?: boolean;
    /**
     * Файли, які їдуть разом із листом. Brevo приймає або base64 у `content`,
     * або `url`, з якого сам їх забирає. Ми користуємось першим варіантом:
     * посилання на наше сховище підписані й недовговічні, тож Brevo міг би не
     * встигнути їх прочитати.
     *
     * Ліміт Brevo — 10 МБ на весь лист разом. Виклик відповідає за те, щоб не
     * перевищити його; тут ми тільки передаємо далі.
     */
    attachments?: BrevoAttachment[];
    /**
     * Куди піде відповідь одержувача.
     *
     * Без цього відповідь іде на адресу відправника. Для нас це було пасткою:
     * листи йдуть з hello@touchmemories.com.ua, а такої скриньки не існує
     * (Діана, 08.09.2026). Домен у Brevo підтверджений, тож відправка працює,
     * і зовні все виглядає справним — але кожен клієнт, який натиснув
     * «Відповісти», писав у порожнечу, і жодна з тих відповідей до нас не
     * доходила.
     *
     * Адреса береться з BREVO_REPLY_TO. Поки змінна не задана, заголовок не
     * ставиться взагалі — краще стара поведінка, ніж навмання обрана чужа
     * скринька.
     */
    replyTo?: { email: string; name?: string } | null;
}

/**
 * Скринька для відповідей, спільна для всіх листів сайту.
 *
 * За замовчуванням — touch.memories3@gmail.com. Це не здогад: саме ця адреса
 * стоїть на публічній сторінці контактів, і саме на неї вже приходять усі
 * форми сайту (звернення, корпоративні запити, реєстрація B2B, партнерство).
 * Тобто скринька існує і її читають, на відміну від hello@touchmemories.com.ua,
 * з якої листи ЙДУТЬ.
 *
 * BREVO_REPLY_TO перекриває це значення, якщо відповіді треба завернути кудись
 * інде.
 */
const DEFAULT_REPLY_TO = 'touch.memories3@gmail.com';

export function getReplyTo(): { email: string; name?: string } | null {
    const raw = (process.env.BREVO_REPLY_TO ?? '').trim();
    // Порожня змінна означає «як за замовчуванням», а не «без відповіді»:
    // лишити клієнта без адреси для відповіді — це те, від чого ми тікаємо.
    const email = raw || DEFAULT_REPLY_TO;
    if (!email.includes('@')) return null;
    const name = (process.env.BREVO_REPLY_TO_NAME || process.env.BREVO_FROM_NAME || '').trim();
    return name ? { email, name } : { email };
}

export interface BrevoAttachment {
    /** Імʼя файлу, яке побачить одержувач. */
    name: string;
    /** Вміст у base64 (без префікса data:). */
    content: string;
}

export async function sendBrevoEmail({ to, toName, subject, html, fromName, fromEmail, unsubscribe, kind = 'transactional', quotaReserved = false, attachments, replyTo }: SendEmailParams) {
    const apiKey = getBrevoApiKey();
    if (!apiKey) throw new Error('BREVO_API_KEY не налаштовано');

    // The single choke point for every email in the codebase — lib/email/resend.ts
    // delegates here too — so the daily cap cannot be bypassed by a new caller
    // forgetting about it.
    if (!quotaReserved) {
        const granted = await reserveEmailQuota(1, kind);
        if (granted < 1) throw new EmailQuotaError(kind);
    }

    const htmlContent = unsubscribe ? withUnsubscribeFooter(html, unsubscribe) : html;

    // Mailbox providers rank a sender partly on how easy leaving is: an
    // unsubscribe header beats a spam complaint, which is what a recipient
    // reaches for when there is no other way out.
    const headers = unsubscribe
        ? {
              'List-Unsubscribe': `<${buildUnsubscribeUrl(unsubscribe)}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined;

    const res = await fetch(`${BREVO_API_URL}/smtp/email`, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            sender: {
                name: fromName || process.env.BREVO_FROM_NAME || 'Touch.Memories',
                email: fromEmail || process.env.BREVO_FROM_EMAIL || 'hello@touchmemories.com.ua',
            },
            to: [{ email: to, name: toName || to }],
            subject,
            htmlContent,
            ...(headers ? { headers } : {}),
            ...((replyTo === undefined ? getReplyTo() : replyTo)
                ? { replyTo: (replyTo === undefined ? getReplyTo() : replyTo) as { email: string; name?: string } }
                : {}),
            ...(attachments && attachments.length
                ? { attachment: attachments.map(a => ({ name: a.name, content: a.content })) }
                : {}),
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Brevo error ${res.status}`);
    }
    return await res.json();
}

// Get subscriber count from Brevo (optional)
export async function getBrevoContactsCount() {
    const apiKey = getBrevoApiKey();
    if (!apiKey) return null;
    const res = await fetch(`${BREVO_API_URL}/contacts`, {
        headers: { 'api-key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.count || null;
}
