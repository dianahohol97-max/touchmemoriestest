import { getAdminClient } from '@/lib/supabase/admin';

/**
 * The defect and reprint queue.
 *
 * A defective order used to live in two informal places: a tag somebody set in
 * KeyCRM, and everyone's memory. Neither has a state, so "was the reprint
 * actually sent" was answered by scrolling chats. This queue gives a defect a
 * lifecycle of its own, separate from the order — because the order is done and
 * paid; it is the REPRINT that has to be produced, tracked and shipped.
 *
 * Entries arrive two ways, both first-class:
 *
 *   - Automatically, when an order's tags mention a defect. Tags reach the site
 *     from both directions — set in the CRM they come down with the sync, set in
 *     the admin panel they are already here — so a manager tagging "брак" in
 *     KeyCRM is enough for the entry to appear.
 *
 *   - Manually in the admin panel, for defects that surface before any tag
 *     exists (a customer message with a photo).
 *
 * The queue is owned by the site once an entry exists: removing the tag in the
 * CRM later does NOT delete the entry. A tag is how a defect is noticed, not
 * the record of it — a record that vanished when someone tidied tags would be
 * exactly the silent loss this queue exists to end.
 */

/** Substrings that mark a defect tag, matched case-insensitively. */
const DEFECT_TAG_PATTERNS = ['брак', 'передрук', 'reprint', 'defect'];

export const REPRINT_STATUSES = ['new', 'confirmed', 'reprinting', 'done', 'shipped', 'rejected'] as const;
export type ReprintStatus = typeof REPRINT_STATUSES[number];

/** Statuses that still need somebody's attention. */
export const OPEN_STATUSES: ReprintStatus[] = ['new', 'confirmed', 'reprinting', 'done'];

export const STATUS_LABELS: Record<ReprintStatus, string> = {
    new: 'Заявлено',
    confirmed: 'Підтверджено',
    reprinting: 'У передруку',
    done: 'Передруковано',
    shipped: 'Відправлено',
    rejected: 'Не брак',
};

export const FAULT_OPTIONS = ['друк', 'дизайн', 'постачальник', 'доставка', 'клієнт', 'інше'];

/** The defect-marking tags in a list, or empty when there are none. */
export function defectTags(tags: string[] | null | undefined): string[] {
    return (tags || []).filter(tag => {
        const t = String(tag || '').toLowerCase();
        return DEFECT_TAG_PATTERNS.some(p => t.includes(p));
    });
}

function itemsSummary(order: any): string {
    return Array.isArray(order?.items)
        ? order.items.map((i: any) => i?.product_name).filter(Boolean).slice(0, 3).join(', ')
        : '';
}

export type IntakeReport = {
    dry_run: boolean;
    scanned: number;
    enqueued: Array<{ order_number: string; tags: string[] }>;
    already_open: number;
};

/**
 * Scan recent orders for defect tags and open queue entries for them.
 *
 * Idempotency is per open entry, not per order forever: an order with an OPEN
 * auto-created entry is not enqueued again, but once that entry is closed a
 * fresh defect tag opens a new one — the same book genuinely can be reprinted
 * twice, and collapsing the second defect into the first would hide it.
 */
export async function enqueueDefectsFromTags(params: {
    windowDays: number;
    dryRun?: boolean;
}): Promise<IntakeReport> {
    const dryRun = params.dryRun === true;
    const supabase = getAdminClient();
    const since = new Date(Date.now() - params.windowDays * 24 * 60 * 60 * 1000).toISOString();

    const report: IntakeReport = { dry_run: dryRun, scanned: 0, enqueued: [], already_open: 0 };

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, tags, items, created_at')
        .gte('created_at', since)
        .not('tags', 'is', null)
        .limit(500);

    if (error) throw error;

    const flagged = (orders || []).filter(o => defectTags(o.tags).length > 0);
    report.scanned = orders?.length || 0;
    if (!flagged.length) return report;

    const { data: openEntries } = await supabase
        .from('reprint_queue')
        .select('order_id')
        .eq('source', 'crm-tag')
        .in('status', OPEN_STATUSES)
        .in('order_id', flagged.map(o => o.id));

    const open = new Set((openEntries || []).map((r: any) => r.order_id));

    for (const order of flagged) {
        if (open.has(order.id)) {
            report.already_open++;
            continue;
        }

        const tags = defectTags(order.tags);
        report.enqueued.push({ order_number: order.order_number, tags });
        if (dryRun) continue;

        const { error: insertError } = await supabase.from('reprint_queue').insert({
            order_id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name,
            source: 'crm-tag',
            matched_tags: tags,
            items_summary: itemsSummary(order),
            reason: `Автоматично за тегом: ${tags.join(', ')}`,
            status: 'new',
            created_by: 'automation',
        });

        if (insertError) {
            console.error(`[reprints] enqueue failed for ${order.order_number}:`, insertError.message);
        }
    }

    return report;
}
