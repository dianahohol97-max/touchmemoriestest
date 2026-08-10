import { addWorkingDays } from '@/lib/automation/deadline-calculator';
import { readOrderDeadlineHint } from '@/lib/automation/deadline-hints';

/**
 * The one place a production deadline is decided.
 *
 * Every order gets one — including the Instagram orders mirrored in from
 * KeyCRM. A production calendar with holes in it is worse than no calendar,
 * because the holes look like free capacity.
 *
 * Three inputs, in order of authority:
 *
 *   1. A date the customer asked for, read out of their comment. This is the
 *      only input that reflects why the order exists — a wedding, a birthday,
 *      a flight. It binds only when it is EARLIER than what we would have
 *      planned: a customer who needs the book by December does not entitle us
 *      to take until December.
 *   2. A statement of urgency with no date. Moves the order onto the express
 *      schedule.
 *   3. Otherwise the standard calculation from paid date, page count and how
 *      busy the queue is.
 *
 * The requested date is pulled back by a shipping buffer, because the customer
 * means "in my hands by then", not "leaves your desk by then". Finishing on the
 * day of the wedding is the same as missing it.
 */

// Fallback terms for products that state none. The real term is per product —
// products.production_time carries the published promise («14–18 робочих днів»
// for a velvet photobook, «1–3 робочих дні» for accessories) and the caller
// passes those in via productTermsBySlug. These constants only cover a product
// with an empty field.
const STANDARD_TERM_WORKING_DAYS = 8;
const EXPRESS_TERM_WORKING_DAYS = 5;

/**
 * The published term as a number of working days: the LAST number in the text,
 * because «14–18 робочих днів» promises the customer the outer edge, and a
 * deadline planned on the optimistic edge would be missed by design half the
 * time.
 */
export function parseProductionDays(text: string | null | undefined): number | null {
    const numbers = String(text || '').match(/\d+/g);
    if (!numbers || !numbers.length) return null;
    const days = Number(numbers[numbers.length - 1]);
    return Number.isFinite(days) && days > 0 && days <= 60 ? days : null;
}

// Working days reserved for packing and delivery between finishing an order and
// the customer holding it.
const SHIPPING_BUFFER_DAYS = 2;

// Nothing is ever planned for the same day it is discovered: an order that
// needs to be ready today needs a person told, not a deadline quietly set in
// the past.
const MIN_LEAD_DAYS = 1;

/**
 * Step back over working days.
 *
 * Not `addWorkingDays` with a negative count: that helper's loop runs while
 * `daysAdded < workingDays`, so a negative argument exits immediately and hands
 * back the same date. The shipping buffer would silently disappear and every
 * requested date would be treated as the finish date.
 */
function subtractWorkingDays(from: Date, days: number): Date {
    const result = new Date(from);
    let removed = 0;

    while (removed < days) {
        result.setDate(result.getDate() - 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) removed++;
    }

    return result;
}

export type ResolvedDeadline = {
    deadline: Date;
    /** Which rule decided it, for the admin card and for debugging. */
    reason: 'requested-date' | 'urgent' | 'standard';
    /** The customer's words behind a requested date or an urgency flag. */
    evidence: string[];
    /** The date the customer actually named, when they named one. */
    requestedDate: Date | null;
};

export function resolveOrderDeadline(order: any, params?: {
    activeOrdersCount?: number;
    now?: Date;
    /** Published per-product terms in working days, keyed by slug. */
    productTermsBySlug?: Record<string, number>;
}): ResolvedDeadline {
    const now = params?.now ?? new Date();
    const attrs = order?.custom_attributes || {};

    const hint = readOrderDeadlineHint(order, now);

    const hasExpressTag = Array.isArray(attrs?.tags)
        ? attrs.tags.some((t: string) => String(t).includes('швидше'))
        : false;

    // PAID express. The customer chose «Термінова до 5 робочих днів (+30%)» in
    // the product options and paid the surcharge — that is a contractual term,
    // not a mood. Detected in the chosen option values and in the price
    // breakdown; the check is against the VALUE («Термінова…»), because the
    // option GROUP is named «Терміновість» on every order, standard ones too.
    const items = Array.isArray(order?.items) ? order.items : [];
    const hasPaidExpress = items.some((item: any) => {
        const options = item?.options && typeof item.options === 'object' ? item.options : {};
        const optionHit = Object.values(options).some(v => /термінов/i.test(String(v)));
        const breakdownHit = Array.isArray(item?.price_breakdown)
            && item.price_breakdown.some((row: any) => /термінов|швидше/i.test(String(row?.label || '')));
        return optionHit || breakdownHit;
    });

    const express = hasPaidExpress || hasExpressTag || hint.urgent;

    // The standard term is the SLOWEST product in the order: the parcel ships
    // when the velvet photobook («14–18 робочих днів») is done, not when the
    // photo corners («1–3 робочих дні») are.
    const termsBySlug = params?.productTermsBySlug || {};
    const itemTerms = items
        .map((item: any) => termsBySlug[String(item?.slug || '')])
        .filter((d: any): d is number => Number.isFinite(d) && d > 0);
    const standardTerm = itemTerms.length ? Math.max(...itemTerms) : STANDARD_TERM_WORKING_DAYS;

    // The paid-express promise carries its own number in the option text
    // («Термінова до 5 робочих днів»), so it is read from there rather than
    // assumed. Express never makes an order SLOWER than its standard term —
    // accessories that take three days stay at three.
    let expressDays = EXPRESS_TERM_WORKING_DAYS;
    for (const item of items) {
        const options = item?.options && typeof item.options === 'object' ? item.options : {};
        for (const value of Object.values(options)) {
            if (/термінов/i.test(String(value))) {
                // The number BEFORE «робочих», not the last number in the
                // string: «Термінова до 5 робочих днів (+30%)» ends in 30, and
                // the test run proved the naive parse promotes the surcharge to
                // a thirty-day term.
                const m = String(value).match(/(\d+)\s*робоч/i);
                if (m) expressDays = Number(m[1]);
            }
        }
    }

    // From the ORDER date. The promise to the customer starts the moment they
    // ordered, whatever the payment method did afterwards.
    const start = new Date(order?.created_at || order?.paid_at || now);
    const base = addWorkingDays(
        Number.isFinite(start.getTime()) ? start : now,
        express ? Math.min(standardTerm, expressDays) : standardTerm,
    );

    const floor = addWorkingDays(now, MIN_LEAD_DAYS);

    if (hint.requestedDate) {
        // Back off from the customer's date so the parcel can travel.
        const mustFinishBy = subtractWorkingDays(hint.requestedDate, SHIPPING_BUFFER_DAYS);
        const bounded = mustFinishBy.getTime() < floor.getTime() ? floor : mustFinishBy;

        // The customer's date wins in two situations, not one. When it is
        // earlier than the standard plan, it tightens the plan — that is the
        // obvious case. But when the standard plan is already in the PAST (an
        // old order that sat in a queue), the customer's future date is the
        // only commitment that still means anything: leaving the deadline on
        // the long-gone standard date paints the order as hopelessly overdue
        // when the customer needs it by the 16th and there is still time. The
        // "a December wish does not extend a fresh order" rule is untouched —
        // it only applies while the standard plan is still achievable.
        const basePast = base.getTime() < floor.getTime();

        if (bounded.getTime() < base.getTime() || basePast) {
            return {
                deadline: bounded,
                reason: 'requested-date',
                evidence: hint.evidence,
                requestedDate: hint.requestedDate,
            };
        }
    }

    return {
        deadline: base,
        reason: express ? 'urgent' : 'standard',
        evidence: hint.evidence,
        requestedDate: hint.requestedDate,
    };
}
