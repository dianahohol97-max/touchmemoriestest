import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { logOutgoingEmail, readSendOutcome, sendOutcomeFromError, htmlToTextSnapshot } from '@/lib/email/log-outgoing';

/**
 * Shared gift-certificate email sender (Brevo).
 *
 * Used by both the admin "send certificate" action and the automatic
 * on-payment issuance flow, so the email template stays in one place.
 *
 * ЧОМУ ЧЕРЕЗ sendBrevoEmail, А НЕ fetch НАПРЯМУ. До 16.09.2026 цей файл сам
 * стукав в API Brevo, і через це обходив резервування денної квоти, яке живе
 * всередині sendBrevoEmail. Сертифікатні листи витрачали ліміт тарифу, не
 * зменшуючи наш власний бюджет, — а в день великої розсилки це означає, що
 * транзакційний лист про оплату може не піти зовсім (Діана, 16.09.2026).
 */

export interface CertificateEmailParams {
    code: string;
    amount: number;
    recipient_email: string;
    recipient_name?: string;
    sender_name?: string;
    message?: string;
    expires_at?: string | Date | null;
}

export async function sendCertificateEmail(
    params: CertificateEmailParams
): Promise<{ ok: true } | { ok: false; error: string }> {
    const { code, amount, recipient_email, recipient_name, sender_name, message, expires_at } = params;

    if (!recipient_email) return { ok: false, error: 'No recipient email' };

    if (!getBrevoApiKey()) return { ok: false, error: 'BREVO_API_KEY not configured' };

    const expiryStr = expires_at
        ? new Date(expires_at).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'без обмежень';

    const html = `
<div style="font-family:'Montserrat',sans-serif;max-width:540px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#263A99,#1a2d7a);padding:40px 32px;text-align:center">
    <h1 style="color:white;margin:0;font-size:24px;font-weight:900;letter-spacing:0.05em">Touch.Memories</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Подарунковий сертифікат</p>
  </div>
  <div style="padding:40px 32px">
    ${recipient_name ? `<p style="font-size:18px;font-weight:700;color:#374151;margin:0 0 8px">Вітаємо, ${recipient_name}! </p>` : ''}
    ${sender_name ? `<p style="color:#64748b;margin:0 0 24px;font-size:14px">Від: <strong>${sender_name}</strong></p>` : ''}
    ${message ? `<div style="background:#f0f4ff;border-left:4px solid #263A99;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;font-style:italic;color:#374151">"${message}"</div>` : ''}

    <div style="background:linear-gradient(135deg,#f0f4ff,#e8ecff);border:2px dashed #263A99;border-radius:12px;padding:32px;text-align:center;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em">Код сертифікату</p>
      <p style="font-size:32px;font-weight:900;color:#263A99;letter-spacing:0.15em;margin:8px 0">${code}</p>
      <p style="font-size:28px;font-weight:800;color:#1a2d7a;margin:0">${amount} грн</p>
    </div>

    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0;font-size:13px;color:#64748b">
         Дійсний до: <strong style="color:#374151">${expiryStr}</strong>
      </p>
    </div>

    <a href="https://touchmemories.com.ua" style="display:block;text-align:center;padding:16px;background:#263A99;color:white;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
      Використати сертифікат →
    </a>
  </div>
  <div style="padding:20px 32px;background:#f8fafc;text-align:center;border-top:1px solid #f1f5f9">
    <p style="margin:0;font-size:12px;color:#94a3b8">Touch.Memories · Тернопіль · touchmemories.com.ua</p>
  </div>
</div>`;

    const subject = ` Ваш подарунковий сертифікат Touch.Memories на ${amount} грн`;

    let outcome;
    try {
        outcome = readSendOutcome(await sendBrevoEmail({
            to: recipient_email,
            toName: recipient_name || '',
            subject,
            html,
        }));
    } catch (err: any) {
        outcome = sendOutcomeFromError(err);
    }

    await logOutgoingEmail({
        orderId: null,
        to: recipient_email,
        template: 'certificate',
        subject,
        body: htmlToTextSnapshot(html),
        outcome,
    });

    return outcome.sent ? { ok: true } : { ok: false, error: outcome.error || 'Brevo request failed' };
}
