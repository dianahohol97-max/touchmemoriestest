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
    /** Canonical size key, or '' when the product has no size choice. */
    variant: string;
    /** The size exactly as the customer sees it, for the admin screen. */
    variantLabel: string;
    /** Product name with the size appended, which is what gets matched. */
    name: string;
};

/** Composite key for the map: one row per product and size. */
export function mapKey(slug: string, variant: string): string {
    return `${slug}::${variant || ''}`;
}

export type MatchRow = {
    site_slug: string;
    site_variant: string;
    site_variant_label: string;
    site_product_name: string;
    keycrm_offer_id: string | null;
    keycrm_sku: string | null;
    keycrm_name: string | null;
    match_type: MatchType | null;
    match_score: number | null;
    confirmed: boolean;
    /** Runners-up, so a human confirming a fuzzy match can see what it beat. */
    alternatives: Array<{ keycrm_offer_id: string; keycrm_name: string; score: number }>;
    /** A human's free-text explanation, kept across re-runs of the report. */
    note?: string | null;
    /**
     * Set when several website products all point at this same CRM item. That
     * is not a matcher failure — it usually means the CRM keeps one generic
     * entry ("Маркер") where the site sells variants ("Маркер золотий",
     * "Маркер срібний") — but it is a decision only a person can make, so such
     * a row is never presented as a confident match.
     */
    ambiguous_with?: string[];
};

/**
 * Reduce a product name to comparable words.
 *
 * Ukrainian retail names are full of decoration that carries no meaning for
 * matching: guillemets, quotes, dashes, and the unit noise ("шт"). Numbers are
 * kept deliberately — "на 200 фото" and "на 500 фото" are different products,
 * and dropping the digits would happily match them to each other.
 */
/**
 * Dimensions are written three different ways in this data — "30×20" with the
 * multiplication sign, "30х20" with a Cyrillic х, and "10x15" with a Latin x —
 * and some carry decimals ("7.5x10"). Left alone they tokenise differently and
 * two spellings of the same size never match. Everything collapses to a single
 * canonical token: 30x20.
 */
const DIMENSION_RE = /(\d+(?:[.,]\d+)?)\s*[x×х*]\s*(\d+(?:[.,]\d+)?)/giu;

function canonicaliseDimensions(value: string): string {
    return String(value || '').replace(
        DIMENSION_RE,
        (_m, a: string, b: string) => `${a.replace(',', '.')}x${b.replace(',', '.')}`,
    );
}

/**
 * The size a line refers to, in a form both systems can be keyed by.
 *
 * Falls back to the whole label when no dimensions are present, so sizes named
 * in words ("Міні", "Polaroid") still produce a stable key instead of silently
 * collapsing into one another.
 */
export function sizeKey(label: string): string {
    const canonical = canonicaliseDimensions(label);
    const match = canonical.match(/\d+(?:\.\d+)?x\d+(?:\.\d+)?/u);
    if (match) return match[0];

    return String(label || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
}

export function normaliseName(value: string): string[] {
    const canonical = canonicaliseDimensions(String(value || '')).toLowerCase();

    // Dimension tokens are lifted out before punctuation is stripped, otherwise
    // the decimal point in "7.5x10" splits it into two meaningless fragments.
    const dimensions: string[] = [];
    const rest = canonical.replace(/\d+(?:\.\d+)?x\d+(?:\.\d+)?/gu, (m) => {
        dimensions.push(m);
        return ' ';
    });

    const words = rest
        .replace(/[«»"'`’]/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(' ')
        .map(w => w.trim())
        .filter(w => w.length > 1 || /\d/.test(w));

    return [...words, ...dimensions];
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
    // "Numbers" here means both counts ("200") and dimensions ("30x20"): a
    // 23×23 wish book and a 30×20 one are as different as a 200-photo album and
    // a 500-photo one, and both distinctions live entirely in the digits.
    const numbersA = [...setA].filter(w => /^\d/.test(w));
    const numbersB = [...setB].filter(w => /^\d/.test(w));
    if (numbersA.length && numbersB.length && !numbersA.some(n => numbersB.includes(n))) {
        return 0;
    }

    let shared = 0;
    for (const word of setA) if (setB.has(word)) shared++;

    const dice = (2 * shared) / (setA.size + setB.size);

    // The catalogues describe things at different granularity: what the site
    // calls "Постер зоряного неба" is simply "Постер" in the CRM. Word overlap
    // alone punishes that pair for the CRM name being short (0.50) even though
    // every word of the shorter name appears in the longer one. Blending in the
    // overlap coefficient lifts a contained name to a level where it is offered
    // for confirmation (0.75) without ever reaching the confidence of a genuine
    // full match — a one-word name is inherently ambiguous and must be decided
    // by a person.
    const overlap = shared / Math.min(setA.size, setB.size);

    return Math.max(dice, (dice + overlap) / 2);
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
        .select('slug, name, is_active, options')
        .not('slug', 'is', null)
        .order('name');

    if (error) throw error;

    const products: SiteProduct[] = [];

    for (const row of (data || []).filter((p: any) => p.is_active !== false)) {
        const name = String(row.name || '').trim();
        const slug = String(row.slug);

        // Sizes live in the product's option groups, in the group named
        // "Розмір". A product without one is a single item on both sides.
        const groups = Array.isArray(row.options) ? row.options : [];
        const sizeGroup = groups.find((g: any) => String(g?.name || '').toLowerCase().includes('розмір'));
        const sizes = Array.isArray(sizeGroup?.options) ? sizeGroup.options : [];

        if (!sizes.length) {
            products.push({ slug, variant: '', variantLabel: '', name });
            continue;
        }

        for (const size of sizes) {
            const label = String(size?.label || size?.value || '').trim();
            if (!label) continue;

            products.push({
                slug,
                // Keyed off the label, because the label is what an order line
                // stores — deriving the key from `value` here and from `label`
                // at push time would produce two keys for one size.
                variant: sizeKey(label),
                variantLabel: label,
                name: `${name} ${label}`.trim(),
            });
        }
    }

    return products;
}

export async function fetchSavedMap(): Promise<Record<string, any>> {
    const supabase = getAdminClient();
    const { data, error } = await supabase.from('keycrm_product_map').select('*');
    if (error) throw error;

    const byKey: Record<string, any> = {};
    for (const row of data || []) byKey[mapKey(row.site_slug, row.site_variant)] = row;
    return byKey;
}

/**
 * Only mappings a human has confirmed, keyed by slug — this is what the order
 * push consults.
 */
export async function fetchConfirmedMap(): Promise<Record<string, { offer_id: string | null; sku: string | null; name: string | null }>> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('keycrm_product_map')
        .select('site_slug, site_variant, keycrm_offer_id, keycrm_sku, keycrm_name')
        .eq('confirmed', true);

    if (error) {
        console.error('[keycrm-catalogue] confirmed map read failed:', error.message);
        return {};
    }

    const map: Record<string, { offer_id: string | null; sku: string | null; name: string | null }> = {};
    for (const row of data || []) {
        map[mapKey(row.site_slug, row.site_variant)] = {
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
        const savedRow = saved[mapKey(product.slug, product.variant)];

        if (savedRow?.confirmed) {
            if (savedRow.keycrm_offer_id) usedOfferIds.add(String(savedRow.keycrm_offer_id));
            rows.push({
                site_slug: product.slug,
                site_variant: product.variant,
                site_variant_label: product.variantLabel,
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
            site_variant: product.variant,
            site_variant_label: product.variantLabel,
            site_product_name: product.name,
            // An unconfirmed row keeps whatever a person already wrote on it —
            // re-running the report must not eat Аліна's explanations.
            note: savedRow?.note ?? null,
            keycrm_offer_id: best?.offer.offer_id ?? null,
            keycrm_sku: best?.offer.sku ?? null,
            keycrm_name: best?.offer.name ?? null,
            match_type: best?.type ?? null,
            match_score: best?.score ?? null,
            confirmed: false,
            alternatives,
        });
    }

    // Mark every CRM offer that ended up as the proposal for more than one
    // product. A generic CRM entry covering several site variants is a real
    // situation, and the honest response is to surface it rather than let one
    // of the products win silently.
    const claimants = new Map<string, string[]>();
    for (const row of rows) {
        if (row.confirmed || !row.keycrm_offer_id) continue;
        const list = claimants.get(row.keycrm_offer_id) || [];
        list.push(row.site_product_name || row.site_slug);
        claimants.set(row.keycrm_offer_id, list);
    }

    for (const row of rows) {
        if (row.confirmed || !row.keycrm_offer_id) continue;
        const list = claimants.get(row.keycrm_offer_id) || [];
        if (list.length > 1) {
            row.ambiguous_with = list.filter(name => name !== (row.site_product_name || row.site_slug));
        }
    }

    const isStrong = (r: MatchRow) =>
        !r.confirmed && (r.match_score ?? 0) >= STRONG_SCORE && !r.ambiguous_with;

    const counts = {
        confirmed: rows.filter(r => r.confirmed).length,
        strong: rows.filter(isStrong).length,
        weak: rows.filter(r => !r.confirmed && r.match_score !== null && !isStrong(r)).length,
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

export type CostSyncReport = {
    dry_run: boolean;
    offers_read: number;
    /** Which API field the costs came from — empty means the account exposes none. */
    cost_fields: string[];
    updated_products: Array<{ slug: string; from: number | null; to: number }>;
    unchanged: number;
    /** Sizes of one product reporting different costs — never auto-resolved. */
    conflicts: Array<{ slug: string; costs: Array<{ variant: string; cost: number }> }>;
    /** Confirmed mappings whose CRM item carries no cost at all. */
    without_cost: string[];
};

/**
 * Pull purchase costs from KeyCRM into the site's product cards.
 *
 * The CRM is where costs are actually maintained, and today only 34 of 79
 * website products carry one — which means the margin figures on the admin
 * order card are computed from a blank for more than half the catalogue.
 *
 * Two rules:
 *
 *  1. Costs travel only along confirmed mappings. An unconfirmed guess about
 *     which CRM item a product is would put a wrong cost into a margin report,
 *     and a wrong number is worse than a missing one because it looks fine.
 *
 *  2. The site stores one cost per product while the CRM stores one per size.
 *     When the sizes of a product disagree, nothing is written and the conflict
 *     is reported — picking one silently would misprice everything else.
 */
export async function syncCostPrices(opts?: { dryRun?: boolean }): Promise<CostSyncReport> {
    const dryRun = opts?.dryRun === true;
    const supabase = getAdminClient();

    const offers = await fetchKeycrmOffers();
    const offerById = new Map(offers.map(o => [o.offer_id, o]));

    const { data: mappings, error } = await supabase
        .from('keycrm_product_map')
        .select('site_slug, site_variant, keycrm_offer_id')
        .eq('confirmed', true)
        .not('keycrm_offer_id', 'is', null);

    if (error) throw error;

    const costsByProduct = new Map<string, Array<{ variant: string; cost: number }>>();
    const withoutCost: string[] = [];

    for (const row of mappings || []) {
        const offer = offerById.get(String(row.keycrm_offer_id));
        const cost = offer?.cost ?? null;

        if (cost === null) {
            withoutCost.push(`${row.site_slug}${row.site_variant ? ` (${row.site_variant})` : ''}`);
            continue;
        }

        const list = costsByProduct.get(row.site_slug) || [];
        list.push({ variant: row.site_variant || '', cost });
        costsByProduct.set(row.site_slug, list);

        if (!dryRun) {
            await supabase
                .from('keycrm_product_map')
                .update({ keycrm_cost_price: cost, keycrm_cost_synced_at: new Date().toISOString() })
                .eq('site_slug', row.site_slug)
                .eq('site_variant', row.site_variant || '');
        }
    }

    const slugs = [...costsByProduct.keys()];
    const { data: products } = slugs.length
        ? await supabase.from('products').select('slug, cost_price').in('slug', slugs)
        : { data: [] as any[] };

    const currentBySlug = new Map((products || []).map((p: any) => [p.slug, p.cost_price]));

    const updated: CostSyncReport['updated_products'] = [];
    const conflicts: CostSyncReport['conflicts'] = [];
    let unchanged = 0;

    for (const [slug, list] of costsByProduct) {
        const distinct = [...new Set(list.map(c => c.cost))];

        if (distinct.length > 1) {
            conflicts.push({ slug, costs: list });
            continue;
        }

        const cost = distinct[0];
        const current = Number(currentBySlug.get(slug) ?? 0);

        if (Math.abs(current - cost) < 0.005) {
            unchanged++;
            continue;
        }

        updated.push({ slug, from: currentBySlug.get(slug) ?? null, to: cost });

        if (!dryRun) {
            const { error: updateError } = await supabase
                .from('products')
                .update({ cost_price: cost, cost_price_currency: 'UAH' })
                .eq('slug', slug);

            if (updateError) {
                console.error(`[keycrm-costs] failed to update ${slug}:`, updateError.message);
            }
        }
    }

    return {
        dry_run: dryRun,
        offers_read: offers.length,
        cost_fields: [...new Set(offers.map(o => o.cost_field).filter(Boolean) as string[])],
        updated_products: updated,
        unchanged,
        conflicts,
        without_cost: withoutCost,
    };
}

/** Persist decisions from the admin screen. Upsert by slug — one row per product. */
export async function saveMappings(rows: Array<{
    site_slug: string;
    site_variant?: string;
    site_variant_label?: string;
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
        // Normalised here as well as on read: a row saved with a raw label
        // ("30×20 см (горизонтальна)") would never be found again by the push,
        // which only ever looks up canonical keys.
        site_variant: row.site_variant ? sizeKey(row.site_variant) : '',
        updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
        .from('keycrm_product_map')
        .upsert(payload, { onConflict: 'site_slug,site_variant' });

    if (error) throw error;
    return { saved: payload.length };
}
