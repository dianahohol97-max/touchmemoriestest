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

// The OFFICIAL production terms, exactly as the customer sees them in the
// product options: «Стандартна (5–8 днів)» and «Термінова до 5 робочих днів
// (+30%)». The deadline is the outer edge of the promise, counted in working
// days from the ORDER date — not from payment, and not from a number invented
// here. An earlier scaffold used 5/2 days from payment; Diana corrected it:
// the terms the shop publishes are the terms the calendar must hold it to.
const STANDARD_TERM_WORKING_DAYS = 8;
const EXPRESS_TERM_WORKING_DAYS = 5;

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

    // From the ORDER date. The promise to the customer starts the moment they
    // ordered, whatever the payment method did afterwards.
    const start = new Date(order?.created_at || order?.paid_at || now);
    const base = addWorkingDays(
        Number.isFinite(start.getTime()) ? start : now,
        express ? EXPRESS_TERM_WORKING_DAYS : STANDARD_TERM_WORKING_DAYS,
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
