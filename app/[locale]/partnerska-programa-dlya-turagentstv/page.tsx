import type { Metadata } from 'next';
import { PartnerLandingPage } from '@/components/partners/PartnerLandingPage';
import { getCanonicalUrl, getSingleLocaleAlternates } from '@/lib/seo/locales';
import { getPartnerLanding } from '@/lib/partners/landing-content';

/**
 * Лендінг партнерської програми для турагентств: сертифікати після туру і
 * винагорода за рекомендації. Розмітку ділить із лендінгом для блогерів, текст
 * лежить у locales/uk.json під `partners.agency`.
 */

export async function generateMetadata(): Promise<Metadata> {
    const landing = getPartnerLanding('agency', 'uk');
    const canonical = getCanonicalUrl('uk', landing.path);
    return {
        title: landing.metaTitle,
        description: landing.metaDescription,
        keywords: [
            'партнерська програма для турагентств',
            'співпраця з туристичною агенцією',
            'реферальна програма для тревел-агенцій',
            'подарунок клієнту турагентства після туру',
            'сертифікат на фотокнигу для клієнтів агенції',
            'додатковий дохід турагентства',
            'партнерство з туристичними компаніями',
        ],
        alternates: {
            canonical,
            languages: getSingleLocaleAlternates(landing.path, 'uk'),
        },
        openGraph: {
            title: landing.metaTitle,
            description: landing.metaDescription,
            url: canonical,
            siteName: 'touch.memories',
            locale: 'uk_UA',
            type: 'website',
        },
        twitter: { card: 'summary', title: landing.metaTitle, description: landing.metaDescription },
    };
}

export default async function AgencyPartnerProgramPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    return <PartnerLandingPage kind="agency" locale={locale} />;
}
