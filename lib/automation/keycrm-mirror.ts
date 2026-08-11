import { getAdminClient } from '@/lib/supabase/admin';
import { fetchRecentKeycrmOrders, fetchKeycrmOrderById, type KeycrmOrder } from '@/lib/automation/keycrm';
import { resolveOrderDeadline } from '@/lib/automation/deadline-resolver';
import { autoTagsForOrder, mergeTags } from '@/lib/automation/order-tags';

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
    /** CRM orders whose source is «Сайт» — the hand-typed backlog, never mirrored. */
    skipped_site_source: number;
    /** Hand-typed CRM orders tied back to their TM- site rows via the comment's number. */
    adopted: number;
    problems: string[];
    samples: Array<{ order_number: string; buyer: string; total: number; action: string }>;
};

function money(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/**
 * delivery_method is the one NOT NULL column on orders with no default, and it
 * proved it on the first live run: every one of 300 mirror inserts was rejected
 * by the constraint. Derived from the carrier name the CRM reports, falling
 * back to 'other' — a mirrored copy with an approximate delivery method is
 * useful, a rejected row is not.
 */
/**
 * The order's place in its lifecycle, read from the CRM stage name.
 *
 * Substring matching over the account's own stage names rather than ids: ids
 * differ per account and per pipeline, while «в дорозі», «відправлено»,
 * «доставлено», «отримано» are the words this team actually uses. An
 * unrecognised stage stays 'confirmed' — still visible, which errs on the side
 * of showing work rather than hiding it.
 *
 * The stage NAME is the only source (Diana, 2026-08-11): a waybill's mere
 * existence used to force 'shipped', but the team creates TTNs in advance
 * while the book is still printing — CRM-13644 sat in «Передано на друк»
 * with a ready label and the site called it shipped. A parcel counts as
 * shipped when the CRM stage says so, not when the label is printed.
 */
function statusFromCrm(crm: KeycrmOrder): string {
    const label = (crm.status_label || '').toLowerCase();

    // The API sometimes hands back the stage's INTERNAL key instead of its
    // display name — English snake_case like `in_transit`, `completed`,
    // `canceled`, `delivered_to_delivery`. Live data on 2026-08-11 held ~90
    // mirrored orders under such keys, every one of them unmapped: cancelled
    // orders sat on the production calendar as pending work, and completed
    // ones were about to flood back onto it. Both vocabularies are matched.
    if (label.includes('скасов') || label.includes('анульов') || label.includes('cancel')) return 'cancelled';
    if (label.includes('повернен') || label.includes('refund')) return 'refunded';
    // shipped BEFORE delivered: `delivered_to_delivery` («передано в
    // доставку») contains the word delivered but means the parcel just left.
    if (label.includes('to_delivery') || label.includes('дороз') || label.includes('відправ') || label.includes('transit') || label.includes('shipped')) return 'shipped';
    if (label.includes('доставлен') || label.includes('отриман') || label.includes('delivered') || label.includes('completed') || label.includes('виконан')) return 'delivered';

    return 'confirmed';
}

function deliveryMethodFrom(crm: KeycrmOrder): string {
    const service = (crm.shipping_service || '').toLowerCase();

    if (service.includes('нова') || service.includes('nova')) return 'nova_poshta';
    if (service.includes('укр')) return 'ukrposhta';
    if (service.includes('самов') || service.includes('pickup')) return 'pickup';
    if (service.includes("кур'єр") || service.includes('курєр') || service.includes('courier')) return 'courier';

    return 'other';
}

/**
 * Map a CRM order onto the columns the site's own reports read.
 *
 * payment_status is derived from what the CRM has actually collected rather
 * than copied from a field: the CRM's own notion of paid lives in its payment
 * lines, and the site only needs to know whether the money is in.
 */
function toOrderRow(crm: KeycrmOrder, existing?: { id: string; deadline?: string | null; custom_attributes?: any }) {
    const existingId = existing?.id;
    const total = money(crm.grand_total);
    const received = money(crm.payments_total);

    // Line items in the site's own shape. Without them an Instagram order is a
    // number with no contents: it cannot be reported on by product, and the
    // routing rules — which read what is in an order — would never fire for it.
    const items = crm.products.map(p => ({
        slug: p.sku,
        product_name: p.name,
        quantity: p.quantity,
        unit_price: money(p.price),
        total_price: money(p.price * p.quantity),
        options: p.properties,
        product_type: 'product',
    }));

    // Instagram orders belong on the production calendar exactly like the
    // site's own — a calendar with holes in it is worse than none, because the
    // holes read as free capacity. The manager comment from the CRM is where an
    // urgent date lives for these ("треба до 12.10, весілля"), so it is parsed
    // the same way a website customer's comment is.
    //
    // This writes a planning field the site owns and never pushes back to the
    // CRM, so the read-only promise about the CRM's own data still holds.
    // Items ride along: the resolver's per-product terms (and the keyword
    // fallback for CRM skus) need to SEE the photobook to give it its
    // 14 робочих днів — without them every mirrored order fell into the
    // generic 8-day fallback, which is the «а там взагалі 10 днів лиш
    // рахує» Тома caught.
    const { deadline } = resolveOrderDeadline({
        created_at: crm.created_at,
        notes: crm.manager_comment,
        client_comment: crm.buyer_comment,
        items,
    });

    // Merge, never rebuild: custom_attributes carries site-owned state too
    // (chat_task with Софія's recommendation) — only the keycrm block is ours
    // to replace here.
    const existingAttrs = (existing?.custom_attributes && typeof existing.custom_attributes === 'object')
        ? existing.custom_attributes as Record<string, any>
        : {};

    // The moment production actually starts. «Друк після затвердження макету»
    // (Тома, 2026-08-11): for made-to-order books the published term counts
    // from the customer approving the layout, and the closest observable
    // proxy for that approval is the CRM stage moving to print. Stamped once,
    // never re-stamped — a card dragged back and forth does not restart the
    // clock.
    const stageLabel = (crm.status_label || '').toLowerCase();
    // The CRM's own status-change timestamp when the API exposes it — exact
    // (Diana asked for the history of status changes: KeyCRM's API has no
    // history endpoint, so this field is as close as it gets). Without it,
    // "now" is used ONLY when this refresh actually WITNESSED the transition
    // (the stored stage differs from the live one). An order first seen
    // already sitting in print gets no stamp at all: stamping "now" would
    // hand a book that went to print weeks ago fourteen fresh working days
    // and quietly drain the overdue rail.
    const witnessedTransition = Boolean(
        existingAttrs?.keycrm?.status_label
        && existingAttrs.keycrm.status_label !== crm.status_label,
    );
    const printStartedAt = existingAttrs?.keycrm?.print_started_at
        || (/друк/.test(stageLabel)
            ? (crm.status_changed_at || (witnessedTransition ? new Date().toISOString() : null))
            : null);

    // Deadline ownership: the resolver owns it UNLESS a person pinned it — a
    // chat instruction or the admin date field sets deadline_locked, and a
    // pinned date survives every refresh. Without the lock the fresh
    // resolution wins in both directions, because the print-start restart
    // legitimately moves deadlines LATER and a tighten-only rule would
    // silently discard exactly that correction.
    const resolvedWithStart = printStartedAt
        ? resolveOrderDeadline({
            created_at: crm.created_at,
            notes: crm.manager_comment,
            client_comment: crm.buyer_comment,
            items,
            custom_attributes: { keycrm: { print_started_at: printStartedAt } },
        }).deadline
        : deadline;

    const existingDeadline = existing?.deadline ? new Date(existing.deadline) : null;
    const effectiveDeadline = existingAttrs?.deadline_locked
        && existingDeadline && Number.isFinite(existingDeadline.getTime())
        ? existingDeadline
        : resolvedWithStart;

    return {
        deadline: effectiveDeadline.toISOString(),
        // Tags are how the workshop routes an order, so they have to be visible
        // on the site card too, not only in the CRM.
        items,
        tags: mergeTags(crm.tags, autoTagsForOrder({ items })),
        ...(existingId ? { id: existingId } : {}),
        order_number: `${MIRROR_NUMBER_PREFIX}${crm.id}`,
        source: MIRROR_SOURCE,
        delivery_method: deliveryMethodFrom(crm),
        customer_name: crm.buyer_name || 'Клієнт з KeyCRM',
        customer_email: crm.buyer_email || null,
        customer_phone: crm.buyer_phone || null,
        total,
        subtotal: total,
        payment_status: received >= total - 1 && total > 0 ? 'paid' : 'pending',
        // Deliberately not a production status. The site does not run these
        // orders — the state only says whether production still owes anything.
        // The CRM stage NAME counts as well as the waybill (Diana, 2026-08-11):
        // an order the CRM calls «в дорозі» or «відправлено» has left the
        // workshop whether or not a TTN was captured, and keeping it on the
        // production calendar buries the work that is actually pending.
        order_status: statusFromCrm(crm),
        ttn: crm.ttn || null,
        prepaid_amount: received,
        notes: crm.manager_comment || null,
        client_comment: crm.buyer_comment || null,
        created_at: crm.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        custom_attributes: {
            ...existingAttrs,
            keycrm: {
                order_id: crm.id,
                mirrored: true,
                status_label: crm.status_label,
                payments_total: crm.payments_total,
                ...(printStartedAt ? { print_started_at: printStartedAt } : {}),
                // The artwork attached to the CRM card. Copied as links rather
                // than as files: the CRM stays the place they live, and the
                // admin panel only needs to be able to open them.
                files: crm.files,
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

/**
 * Mirror ONE order by its CRM id, on demand.
 *
 * The bulk mirror only reads recent orders; a chat instruction can reference
 * any order the CRM still holds («запитайте чи можна зняти 13020» — an order
 * far outside the window). This pulls exactly that order, honouring the same
 * origin rules as the bulk pass: a site-pushed order is skipped (it already
 * exists), a hand-typed site order is ADOPTED by its TM reference, everything
 * else is mirrored as CRM-<id>. Returns true when the number is now findable.
 */
export async function mirrorSingleKeycrmOrder(crmId: string | number): Promise<boolean> {
    const supabase = getAdminClient();

    const crm = await fetchKeycrmOrderById(crmId);
    if (!crm) return false;

    // Site-pushed: the TM row already exists and carries this CRM id.
    if (String(crm.source_uuid || '').trim()) return true;

    const siteSourceId = String(process.env.KEYCRM_SOURCE_ID || '').trim();
    if (siteSourceId && crm.source_id === siteSourceId) {
        const m = String(crm.manager_comment || '').match(/TM-?\s?(\d{4,6})/i);
        if (!m) return false;
        const tmNumber = `TM-${m[1].padStart(6, '0')}`;
        const { data: siteRow } = await supabase
            .from('orders')
            .select('id, custom_attributes')
            .eq('order_number', tmNumber)
            .maybeSingle();
        if (!siteRow) return false;

        const attrs = (siteRow.custom_attributes && typeof siteRow.custom_attributes === 'object')
            ? siteRow.custom_attributes as Record<string, any>
            : {};
        if (attrs.keycrm?.order_id) return true;

        const { error } = await supabase
            .from('orders')
            .update({
                custom_attributes: {
                    ...attrs,
                    keycrm: {
                        order_id: crm.id,
                        status_label: crm.status_label,
                        payments_total: crm.payments_total,
                        adopted: true,
                        synced_at: new Date().toISOString(),
                    },
                },
            })
            .eq('id', siteRow.id);
        return !error;
    }

    const number = `${MIRROR_NUMBER_PREFIX}${crm.id}`;
    const { data: existing } = await supabase
        .from('orders')
        .select('id, order_number, deadline, custom_attributes')
        .eq('order_number', number)
        .maybeSingle();

    const row = toOrderRow(crm, existing || undefined);
    const { error } = existing
        ? await supabase.from('orders').update(row).eq('id', existing.id)
        : await supabase.from('orders').insert(row);

    return !error;
}

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
        skipped_site_source: 0,
        adopted: 0,
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

    const withReference = crm.orders.filter(o => o.source_uuid.trim());
    report.skipped_own = withReference.length;

    // The dry run against the real account caught this: the CRM holds not only
    // Instagram orders but also SITE orders the managers typed in by hand, and
    // those carry no external reference. Mirroring them would clone each one
    // back as a CRM- number next to its live TM- row and double two weeks of
    // revenue. The CRM's own «Джерело» field is the ground truth for origin, so
    // only orders NOT from the site source are mirrored. No configured site
    // source means no way to tell them apart — then nothing is mirrored, loudly.
    const siteSourceId = String(process.env.KEYCRM_SOURCE_ID || '').trim();
    if (!siteSourceId) {
        report.problems.push('KEYCRM_SOURCE_ID не заданий — без нього не відрізнити інстаграм від перенесених вручну замовлень сайту, тому дзеркало нічого не копіює.');
        return report;
    }

    const candidates = crm.orders.filter(o => !o.source_uuid.trim() && o.source_id !== siteSourceId);
    report.skipped_site_source = crm.orders.length - report.skipped_own - candidates.length;

    // Adopt the hand-transferred backlog (found live: TM-001149 / CRM 13707).
    // A site order carried into the CRM by hand exists TWICE with no link:
    // the site row predates the automation cutoff so the production calendar
    // hides it, and the CRM row is skipped right here to avoid doubling
    // revenue — leaving the order on NO board at all while it is still in
    // production. The manager comment of such CRM orders carries the TM
    // number, so it is used to tie the two rows together: the CRM id is
    // written onto the site order (fill-a-blank, never overwriting an
    // existing link), after which the regular two-way reconcile keeps its
    // stage fresh and the calendar can show it.
    try {
        const handTyped = crm.orders.filter(o => !o.source_uuid.trim() && o.source_id === siteSourceId);
        const refs = new Map<string, (typeof crm.orders)[number]>();
        for (const o of handTyped) {
            const m = String(o.manager_comment || '').match(/TM-?\s?(\d{4,6})/i);
            if (m) refs.set(`TM-${m[1].padStart(6, '0')}`, o);
        }

        if (refs.size) {
            const { data: siteRows } = await supabase
                .from('orders')
                .select('id, order_number, custom_attributes')
                .in('order_number', [...refs.keys()]);

            for (const row of siteRows || []) {
                const attrs = (row.custom_attributes && typeof row.custom_attributes === 'object')
                    ? row.custom_attributes as Record<string, any>
                    : {};
                if (attrs.keycrm?.order_id) continue;

                const crmOrder = refs.get(row.order_number)!;
                if (dryRun) { report.adopted++; continue; }

                const { error: adoptError } = await supabase
                    .from('orders')
                    .update({
                        custom_attributes: {
                            ...attrs,
                            keycrm: {
                                order_id: crmOrder.id,
                                status_label: crmOrder.status_label,
                                payments_total: crmOrder.payments_total,
                                adopted: true,
                                synced_at: new Date().toISOString(),
                            },
                        },
                    })
                    .eq('id', row.id);

                if (adoptError) report.problems.push(`${row.order_number}: не вдалося прив'язати CRM ${crmOrder.id}: ${adoptError.message}`);
                else report.adopted++;
            }
        }
    } catch (e: any) {
        report.problems.push(`Прив'язка ручних переносів не вдалася: ${e?.message || 'невідома помилка'}`);
    }

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
        // deadline and custom_attributes ride along so the refresh can merge
        // instead of clobbering site-owned state (tightened deadlines, Софія's
        // chat_task recommendation).
        .select('id, order_number, deadline, custom_attributes')
        .in('order_number', numbers);

    if (existingError) {
        report.problems.push(`Не вдалося прочитати вже віддзеркалені замовлення: ${existingError.message}`);
        return report;
    }

    const existingByNumber = new Map((existing || []).map((r: any) => [r.order_number, r]));

    for (const crmOrder of candidates) {
        const number = `${MIRROR_NUMBER_PREFIX}${crmOrder.id}`;
        const existingRow = existingByNumber.get(number);
        const existingId = existingRow?.id;
        const row = toOrderRow(crmOrder, existingRow);
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
