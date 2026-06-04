import { render } from '@react-email/components';
import WelcomeEmail from '@/emails/WelcomeEmail';
import WelcomeSeriesEmail from '@/emails/WelcomeSeriesEmail';
import AbandonedCartEmail from '@/emails/AbandonedCartEmail';
import WinBackEmail from '@/emails/WinBackEmail';
import BirthdayEmail from '@/emails/BirthdayEmail';

export const dynamic = 'force-dynamic';

// Read-only gallery of the automated (code-defined) email templates, rendered
// with sample data so the team can see exactly what each automation sends.
// These are separate from the manual `message_templates` used for campaigns.
export default async function EmailPreviewsPage() {
    const appUrl = 'https://touchmemories.com.ua';

    const previews: Array<{ title: string; when: string; provider: string; html: string }> = [
        {
            title: 'Привітання при підписці',
            when: 'одразу після підписки (popup/футер)',
            provider: 'WELCOME7',
            html: await render(WelcomeEmail({ firstName: 'Іра', promoCode: 'WELCOME7', appUrl })),
        },
        {
            title: 'Привітальна серія — День 2 (ідеї)',
            when: '≈ через 2 дні після підписки',
            provider: '—',
            html: await render(WelcomeSeriesEmail({ firstName: 'Іра', variant: 'ideas', appUrl })),
        },
        {
            title: 'Привітальна серія — День 4 (нагадування про знижку)',
            when: '≈ через 4 дні після підписки',
            provider: 'WELCOME7',
            html: await render(WelcomeSeriesEmail({ firstName: 'Іра', variant: 'reminder', promoCode: 'WELCOME7', discount: '-7%', appUrl })),
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
            })),
        },
        {
            title: 'Win-back (повернення клієнта)',
            when: 'останнє замовлення 60–540 днів тому',
            provider: 'WINBACK10',
            html: await render(WinBackEmail({ firstName: 'Іра', promoCode: 'WINBACK10', discount: '-10%', appUrl })),
        },
        {
            title: 'День народження',
            when: 'у день народження клієнта',
            provider: 'персональний код',
            html: await render(BirthdayEmail({ firstName: 'Іра', promoCode: 'HAPPY-IRA-1234', validUntil: '7 днів', discountValue: '-20%', appUrl })),
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
                            <div style={{ fontWeight: 800, color: '#263A99', fontSize: 16 }}>{p.title}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>
                                Тригер: {p.when}{p.provider !== '—' ? ` · промокод: ${p.provider}` : ''}
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
