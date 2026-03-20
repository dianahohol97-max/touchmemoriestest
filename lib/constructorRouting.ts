// lib/constructorRouting.ts
// Single source of truth for all product → page routing

export type ProductType =
  | 'photobook'
  | 'photobook-standard'
  | 'photobook-premium'
  | 'travelbook'
  | 'magazine'
  | 'photo-journal-soft'
  | 'photo-journal-hard'
  | 'calendar'
  | 'calendar-desktop'
  | 'calendar-wall'
  | 'guestbook'
  | 'wishbook'
  | 'photoalbum'
  | 'prints'
  | 'magnets'
  | 'puzzles'
  | 'posters';

export interface ConstructorConfig {
  productType: ProductType;
  format?: string;
  pages?: number;
  coverType?: string;
  tier?: string;
  [key: string]: unknown;
}

// Products that go through the wizard first
const WIZARD_PRODUCTS: ProductType[] = [
  'photobook',
  'photobook-standard',
  'photobook-premium',
  'travelbook',
  'magazine',
  'photo-journal-soft',
  'photo-journal-hard',
  'calendar',
  'calendar-desktop',
  'calendar-wall',
];

// Products that go directly to their own constructor (skip wizard)
const DIRECT_CONSTRUCTOR_ROUTES: Partial<Record<ProductType, string>> = {
  'guestbook':   '/constructor/guestbook',
  'wishbook':    '/constructor/guestbook',   // same constructor as guestbook
  'photoalbum':  '/constructor/photoalbum',
};

// Products that go directly to a simple order form (no visual constructor)
const DIRECT_ORDER_ROUTES: Partial<Record<ProductType, string>> = {
  'prints':   '/order/prints',
  'magnets':  '/order/magnets',
  'puzzles':  '/order/puzzles',
  'posters':  '/order/posters',
};

// Constructor URLs used by the wizard after mode selection
export const CONSTRUCTOR_ROUTES: Partial<Record<ProductType, string>> = {
  'photobook':          '/constructor/photobook',
  'photobook-standard': '/constructor/photobook',
  'photobook-premium':  '/constructor/photobook',
  'travelbook':         '/constructor/travelbook',
  'magazine':           '/constructor/magazine',
  'photo-journal-soft': '/constructor/magazine',
  'photo-journal-hard': '/constructor/magazine',
  'calendar':           '/constructor/calendar',
  'calendar-desktop':   '/constructor/calendar',
  'calendar-wall':      '/constructor/calendar',
};

/**
 * Call this on every "Створити" / "Замовити" button.
 * Saves config to sessionStorage and returns the URL to navigate to.
 */
export function goToConstructor(config: ConstructorConfig): string {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('constructorConfig', JSON.stringify(config));
  }

  // 1. Direct constructor (no wizard)
  if (DIRECT_CONSTRUCTOR_ROUTES[config.productType]) {
    return DIRECT_CONSTRUCTOR_ROUTES[config.productType]!;
  }

  // 2. Direct order form
  if (DIRECT_ORDER_ROUTES[config.productType]) {
    return DIRECT_ORDER_ROUTES[config.productType]!;
  }

  // 3. Wizard flow
  if (WIZARD_PRODUCTS.includes(config.productType)) {
    return '/constructor/wizard';
  }

  // Fallback
  return '/catalog';
}

/**
 * Call this inside the wizard after the user picks Smart/Manual mode.
 * Returns the URL of the actual constructor.
 */
export function getConstructorUrl(productType: ProductType): string {
  return CONSTRUCTOR_ROUTES[productType] ?? '/constructor/photobook';
}
