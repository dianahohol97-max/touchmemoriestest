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
// The fixed client token of the demo gallery seeded by
// /api/photographers/demo-seed — the page embeds the REAL client gallery.
const DEMO_GALLERY_TOKEN = 'a0000000-0000-4000-8000-000000000001';

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
                        {/* explicit #fff — globals.css h1 { color: var(--primary) } beats inheritance */}
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 42, lineHeight: 1.1, color: '#fff', margin: '0 0 16px' }}>
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
                <section style={{ padding: '56px 16px 56px' }}>
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

                {/* Live demo gallery — the real client page (seeded via
                    /api/photographers/demo-seed) embedded scaled-down, so a
                    photographer sees the product before registering. */}
                <section style={{ padding: '0 16px 80px' }}>
                    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, color: '#1A1A1A', textAlign: 'center', margin: '0 0 10px' }}>
                            Подивіться, як галерею побачить ваш клієнт
                        </h2>
                        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#8B8378', textAlign: 'center', maxWidth: 640, margin: '0 auto 24px' }}>
                            Нижче — жива демо-галерея з прикладами фото. У кабінеті до кожної галереї є конструктор дизайну: ви обираєте колір фону, шрифт і його розмір, один із чотирьох варіантів обкладинки та мову галереї — і одразу бачите результат у превʼю.
                        </p>
                        <div style={{ background: '#FFFFFF', border: '1px solid #E8DCC8', borderRadius: 16, overflow: 'hidden' }}>
                            <div style={{ height: 520, overflow: 'hidden' }}>
                                <iframe
                                    src={`/uk/gallery/${DEMO_GALLERY_TOKEN}`}
                                    title="Демо-галерея"
                                    style={{ width: '200%', height: '200%', border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left', pointerEvents: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px', borderTop: '1px solid #F0EAE0' }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {['3 кольори фону', '4 шрифти', '4 обкладинки', '9 мов', 'фото і відео'].map(chip => (
                                        <span key={chip} style={{ fontSize: 12.5, color: '#8B8378', border: '1px solid #E8DCC8', borderRadius: 999, padding: '5px 12px' }}>{chip}</span>
                                    ))}
                                </div>
                                <a href={`/uk/gallery/${DEMO_GALLERY_TOKEN}`} target="_blank"
                                    style={{ display: 'inline-block', background: '#263A99', color: '#fff', borderRadius: 10, padding: '11px 22px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                                    Відкрити демо-галерею
                                </a>
                            </div>
                        </div>
                        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#8B8378', textAlign: 'center', maxWidth: 640, margin: '20px auto 0' }}>
                            Кабінет, галереї та сторінка-візитка — безкоштовні. Постійна знижка 10% на друк і заробіток з рекомендацій вмикаються після схвалення вашої заявки з портфоліо.
                        </p>
                    </div>
                </section>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
