import { getAdminClient } from '@/lib/supabase/admin';
import { fetchKeycrmOffersByProduct, type KeycrmOffer } from '@/lib/automation/keycrm';
import { sizeKey } from '@/lib/automation/keycrm-catalogue';

/**
 * Photobook costs, mirrored from KeyCRM.
 *
 * Why photobooks need their own sync instead of keycrm_product_map: the two
 * systems describe them differently. The site prices a photobook from a
 * matrix — cover type × size × page count (photobook_prices, ~460 rows, read
 * by the editor) — while the CRM keeps ONE PRODUCT PER SIZE whose variants
 * are page counts, each carrying its own покупна вартість. A map row is
 * "one site product + one size", which cannot express the page dimension.
 *
 * Diana's rules (2026-08-11), which make this tractable:
 *  · cover type does NOT change price or cost — «вони всі це і є преміум
 *    фотокниги, ціни і собівартості для них однакові». The premium cover
 *    appears in the order as a decoration line: 1 ₴ to the customer (its
 *    price is already inside the book) with the real cost on it; extra
 *    decoration is 180 ₴ / 150 ₴ cost.
 *  · калька is one CRM product with a single price.
 *
 * So cost is a function of (size, pages) alone — exactly what this table
 * holds. Site prices are NOT touched: the editor's matrix stays the source
 * of what customers pay, and the sync only reports where the CRM's price for
 * the same size+pages differs, for a human to reconcile.
 */

/** Page count out of a CRM variant label: «кількість сторінок: 24», «24 ст», «24». */
export function parsePageCount(label: string): number | null {
    const text = String(label || '');
    // Dimensions first — «20х30» must not donate its 30 as a page count.
    const withoutDimensions = text.replace(/\d+\s*[x×х*]\s*\d+/gu, ' ');
    const numbers = [...withoutDimensions.matchAll(/\d+/g)].map(m => parseInt(m[0], 10));
    const plausible = numbers.filter(n => n >= 4 && n <= 200 && n % 2 === 0);
    return plausible.length ? plausible[0] : null;
}

export type PhotobookCostReport = {
    products_read: number;
    rows_written: number;
    /** Size+pages the CRM has but the site's price matrix does not. */
    missing_on_site: string[];
    /** Same size+pages where the CRM's sale price differs from the site's printed-cover price. */
    price_mismatches: Array<{ size: string; pages: number; crm: number; site: number }>;
    problems: string[];
};

/**
 * Pull every photobook product listed in settings('photobook_crm_links') and
 * write one row per (size, page count) into photobook_costs.
 */
export async function syncPhotobookCosts(): Promise<PhotobookCostReport> {
    const supabase = getAdminClient();
    const report: PhotobookCostReport = {
        products_read: 0,
        rows_written: 0,
        missing_on_site: [],
        price_mismatches: [],
        problems: [],
    };

    const { data: linksRow } = await supabase
        .from('settings').select('value').eq('key', 'photobook_crm_links').maybeSingle();
    const productIds: string[] = Array.isArray(linksRow?.value?.printed_covers)
        ? linksRow.value.printed_covers.map(String)
        : [];
    if (!productIds.length) {
        report.problems.push('settings.photobook_crm_links.printed_covers порожній — нема що синхронізувати.');
        return report;
    }

    // The site's printed-cover matrix, for the price comparison.
    const { data: siteRows } = await supabase
        .from('photobook_prices')
        .select('page_count, base_price, photobook_sizes(name), cover_types(name)');
    const sitePriceByKey = new Map<string, number>();
    for (const row of siteRows || []) {
        const cover = (row as any)?.cover_types?.name || '';
        if (cover !== 'Друкована') continue;
        const size = sizeKey(String((row as any)?.photobook_sizes?.name || ''));
        if (!size) continue;
        sitePriceByKey.set(`${size}::${row.page_count}`, Number(row.base_price));
    }

    const rows: any[] = [];

    for (const productId of productIds) {
        let offers: KeycrmOffer[] = [];
        try {
            offers = await fetchKeycrmOffersByProduct(productId);
        } catch (e: any) {
            report.problems.push(`товар ${productId}: ${e?.message || 'не вдалося прочитати з KeyCRM'}`);
            continue;
        }
        if (!offers.length) {
            report.problems.push(`товар ${productId}: у KeyCRM немає позицій.`);
            continue;
        }
        report.products_read++;

        for (const offer of offers) {
            // Size lives in the PRODUCT name («Фотокнига 25х25 см»), pages in
            // the variant label — except for the odd single-variant product
            // whose name carries both («Фотокнига 25х25 16 ст», the size
            // Diana forgot to fold into the main product).
            const size = sizeKey(offer.name || '');
            const pages = parsePageCount(offer.variant_label || '') ?? parsePageCount(offer.name || '');
            if (!/^\d/.test(size) || !pages) {
                report.problems.push(`позиція ${offer.offer_id} (${offer.name} / ${offer.variant_label}): не вдалося визначити розмір або кількість сторінок.`);
                continue;
            }

            rows.push({
                size,
                page_count: pages,
                cost: offer.cost ?? null,
                crm_price: offer.price || null,
                crm_offer_id: offer.offer_id,
                crm_product_id: productId,
                crm_name: `${offer.name} — ${offer.variant_label}`.trim(),
                updated_at: new Date().toISOString(),
            });

            const key = `${size}::${pages}`;
            const sitePrice = sitePriceByKey.get(key);
            if (sitePrice === undefined) {
                report.missing_on_site.push(`${size}, ${pages} стор`);
            } else if (offer.price > 0 && Math.abs(sitePrice - offer.price) > 0.5) {
                report.price_mismatches.push({ size, pages, crm: offer.price, site: sitePrice });
            }
        }
    }

    if (rows.length) {
        // Deduplicate by (size, pages): several CRM products can describe the
        // same combination (the forgotten «25х25 16 ст» overlaps the main
        // 25×25 product). Last one wins — they carry the same numbers.
        const byKey = new Map(rows.map(r => [`${r.size}::${r.page_count}`, r]));
        const deduped = [...byKey.values()];
        const { error } = await supabase
            .from('photobook_costs')
            .upsert(deduped, { onConflict: 'size,page_count' });
        if (error) report.problems.push(`запис у photobook_costs: ${error.message}`);
        else report.rows_written = deduped.length;
    }

    return report;
}
