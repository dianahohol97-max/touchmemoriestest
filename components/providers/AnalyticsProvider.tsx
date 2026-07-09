'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { MetaPixel } from '@/components/analytics/MetaPixel';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    fbq: any;
    dataLayer: any[];
    _fbq: any;
  }
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT || process.env.NEXT_PUBLIC_GA_ID || '', {
        page_path: pathname,
      });
    }
  }, [pathname, searchParams]);

  return (
    <>
      <GoogleAnalytics />
      <MetaPixel />
    </>
  );
}

/**
 * GA4 items[] arrive here in three different shapes and the mismatch is why
 * item revenue read $0.00 in GA4 while total revenue was non-zero:
 *
 *   product page  → { id, name, price }
 *   cart store    → { id, name, price, qty }            ← `qty`, not `quantity`
 *   orders.items  → { product_slug, product_name, price, quantity }  ← no id/name
 *
 * The old mapping read `item.id`/`item.name`/`item.quantity` for all three, so
 * purchase events shipped items with undefined item_id and item_name. GA4 kept
 * the transaction total but could not attribute a single hryvnia to a product.
 * Normalising once here keeps every event on the same shape.
 */
function normalizeItem(item: any) {
  return {
    item_id: item.item_id || item.id || item.product_id || item.product_slug || item.slug,
    item_name: item.item_name || item.name || item.product_name || item.title,
    price: Number(item.price) || 0,
    quantity: Number(item.quantity ?? item.qty) || 1,
  };
}

export const trackViewItem = (product: any) => {
  if (typeof window === 'undefined') return;

  const itemData = {
    item_id: product.id,
    item_name: product.name,
    item_category: product.category_id,
    price: product.price,
    currency: 'UAH',
  };

  if (window.gtag) {
    window.gtag('event', 'view_item', {
      currency: 'UAH',
      value: product.price,
      items: [itemData],
    });
  }

  if (window.fbq) {
    window.fbq('track', 'ViewContent', {
      content_ids: [product.id],
      content_type: 'product',
      value: product.price,
      currency: 'UAH',
    });
  }
};

export const trackAddToCart = (product: any, quantity: number = 1) => {
  if (typeof window === 'undefined') return;

  const itemData = {
    ...normalizeItem(product),
    item_category: product.category_id || product.category_slug,
    quantity,
  };
  const value = itemData.price * quantity;

  if (window.gtag) {
    window.gtag('event', 'add_to_cart', {
      currency: 'UAH',
      value,
      items: [itemData],
    });
  }

  if (window.fbq) {
    window.fbq('track', 'AddToCart', {
      content_ids: [itemData.item_id],
      content_type: 'product',
      value,
      currency: 'UAH',
    });
  }
};

export const trackBeginCheckout = (cartItems: any[], totalValue: number) => {
  if (typeof window === 'undefined') return;

  const items = cartItems.map(normalizeItem);

  if (window.gtag) {
    window.gtag('event', 'begin_checkout', {
      currency: 'UAH',
      value: totalValue,
      items: items,
    });
  }

  if (window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      content_ids: items.map(i => i.item_id),
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      value: totalValue,
      currency: 'UAH',
    });
  }
};

export const trackPurchase = (orderId: string, cartItems: any[], totalValue: number) => {
  if (typeof window === 'undefined') return;

  // Fire once per order per session: the order can be reached from both
  // /dyakuiemo (Monobank redirect) and /order/[id]/success, and pages can
  // be refreshed — without this, GA4/Pixel revenue would be double-counted.
  try {
    const key = `tm_purchase_${orderId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* sessionStorage unavailable — fall through */ }

  const items = cartItems.map(normalizeItem);

  if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: orderId,
      currency: 'UAH',
      value: totalValue,
      items: items,
    });
  }

  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      content_ids: items.map(i => i.item_id),
      content_type: 'product',
      value: totalValue,
      currency: 'UAH',
    });
  }
};
