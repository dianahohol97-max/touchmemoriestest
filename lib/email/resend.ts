import { Resend } from 'resend';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'hello@touchmemories.ua';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'TouchMemories';

/**
 * Lazy initialization of Resend client to prevent build-time errors
 * when environment variables are not available.
 */
export function getResendClient() {
    return new Resend(process.env.RESEND_API_KEY || 're_mock_key');
}

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    campaignId?: string;
    subscriberId?: string;
    pixelId?: string;
    unsubscribeToken?: string;
}

export async function sendEmail({
    to,
    subject,
    html,
    campaignId,
    subscriberId,
    pixelId,
    unsubscribeToken
}: SendEmailParams) {
    const resend = getResendClient();

    // 1. Base URL for tracking + unsubscribe links. Prefer the canonical
    // NEXT_PUBLIC_SITE_URL (the var the rest of the app uses); fall back to the
    // legacy NEXT_PUBLIC_APP_URL if it's the only one set, then the real domain.
    // Never localhost here — these URLs go out in real customer emails.
    const baseUrl = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://touchmemories.com.ua'
    ).replace(/\/$/, '');

    // 2. Inject transparent Tracking Pixel if pixelId is provided
    let finalHtml = html;
    if (pixelId) {
        const trackingUrl = `${baseUrl}/api/email/track/${pixelId}`;
        const pixelImg = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;

        // Inject before closing body tag if exists, otherwise append
        if (finalHtml.includes('</body>')) {
            finalHtml = finalHtml.replace('</body>', `${pixelImg}</body>`);
        } else {
            finalHtml += pixelImg;
        }
    }

    // 3. Inject Unsubscribe Footer if unsubscribeToken is provided
    if (unsubscribeToken) {
        const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe/${unsubscribeToken}`;
        const footer = `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; text-align: center; color: #888; font-size: 12px; font-family: sans-serif;">
                Ви отримали цей лист, оскільки підписалися на новини бренду ${FROM_NAME}.<br/>
                Якщо ви більше не бажаєте отримувати наші листи, ви можете 
                <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">відписатися тут</a>.
            </div>
        `;

        if (finalHtml.includes('</body>')) {
            finalHtml = finalHtml.replace('</body>', `${footer}</body>`);
        } else {
            finalHtml += footer;
        }
    }

    // 4. Send via Resend
    try {
        const data = await resend.emails.send({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to,
            subject,
            html: finalHtml,
        });

        return { success: true, data };
    } catch (error) {
        console.error('Failed to send email:', error);
        return { success: false, error };
    }
}
