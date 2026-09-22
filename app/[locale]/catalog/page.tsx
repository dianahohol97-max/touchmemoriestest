import type { Metadata } from 'next';
import CatalogClient from './CatalogClient';
import { CatalogSeoGrid } from './CatalogSeoGrid';
import { getAdminClient } from '@/lib/supabase/admin';
import { getLocalized } from '@/lib/i18n/localize';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

export const revalidate = 60;

const CATALOG_META: Record<string, { title: string; description: string }> = {
  uk: { title: 'Каталог товарів | Touch.Memories', description: 'Фотокниги, журнали, книги побажань та фотодруки на замовлення. 34+ продукти від Touch.Memories у Тернополі.' },
  en: { title: 'Product Catalog | Touch.Memories', description: 'Photo books, journals, guest books and photo prints on demand. 34+ premium products from Touch.Memories.' },
  pl: { title: 'Katalog produktów | Touch.Memories', description: 'Fotoksiążki, albumy, księgi gości i odbitki na zamówienie. Ponad 34 produkty premium w Touch.Memories.' },
  de: { title: 'Produktkatalog | Touch.Memories', description: 'Fotobücher, Zeitschriften, Gästebücher und Fotodrucke auf Bestellung. Über 34 Premium-Produkte bei Touch.Memories.' },
  ro: { title: 'Catalog de produse | Touch.Memories', description: 'Cărți foto, reviste, cărți de urări și tipărituri foto la comandă. Peste 34 de produse premium de la Touch.Memories.' },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const m = CATALOG_META[locale] || CATALOG_META.uk;
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: getCanonicalUrl(locale, '/catalog'),
      languages: getAlternateLanguages('/catalog'),
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: getCanonicalUrl(locale, '/catalog'),
      siteName: 'Touch.Memories',
      locale: OG_LOCALE_MAP[locale],
      type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description, images: ['/og-image.jpg'] },
  };
}

export default async function CatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  // Prefetch server-side so client gets instant first paint
  let initialProducts: any[] = [];
  let initialCategories: any[] = [];
  try {
    const supabase = getAdminClient();
    if (supabase) {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from('categories').select('id, name, slug, cover_image, display_style, translations').eq('is_active', true).order('sort_order'),
        supabase.from('products').select('id, name, slug, price, price_from, short_description, images, is_popular, popular_order, category_id, fulfillment_type, translations, categories(name, slug)').eq('is_active', true).order('created_at'),
      ]);
      initialCategories = cats || [];
      initialProducts = prods || [];
      // Hide categories that have no active products — they'll appear automatically
      // once a product is assigned to them.
      const activeCatIds = new Set((prods || []).map((p: any) => p.category_id).filter(Boolean));
      initialCategories = initialCategories.filter((c: any) => activeCatIds.has(c.id));
    }
  } catch {}

  // ItemList so the catalog itself says what it holds, in the same order the
  // page shows. Only the fields Google reads for a list page — a full Product
  // per row would duplicate what each product page already declares, and two
  // sources for one price is how a mismatch gets reported.
  const jsonLd = initialProducts.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${getCanonicalUrl(locale, '/catalog')}#items`,
        numberOfItems: initialProducts.length,
        itemListElement: initialProducts.map((p: any, i: number) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: getCanonicalUrl(locale, `/catalog/${p.slug}`),
          name: getLocalized(p, locale, 'name') || p.name,
        })),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}
      <CatalogClient
        initialProducts={initialProducts}
        initialCategories={initialCategories}
        seoGrid={<CatalogSeoGrid products={initialProducts} locale={locale} />}
      />
    </>
  );
}
