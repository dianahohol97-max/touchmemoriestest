import type { Metadata } from 'next';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';
import SignupForm from '../gallery-for-photographers/SignupForm';

const TITLE = 'Для фотографів — Touch.Memories';
const DESCRIPTION = 'Кабінет фотографа Touch.Memories: знижка 10% на друк, онлайн-галереї для передачі фото клієнтам, сторінка-візитка з портфоліо та реферальний заробіток з замовлень ваших клієнтів.';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    return {
        title: TITLE,
        description: DESCRIPTION,
        alternates: {
            canonical: getCanonicalUrl(locale, '/photographers'),
            languages: getAlternateLanguages('/photographers'),
        },
        openGraph: {
            title: TITLE,
            description: DESCRIPTION,
            url: getCanonicalUrl(locale, '/photographers'),
            siteName: 'Touch.Memories',
            locale: OG_LOCALE_MAP[locale],
            type: 'website',
        },
    };
}

/**
 * The photographer offer page. Until 2026-08-04 this rendered the moderated
 * B2B application (B2bRegisterPage) whose only prize was the 10% discount.
 * The cabinet now INCLUDES that discount automatically — plus galleries, the
 * landing page and the referral program — so the application step is obsolete
 * for photographers and this page signs them up directly, no moderation.
 * Wedding agencies still use B2bRegisterPage at /wedding-agencies.
 */
const BENEFITS: { title: string; text: string }[] = [
    {
        title: 'Знижка 10% на друк',
        text: 'Постійна знижка на фотокниги, глянцеві журнали, фотодрук і тревелбуки вмикається одразу після реєстрації. Замовляйте клієнтські проєкти зі свого акаунта — ціна в каталозі й кошику перераховується автоматично.',
    },
    {
        title: 'Онлайн-галереї для клієнтів',
        text: 'Завантажуйте фото зйомки і надсилайте клієнту особисте посилання з вашим логотипом. Фото зберігаються 30 днів, клієнт забирає їх одним ZIP-архівом або поштучно, реєстрація йому не потрібна.',
    },
    {
        title: 'Сторінка-візитка з бронюванням',
        text: 'Ваша публічна сторінка з портфоліо, прайсом, контактами і онлайн-записом на зйомку. Оптимізована під пошук Google і може працювати на вашому власному домені.',
    },
    {
        title: 'Заробіток за рекомендації',
        text: 'Діліться особистим посиланням із клієнтами після зйомки. Клієнт отримує знижку 5% на замовлення фотопродукції, а ви — відсоток з кожного оплаченого замовлення за вашим кодом, з виплатою на карту від 500 ₴.',
    },
];

export default function PhotographersPage() {
    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ maxWidth: 920, margin: '0 auto', padding: '48px 16px 80px' }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1e2d7d', margin: '0 0 10px', textAlign: 'center' }}>
                    Кабінет фотографа Touch.Memories
                </h1>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: '#475569', maxWidth: 640, margin: '0 auto 36px', textAlign: 'center' }}>
                    Один безкоштовний кабінет із усім, що потрібно фотографу для роботи з клієнтами: галереї для передачі фото, власна сторінка з портфоліо, знижка 10% на друк і заробіток з рекомендацій. Реєстрація за хвилину, без заявок і модерації.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 44 }}>
                    {BENEFITS.map(b => (
                        <div key={b.title} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 20px' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>{b.title}</div>
                            <div style={{ fontSize: 14, lineHeight: 1.65, color: '#475569' }}>{b.text}</div>
                        </div>
                    ))}
                </div>

                <div id="signup" style={{ maxWidth: 480, margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '30px 26px', textAlign: 'center' }}>
                    <h2 style={{ fontSize: 21, fontWeight: 800, color: '#1e2d7d', margin: '0 0 6px' }}>Створити кабінет</h2>
                    <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 8px', lineHeight: 1.6 }}>
                        Потрібні лише імʼя, пошта і пароль. Кабінет і знижка активуються одразу.
                    </p>
                    <SignupForm locale="uk" />
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '16px 0 0' }}>
                        Вже маєте кабінет фотографа? <a href="/uk/photographer/cabinet" style={{ color: '#1e2d7d', fontWeight: 700 }}>Увійти →</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
