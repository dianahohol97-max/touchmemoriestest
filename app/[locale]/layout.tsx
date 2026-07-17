import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { I18nServerProvider } from '@/lib/i18n/server-provider';
import { AuthModalProvider } from '@/lib/auth-modal-context';
import { LOCALES, getBaseUrl, getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

// NOTE: Do NOT use force-dynamic here — it conflicts with generateStaticParams.
// Child pages (admin, checkout, editor) set force-dynamic themselves as needed.

export { type Locale };
export { LOCALES };

export async function generateStaticParams() {
    return LOCALES.map(locale => ({ locale }));
}

const META: Record<Locale, { title: string; description: string }> = {
    uk: { title: 'Touch.Memories — Фотокниги, журнали та фотовироби', description: 'Замовляйте фотокниги, тревел-буки, журнали, календарі, постери та пазли. Доставка по Україні та світу.' },
    en: { title: 'Touch.Memories — Photo Books, Journals & Photo Gifts', description: 'Order custom photo books, travel books, magazines, calendars and posters. Delivery worldwide.' },
    pl: { title: 'Touch.Memories — Fotoksiążki, Albumy i Prezenty Foto', description: 'Zamów fotoksiążki, podróżniki, magazyny, kalendarze i plakaty. Wysyłka do Polski i całego świata.' },
    de: { title: 'Touch.Memories — Fotobücher, Zeitschriften & Fotogeschenke', description: 'Bestellen Sie Fotobücher, Reisejournale, Kalender und Poster. Lieferung weltweit.' },
    ro: { title: 'Touch.Memories — Cărți Foto, Reviste și Cadouri Foto', description: 'Comandați cărți foto, jurnale de călătorie, calendare și postere. Livrare în România și în toată lumea.' },
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const base = getBaseUrl();
    const m = META[locale] || META.uk;
    const ogImage = { url: `${base}/og-image.jpg`, width: 1200, height: 630, alt: m.title };
    return {
        title: m.title,
        description: m.description,
        alternates: {
            canonical: getCanonicalUrl(locale),
            languages: getAlternateLanguages(),
        },
        openGraph: {
            title: m.title,
            description: m.description,
            locale: OG_LOCALE_MAP[locale],
            url: getCanonicalUrl(locale),
            type: 'website',
            siteName: 'Touch.Memories',
            images: [ogImage],
        },
        twitter: {
            card: 'summary_large_image',
            title: m.title,
            description: m.description,
            images: [ogImage.url],
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
                {/* The root layout hardcodes <html lang="uk"> and cannot see the
                    [locale] param without forcing dynamic rendering site-wide
                    (headers()/cookies() would kill ISR). This synchronous script
                    corrects the attribute before any content is parsed, so
                    screen readers and Google's renderer get the real language.
                    <html> has suppressHydrationWarning, so React won't complain. */}
                {locale !== 'uk' && (
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `document.documentElement.lang=${JSON.stringify(locale)};`,
                        }}
                    />
                )}
                <div lang={locale}>
                    {children}
                </div>
            </AuthModalProvider>
        </I18nServerProvider>
    );
}
