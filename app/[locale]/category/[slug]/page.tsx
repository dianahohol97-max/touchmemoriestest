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
    .order('sort_order', { nullsFirst: false });
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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

        {products.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 16 }}>{t.empty}</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 24,
            }}
          >
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
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: '#fff',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ aspectRatio: '1 / 1', background: '#f1f3fb', overflow: 'hidden' }}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={pName}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e2d7d', lineHeight: 1.35, margin: 0 }}>
                      {pName}
                    </h3>
                    {priceLabel && (
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#263A99' }}>{priceLabel}</div>
                    )}
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
