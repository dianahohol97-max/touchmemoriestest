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
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
