import type { SupabaseClient } from '@supabase/supabase-js';

/** Reward amount credited to the referrer when their friend qualifies. */
export const REFERRAL_REWARD = 50;
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
 *  - checks this is their FIRST paid order and total >= REFERRAL_MIN_ORDER
 *  - credits REFERRAL_REWARD to the referrer's bonus_balance
 *  - marks the referral 'rewarded' and writes a bonus_transactions row
 *
 * All writes use the service-role client. Returns true if a reward was granted.
 */
export async function processReferralReward(
    admin: SupabaseClient,
    opts: { orderId: string; customerId: string | null; orderTotal: number },
): Promise<boolean> {
    const { orderId, customerId, orderTotal } = opts;
    if (!customerId) return false;
    if (!Number.isFinite(orderTotal) || orderTotal < REFERRAL_MIN_ORDER) return false;

    // Is there a pending referral where this customer is the referred friend?
    const { data: referral } = await admin
        .from('referrals')
        .select('id, referrer_id, status')
        .eq('referred_id', customerId)
        .eq('status', 'pending')
        .maybeSingle();
    if (!referral) return false;

    // Ensure this is the friend's FIRST paid order (count prior paid orders).
    const { count: paidCount } = await admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('payment_status', 'paid')
        .neq('id', orderId);
    if ((paidCount ?? 0) > 0) {
        // Friend already had a paid order before — first-order condition not met.
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

    return true;
}
