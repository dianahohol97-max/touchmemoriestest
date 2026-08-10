import { getAdminClient } from '@/lib/supabase/admin';
import { keycrmRequest, fetchKeycrmOrderById, type KeycrmOrder } from '@/lib/automation/keycrm';

/**
 * Keep an order that already exists in both systems in step, in both
 * directions.
 *
 * Scope first, because it is easy to get wrong: this only ever touches orders
 * the website created and the sync itself carried over. The two systems are
 * separate sources of orders — the site takes its own, and managers enter
 * Instagram orders straight into KeyCRM, where those are also paid and
 * fiscalised. A CRM-native order has no counterpart here, carries no id linking
 * it back, and is never reconciled: the site knows nothing about its money and
 * would only corrupt it.
 *
 * For the orders it does cover, the design rests on one rule: each system owns
 * what it actually knows.
 *
 *   Money is owned by the website — for website orders. Their payments arrive
 *   through Monobank and land in Supabase first, so the site tells the CRM what
 *   has been received and never the other way round. A CRM payment total is
 *   only ever read, to work out what is still missing there. (Instagram orders
 *   are the mirror image: their money is recorded in the CRM and the site has
 *   no business filing it.)
 *
 *   Fulfilment is owned by the CRM. Production, packing and the waybill happen
 *   in KeyCRM where the team works, so the CRM tells the site where the order
 *   is, and the site never pushes a fulfilment stage back.
 *
 * Without that split the two sides would fight: each run would overwrite the
 * other's last write, and every order would flip between two states forever.
 *
 * Status translation is deliberately configuration, not code. Stage ids are
 * specific to the account and their names are whatever the shop called them, so
 * an unmapped stage changes nothing on the site — guessing that "Готово" means
 * shipped would send a customer a tracking email for a parcel still on the desk.
 */

export type TwoWayResult = {
    orderId: string;
    orderNumber: string;
    keycrmOrderId: string | number;
    /** What actually changed, for the log and the dry-run response. */
    changes: string[];
    problems: string[];
};

// Under this, a difference is rounding noise from percentage discounts rather
// than a payment anyone needs to chase.
const MONEY_EPSILON = 1;

// Money lives in one place for the whole bridge; see keycrm-money for why
// `payment_status = 'paid'` cannot be read as "the total arrived".
import { readOrderMoney, money, paymentMethodIdFor } from '@/lib/automation/keycrm-money';
import { MIRROR_SOURCE } from '@/lib/automation/keycrm-mirror';
import { autoTagsForOrder, mergeTags, sameTags } from '@/lib/automation/order-tags';
import { resolveOrderDeadline } from '@/lib/automation/deadline-resolver';

function fulfilmentFromLabel(label: string): string | undefined {
    const l = (label || '').toLowerCase();
    if (l.includes('доставлен') || l.includes('отриман')) return 'delivered';
    if (l.includes('дороз') || l.includes('відправ')) return 'shipped';
    return undefined;
}

async function statusMapFromCrm(): Promise<Record<string, string>> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('keycrm_status_map')
        .select('keycrm_status_id, site_order_status, direction')
        .in('direction', ['from_crm', 'both']);

    if (error) {
        console.error('[keycrm-twoway] status map read failed:', error.message);
        return {};
    }

    const map: Record<string, string> = {};
    for (const row of data || []) map[String(row.keycrm_status_id)] = row.site_order_status;
    return map;
}

/**
 * CRM → site: waybill, carrier and fulfilment stage.
 *
 * Returns the patch rather than applying it, so the caller can show it in a dry
 * run and so every write to the orders table happens in one place.
 */
function buildSitePatch(order: any, crm: KeycrmOrder, statusMap: Record<string, string>): {
    patch: Record<string, any>;
    changes: string[];
} {
    const patch: Record<string, any> = {};
    const changes: string[] = [];

    if (crm.ttn && crm.ttn !== order.ttn) {
        patch.ttn = crm.ttn;
        patch.tracking_carrier = crm.shipping_service || order.tracking_carrier || 'Нова Пошта';
        // Nova Poshta is the only carrier in use on this shop, and its public
        // tracking page takes the waybill as a query parameter.
        patch.tracking_url = `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(crm.ttn)}`;
        changes.push(`ТТН ${crm.ttn}`);
    }

    // The explicit status map wins when configured; when it is not, the stage
    // NAME still carries meaning for the words every shop uses the same way:
    // «в дорозі» and «відправлено» mean the parcel left, «доставлено» and
    // «отримано» mean it arrived. This is what keeps in-transit orders off the
    // production calendar even before anyone fills in the mapping table.
    const mappedStatus =
        (crm.status_id !== null ? statusMap[String(crm.status_id)] : undefined)
        ?? fulfilmentFromLabel(crm.status_label);

    if (mappedStatus && mappedStatus !== order.order_status) {
        patch.order_status = mappedStatus;
        changes.push(`статус ${order.order_status || '—'} → ${mappedStatus}`);

        // Timestamps the site's own emails and the tracking page read from.
        // Only ever set, never cleared: an order that went out yesterday did not
        // stop having been shipped because someone moved a card back a stage.
        if (mappedStatus === 'shipped' && !order.shipped_at) patch.shipped_at = new Date().toISOString();
        if (mappedStatus === 'delivered' && !order.delivered_at) patch.delivered_at = new Date().toISOString();

        // Delivery is the moment cash on delivery stops being a promise. Until
        // this is stamped the money is treated as still in transit, so the CRM
        // is never told the order is settled while the courier still holds the
        // balance. It is only ever set once — the money does not un-arrive if
        // somebody moves the card afterwards.
        if (mappedStatus === 'delivered' && money(order.cod_amount) > 0 && !order.cod_received_at) {
            patch.cod_received_at = new Date().toISOString();
            changes.push(`післяплату ${money(order.cod_amount)} грн позначено отриманою`);
        }
    }

    // Deadlines listen to the CRM comments too, on every pass — not only at
    // creation. A manager who writes "клієнту треба до 20.08" or «швидше» into
    // the CRM card days later means it, and a deadline that ignored the note
    // would keep the order looking calm on the calendar. Tighten-only: a
    // deadline can move EARLIER when the comments say so, never later — the
    // wedding does not move because somebody tidied a comment away.
    const resolved = resolveOrderDeadline(
        {
            ...order,
            notes: [order.notes, crm.manager_comment, crm.buyer_comment].filter(Boolean).join('\n'),
        },
        { now: new Date() },
    );

    if (resolved.reason !== 'standard') {
        const stored = order.deadline ? new Date(order.deadline).getTime() : Infinity;
        if (resolved.deadline.getTime() < stored) {
            patch.deadline = resolved.deadline.toISOString();
            const words = resolved.evidence.length ? ` («${resolved.evidence.join(', ')}»)` : '';
            changes.push(`дедлайн пересунуто на ${resolved.deadline.toLocaleDateString('uk-UA')} з коментаря${words}`);
        }
    }

    // Money the CRM saw and the site did not. Site orders are normally paid
    // through Monobank, but a manager can legitimately file a payment straight
    // in the CRM — cash on pickup, a bank transfer by requisites. The site must
    // SHOW that, or the order sits marked unpaid forever while the money is in.
    // Fill-a-blank again: the CRM total is recorded for display, and the order
    // is closed as paid only when the CRM holds the full sum — partial CRM
    // payments are surfaced in the change log, never guessed into a status.
    const siteReceived = readOrderMoney(order).received;
    const crmExtra = money(crm.payments_total - siteReceived);
    if (crmExtra > MONEY_EPSILON) {
        changes.push(`у CRM проведено на ${crmExtra} грн більше, ніж бачив сайт (разом ${crm.payments_total} грн)`);

        if (crm.payments_total >= money(order.total) - MONEY_EPSILON && order.payment_status !== 'paid') {
            patch.payment_status = 'paid';
            if (!order.paid_at) patch.paid_at = new Date().toISOString();
            changes.push('оплату закрито за даними CRM');
        }
    }

    // Tags: merged, never replaced. Three parties write them — the automation,
    // a manager in the CRM, a manager in the admin panel — and a sync that
    // overwrote the list would silently delete whoever wrote last.
    const tags = mergeTags(order.tags, crm.tags, autoTagsForOrder(order));
    if (!sameTags(tags, order.tags)) {
        patch.tags = tags;
        changes.push(`теги: ${tags.join(', ')}`);
    }

    // The artwork attached in the CRM, as links. The workshop needs to see what
    // it is printing from the site card without opening the CRM.
    const knownFiles = (order.custom_attributes as any)?.keycrm?.files || [];
    const knownPaymentsTotal = Number((order.custom_attributes as any)?.keycrm?.payments_total ?? 0);
    if ((crm.files.length && crm.files.length !== knownFiles.length)
        || Math.abs(knownPaymentsTotal - crm.payments_total) > MONEY_EPSILON) {
        patch.custom_attributes = {
            ...(order.custom_attributes || {}),
            keycrm: {
                ...((order.custom_attributes as any)?.keycrm || {}),
                ...(crm.files.length ? { files: crm.files } : {}),
                // What the CRM holds in payments, verbatim, so the order card
                // can show the CRM side of the money without opening the CRM.
                payments_total: crm.payments_total,
            },
        };
        if (crm.files.length && crm.files.length !== knownFiles.length) changes.push(`файлів з CRM: ${crm.files.length}`);
    }

    return { patch, changes };
}

/**
 * Site → CRM: file whatever money the CRM has not seen yet.
 *
 * Sends the difference as an additional payment rather than rewriting the
 * existing one. A split order that later pays its balance therefore ends up
 * with two payment lines in the CRM, which is what actually happened, instead of
 * one line silently growing.
 */
async function pushMissingPayment(order: any, crm: KeycrmOrder, dryRun: boolean): Promise<{
    changes: string[];
    problems: string[];
}> {
    const changes: string[] = [];
    const problems: string[] = [];

    // The order passed here is already patched with this run's changes, so a
    // cash-on-delivery balance that just arrived files under the післяплата
    // method rather than the prepayment one.
    const paymentMethodId = paymentMethodIdFor(order) ?? NaN;
    const received = readOrderMoney(order).received;
    const missing = money(received - crm.payments_total);

    if (missing <= MONEY_EPSILON) return { changes, problems };

    if (!Number.isFinite(paymentMethodId) || paymentMethodId <= 0) {
        problems.push(`У CRM бракує ${missing} грн, але спосіб оплати не налаштований (KEYCRM_PAYMENT_METHOD_*), тому платіж не проводимо.`);
        return { changes, problems };
    }

    changes.push(`доплата ${missing} грн у CRM`);
    if (dryRun) return { changes, problems };

    try {
        await keycrmRequest(`/order/${encodeURIComponent(String(crm.id))}/payment`, {
            method: 'POST',
            body: {
                payment_method_id: paymentMethodId,
                amount: missing,
                status: 'paid',
                description: `Оплата з сайту, замовлення ${order.order_number}`,
                payment_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            },
        });
    } catch (e: any) {
        problems.push(`Не вдалося провести доплату ${missing} грн: ${e?.message || 'запит не вдався'}`);
        return { changes: [], problems };
    }

    return { changes, problems };
}

/**
 * Site → CRM: a waybill created on the site fills the CRM's blank.
 *
 * Waybills are usually born in the CRM and travel down — but the site has its
 * own Nova Poshta integration, and a ТТН created there was invisible on the
 * CRM card, so the team kept re-typing it. The rule is fill-a-blank, never
 * overwrite: whichever system created the waybill first wins, and this only
 * writes when the CRM has none. The payload shape follows the CRM's own
 * shipping block; if the account rejects it, the error lands in problems
 * rather than anything being retried blind.
 */
async function pushWaybill(order: any, crm: KeycrmOrder, dryRun: boolean): Promise<{
    changes: string[];
    problems: string[];
}> {
    const changes: string[] = [];
    const problems: string[] = [];

    const siteTtn = String(order?.ttn || '').trim();
    if (!siteTtn || crm.ttn) return { changes, problems };

    changes.push(`ТТН ${siteTtn} передана в CRM`);
    if (dryRun) return { changes, problems };

    try {
        await keycrmRequest(`/order/${encodeURIComponent(String(crm.id))}`, {
            method: 'PUT',
            body: { shipping: { tracking_code: siteTtn } },
        });
    } catch (e: any) {
        problems.push(`Не вдалося передати ТТН у CRM: ${e?.message || 'запит не вдався'}`);
        return { changes: [], problems };
    }

    return { changes, problems };
}

/**
 * Site → CRM: a cancellation on the site must not leave the CRM producing.
 *
 * The stage itself is only moved when the account's cancelled stage is mapped;
 * otherwise the note alone goes over, which is still enough for a human to act
 * on and far safer than moving a card to a guessed stage.
 */
async function pushCancellation(order: any, crm: KeycrmOrder, dryRun: boolean): Promise<{
    changes: string[];
    problems: string[];
}> {
    const changes: string[] = [];
    const problems: string[] = [];

    if (!['cancelled', 'refunded'].includes(order.order_status || '')) return { changes, problems };

    const marker = 'Скасовано на сайті';
    if (crm.manager_comment.includes(marker)) return { changes, problems };

    const supabase = getAdminClient();
    const { data: cancelStage } = await supabase
        .from('keycrm_status_map')
        .select('keycrm_status_id')
        .eq('site_order_status', order.order_status)
        .in('direction', ['to_crm', 'both'])
        .maybeSingle();

    changes.push(cancelStage ? 'позначено скасування в CRM зі зміною статусу' : 'позначено скасування в CRM коментарем');
    if (dryRun) return { changes, problems };

    try {
        await keycrmRequest(`/order/${encodeURIComponent(String(crm.id))}`, {
            method: 'PUT',
            body: {
                manager_comment: `${crm.manager_comment}\n${marker} ${new Date().toISOString().slice(0, 10)}`.trim(),
                ...(cancelStage ? { status_id: Number(cancelStage.keycrm_status_id) } : {}),
            },
        });
    } catch (e: any) {
        problems.push(`Не вдалося позначити скасування: ${e?.message || 'запит не вдався'}`);
        return { changes: [], problems };
    }

    return { changes, problems };
}

/** Reconcile one order that exists in both systems. */
export async function syncOrderBothWays(order: any, opts?: { dryRun?: boolean }): Promise<TwoWayResult | null> {
    const dryRun = opts?.dryRun === true;
    const keycrmOrderId = order?.custom_attributes?.keycrm?.order_id;
    if (!keycrmOrderId) return null;

    const result: TwoWayResult = {
        orderId: order.id,
        orderNumber: order.order_number,
        keycrmOrderId,
        changes: [],
        problems: [],
    };

    let crm: KeycrmOrder | null;
    try {
        crm = await fetchKeycrmOrderById(keycrmOrderId);
    } catch (e: any) {
        result.problems.push(`Не вдалося прочитати замовлення з CRM: ${e?.message || 'запит не вдався'}`);
        return result;
    }

    if (!crm) {
        result.problems.push('Замовлення з таким номером у CRM більше немає.');
        return result;
    }

    // CRM → site.
    const statusMap = await statusMapFromCrm();
    const { patch, changes } = buildSitePatch(order, crm, statusMap);
    result.changes.push(...changes);

    if (Object.keys(patch).length && !dryRun) {
        const supabase = getAdminClient();
        const { error } = await supabase.from('orders').update(patch).eq('id', order.id);

        if (error) {
            result.problems.push(`Не вдалося оновити замовлення на сайті: ${error.message}`);
        } else if (patch.ttn) {
            // The customer-facing record of the same event, so support can see
            // when the number appeared without opening the CRM.
            await supabase.from('order_history').insert({
                order_id: order.id,
                action: 'ttn_synced',
                notes: `ТТН ${patch.ttn} підтягнута з KeyCRM.`,
                added_by: null,
            });
        }
    }

    // Site → CRM.
    //
    // The patch is folded into the in-memory order first, and the ordering here
    // is load-bearing. Delivery and the arrival of the cash-on-delivery money
    // are the same event, so the run that stamps cod_received_at is the run that
    // must file that money in the CRM. Reading the pre-patch order would defer
    // the payment to the next pass — by which time the order is delivered and
    // no longer a candidate, and the balance would never be filed at all.
    const patched = { ...order, ...patch };

    const payment = await pushMissingPayment(patched, crm, dryRun);
    result.changes.push(...payment.changes);
    result.problems.push(...payment.problems);

    const cancellation = await pushCancellation(patched, crm, dryRun);
    result.changes.push(...cancellation.changes);
    result.problems.push(...cancellation.problems);

    const waybill = await pushWaybill(patched, crm, dryRun);
    result.changes.push(...waybill.changes);
    result.problems.push(...waybill.problems);

    return result;
}

/**
 * Orders present in both systems, newest first.
 *
 * Bounded by a window because an order delivered two months ago has nothing
 * left to reconcile, and re-reading it every half hour would spend the CRM's
 * rate limit on nothing.
 */
export async function findSyncedOrders(params: { windowDays: number; limit: number }) {
    const supabase = getAdminClient();
    const since = new Date(Date.now() - params.windowDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, source, order_status, payment_status, payment_type, total, prepaid_amount, cod_amount, cod_received_at, ttn, tracking_carrier, shipped_at, delivered_at, tags, deadline, notes, client_comment, paid_at, custom_attributes, created_at')
        .gte('created_at', since)
        .not('custom_attributes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(params.limit * 4);

    if (error) throw error;

    return (data || [])
        .filter(o => (o.custom_attributes as any)?.keycrm?.order_id)
        // Mirrored orders carry a CRM id too, but they are copies the CRM owns
        // outright — reconciling them would file the site's guesses about money
        // the site never took.
        .filter(o => o.source !== MIRROR_SOURCE)
        // Delivered orders are usually finished business and are dropped rather
        // than polled forever — unless money is still outstanding on them. A
        // cash-on-delivery balance is settled at the moment of delivery, so
        // dropping every delivered order unconditionally would abandon exactly
        // the ones whose last payment still has to reach the CRM.
        .filter(o => o.order_status !== 'delivered' || readOrderMoney(o).outstanding > 0)
        .slice(0, params.limit);
}
