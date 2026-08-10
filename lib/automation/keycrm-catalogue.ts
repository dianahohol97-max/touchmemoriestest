import { getAdminClient } from '@/lib/supabase/admin';
import { fetchKeycrmOffers, type KeycrmOffer } from '@/lib/automation/keycrm';

/**
 * Reconcile the website catalogue against the KeyCRM catalogue.
 *
 * The two were built independently and share nothing: every website product has
 * an empty `sku`, and the names were written separately, so the same album can
 * be "Фотоальбом на 200 фото «Family»" in one system and something shorter in
 * the other. An order pushed without a resolved link still *looks* right on the
 * CRM card — the line has a name and a price — but it is attached to no
 * catalogue item, so CRM stock and product reports quietly stay empty. That is
 * the failure this module exists to make visible.
 *
 * The matcher proposes; a human confirms. Only confirmed rows are ever used
 * when pushing an order, because a line attached to the wrong product is worse
 * than a line attached to nothing: it moves the wrong stock and poisons the
 * reports it was supposed to fill.
 */

export type MatchType = 'exact-sku' | 'exact-name' | 'fuzzy-name' | 'manual';

export type SiteProduct = {
    slug: string;
    name: string;
};

export type MatchRow = {
    site_slug: string;
    site_product_name: string;
    keycrm_offer_id: string | null;
    keycrm_sku: string | null;
    keycrm_name: string | null;
    match_type: MatchType | null;
    match_score: number | null;
    confirmed: boolean;
    /** Runners-up, so a human confirming a fuzzy match can see what it beat. */
    alternatives: Array<{ keycrm_offer_id: string; keycrm_name: string; score: number }>;
};

/**
 * Reduce a product name to comparable words.
 *
 * Ukrainian retail names are full of decoration that carries no meaning for
 * matching: guillemets, quotes, dashes, and the unit noise ("шт"). Numbers are
 * kept deliberately — "на 200 фото" and "на 500 фото" are different products,
 * and dropping the digits would happily match them to each other.
 */
export function normaliseName(value: string): string[] {
    return String(value || '')
        .toLowerCase()
        .replace(/[«»"'`’]/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(' ')
        .map(w => w.trim())
        .filter(w => w.length > 1 || /\d/.test(w));
}

/**
 * Dice coefficient over word sets: twice the shared words divided by the total.
 * Chosen over edit distance because these names differ by whole words (a missing
 * "файликовий", an added colour) rather than by typos.
 */
export function similarity(a: string, b: string): number {
    const setA = new Set(normaliseName(a));
    const setB = new Set(normaliseName(b));
    if (setA.size === 0 || setB.size === 0) return 0;

    // Numbers are the discriminator in this catalogue, and word overlap alone
    // does not respect that: "велюровий альбом на 200 фото" and the same album
    // for 500 photos share every other word and score 0.73, which is close
    // enough to be proposed with confidence. When both names carry numbers and
    // none of them agree, they are different products no matter how similar the
    // words are.
    const numbersA = [...setA].filter(w => /^\d+$/.test(w));
    const numbersB = [...setB].filter(w => /^\d+$/.test(w));
    if (numbersA.length && numbersB.length && !numbersA.some(n => numbersB.includes(n))) {
        return 0;
    }

    let shared = 0;
    for (const word of setA) if (setB.has(word)) shared++;

    return (2 * shared) / (setA.size + setB.size);
}

// Below this, a proposal is noise rather than a lead worth reading.
const MIN_SCORE = 0.45;

// At or above this the words line up so closely that the pair is worth
// pre-selecting — still shown for confirmation, never auto-confirmed.
const STRONG_SCORE = 0.8;

export function matchProduct(product: SiteProduct, offers: KeycrmOffer[]): {
    best: { offer: KeycrmOffer; score: number; type: MatchType } | null;
    alternatives: Array<{ keycrm_offer_id: string; keycrm_name: string; score: number }>;
} {
    // An SKU that already equals the slug is a deliberate link somebody made,
    // and it beats any name similarity.
    const bySku = offers.find(o => o.sku && o.sku.toLowerCase() === product.slug.toLowerCase());
    if (bySku) {
        return { best: { offer: bySku, score: 1, type: 'exact-sku' }, alternatives: [] };
    }

    const scored = offers
        .map(offer => ({ offer, score: similarity(product.name, offer.name) }))
        .filter(row => row.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return { best: null, alternatives: [] };

    const top = scored[0];
    const type: MatchType = top.score >= 0.999 ? 'exact-name' : 'fuzzy-name';

    return {
        best: { offer: top.offer, score: Math.round(top.score * 100) / 100, type },
        alternatives: scored.slice(1, 4).map(row => ({
            keycrm_offer_id: row.offer.offer_id,
            keycrm_name: row.offer.name,
            score: Math.round(row.score * 100) / 100,
        })),
    };
}

/**
 * Website products that can actually appear in an order.
 *
 * Read from the products table rather than from historical order lines, so a
 * product that has not sold yet is still reconciled before its first order
 * rather than after it.
 */
export async function fetchSiteProducts(): Promise<SiteProduct[]> {
    const supabase = getAdminClient();

    const { data, error } = await supabase
        .from('products')
        .select('slug, name, is_active')
        .not('slug', 'is', null)
        .order('name');

    if (error) throw error;

    return (data || [])
        .filter((p: any) => p.is_active !== false)
        .map((p: any) => ({ slug: String(p.slug), name: String(p.name || '') }));
}

export async function fetchSavedMap(): Promise<Record<string, any>> {
    const supabase = getAdminClient();
    const { data, error } = await supabase.from('keycrm_product_map').select('*');
    if (error) throw error;

    const byslug: Record<string, any> = {};
    for (const row of data || []) byslug[row.site_slug] = row;
    return byslug;
}

/**
 * Only mappings a human has confirmed, keyed by slug — this is what the order
 * push consults.
 */
export async function fetchConfirmedMap(): Promise<Record<string, { offer_id: string | null; sku: string | null; name: string | null }>> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('keycrm_product_map')
        .select('site_slug, keycrm_offer_id, keycrm_sku, keycrm_name')
        .eq('confirmed', true);

    if (error) {
        console.error('[keycrm-catalogue] confirmed map read failed:', error.message);
        return {};
    }

    const map: Record<string, { offer_id: string | null; sku: string | null; name: string | null }> = {};
    for (const row of data || []) {
        map[row.site_slug] = {
            offer_id: row.keycrm_offer_id,
            sku: row.keycrm_sku,
            name: row.keycrm_name,
        };
    }
    return map;
}

export type ReconcileReport = {
    site_products: number;
    keycrm_offers: number;
    counts: { confirmed: number; strong: number; weak: number; unmatched: number };
    rows: MatchRow[];
    /** CRM offers no website product pointed at — usually wholesale or retired items. */
    unused_keycrm_offers: Array<{ offer_id: string; name: string; sku: string }>;
};

/**
 * Build the full comparison. Saved confirmations always win over a fresh
 * proposal, so re-running the report never quietly undoes a human decision.
 */
export async function reconcileCatalogues(): Promise<ReconcileReport> {
    const [products, offers, saved] = await Promise.all([
        fetchSiteProducts(),
        fetchKeycrmOffers(),
        fetchSavedMap(),
    ]);

    const rows: MatchRow[] = [];
    const usedOfferIds = new Set<string>();

    for (const product of products) {
        const savedRow = saved[product.slug];

        if (savedRow?.confirmed) {
            if (savedRow.keycrm_offer_id) usedOfferIds.add(String(savedRow.keycrm_offer_id));
            rows.push({
                site_slug: product.slug,
                site_product_name: product.name,
                keycrm_offer_id: savedRow.keycrm_offer_id,
                keycrm_sku: savedRow.keycrm_sku,
                keycrm_name: savedRow.keycrm_name,
                match_type: savedRow.match_type,
                match_score: savedRow.match_score,
                confirmed: true,
                alternatives: [],
            });
            continue;
        }

        const { best, alternatives } = matchProduct(product, offers);
        if (best?.offer.offer_id) usedOfferIds.add(best.offer.offer_id);

        rows.push({
            site_slug: product.slug,
            site_product_name: product.name,
            keycrm_offer_id: best?.offer.offer_id ?? null,
            keycrm_sku: best?.offer.sku ?? null,
            keycrm_name: best?.offer.name ?? null,
            match_type: best?.type ?? null,
            match_score: best?.score ?? null,
            confirmed: false,
            alternatives,
        });
    }

    const counts = {
        confirmed: rows.filter(r => r.confirmed).length,
        strong: rows.filter(r => !r.confirmed && (r.match_score ?? 0) >= STRONG_SCORE).length,
        weak: rows.filter(r => !r.confirmed && r.match_score !== null && r.match_score < STRONG_SCORE).length,
        unmatched: rows.filter(r => !r.confirmed && r.match_score === null).length,
    };

    return {
        site_products: products.length,
        keycrm_offers: offers.length,
        counts,
        rows,
        unused_keycrm_offers: offers
            .filter(o => !usedOfferIds.has(o.offer_id))
            .slice(0, 100)
            .map(o => ({ offer_id: o.offer_id, name: o.name, sku: o.sku })),
    };
}

/** Persist decisions from the admin screen. Upsert by slug — one row per product. */
export async function saveMappings(rows: Array<{
    site_slug: string;
    site_product_name?: string;
    keycrm_offer_id?: string | null;
    keycrm_sku?: string | null;
    keycrm_name?: string | null;
    match_type?: MatchType | null;
    match_score?: number | null;
    confirmed?: boolean;
    note?: string | null;
}>): Promise<{ saved: number }> {
    const supabase = getAdminClient();
    if (!rows.length) return { saved: 0 };

    const payload = rows.map(row => ({
        ...row,
        updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
        .from('keycrm_product_map')
        .upsert(payload, { onConflict: 'site_slug' });

    if (error) throw error;
    return { saved: payload.length };
}
