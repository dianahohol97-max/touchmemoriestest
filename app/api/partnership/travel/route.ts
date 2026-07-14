import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODEL_LABEL: Record<string, string> = {
    gift_certificates: 'Оптові подарункові сертифікати',
    referral: 'Реферальна програма',
    cobranded: 'Co-branded тревелбуки',
    not_sure: 'Ще не визначилися',
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // travel_agency (default) | travel_blogger — same referral program,
        // label only. Kept back-compatible: existing callers send no kind.
        const kind = body?.kind === 'travel_blogger' ? 'travel_blogger' : 'travel_agency';
        const isBlogger = kind === 'travel_blogger';
        const kindLabel = isBlogger ? 'тревел-блогера' : 'тревел-агенції';
        const nameLabel = isBlogger ? 'імʼя / блог' : 'назву агенції';
        const agencyName = String(body?.agencyName || '').trim();
        const contactName = String(body?.contactName || '').trim();
        const email = String(body?.email || '').trim().toLowerCase();
        const phone = body?.phone ? String(body.phone).trim() : null;
        const website = body?.website ? String(body.website).trim() : null;
        const interestedModel = body?.interestedModel ? String(body.interestedModel) : null;
        const message = body?.message ? String(body.message).trim().slice(0, 2000) : null;

        if (!agencyName || agencyName.length > 200) {
            return NextResponse.json({ error: `Вкажіть ${nameLabel}` }, { status: 400 });
        }
        if (!EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Невірний email' }, { status: 400 });
        }

        const admin = getAdminClient();
        await admin.from('partnership_requests').insert({
            kind,
            agency_name: agencyName,
            contact_name: contactName || null,
            email,
            phone,
            website,
            interested_model: interestedModel,
            message,
            status: 'new',
        });

        if (getBrevoApiKey()) {
            const modelLabel = interestedModel ? (MODEL_LABEL[interestedModel] || interestedModel) : '—';
            // Notify admin
            await sendBrevoEmail({
                to: 'touch.memories3@gmail.com',
                toName: 'Touch.Memories',
                subject: `Нова заявка від ${kindLabel}: ${agencyName}`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                      <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
                      <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 16px">Заявка на партнерство (${isBlogger ? 'тревел-блогер' : 'тревел-агенція'})</h2>
                        <table style="width:100%;font-size:14px;border-collapse:collapse">
                          <tr><td style="padding:6px 0;color:#6b7280;width:130px">${isBlogger ? 'Блогер' : 'Агенція'}:</td><td style="padding:6px 0;font-weight:600">${agencyName}</td></tr>
                          ${contactName ? `<tr><td style="padding:6px 0;color:#6b7280">Контакт:</td><td style="padding:6px 0">${contactName}</td></tr>` : ''}
                          <tr><td style="padding:6px 0;color:#6b7280">Email:</td><td style="padding:6px 0">${email}</td></tr>
                          ${phone ? `<tr><td style="padding:6px 0;color:#6b7280">Телефон:</td><td style="padding:6px 0">${phone}</td></tr>` : ''}
                          ${website ? `<tr><td style="padding:6px 0;color:#6b7280">Сайт:</td><td style="padding:6px 0"><a href="${website}" style="color:#1e2d7d">${website}</a></td></tr>` : ''}
                          <tr><td style="padding:6px 0;color:#6b7280">Модель:</td><td style="padding:6px 0">${modelLabel}</td></tr>
                          ${message ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Повідомлення:</td><td style="padding:6px 0">${message.replace(/</g, '&lt;')}</td></tr>` : ''}
                        </table>
                      </div>
                    </div>`,
                fromName: 'Touch.Memories',
                fromEmail: 'hello@touchmemories.com.ua',
            });
            // Confirm to agency
            await sendBrevoEmail({
                to: email,
                toName: contactName || agencyName,
                subject: 'Дякуємо за інтерес до співпраці!',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                      <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
                      <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:22px;margin:0 0 12px">Дякуємо, ${contactName || agencyName}!</h2>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 14px">Ми отримали вашу заявку на партнерство. Наша команда звʼяжеться з вами найближчим часом, щоб обговорити деталі співпраці та підібрати найкращу модель для вашої агенції.</p>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0">До зустрічі! 🌍<br>Команда Touch.Memories</p>
                      </div>
                    </div>`,
                fromName: 'Touch.Memories',
                fromEmail: 'hello@touchmemories.com.ua',
            });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[partnership/travel]', err);
        return NextResponse.json({ error: err.message || 'Помилка' }, { status: 500 });
    }
}
