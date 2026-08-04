import type { Metadata } from 'next';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';
import { getAdminClient } from '@/lib/supabase/admin';
import { fileUrl } from '@/lib/photographers/storage';
import { GALLERY_PLANS } from '@/lib/photographers/plans';
import { serializeJsonLd } from '@/lib/seo/jsonld';

// Title targets what photographers actually search for — "галерея для
// фотографів", "передати фото клієнту" — not just the brand.
const TITLE = 'Онлайн-галереї для фотографів — передати фото клієнту | Touch.Memories';
const DESCRIPTION =
    'Кабінет фотографа Touch.Memories: онлайн-галереї для передачі фото клієнтам без реєстрації, '
    + 'конструктор дизайну галереї, десять мов, відео, знижка 10% на друк і заробіток з рекомендацій. '
    + 'Безкоштовний тариф на 4 ГБ, платні — від 149 грн на місяць.';

// Single source for the visible FAQ and the FAQPage schema: Google requires
// the answers in the markup to match the structured data exactly.
const FAQ: { q: string; a: string }[] = [
    {
        q: 'Скільки коштує кабінет фотографа?',
        a: 'Кабінет, галереї та конструктор дизайну безкоштовні на тарифі з 4 ГБ місця. Далі тарифи починаються від 149 гривень на місяць за 50 ГБ, і оплата йде карткою просто в кабінеті.',
    },
    {
        q: 'Як клієнт отримує свої фото?',
        a: 'Ви надсилаєте йому особисте посилання на галерею. Реєстрація клієнту не потрібна: він відкриває сторінку, переглядає знімки, качає окремі фото або весь архів одним файлом.',
    },
    {
        q: 'Скільки зберігаються фото в галереї?',
        a: 'Термін ви обираєте самі при створенні галереї: тридцять, шістдесят або девʼяносто днів. Після завершення терміну файли видаляються автоматично, а клієнт бачить сторінку з вашими контактами.',
    },
    {
        q: 'Чи можна змінити вигляд галереї?',
        a: 'Так, у кабінеті є конструктор: колір фону, шрифт заголовків та його розмір, чотири варіанти обкладинки, чотири розкладки фото, заокруглення кутів і відстань між знімками. Поруч показується живе превʼю справжньої сторінки.',
    },
    {
        q: 'Чи працює галерея для клієнтів за кордоном?',
        a: 'Так, галерею можна показати десятьма мовами: українською, англійською, польською, німецькою, чеською, італійською, іспанською, португальською, французькою та румунською.',
    },
    {
        q: 'Як фотограф заробляє на друку?',
        a: 'Після схвалення заявки з портфоліо ви отримуєте постійну знижку 10% на фотокниги, журнали, фотодрук і тревелбуки, а також особисте посилання: клієнт за ним отримує знижку 5%, а ви — відсоток із кожного оплаченого замовлення з виплатою на карту від 500 гривень.',
    },
    {
        q: 'Чи можна завантажувати відео?',
        a: 'Так, у галерею можна додавати відео до 200 МБ, і будь-яке з них можна поставити на обкладинку — тоді воно програватиметься на весь екран, коли клієнт відкриє галерею.',
    },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    return {
        title: TITLE,
        description: DESCRIPTION,
        keywords: [
            'галерея для фотографів', 'онлайн-галерея', 'передати фото клієнту',
            'кабінет фотографа', 'галерея клієнту без реєстрації', 'хмара для фотографа',
            'знижка для фотографів на друк', 'фотокниги для фотографів',
            'сервіс передачі фото', 'Pixieset українською',
        ],
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
        twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
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

/** First photos of the demo gallery — rendered as a strip under the cover so
 *  the landing shows the actual work, not just the hero (Diana: «показуй і
 *  фото, хоча б перших 6»). Server-side query, no client fetch. */
async function demoPhotos(limit = 6): Promise<string[]> {
    try {
        const admin = getAdminClient();
        const { data: gallery } = await admin
            .from('photographer_galleries')
            .select('id')
            .eq('client_token', DEMO_GALLERY_TOKEN)
            .maybeSingle();
        if (!gallery) return [];
        const { data: photos } = await admin
            .from('photographer_gallery_photos')
            .select('storage_path, storage_provider')
            .eq('gallery_id', gallery.id)
            .eq('media_type', 'photo')
            .order('created_at', { ascending: true })
            .limit(limit);
        return (photos || []).map(p => fileUrl(p.storage_path, p.storage_provider));
    } catch {
        return [];
    }
}

export default async function PhotographersPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const photos = await demoPhotos();
    const base = 'https://touchmemories.com.ua';
    const canonical = getCanonicalUrl(locale, '/photographers');

    // Structured data: the FAQ answers below are the same strings rendered on
    // the page, and the Service carries every plan as an Offer so the prices
    // can surface directly in search results.
    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
        })),
    };
    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Головна', item: base },
            { '@type': 'ListItem', position: 2, name: 'Для фотографів', item: canonical },
        ],
    };
    const serviceJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Онлайн-галереї Touch.Memories для фотографів',
        serviceType: 'Передача фотографій клієнтам, кабінет фотографа',
        provider: { '@type': 'Organization', name: 'Touch.Memories', url: base },
        areaServed: 'UA',
        url: canonical,
        description: DESCRIPTION,
        offers: GALLERY_PLANS.map(p => ({
            '@type': 'Offer',
            name: `${p.name} — ${p.storageGb} ГБ`,
            price: String(p.priceUah),
            priceCurrency: 'UAH',
            description: p.blurb,
            availability: 'https://schema.org/InStock',
            url: canonical,
        })),
    };

    return (
        <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
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
                            {/* Real photos from the demo gallery, so the page
                                shows the work and not only the cover. */}
                            {photos.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 4, padding: 4, background: '#fff' }}>
                                    {photos.map(url => (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img key={url} src={url} alt="" loading="lazy"
                                            style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block' }} />
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px', borderTop: '1px solid #F0EAE0' }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {['3 кольори фону', '4 шрифти', '4 обкладинки', '10 мов', 'фото і відео'].map(chip => (
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

                {/* Pricing — server-rendered so the plans are indexable and
                    match the Offer schema above. */}
                <section id="tarify" style={{ background: '#F5EFE6', padding: '64px 16px 72px' }}>
                    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28, color: '#1A1A1A', textAlign: 'center', margin: '0 0 10px' }}>
                            Тарифи на місце для галерей
                        </h2>
                        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#8B8378', textAlign: 'center', maxWidth: 660, margin: '0 auto 28px' }}>
                            Платите тільки за місце під фото. Усі можливості — конструктор дизайну, десять мов, відео, статистика і вибір клієнта для друку — доступні на кожному тарифі, включно з безкоштовним.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
                            {GALLERY_PLANS.map(p => (
                                <div key={p.id} style={{
                                    background: '#fff',
                                    border: p.id === 'pro' ? '2px solid #263A99' : '1px solid #E8DCC8',
                                    borderRadius: 16, padding: '24px 22px', display: 'flex', flexDirection: 'column',
                                }}>
                                    {p.id === 'pro' && (
                                        <div style={{ alignSelf: 'flex-start', background: '#263A99', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '3px 10px', marginBottom: 10 }}>
                                            Найпопулярніший
                                        </div>
                                    )}
                                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, color: '#1A1A1A' }}>{p.name}</div>
                                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 30, color: '#263A99', margin: '6px 0 0' }}>
                                        {p.priceUah === 0 ? '0 ₴' : `${p.priceUah} ₴`}
                                        <span style={{ fontSize: 13, fontWeight: 600, color: '#8B8378' }}> / місяць</span>
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '6px 0 10px' }}>{p.storageGb} ГБ місця</div>
                                    <div style={{ fontSize: 13, lineHeight: 1.6, color: '#8B8378', marginBottom: 12 }}>{p.blurb}</div>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                                        {p.perks.map(perk => (
                                            <li key={perk} style={{ fontSize: 13, lineHeight: 1.5, color: '#55504a', paddingLeft: 16, position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: 0, color: '#263A99' }}>·</span>{perk}
                                            </li>
                                        ))}
                                    </ul>
                                    <a href="/uk/photographers/apply" style={{
                                        display: 'block', textAlign: 'center', padding: '11px 0', borderRadius: 10,
                                        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, textDecoration: 'none',
                                        background: p.id === 'pro' ? '#263A99' : '#fff',
                                        color: p.id === 'pro' ? '#fff' : '#263A99',
                                        border: p.id === 'pro' ? 'none' : '1px solid #c9d0ee',
                                    }}>
                                        {p.priceUah === 0 ? 'Почати безкоштовно' : 'Обрати тариф'}
                                    </a>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#8B8378', textAlign: 'center', maxWidth: 660, margin: '20px auto 0' }}>
                            Тариф змінюється в кабінеті будь-коли й оплачується карткою. Коли місяць закінчується, кабінет повертається на безкоштовний тариф, а вже завантажені галереї працюють до власного терміну зберігання.
                        </p>
                    </div>
                </section>

                {/* Visible FAQ — mirrors the FAQPage schema word for word. */}
                <section style={{ padding: '56px 16px 80px' }}>
                    <div style={{ maxWidth: 860, margin: '0 auto' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, color: '#1A1A1A', textAlign: 'center', margin: '0 0 24px' }}>
                            Часті питання фотографів
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {FAQ.map(({ q, a }) => (
                                <details key={q} style={{ background: '#fff', border: '1px solid #E8DCC8', borderRadius: 12, padding: '16px 20px' }}>
                                    <summary style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>{q}</summary>
                                    <p style={{ fontSize: 14, color: '#8B8378', lineHeight: 1.7, margin: '10px 0 0' }}>{a}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
            <Footer categories={[]} />
        </div>
        </>
    );
}
