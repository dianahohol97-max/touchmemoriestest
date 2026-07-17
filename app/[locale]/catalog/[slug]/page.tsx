import type { Metadata } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';
import ProductClient from './ProductClient';
import { getLocalized } from '@/lib/i18n/localize';
import { getCanonicalUrl, getAlternateLanguages, getBaseUrl, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';
import { toPublicCategorySlug } from '@/lib/seo/categorySlugs';

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export const revalidate = 60;

// Public, non-sensitive product columns. Passed to the client as initialProduct
// for SSR, so cost_price / stock / margin columns are intentionally excluded —
// the object is serialized into the page HTML.
const PRODUCT_PUBLIC_FIELDS =
  'id, category_id, name, slug, description, short_description, price, min_pages, max_pages, ' +
  'cover_options, format_options, images, is_active, meta_title, meta_description, created_at, ' +
  'is_personalized, has_designer_option, designer_service_price, max_free_revisions, is_popular, ' +
  'popular_order, options, specs, price_from, sale_price, og_image, video_url, variants, ' +
  'custom_attributes, attribute_price_modifiers, tags, characteristics, sku, status, updated_at, ' +
  'is_partially_personalized, product_type, translations, features, payment_mode, production_time, shipping_info, payment_info, fulfillment_type, ' +
  // Availability (not sensitive): whether we track stock and how many are free
  // to sell right now. stock_available is generated = stock_quantity - reserved.
  'track_inventory, stock_available';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const supabase = getAdminClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('name, short_description, meta_title, meta_description, description, og_image, translations, images')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !product) {
    return { title: 'Touch.Memories' };
  }

  const tr = ((product.translations as any) || {})[locale] || {};
  const isUk = locale === 'uk';
  const title = tr.meta_title || (isUk ? product.meta_title : '') || getLocalized(product, locale, 'name') || product.name || 'Touch.Memories';
  const rawDesc = tr.meta_description || (isUk ? product.meta_description : '') || getLocalized(product, locale, 'short_description') || product.short_description || product.description || '';
  const description = rawDesc.toString().slice(0, 160);
  const ogImage = product.og_image || (product.images && product.images[0]) || `${getBaseUrl()}/og-image.jpg`;
  const path = `/catalog/${slug}`;

  return {
    title: `${title} | Touch.Memories`,
    description,
    alternates: {
      canonical: getCanonicalUrl(locale, path),
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title,
      description: description.slice(0, 200),
      url: getCanonicalUrl(locale, path),
      siteName: 'Touch.Memories',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      locale: OG_LOCALE_MAP[locale],
      // og:type is intentionally omitted here: Next only supports a fixed set
      // of OpenGraph types and throws "Invalid OpenGraph type" (E237) for
      // 'product'. We emit og:type=product as a raw <meta> in the body instead
      // (see productMeta below) so the Meta Shop crawler reads it as a product.
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description.slice(0, 200),
      images: [ogImage],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  // In Next.js 15+, params is a promise
  const { slug, locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;

  // Server-side structured data (Product + BreadcrumbList) so Google sees the
  // product even though the interactive body is client-rendered.
  const supabase = getAdminClient();
  const { data: product } = await supabase
    .from('products')
    .select(`${PRODUCT_PUBLIC_FIELDS}, categories(name, slug, translations)`)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  const base = getBaseUrl();
  const productUrl = getCanonicalUrl(locale, `/catalog/${slug}`);

  // Genuine per-product reviews only (linked via reviews.product_id).
  // Drives both the on-page reviews section and the AggregateRating/Review
  // schema, so structured data always matches visible content.
  let aggregateRating: Record<string, any> | null = null;
  let productReviews: any[] = [];
  let reviewLd: any[] = [];
  if (product) {
    const { data: revs } = await supabase
      .from('reviews')
      .select('id, image_url, video_url, media_type, author, caption, rating, created_at')
      .eq('product_id', (product as any).id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    productReviews = revs || [];
    const rated = productReviews.filter((r: any) => Number(r.rating) > 0);
    if (rated.length > 0) {
      const sum = rated.reduce((a: number, r: any) => a + Number(r.rating || 0), 0);
      aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: (sum / rated.length).toFixed(1),
        reviewCount: rated.length,
        bestRating: 5,
        worstRating: 1,
      };
      reviewLd = rated.slice(0, 20).map((r: any) => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: Number(r.rating), bestRating: 5, worstRating: 1 },
        author: { '@type': 'Person', name: r.author || 'Клієнт' },
        ...(r.caption ? { reviewBody: r.caption } : {}),
        ...(r.created_at ? { datePublished: new Date(r.created_at).toISOString().slice(0, 10) } : {}),
      }));
    }
  }

  let jsonLdProduct: Record<string, any> | null = null;
  let jsonLdBreadcrumb: Record<string, any> | null = null;
  // Open Graph product microdata for the Meta Pixel / Shop catalog crawler,
  // emitted as raw <meta property> tags in the body (React hoists them into
  // <head>). retailer_item_id MUST equal the id used in the Facebook catalog
  // feed (app/api/feeds/facebook-catalog.json → id: product.id) so pixel views
  // match catalog items. og:type is set here (not via the Metadata API, which
  // rejects the 'product' type).
  let productMeta: Record<string, string> | null = null;

  if (product) {
    const tr = ((product.translations as any) || {})[locale] || {};
    const isUk = locale === 'uk';
    const name = tr.name || getLocalized(product, locale, 'name') || product.name || 'Touch.Memories';
    const desc = (tr.meta_description || (isUk ? product.meta_description : '')
      || getLocalized(product, locale, 'short_description') || product.short_description || product.description || '').toString().slice(0, 300);
    const image = product.og_image || (product.images && (product.images as any[])[0]) || `${base}/og-image.jpg`;
    const price = Number(product.price || 0);
    const category = (product.categories as any) || null;

    jsonLdProduct = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description: desc,
      image: Array.isArray(image) ? image : [image],
      brand: { '@type': 'Brand', name: 'Touch.Memories' },
      url: productUrl,
      ...(aggregateRating ? { aggregateRating } : {}),
      ...(reviewLd.length ? { review: reviewLd } : {}),
      ...(price > 0
        ? {
            offers: {
              '@type': 'Offer',
              url: productUrl,
              priceCurrency: 'UAH',
              price: price.toFixed(2),
              availability: 'https://schema.org/InStock',
              itemCondition: 'https://schema.org/NewCondition',
              seller: { '@type': 'Organization', name: 'Touch.Memories' },
            },
          }
        : {}),
    };

    productMeta = {
      'og:type': 'product',
      'product:price:amount': price > 0 ? price.toFixed(2) : '',
      'product:price:currency': 'UAH',
      'product:retailer_item_id': String((product as any).id ?? ''),
      'product:availability': 'in stock',
      'product:condition': 'new',
      'product:brand': 'Touch.Memories',
    };

    const crumbs: Record<string, any>[] = [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: getCanonicalUrl(locale) },
      { '@type': 'ListItem', position: 2, name: 'Каталог', item: getCanonicalUrl(locale, '/catalog') },
    ];
    if (category?.slug) {
      crumbs.push({
        '@type': 'ListItem',
        position: 3,
        name: category.name || 'Категорія',
        item: getCanonicalUrl(locale, `/category/${toPublicCategorySlug(category.slug)}`),
      });
    }
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name });

    jsonLdBreadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs,
    };
  }

  return (
    <>
      {jsonLdProduct && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProduct) }} />
      )}
      {jsonLdBreadcrumb && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      )}
      {productMeta &&
        Object.entries(productMeta).map(([property, content]) =>
          content ? <meta key={property} property={property} content={content} /> : null
        )}
      <ProductClient params={Promise.resolve({ slug, locale })} initialProduct={product || undefined} initialReviews={productReviews} />
    </>
  );
}
