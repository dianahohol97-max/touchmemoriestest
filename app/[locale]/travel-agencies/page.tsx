import type { Metadata } from 'next';
import TravelAgenciesClient from './TravelAgenciesClient';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    return {
        title: 'Співпраця з тревел-агенціями — Touch.Memories',
        description: 'Партнерська програма для тревел-агенцій: реферальна програма 5% на тревелбуки та подарункові сертифікати зі знижкою 10%.',
        alternates: {
            canonical: getCanonicalUrl(locale as Locale, '/travel-agencies'),
            languages: getAlternateLanguages('/travel-agencies'),
        },
    };
}

export default function TravelAgenciesPage() {
    return <TravelAgenciesClient />;
}
