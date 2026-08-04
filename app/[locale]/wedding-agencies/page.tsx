import type { Metadata } from 'next';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return {
        title: 'Для весільних агенцій — Touch.Memories',
        description: 'Партнерська програма для весільних агенцій: постійна знижка 7% на книги побажань та весільні газети для ваших клієнтів.',
        alternates: {
            canonical: getCanonicalUrl(locale as Locale, '/wedding-agencies'),
            languages: getAlternateLanguages('/wedding-agencies'),
        },
    };
}

/**
 * Two-button chooser in the touch.memories brand style — mirrors /photographers
 * and /travel-agencies: Cream hero, Charcoal text, Brand Blue only on the
 * primary CTA, Montserrat/Open Sans via the site font vars. The moderated
 * application form lives at /wedding-agencies/apply.
 */
const BENEFITS: { n: string; title: string; text: string }[] = [
    {
        n: '01',
        title: 'Знижка 7% на весільні товари',
        text: 'Постійна знижка на книги побажань та весільні газети для ваших клієнтів. Діє автоматично після схвалення заявки — нічого вводити не потрібно.',
    },
    {
        n: '02',
        title: 'Деталі, що підсилюють сервіс',
        text: 'Книга побажань на столі гостей і весільна газета в руках молодят — дрібниці, які запамʼятовуються і які клієнти повʼязують із вашою агенцією.',
    },
    {
        n: '03',
        title: 'Виготовлення під ваші дати',
        text: 'Ми знаємо, що весілля не переносять. Виробництво планується під дату події, а термінові замовлення обговорюються окремо.',
    },
];

export default function WeddingAgenciesPage() {
    return (
        <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: 110 }}>
                <section style={{ background: '#F5EFE6', padding: '72px 16px 64px' }}>
                    <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#263A99', marginBottom: 18 }}>
                            — партнерська програма —
                        </div>
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 40, lineHeight: 1.15, color: '#1A1A1A', margin: '0 0 16px' }}>
                            Для весільних агенцій
                        </h1>
                        <p style={{ fontSize: 16.5, lineHeight: 1.7, color: '#8B8378', maxWidth: 600, margin: '0 auto 32px' }}>
                            Додайте до своїх послуг книги побажань і весільні газети — деталі, які ваші пари забирають додому і зберігають роками.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <a href="/uk/wedding-agencies/apply"
                                style={{ display: 'inline-block', minWidth: 210, textAlign: 'center', padding: '15px 30px', background: '#263A99', color: '#fff', borderRadius: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                                Зареєструватися
                            </a>
                            <a href="/uk/wedding-agency/cabinet"
                                style={{ display: 'inline-block', minWidth: 210, textAlign: 'center', padding: '15px 30px', background: 'transparent', color: '#1A1A1A', border: '1.5px solid #1A1A1A', borderRadius: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                                Увійти в кабінет
                            </a>
                        </div>
                        <p style={{ fontSize: 13, color: '#8B8378', marginTop: 16 }}>
                            Реєстрація — це коротка заявка з посиланням на вашу агенцію, яку ми розглядаємо вручну.
                        </p>
                    </div>
                </section>

                <section style={{ padding: '56px 16px 80px' }}>
                    <div style={{ maxWidth: 980, margin: '0 auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
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
