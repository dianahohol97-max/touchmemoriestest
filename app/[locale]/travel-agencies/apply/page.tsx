import type { Metadata } from 'next';
import TravelAgenciesClient from '../TravelAgenciesClient';
import { getCanonicalUrl, getSingleLocaleAlternates } from '@/lib/seo/locales';

const TITLE = 'Заявка на співпрацю — Touch.Memories';
const DESCRIPTION = 'Подайте заявку на партнерство для тревел-агенцій і блогерів: після схвалення ви отримаєте персональний промокод і кабінет партнера.';

/**
 * Метадані не залежать від локалі: сторінка українська за будь-якою адресою,
 * тож канонічне посилання й hreflang вказують на українську версію (Діана,
 * 16.09.2026). Сама сторінка відкривається з усіх локалей як і раніше.
 */
export async function generateMetadata(): Promise<Metadata> {
    return {
        title: TITLE,
        description: DESCRIPTION,
        alternates: {
            canonical: getCanonicalUrl('uk', '/travel-agencies/apply'),
            languages: getSingleLocaleAlternates('/travel-agencies/apply', 'uk'),
        },
        openGraph: {
            title: TITLE,
            description: DESCRIPTION,
            url: getCanonicalUrl('uk', '/travel-agencies/apply'),
            siteName: 'Touch.Memories',
            locale: 'uk_UA',
            type: 'website',
        },
    };
}

/** The moderated partnership application, split out of the /travel-agencies
 *  landing — same two-button workflow as /photographers. */
export default async function TravelApplyPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    return <TravelAgenciesClient mode="apply" locale={locale} />;
}
