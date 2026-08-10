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
    // only whatever prepayment was recorded.
    const received = order?.payment_status === 'paid' ? total : Math.max(0, prepaidRaw);

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
export function isReadyForCrm(order: any): boolean {
    if (order?.payment_status === 'paid') return true;

    // Money actually in hand, not merely planned — an order whose prepayment
    // has not arrived is still just a cart.
    const m = readOrderMoney(order);
    if (m.received > 0) return true;

    return order?.order_status === 'confirmed';
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

    return m.outstanding > 0
        ? `Оплачено ${m.received} грн із ${m.total} грн, залишок ${m.outstanding} грн`
        : `Оплачено повністю: ${m.total} грн`;
}
