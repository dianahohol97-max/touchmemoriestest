import { render } from '@react-email/components';
import WelcomeEmail from '@/emails/WelcomeEmail';
import WelcomeSeriesEmail from '@/emails/WelcomeSeriesEmail';
import AbandonedCartEmail from '@/emails/AbandonedCartEmail';
import WinBackEmail from '@/emails/WinBackEmail';
import BirthdayEmail from '@/emails/BirthdayEmail';
import { getAdminClient } from '@/lib/supabase/admin';
import OrderPaidEmail from '@/components/email/OrderPaidEmail';
import OrderPlacedEmail from '@/components/email/OrderPlacedEmail';
import OrderShippedEmail from '@/components/email/OrderShippedEmail';
import { buildLifecycleEmail, type LifecycleStage } from '@/lib/email/lifecycle-template';

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
    const subTok = (t: string | null | undefined, orderNo: string) =>
        (t || '').replace(/\{order\}/g, orderNo).replace(/\{name\}/g, 'Іра');
    const bodyTok = (k: string, orderNo: string) => {
        const b = cfg.get(k)?.body;
        return b ? subTok(b, orderNo) : undefined;
    };

    const lc = (s: LifecycleStage) => buildLifecycleEmail(s, 'Фотокнига A4', 'demo-project', appUrl);

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
            title: 'Незавершений дизайн — 1-ше нагадування',
            when: '≈ через 24 години після збереження дизайну в конструкторі',
            provider: 'design-lifecycle',
            subject: lc('24h').subject,
            html: lc('24h').html,
        },
        {
            title: 'Незавершений дизайн — 2-ге нагадування',
            when: '≈ через 10 днів після збереження',
            provider: 'design-lifecycle',
            subject: lc('10d').subject,
            html: lc('10d').html,
        },
        {
            title: 'Незавершений дизайн — видалення через 5 днів',
            when: '≈ через 55 днів (попередження про видалення)',
            provider: 'design-lifecycle',
            subject: lc('55d').subject,
            html: lc('55d').html,
        },
        {
            title: 'Незавершений дизайн — останній шанс (24 год до видалення)',
            when: '≈ через 59 днів (фінальне попередження)',
            provider: 'design-lifecycle',
            subject: lc('59d').subject,
            html: lc('59d').html,
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
            provider: promoOf('winback', 'WINBACK7'),
            enabled: enabledOf('winback'),
            subject: subjOf('winback'),
            html: await render(WinBackEmail({ firstName: 'Іра', promoCode: promoOf('winback', 'WINBACK7'), discount: '-7%', appUrl, body: bodyOf('winback') })),
        },
        {
            title: 'День народження',
            when: 'у день народження клієнта',
            provider: 'персональний код',
            enabled: enabledOf('birthday'),
            subject: subjOf('birthday'),
            html: await render(BirthdayEmail({ firstName: 'Іра', promoCode: 'HAPPY-IRA-1234', validUntil: '7 днів', discountValue: '-7%', appUrl, body: bodyOf('birthday') })),
        },
        {
            title: 'Оплату отримано — повна оплата',
            when: 'Monobank підтвердив повну оплату',
            provider: '—',
            enabled: enabledOf('order_paid_full'),
            subject: subTok(subjOf('order_paid_full'), 'PB-2026-0042'),
            html: await render(OrderPaidEmail({ orderNumber: 'PB-2026-0042', customerName: 'Іра', variant: 'full', paidAmount: 1450, total: 1450, body: bodyTok('order_paid_full', 'PB-2026-0042') })),
        },
        {
            title: 'Передоплату отримано — 50% (split)',
            when: 'Monobank підтвердив передоплату',
            provider: '—',
            enabled: enabledOf('order_paid_prepayment'),
            subject: subTok(subjOf('order_paid_prepayment'), 'PB-2026-0043'),
            html: await render(OrderPaidEmail({ orderNumber: 'PB-2026-0043', customerName: 'Іра', variant: 'prepayment', paidAmount: 725, remainingAmount: 725, total: 1450, body: bodyTok('order_paid_prepayment', 'PB-2026-0043') })),
        },
        {
            title: 'Замовлення прийнято',
            when: 'одразу після оформлення',
            provider: '—',
            enabled: enabledOf('order_placed'),
            subject: subTok(subjOf('order_placed'), 'PB-2026-0042'),
            html: await render(OrderPlacedEmail({
                orderNumber: 'PB-2026-0042',
                customerName: 'Іра',
                items: [
                    { name: 'Фотокнига 25×25', qty: 1, price: 850 },
                    { name: 'Постер A2', qty: 2, price: 300 },
                ],
                totals: { subtotal: 1450, delivery: 0, total: 1450 },
                deliveryAddress: 'Нова Пошта, Київ, Відділення №1',
                body: bodyTok('order_placed', 'PB-2026-0042'),
            })),
        },
        {
            title: 'Відправлено (з ТТН та −7% за відмітку)',
            when: 'при створенні ТТН',
            provider: '−7% @touch.memories',
            enabled: enabledOf('order_shipped'),
            subject: subTok(subjOf('order_shipped'), 'PB-2026-0042'),
            html: await render(OrderShippedEmail({
                orderNumber: 'PB-2026-0042',
                customerName: 'Іра',
                ttn: '20451200000000',
                deliveryMethod: 'Нова Пошта (Відділення)',
                deliveryAddress: 'Київ, Відділення №1',
                body: bodyTok('order_shipped', 'PB-2026-0042'),
            })),
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
                Нагадування про незавершений дизайн у конструкторі (24 год / 10 / 55 / 59 днів) надсилає крон
                <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, margin: '0 4px' }}>design-lifecycle</code>
                — усі чотири етапи показані вище. Ручні шаблони для кампаній — у розділі «Email Розсилка».
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
                            style={{ width: '100%', height: 640, border: 'none', background: '#f1f5f9', display: 'block' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
