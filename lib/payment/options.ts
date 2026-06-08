// 
// Determines which payment options are available for a given cart.
//
// Rules:
//   - 'full_only'           → must be paid 100% online (e.g. photo prints, magnets, calendars)
//   - 'full_or_split'       → can be paid 100% online OR 50% online + 50% on delivery
//   - 'full_only_if_alone'  → 100% online if it's the only product in cart;
//                              otherwise inherits behavior from accompanying items
//
// Cart-level logic:
//   allowSplit is true iff:
//     - no item has payment_mode='full_only'
//     - at least one item has payment_mode='full_or_split'
//
// Items with 'full_only_if_alone' don't block split on their own, but they
// also don't enable it — there must be a 'full_or_split' item present.
//

export type PaymentMode = 'full_only' | 'full_or_split' | 'full_only_if_alone';

export interface CartItemPayment {
  payment_mode?: PaymentMode | null;
  slug?: string;
  name?: string;
}

export interface PaymentOptions {
  /** Whether the cart can be paid in full online (always true — fallback). */
  allowFull: boolean;
  /** Whether the cart can be split 50% online + 50% on delivery. */
  allowSplit: boolean;
  /** Human-readable reason split is disabled (for tooltip). null if split is allowed. */
  splitBlockedReason: string | null;
}

export function getAvailablePaymentOptions(items: CartItemPayment[]): PaymentOptions {
  if (!items || items.length === 0) {
    return { allowFull: true, allowSplit: false, splitBlockedReason: 'Кошик порожній' };
  }

  // Treat missing mode as 'full_only' (safe default).
  const modes = items.map(i => (i.payment_mode || 'full_only') as PaymentMode);

  // Need at least one full_or_split item to offer the 50% prepayment at all.
  // A mixed cart (some full_only + at least one splittable) NO LONGER blocks
  // split: the split simply becomes "full_only items fully prepaid + 50% of the
  // rest" (computed in computePaymentAmounts via fullPrepaidPortion). This lets
  // a customer who adds e.g. a photobook (splittable) + a фотодрук (full_only)
  // still pay part on delivery instead of being forced into full prepayment.
  const hasSplittable = modes.some(m => m === 'full_or_split');
  if (!hasSplittable) {
    return {
      allowFull: true,
      allowSplit: false,
      splitBlockedReason: 'Для товарів у кошику доступна лише повна онлайн-оплата',
    };
  }

  return { allowFull: true, allowSplit: true, splitBlockedReason: null };
}

/**
 * Computes prepaid_amount, cod_amount, pickup_unpaid_balance for an order.
 *
 * @param total                Total order amount (after discounts).
 * @param paymentType          'full' (100% online) or 'split' (50% online + 50% later)
 * @param deliveryMethod       'pickup' | 'nova_poshta' | ... — affects whether the
 *                             remaining 50% goes to COD (Nova Poshta backward
 *                             delivery) or to a pickup-cash balance.
 */
export function computePaymentAmounts(
  total: number,
  paymentType: 'full' | 'split',
  deliveryMethod: string,
  fullPrepaidPortion: number = 0,
): {
  prepaid_amount: number;
  cod_amount: number;
  pickup_unpaid_balance: number;
} {
  const t = Math.max(0, Math.round(Number(total) || 0));
  if (paymentType === 'full') {
    return { prepaid_amount: t, cod_amount: 0, pickup_unpaid_balance: 0 };
  }
  // split: full_only items are charged in full up front; the remaining
  // (splittable items + delivery − discount) is split 50% online / 50% later.
  // fullPrepaidPortion = 0 reduces this to a plain 50/50 of the whole total.
  const fp = Math.max(0, Math.min(t, Math.round(Number(fullPrepaidPortion) || 0)));
  const splitBase = Math.max(0, t - fp);
  const halfOfSplit = Math.round(splitBase / 2);
  const prepaid = Math.min(t, fp + halfOfSplit);
  const remaining = t - prepaid;
  const isPickup = /pickup|самовивіз/i.test(deliveryMethod);
  return {
    prepaid_amount: prepaid,
    cod_amount: isPickup ? 0 : remaining,
    pickup_unpaid_balance: isPickup ? remaining : 0,
  };
}
