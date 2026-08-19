import {
    PHOTO_JOURNAL_SOFT,
    PHOTO_JOURNAL_HARD,
    TRAVEL_BOOK,
} from '@/lib/products';

/**
 * Price drift audit — the standing check that the database and the code agree.
 *
 * Why this exists. Page-priced products are described TWICE and neither copy
 * validates the other:
 *
 *   · `lib/products.ts` holds the scale — the absolute price of every page
 *     count. The constructor and the catalog card price from it.
 *   · `products.price` + `options['Кількість сторінок'][].price` hold the same
 *     scale in the shape «cheapest tier + surcharge». The product page prices
 *     from that.
 *
 * The two agree only while `products.price` equals the cheapest tier of the
 * scale. Nothing enforced it, so the day the hard-cover journal gained a
 * 12-сторінковий tier at 675 ₴ and the column stayed at its old 825 ₴, every
 * single configuration of that product silently went out 150 ₴ over — twelve
 * pages sold for the price of sixteen. It took a customer order (TM-001202)
 * to notice, and it was not the first price to drift this way.
 *
 * This module recomputes both sides for every tier of every page-priced
 * product and reports each disagreement in hryvnia. It is pure — the caller
 * supplies the DB rows — so it runs from an admin route, a cron, or a test.
 *
 * What it deliberately does NOT cover: photobooks. Their prices live only in
 * `photobook_prices` and the editor reads that table directly, so there is no
 * second copy to drift from. Adding a hardcoded photobook table here would
 * recreate exactly the problem this file exists to catch.
 */

/** The page-priced products, and the scale each one must reproduce. */
export const PAGE_PRICED_PRODUCTS: Array<{
    slug: string;
    label: string;
    /** page count → absolute price in ₴, from lib/products (the authority). */
    scale: Record<number, number>;
}> = [
    {
        slug: 'personalized-glossy-magazine',
        label: 'Глянцевий журнал з м\'якою обкладинкою',
        scale: PHOTO_JOURNAL_SOFT.prices,
    },
    {
        slug: 'fotozhurnal-tverd-obkladynka',
        label: 'Фотожурнал з твердою обкладинкою',
        scale: PHOTO_JOURNAL_HARD.prices,
    },
    {
        slug: 'travelbook-20x30',
        label: 'Travel Book',
        scale: TRAVEL_BOOK.prices,
    },
];

export type PricingProductRow = {
    slug: string;
    name?: string | null;
    price?: number | string | null;
    options?: any;
};

export type PriceDrift = {
    slug: string;
    label: string;
    pages: number;
    /** What lib/products says this configuration costs. */
    expected: number;
    /** What the product page actually charges: products.price + надбавка. */
    actual: number;
    /** actual − expected. Positive means the customer is overcharged. */
    diff: number;
    base: number;
    surcharge: number;
};

export type PricingAuditReport = {
    /** Every tier where the DB and the code disagree, worst first. */
    drift: PriceDrift[];
    /** Page counts the scale prices but the DB does not offer, and vice versa. */
    missingInDb: Array<{ slug: string; label: string; pages: number[] }>;
    missingInScale: Array<{ slug: string; label: string; pages: number[] }>;
    /** Products this audit expects to find but the DB does not have. */
    missingProducts: string[];
    /** Products checked with no disagreement at all. */
    cleanProducts: string[];
    /** Suggested база for each product whose surcharges are self-consistent. */
    suggestedBase: Array<{ slug: string; label: string; current: number; shouldBe: number }>;
    /**
     * Третя копія — таблиця page_product_prices (майбутнє єдине джерело).
     * Поки читання не перемкнули, вона живе під цим наглядом: кожен рядок,
     * що розійшовся зі шкалою в коді, і кожен тариф, якого бракує чи який
     * зайвий. Порожні масиви + tableChecked=true — таблиця дзеркальна.
     * tableChecked=false — рядків таблиці аудиту не передали (старий виклик),
     * і про таблицю звіт свідомо мовчить, а не вдає, що вона чиста.
     */
    tableChecked: boolean;
    tableDrift: Array<{ slug: string; label: string; pages: number; table: number; code: number }>;
    tableMissing: Array<{ slug: string; label: string; pages: number[] }>;
    tableExtra: Array<{ slug: string; label: string; pages: number[] }>;
};

export type PageProductPriceTableRow = {
    product_slug: string;
    page_count: number;
    price: number | string;
};

function pagesOptionOf(row: PricingProductRow): Array<{ pages: number; surcharge: number }> {
    const options = Array.isArray(row.options) ? row.options : [];
    const opt = options.find((o: any) => o?.name === 'Кількість сторінок');
    const items = opt?.options || opt?.values || [];
    if (!Array.isArray(items)) return [];
    const parsed: Array<{ pages: number; surcharge: number }> = [];
    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const pages = parseInt(String(item.value ?? item.label ?? '').match(/\d+/)?.[0] || '', 10);
        if (!Number.isFinite(pages) || pages <= 0) continue;
        parsed.push({ pages, surcharge: Number(item.price || 0) });
    }
    return parsed;
}

/**
 * Compare every page-priced product's DB configuration against its code scale.
 *
 * `rows` is whatever `select slug, name, price, options from products` returns
 * — the audit picks out the slugs it knows and ignores the rest.
 *
 * `tableRows`, коли передані, — вміст page_product_prices: третя копія цін,
 * майбутнє єдине джерело. Її звіряємо з шкалою в коді окремими полями звіту
 * (tableDrift / tableMissing / tableExtra), щоб перед перемиканням читання
 * було чорним по білому видно, що таблиця дзеркальна.
 */
export function auditPagePricing(
    rows: PricingProductRow[],
    tableRows?: PageProductPriceTableRow[],
): PricingAuditReport {
    const bySlug = new Map<string, PricingProductRow>();
    for (const row of rows || []) {
        if (row?.slug) bySlug.set(row.slug, row);
    }

    const report: PricingAuditReport = {
        drift: [],
        missingInDb: [],
        missingInScale: [],
        missingProducts: [],
        cleanProducts: [],
        suggestedBase: [],
        tableChecked: tableRows !== undefined,
        tableDrift: [],
        tableMissing: [],
        tableExtra: [],
    };

    if (tableRows !== undefined) {
        const tableBySlug = new Map<string, Map<number, number>>();
        for (const r of tableRows || []) {
            if (!r?.product_slug) continue;
            const m = tableBySlug.get(r.product_slug) ?? new Map<number, number>();
            m.set(Number(r.page_count), Number(r.price));
            tableBySlug.set(r.product_slug, m);
        }
        for (const product of PAGE_PRICED_PRODUCTS) {
            const table = tableBySlug.get(product.slug) ?? new Map<number, number>();
            const scalePages = Object.keys(product.scale).map(Number).sort((a, b) => a - b);

            const missing = scalePages.filter(p => !table.has(p));
            if (missing.length) {
                report.tableMissing.push({ slug: product.slug, label: product.label, pages: missing });
            }
            const extra = [...table.keys()].filter(p => product.scale[p] === undefined).sort((a, b) => a - b);
            if (extra.length) {
                report.tableExtra.push({ slug: product.slug, label: product.label, pages: extra });
            }
            for (const pages of scalePages) {
                const tablePrice = table.get(pages);
                if (tablePrice === undefined || tablePrice === product.scale[pages]) continue;
                report.tableDrift.push({
                    slug: product.slug,
                    label: product.label,
                    pages,
                    table: tablePrice,
                    code: product.scale[pages],
                });
            }
        }
    }

    for (const product of PAGE_PRICED_PRODUCTS) {
        const row = bySlug.get(product.slug);
        if (!row) {
            report.missingProducts.push(product.slug);
            continue;
        }

        const base = Number(row.price || 0);
        const dbTiers = pagesOptionOf(row);
        const scalePages = Object.keys(product.scale).map(Number).sort((a, b) => a - b);
        const dbPages = dbTiers.map(t => t.pages).sort((a, b) => a - b);

        const missingInDb = scalePages.filter(p => !dbPages.includes(p));
        const missingInScale = dbPages.filter(p => !scalePages.includes(p));
        if (missingInDb.length) {
            report.missingInDb.push({ slug: product.slug, label: product.label, pages: missingInDb });
        }
        if (missingInScale.length) {
            report.missingInScale.push({ slug: product.slug, label: product.label, pages: missingInScale });
        }

        let drifted = 0;
        for (const tier of dbTiers) {
            const expected = product.scale[tier.pages];
            if (expected === undefined) continue;   // already reported as missingInScale
            const actual = base + tier.surcharge;
            if (actual === expected) continue;
            drifted++;
            report.drift.push({
                slug: product.slug,
                label: product.label,
                pages: tier.pages,
                expected,
                actual,
                diff: actual - expected,
                base,
                surcharge: tier.surcharge,
            });
        }

        // When every tier is off by the SAME amount the surcharges are fine and
        // only the base is wrong — which is the failure that actually happens,
        // and the one with a one-line fix. Naming the correct base turns the
        // report into an instruction instead of a list of symptoms.
        const diffs = report.drift.filter(d => d.slug === product.slug).map(d => d.diff);
        if (diffs.length === dbTiers.length && diffs.length > 0 && diffs.every(d => d === diffs[0])) {
            report.suggestedBase.push({
                slug: product.slug,
                label: product.label,
                current: base,
                shouldBe: base - diffs[0],
            });
        }

        if (drifted === 0 && !missingInDb.length && !missingInScale.length) {
            report.cleanProducts.push(product.slug);
        }
    }

    report.drift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    return report;
}

/** True when nothing at all disagrees — the only state that needs no action. */
export function isPricingClean(report: PricingAuditReport): boolean {
    return report.drift.length === 0
        && report.missingInDb.length === 0
        && report.missingInScale.length === 0
        && report.missingProducts.length === 0
        && report.tableDrift.length === 0
        && report.tableMissing.length === 0
        && report.tableExtra.length === 0;
}

/** Ukrainian summary for the ops digest and the Telegram alert. */
export function describePricingAudit(report: PricingAuditReport): string[] {
    const lines: string[] = [];
    for (const item of report.suggestedBase) {
        lines.push(
            `${item.label}: базова ціна ${item.current} ₴ замість ${item.shouldBe} ₴ — `
            + `кожна конфігурація йде на ${item.current - item.shouldBe} ₴ мимо.`
        );
    }
    const explained = new Set(report.suggestedBase.map(s => s.slug));
    for (const d of report.drift) {
        if (explained.has(d.slug)) continue;
        lines.push(
            `${d.label}, ${d.pages} стор.: сайт рахує ${d.actual} ₴, прайс каже ${d.expected} ₴ `
            + `(різниця ${d.diff > 0 ? '+' : ''}${d.diff} ₴).`
        );
    }
    for (const m of report.missingInDb) {
        lines.push(`${m.label}: у прайсі є ${m.pages.join(', ')} стор., а на сайті цих варіантів нема.`);
    }
    for (const m of report.missingInScale) {
        lines.push(`${m.label}: на сайті продається ${m.pages.join(', ')} стор., а в прайсі такої ціни нема.`);
    }
    for (const slug of report.missingProducts) {
        lines.push(`Товар ${slug} очікується аудитом, але його нема в базі.`);
    }
    for (const d of report.tableDrift) {
        lines.push(
            `${d.label}, ${d.pages} стор.: таблиця page_product_prices каже ${d.table} ₴, `
            + `а прайс у коді ${d.code} ₴ — до перемикання читання це треба звести.`
        );
    }
    for (const m of report.tableMissing) {
        lines.push(`${m.label}: у таблиці page_product_prices бракує тарифів на ${m.pages.join(', ')} стор.`);
    }
    for (const m of report.tableExtra) {
        lines.push(`${m.label}: у таблиці page_product_prices є зайві тарифи на ${m.pages.join(', ')} стор., яких прайс не знає.`);
    }
    return lines;
}
