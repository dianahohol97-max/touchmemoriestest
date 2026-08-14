import { getAdminClient } from '@/lib/supabase/admin';
import { fetchKeycrmOffers, fetchKeycrmOffersByIds, fetchKeycrmOffersByProduct, keycrmRequest, type KeycrmOffer } from '@/lib/automation/keycrm';

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
/**
 * The slug of an ordered line.
 *
 * Two cart flows write it under different names — `slug` and `product_slug` —
 * and 67 of the last 90 days' line items carry only the second. Reading just
 * `slug` left them with no catalogue link at all: order 13876's magazine went
 * into KeyCRM as a bare name with no offer and no SKU, although the pair was
 * confirmed in the map (Diana, 2026-08-14: «мало бути синхронізовано»).
 */
export function itemSlug(item: any): string {
    return String(item?.slug || item?.product_slug || '').trim();
}

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

    // Active swatch colours per cover type, for the colour-split products
    // below. One query for all of them — the table is tiny.
    const coverColoursByType = new Map<string, string[]>();
    const { data: colourRows } = await supabase
        .from('cover_colors')
        .select('name, cover_type_id, active')
        .eq('active', true);
    for (const c of colourRows || []) {
        const key = String(c.cover_type_id || '');
        const name = String(c.name || '').trim();
        if (!key || !name) continue;
        const list = coverColoursByType.get(key) || [];
        list.push(name);
        coverColoursByType.set(key, list);
    }

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
            // Some products are split in the CRM by COLOUR instead of size:
            // «Файликовий велюровий альбом на 200 фото» is seven separate CRM
            // products, one per velour colour (Diana, 2026-08-11). The site
            // keeps them as one product whose colours come from the swatch
            // table, so the colour is this product's variant dimension.
            const swatchGroup = groups.find((g: any) => g?.cover_type_id);
            const colours = swatchGroup ? (coverColoursByType.get(String(swatchGroup.cover_type_id)) || []) : [];

            if (colours.length) {
                for (const colour of colours) {
                    products.push({
                        slug,
                        variant: sizeKey(colour),
                        variantLabel: colour,
                        name: `${name} ${colour}`.trim(),
                    });
                }
                continue;
            }

            products.push({ slug, variant: '', variantLabel: '', name });
            continue;
        }

        // Photobooks are split in the CRM by size AND page count («Розмір:
        // 20х20 Кількість сторінок: 22» is its own item, and its stock and
        // purchase price are its own — Diana, 2026-08-11: «важливо»). When the
        // site product offers a page count, it becomes the second half of the
        // key, so an order attaches to the exact item it consumes.
        const pageGroup = groups.find((g: any) => /сторін/i.test(String(g?.name || '')));
        const pageValues: string[] = (Array.isArray(pageGroup?.options) ? pageGroup.options : [])
            .map((o: any) => String(o?.value ?? o?.label ?? '').trim())
            .filter((v: string) => /^\d+$/.test(v));

        for (const size of sizes) {
            const label = String(size?.label || size?.value || '').trim();
            if (!label) continue;

            if (pageValues.length) {
                for (const pages of pageValues) {
                    products.push({
                        slug,
                        variant: `${sizeKey(label)}-${pages}`,
                        variantLabel: `${label}, ${pages} стор.`,
                        name: `${name} ${label} ${pages} сторінок`.trim(),
                    });
                }
                continue;
            }

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
    /** Per-size costs written into the product's variants array. */
    updated_variants: Array<{ slug: string; sizes: Array<{ variant: string; cost: number }> }>;
    /** Per-size SALE prices written for products following the CRM. */
    updated_prices: Array<{ slug: string; sizes: Array<{ variant: string; price: number }> }>;
    /** Price moves too large to trust — almost always a wrong pair. Not applied. */
    price_review: Array<{ slug: string; variant: string; from: number; to: number }>;
    unchanged: number;
    /** Sizes with differing costs on a product that has no variants array to hold them. */
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

    await backfillMissingOffers(mappings || [], offerById);

    const costsByProduct = new Map<string, Array<{ variant: string; cost: number }>>();
    const pricesByProduct = new Map<string, Array<{ variant: string; price: number }>>();
    const withoutCost: string[] = [];

    // Who follows the CRM's sale prices. Started as an allowlist (Diana,
    // 2026-08-11: «поки що ні, тільки для холстів»); after verifying product
    // after product she made it the rule — «використовуй CRM як джерело
    // правди». settings('keycrm_price_follow_all') = true means every
    // CONFIRMED pair follows; the slug list stays as the narrower mode and as
    // the way back if a product ever needs a site-owned price again.
    const [{ data: followAllSetting }, { data: followSetting }, { data: guardSetting }, { data: excludeSetting }] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'keycrm_price_follow_all').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'keycrm_price_follow_slugs').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'keycrm_price_guard_pct').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'keycrm_price_follow_exclude').maybeSingle(),
    ]);
    const followAll = followAllSetting?.value === true || followAllSetting?.value === 'true';
    const followList = new Set<string>(Array.isArray(followSetting?.value) ? followSetting.value.map(String) : []);
    // Products whose site price must NEVER follow the CRM, whatever the mode.
    // Two real reasons so far: the gift certificate's CRM price is the cost of
    // the card (25 ₴) while the site price is the customer's nominal (100 ₴),
    // and the hard-cover journal is one CRM item per size while the site sells
    // a base price plus page steps — copying one size's price onto the base
    // would reprice every journal.
    const followExclude = new Set<string>(Array.isArray(excludeSetting?.value) ? excludeSetting.value.map(String) : []);
    const priceFollow = { has: (slug: string) => !followExclude.has(slug) && (followAll || followList.has(slug)) };

    for (const row of mappings || []) {
        const offer = offerById.get(String(row.keycrm_offer_id));
        const cost = offer?.cost ?? null;

        // The CRM's SALE price is recorded alongside the cost (Diana,
        // 2026-08-11: «в CRM ціни мають бути» — they do, and losing them on
        // sync made the map half-blind). Stored on the mapping row only;
        // whether a site price follows the CRM one stays a human decision.
        const salePrice = Number.isFinite(offer?.price) && (offer?.price ?? 0) > 0 ? offer!.price : null;
        if (salePrice !== null) {
            const priceList = pricesByProduct.get(row.site_slug) || [];
            priceList.push({ variant: row.site_variant || '', price: salePrice });
            pricesByProduct.set(row.site_slug, priceList);

            if (!dryRun) {
                await supabase
                    .from('keycrm_product_map')
                    .update({ keycrm_price: salePrice })
                    .eq('site_slug', row.site_slug)
                    .eq('site_variant', row.site_variant || '');
            }
        }

        // Stock rides along with the price: the CRM is where the team counts
        // markers, corners and tape, and the site has no inventory of its own.
        if (!dryRun && offer && offer.quantity !== null && offer.quantity !== undefined) {
            await supabase
                .from('keycrm_product_map')
                .update({ crm_stock: offer.quantity, crm_stock_synced_at: new Date().toISOString() })
                .eq('site_slug', row.site_slug)
                .eq('site_variant', row.site_variant || '');
        }

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

    const slugs = [...new Set([...costsByProduct.keys(), ...pricesByProduct.keys()])];
    const { data: products } = slugs.length
        ? await supabase.from('products').select('slug, cost_price, variants, price').in('slug', slugs)
        : { data: [] as any[] };

    const productBySlug = new Map((products || []).map((p: any) => [p.slug, p]));

    const updated: CostSyncReport['updated_products'] = [];
    const updatedVariants: CostSyncReport['updated_variants'] = [];
    const updatedPrices: CostSyncReport['updated_prices'] = [];
    // Prices that moved so far they are more likely a wrong PAIR than a real
    // price change (live proof: the Instax cartridge was linked to the camera
    // offer — 1059 ₴ would have become 4299 ₴, and the digital frame 2400 ₴
    // would have collapsed to 349 ₴). Reported for a human, never applied.
    const priceReview: Array<{ slug: string; variant: string; from: number; to: number }> = [];
    const guardPct = Number(guardSetting?.value ?? 60) || 60;
    const isWildJump = (from: number, to: number) =>
        from > 0 && Math.abs(to - from) / from > guardPct / 100;
    const conflicts: CostSyncReport['conflicts'] = [];
    let unchanged = 0;

    for (const slug of slugs) {
        const list = costsByProduct.get(slug) || [];
        const product = productBySlug.get(slug);
        const distinct = [...new Set(list.map(c => c.cost))];
        const patch: Record<string, any> = {};

        // Per-size costs live on the product's own variants (Diana,
        // 2026-08-12: «Поправ щоб на сайті теж так було»). Each variant entry
        // is matched by its canonical size — legacy entries name the size in a
        // `size` field, newer ones in `name` — and gets the CRM's закупівельна
        // вартість written in. Unknown keys on the entries are preserved
        // untouched.
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        if (variants.length) {
            const costBySize = new Map(list.map(c => [c.variant, c.cost]));
            const written: Array<{ variant: string; cost: number }> = [];

            let nextVariants = variants.map((v: any) => {
                const key = sizeKey(String(v?.size ?? v?.name ?? ''));
                const cost = costBySize.get(key);
                if (cost === undefined) return v;
                if (Math.abs(Number(v?.cost_price ?? 0) - cost) < 0.005) return v;
                written.push({ variant: key, cost });
                return { ...v, cost_price: cost };
            });

            // Sale prices follow the CRM for products in scope (see
            // priceFollow above). Applied on top of the
            // cost-updated array so one products.update carries both.
            const priceList = priceFollow.has(slug) ? pricesByProduct.get(slug) : undefined;
            if (priceList?.length) {
                const priceBySize = new Map(priceList.map(p => [p.variant, p.price]));
                const priceWritten: Array<{ variant: string; price: number }> = [];
                nextVariants = nextVariants.map((v: any) => {
                    const key = sizeKey(String(v?.size ?? v?.name ?? ''));
                    const price = priceBySize.get(key);
                    if (price === undefined) return v;
                    const current = Number(v?.price ?? 0);
                    if (Math.abs(current - price) < 0.005) return v;
                    if (isWildJump(current, price)) {
                        priceReview.push({ slug, variant: key, from: current, to: price });
                        return v;
                    }
                    priceWritten.push({ variant: key, price });
                    return { ...v, price };
                });
                if (priceWritten.length) {
                    patch.variants = nextVariants;
                    updatedPrices.push({ slug, sizes: priceWritten });
                }
            }

            if (written.length) {
                patch.variants = nextVariants;
                updatedVariants.push({ slug, sizes: written });
            }
        } else if (distinct.length > 1) {
            // Different costs per size and nowhere on the product to keep them
            // apart — reported rather than averaged into a lie.
            conflicts.push({ slug, costs: list });
            continue;
        }

        // Flat-price products on the follow list (no variants — e.g. the
        // travel book): products.price itself follows the CRM, but only when
        // every linked CRM row agrees on one price — two different prices for
        // a product with a single price field is a conflict, not an average.
        if (!variants.length && priceFollow.has(slug)) {
            const flatPrices = [...new Set((pricesByProduct.get(slug) || []).map(p => p.price))];
            if (flatPrices.length === 1) {
                const price = flatPrices[0];
                const current = Number(product?.price ?? 0);
                if (Math.abs(current - price) >= 0.005) {
                    if (isWildJump(current, price)) {
                        priceReview.push({ slug, variant: '', from: current, to: price });
                    } else {
                        patch.price = price;
                        updatedPrices.push({ slug, sizes: [{ variant: '', price }] });
                    }
                }
            }
        }

        // The single product-level field is written only when every size
        // agrees — it is what the old admin views and the order cost snapshot
        // fall back to.
        if (distinct.length === 1) {
            const cost = distinct[0];
            const current = Number(product?.cost_price ?? 0);
            if (Math.abs(current - cost) >= 0.005) {
                patch.cost_price = cost;
                patch.cost_price_currency = 'UAH';
                updated.push({ slug, from: product?.cost_price ?? null, to: cost });
            }
        }

        if (!Object.keys(patch).length) {
            unchanged++;
            continue;
        }

        if (!dryRun) {
            const { error: updateError } = await supabase
                .from('products')
                .update(patch)
                .eq('slug', slug);

            if (updateError) {
                console.error(`[keycrm-costs] failed to update ${slug}:`, updateError.message);
            }
        }
    }

    if (priceReview.length && !dryRun) {
        await supabase.from('settings').upsert({
            key: 'keycrm_price_review',
            value: { at: new Date().toISOString(), items: priceReview.slice(0, 50) },
            updated_at: new Date().toISOString(),
        });
    }

    return {
        dry_run: dryRun,
        offers_read: offers.length,
        cost_fields: [...new Set(offers.map(o => o.cost_field).filter(Boolean) as string[])],
        updated_products: updated,
        updated_variants: updatedVariants,
        updated_prices: updatedPrices,
        price_review: priceReview,
        unchanged,
        conflicts,
        without_cost: withoutCost,
    };
}

/**
 * Fetch confirmed-mapping offers the bulk catalogue read did not reach.
 *
 * The bulk listing walks a bounded number of pages, so a confirmed mapping can
 * point at a perfectly real offer that is simply beyond the budget (the four
 * markers, offers 21–24). Both the cost sync and the SKU sync would then report
 * it as «не знайдено в каталозі» — a false alarm that also silently stops its
 * costs from syncing. The missing ids are asked for directly and merged into
 * the same map, so only an offer the CRM genuinely no longer has is reported.
 */
async function backfillMissingOffers(
    mappings: Array<{ keycrm_offer_id: any }>,
    offerById: Map<string, KeycrmOffer>,
): Promise<void> {
    const missing = [...new Set(
        mappings
            .map(row => String(row.keycrm_offer_id ?? ''))
            .filter(id => id && !offerById.has(id)),
    )];
    if (!missing.length) return;

    const fetched = await fetchKeycrmOffersByIds(missing);
    for (const offer of fetched) offerById.set(offer.offer_id, offer);
}

export type StockSyncReport = {
    dry_run: boolean;
    followed_slugs: number;
    updated: Array<{ slug: string; from: number | null; to: number }>;
    unchanged: number;
    /** Followed slugs with no confirmed CRM link — stock cannot come from anywhere. */
    unlinked: string[];
};

/**
 * Pull warehouse stock from KeyCRM onto the site (Diana, 2026-08-11: «витягни
 * що є по кількості кожного з цих товарів на складі з кі срм і синхронізуй з
 * сайтом»).
 *
 * Follows the price-follow precedent: ONLY slugs listed in
 * settings('keycrm_stock_follow_slugs') get products.stock overwritten — the
 * CRM warehouse legitimately shows zero for made-to-order products (books,
 * canvases), and following those blindly would mark them «немає в наявності»
 * and stop their sales. The CRM figure also lands on the mapping row
 * (keycrm_stock) for every followed slug, so the reconciliation screen can
 * show both sides. Cheap by construction: reads only the followed slugs'
 * offers, by id.
 */
export async function syncStockFromKeycrm(opts?: { dryRun?: boolean }): Promise<StockSyncReport | { skipped: string }> {
    const dryRun = opts?.dryRun === true;
    const supabase = getAdminClient();

    const { data: followSetting } = await supabase
        .from('settings').select('value').eq('key', 'keycrm_stock_follow_slugs').maybeSingle();
    const followed: string[] = Array.isArray(followSetting?.value) ? followSetting.value.map(String) : [];
    if (!followed.length) return { skipped: 'keycrm_stock_follow_slugs порожній.' };

    const { data: mappings, error } = await supabase
        .from('keycrm_product_map')
        .select('site_slug, site_variant, keycrm_offer_id')
        .eq('confirmed', true)
        .in('site_slug', followed)
        .not('keycrm_offer_id', 'is', null);

    if (error) throw error;

    const bySlug = new Map<string, Array<{ variant: string; offer_id: string }>>();
    for (const row of mappings || []) {
        const list = bySlug.get(row.site_slug) || [];
        list.push({ variant: row.site_variant || '', offer_id: String(row.keycrm_offer_id) });
        bySlug.set(row.site_slug, list);
    }

    const offers = await fetchKeycrmOffersByIds((mappings || []).map(r => String(r.keycrm_offer_id)));
    const offerById = new Map(offers.map(o => [o.offer_id, o]));

    const report: StockSyncReport = {
        dry_run: dryRun,
        followed_slugs: followed.length,
        updated: [], unchanged: 0,
        unlinked: followed.filter(slug => !bySlug.has(slug)),
    };

    const { data: products } = bySlug.size
        ? await supabase.from('products').select('slug, stock').in('slug', [...bySlug.keys()])
        : { data: [] as any[] };
    const productBySlug = new Map((products || []).map((p: any) => [p.slug, p]));

    for (const [slug, rows] of bySlug) {
        // The site keeps ONE balance per product; a per-size product's figure
        // is the total across its linked offers, same as the per-warehouse
        // sum inside one offer. Missing quantities skip the write — an
        // account that hides stock must not zero the site.
        let total = 0;
        let seen = false;
        for (const row of rows) {
            const qty = offerById.get(row.offer_id)?.quantity;
            if (qty === null || qty === undefined) continue;
            total += qty;
            seen = true;

            if (!dryRun) {
                await supabase
                    .from('keycrm_product_map')
                    .update({ keycrm_stock: qty, keycrm_stock_synced_at: new Date().toISOString() })
                    .eq('site_slug', slug)
                    .eq('site_variant', row.variant);
            }
        }
        if (!seen) continue;

        const next = Math.max(0, Math.round(total));
        const current = productBySlug.get(slug)?.stock;
        if (Number(current) === next) {
            report.unchanged++;
            continue;
        }

        report.updated.push({ slug, from: current ?? null, to: next });
        if (!dryRun) {
            const { error: updateError } = await supabase
                .from('products').update({ stock: next }).eq('slug', slug);
            if (updateError) console.error(`[keycrm-stock] failed to update ${slug}:`, updateError.message);
        }
    }

    return report;
}

/**
 * Resolve one pasted KeyCRM number against the live catalogue.
 *
 * The number may be an OFFER id (a variant) or, when pasted from a catalogue
 * URL like …/app/catalog/83/edit, the PARENT product's id. A product id fans
 * out: every size of the site product is linked to the CRM variant carrying the
 * same canonical size. Shared by the admin screen's save and by the cron that
 * resolves links pasted into chat while the CRM was unreachable from there.
 */
export async function linkPastedId(params: {
    pasted: string;
    siteSlug: string;
    /** When the seed row names one size, link exactly that pair. */
    targetVariant?: string;
    note: string | null;
    offers: KeycrmOffer[];
    siteProducts: SiteProduct[];
    /**
     * Sizes already confirmed against a DIFFERENT CRM item, left alone.
     *
     * One site product can span several CRM products — «Настільний
     * фотокалендар» is 115 and 128 in the CRM (Diana, 2026-08-11) — and those
     * links arrive as two separate pastes. Without this the second fan-out
     * would re-target the sizes the first one had already settled, and each
     * paste would undo the previous one.
     */
    keepVariants?: Set<string>;
}): Promise<{ rows: any[]; warnings: string[] }> {
    const { pasted, siteSlug, targetVariant, note, offers, siteProducts, keepVariants } = params;
    const warnings: string[] = [];

    // Several numbers at once: a site product split in the CRM by colour
    // arrives as a list of catalogue links («Файликовий велюровий альбом» is
    // seven CRM products, one per colour). Their variants form ONE family, so
    // a single pass can spread the colours across the site product.
    const ids = pasted.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

    // Catalogue URLs (/app/catalog/ID/edit) always carry the PRODUCT id, and
    // product ids share one number space with offer ids — so an unrelated
    // OFFER №97 must not shadow PRODUCT №97 (live case: «Фото стандартні»,
    // whose fan-out silently matched a foreign offer and produced nothing).
    // The number is read as a product first; only a number that matches no
    // product at all falls back to being an offer id.
    let family: KeycrmOffer[] = [];
    for (const id of ids) {
        let part = offers.filter(o => o.product_id && o.product_id === id);

        // Not in the bulk listing — ask the CRM for exactly this product's
        // variants. The paged catalogue read has a page budget, and a pasted
        // link can point at any product, including one the budget never
        // reached (live case: «Набір для відбитків», product 10).
        if (!part.length) part = await fetchKeycrmOffersByProduct(id);

        if (!part.length) {
            const direct = offers.find(o => String(o.offer_id) === id);
            if (direct) part = [direct];
        }

        family.push(...part);
    }

    if (!family.length) {
        warnings.push(`${siteSlug}: номер ${pasted} не знайдено серед позицій KeyCRM — перевір, що посилання веде на товар, а не на замовлення.`);
        return { rows: [], warnings };
    }

    let variants = siteProducts.filter(p => p.slug === siteSlug);
    if (!variants.length) {
        warnings.push(`${siteSlug}: товар не знайдено на сайті.`);
        return { rows: [], warnings };
    }

    // A seed row that names ONE size means «this size ↔ this CRM number»,
    // not «fan this product out over every size». Live case: the CRM keeps
    // «Постер а4» and «Постер а3» as two separate variant-less products
    // while the site sells them as two sizes of one product — the fan-out
    // could never match, because neither CRM item carries a size at all.
    if (targetVariant) {
        const only = variants.filter(v => v.variant === targetVariant);
        if (only.length) variants = only;
    }

    const familyBySize = new Map(family.map(o => [sizeKey(o.variant_label || o.name), o]));
    const rows: any[] = [];
    const unmatched: string[] = [];

    for (const variant of variants) {
        // A size settled by an earlier paste keeps its pair, unless this seed
        // names that size explicitly — then the human is correcting it.
        if (!targetVariant && keepVariants?.has(variant.variant || '')) continue;

        // Colour variants carry no dimensions, so the canonical size key
        // cannot match them — the CRM item is recognised by CONTAINING the
        // colour word («Велюровий альбом 200 фото Молочний» ↔ «Молочний»).
        // Exactly one containing item counts; two would be a guess.
        const byLabel = (() => {
            const label = String(variant.variantLabel || '').trim().toLowerCase();
            if (!label || /\d/.test(label)) return undefined;
            const hits = family.filter(o =>
                `${o.variant_label || ''} ${o.name || ''}`.toLowerCase().includes(label));
            return hits.length === 1 ? hits[0] : undefined;
        })();

        // Size + page count: the CRM writes them into one label («Розмір:
        // 20х20 Кількість сторінок: 22»), so both tokens must appear. The
        // site's 30×20 is «20х30» in the CRM — the same sheet, turned — so a
        // reversed size counts as a match; the pushed line says which way
        // round it is.
        const bySizeAndPages = (() => {
            const m = String(variant.variant || '').match(/^(\d+(?:\.\d+)?x\d+(?:\.\d+)?)-(\d+)$/);
            if (!m) return undefined;
            const [, size, pages] = m;
            const reversed = size.split('x').reverse().join('x');
            const hits = family.filter(o => {
                const label = canonicaliseDimensions(`${o.variant_label || ''} ${o.name || ''}`).toLowerCase();
                const sizeHit = label.includes(size) || label.includes(reversed);
                const pagesHit = new RegExp(`(?<![\\d.])${pages}(?![\\d.])`).test(label);
                return sizeHit && pagesHit;
            });
            return hits.length === 1 ? hits[0] : undefined;
        })();

        const match = bySizeAndPages
            ?? familyBySize.get(variant.variant || sizeKey(variant.name))
            ?? byLabel
            ?? (family.length === 1 && variants.length === 1 ? family[0] : undefined);
        // Nothing matched by size, but the seed named this exact size and the
        // CRM product is a single item — that IS the pair the human meant.
        const resolved = match ?? (targetVariant && family.length === 1 ? family[0] : undefined);
        if (!resolved) {
            unmatched.push(variant.variantLabel || variant.variant || variant.name);
            continue;
        }
        rows.push({
            site_slug: variant.slug,
            site_variant: variant.variant,
            site_variant_label: variant.variantLabel,
            site_product_name: variant.name,
            keycrm_offer_id: resolved.offer_id,
            keycrm_sku: resolved.sku || null,
            keycrm_name: resolved.name,
            match_type: 'manual',
            match_score: null,
            note,
            confirmed: true,
        });
    }

    if (unmatched.length) {
        // Show what the CRM side actually holds, so the person reading the
        // warning can tell a spelling mismatch from a size that simply does not
        // exist in the CRM yet — the two need different actions (re-paste vs
        // add the variant in KeyCRM).
        const available = family
            .map(o => (o.variant_label || o.name || '').trim())
            .filter(Boolean)
            .slice(0, 12);
        const crmSide = available.length
            ? ` У KeyCRM цей товар має позиції: ${available.join('; ')}.`
            : '';
        warnings.push(
            `${siteSlug}: у KeyCRM не знайшлося варіанта для розмірів: ${unmatched.join(', ')} — ці розміри лишилися незвʼязаними.${crmSide}`
            + (family.length === 1 && variants.length > 1
                ? ' Схоже, товар у CRM існує однією позицією без розмірів — щоб звести по розмірах, додай варіанти в KeyCRM і встав посилання ще раз.'
                : ''),
        );
    }

    return { rows, warnings };
}

/**
 * Finish manual links that could not be validated at save time.
 *
 * Two ways such rows appear: a number pasted on the admin screen before the
 * product-id support existed (the «KeyCRM #190» rows), and a link Diana sends
 * in chat — the assistant's environment cannot reach the KeyCRM API, so it
 * seeds an unconfirmed row and THIS code, running on the server where the API
 * is reachable, resolves it on the next sync pass. Cheap when idle: the caller
 * checks for pending rows before fetching the catalogue.
 */
export async function resolvePendingProductLinks(): Promise<{ resolved: number; warnings: string[] }> {
    const supabase = getAdminClient();

    const { data: numbered, error } = await supabase
        .from('keycrm_product_map')
        .select('site_slug, site_variant, note, keycrm_offer_id')
        .eq('confirmed', false)
        .eq('match_type', 'manual')
        .not('keycrm_offer_id', 'is', null);

    if (error) throw error;

    // The second intake: a link seeded by NAME rather than number («в CRM це
    // Альбом для фото»). The note carries `пошук: <назва в CRM>`; the resolver
    // finds the ONE product whose name matches strongly and fans it out by
    // sizes like a pasted number would. Several strong candidates → a warning
    // naming them, never a guess.
    const { data: named } = await supabase
        .from('keycrm_product_map')
        .select('site_slug, site_variant, note, keycrm_offer_id')
        .eq('confirmed', false)
        .eq('match_type', 'manual')
        .is('keycrm_offer_id', null)
        .ilike('note', 'пошук:%');

    const pending = [...(numbered || []), ...(named || [])];
    if (!pending.length) return { resolved: 0, warnings: [] };

    const offers = await fetchKeycrmOffers();
    const siteProducts = await fetchSiteProducts();

    // One pasted number per product is enough — several size rows of one
    // product may carry the same pending number, and the fan-out covers them
    // all at once.
    const seen = new Set<string>();
    const allRows: any[] = [];
    const allWarnings: string[] = [];

    // The photobook seeding created 460 pending rows at once, and each one
    // that misses the bulk list costs a CRM round trip — enough to blow the
    // function's time budget and lose the whole run. Work is bounded per pass;
    // what is left is picked up half an hour later, and progress is never
    // thrown away.
    const deadline = Date.now() + 3 * 60 * 1000;

    for (const row of pending) {
        if (Date.now() > deadline) {
            allWarnings.push('Часу на прохід не вистачило — решту зв’яжемо наступним запуском.');
            break;
        }
        // Name-seeded rows resolve their number first.
        let pasted = row.keycrm_offer_id ? String(row.keycrm_offer_id) : '';
        if (!pasted && row.note) {
            const query = String(row.note).replace(/^пошук:\s*/i, '').trim();
            const scoreByProduct = new Map<string, { score: number; name: string }>();
            for (const o of offers) {
                if (!o.product_id) continue;
                const s = similarity(query, o.name);
                const prev = scoreByProduct.get(o.product_id);
                if (!prev || s > prev.score) scoreByProduct.set(o.product_id, { score: s, name: o.name });
            }
            const strong = [...scoreByProduct.entries()].filter(([, v]) => v.score >= 0.75);
            if (strong.length === 1) {
                pasted = strong[0][0];
            } else {
                allWarnings.push(strong.length
                    ? `${row.site_slug}: «${query}» підходить кільком товарам CRM (${strong.map(([, v]) => v.name).slice(0, 4).join('; ')}) — уточни посиланням.`
                    : `${row.site_slug}: товар «${query}» не знайдено в каталозі CRM за назвою.`);
                continue;
            }
        }
        if (!pasted) continue;

        const key = `${row.site_slug}::${row.site_variant || ''}::${pasted}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Sizes another CRM product already claimed — the second link of a
        // product split across two CRM cards fills only what is still open.
        const { data: settled } = await supabase
            .from('keycrm_product_map')
            .select('site_variant, keycrm_offer_id')
            .eq('site_slug', row.site_slug)
            .eq('confirmed', true);
        const keepVariants = new Set(
            (settled || [])
                .filter(s => String(s.keycrm_offer_id || '') !== pasted)
                .map(s => String(s.site_variant || '')),
        );

        const { rows, warnings } = await linkPastedId({
            pasted,
            siteSlug: row.site_slug,
            targetVariant: row.site_variant || undefined,
            note: row.note ?? null,
            offers,
            siteProducts,
            keepVariants,
        });
        allRows.push(...rows);
        allWarnings.push(...warnings);
    }

    if (allRows.length) {
        // Deduplicate by (slug, variant) — the same size can only be written
        // once per upsert.
        const byKey = new Map(allRows.map(r => [`${r.site_slug}::${r.site_variant || ''}`, r]));
        await saveMappings([...byKey.values()]);
    }

    // Retire every processed pending row the resolution did not overwrite —
    // e.g. the sizeless seed row of a per-size product, or a number that
    // resolved to nothing. Leaving the trigger in place (a number, or a
    // `пошук:` note) would re-fetch the whole CRM catalogue every half hour
    // forever.
    const written = new Set(allRows.map(r => `${r.site_slug}::${r.site_variant || ''}`));
    for (const row of pending) {
        if (written.has(`${row.site_slug}::${row.site_variant || ''}`)) continue;
        // Rows the pass never reached keep their trigger for the next run.
        if (!seen.has(`${row.site_slug}::${row.site_variant || ''}::${row.keycrm_offer_id}`)
            && Date.now() > deadline) continue;
        const retiredNote = row.note && /^пошук:/i.test(String(row.note))
            ? String(row.note).replace(/^пошук:/i, 'пошук не вдався:')
            : row.note;
        await supabase
            .from('keycrm_product_map')
            .update({ keycrm_offer_id: null, note: retiredNote ?? null, updated_at: new Date().toISOString() })
            .eq('site_slug', row.site_slug)
            .eq('site_variant', row.site_variant || '')
            .eq('confirmed', false);
    }

    // The warnings are the ONLY record of why a pasted number resolved to
    // nothing, and runtime logs rot in minutes — persist them where a human
    // (or the assistant) can read them after the fact.
    if (allWarnings.length) {
        await supabase.from('settings').upsert({
            key: 'keycrm_link_warnings',
            value: { at: new Date().toISOString(), warnings: allWarnings.slice(0, 50) },
            updated_at: new Date().toISOString(),
        });
    }

    return { resolved: allRows.length, warnings: allWarnings };
}

export type SkuSyncReport = {
    dry_run: boolean;
    offers_read: number;
    /** CRM offers that received a new SKU (site slug + size). */
    filled: Array<{ slug: string; variant: string; offer_id: string; sku: string }>;
    /** CRM offers that already had a SKU — adopted into the map, never overwritten. */
    adopted: Array<{ slug: string; variant: string; offer_id: string; sku: string }>;
    unchanged: number;
    problems: string[];
};

/**
 * Make order lines attach to the CRM catalogue — by writing SKUs.
 *
 * Learned from order 13807 (TM-001178): KeyCRM's order-create API accepts NO
 * offer_id or product_id on a product line — only `sku`. The offer_id the push
 * had been sending was silently ignored, and since neither the CRM offers nor
 * the site products carried SKUs, every line arrived as free text: readable to
 * a human, attached to no catalogue item, invisible to CRM stock and reports.
 *
 * So the confirmed mapping is turned into a shared article number. For every
 * confirmed pair whose CRM offer has an empty SKU, the site's slug (plus size
 * for per-size products) is written INTO KeyCRM via PUT /offers — identified by
 * offer id, so nothing is matched by name. An offer that already has a SKU is
 * never overwritten; that SKU is adopted into the map instead, and the push
 * sends it from there. Fill-a-blank, both directions, like every other write in
 * this bridge.
 *
 * Manual action, not a cron: it edits Diana's CRM catalogue, and the team may
 * have their own numbering plans for it.
 */
export async function syncSkusToKeycrm(opts?: { dryRun?: boolean }): Promise<SkuSyncReport> {
    const dryRun = opts?.dryRun === true;
    const supabase = getAdminClient();

    const offers = await fetchKeycrmOffers();
    const offerById = new Map(offers.map(o => [o.offer_id, o]));

    const { data: mappings, error } = await supabase
        .from('keycrm_product_map')
        .select('site_slug, site_variant, keycrm_offer_id, keycrm_sku')
        .eq('confirmed', true)
        .not('keycrm_offer_id', 'is', null);

    if (error) throw error;

    await backfillMissingOffers(mappings || [], offerById);

    const report: SkuSyncReport = {
        dry_run: dryRun, offers_read: offers.length,
        filled: [], adopted: [], unchanged: 0, problems: [],
    };

    const toWrite: Array<{ id: number; sku: string }> = [];

    // Rows are handled per OFFER, not per row: several site products may share
    // one CRM item (Diana, 2026-08-11: «Книга побажань, Альбом для вклеювання
    // фото, Книга побажань дитяча — це все один і той же товар» — one physical
    // album sold under three names). A CRM offer has exactly ONE article
    // number, so all its site products must send the SAME sku; writing a slug
    // per row would leave the last writer's number on the offer and every
    // other product's order lines unattached.
    const rowsByOffer = new Map<string, typeof mappings>();
    for (const row of mappings || []) {
        const key = String(row.keycrm_offer_id);
        const list = rowsByOffer.get(key) || [];
        list.push(row);
        rowsByOffer.set(key, list as any);
    }

    for (const [offerId, rows] of rowsByOffer) {
        const offer = offerById.get(offerId);
        if (!offer) {
            report.problems.push(`${rows.map(r => r.site_slug).join(', ')}: офер ${offerId} не знайдено в каталозі KeyCRM.`);
            continue;
        }

        const crmSku = String(offer.sku || '').trim();

        // The CRM's own number wins when it has one; otherwise one number is
        // derived from the alphabetically first pairing, so the choice is
        // stable across runs no matter what order the rows arrive in.
        const ordered = [...rows].sort((a, b) =>
            `${a.site_slug}::${a.site_variant || ''}`.localeCompare(`${b.site_slug}::${b.site_variant || ''}`));
        const lead = ordered[0];
        const sku = crmSku || (lead.site_variant ? `${lead.site_slug}-${lead.site_variant}` : lead.site_slug);

        if (!crmSku) {
            report.filled.push({ slug: lead.site_slug, variant: lead.site_variant || '', offer_id: offer.offer_id, sku });
            toWrite.push({ id: Number(offer.offer_id), sku });
        }

        for (const row of ordered) {
            if (String(row.keycrm_sku || '').trim() === sku) {
                report.unchanged++;
                continue;
            }
            if (crmSku) {
                report.adopted.push({ slug: row.site_slug, variant: row.site_variant || '', offer_id: offer.offer_id, sku });
            }
            if (!dryRun) {
                await supabase
                    .from('keycrm_product_map')
                    .update({ keycrm_sku: sku, updated_at: new Date().toISOString() })
                    .eq('site_slug', row.site_slug)
                    .eq('site_variant', row.site_variant || '');
            }
        }
    }

    if (!dryRun && toWrite.length) {
        // Batched: PUT /offers takes an array, identified by id.
        for (let i = 0; i < toWrite.length; i += 50) {
            const chunk = toWrite.slice(i, i + 50);
            try {
                await keycrmRequest('/offers', { method: 'PUT', body: { offers: chunk } });
            } catch (e: any) {
                report.problems.push(`Запис артикулів у KeyCRM не вдався (${chunk.length} шт): ${e?.message || 'невідома помилка'}`);
            }
        }
    }

    return report;
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
