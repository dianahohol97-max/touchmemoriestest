import type { Metadata } from 'next';
import TravelAgenciesClient from '../TravelAgenciesClient';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

const TITLE = 'Заявка на співпрацю — Touch.Memories';
const DESCRIPTION = 'Подайте заявку на партнерство для тревел-агенцій і блогерів: після схвалення ви отримаєте персональний промокод і кабінет партнера.';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    return {
        title: TITLE,
        description: DESCRIPTION,
        alternates: {
            canonical: getCanonicalUrl(locale, '/travel-agencies/apply'),
            languages: getAlternateLanguages('/travel-agencies/apply'),
        },
        openGraph: {
            title: TITLE,
            description: DESCRIPTION,
            url: getCanonicalUrl(locale, '/travel-agencies/apply'),
            siteName: 'Touch.Memories',
            locale: OG_LOCALE_MAP[locale],
            type: 'website',
        },
    };
}

/** The moderated partnership application, split out of the /travel-agencies
 *  landing — same two-button workflow as /photographers. */
export default function TravelApplyPage() {
    return <TravelAgenciesClient mode="apply" />;
}
