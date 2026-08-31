/**
 * Authoritative server-side price for a CONFIGURED photobook line.
 *
 * Why this exists
 * ───────────────
 * `/api/orders/submit` receives `subtotal` and `total` from the browser and
 * guards them with a floor built from `products.price × quantity`. For a
 * photobook that base row price is the price of the SMALLEST configuration —
 * `photobook-printed` is 600 ₴ — while a configured book legitimately reaches
 * 4 005 ₴. Every page, cover upgrade and kalka sheet was priced client-side
 * and never re-checked, so a tampered payload claiming `total = 600` for a
 * fully configured book cleared the floor exactly and underpaid by 85%. The
 * Monobank webhook did not catch it either: it compares the charged amount
 * against `orders.total`, which is the same tampered number.
 *
 * This module closes that gap by recomputing the price from the same table
 * the editor prices against (`photobook_prices`, via `lib/editor/pricing.ts`),
 * using the configuration the customer actually submitted. The caller folds
 * the result into the existing price floor, so B2B discounts, the gift
 * certificate floor and the discount ceiling all keep working unchanged.
 *
 * Design rule: NEVER guess
 * ────────────────────────
 * A false positive here rejects a real customer's order, which is worse than
 * the hole it closes. So every function returns null the moment it is not
 * certain — unknown cover label, unparseable page count, no matching row —
 * and the caller falls back to the old base-price floor. We only ever raise
 * the floor on a configuration we positively recognised.
 *
 * The option keys are the Ukrainian labels the configurator writes into
 * `items[].options` (verified against live orders, 2026-08-31):
 *   «Розмір книги»  → "20×30" | "30×20" | "20×20" | "25×25" | "30×30"
 *   «Обкладинка»    → "Друкована" | "Велюр" | "Тканина" | …
 *   «Сторінок»      → "54 сторінок"
 *   «Калька перед першою сторінкою» → "З калькою" (absent when not chosen)
 */

import { findPriceRow, matchCoverType, type PriceTable } from '@/lib/editor/pricing';

/** Option key that marks a line as a configured book. */
const SIZE_KEY = 'Розмір книги';
const COVER_KEY = 'Обкладинка';
const PAGES_KEY = 'Сторінок';
const KALKA_KEY = 'Калька перед першою сторінкою';

export interface ConfiguredBookPrice {
    /** Authoritative price for ONE unit, in base UAH. */
    unitPrice: number;
    cover: string;
    size: string;
    /** The page count the price row was matched on (may be the nearest tier). */
    pageCount: number;
    kalka: boolean;
}

/** True when the line carries a book configuration we should be pricing. */
export function isConfiguredBookItem(options: unknown): boolean {
    return Boolean(
        options && typeof options === 'object' && SIZE_KEY in (options as Record<string, unknown>),
    );
}

/**
 * Recompute one configured book line from the price table.
 * Returns null whenever the configuration cannot be identified with
 * confidence — the caller must then fall back to the base-price floor.
 */
export function priceConfiguredBook(
    table: PriceTable | null,
    options: unknown,
): ConfiguredBookPrice | null {
    if (!table || !table.rows?.length) return null;
    if (!isConfiguredBookItem(options)) return null;

    const opts = options as Record<string, unknown>;
    const size = String(opts[SIZE_KEY] ?? '').trim();
    if (!size) return null;

    // Strict: an unrecognised cover label must not fall back to the cheapest
    // cover. matchCoverType returns null rather than guessing.
    const cover = matchCoverType(String(opts[COVER_KEY] ?? ''));
    if (!cover) return null;

    // "54 сторінок" → 54. Reject anything that isn't a plain positive count.
    const pages = parseInt(String(opts[PAGES_KEY] ?? '').match(/\d+/)?.[0] ?? '', 10);
    if (!Number.isFinite(pages) || pages <= 0) return null;

    // Kalka is either absent or the affirmative label; «Без кальки» must not
    // read as enabled just because the string mentions kalka.
    const kalkaRaw = String(opts[KALKA_KEY] ?? '');
    const kalka = kalkaRaw.includes('З калькою');

    const row = findPriceRow(table, cover, size, pages);
    if (!row) return null;

    const unitPrice = Number(row.base_price) + (kalka ? Number(row.kalka_surcharge) : 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;

    return { unitPrice, cover, size, pageCount: row.page_count, kalka };
}
