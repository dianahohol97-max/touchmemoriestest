/**
 * Замовлення журналу з нашим текстом: ціна і рядок замовлення.
 *
 * Сторінка `/[locale]/order/magazine-text-brief` рахувала ціну ТРИЧІ — у
 * підсумку, який бачить клієнт, у рядку, який лягає в базу, і (з іншою
 * арифметикою терміновості) у картці товару. Оформлення переїжджає на
 * сервер, тож копій стало б чотири, а з ними й розбіжність між тим, що
 * показали, і тим, що виставили в рахунку. Тому ціна і рядок замовлення
 * живуть тут, і обидва шляхи — браузерний і серверний — беруть їх звідси.
 *
 * Серверний шлях НЕ вірить сумі з браузера: він рахує сам тією ж функцією, а
 * браузерну кладе поруч як заявлену. Розбіжність означає, що в клієнта
 * лишилася стара збірка сторінки, і це видно в звіті, а не в рахунку.
 */
import { getMagazinePrice, URGENT_MULTIPLIER } from '@/lib/products';
import { DELIVERY_NOT_CHOSEN } from '@/lib/orders/pickup-rules';
import { orderFlowMarker, type OrderPath } from '@/lib/orders/server-order-flow';

export type MagazineTextPackage = 'basic' | 'premium';

export const MAGAZINE_TEXT_PACKAGE_PRICE: Record<MagazineTextPackage, number> = { basic: 195, premium: 395 };

export const MAGAZINE_TEXT_PACKAGE_LABEL: Record<MagazineTextPackage, string> = {
    basic: 'Базовий пакет — 6 розділів',
    premium: 'Преміум пакет — 6 розділів + опція кастомної статті',
};

export function isMagazineTextPackage(value: unknown): value is MagazineTextPackage {
    return value === 'basic' || value === 'premium';
}

/** Кількість сторінок приїжджає з картки товару рядком на кшталт «24 сторінки». */
export function readMagazinePages(options: Record<string, any> | null | undefined): number {
    const raw = String(options?.['Кількість сторінок'] ?? '').replace(/[^\d]/g, '');
    return parseInt(raw, 10) || 0;
}

/**
 * Терміновість теж рядок, і порожнє значення означає «звичайне виготовлення».
 * Умова збережена рівно такою, якою вона стояла на сторінці, щоб перенесення
 * не змінило жодної ціни.
 */
export function isMagazineUrgent(options: Record<string, any> | null | undefined): boolean {
    const raw = String(options?.['Терміновість'] ?? options?.['urgent'] ?? '').toLowerCase();
    return raw !== '' && raw !== '0' && raw !== 'standard' && !raw.includes('стандартна');
}

export type MagazineBriefPrice = {
    pages: number;
    base: number;
    urgentExtra: number;
    packagePrice: number;
    total: number;
    breakdown: Array<{ label: string; amount: number }>;
};

/**
 * Ціна: база за кількістю сторінок, терміновість +30 % від бази, пакет тексту.
 *
 * Без кількості сторінок ціни немає взагалі (нуль, а не «база за мінімальний
 * тираж»): така заявка приходить із картки товару без вибору, і тоді суму
 * ставить менеджер руками. Нуль тут — це «не пораховано», і рахунок на таке
 * замовлення не виставляється.
 */
export function priceMagazineBrief(
    options: Record<string, any> | null | undefined,
    pkg: MagazineTextPackage,
): MagazineBriefPrice {
    const pages = readMagazinePages(options);
    const base = pages ? (getMagazinePrice(pages, false) || 0) : 0;
    const packagePrice = MAGAZINE_TEXT_PACKAGE_PRICE[pkg];
    if (!base) {
        return { pages, base: 0, urgentExtra: 0, packagePrice, total: 0, breakdown: [] };
    }
    const urgentExtra = isMagazineUrgent(options) ? Math.round(base * URGENT_MULTIPLIER) : 0;
    return {
        pages,
        base,
        urgentExtra,
        packagePrice,
        total: base + urgentExtra + packagePrice,
        breakdown: [
            { label: `Базова вартість (${pages} стор.)`, amount: base },
            ...(urgentExtra ? [{ label: 'Термінове виготовлення', amount: urgentExtra }] : []),
            { label: `Текст пише команда — ${MAGAZINE_TEXT_PACKAGE_LABEL[pkg]}`, amount: packagePrice },
        ],
    };
}

const PRODUCT_NAMES: Record<string, string> = {
    'personalized-glossy-magazine': 'Глянцевий журнал про людину',
};

export function magazineProductName(productSlug: string): string {
    return PRODUCT_NAMES[productSlug]
        || productSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export type MagazineBriefInput = {
    path: OrderPath;
    productSlug: string;
    pkg: MagazineTextPackage;
    answers: Record<string, string>;
    options: Record<string, any>;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    telegram: string;
    contactMethod: string;
    coverName?: string;
    coverDate?: string;
    coverEra?: string;
    coverStyle?: string;
    coverPhotoNote?: string;
    coverInscription?: string;
    coverPhotoPath?: string | null;
    /** Сума, яку порахував браузер. На серверному шляху лягає поруч із порахованою. */
    declaredTotal?: number | null;
    /** Ключ повтору: та сама заявка, надіслана двічі, не має створити два замовлення. */
    idempotencyKey?: string | null;
    collectedAt?: string;
};

/**
 * Рядок замовлення — один на обидва шляхи.
 *
 * Доставку ця форма не питає взагалі, а колонка не приймає порожнього
 * значення. Досі сюди писався 'pickup' із наміром «команда узгодить пізніше»,
 * і не узгоджував ніхто: у базі ВСІ замовлення цього товару стояли як
 * самовивіз, включно з терміновими, яким самовивіз заборонено. Пишемо чесне
 * «ще не обрано».
 */
export function buildMagazineBriefOrderRow(input: MagazineBriefInput): Record<string, any> {
    const price = priceMagazineBrief(input.options, input.pkg);
    const productName = magazineProductName(input.productSlug);
    const marker = orderFlowMarker({
        flow: 'magazine-text-brief',
        path: input.path,
        declaredTotal: input.declaredTotal ?? (input.path === 'client' ? price.total : null),
        computedTotal: input.path === 'server' ? price.total : null,
    });

    return {
        // Денормалізоване повне імʼя, яке список замовлень показує в колонці
        // «Клієнт». Без нього замовлення виглядало там порожнім, хоч контакти
        // збережені — тобто як «оплачено, а даних немає».
        customer_name: [input.firstName, input.lastName].map(s => String(s || '').trim()).filter(Boolean).join(' ') || null,
        customer_first_name: input.firstName,
        customer_last_name: input.lastName,
        customer_phone: input.phone,
        customer_email: input.email || null,
        customer_telegram: input.telegram || null,
        with_designer: true,
        delivery_method: DELIVERY_NOT_CHOSEN,
        items: [{
            product_slug: input.productSlug,
            product_name: productName,
            quantity: 1,
            unit_price: price.total,
            total_price: price.total,
            price_breakdown: price.breakdown,
            text_package: input.pkg,
            text_package_price: price.packagePrice,
            options: input.options,
        }],
        notes: [
            price.total
                ? `Рахунок виставлено автоматично: ${price.total} ₴ (база + терміновість + пакет тексту).`
                : 'Ціну не пораховано автоматично (немає кількості сторінок) — визначте вручну і надішліть посилання на оплату.',
            `Текст пише команда — пакет: ${MAGAZINE_TEXT_PACKAGE_LABEL[input.pkg]}`,
            input.coverName ? `Імʼя на обкладинці: ${input.coverName}` : '',
            input.coverDate ? `Дата на обкладинці: ${input.coverDate}` : '',
            input.coverEra ? `Епоха/настрій: ${input.coverEra}` : '',
            input.coverStyle ? `Стиль обкладинки: ${input.coverStyle}` : '',
            input.coverPhotoNote ? `Фото на обкладинку: ${input.coverPhotoNote}` : '',
            input.coverInscription ? `Надпис на обкладинці: ${input.coverInscription}` : '',
        ].filter(Boolean).join('\n---\n'),
        order_status: 'new',
        payment_status: 'pending',
        // У таблиці немає колонки під спосіб звʼязку, тож він лежить у
        // custom_attributes поруч із поміткою джерела.
        custom_attributes: {
            contact_method: input.contactMethod,
            ...marker,
            ...(input.idempotencyKey ? { order_idempotency_key: input.idempotencyKey } : {}),
        },
        total: price.total,
        subtotal: price.total,
        text_brief: {
            package: input.pkg,
            answers: input.answers,
            cover: {
                name: input.coverName || '',
                date: input.coverDate || '',
                era: input.coverEra || '',
                style: input.coverStyle || '',
                photo_note: input.coverPhotoNote || '',
                photo_path: input.coverPhotoPath ?? null,
                inscription: input.coverInscription || '',
            },
            cover_inscription: input.coverInscription || '',
            collected_at: input.collectedAt || new Date().toISOString(),
        },
    };
}
