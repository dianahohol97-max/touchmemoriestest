/**
 * Server-side loader for the photobook price matrix.
 *
 * `/api/pricing/photobook` already serves this table to the browser with a
 * 60-second cache. Order validation needs the same rows inside a route
 * handler, where an HTTP round-trip back to our own app would be wasteful and
 * would make checkout depend on the app being reachable from itself. So we
 * read `photobook_prices` directly and hold it in a module-level cache with
 * the same 60-second TTL — a price migration reaches the validator within a
 * minute, matching the storefront's behaviour.
 *
 * The table is ~466 rows and changes only through admin migrations, so one
 * shared copy per warm lambda is the right trade.
 */

import type { PriceTable } from '@/lib/editor/pricing';

const TTL_MS = 60 * 1000;

let cache: { table: PriceTable; ts: number } | null = null;
/** In-flight request, so concurrent checkouts share one query rather than N. */
let inFlight: Promise<PriceTable | null> | null = null;

type AdminClient = { from: (t: string) => any };

async function fetchTable(admin: AdminClient): Promise<PriceTable | null> {
    const { data, error } = await admin
        .from('photobook_prices')
        .select('page_count, base_price, kalka_surcharge, cover_types ( name ), photobook_sizes ( name )');

    if (error || !data) {
        console.error('[pricing] photobook_prices load failed', error?.message);
        return null;
    }

    const rows = data
        .map((r: any) => ({
            cover_type: Array.isArray(r.cover_types) ? r.cover_types[0]?.name : r.cover_types?.name,
            size: Array.isArray(r.photobook_sizes) ? r.photobook_sizes[0]?.name : r.photobook_sizes?.name,
            page_count: Number(r.page_count),
            base_price: Number(r.base_price),
            kalka_surcharge: Number(r.kalka_surcharge ?? 0),
        }))
        .filter((r: any) => r.cover_type && r.size && Number.isFinite(r.page_count));

    if (rows.length === 0) return null;
    return { rows, fetched_at: new Date().toISOString() };
}

/**
 * Returns the price matrix, or null if it cannot be loaded.
 *
 * A null result must NOT block checkout — the caller falls back to the
 * base-price floor. Supabase being briefly unreachable should not stop
 * customers paying; it should only stop the extra validation.
 */
export async function getPhotobookPriceTable(admin: AdminClient): Promise<PriceTable | null> {
    if (cache && Date.now() - cache.ts < TTL_MS) return cache.table;
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const table = await fetchTable(admin);
            if (table) cache = { table, ts: Date.now() };
            return table ?? cache?.table ?? null;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/** Test seam — drops the cached copy. */
export function __resetPhotobookPriceCache() {
    cache = null;
    inFlight = null;
}
