import type { Metadata } from 'next';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

const TITLE = 'Для фотографів — Touch.Memories';
const DESCRIPTION = 'Кабінет фотографа Touch.Memories: онлайн-галереї для передачі фото клієнтам, сторінка-візитка з портфоліо, знижка 10% на друк і заробіток з рекомендацій.';

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
 * Two-button chooser (Diana's ask): «Увійти в кабінет» and «Зареєструватися»,
 * each leading to its own path. The moderated application form lives at
 * /photographers/apply; the cabinet entry finds a logged-in photographer's
 * cabinet or walks a guest through login.
 */
const BENEFITS: { title: string; text: string }[] = [
    {
        title: 'Онлайн-галереї для клієнтів',
        text: 'Завантажуйте фото зйомки і надсилайте клієнту особисте посилання з вашим логотипом. Фото зберігаються 30 днів, клієнт забирає їх одним ZIP-архівом, реєстрація йому не потрібна.',
    },
    {
        title: 'Сторінка-візитка з бронюванням',
        text: 'Ваша публічна сторінка з портфоліо, прайсом, контактами і онлайн-записом на зйомку. Оптимізована під пошук Google і може працювати на вашому власному домені.',
    },
    {
        title: 'Знижка 10% на друк',
        text: 'Постійна знижка на фотокниги, глянцеві журнали, фотодрук і тревелбуки для ваших клієнтських проєктів. Вмикається після схвалення заявки з портфоліо.',
    },
    {
        title: 'Заробіток за рекомендації',
        text: 'Діліться особистим посиланням із клієнтами після зйомки. Клієнт отримує знижку 5%, а ви — відсоток з кожного оплаченого замовлення, з виплатою на карту від 500 ₴.',
    },
];

export default function PhotographersPage() {
    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ maxWidth: 920, margin: '0 auto', padding: '48px 16px 80px' }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1e2d7d', margin: '0 0 10px', textAlign: 'center' }}>
                    Кабінет фотографа Touch.Memories
                </h1>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: '#475569', maxWidth: 640, margin: '0 auto 28px', textAlign: 'center' }}>
                    Один кабінет із усім, що потрібно фотографу для роботи з клієнтами: галереї для передачі фото, власна сторінка з портфоліо, знижка 10% на друк і заробіток з рекомендацій.
                </p>

                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 44 }}>
                    <a href="/uk/photographer/cabinet"
                        style={{ display: 'inline-block', minWidth: 220, textAlign: 'center', padding: '16px 28px', background: '#fff', color: '#1e2d7d', border: '2px solid #1e2d7d', borderRadius: 12, fontWeight: 800, fontSize: 16, textDecoration: 'none' }}>
                        Увійти в кабінет
                    </a>
                    <a href="/uk/photographers/apply"
                        style={{ display: 'inline-block', minWidth: 220, textAlign: 'center', padding: '16px 28px', background: '#1e2d7d', color: '#fff', border: '2px solid #1e2d7d', borderRadius: 12, fontWeight: 800, fontSize: 16, textDecoration: 'none' }}>
                        Зареєструватися
                    </a>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {BENEFITS.map(b => (
                        <div key={b.title} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 20px' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>{b.title}</div>
                            <div style={{ fontSize: 14, lineHeight: 1.65, color: '#475569' }}>{b.text}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
