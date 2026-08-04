import type { Metadata } from 'next';
import TravelAgenciesClient from './TravelAgenciesClient';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';

// Single source of truth for the partner FAQ: rendered VISIBLY on the page
// below and emitted as FAQPage JSON-LD — Google requires the schema answers
// to match on-page content (no cloaking), and rich FAQ snippets are the main
// SEO win for a B2B landing like this.
const FAQ: Array<{ q: string; a: string }> = [
    {
        q: 'Хто може стати партнером Touch.Memories?',
        a: 'Тревел-агенції та тревел-блогери. Залиште заявку на цій сторінці — після схвалення ви отримаєте персональний промокод і доступ до партнерського кабінету. Для фотографів діє окрема програма на сторінці «Для фотографів».',
    },
    {
        q: 'Скільки заробляє партнер?',
        a: 'Комісія — 5% від вартості тревелбуків і 3% від решти товарів із кожного оплаченого замовлення за вашим промокодом чи посиланням. Нарахування відбувається автоматично після оплати.',
    },
    {
        q: 'Що отримує клієнт за партнерським промокодом?',
        a: 'Знижку 5% на замовлення. За партнерським посиланням знижка застосовується автоматично — вводити код не потрібно.',
    },
    {
        q: 'Як купити подарункові сертифікати зі знижкою 10%?',
        a: 'У партнерському кабінеті: обираєте номінал сертифіката на Travel Book і кількість, оплачуєте карткою — сертифікати автоматично надходять на ваш email. Сертифікат зберігає повний номінал і діє 3 місяці.',
    },
    {
        q: 'Як і коли виплачується комісія?',
        a: 'У кабінеті ви бачите всі нарахування і вказуєте рахунок для виплат. Запит на виплату доступний від 500 грн накопиченої комісії.',
    },
    {
        q: 'Скільки коштує участь у партнерській програмі?',
        a: 'Участь безкоштовна — жодних внесків чи зобовʼязань. Ви заробляєте лише з реальних оплачених замовлень ваших клієнтів.',
    },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const canonical = getCanonicalUrl(locale as Locale, '/travel-agencies');
    const title = 'Партнерська програма для тревел-агенцій і блогерів | Touch.Memories';
    const description =
        'Заробляйте з Touch.Memories: комісія 5% з тревелбуків і 3% з інших товарів, знижка 5% вашим клієнтам, ' +
        'подарункові сертифікати −10% у партнерському кабінеті. Безкоштовна участь, виплати від 500 грн.';
    return {
        title,
        description,
        keywords: [
            'партнерська програма', 'співпраця для тревел-агенцій',
            'партнерство для тревел-блогерів', 'реферальна програма', 'подарункові сертифікати тревелбук',
            'заробіток для турагенцій', 'фотокниги для агенцій', 'travel book партнерство',
        ],
        alternates: {
            canonical,
            languages: getAlternateLanguages('/travel-agencies'),
        },
        openGraph: {
            title,
            description,
            url: canonical,
            siteName: 'Touch.Memories',
            type: 'website',
            locale: locale === 'uk' ? 'uk_UA' : locale,
        },
        twitter: {
            card: 'summary',
            title,
            description,
        },
    };
}

export default async function TravelAgenciesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const canonical = getCanonicalUrl(locale as Locale, '/travel-agencies');
    const base = 'https://touchmemories.com.ua';

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
            { '@type': 'ListItem', position: 2, name: 'Партнерська програма', item: canonical },
        ],
    };
    const serviceJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Партнерська програма Touch.Memories',
        serviceType: 'Партнерська (реферальна) програма для тревел-агенцій і блогерів',
        provider: { '@type': 'Organization', name: 'Touch.Memories', url: base },
        areaServed: 'UA',
        description:
            'Комісія 5% з тревелбуків і 3% з інших товарів за замовлення клієнтів, знижка клієнтам 5%, ' +
            'подарункові сертифікати зі знижкою 10% у партнерському кабінеті. Виплати від 500 грн.',
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
            <TravelAgenciesClient />
            {/* Visible FAQ — server-rendered so crawlers see exactly what the
                FAQPage schema declares. Styled to match the landing. */}
            <section style={{ background: '#f4f6fb', padding: '56px 16px 72px' }}>
                <div style={{ maxWidth: 860, margin: '0 auto' }}>
                    <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', textAlign: 'center', marginBottom: 28 }}>
                        Часті питання про партнерство
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {FAQ.map(({ q, a }) => (
                            <details key={q} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                                <summary style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>{q}</summary>
                                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, margin: '10px 0 0' }}>{a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
