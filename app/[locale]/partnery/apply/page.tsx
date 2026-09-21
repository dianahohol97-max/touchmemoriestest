import type { Metadata } from 'next';
import PartnerApplyClient from '../PartnerApplyClient';
import { getCanonicalUrl, getSingleLocaleAlternates } from '@/lib/seo/locales';
import { getServerT } from '@/lib/i18n/server';

/**
 * Метадані не залежать від локалі: сторінка українська за будь-якою адресою,
 * тож канонічне посилання й hreflang вказують на українську версію (Діана,
 * 16.09.2026). Сама сторінка відкривається з усіх локалей як і раніше.
 */
export async function generateMetadata(): Promise<Metadata> {
    const t = getServerT('uk');
    const title = t('partners.apply.meta_title');
    const description = t('partners.apply.meta_description');
    return {
        title,
        description,
        alternates: {
            canonical: getCanonicalUrl('uk', '/partnery/apply'),
            languages: getSingleLocaleAlternates('/partnery/apply', 'uk'),
        },
        openGraph: {
            title,
            description,
            url: getCanonicalUrl('uk', '/partnery/apply'),
            siteName: 'touch.memories',
            locale: 'uk_UA',
            type: 'website',
        },
    };
}

/**
 * Модерована заявка на партнерство.
 *
 * `?kind=blogger|agency` приходить із кнопок на профільних лендінгах і лише
 * підставляє перемикач у формі — далі значення їде в `partnership_requests.kind`
 * і при схваленні стає `agency_partners.partner_kind`. Невідоме або відсутнє
 * значення читаємо як агенцію: так поводилася форма до появи лендінгів, і
 * людина в будь-якому разі бачить перемикач і може змінити вибір.
 */
export default async function PartnerApplyPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ kind?: string }>;
}) {
    const { locale } = await params;
    const { kind } = await searchParams;
    return (
        <PartnerApplyClient
            locale={locale}
            defaultKind={kind === 'blogger' ? 'travel_blogger' : 'travel_agency'}
        />
    );
}
