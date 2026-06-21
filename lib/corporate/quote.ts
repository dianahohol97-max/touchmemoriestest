/**
 * Corporate proposal calculation.
 *
 * Each corporate product can carry `price_tiers` — an array of
 * { min_qty, unit_price } sorted ascending by min_qty. Given a requested
 * quantity, we pick the highest tier whose min_qty <= qty.
 *
 * If a product has no tiers yet, we cannot price it automatically — the
 * request falls back to the semi-automatic flow ("we'll calculate and send").
 */

export interface PriceTier {
    min_qty: number;
    unit_price: number;
}

export interface BriefLine {
    product: string;       // product name (snapshot)
    slug?: string;         // corporate_products.slug
    qty: number;
    options?: Record<string, string>;
}

export interface ProposalLine extends BriefLine {
    unit_price: number;
    line_total: number;
}

export interface ProposalResult {
    /** Fully priced (every line had a matching tier). */
    complete: boolean;
    lines: ProposalLine[];
    total: number;
    /** Names of products that could not be priced (no tiers / qty too low). */
    unpriced: string[];
}

/** Pick unit price for a quantity from a tier list. Returns null if none fits. */
export function unitPriceForQty(tiers: PriceTier[] | null | undefined, qty: number): number | null {
    if (!Array.isArray(tiers) || tiers.length === 0 || qty <= 0) return null;
    const sorted = [...tiers].filter(t => Number.isFinite(t.min_qty) && Number.isFinite(t.unit_price))
        .sort((a, b) => a.min_qty - b.min_qty);
    let chosen: number | null = null;
    for (const t of sorted) {
        if (qty >= t.min_qty) chosen = t.unit_price;
    }
    return chosen;
}

/**
 * Build a proposal from brief lines and a map of slug → price_tiers.
 * `complete` is true only if every line was priced.
 */
export function buildProposal(
    brief: BriefLine[],
    tiersBySlug: Map<string, PriceTier[]>,
): ProposalResult {
    const lines: ProposalLine[] = [];
    const unpriced: string[] = [];
    let total = 0;

    for (const line of brief) {
        const tiers = line.slug ? tiersBySlug.get(line.slug) : null;
        const unit = unitPriceForQty(tiers, line.qty);
        if (unit == null) {
            unpriced.push(line.product);
            lines.push({ ...line, unit_price: 0, line_total: 0 });
            continue;
        }
        const lineTotal = Math.round(unit * line.qty);
        total += lineTotal;
        lines.push({ ...line, unit_price: unit, line_total: lineTotal });
    }

    return { complete: unpriced.length === 0 && brief.length > 0, lines, total, unpriced };
}
