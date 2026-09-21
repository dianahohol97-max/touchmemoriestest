import type { Metadata } from 'next';
import { PartnerLandingPage } from '@/components/partners/PartnerLandingPage';
import { getCanonicalUrl, getSingleLocaleAlternates } from '@/lib/seo/locales';
import { getPartnerLanding } from '@/lib/partners/landing-content';

/**
 * Лендінг партнерської програми для тревел-блогерів.
 *
 * Адреса в URL несе основний ключ українською транслітерацією —
 * /partnerska-programa-dlya-blogeriv, — бо саме так її читає пошук, і саме
 * такий вигляд має решта смислових адрес сайту (/oplata-i-dostavka, /pro-nas).
 *
 * Текст сторінки лежить у locales/uk.json під `partners.blogger`, розмітка — у
 * components/partners. Канонічне посилання українське за будь-якої локалі: див.
 * коментар у lib/partners/landing-content.ts.
 */

export async function generateMetadata(): Promise<Metadata> {
    const landing = getPartnerLanding('blogger', 'uk');
    const canonical = getCanonicalUrl('uk', landing.path);
    return {
        title: landing.metaTitle,
        description: landing.metaDescription,
        keywords: [
            'партнерська програма для блогерів',
            'реферальна програма для тревел-блогерів',
            'як блогеру заробити на рекомендаціях',
            'affiliate програма для блогера',
            'монетизація тревел-блогу',
            'партнерка для інстаграм-блогера',
            'заробіток на рекомендаціях продукту',
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

export default async function BloggerPartnerProgramPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    return <PartnerLandingPage kind="blogger" locale={locale} />;
}
