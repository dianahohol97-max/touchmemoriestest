import { MetadataRoute } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';
import { LOCALES, getCanonicalUrl, getAlternateLanguages } from '@/lib/seo/locales';
import { toPublicCategorySlug } from '@/lib/seo/categorySlugs';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = getAdminClient();
  const entries: MetadataRoute.Sitemap = [];

  const STATIC_ROUTES = [
    { path: '', priority: 1.0, changeFreq: 'daily' as const },
    { path: '/catalog', priority: 0.9, changeFreq: 'daily' as const },
    // Real page routes are /pro-nas and /kontakty; /about and /contact are
    // 308 redirect aliases (next.config.ts) and must not be listed here —
    // sitemap URLs should always resolve with a 200, not a redirect hop.
    { path: '/pro-nas', priority: 0.6, changeFreq: 'monthly' as const },
    { path: '/kontakty', priority: 0.6, changeFreq: 'monthly' as const },
    { path: '/photographers', priority: 0.5, changeFreq: 'monthly' as const },
    { path: '/blog', priority: 0.8, changeFreq: 'weekly' as const },
    { path: '/privacy', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/cookies', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/refund', priority: 0.3, changeFreq: 'yearly' as const },
  ];

  for (const route of STATIC_ROUTES) {
    for (const locale of LOCALES) {
      const alternates = getAlternateLanguages(route.path);
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
    const alternates = getAlternateLanguages(path);
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
    .select('slug, created_at')
    .eq('is_active', true);

  for (const c of categories || []) {
    const path = `/category/${toPublicCategorySlug(c.slug)}`;
    const alternates = getAlternateLanguages(path);
    for (const locale of LOCALES) {
      entries.push({
        url: getCanonicalUrl(locale, path),
        lastModified: c.created_at ? new Date(c.created_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: { languages: alternates },
      });
    }
  }

  const { data: posts } = await admin
    .from('blog_posts')
    .select('slug, updated_at')
    .eq('is_published', true);

  for (const post of posts || []) {
    const path = `/blog/${post.slug}`;
    const alternates = getAlternateLanguages(path);
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

  // Photographer catalog + public landing pages ("фотограф {місто}" queries)
  // and the service landing for photographers themselves.
  // Client galleries are token-gated and noindex — never listed here.
  {
    const path = '/gallery-for-photographers';
    const alternates = getAlternateLanguages(path);
    for (const locale of LOCALES) {
      entries.push({
        url: getCanonicalUrl(locale, path),
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.8,
        alternates: { languages: alternates },
      });
    }
  }
  {
    const path = '/photographer';
    const alternates = getAlternateLanguages(path);
    for (const locale of LOCALES) {
      entries.push({
        url: getCanonicalUrl(locale, path),
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: { languages: alternates },
      });
    }
  }

  const { data: photographers } = await admin
    .from('photographers')
    .select('slug, updated_at')
    .eq('is_active', true)
    .eq('landing_enabled', true);

  for (const ph of photographers || []) {
    const path = `/photographer/${ph.slug}`;
    const alternates = getAlternateLanguages(path);
    for (const locale of LOCALES) {
      entries.push({
        url: getCanonicalUrl(locale, path),
        lastModified: ph.updated_at ? new Date(ph.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: { languages: alternates },
      });
    }
  }

  const { data: landings } = await admin
    .from('landing_pages')
    .select('category_slug, occasion, updated_at')
    .eq('is_active', true);

  for (const lp of landings || []) {
    const path = `/category/${toPublicCategorySlug(lp.category_slug)}/${lp.occasion}`;
    const alternates = getAlternateLanguages(path);
    for (const locale of LOCALES) {
      entries.push({
        url: getCanonicalUrl(locale, path),
        lastModified: lp.updated_at ? new Date(lp.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
        alternates: { languages: alternates },
      });
    }
  }

  return entries;
}
