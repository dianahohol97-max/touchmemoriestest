import { MetadataRoute } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';

import { LOCALES, getCanonicalUrl, getAlternateLanguages, getSingleLocaleAlternates } from '@/lib/seo/locales';
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
    // The photographer landing is a real acquisition page now (galleries,
    // pricing, FAQ) — it deserves more weight than a static info page.
    { path: '/photographers', priority: 0.8, changeFreq: 'weekly' as const },
    { path: '/blog', priority: 0.8, changeFreq: 'weekly' as const },
    { path: '/faq', priority: 0.5, changeFreq: 'monthly' as const },
    { path: '/privacy', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/cookies', priority: 0.3, changeFreq: 'yearly' as const },
    { path: '/refund', priority: 0.3, changeFreq: 'yearly' as const },
  ];

  // Сторінки, які існують тільки українською, хоч і відкриваються за будь-якою
  // локаллю: текст партнерських лендінгів не перекладається (Діана,
  // 16.09.2026), тож у мапі вони стоять однією адресою з hreflang лише на uk.
  // Перелічити їх пʼятьма локалями означало б самому здати Google пʼять дублів.
  // Стара /travel-agencies сюди не потрапляє навмисно — вона тепер 308 на
  // /partnery, а в sitemap адреса має відповідати кодом 200, без переходу.
  const UK_ONLY_ROUTES = [
    { path: '/partnery', priority: 0.7, changeFreq: 'monthly' as const },
    { path: '/partnerska-programa-dlya-blogeriv', priority: 0.8, changeFreq: 'monthly' as const },
    { path: '/partnerska-programa-dlya-turagentstv', priority: 0.8, changeFreq: 'monthly' as const },
  ];

  for (const route of UK_ONLY_ROUTES) {
    entries.push({
      url: getCanonicalUrl('uk', route.path),
      changeFrequency: route.changeFreq,
      priority: route.priority,
      alternates: { languages: getSingleLocaleAlternates(route.path, 'uk') },
    });
  }

  for (const route of STATIC_ROUTES) {
    for (const locale of LOCALES) {
      const alternates = getAlternateLanguages(route.path);
      entries.push({
        url: getCanonicalUrl(locale, route.path),
        // No lastModified for static routes: stamping new Date() on every
        // generation claims "changed just now" forever, which teaches Google
        // to ignore our lastmod values entirely. Omitting it is valid per the
        // sitemap spec; DB-backed entries below keep their real updated_at.
        changeFrequency: route.changeFreq,
        priority: route.priority,
        alternates: { languages: alternates },
      });
    }
  }

  const { data: products } = await admin
    .from('products')
    .select('slug, updated_at, category_id')
    .eq('is_active', true);

  // Categories that actually have an active product. A category with none
  // permanentRedirects to /catalog (see category/[slug]/page.tsx), so listing
  // it here would put a 301 hop in the sitemap.
  const categoriesWithProducts = new Set(
    (products || []).map((p: any) => p.category_id).filter(Boolean),
  );

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
    .select('id, slug, created_at')
    .eq('is_active', true);

  for (const c of categories || []) {
    if (!categoriesWithProducts.has(c.id)) continue; // skip empty (redirecting) categories
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

  // Статті блогу ЗВІДСИ ПРИБРАНІ (22.09.2026) і живуть у /blog-sitemap.xml.
  // Дві причини. Перша: вони єдині в цій мапі змінюються щодня — нова стаття
  // виходить раз на два-три дні, — і окремий файл дає роботу побачити свіжий
  // lastmod, не перечитуючи всі 785 адрес. Друга: стаття існує не всіма
  // пʼятьма мовами, тож п'ять записів з одним hreflang-набором тут були
  // неправдою, а порахувати справжній набір можна лише прочитавши
  // `translations` — тобто там, де їх і читають.

  // The service landing for photographers. The photographer catalog and the
  // per-photographer landings were removed (Diana, 2026-09-24); their old
  // addresses redirect here from next.config.ts.
  // Client galleries are token-gated and noindex — never listed here.
  {
    const path = '/gallery-for-photographers';
    const alternates = getAlternateLanguages(path);
    for (const locale of LOCALES) {
      entries.push({
        url: getCanonicalUrl(locale, path),
        changeFrequency: 'monthly',
        priority: 0.8,
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
