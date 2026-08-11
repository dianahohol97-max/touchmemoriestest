import { isTestOrder } from '@/lib/automation/test-orders';

/**
 * The one definition of "this order is still production work".
 *
 * It was born inline in the production-calendar route, and Софія's answers
 * grew their own weaker copy: only statuses new/confirmed, no CRM-stage check,
 * no handover cutoff. The result was a «що сьогодні термінового» reply listing
 * July orders finished in KeyCRM weeks ago — while the mirrored CRM orders
 * actually in production (in_production, quality_check) were invisible to her.
 * One predicate, shared by the board and the bot, ends the drift: whatever the
 * calendar shows is exactly what Софія talks about.
 */

/** Statuses that still need somebody's hands — everything before shipping. */
export const PRODUCTION_ACTIVE_STATUSES = ['new', 'confirmed', 'in_production', 'quality_check'];

/**
 * The CRM stage says this order's production is over: done, cancelled, or the
 * parcel already moving. `delivered_to_delivery` contains "delivered" but means
 * the parcel just left — it is matched here on purpose: nothing left to produce.
 */
const CLOSED_CRM_STAGE_RE = /completed|виконан|доставлен|отриман|delivered|cancel|скасов|анульов|refund|повернен|transit|дороз|відправ|to_delivery|shipped/;

export function isClosedCrmStage(stageLabel: string | null | undefined): boolean {
    const label = String(stageLabel || '').toLowerCase();
    return !!label && CLOSED_CRM_STAGE_RE.test(label);
}

/** The minimum row shape the predicate needs — select at least these columns. */
export type ProductionVisibilityRow = {
    customer_name?: string | null;
    source?: string | null;
    created_at?: string | null;
    custom_attributes?: any;
};

/**
 * Should this order appear as live production work?
 *
 * The rules, in the order they knock an order out:
 *
 *  1. Test orders («Киця Кицюня») are not work.
 *  2. The CRM stage is the truth about production even when the site status
 *     lags a reconcile batch: an order the CRM already calls completed /
 *     cancelled / in transit has nothing left to produce.
 *  3. The handover line (Diana, 2026-08-11): site orders placed BEFORE the
 *     automation cutoff (KEYCRM_SYNC_FROM) were carried into the CRM by hand
 *     and their production is tracked there — showing them would double every
 *     one as "work". They reappear only once the mirror ties the CRM card back
 *     to the site row, because then their live stage flows in and rule 2 can
 *     see it. Mirrored CRM orders are always in — that is where the current
 *     queue lives.
 */
export function isVisibleProductionOrder(order: ProductionVisibilityRow): boolean {
    if (isTestOrder(order)) return false;

    const keycrm = order.custom_attributes?.keycrm;
    if (isClosedCrmStage(keycrm?.status_label)) return false;

    if (order.source === 'keycrm') return true;

    const cutoffRaw = String(process.env.KEYCRM_SYNC_FROM || '').trim();
    const cutoff = cutoffRaw ? new Date(cutoffRaw).getTime() : NaN;
    if (!Number.isFinite(cutoff)) return true;

    if (keycrm?.order_id) return true;

    return new Date(order.created_at || 0).getTime() >= cutoff;
}
