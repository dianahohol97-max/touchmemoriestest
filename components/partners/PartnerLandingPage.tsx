import type { ReactNode } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Gift, HelpCircle, Layers, Link2, Percent, TrendingUp, UserPlus } from 'lucide-react';
import { getCanonicalUrl, getBaseUrl } from '@/lib/seo/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { getPartnerLanding, type PartnerLandingKind } from '@/lib/partners/landing-content';
import { CardSection, CtaSection, FaqSection, HeroButtons, PartnerHero } from './PartnerLandingUI';

/**
 * Сторінка профільного лендінга партнерської програми — одна розмітка на два
 * маршрути (блогери і турагентства). Відрізняються вони текстом і порядком
 * блоків, а не версткою, тож дублювати файл немає сенсу.
 *
 * Канонічне посилання завжди українське: текст український на всіх локалях
 * (див. коментар у lib/partners/landing-content.ts), і повний набір hreflang
 * зробив би з однієї сторінки пʼять дублів в індексі.
 */

const SECTION_ICONS: Record<PartnerLandingKind, ReactNode[]> = {
    blogger: [<Link2 key="l" size={26} color="#3d56d6" />, <TrendingUp key="t" size={26} color="#3d56d6" />, <UserPlus key="u" size={26} color="#3d56d6" />],
    agency: [<Layers key="l" size={26} color="#3d56d6" />, <Gift key="g" size={26} color="#3d56d6" />, <Percent key="p" size={26} color="#3d56d6" />],
};

export function PartnerLandingPage({ kind, locale }: { kind: PartnerLandingKind; locale: string }) {
    const landing = getPartnerLanding(kind, locale);
    const canonical = getCanonicalUrl('uk', landing.path);
    const base = getBaseUrl();
    const applyHref = `/${locale}/partnery/apply?kind=${landing.applyKind}`;
    const cabinetHref = `/${locale}/partner/cabinet`;

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: landing.faq.map(({ q, a }) => ({
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
            { '@type': 'ListItem', position: 2, name: 'Співпраця', item: getCanonicalUrl('uk', '/partnery') },
            { '@type': 'ListItem', position: 3, name: landing.breadcrumb, item: canonical },
        ],
    };
    const serviceJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: landing.h1,
        serviceType: landing.h1,
        provider: { '@type': 'Organization', name: 'touch.memories', url: base },
        areaServed: 'UA',
        url: canonical,
        description: landing.metaDescription,
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />
            <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
                <Navigation />
                <main style={{ flex: 1, paddingTop: 110 }}>
                    <PartnerHero badge={landing.badge} h1={landing.h1} intro={landing.intro}>
                        <HeroButtons
                            primaryHref={applyHref}
                            primaryLabel={landing.ctaPrimary}
                            secondaryHref={cabinetHref}
                            secondaryLabel={landing.ctaSecondary}
                        />
                    </PartnerHero>

                    {landing.sections.map((section, i) => (
                        <CardSection
                            key={section.id}
                            id={section.id}
                            h2={section.h2}
                            lead={section.lead}
                            alt={section.alt}
                            cards={section.cards}
                            icon={SECTION_ICONS[kind][i]}
                            tinted={i === 1}
                        />
                    ))}

                    <FaqSection h2={landing.faqH2} alt={landing.faqAlt} faq={landing.faq} icon={<HelpCircle size={26} color="#3d56d6" />} />

                    <CtaSection
                        h2={landing.ctaH2}
                        text={landing.ctaText}
                        primaryHref={applyHref}
                        primaryLabel={landing.ctaPrimary}
                        secondaryHref={cabinetHref}
                        secondaryLabel={landing.ctaSecondary}
                    />
                </main>
                <Footer categories={[]} />
            </div>
        </>
    );
}
