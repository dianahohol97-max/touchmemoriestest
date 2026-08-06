const BREVO_API_URL = 'https://api.brevo.com/v3';

export function getBrevoApiKey() {
    return process.env.BREVO_API_KEY || process.env.BREVO_API_TOKEN || '';
}

import { buildUnsubscribeUrl, withUnsubscribeFooter, type UnsubscribeTarget } from './unsubscribe';

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
}

export async function sendBrevoEmail({ to, toName, subject, html, fromName, fromEmail, unsubscribe }: SendEmailParams) {
    const apiKey = getBrevoApiKey();
    if (!apiKey) throw new Error('BREVO_API_KEY не налаштовано');

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
