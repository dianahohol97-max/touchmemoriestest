import { MetadataRoute } from 'next';

const DOMAIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.ua';

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
          '/*?*', // block query params duplicates
        ],
      },
    ],
    sitemap: `${DOMAIN}/sitemap.xml`,
    host: DOMAIN,
  };
}
