// Photobook Pricing
//
// This module is pure: all functions take a `PriceTable` as an argument and
// derive prices from it. The table itself lives in Supabase (photobook_prices)
// and is fetched on the client via `usePhotobookPrices()` from ./usePrices.
//
// Previously this file held a hardcoded ~150-row price table. That table
// drifted from the database (e.g. velour_20×30 was missing entirely, causing
// the editor to show 1200₴ instead of 1985₴ for velour 20×30 / 10pp with
// tracing paper). It has been removed — the database is now the single source
// of truth.

import { normalizeSizeKey } from './utils';

export interface PriceRow {
    cover_type: string;
    size: string;
    page_count: number;
    base_price: number;
    kalka_surcharge: number;
}

export interface PriceTable {
    rows: PriceRow[];
    fetched_at: string;
}

// Normalize a free-form cover type label to the canonical Ukrainian name
// stored in cover_types.name. The DB has five canonical names; everything
// else maps to one of them. Keyword lists cover ALL FIVE locales — the
// configurator passes t('constructor.velour') etc., so pl 'Welur',
// ro 'Velur', de 'Stoff'/'Kunstleder', pl 'Ekoskóra'/'Drukowana',
// ro 'Pânză'/'Imitație de piele'/'Tipărită' must resolve too; previously
// only uk/en matched and other locales fell to the printed default.
export function canonicalCoverType(coverType: string): string {
    const ct = (coverType || '').toLowerCase().trim();
    if (ct.includes('велюр') || ct.includes('velour') || ct.includes('velur') || ct.includes('welur')) return 'Велюр';
    if (ct.includes('тканин') || ct.includes('fabric') || ct.includes('tkanin') || ct.includes('stoff') || ct.includes('pânz') || ct.includes('panz')) return 'Тканина';
    if (ct.includes('шкір') || ct.includes('leather') || ct.includes('faux') || ct.includes('skór') || ct.includes('skor') || ct.includes('leder') || ct.includes('piele')) return 'Шкірзамінник';
    if (ct.includes('випуск') || ct.includes('gradu')) return 'Випускна';
    if (ct.includes('друков') || ct.includes('print') || ct.includes('drukowan') || ct.includes('gedruckt') || ct.includes('tipărit') || ct.includes('tiparit')) return 'Друкована';
    // Default: assume printed if we cannot identify. This matches the old
    // behaviour for unknown labels but is logged so we can spot drift.
    if (typeof window !== 'undefined') {
        console.warn('[pricing] unknown cover type, defaulting to Друкована:', coverType);
    }
    return 'Друкована';
}

// Convert "20×20" / "20x20" / "20*20" to canonical "20×20" matching DB.
function canonicalSize(sizeValue: string): string {
    const key = normalizeSizeKey(sizeValue); // returns "20x20" form
    // DB stores sizes with × (unicode multiplication sign), not x.
    return key.replace(/x/i, '×');
}

// Build an O(1) lookup index from a PriceTable. Cheap (~466 entries) and
// callers can memoize if they want; we don't bother here since the lookups
// in the editor are infrequent (only on config changes / page count changes).
function buildIndex(table: PriceTable): Map<string, PriceRow> {
    const idx = new Map<string, PriceRow>();
    for (const r of table.rows) {
        idx.set(`${r.cover_type}|${r.size}|${r.page_count}`, r);
    }
    return idx;
}

// Page counts available in the DB. Used to find nearest match when the
// requested count doesn't have an exact row (e.g. user drags a slider to 13).
function pageCountsFor(table: PriceTable, cover: string, size: string): number[] {
    const counts: number[] = [];
    for (const r of table.rows) {
        if (r.cover_type === cover && r.size === size) counts.push(r.page_count);
    }
    return counts.sort((a, b) => a - b);
}

function nearestPageCount(counts: number[], target: number): number | null {
    if (counts.length === 0) return null;
    let best = counts[0];
    let bestDist = Math.abs(best - target);
    for (const c of counts) {
        const d = Math.abs(c - target);
        if (d < bestDist) { best = c; bestDist = d; }
    }
    return best;
}

// Core lookup: returns the row that matches cover + size + page_count
// (with nearest-page fallback), or null if no row exists for the cover/size
// combination at all. Callers decide what to do with null — typically they
// fall back to the price the user already saw on the product page.
export function findPriceRow(
    table: PriceTable,
    coverType: string,
    sizeValue: string,
    pageCount: number,
): PriceRow | null {
    if (!table || !table.rows || table.rows.length === 0) return null;
    const cover = canonicalCoverType(coverType);
    const size = canonicalSize(sizeValue);

    const idx = buildIndex(table);
    const exact = idx.get(`${cover}|${size}|${pageCount}`);
    if (exact) return exact;

    const counts = pageCountsFor(table, cover, size);
    const nearest = nearestPageCount(counts, pageCount);
    if (nearest === null) return null;
    return idx.get(`${cover}|${size}|${nearest}`) ?? null;
}

// Returns base price only (no kalka surcharge applied). Used by the product
// page where kalka is its own checkbox.
export function lookupPrice(
    table: PriceTable | null,
    coverType: string,
    sizeValue: string,
    pageCount: number,
    fallbackPrice = 0,
): number {
    if (!table) return fallbackPrice;
    const row = findPriceRow(table, coverType, sizeValue, pageCount);
    return row ? row.base_price : fallbackPrice;
}

// Returns base + kalka surcharge if kalka is enabled. Used by the editor
// where kalka is part of the BookConfig.
export function lookupPriceWithKalka(
    table: PriceTable | null,
    coverType: string,
    sizeValue: string,
    pageCount: number,
    enableKalka: boolean,
    fallbackPrice = 0,
): number {
    if (!table) return fallbackPrice;
    const row = findPriceRow(table, coverType, sizeValue, pageCount);
    if (!row) return fallbackPrice;
    return row.base_price + (enableKalka ? row.kalka_surcharge : 0);
}

// Computes dynamic price for the editor: returns the price for the current
// page count, the price for the base page count (used to display the
// "+X₴ since you added pages" delta), and the diff between them.
//
// `fallbackPrice` is the price the user saw on the product page before
// entering the editor. If the price table fails to load (e.g. Supabase down)
// we return that price so the user is never charged less than they expected.
export function calculateDynamicPrice(
    table: PriceTable | null,
    coverType: string,
    sizeValue: string,
    currentPageCount: number,
    basePageCountStr: string,
    fallbackPrice: number,
    enableKalka: boolean = false,
) {
    const basePageCount = parseInt(basePageCountStr.match(/\d+/)?.[0] || '20', 10);

    const dynamicPrice = lookupPriceWithKalka(
        table, coverType, sizeValue, currentPageCount, enableKalka, fallbackPrice,
    );
    const basePrice = lookupPriceWithKalka(
        table, coverType, sizeValue, basePageCount, enableKalka, fallbackPrice,
    );

    return {
        dynamicPrice,
        basePrice,
        priceDiff: dynamicPrice - basePrice,
    };
}
