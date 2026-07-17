import type { Metadata } from 'next';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

// The contact page itself is a client component ('use client') and therefore
// cannot export metadata — without this layout it inherited the generic
// site-wide title/description and had no canonical or hreflang at all.

const META: Record<Locale, { title: string; description: string }> = {
    uk: { title: 'Контакти | Touch.Memories', description: 'Зв\'яжіться з Touch.Memories: телефон, email, Instagram і Telegram. Відповідаємо швидко та допомагаємо з вибором фотокниги чи іншого фотовиробу.' },
    en: { title: 'Contact Us | Touch.Memories', description: 'Get in touch with Touch.Memories: phone, email, Instagram and Telegram. We respond quickly and help you choose the right photo product.' },
    pl: { title: 'Kontakt | Touch.Memories', description: 'Skontaktuj się z Touch.Memories: telefon, e-mail, Instagram i Telegram. Odpowiadamy szybko i pomagamy dobrać idealny fotoprodukt.' },
    de: { title: 'Kontakt | Touch.Memories', description: 'Kontaktieren Sie Touch.Memories: Telefon, E-Mail, Instagram und Telegram. Wir antworten schnell und helfen bei der Produktauswahl.' },
    ro: { title: 'Contact | Touch.Memories', description: 'Contactați Touch.Memories: telefon, email, Instagram și Telegram. Răspundem rapid și vă ajutăm să alegeți produsul foto potrivit.' },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = (rawLocale || 'uk') as Locale;
    const m = META[locale] || META.uk;
    return {
        title: m.title,
        description: m.description,
        alternates: {
            canonical: getCanonicalUrl(locale, '/kontakty'),
            languages: getAlternateLanguages('/kontakty'),
        },
        openGraph: {
            title: m.title,
            description: m.description,
            url: getCanonicalUrl(locale, '/kontakty'),
            siteName: 'Touch.Memories',
            locale: OG_LOCALE_MAP[locale],
            type: 'website',
        },
    };
}

export default function KontaktyLayout({ children }: { children: React.ReactNode }) {
    return children;
}
