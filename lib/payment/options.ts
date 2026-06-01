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

  // Any 'full_only' product blocks split
  const fullOnlyItem = items.find((_, idx) => modes[idx] === 'full_only');
  if (fullOnlyItem) {
    return {
      allowFull: true,
      allowSplit: false,
      splitBlockedReason: `Для товару «${fullOnlyItem.name || fullOnlyItem.slug || 'у кошику'}» доступна лише повна онлайн-оплата`,
    };
  }

  // Need at least one full_or_split to enable split
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
): {
  prepaid_amount: number;
  cod_amount: number;
  pickup_unpaid_balance: number;
} {
  const t = Math.max(0, Math.round(Number(total) || 0));
  if (paymentType === 'full') {
    return { prepaid_amount: t, cod_amount: 0, pickup_unpaid_balance: 0 };
  }
  // split: 50% online up front, 50% later
  const half = Math.round(t / 2);
  const remaining = t - half;
  const isPickup = /pickup|самовивіз/i.test(deliveryMethod);
  return {
    prepaid_amount: half,
    cod_amount: isPickup ? 0 : remaining,
    pickup_unpaid_balance: isPickup ? remaining : 0,
  };
}
