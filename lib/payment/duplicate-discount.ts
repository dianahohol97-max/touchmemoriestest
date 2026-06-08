// Auto-discount on extra copies of the SAME book.
//
// When a customer orders several copies of one book (qty ≥ 2 on a single cart
// line — i.e. the same design printed more than once), every copy from the 2nd
// onward gets a per-product discount off its unit price. The 1st copy is full
// price.
//
// Each cover material is its own product (photobook-printed, photobook-velour,
// …), so the rate is keyed by slug. Edit this map to change rates or add
// products. Anything not listed here gets no automatic copy discount.
//
//   photobook-printed              — друкована обкладинка
//   photobook-velour               — велюрова обкладинка
//   photobook-fabric               — тканинна обкладинка   (assumed = velour tier)
//   photobook-leatherette          — шкірзамінник          (assumed = velour tier)
//   fotozhurnal-tverd-obkladynka   — фотожурнал (тверда)
//   personalized-glossy-magazine   — глянцевий журнал (м'яка)
export const COPY_DISCOUNT_RATE: Record<string, number> = {
  'photobook-printed': 0.15,
  'photobook-velour': 0.10,
  'photobook-fabric': 0.10,
  'photobook-leatherette': 0.10,
  'fotozhurnal-tverd-obkladynka': 0.15,
  'personalized-glossy-magazine': 0.15,
};

/** Discount rate (0–1) for extra copies of the given product slug. 0 = none. */
export function copyDiscountRate(slug?: string | null): number {
  if (!slug) return 0;
  return COPY_DISCOUNT_RATE[slug.toLowerCase().trim()] || 0;
}

/**
 * UAH discount for a single cart line, applied to copies from the 2nd onward:
 *   rate × unit_price × (qty − 1)
 * Returns 0 when the product has no copy discount or qty < 2.
 */
export function duplicateDiscountForItem(item: { slug?: string | null; price: number; qty: number }): number {
  const rate = copyDiscountRate(item.slug);
  if (rate <= 0 || !(item.qty >= 2) || !(item.price > 0)) return 0;
  return Math.round(item.price * (item.qty - 1) * rate);
}

/** Total copy discount across a cart. */
export function duplicateDiscountForCart(items: Array<{ slug?: string | null; price: number; qty: number }>): number {
  return (items || []).reduce((sum, it) => sum + duplicateDiscountForItem(it), 0);
}
