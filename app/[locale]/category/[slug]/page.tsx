import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/ui/ProductCard';
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
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { toDbCategorySlug, toPublicCategorySlug, DB_TO_UA_CATEGORY } from '@/lib/seo/categorySlugs';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { permanentRedirect } from 'next/navigation';

// Category data changes rarely — ISR keeps it fast and crawlable.
export const revalidate = 300;

const CAT_FIELDS = 'id, name, slug, description, cover_image, translations, is_active';

async function getCategory(slug: string) {
  const supabase = getAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('categories')
    .select(CAT_FIELDS)
    .eq('slug', slug)
    .maybeSingle();
  return data as any;
}

async function getProducts(categoryId: string) {
  const supabase = getAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('products')
    .select('id, name, slug, price, price_from, short_description, images, translations')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    // products has no sort_order column — ordering by it made PostgREST return
    // an error, so `data` came back null and EVERY category page rendered empty
    // ("Товари з'являться незабаром") despite having active products. Order by
    // a column that exists.
    .order('created_at', { ascending: true });
  return (data as any[]) || [];
}

async function getSubcategories(categorySlug: string) {
  const supabase = getAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('landing_pages')
    .select('occasion, h1')
    .eq('category_slug', categorySlug)
    .eq('kind', 'subcategory')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  return (data as any[]) || [];
}

const L: Record<string, { home: string; catalog: string; from: string; empty: string; in_cat: string }> = {
  uk: { home: 'Головна', catalog: 'Каталог', from: 'від', empty: 'Товари в цій категорії з’являться незабаром.', in_cat: 'товарів у категорії' },
  en: { home: 'Home', catalog: 'Catalog', from: 'from', empty: 'Products in this category are coming soon.', in_cat: 'products in category' },
  ro: { home: 'Acasă', catalog: 'Catalog', from: 'de la', empty: 'Produsele din această categorie vor apărea în curând.', in_cat: 'produse în categorie' },
  pl: { home: 'Strona główna', catalog: 'Katalog', from: 'od', empty: 'Produkty w tej kategorii pojawią się wkrótce.', in_cat: 'produktów w kategorii' },
  de: { home: 'Startseite', catalog: 'Katalog', from: 'ab', empty: 'Produkte in dieser Kategorie folgen in Kürze.', in_cat: 'Produkte in der Kategorie' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const cat = await getCategory(toDbCategorySlug(slug));
  if (!cat) return { title: 'Категорія | Touch.Memories' };

  const name = getLocalized(cat, locale, 'name') || cat.name;
  const rawDesc = (getLocalized(cat, locale, 'description') || cat.description || '')
    .replace(/\s+/g, ' ')
    .trim();
  const description = rawDesc ? rawDesc.slice(0, 160) : `${name} — Touch.Memories, Тернопіль.`;
  const title = `${name} | Touch.Memories`;
  const path = `/category/${toPublicCategorySlug(cat.slug)}`;

  return {
    title,
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
      ...(cat.cover_image ? { images: [{ url: cat.cover_image }] } : {}),
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const t = L[locale] || L.uk;

  // Old DB-slug URL (e.g. /category/photobooks) → 301 to the UA slug.
  if (DB_TO_UA_CATEGORY[slug] && DB_TO_UA_CATEGORY[slug] !== slug) {
    permanentRedirect(`/${locale}/category/${DB_TO_UA_CATEGORY[slug]}`);
  }

  const cat = await getCategory(toDbCategorySlug(slug));
  if (!cat || cat.is_active === false) notFound();

  const products = await getProducts(cat.id);
  const subcategories = await getSubcategories(cat.slug);

  // If the category has no active products, redirect to catalog instead of
  // showing an empty "coming soon" page. The category becomes visible again
  // automatically once products are added.
  if (products.length === 0) {
    permanentRedirect(`/${locale}/catalog`);
  }

  const name = getLocalized(cat, locale, 'name') || cat.name;
  const description = (getLocalized(cat, locale, 'description') || cat.description || '').trim();

  const site = getBaseUrl();
  const catUrl = getCanonicalUrl(locale, `/category/${toPublicCategorySlug(cat.slug)}`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${catUrl}#collection`,
        name,
        url: catUrl,
        ...(description ? { description: description.replace(/\s+/g, ' ').slice(0, 300) } : {}),
        isPartOf: { '@id': `${site}/#website` },
        ...(cat.cover_image ? { primaryImageOfPage: cat.cover_image } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: getCanonicalUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: t.catalog, item: getCanonicalUrl(locale, '/catalog') },
          { '@type': 'ListItem', position: 3, name, item: catUrl },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Navigation />

      <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" style={{ fontSize: 14, color: '#64748b', marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/${locale}`} style={{ color: '#64748b', textDecoration: 'none' }}>{t.home}</Link>
          <span>/</span>
          <Link href={`/${locale}/catalog`} style={{ color: '#64748b', textDecoration: 'none' }}>{t.catalog}</Link>
          <span>/</span>
          <span style={{ color: '#1e2d7d', fontWeight: 600 }}>{name}</span>
        </nav>

        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, color: '#1e2d7d', letterSpacing: '-0.02em', marginBottom: 12 }}>
            {name}
          </h1>
          {description && (
            <p style={{ fontSize: 16, lineHeight: 1.7, color: '#475569', maxWidth: 760 }}>
              {description}
            </p>
          )}
        </header>

        {subcategories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
            {subcategories.map((s) => (
              <Link
                key={s.occasion}
                href={`/${locale}/category/${toPublicCategorySlug(cat.slug)}/${s.occasion}`}
                style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid #c7d2fe', background: '#f0f3ff', color: '#1e2d7d', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
              >
                {s.h1}
              </Link>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 16 }}>{t.empty}</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24,
          }} className="category-product-grid">
            {products.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                {p.is_popular && (
                  <div style={{ position:'absolute', top:16, left:16, zIndex:20, display:'flex', alignItems:'center', gap:4, background:'rgba(30,45,125,0.1)', color:'#1e2d7d', padding:'4px 12px', borderRadius:6, fontSize:12, fontWeight:700 }}>
                    Популярне
                  </div>
                )}
                <ProductCard
                  product={p}
                  primaryAction={p.fulfillment_type === 'in_stock' ? 'cart' : 'details'}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer categories={[]} />
    </div>
  );
}
