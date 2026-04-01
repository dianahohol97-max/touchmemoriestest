const BREVO_API_URL = 'https://api.brevo.com/v3';

export function getBrevoApiKey() {
    return process.env.BREVO_API_KEY || '';
}

interface SendEmailParams {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    fromName?: string;
    fromEmail?: string;
}

export async function sendBrevoEmail({ to, toName, subject, html, fromName, fromEmail }: SendEmailParams) {
    const apiKey = getBrevoApiKey();
    if (!apiKey) throw new Error('BREVO_API_KEY не налаштовано');

    const res = await fetch(`${BREVO_API_URL}/smtp/email`, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            sender: {
                name: fromName || 'Touch.Memories',
                email: fromEmail || 'hello@touchmemories.ua',
            },
            to: [{ email: to, name: toName || to }],
            subject,
            htmlContent: html,
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
