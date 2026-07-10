//
// Single source of truth for the two pricing decisions that depend on
// (interface language) × (delivery destination). Pure — no DB, no React —
// so the SAME function runs on the server (authoritative, in /api/orders/submit
// and /api/monobank/create-invoice) and on the client (display in cart/checkout).
// "Shown == charged" only holds if both sides call this.
//
// The matrix this encodes (canonical price is always UAH):
//
//   Хто              Мова     Доставка   Множник   Показ
//   укр в Україні    uk       UA         1.0       UAH
//   укр за кордоном  uk       INTL       1.0       UAH
//   іноз в Україні   non-uk   UA         1.0       EUR
//   іноз за кордоном non-uk   INTL       1.30      EUR
//
// IMPORTANT: the markup is a function of locale × shipRegion, NOT of currency.
// Showing a price in EUR does NOT by itself add the markup (a non-uk customer
// shipping inside UA pays base). Do not re-couple markup to currency.
//
import type { Currency } from '@/lib/i18n/currency';
import { formatPrice } from '@/lib/i18n/currency';

export type ShipRegion = 'UA' | 'INTL';

/** The international markup multiplier (+30%). */
export const INTL_MARKUP = 1.30;

/**
 * Resolve the canonical-price multiplier. Applies ONLY at the intersection
 * of a non-Ukrainian interface and an international delivery destination.
 */
export function resolvePriceMultiplier(locale: string, shipRegion: ShipRegion): number {
  return (locale !== 'uk' && shipRegion === 'INTL') ? INTL_MARKUP : 1.0;
}

/**
 * Resolve the display currency. Default follows locale (uk → UAH, else EUR);
 * an explicit user choice from the currency switcher always wins.
 */
export function resolveDisplayCurrency(locale: string, userChoice?: Currency | null): Currency {
  if (userChoice) return userChoice;
  return locale === 'uk' ? 'UAH' : 'EUR';
}

/** Normalise an arbitrary string into a valid ShipRegion ('UA' fallback). */
export function normalizeShipRegion(value: unknown): ShipRegion {
  return value === 'INTL' || value === 'international' ? 'INTL' : 'UA';
}

/** Map a ShipRegion to the bank_accounts.region / payment_region value. */
export function shipRegionToPaymentRegion(shipRegion: ShipRegion): 'ua' | 'international' {
  return shipRegion === 'INTL' ? 'international' : 'ua';
}

/** Default international shipping policy (overridable via settings.intl_shipping). */
export interface IntlShippingConfig {
  /** Order subtotal (in EUR) at/above which intl delivery is free. */
  freeThresholdEur: number;
  /** Flat intl delivery fee (in EUR) charged below the free threshold. */
  flatFeeEur: number;
}
export const DEFAULT_INTL_SHIPPING: IntlShippingConfig = {
  freeThresholdEur: 0,
  flatFeeEur: 25,
};

/**
 * Compute the international delivery fee, in UAH, for an order.
 *
 * Free shipping is OFF when freeThresholdEur <= 0 (always charge the flat fee).
 * When it's > 0, orders whose marked subtotal (converted to EUR with the same
 * buffered rate used everywhere) reaches the threshold ship free. Charge is
 * always UAH, so the EUR flat fee is converted back to UAH.
 *
 * Pure: pass the rate (UAH-per-EUR) and config in.
 */
export function computeIntlShippingUah(
  markedSubtotalUah: number,
  eurRate: number,
  cfg: IntlShippingConfig = DEFAULT_INTL_SHIPPING,
): number {
  if (!eurRate || eurRate <= 0) return Math.round(cfg.flatFeeEur * 50); // defensive
  if (cfg.freeThresholdEur > 0 && markedSubtotalUah / eurRate >= cfg.freeThresholdEur) return 0;
  return Math.round(cfg.flatFeeEur * eurRate);
}

/**
 * Default delivery destination assumed for a locale BEFORE the customer
 * chooses one at checkout. Ukrainian interface → UA; any other → INTL.
 * Storefront product cards use this so the listed price already reflects the
 * most likely destination; if a non-uk visitor later picks UA delivery at
 * checkout the price only goes DOWN (markup removed), never jumps up.
 */
export function defaultShipRegion(locale: string): ShipRegion {
  return locale === 'uk' ? 'UA' : 'INTL';
}

/**
 * Format a BASE-UAH price for storefront display. Applies the (locale ×
 * shipRegion) markup, then converts to the display currency. shipRegion
 * defaults to the locale's default destination (cards don't know the real
 * destination yet). The markup lives ONLY here via resolvePriceMultiplier —
 * convertPrice itself is markup-free.
 */
export function formatDisplayPrice(
  uahBase: number | null | undefined,
  locale: string,
  currency: Currency,
  shipRegion?: ShipRegion,
): string {
  if (!uahBase && uahBase !== 0) return '';
  const region = shipRegion ?? defaultShipRegion(locale);
  const marked = uahBase * resolvePriceMultiplier(locale, region);
  return formatPrice(marked, currency);
}

/**
 * Which ФОП collects the money for this order, derived from how it ships.
 *
 * Two flows (designer orders, magazine text brief) used to hardcode 'ua', so a
 * foreign customer ordering through them would have been invoiced on the wrong
 * account. They only offer Ukrainian delivery today, which is why nobody
 * noticed — but the rule belongs in one place, next to the money.
 */
export function deliveryToPaymentRegion(
  deliveryMethod: string | null | undefined,
  countryCode?: string | null,
): 'ua' | 'international' {
  const country = String(countryCode || '').trim().toUpperCase();
  if (country && country !== 'UA') return 'international';

  const method = String(deliveryMethod || '').trim().toLowerCase();
  if (method === 'international' || method === 'intl' || method.includes('world')) {
    return 'international';
  }
  // nova_poshta, pickup, ukrposhta, courier … all domestic.
  return 'ua';
}
