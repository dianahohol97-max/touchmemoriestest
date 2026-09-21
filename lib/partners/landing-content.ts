import { getServerT } from '@/lib/i18n/server';

/**
 * Текст трьох сторінок партнерської програми в одному місці.
 *
 * НАВІЩО ОКРЕМИЙ МОДУЛЬ. Сторінки живуть під трьома адресами (/partnery,
 * /partnerska-programa-dlya-blogeriv, /partnerska-programa-dlya-turagentstv), і
 * кожна віддає той самий текст двічі: людині — у розмітці, пошуковику — у
 * FAQPage JSON-LD. Google вимагає, щоб відповіді в структурованих даних
 * збігалися з видимими на сторінці; коли текст лежить у двох місцях, вони
 * розходяться при першій же правці. Тут джерело одне, а сторінка бере з нього
 * і те, і те.
 *
 * Другий сенс — перевірка. `tests/partner-landing-seo.test.ts` читає ці самі
 * обʼєкти і рахує щільність ключів, шукає заборонені слова і ловить речення з
 * одного-двох слів. Якби текст лишався в JSX, перевіряти було б нічого.
 *
 * ПРО МОВУ. Рядки лежать у locales/*.json, але заповнений поки тільки uk.json:
 * лендінг партнерської програми український на всіх пʼяти локалях і канонічне
 * посилання в нього теж українське (Діана, 16.09.2026). getServerT сам бере
 * відсутній ключ з української, тож /de/partnerska-programa-dlya-blogeriv
 * показує те саме, що й /uk, — рівно як було на /travel-agencies. Переклад
 * вмикається ключ за ключем, без жодної зміни в коді.
 */

export type LandingCard = { title: string; text: string };
export type LandingSection = { id: string; h2: string; lead: string; alt: string; cards: LandingCard[] };
export type LandingFaq = { q: string; a: string };

export type PartnerLanding = {
    /** Шлях без локалі, як його бачить canonical і sitemap. */
    path: string;
    kind: PartnerLandingKind;
    /** Значення `kind` для форми заявки — воно ж потім partner_kind у agency_partners. */
    applyKind: 'blogger' | 'agency';
    metaTitle: string;
    metaDescription: string;
    badge: string;
    h1: string;
    intro: string;
    breadcrumb: string;
    sections: LandingSection[];
    faqH2: string;
    faqAlt: string;
    faq: LandingFaq[];
    ctaH2: string;
    ctaText: string;
    ctaPrimary: string;
    ctaSecondary: string;
};

export type PartnerLandingKind = 'blogger' | 'agency';

/** Скільки карток у кожному блоці — ключі в JSON нумеровані з одиниці. */
const SECTIONS: Record<PartnerLandingKind, Array<{ id: string; key: string; cards: number }>> = {
    blogger: [
        { id: 'yak-pratsiuie', key: 'how', cards: 4 },
        { id: 'chomu-vyhidno', key: 'why', cards: 4 },
        { id: 'yak-pryiednatysia', key: 'join', cards: 3 },
    ],
    agency: [
        { id: 'dva-sposoby', key: 'ways', cards: 2 },
        { id: 'sertyfikaty', key: 'certificates', cards: 3 },
        { id: 'referalna-programa', key: 'referral', cards: 4 },
    ],
};

const PATHS: Record<PartnerLandingKind, string> = {
    blogger: '/partnerska-programa-dlya-blogeriv',
    agency: '/partnerska-programa-dlya-turagentstv',
};

const APPLY_KIND: Record<PartnerLandingKind, 'blogger' | 'agency'> = {
    blogger: 'blogger',
    agency: 'agency',
};

const FAQ_COUNT = 4;

export function getPartnerLanding(kind: PartnerLandingKind, locale: string = 'uk'): PartnerLanding {
    const t = getServerT(locale);
    const at = (suffix: string) => t(`partners.${kind}.${suffix}`);

    return {
        path: PATHS[kind],
        kind,
        applyKind: APPLY_KIND[kind],
        metaTitle: at('meta_title'),
        metaDescription: at('meta_description'),
        badge: at('badge'),
        h1: at('h1'),
        intro: at('intro'),
        breadcrumb: at('breadcrumb'),
        sections: SECTIONS[kind].map(s => ({
            id: s.id,
            h2: at(`${s.key}_h2`),
            lead: at(`${s.key}_lead`),
            alt: at(`${s.key}_alt`),
            cards: Array.from({ length: s.cards }, (_, i) => ({
                title: at(`${s.key}_${i + 1}_title`),
                text: at(`${s.key}_${i + 1}_text`),
            })),
        })),
        faqH2: at('faq_h2'),
        faqAlt: at('faq_alt'),
        faq: Array.from({ length: FAQ_COUNT }, (_, i) => ({
            q: at(`faq_${i + 1}_q`),
            a: at(`faq_${i + 1}_a`),
        })),
        ctaH2: at('cta_h2'),
        ctaText: at('cta_text'),
        ctaPrimary: at('cta_primary'),
        ctaSecondary: at('cta_secondary'),
    };
}

export type PartnerHub = {
    path: string;
    metaTitle: string;
    metaDescription: string;
    badge: string;
    h1: string;
    intro: string;
    breadcrumb: string;
    certificates: LandingSection;
    chooseH2: string;
    chooseLead: string;
    chooseAlt: string;
    routes: Array<{ title: string; text: string; cta: string; alt: string; landing: PartnerLandingKind }>;
};

export function getPartnerHub(locale: string = 'uk'): PartnerHub {
    const t = getServerT(locale);
    const at = (suffix: string) => t(`partners.hub.${suffix}`);

    return {
        path: '/partnery',
        metaTitle: at('meta_title'),
        metaDescription: at('meta_description'),
        badge: at('badge'),
        h1: at('h1'),
        intro: at('intro'),
        breadcrumb: at('breadcrumb'),
        certificates: {
            id: 'sertyfikaty',
            h2: at('certificates_h2'),
            lead: at('certificates_lead'),
            alt: at('certificates_alt'),
            cards: [1, 2, 3].map(i => ({
                title: at(`certificates_${i}_title`),
                text: at(`certificates_${i}_text`),
            })),
        },
        chooseH2: at('choose_h2'),
        chooseLead: at('choose_lead'),
        chooseAlt: at('choose_alt'),
        routes: [
            { title: at('blogger_title'), text: at('blogger_text'), cta: at('blogger_cta'), alt: at('blogger_alt'), landing: 'blogger' },
            { title: at('agency_title'), text: at('agency_text'), cta: at('agency_cta'), alt: at('agency_alt'), landing: 'agency' },
        ],
    };
}

/** Адреса сторінки лендінга з локаллю — для посилань усередині сайту. */
export function landingHref(locale: string, kind: PartnerLandingKind): string {
    return `/${locale}${PATHS[kind]}`;
}
