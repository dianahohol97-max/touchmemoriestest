/**
 * What the shop has actually received for an order, and what is still to come.
 *
 * This is the single source of truth for money in the KeyCRM bridge, kept in
 * its own module because both the initial push and the ongoing reconciliation
 * need exactly the same answer. Two copies of this rule would drift, and the
 * symptom of drift here is a CRM that thinks an order is paid when it is not.
 *
 * The rule that makes this non-obvious, taken from the live data rather than
 * from the column names:
 *
 *   `payment_type = 'split'` means a prepayment taken on the site plus the
 *   remainder collected on delivery. For those orders `payment_status = 'paid'`
 *   means THE PREPAYMENT is paid — not the order. A typical row is a total of
 *   1449 ₴ made of 743 ₴ prepaid and 706 ₴ on delivery, and it carries
 *   payment_status 'paid' while 706 ₴ is still outstanding.
 *
 * Reading 'paid' as "the whole total arrived" therefore overstates the money by
 * the entire cash-on-delivery amount, and a CRM told that would stop anyone
 * chasing a balance the courier has not handed over yet.
 */

export function money(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export type OrderMoney = {
    /** Order value. */
    total: number;
    /** Taken up front, through the site. */
    prepaid: number;
    /** To be collected by the courier on delivery. Zero when there is none. */
    cod: number;
    /** True once the cash on delivery has reached us. */
    codReceived: boolean;
    /** Actually in hand right now — what the CRM should show as paid. */
    received: number;
    /** Still owed. Zero when nothing is outstanding. */
    outstanding: number;
};

export function readOrderMoney(order: any): OrderMoney {
    const total = money(order?.total);
    const cod = money(order?.cod_amount);
    const prepaidRaw = money(order?.prepaid_amount);
    const codReceived = Boolean(order?.cod_received_at);

    if (cod > 0) {
        // `prepaid_amount` is the PLANNED prepayment, not a receipt: in the live
        // data the orders still waiting for their prepayment carry the figure
        // just the same as the ones that have paid it. Only payment_status tells
        // the two apart, so the planned amount counts as money in hand only once
        // the order says it cleared.
        const prepaidExpected = prepaidRaw > 0 ? prepaidRaw : Math.max(0, total - cod);
        const prepaidReceived = order?.payment_status === 'paid' ? prepaidExpected : 0;

        // And 'paid' on such an order means the prepayment cleared — never the
        // cash on delivery, which only arrives when the courier settles.
        const received = money(prepaidReceived + (codReceived ? cod : 0));

        return {
            total,
            prepaid: prepaidExpected,
            cod,
            codReceived,
            received,
            outstanding: money(Math.max(0, total - received)),
        };
    }

    // No cash on delivery: 'paid' means the whole thing, and anything else means
    // NOTHING has arrived.
    //
    // `prepaid_amount` is the planned figure here exactly as it is on the
    // cash-on-delivery branch above — checkout writes the full total into it the
    // moment the Monobank invoice is created, before the customer has so much as
    // opened the payment page. Reading it as money in hand said an unpaid order
    // was settled: TM-001203 (2838 ₴, invoice created, never paid) reached the
    // CRM as card 13938 carrying «Оплачено повністю: 2838 грн» while the account
    // had not seen a hryvnia (Diana, 2026-08-17). Worse, the two-way sync then
    // filed a real 2838 ₴ payment against that card, because it too asks this
    // function what has arrived.
    //
    // Note what this is NOT about: whether the order belongs in the CRM. Unpaid
    // orders go over as a matter of course (shouldPushToCrm) — they simply go
    // over honestly, marked as still to collect, with no payment filed.
    //
    // payment_status only ever holds 'paid' or 'pending' (verified across all
    // 546 orders), and no column records a partial receipt on a non-COD order,
    // so there is no middle case to preserve.
    const received = order?.payment_status === 'paid' ? total : 0;

    return {
        total,
        prepaid: prepaidRaw,
        cod: 0,
        codReceived: false,
        received,
        outstanding: money(Math.max(0, total - received)),
    };
}

/**
 * Should this order exist in the CRM at all yet?
 *
 * Not the same question as "is it paid". An order awaiting cash on delivery has
 * to be produced and shipped like any other, so waiting for full payment would
 * keep every such order out of the CRM until after it had been delivered —
 * which is the one moment the CRM is no longer useful for it. An order with a
 * prepayment in hand, or one a manager has confirmed, is real work.
 *
 * Orders placed through Instagram reach this the same way: they are entered on
 * the site and paid through it, so the site sees the money first regardless of
 * where the conversation started.
 */
/**
 * Should this order be carried into the CRM?
 *
 * Deliberately NOT a money question (Diana, 2026-08-19: «в кі срм переносяться
 * тільки оплачені замовлення, важливо щоб і не оплачені переносились»). An
 * unpaid order is precisely the one somebody has to chase, and the CRM is where
 * the team does the chasing — keeping it on the site until the money lands
 * means nobody sees it during the hours when following up would still help.
 *
 * So every real order goes: paid, half-paid, or not paid at all. What the
 * caller still filters out is what was never a sale — test personas, mirrored
 * copies of CRM-owned orders, and cancelled/refunded ones (dropped by the
 * sweep's own query).
 *
 * Kept separate from isReadyForCrm on purpose. That one answers a different
 * question — has this order become real enough to consume stock — and widening
 * it would write off shelf inventory for orders that may never be paid.
 */
export function shouldPushToCrm(_order: any): boolean {
  return true;
}

export function isReadyForCrm(order: any): boolean {
    if (order?.payment_status === 'paid') return true;

    // Money actually in hand, not merely planned — an order whose prepayment
    // has not arrived is still just a cart.
    const m = readOrderMoney(order);
    if (m.received > 0) return true;

    return order?.order_status === 'confirmed';
}

/**
 * Which KeyCRM payment method a money event should be filed under.
 *
 * Diana's account does not have one "Монобанк" method — it distinguishes the
 * ARRANGEMENT: «повна оплата», «передоплата», «післяплата». Filing everything
 * under a single id would book every prepayment as a full payment and quietly
 * skew the CRM's own payment reports, so the kind of money picks the method:
 *
 *   - an order with no cash on delivery → the full-payment method
 *   - a cash-on-delivery order before the courier settles → the prepayment
 *     method (what is being filed IS the prepayment)
 *   - the same order once the cash arrived → the cash-on-delivery method,
 *     because the amount being filed now is that balance
 *
 * Each specific id falls back to KEYCRM_PAYMENT_METHOD_ID, so configuring only
 * the one variable still works — it just loses the distinction.
 */
export function paymentMethodIdFor(order: any): number | null {
    const readEnv = (...names: string[]): number | null => {
        for (const name of names) {
            const value = Number(process.env[name]);
            if (Number.isFinite(value) && value > 0) return value;
        }
        return null;
    };

    const m = readOrderMoney(order);

    if (m.cod > 0 && m.codReceived) {
        return readEnv('KEYCRM_PAYMENT_METHOD_COD_ID', 'KEYCRM_PAYMENT_METHOD_ID');
    }
    if (m.cod > 0) {
        return readEnv('KEYCRM_PAYMENT_METHOD_PREPAID_ID', 'KEYCRM_PAYMENT_METHOD_ID');
    }
    return readEnv('KEYCRM_PAYMENT_METHOD_FULL_ID', 'KEYCRM_PAYMENT_METHOD_ID');
}

/** Human-readable payment summary for the CRM card. */
export function describeMoney(m: OrderMoney): string {
    if (m.cod > 0) {
        return [
            `Передоплата: ${m.prepaid} грн${m.received > 0 ? ' (отримана)' : ' (ще не надійшла)'}`,
            m.codReceived
                ? `Післяплата отримана: ${m.cod} грн`
                : `Післяплата при отриманні: ${m.cod} грн`,
        ].join('. ');
    }

    // Unpaid orders now reach the CRM as a matter of course, so the nothing-yet
    // case says so outright instead of «Оплачено 0 грн із 2838 грн» — a manager
    // opening the card has to see at a glance that this one is still to collect.
    if (m.received <= 0) return `Не оплачено: до сплати ${m.total} грн`;

    return m.outstanding > 0
        ? `Оплачено ${m.received} грн із ${m.total} грн, залишок ${m.outstanding} грн`
        : `Оплачено повністю: ${m.total} грн`;
}
