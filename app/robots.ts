import { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/seo/locales';

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/account/',
          '/checkout/',
          '/dyakuiemo',
          '/order/',
          '/review/',
          // Locale-prefixed variants (pages live under /uk, /en, /ro, /pl, /de)
          '/*/account',
          '/*/checkout',
          '/*/order',
          '/*/review',
          '/*/dyakuiemo',
          // Wishlist and order tracking — personal, no SEO value
          '/*/wishlist',
          '/*/track',
          // Catalog/blog with query params — canonical already handles these,
          // but disallowing prevents Google spending crawl budget on duplicates
          '/*/catalog?*',
          '/*/blog?*',
          // Blog tag pages — thin content, no direct SEO value
          '/*/blog/tag/*',
          // Private token pages: client photo galleries and photographer
          // cabinets (both also noindex). Public landings /*/photographer/{slug}
          // stay crawlable.
          '/*/gallery/',
          '/*/photographer/cabinet/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
