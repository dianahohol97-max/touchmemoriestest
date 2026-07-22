/**
 * Constructor funnel tracking.
 *
 * The GA4 default ecommerce funnel (view_item → add_to_cart → purchase) is
 * useless for TouchMemories: between "looked at Travel Book" and "added to
 * cart" the customer spends 20–40 minutes assembling a book. Almost everyone
 * who drops off does so INSIDE that gap, and the standard events cannot see it.
 *
 * These events fill the gap:
 *
 *   view_item            (product page — already fired by AnalyticsProvider)
 *   → open_constructor     opened the configurator (/order/book)
 *   → constructor_config   picked size/cover/pages, moved on to upload
 *   → upload_photo         uploaded photos, entered the layout editor
 *   → spread_completed     filled ≥3 spreads (first "real work" signal)
 *   → draft_saved          a draft persisted to Supabase (recoverable customer)
 *   → add_to_cart          finished the book
 *   → begin_checkout       (checkout page)
 *   → purchase             (paid)
 *
 * Every event carries `device` (mobile|desktop) because ~70% of traffic comes
 * from Instagram, i.e. phones — and a mobile-only drop-off looks identical to a
 * general drop-off unless the dimension is there.
 *
 * All calls are fire-and-forget and safe before consent: if gtag/fbq were never
 * loaded (analytics consent denied), the calls are simply no-ops.
 */

export type FunnelStep =
  | 'open_constructor'
  | 'constructor_config'
  | 'upload_photo'
  | 'spread_completed'
  | 'draft_saved';

export interface FunnelParams {
  /** Product slug, e.g. 'travelbook-20x30'. The single most useful dimension. */
  product_slug?: string;
  /** photobook | travelbook | magazine | wishbook | ... */
  product_type?: string;
  /** Photos the customer brought in. */
  photo_count?: number;
  /** Spreads with at least one photo placed. */
  spread_count?: number;
  /** Pages in the current configuration. */
  page_count?: number;
  /** Price at this moment, UAH — lets us see whether expensive configs drop off more. */
  value?: number;
}

function device(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 640 ? 'mobile' : 'desktop';
}

/**
 * Send one funnel step. Steps are idempotent per session per product: the
 * editor re-renders constantly and effects re-run, and a funnel where
 * `spread_completed` fires forty times per user measures nothing. The guard
 * lives in sessionStorage so a page refresh mid-flow doesn't double-count,
 * while a genuinely new session (new book) starts clean.
 */
export function trackFunnelStep(step: FunnelStep, params: FunnelParams = {}): void {
  if (typeof window === 'undefined') return;

  const key = `tm_funnel_${step}_${params.product_slug || 'unknown'}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* sessionStorage unavailable (private mode, quota) — send anyway, a
       duplicate event is better than a missing funnel. */
  }

  const payload = {
    ...params,
    device: device(),
    currency: 'UAH',
  };

  try {
    window.gtag?.('event', step, payload);
  } catch { /* analytics must never break the editor */ }

  // Meta needs InitiateCheckout-shaped custom events to build retargeting
  // audiences. "Started a book and didn't finish" is the single most valuable
  // audience TouchMemories can build — these people already invested effort.
  try {
    if (window.fbq) {
      window.fbq('trackCustom', step, {
        content_ids: params.product_slug ? [params.product_slug] : undefined,
        content_type: 'product',
        value: params.value,
        currency: 'UAH',
        device: payload.device,
      });
    }
  } catch { /* no-op */ }
}

/**
 * Reset the per-session guards for one product. Called after add_to_cart so
 * that a customer who immediately starts a SECOND book is measured as a second
 * pass through the funnel, not as silence.
 */
export function resetFunnel(productSlug?: string): void {
  if (typeof window === 'undefined') return;
  const steps: FunnelStep[] = [
    'open_constructor',
    'constructor_config',
    'upload_photo',
    'spread_completed',
    'draft_saved',
  ];
  try {
    for (const s of steps) sessionStorage.removeItem(`tm_funnel_${s}_${productSlug || 'unknown'}`);
  } catch { /* no-op */ }
}
