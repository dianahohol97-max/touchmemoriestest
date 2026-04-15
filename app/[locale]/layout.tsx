import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { I18nServerProvider } from '@/lib/i18n/server-provider';
import { AuthModalProvider } from '@/lib/auth-modal-context';

// NOTE: Do NOT use force-dynamic here — it conflicts with generateStaticParams.
// Child pages (admin, checkout, editor) set force-dynamic themselves as needed.

export type Locale = 'uk' | 'en' | 'ro' | 'pl' | 'de';
export const LOCALES: Locale[] = ['uk', 'en', 'ro', 'pl', 'de'];
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';

export async function generateStaticParams() {
    return LOCALES.map(locale => ({ locale }));
}

const META: Record<Locale, { title: string; description: string; locale: string }> = {
    uk: { title: 'Touch.Memories — Фотокниги, журнали та фотовироби', description: 'Замовляйте фотокниги, тревел-буки, журнали, календарі, постери та пазли. Доставка по Україні та світу.', locale: 'uk_UA' },
    en: { title: 'Touch.Memories — Photo Books, Journals & Photo Gifts', description: 'Order custom photo books, travel books, magazines, calendars and posters. Delivery worldwide.', locale: 'en_US' },
    pl: { title: 'Touch.Memories — Fotoksiążki, Albumy i Prezenty Foto', description: 'Zamów fotoksiążki, podróżniki, magazyny, kalendarze i plakaty. Wysyłka do Polski i całego świata.', locale: 'pl_PL' },
    de: { title: 'Touch.Memories — Fotobücher, Zeitschriften & Fotogeschenke', description: 'Bestellen Sie Fotobücher, Reisejournale, Kalender und Poster. Lieferung weltweit.', locale: 'de_DE' },
    ro: { title: 'Touch.Memories — Cărți Foto, Reviste și Cadouri Foto', description: 'Comandați cărți foto, jurnale de călătorie, calendare și postere. Livrare în România și în toată lumea.', locale: 'ro_RO' },
};

// OG image — shared across all locales
const OG_IMAGE = {
    url: `${SITE_URL}/og-image.jpg`,
    width: 1200,
    height: 630,
    alt: 'Touch.Memories — фотокниги та фотовироби',
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const alternates: Record<string, string> = {};
    LOCALES.forEach(l => {
        // hreflang: use 'uk' for Ukrainian (not 'uk-UA') per Google guidelines
        alternates[l] = `${SITE_URL}/${l}`;
    });
    alternates['x-default'] = `${SITE_URL}/uk`;
    const m = META[locale] || META.uk;
    return {
        title: m.title,
        description: m.description,
        alternates: { canonical: `${SITE_URL}/${locale}`, languages: alternates },
        openGraph: {
            title: m.title,
            description: m.description,
            locale: m.locale,
            url: `${SITE_URL}/${locale}`,
            type: 'website',
            siteName: 'Touch.Memories',
            images: [OG_IMAGE],
        },
        twitter: {
            card: 'summary_large_image',
            title: m.title,
            description: m.description,
            images: [OG_IMAGE.url],
        },
    };
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: Locale }>;
}) {
    const { locale } = await params;
    if (!LOCALES.includes(locale)) notFound();

    return (
        <I18nServerProvider locale={locale}>
            <AuthModalProvider>
                <div lang={locale}>
                    {children}
                </div>
            </AuthModalProvider>
        </I18nServerProvider>
    );
}
