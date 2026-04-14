import { MetadataRoute } from 'next';

// Use same domain as sitemap — NEXT_PUBLIC_SITE_URL must be set in Vercel env vars
const DOMAIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/cart',
          '/checkout',
          '/order/',
          '/editor/',
          '/constructor/',
          '/photobooth/',
          '/account/',
          '/*?*', // block query params duplicates
        ],
      },
    ],
    sitemap: `${DOMAIN}/sitemap.xml`,
    host: DOMAIN,
  };
}
