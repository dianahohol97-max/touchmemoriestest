import type { SupabaseClient } from '@supabase/supabase-js';

/** Reward amount credited to the referrer when their friend qualifies. */
export const REFERRAL_REWARD = 50;
/** Reward credited to the FRIEND (referred customer) on the same qualifying order. */
export const REFERRAL_FRIEND_REWARD = 50;
/** Minimum paid order total (UAH) for the friend's first order to qualify. */
export const REFERRAL_MIN_ORDER = 1000;
/** Max share of an order's total that can be paid with bonuses. */
export const BONUS_MAX_REDEEM_RATE = 0.5;

/** Generate a short, readable referral code (no ambiguous chars). */
export function generateReferralCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
}

/**
 * Ensure a customer has a referral_code; create one if missing.
 * Returns the code. Uses the service-role client.
 */
export async function ensureReferralCode(admin: SupabaseClient, customerId: string): Promise<string | null> {
    const { data: cust } = await admin
        .from('customers')
        .select('referral_code')
        .eq('id', customerId)
        .maybeSingle();
    if (!cust) return null;
    if (cust.referral_code) return cust.referral_code;

    // Try a few times in case of unique collision
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateReferralCode();
        const { error } = await admin
            .from('customers')
            .update({ referral_code: code })
            .eq('id', customerId)
            .is('referral_code', null);
        if (!error) {
            const { data: check } = await admin
                .from('customers')
                .select('referral_code')
                .eq('id', customerId)
                .maybeSingle();
            if (check?.referral_code) return check.referral_code;
        }
    }
    return null;
}

/**
 * Process a referral reward when an order transitions to paid.
 *
 * Idempotent and safe to call once per paid transition:
 *  - finds the buyer's pending referral (someone referred them)
 *  - checks the friend was a NEW customer when the referral was created and
 *    that this order is worth >= REFERRAL_MIN_ORDER before credits
 *  - credits REFERRAL_REWARD to the referrer's bonus_balance
 *  - credits REFERRAL_FRIEND_REWARD to the friend on the same order
 *  - marks the referral 'rewarded' and writes bonus_transactions rows
 *
 * All writes use the service-role client. Returns true if a reward was granted.
 */
export async function processReferralReward(
    admin: SupabaseClient,
    opts: { orderId: string; customerId: string | null; orderTotal: number },
): Promise<boolean> {
    const { orderId, customerId, orderTotal } = opts;
    if (!customerId) return false;

    // Is there a pending referral where this customer is the referred friend?
    const { data: referral } = await admin
        .from('referrals')
        .select('id, referrer_id, status, created_at')
        .eq('referred_id', customerId)
        .eq('status', 'pending')
        .maybeSingle();
    if (!referral) return false;

    // Qualify on what the order is WORTH, not on what was charged. `total` is
    // already net of the gift certificate and any bonuses spent, so a 1200 ₴
    // order paid partly with a 300 ₴ certificate landed as total=900 and
    // silently missed the threshold even though the friend really did buy for
    // 1200 ₴. Read the credits back off the order and add them in. Callers all
    // pass order.total, kept as the fallback if the row can't be read.
    const { data: orderRow } = await admin
        .from('orders')
        .select('total, certificate_applied, used_bonus')
        .eq('id', orderId)
        .maybeSingle();
    const grossOrderValue = orderRow
        ? Number(orderRow.total || 0)
          + Number(orderRow.certificate_applied || 0)
          + Number(orderRow.used_bonus || 0)
        : Number(orderTotal);
    if (!Number.isFinite(grossOrderValue) || grossOrderValue < REFERRAL_MIN_ORDER) return false;

    // The friend must have been a NEW customer at the moment they were
    // referred — count only orders they had already paid for BEFORE the
    // referral was created.
    //
    // This used to count every other paid order, i.e. it demanded that the
    // qualifying order be the friend's very first one ever. That created a
    // dead end: a friend whose first purchase came to 800 ₴ could never earn
    // the referral afterwards, because from their second order onwards the
    // count was non-zero and the referral stayed 'pending' forever — nobody
    // got anything, and nothing anywhere explained why. Anchoring the count to
    // the referral's creation time keeps the anti-abuse property that mattered
    // (an existing buyer cannot be retro-referred by a friend's link and cash
    // in on their next order) while letting a genuine new friend qualify on
    // whichever of their orders first reaches the threshold.
    let priorPaidQuery = admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('payment_status', 'paid')
        .neq('id', orderId);
    // created_at is defaulted, but if a row somehow has none we cannot date the
    // referral — fall back to the strict "no other paid order at all" rule
    // rather than skipping the check and handing out a reward we can't justify.
    if (referral.created_at) priorPaidQuery = priorPaidQuery.lt('created_at', referral.created_at);
    const { count: priorPaidCount } = await priorPaidQuery;
    if ((priorPaidCount ?? 0) > 0) {
        // Already a paying customer before the invite — not a new friend.
        return false;
    }

    // Atomically claim the referral (status pending → rewarded) to avoid
    // double-credit on webhook retries.
    const { data: claimed } = await admin
        .from('referrals')
        .update({
            status: 'rewarded',
            qualifying_order_id: orderId,
            reward_amount: REFERRAL_REWARD,
            rewarded_at: new Date().toISOString(),
        })
        .eq('id', referral.id)
        .eq('status', 'pending')   // race guard
        .select('id, referrer_id');
    if (!claimed || claimed.length === 0) return false;

    const referrerId = claimed[0].referrer_id;

    // Credit the referrer's bonus balance.
    const { data: referrer } = await admin
        .from('customers')
        .select('bonus_balance')
        .eq('id', referrerId)
        .maybeSingle();
    const newBalance = Number(referrer?.bonus_balance || 0) + REFERRAL_REWARD;
    await admin.from('customers').update({ bonus_balance: newBalance }).eq('id', referrerId);

    // Ledger entry
    await admin.from('bonus_transactions').insert({
        customer_id: referrerId,
        amount: REFERRAL_REWARD,
        kind: 'referral_reward',
        order_id: orderId,
        referral_id: referral.id,
        note: 'Бонус за приведеного друга',
    });

    // The FRIEND gets a welcome bonus on the same qualifying order (Diana's
    // rule: both sides get 50 ₴, friend's first paid order ≥ 1000 ₴). Sits
    // inside the atomically-claimed branch, so webhook retries can't
    // double-credit either side.
    const { data: friend } = await admin
        .from('customers')
        .select('bonus_balance')
        .eq('id', customerId)
        .maybeSingle();
    const friendBalance = Number(friend?.bonus_balance || 0) + REFERRAL_FRIEND_REWARD;
    await admin.from('customers').update({ bonus_balance: friendBalance }).eq('id', customerId);
    await admin.from('bonus_transactions').insert({
        customer_id: customerId,
        amount: REFERRAL_FRIEND_REWARD,
        kind: 'referral_friend_reward',
        order_id: orderId,
        referral_id: referral.id,
        note: 'Вітальний бонус за реєстрацію за запрошенням',
    });

    return true;
}

/**
 * Return the bonuses a cancelled order had spent.
 *
 * Bonuses are debited at SUBMIT, before any payment, so every path that
 * cancels an order has to hand them back or the customer simply loses them.
 * Two paths do the cancelling — an admin flipping the status, and the
 * unpaid-orders cron — and the cron used to do nothing about bonuses at all,
 * which is the one that would have hurt most: a customer redeems bonuses,
 * never pays, the order auto-cancels a day later and the balance is gone with
 * no record and no way for them to notice.
 *
 * Idempotent: the `order_cancel_refund` row in bonus_transactions is the guard,
 * so re-cancelling or a retried cron run can never credit twice. The balance
 * update uses the same compare-and-swap pattern as the debit in orders/submit,
 * so a concurrent write is never clobbered.
 *
 * Returns the amount actually refunded (0 when there was nothing to give back).
 */
export async function refundOrderBonus(
    admin: SupabaseClient,
    opts: { orderId: string; customerId: string | null; usedBonus: number; orderNumber?: string | null },
): Promise<number> {
    const { orderId, customerId, orderNumber } = opts;
    const usedBonus = Number(opts.usedBonus) || 0;
    if (!customerId || usedBonus <= 0) return 0;

    const { data: already } = await admin
        .from('bonus_transactions')
        .select('id')
        .eq('order_id', orderId)
        .eq('kind', 'order_cancel_refund')
        .limit(1);
    if (already && already.length > 0) return 0;

    for (let attempt = 0; attempt < 3; attempt++) {
        const { data: fresh } = await admin
            .from('customers')
            .select('bonus_balance')
            .eq('id', customerId)
            .maybeSingle();
        const live = Number(fresh?.bonus_balance || 0);
        const { data: updated } = await admin
            .from('customers')
            .update({ bonus_balance: live + usedBonus })
            .eq('id', customerId)
            .eq('bonus_balance', live)
            .select('id');
        if (updated && updated.length > 0) {
            await admin.from('bonus_transactions').insert({
                customer_id: customerId,
                amount: usedBonus,
                kind: 'order_cancel_refund',
                order_id: orderId,
                note: `Повернення бонусів за скасоване замовлення ${orderNumber || orderId}`,
            });
            return usedBonus;
        }
    }
    return 0;
}
