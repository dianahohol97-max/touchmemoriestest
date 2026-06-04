import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  getCanonicalUrl,
  getAlternateLanguages,
  getBaseUrl,
  OG_LOCALE_MAP,
  type Locale,
} from '@/lib/seo/locales';
import { getLocalized } from '@/lib/i18n/localize';
import { toDbCategorySlug, toPublicCategorySlug } from '@/lib/seo/categorySlugs';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

export const revalidate = 300;

const PRODUCT_CARD_FIELDS = 'id, name, slug, price, price_from, short_description, images, translations';

async function getLanding(categorySlug: string, occasion: string) {
  const supabase = getAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('category_slug', categorySlug)
    .eq('occasion', occasion)
    .eq('is_active', true)
    .maybeSingle();
  return data as any;
}

async function getLandingProducts(lp: any) {
  const supabase = getAdminClient();
  if (!supabase) return [];
  if (Array.isArray(lp.product_slugs) && lp.product_slugs.length > 0) {
    const { data } = await supabase
      .from('products')
      .select(PRODUCT_CARD_FIELDS)
      .in('slug', lp.product_slugs)
      .eq('is_active', true);
    const arr = (data as any[]) || [];
    // Preserve the curated order from product_slugs.
    arr.sort((a, b) => lp.product_slugs.indexOf(a.slug) - lp.product_slugs.indexOf(b.slug));
    return arr;
  }
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', lp.category_slug)
    .maybeSingle();
  if (!cat) return [];
  const { data } = await supabase
    .from('products')
    .select(PRODUCT_CARD_FIELDS)
    .eq('category_id', (cat as any).id)
    .eq('is_active', true)
    .order('sort_order', { nullsFirst: false });
  return (data as any[]) || [];
}

const L: Record<string, { home: string; catalog: string; from: string }> = {
  uk: { home: 'Головна', catalog: 'Каталог', from: 'від' },
  en: { home: 'Home', catalog: 'Catalog', from: 'from' },
  ro: { home: 'Acasă', catalog: 'Catalog', from: 'de la' },
  pl: { home: 'Strona główna', catalog: 'Katalog', from: 'od' },
  de: { home: 'Startseite', catalog: 'Katalog', from: 'ab' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; occasion: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug, occasion } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const lp = await getLanding(toDbCategorySlug(slug), occasion);
  if (!lp) return { title: 'Touch.Memories' };

  const title = (lp.meta_title || lp.h1 || 'Touch.Memories').toString();
  const description = (lp.meta_description || lp.intro || '')
    .toString()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  const path = `/category/${toPublicCategorySlug(lp.category_slug)}/${occasion}`;
  const ogImage = lp.hero_image || `${getBaseUrl()}/og-image.jpg`;

  return {
    title: title.includes('Touch.Memories') ? title : `${title} | Touch.Memories`,
    description,
    alternates: {
      canonical: getCanonicalUrl(locale, path),
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title,
      description,
      url: getCanonicalUrl(locale, path),
      siteName: 'Touch.Memories',
      locale: OG_LOCALE_MAP[locale],
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; occasion: string }>;
}) {
  const { locale: rawLocale, slug, occasion } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const t = L[locale] || L.uk;

  const dbCategorySlug = toDbCategorySlug(slug);
  const lp = await getLanding(dbCategorySlug, occasion);
  if (!lp) notFound();

  const products = await getLandingProducts(lp);
  const publicSlug = toPublicCategorySlug(lp.category_slug);

  // Category display name for the breadcrumb.
  const supabase = getAdminClient();
  const { data: cat } = supabase
    ? await supabase.from('categories').select('name, translations').eq('slug', lp.category_slug).maybeSingle()
    : { data: null };
  const catName = cat ? (getLocalized(cat as any, locale, 'name') || (cat as any).name) : '';

  const site = getBaseUrl();
  const pageUrl = getCanonicalUrl(locale, `/category/${publicSlug}/${occasion}`);
  const catUrl = getCanonicalUrl(locale, `/category/${publicSlug}`);
  const introParas = String(lp.intro || '').split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#collection`,
        name: lp.h1,
        url: pageUrl,
        ...(lp.meta_description || lp.intro
          ? { description: String(lp.meta_description || lp.intro).replace(/\s+/g, ' ').slice(0, 300) }
          : {}),
        isPartOf: { '@id': `${site}/#website` },
        ...(lp.hero_image ? { primaryImageOfPage: lp.hero_image } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: getCanonicalUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t.catalog, item: getCanonicalUrl(locale, '/catalog') },
          ...(catName ? [{ '@type': 'ListItem', position: 3, name: catName, item: catUrl }] : []),
          { '@type': 'ListItem', position: catName ? 4 : 3, name: lp.h1, item: pageUrl },
        ],
      },
      ...(products.length
        ? [
            {
              '@type': 'ItemList',
              numberOfItems: products.length,
              itemListElement: products.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: getCanonicalUrl(locale, `/catalog/${p.slug}`),
                name: getLocalized(p, locale, 'name') || p.name,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navigation />

      <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <nav aria-label="breadcrumb" style={{ fontSize: 14, color: '#64748b', marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/${locale}`} style={{ color: '#64748b', textDecoration: 'none' }}>{t.home}</Link>
          <span>/</span>
          <Link href={`/${locale}/catalog`} style={{ color: '#64748b', textDecoration: 'none' }}>{t.catalog}</Link>
          {catName && (
            <>
              <span>/</span>
              <Link href={`/${locale}/category/${publicSlug}`} style={{ color: '#64748b', textDecoration: 'none' }}>{catName}</Link>
            </>
          )}
          <span>/</span>
          <span style={{ color: '#1e2d7d', fontWeight: 600 }}>{lp.h1}</span>
        </nav>

        <header style={{ marginBottom: 32, maxWidth: 800 }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, color: '#1e2d7d', letterSpacing: '-0.02em', marginBottom: 16 }}>
            {lp.h1}
          </h1>
          {introParas.map((p: string, i: number) => (
            <p key={i} style={{ fontSize: 16, lineHeight: 1.75, color: '#475569', marginBottom: 14 }}>{p}</p>
          ))}
        </header>

        {products.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
            {products.map((p) => {
              const pName = getLocalized(p, locale, 'name') || p.name;
              const img = Array.isArray(p.images) ? p.images[0] : undefined;
              const priceLabel =
                p.price != null
                  ? `${p.price_from ? t.from + ' ' : ''}${Number(p.price).toLocaleString('uk-UA')} ₴`
                  : '';
              return (
                <Link
                  key={p.id}
                  href={`/${locale}/catalog/${p.slug}`}
                  style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#fff', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ aspectRatio: '1 / 1', background: '#f1f3fb', overflow: 'hidden' }}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={pName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e2d7d', lineHeight: 1.35, margin: 0 }}>{pName}</h3>
                    {priceLabel && <div style={{ fontSize: 15, fontWeight: 700, color: '#263A99' }}>{priceLabel}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Footer categories={[]} />
    </div>
  );
}
