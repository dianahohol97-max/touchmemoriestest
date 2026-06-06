// Email transport. Resend has been removed — everything now delivers through
// Brevo (the provider Diana uses). The file/export names are kept so existing
// call sites don't need to change; only the underlying transport switched.
import { sendBrevoEmail, getBrevoApiKey } from './brevo';

const FROM_NAME = process.env.RESEND_FROM_NAME || process.env.BREVO_FROM_NAME || 'TouchMemories';
// Always send from the verified Brevo sender, regardless of any per-call
// "from" address (unverified senders are rejected by Brevo).
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'hello@touchmemories.com.ua';

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    campaignId?: string;
    subscriberId?: string;
    pixelId?: string;
    unsubscribeToken?: string;
}

/**
 * Brevo-backed shim with a Resend-compatible `.emails.send()` surface so the
 * call sites that used the old Resend client keep working unchanged. Accepts
 * `html` or a React Email element via `react`; sends from the verified Brevo
 * sender; returns `{ data, error }` like Resend did.
 */
export function getResendClient() {
    return {
        emails: {
            send: async (opts: { from?: string; to: string | string[]; subject: string; html?: string; react?: any; text?: string; cc?: any; bcc?: any; reply_to?: any; replyTo?: any; attachments?: any }) => {
                try {
                    if (!getBrevoApiKey()) {
                        return { data: null, error: { message: 'Email provider not configured (BREVO_API_KEY/BREVO_API_TOKEN)' } };
                    }
                    let html = opts.html;
                    if (!html && opts.react) {
                        const { render } = await import('@react-email/components');
                        html = await render(opts.react);
                    }
                    // Keep the display name from the call's "from" if present.
                    let fromName = FROM_NAME;
                    if (opts.from) {
                        const m = String(opts.from).match(/^(.*?)<(.+)>$/);
                        if (m && m[1].trim()) fromName = m[1].trim().replace(/^"|"$/g, '');
                    }
                    const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
                    let last: any = null;
                    for (const r of recipients) {
                        last = await sendBrevoEmail({ to: r, subject: opts.subject, html: html || '', fromEmail: BREVO_FROM_EMAIL, fromName });
                    }
                    return { data: last, error: null };
                } catch (error: any) {
                    console.error('Email send failed (Brevo):', error);
                    return { data: null, error };
                }
            },
        },
    };
}

export async function sendEmail({
    to,
    subject,
    html,
    pixelId,
    unsubscribeToken,
}: SendEmailParams) {
    // Base URL for tracking + unsubscribe links.
    const baseUrl = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://touchmemories.com.ua'
    ).replace(/\/$/, '');

    let finalHtml = html;

    // Transparent tracking pixel.
    if (pixelId) {
        const trackingUrl = `${baseUrl}/api/email/track/${pixelId}`;
        const pixelImg = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
        finalHtml = finalHtml.includes('</body>')
            ? finalHtml.replace('</body>', `${pixelImg}</body>`)
            : finalHtml + pixelImg;
    }

    // Unsubscribe footer.
    if (unsubscribeToken) {
        const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe/${unsubscribeToken}`;
        const footer = `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; text-align: center; color: #888; font-size: 12px; font-family: sans-serif;">
                Ви отримали цей лист, оскільки підписалися на новини бренду ${FROM_NAME}.<br/>
                Якщо ви більше не бажаєте отримувати наші листи, ви можете
                <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">відписатися тут</a>.
            </div>
        `;
        finalHtml = finalHtml.includes('</body>')
            ? finalHtml.replace('</body>', `${footer}</body>`)
            : finalHtml + footer;
    }

    if (!getBrevoApiKey()) {
        console.error('Email provider not configured (set BREVO_API_KEY or BREVO_API_TOKEN)');
        return { success: false, error: 'Email provider not configured' };
    }

    try {
        const data = await sendBrevoEmail({ to, subject, html: finalHtml, fromEmail: BREVO_FROM_EMAIL, fromName: FROM_NAME });
        return { success: true, data };
    } catch (error) {
        console.error('Failed to send email via Brevo:', error);
        return { success: false, error };
    }
}
