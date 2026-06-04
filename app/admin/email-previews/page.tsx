import { render } from '@react-email/components';
import WelcomeEmail from '@/emails/WelcomeEmail';
import WelcomeSeriesEmail from '@/emails/WelcomeSeriesEmail';
import AbandonedCartEmail from '@/emails/AbandonedCartEmail';
import WinBackEmail from '@/emails/WinBackEmail';
import BirthdayEmail from '@/emails/BirthdayEmail';
import { getAdminClient } from '@/lib/supabase/admin';
import OrderPaidEmail from '@/components/email/OrderPaidEmail';

export const dynamic = 'force-dynamic';

// Read-only gallery of the automated (code-defined) email templates, rendered
// with sample data so the team can see exactly what each automation sends.
// These are separate from the manual `message_templates` used for campaigns.
export default async function EmailPreviewsPage() {
    const appUrl = 'https://touchmemories.com.ua';

    // Reflect admin edits: pull overrides from the automation_emails config.
    const supabase = getAdminClient();
    const { data: cfgRows } = await supabase
        .from('automation_emails')
        .select('key, enabled, subject, body, promo_code');
    const cfg = new Map<string, { enabled: boolean; subject: string | null; body: string | null; promo_code: string | null }>();
    for (const r of (cfgRows as any[]) || []) cfg.set(r.key, r);
    const bodyOf = (k: string) => cfg.get(k)?.body || undefined;
    const promoOf = (k: string, fallback: string) => cfg.get(k)?.promo_code || fallback;
    const subjOf = (k: string) => cfg.get(k)?.subject || '';
    const enabledOf = (k: string) => cfg.get(k)?.enabled !== false;

    const previews: Array<{ title: string; when: string; provider: string; html: string; enabled?: boolean; subject?: string }> = [
        {
            title: 'Привітання при підписці',
            when: 'одразу після підписки (popup/футер)',
            provider: promoOf('welcome', 'WELCOME7'),
            enabled: enabledOf('welcome'),
            subject: subjOf('welcome'),
            html: await render(WelcomeEmail({ firstName: 'Іра', promoCode: promoOf('welcome', 'WELCOME7'), appUrl, body: bodyOf('welcome') })),
        },
        {
            title: 'Привітальна серія — День 2 (ідеї)',
            when: '≈ через 2 дні після підписки',
            provider: '—',
            enabled: enabledOf('welcome_step2'),
            subject: subjOf('welcome_step2'),
            html: await render(WelcomeSeriesEmail({ firstName: 'Іра', variant: 'ideas', appUrl, body: bodyOf('welcome_step2') })),
        },
        {
            title: 'Привітальна серія — День 4 (нагадування про знижку)',
            when: '≈ через 4 дні після підписки',
            provider: promoOf('welcome_step3', 'WELCOME7'),
            enabled: enabledOf('welcome_step3'),
            subject: subjOf('welcome_step3'),
            html: await render(WelcomeSeriesEmail({ firstName: 'Іра', variant: 'reminder', promoCode: promoOf('welcome_step3', 'WELCOME7'), discount: '-7%', appUrl, body: bodyOf('welcome_step3') })),
        },
        {
            title: 'Кинутий кошик',
            when: 'кошик «висить» 4–72 год без замовлення',
            provider: '—',
            html: await render(AbandonedCartEmail({
                firstName: 'Іра',
                items: [
                    { name: 'Фотокнига 25×25', qty: 1, price: 850 },
                    { name: 'Постер A2', qty: 2, price: 300 },
                ],
                total: 1450,
                currency: 'UAH',
                appUrl,
                body: bodyOf('abandoned_cart'),
            })),
            enabled: enabledOf('abandoned_cart'),
            subject: subjOf('abandoned_cart'),
        },
        {
            title: 'Win-back (повернення клієнта)',
            when: 'останнє замовлення 60–540 днів тому',
            provider: promoOf('winback', 'WINBACK10'),
            enabled: enabledOf('winback'),
            subject: subjOf('winback'),
            html: await render(WinBackEmail({ firstName: 'Іра', promoCode: promoOf('winback', 'WINBACK10'), discount: '-10%', appUrl, body: bodyOf('winback') })),
        },
        {
            title: 'День народження',
            when: 'у день народження клієнта',
            provider: 'персональний код',
            enabled: enabledOf('birthday'),
            subject: subjOf('birthday'),
            html: await render(BirthdayEmail({ firstName: 'Іра', promoCode: 'HAPPY-IRA-1234', validUntil: '7 днів', discountValue: '-20%', appUrl, body: bodyOf('birthday') })),
        },
        {
            title: 'Оплату отримано — повна оплата',
            when: 'Monobank підтвердив повну оплату',
            provider: '—',
            html: await render(OrderPaidEmail({ orderNumber: 'PB-2026-0042', customerName: 'Іра', variant: 'full', paidAmount: 1450, total: 1450 })),
        },
        {
            title: 'Передоплату отримано — 50% (split)',
            when: 'Monobank підтвердив передоплату',
            provider: '—',
            html: await render(OrderPaidEmail({ orderNumber: 'PB-2026-0043', customerName: 'Іра', variant: 'prepayment', paidAmount: 725, remainingAmount: 725, total: 1450 })),
        },
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 4px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#263A99', marginBottom: 6 }}>Шаблони листів (автоматичні)</h1>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 8, lineHeight: 1.5 }}>
                Це листи, які система надсилає автоматично. Вони задані в коді й показані тут із прикладовими даними.
                Усі йдуть через Brevo від <strong>touch.memories3@gmail.com</strong>.
            </p>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Окремо: нагадування про незавершений дизайн у конструкторі (24 год / 10 / 55 / 59 днів) задане прямо в кроні
                <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, margin: '0 4px' }}>design-lifecycle</code>
                і поки не показане тут. Ручні шаблони для кампаній — у розділі «Email Розсилка».
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {previews.map((p) => (
                    <div key={p.title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 800, color: '#263A99', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {p.title}
                                {p.enabled === false && (
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c', background: '#fee2e2', padding: '2px 8px', borderRadius: 999 }}>ВИМКНЕНО</span>
                                )}
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>
                                Тригер: {p.when}{p.provider !== '—' ? ` · промокод: ${p.provider}` : ''}
                                {p.subject ? <><br />Тема: «{p.subject}»</> : null}
                            </div>
                        </div>
                        <iframe
                            srcDoc={p.html}
                            title={p.title}
                            style={{ width: '100%', height: 640, border: 'none', background: '#fffbeb', display: 'block' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
