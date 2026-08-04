import type { Metadata } from 'next';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
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
 * Two-button chooser mirroring /travel-agencies and /wedding-agencies: blue
 * gradient hero (Diana's call — «зроби синій назад» after a cream version),
 * white cards on Soft White below, Montserrat headings + Open Sans body via
 * the site's --font-heading / --font-body vars.
 */
const BENEFITS: { n: string; title: string; text: string }[] = [
    {
        n: '01',
        title: 'Онлайн-галереї для клієнтів',
        text: 'Завантажуйте фото зйомки і надсилайте клієнту особисте посилання з вашим логотипом. Фото зберігаються 30 днів, клієнт забирає їх одним ZIP-архівом, реєстрація йому не потрібна.',
    },
    {
        n: '02',
        title: 'Сторінка-візитка з бронюванням',
        text: 'Ваша публічна сторінка з портфоліо, прайсом, контактами і онлайн-записом на зйомку. Оптимізована під пошук Google і може працювати на вашому власному домені.',
    },
    {
        n: '03',
        title: 'Знижка 10% на друк',
        text: 'Постійна знижка на фотокниги, глянцеві журнали, фотодрук і тревелбуки для ваших клієнтських проєктів. Вмикається після схвалення заявки з портфоліо.',
    },
    {
        n: '04',
        title: 'Заробіток за рекомендації',
        text: 'Діліться особистим посиланням із клієнтами після зйомки. Клієнт отримує знижку 5%, а ви — відсоток з кожного оплаченого замовлення, з виплатою на карту від 500 ₴.',
    },
];

export default function PhotographersPage() {
    return (
        <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: 110 }}>
                {/* Blue gradient hero — Diana's call («зроби синій назад»),
                    matching the /travel-agencies hero exactly. */}
                <section style={{ background: 'linear-gradient(135deg, #263A99 0%, #1a2a73 100%)', padding: '64px 16px 72px', color: '#fff' }}>
                    <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13, marginBottom: 20 }}>
                            Партнерська програма
                        </div>
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 42, lineHeight: 1.1, margin: '0 0 16px' }}>
                            Кабінет фотографа
                        </h1>
                        <p style={{ fontSize: 16.5, lineHeight: 1.7, opacity: 0.9, maxWidth: 600, margin: '0 auto 32px' }}>
                            Один кабінет із усім, що потрібно для роботи з клієнтами: галереї для передачі фото, власна сторінка з портфоліо, знижка 10% на друк і заробіток з рекомендацій.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <a href="/uk/photographers/apply"
                                style={{ display: 'inline-block', minWidth: 210, textAlign: 'center', padding: '15px 30px', background: '#fff', color: '#263A99', borderRadius: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                                Зареєструватися
                            </a>
                            <a href="/uk/photographer/cabinet"
                                style={{ display: 'inline-block', minWidth: 210, textAlign: 'center', padding: '15px 30px', background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.7)', borderRadius: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                                Увійти в кабінет
                            </a>
                        </div>
                        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 16 }}>
                            Реєстрація — це коротка заявка з портфоліо, яку ми розглядаємо вручну.
                        </p>
                    </div>
                </section>

                {/* Benefits — Sand-numbered cards, one row on desktop */}
                <section style={{ padding: '56px 16px 80px' }}>
                    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                            {BENEFITS.map(b => (
                                <div key={b.n} style={{ background: '#FFFFFF', border: '1px solid #E8DCC8', borderRadius: 16, padding: '26px 22px' }}>
                                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 34, color: '#263A99', lineHeight: 1, marginBottom: 14 }}>{b.n}</div>
                                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: '#1A1A1A', marginBottom: 8 }}>{b.title}</div>
                                    <div style={{ fontSize: 13.5, lineHeight: 1.65, color: '#8B8378' }}>{b.text}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
