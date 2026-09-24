import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Camera, Gift, Heart, Percent, Users } from 'lucide-react';
import { getCanonicalUrl, getSingleLocaleAlternates, getBaseUrl } from '@/lib/seo/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { getPartnerHub, type PartnerHubRouteKind } from '@/lib/partners/landing-content';
import { CardSection, IconBadge, PartnerHero } from '@/components/partners/PartnerLandingUI';

/**
 * Хаб співпраці — те, чим раніше була /travel-agencies.
 *
 * НАВІЩО ПЕРЕРОБЛЯЛИ. Одна сторінка тримала на собі два різні запити: агенція
 * шукала, що подарувати клієнту після туру, а блогер — скільки платить
 * партнерська програма. Обидва намагалися ранжуватися однією адресою і
 * заважали одне одному. Тепер тут лишився короткий вступ і сертифікати, а
 * умови розійшлися на дві профільні сторінки, куди ведуть картки нижче.
 *
 * Стара адреса не зникла: /:locale/travel-agencies віддає 308 сюди
 * (next.config.ts), щоб посилання й вага з пошуку не пропали.
 */

export async function generateMetadata(): Promise<Metadata> {
    const hub = getPartnerHub('uk');
    const canonical = getCanonicalUrl('uk', hub.path);
    return {
        title: hub.metaTitle,
        description: hub.metaDescription,
        keywords: [
            'співпраця touch.memories',
            'партнерська програма',
            'подарункові сертифікати тревелбук',
            'реферальна програма',
        ],
        alternates: {
            canonical,
            languages: getSingleLocaleAlternates(hub.path, 'uk'),
        },
        openGraph: {
            title: hub.metaTitle,
            description: hub.metaDescription,
            url: canonical,
            siteName: 'touch.memories',
            locale: 'uk_UA',
            type: 'website',
        },
        twitter: { card: 'summary', title: hub.metaTitle, description: hub.metaDescription },
    };
}

/**
 * Іконка картки напряму. Лежить поруч зі сторінкою, а не в locales, бо це
 * розмітка: у JSON їй нема чим бути, крім назви, яку однаково довелося б тут
 * розгортати назад у компонент.
 */
const ROUTE_ICON: Record<PartnerHubRouteKind, ReactNode> = {
    photographer: <Camera size={26} color="#3d56d6" />,
    wedding: <Heart size={26} color="#3d56d6" />,
    blogger: <Percent size={26} color="#3d56d6" />,
    agency: <Gift size={26} color="#3d56d6" />,
};

export default async function PartneryHubPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const hub = getPartnerHub(locale);
    const base = getBaseUrl();
    const canonical = getCanonicalUrl('uk', hub.path);

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Головна', item: base },
            { '@type': 'ListItem', position: 2, name: hub.breadcrumb, item: canonical },
        ],
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
            <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
                <Navigation />
                <main style={{ flex: 1, paddingTop: 110 }}>
                    <PartnerHero badge={hub.badge} h1={hub.h1} intro={hub.intro} />

                    {/* Сертифікати лишаються на хабі: це єдиний блок, який не
                        належить ні блогерам, ні агенціям винятково. */}
                    <CardSection
                        id={hub.certificates.id}
                        h2={hub.certificates.h2}
                        lead={hub.certificates.lead}
                        alt={hub.certificates.alt}
                        cards={hub.certificates.cards}
                        icon={<Gift size={26} color="#3d56d6" />}
                    />

                    <section style={{ background: '#F5EFE6', padding: '56px 16px 72px' }}>
                        <div style={{ maxWidth: 900, margin: '0 auto' }}>
                            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                                <IconBadge alt={hub.chooseAlt}><Users size={26} color="#3d56d6" /></IconBadge>
                                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28, color: '#1A1A1A', margin: '14px 0 10px' }}>
                                    {hub.chooseH2}
                                </h2>
                                <p style={{ fontSize: 15, lineHeight: 1.75, color: '#8B8378', maxWidth: 660, margin: '0 auto' }}>
                                    {hub.chooseLead}
                                </p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                                {hub.routes.map(route => (
                                    <a key={route.kind} href={route.href}
                                        style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #E8DCC8', borderRadius: 16, padding: '30px 26px', textDecoration: 'none' }}>
                                        <IconBadge alt={route.alt}>
                                            {ROUTE_ICON[route.kind]}
                                        </IconBadge>
                                        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: '#1e2d7d', margin: '16px 0 8px' }}>
                                            {route.title}
                                        </h3>
                                        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#8B8378', margin: '0 0 18px', flex: 1 }}>
                                            {route.text}
                                        </p>
                                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, color: '#263A99' }}>
                                            {route.cta} →
                                        </span>
                                    </a>
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
