export type Currency = 'UAH' | 'EUR' | 'GBP' | 'USD';

// Exchange rates: how many UAH per 1 unit of currency
// Updated: April 5, 2026
export const EXCHANGE_RATES: Record<Currency, number> = {
  UAH: 1,
  EUR: 50.76,
  GBP: 57.89,
  USD: 43.79,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  UAH: '₴',
  EUR: '€',
  GBP: '£',
  USD: '$',
};

// +20% international markup.
// DEPRECATED as a currency concern: the markup is NOT a function of currency.
// It is decided by (locale × shipRegion) in lib/payment/pricing-region.ts.
// Kept only for backward-compat; do not use it to gate display currency.
export const INTERNATIONAL_MARKUP = 1.20;

/**
 * Detect the appropriate currency based on locale and browser language.
 * - uk → UAH (no conversion)
 * - en → GBP for GB, USD for US, EUR for everything else
 * - de, pl, ro → EUR
 */
export function detectCurrency(locale: string): Currency {
  if (locale === 'uk') return 'UAH';

  if (locale === 'en' && typeof navigator !== 'undefined') {
    const lang = navigator.language || '';
    if (lang.startsWith('en-GB') || lang.startsWith('en-IE')) return 'GBP';
    if (lang.startsWith('en-US') || lang.startsWith('en-CA') || lang.startsWith('en-AU')) return 'USD';
    return 'EUR';
  }

  // de, pl, ro → EUR
  return 'EUR';
}

/**
 * Pure currency conversion — NO markup. Converts a (possibly already
 * marked-up) UAH amount into the target currency for display only.
 * The +20% intl markup, when it applies, must be applied to the UAH amount
 * BEFORE calling this (see lib/payment/pricing-region.formatDisplayPrice).
 */
export function convertPrice(uahPrice: number, currency: Currency): number {
  if (currency === 'UAH') return Math.round(uahPrice);
  return Math.ceil(uahPrice / EXCHANGE_RATES[currency]);
}

/**
 * Format a UAH price for display in the given currency.
 * Returns e.g. "₴450", "€11", "£9", "$10"
 */
export function formatPrice(uahPrice: number | null | undefined, currency: Currency): string {
  if (!uahPrice && uahPrice !== 0) return '';
  const converted = convertPrice(uahPrice, currency);
  const symbol = CURRENCY_SYMBOLS[currency];
  if (currency === 'UAH') return `${converted} ${symbol}`;
  return `${symbol}${converted}`;
}
