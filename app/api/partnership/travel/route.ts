import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { applicationGate, PARTNER_CABINET_URL } from '@/lib/partners/application-gate';
import { likeEscape } from '@/lib/supabase/like-escape';
import { sendLoggedEmail } from '@/lib/email/send-logged';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Екранування того, що йде в лист.
 *
 * Форма публічна, а лист із неї читає Діана. Раніше екранувалося лише поле
 * «повідомлення», а назва, контакт, пошта, телефон і сайт підставлялися в HTML
 * як є — причому сайт ще й усередину href="…", де одна лапка ламає атрибут і
 * дозволяє дописати свій. Лист — це не сторінка сайту, але поштові клієнти
 * показують HTML, і довіряти вмісту публічної форми тут немає підстав.
 */
function esc(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Обмеження частоти на IP, тією самою формою, що й у /api/promo/validate.
 * Форма нічим не була захищена взагалі: один скрипт наповнював
 * partnership_requests і поштову скриньку за хвилини, і кожна заявка — це ще
 * два листи через Brevo. Пʼять заявок на годину з адреси — стеля, до якої жодна
 * жива агенція не дійде.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60_000;

function overRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now >= entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT;
}

const MODEL_LABEL: Record<string, string> = {
    gift_certificates: 'Оптові подарункові сертифікати',
    referral: 'Реферальна програма',
    cobranded: 'Co-branded тревелбуки',
    not_sure: 'Ще не визначилися',
};

export async function POST(request: Request) {
    try {
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        if (overRateLimit(ip)) {
            return NextResponse.json(
                { error: 'Забагато заявок. Спробуйте за годину або напишіть нам на пошту.' },
                { status: 429 },
            );
        }

        const body = await request.json();
        // travel_agency (default) | travel_blogger — same referral program,
        // label only. Kept back-compatible: existing callers send no kind.
        const kind = body?.kind === 'travel_blogger' ? 'travel_blogger'
            : body?.kind === 'photographer' ? 'photographer'
            : 'travel_agency';
        const kindLabel = kind === 'travel_blogger' ? 'тревел-блогера'
            : kind === 'photographer' ? 'фотографа'
            : 'тревел-агенції';
        const isBlogger = kind === 'travel_blogger';
        const kindNoun = kind === 'travel_blogger' ? 'тревел-блогер' : kind === 'photographer' ? 'фотограф' : 'тревел-агенція';
        const kindWho = kind === 'travel_blogger' ? 'Блогер' : kind === 'photographer' ? 'Фотограф' : 'Агенція';
        const nameLabel = isBlogger ? 'імʼя / блог' : kind === 'photographer' ? 'імʼя / студію' : 'назву агенції';
        const agencyName = String(body?.agencyName || '').trim();
        const contactName = String(body?.contactName || '').trim();
        const email = String(body?.email || '').trim().toLowerCase();
        const phone = body?.phone ? String(body.phone).trim() : null;
        // Required since 2026-08-04: applications are reviewed by hand, and
        // the site / Instagram / portfolio link is what the review looks at.
        const website = body?.website ? String(body.website).trim() : null;
        if (!website) {
            return NextResponse.json({ error: 'Вкажіть сайт, Instagram або сторінку — заявки розглядаються вручну, і нам потрібно побачити вашу роботу' }, { status: 400 });
        }
        const interestedModel = body?.interestedModel ? String(body.interestedModel) : null;
        const message = body?.message ? String(body.message).trim().slice(0, 2000) : null;

        if (!agencyName || agencyName.length > 200) {
            return NextResponse.json({ error: `Вкажіть ${nameLabel}` }, { status: 400 });
        }
        if (!EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Невірний email' }, { status: 400 });
        }

        const admin = getAdminClient();

        // Друга заявка з тієї самої пошти не створюється, поки партнер
        // активний або попередня заявка ще на розгляді — людині показуємо, що
        // в неї вже є, замість мовчазного дубля (Діана, 16.09.2026).
        // Посилання ведемо на /partner/cabinet, а не на токен: сторінка
        // впускає через вхід в акаунт, тож форма нічого не видає тому, хто
        // просто підставив чужу пошту.
        const [{ data: samePartners }, { data: sameRequests }] = await Promise.all([
            admin.from('agency_partners').select('status').ilike('email', likeEscape(email)),
            admin.from('partnership_requests').select('status').ilike('email', likeEscape(email)),
        ]);
        const gate = applicationGate(samePartners, sameRequests);
        if (!gate.allow) {
            return NextResponse.json({
                error: gate.message,
                code: gate.code,
                cabinetUrl: gate.code === 'active_partner' ? PARTNER_CABINET_URL : null,
            }, { status: 409 });
        }

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
                        <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 16px">Заявка на партнерство (${kindNoun})</h2>
                        <table style="width:100%;font-size:14px;border-collapse:collapse">
                          <tr><td style="padding:6px 0;color:#6b7280;width:130px">${kindWho}:</td><td style="padding:6px 0;font-weight:600">${esc(agencyName)}</td></tr>
                          ${contactName ? `<tr><td style="padding:6px 0;color:#6b7280">Контакт:</td><td style="padding:6px 0">${esc(contactName)}</td></tr>` : ''}
                          <tr><td style="padding:6px 0;color:#6b7280">Email:</td><td style="padding:6px 0">${esc(email)}</td></tr>
                          ${phone ? `<tr><td style="padding:6px 0;color:#6b7280">Телефон:</td><td style="padding:6px 0">${esc(phone)}</td></tr>` : ''}
                          ${/* Сайт лишається текстом, а не посиланням: адресу пише хто завгодно через відкриту форму, і клікабельне посилання в листі від власного магазину виглядає як рекомендація. Скопіювати рядок і відкрити самій — одна зайва дія, і вона того варта. */''}
                          ${website ? `<tr><td style="padding:6px 0;color:#6b7280">Сайт:</td><td style="padding:6px 0">${esc(website)}</td></tr>` : ''}
                          <tr><td style="padding:6px 0;color:#6b7280">Модель:</td><td style="padding:6px 0">${esc(modelLabel)}</td></tr>
                          ${message ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Повідомлення:</td><td style="padding:6px 0">${esc(message)}</td></tr>` : ''}
                        </table>
                      </div>
                    </div>`,
                fromName: 'Touch.Memories',
                fromEmail: 'hello@touchmemories.com.ua',
            });
            // Confirm to agency
            await sendLoggedEmail({
                to: email,
                toName: contactName || agencyName,
                subject: 'Дякуємо за інтерес до співпраці!',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                      <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
                      <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:22px;margin:0 0 12px">Дякуємо, ${esc(contactName || agencyName)}!</h2>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 14px">Ми отримали вашу заявку на партнерство. Наша команда звʼяжеться з вами найближчим часом, щоб обговорити деталі співпраці та підібрати найкращу модель для вашої агенції.</p>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0">До зустрічі! 🌍<br>Команда Touch.Memories</p>
                      </div>
                    </div>`,
                fromName: 'Touch.Memories',
                fromEmail: 'hello@touchmemories.com.ua',
            }, { template: 'partnership_application_received' });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[partnership/travel]', err);
        return NextResponse.json({ error: err.message || 'Помилка' }, { status: 500 });
    }
}
