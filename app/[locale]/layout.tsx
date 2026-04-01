import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { I18nServerProvider } from '@/lib/i18n/server-provider';

export const dynamic = 'force-dynamic';

export type Locale = 'uk' | 'en' | 'ro' | 'pl' | 'de';
export const LOCALES: Locale[] = ['uk', 'en', 'ro', 'pl', 'de'];
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';

export async function generateStaticParams() {
    return LOCALES.map(locale => ({ locale }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const alternates: Record<string, string> = {};
    LOCALES.forEach(l => {
        alternates[l === 'uk' ? 'uk-UA' : l] = `${SITE_URL}/${l}`;
    });
    alternates['x-default'] = `${SITE_URL}/uk`;
    return { alternates: { languages: alternates } };
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
            {children}
        </I18nServerProvider>
    );
}
