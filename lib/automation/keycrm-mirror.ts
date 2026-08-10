import { getAdminClient } from '@/lib/supabase/admin';
import { fetchRecentKeycrmOrders, type KeycrmOrder } from '@/lib/automation/keycrm';

/**
 * Mirror KeyCRM-native orders into the website database, read-only.
 *
 * Why: the shop has two order intakes. The site takes its own orders, and
 * managers enter Instagram orders straight into KeyCRM, where those are also
 * paid and fiscalised. Everything the site computes about the business —
 * revenue, repeat customers, the admin dashboard — therefore saw only half of
 * it. Mirroring closes that gap without moving ownership: the CRM keeps the
 * order, the site merely gets to see it.
 *
 * READ-ONLY IS THE WHOLE POINT. A mirrored order is a copy, and the site must
 * never act on it — no invoice, no fiscal receipt, no payment reminder, no
 * "your order is ready" email, and above all it must never be pushed back into
 * KeyCRM as a new order. It is marked with source = 'keycrm', which is the flag
 * every one of those jobs filters on. Removing that marker anywhere is how a
 * customer gets emailed twice and a receipt gets issued against money the site
 * never took.
 *
 * The mirror is one-directional and lossy on purpose: it carries the facts an
 * analytics view needs (who, what, how much, when, what state) and nothing that
 * would tempt another part of the system to treat it as a live order.
 */

export const MIRROR_SOURCE = 'keycrm';

/** Order numbers are prefixed so a mirrored order can never collide with the site's own TM- sequence. */
export const MIRROR_NUMBER_PREFIX = 'CRM-';

export type MirrorReport = {
    dry_run: boolean;
    crm_orders_read: number;
    created: number;
    updated: number;
    skipped_own: number;
    problems: string[];
    samples: Array<{ order_number: string; buyer: string; total: number; action: string }>;
};

function money(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/**
 * Map a CRM order onto the columns the site's own reports read.
 *
 * payment_status is derived from what the CRM has actually collected rather
 * than copied from a field: the CRM's own notion of paid lives in its payment
 * lines, and the site only needs to know whether the money is in.
 */
function toOrderRow(crm: KeycrmOrder, existingId?: string) {
    const total = money(crm.grand_total);
    const received = money(crm.payments_total);

    return {
        ...(existingId ? { id: existingId } : {}),
        order_number: `${MIRROR_NUMBER_PREFIX}${crm.id}`,
        source: MIRROR_SOURCE,
        customer_name: crm.buyer_name || 'Клієнт з KeyCRM',
        customer_email: crm.buyer_email || null,
        customer_phone: crm.buyer_phone || null,
        total,
        subtotal: total,
        payment_status: received >= total - 1 && total > 0 ? 'paid' : 'pending',
        // Deliberately not a production status. The site does not run these
        // orders, and giving them a workflow state would put them into queues
        // and dashboards that expect the site to act.
        order_status: crm.ttn ? 'shipped' : 'confirmed',
        ttn: crm.ttn || null,
        prepaid_amount: received,
        notes: crm.manager_comment || null,
        client_comment: crm.buyer_comment || null,
        created_at: crm.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        custom_attributes: {
            keycrm: {
                order_id: crm.id,
                mirrored: true,
                status_label: crm.status_label,
                synced_at: new Date().toISOString(),
            },
        },
    };
}

/**
 * Pull recent CRM orders and mirror the ones that originated there.
 *
 * Orders the site itself pushed are skipped by their external reference: they
 * already exist here, and copying them back would produce a second row for the
 * same sale and double every revenue figure that counts them.
 */
export async function mirrorKeycrmOrders(params: {
    windowDays: number;
    dryRun?: boolean;
}): Promise<MirrorReport> {
    const dryRun = params.dryRun === true;
    const supabase = getAdminClient();
    const since = new Date(Date.now() - params.windowDays * 24 * 60 * 60 * 1000).toISOString();

    const report: MirrorReport = {
        dry_run: dryRun,
        crm_orders_read: 0,
        created: 0,
        updated: 0,
        skipped_own: 0,
        problems: [],
        samples: [],
    };

    const crm = await fetchRecentKeycrmOrders({ sinceIso: since, maxPages: 6 });
    report.crm_orders_read = crm.orders.length;
    if (crm.warning) report.problems.push(crm.warning);
    if (!crm.ok && crm.orders.length === 0) return report;

    // Every order the sync created carries the site order number as its
    // external reference. That is the marker separating "ours, already here"
    // from "born in the CRM".
    const ownNumbers = new Set(
        crm.orders
            .map(o => o.source_uuid.trim())
            .filter(Boolean),
    );

    const candidates = crm.orders.filter(o => !o.source_uuid.trim());
    report.skipped_own = crm.orders.length - candidates.length;

    if (ownNumbers.size) {
        // Sanity check rather than a guess: if a CRM order carries a reference
        // that matches no website order, the reference is stale and the order
        // would be missed by both the skip above and the mirror below.
        const { data: known } = await supabase
            .from('orders')
            .select('order_number')
            .in('order_number', [...ownNumbers]);

        const knownSet = new Set((known || []).map((r: any) => r.order_number));
        const orphans = [...ownNumbers].filter(n => !knownSet.has(n));
        if (orphans.length) {
            report.problems.push(`У CRM є посилання на замовлення сайту, яких у базі немає: ${orphans.slice(0, 5).join(', ')}`);
        }
    }

    if (!candidates.length) return report;

    const numbers = candidates.map(o => `${MIRROR_NUMBER_PREFIX}${o.id}`);
    const { data: existing, error: existingError } = await supabase
        .from('orders')
        .select('id, order_number')
        .in('order_number', numbers);

    if (existingError) {
        report.problems.push(`Не вдалося прочитати вже віддзеркалені замовлення: ${existingError.message}`);
        return report;
    }

    const existingByNumber = new Map((existing || []).map((r: any) => [r.order_number, r.id]));

    for (const crmOrder of candidates) {
        const number = `${MIRROR_NUMBER_PREFIX}${crmOrder.id}`;
        const existingId = existingByNumber.get(number);
        const row = toOrderRow(crmOrder, existingId);
        const action = existingId ? 'оновлення' : 'створення';

        if (report.samples.length < 8) {
            report.samples.push({
                order_number: number,
                buyer: crmOrder.buyer_name || 'без імені',
                total: money(crmOrder.grand_total),
                action,
            });
        }

        if (dryRun) {
            if (existingId) report.updated++; else report.created++;
            continue;
        }

        const { error } = existingId
            ? await supabase.from('orders').update(row).eq('id', existingId)
            : await supabase.from('orders').insert(row);

        if (error) {
            report.problems.push(`${number}: ${error.message}`);
            continue;
        }

        if (existingId) report.updated++; else report.created++;
    }

    return report;
}
