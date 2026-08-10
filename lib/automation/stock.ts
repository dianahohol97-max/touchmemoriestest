import { getAdminClient } from '@/lib/supabase/admin';
import { fetchKeycrmOffers } from '@/lib/automation/keycrm';
import { fetchConfirmedMap, mapKey, sizeKey } from '@/lib/automation/keycrm-catalogue';
import { isReadyForCrm } from '@/lib/automation/keycrm-money';

/**
 * Stock: one balance, kept by the site, moved by every real order.
 *
 * The rule Diana set, and the reason it is the only workable one:
 *
 *   The site holds the balance. Orders taken on the site deduct from it, and so
 *   do the Instagram orders mirrored in from KeyCRM — because the stock those
 *   consume is the same physical shelf. A balance that only counted one intake
 *   would drift by exactly the volume of the other.
 *
 * That makes levelling and deducting two DIFFERENT operations that must not run
 * on the same schedule.
 *
 *   syncLevelsFromKeycrm sets the balance to what the CRM says. It is a
 *   correction, run deliberately by a person, because the CRM figure is the
 *   trustworthy one today.
 *
 *   applyStockForOrder subtracts what an order consumed, exactly once, ever.
 *
 * Running the levelling on a schedule would silently undo every deduction made
 * since the previous run, and the balance would sit permanently one sync-period
 * too high. So the levelling is an admin action, never a cron, and this comment
 * is here to stop it becoming one.
 *
 * Deductions are idempotent through the inventory_movements ledger rather than a
 * flag on the order: the ledger already exists, is what the admin stock history
 * reads, and answers "was this order counted" and "why is the balance what it
 * is" with the same row.
 */

export type StockApplyResult = {
    orderId: string;
    orderNumber: string;
    moved: Array<{ product: string; quantity: number; before: number; after: number }>;
    skipped: string[];
};

export type LevelSyncReport = {
    dry_run: boolean;
    offers_read: number;
    /** Empty when the account exposes no stock field at all. */
    stock_seen: boolean;
    updated: Array<{ slug: string; from: number | null; to: number }>;
    unchanged: number;
    conflicts: Array<{ slug: string; levels: Array<{ variant: string; quantity: number }> }>;
    without_stock: string[];
};

/**
 * Set website stock to what KeyCRM holds.
 *
 * Only travels along confirmed catalogue mappings, for the same reason costs do:
 * an unconfirmed guess about which CRM item a product is would write someone
 * else's balance onto it, and a wrong stock figure is worse than a missing one
 * because it silently lets an item be oversold.
 *
 * A product whose sizes report different balances is left alone and reported —
 * the site keeps one figure per product, and picking one of several silently
 * would be a fabrication.
 */
export async function syncLevelsFromKeycrm(opts?: { dryRun?: boolean }): Promise<LevelSyncReport> {
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

    const byProduct = new Map<string, Array<{ variant: string; quantity: number }>>();
    const withoutStock: string[] = [];

    for (const row of mappings || []) {
        const offer = offerById.get(String(row.keycrm_offer_id));
        const quantity = offer?.quantity ?? null;

        if (quantity === null) {
            withoutStock.push(`${row.site_slug}${row.site_variant ? ` (${row.site_variant})` : ''}`);
            continue;
        }

        const list = byProduct.get(row.site_slug) || [];
        list.push({ variant: row.site_variant || '', quantity });
        byProduct.set(row.site_slug, list);
    }

    const slugs = [...byProduct.keys()];
    const { data: products } = slugs.length
        ? await supabase.from('products').select('slug, stock_quantity').in('slug', slugs)
        : { data: [] as any[] };

    const currentBySlug = new Map((products || []).map((p: any) => [p.slug, p.stock_quantity]));

    const updated: LevelSyncReport['updated'] = [];
    const conflicts: LevelSyncReport['conflicts'] = [];
    let unchanged = 0;

    for (const [slug, levels] of byProduct) {
        const distinct = [...new Set(levels.map(l => l.quantity))];

        if (distinct.length > 1) {
            conflicts.push({ slug, levels });
            continue;
        }

        const quantity = distinct[0];
        const current = currentBySlug.get(slug);

        if (Number(current ?? -1) === quantity) {
            unchanged++;
            continue;
        }

        updated.push({ slug, from: current ?? null, to: quantity });
        if (dryRun) continue;

        const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: quantity, track_inventory: true })
            .eq('slug', slug);

        if (updateError) {
            console.error(`[stock] level sync failed for ${slug}:`, updateError.message);
        }
    }

    return {
        dry_run: dryRun,
        offers_read: offers.length,
        stock_seen: offers.some(o => o.quantity !== null),
        updated,
        unchanged,
        conflicts,
        without_stock: withoutStock,
    };
}

/**
 * Deduct what one order consumed, exactly once.
 *
 * The ledger is the guard: a movement row already carrying this order and
 * product means the order was counted, whatever else has happened since. That
 * survives retries, a re-run of the cron, and an order being edited.
 */
export async function applyStockForOrder(order: any, opts?: { dryRun?: boolean }): Promise<StockApplyResult> {
    const dryRun = opts?.dryRun === true;
    const supabase = getAdminClient();

    const result: StockApplyResult = {
        orderId: order.id,
        orderNumber: order.order_number,
        moved: [],
        skipped: [],
    };

    const items = Array.isArray(order?.items) ? order.items : [];
    if (!items.length) return result;

    const slugs = [...new Set(items.map((i: any) => String(i?.slug || '')).filter(Boolean))] as string[];
    if (!slugs.length) {
        result.skipped.push('позиції без артикулу, списати нічого');
        return result;
    }

    const { data: products } = await supabase
        .from('products')
        .select('id, slug, name, stock_quantity, track_inventory')
        .in('slug', slugs);

    const bySlug = new Map((products || []).map((p: any) => [p.slug, p]));

    // Everything already counted for this order, so a re-run moves nothing.
    const { data: existing } = await supabase
        .from('inventory_movements')
        .select('product_id')
        .eq('order_id', order.id)
        .eq('type', 'sale');

    const counted = new Set((existing || []).map((m: any) => m.product_id));

    for (const item of items) {
        const slug = String(item?.slug || '');
        const product = slug ? bySlug.get(slug) : null;

        if (!product) {
            if (slug) result.skipped.push(`${slug}: немає такого товару на сайті`);
            continue;
        }
        if (counted.has(product.id)) continue;

        const quantity = Number(item?.quantity) || 1;
        const before = Number(product.stock_quantity ?? 0);
        const after = before - quantity;

        result.moved.push({ product: product.name || slug, quantity, before, after });
        if (dryRun) continue;

        const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: after })
            .eq('id', product.id);

        if (updateError) {
            result.skipped.push(`${slug}: ${updateError.message}`);
            continue;
        }

        // Written after the balance changes, not before: if this insert fails
        // the balance is wrong by one order, which the history makes visible.
        // Written first, a failed update would leave a ledger entry for a
        // deduction that never happened and the order could never be recounted.
        await supabase.from('inventory_movements').insert({
            product_id: product.id,
            order_id: order.id,
            type: 'sale',
            quantity: -quantity,
            quantity_before: before,
            quantity_after: after,
            reason: order.source === 'keycrm'
                ? `Замовлення з KeyCRM ${order.order_number}`
                : `Замовлення з сайту ${order.order_number}`,
            notes: 'Списано автоматично',
        });

        // Keep the in-memory copy honest for orders that list the same product
        // on two lines.
        product.stock_quantity = after;
    }

    return result;
}

/**
 * Orders whose stock has not been counted yet.
 *
 * Both intakes qualify. An Instagram order consumes the same shelf as a website
 * one, so leaving it out would let the balance drift by exactly the volume of
 * that channel.
 */
export async function findOrdersNeedingStock(params: { windowDays: number; limit: number }) {
    const supabase = getAdminClient();
    const since = new Date(Date.now() - params.windowDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, source, items, order_status, payment_status, payment_type, total, prepaid_amount, cod_amount, cod_received_at, created_at')
        .gte('created_at', since)
        .not('order_status', 'in', '("cancelled","refunded")')
        .order('created_at', { ascending: false })
        .limit(params.limit * 4);

    if (error) throw error;

    const candidates = (data || []).filter(o =>
        // A mirrored order exists because a manager entered it in the CRM, which
        // is confirmation enough; a site order has to have become real first.
        o.source === 'keycrm' || isReadyForCrm(o)
    );

    if (!candidates.length) return [];

    const { data: counted } = await supabase
        .from('inventory_movements')
        .select('order_id')
        .eq('type', 'sale')
        .in('order_id', candidates.map(o => o.id));

    const done = new Set((counted || []).map((m: any) => m.order_id));

    return candidates.filter(o => !done.has(o.id)).slice(0, params.limit);
}

/** Exported for the admin screen: what the catalogue mapping still lacks. */
export async function stockMappingGaps(): Promise<string[]> {
    const map = await fetchConfirmedMap();
    const supabase = getAdminClient();

    const { data: products } = await supabase
        .from('products')
        .select('slug, name')
        .eq('is_active', true);

    return (products || [])
        .filter((p: any) => !map[mapKey(p.slug, '')] && !Object.keys(map).some(k => k.startsWith(`${p.slug}::`)))
        .map((p: any) => `${p.name} (${p.slug})`);
}

export { sizeKey };
