import { MetadataRoute } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';
import { LOCALES, getCanonicalUrl, HREFLANG_MAP } from '@/lib/seo/locales';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = getAdminClient();
  const entries: MetadataRoute.Sitemap = [];

  const STATIC_ROUTES = [
    { path: '', priority: 1.0, changeFreq: 'daily' as const },
    { path: '/catalog', priority: 0.9, changeFreq: 'daily' as const },
    { path: '/about', priority: 0.6, changeFreq: 'monthly' as const },
    { path: '/contact', priority: 0.6, changeFreq: 'monthly' as const },
    { path: '/blog', priority: 0.8, changeFreq: 'weekly' as const },
    { path: '/privacy', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/cookies', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/refund', priority: 0.3, changeFreq: 'yearly' as const },
  ];

  for (const route of STATIC_ROUTES) {
    for (const locale of LOCALES) {
      const alternates: Record<string, string> = {};
      for (const altLoc of LOCALES) {
        alternates[HREFLANG_MAP[altLoc]] = getCanonicalUrl(altLoc, route.path);
      }
      entries.push({
        url: getCanonicalUrl(locale, route.path),
        lastModified: new Date(),
        changeFrequency: route.changeFreq,
        priority: route.priority,
        alternates: { languages: alternates },
      });
    }
  }

  const { data: products } = await admin
    .from('products')
    .select('slug, updated_at')
    .eq('is_active', true);

  for (const p of products || []) {
    const path = `/catalog/${p.slug}`;
    const alternates: Record<string, string> = {};
    for (const altLoc of LOCALES) {
      alternates[HREFLANG_MAP[altLoc]] = getCanonicalUrl(altLoc, path);
    }
    for (const locale of LOCALES) {
      entries.push({
        url: getCanonicalUrl(locale, path),
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: { languages: alternates },
      });
    }
  }

  const { data: categories } = await admin
    .from('categories')
    .select('slug, updated_at')
    .eq('is_active', true);

  for (const c of categories || []) {
    entries.push({
      url: getCanonicalUrl('uk', `/catalog?category=${c.slug}`),
      lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  const { data: posts } = await admin
    .from('blog_posts')
    .select('slug, updated_at')
    .eq('is_published', true);

  for (const post of posts || []) {
    const path = `/blog/${post.slug}`;
    const alternates: Record<string, string> = {};
    for (const altLoc of LOCALES) {
      alternates[HREFLANG_MAP[altLoc]] = getCanonicalUrl(altLoc, path);
    }
    for (const locale of LOCALES) {
      entries.push({
        url: getCanonicalUrl(locale, path),
        lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
        alternates: { languages: alternates },
      });
    }
  }

  return entries;
}
