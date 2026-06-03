import type { Metadata } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';
import ProductClient from './ProductClient';
import { getLocalized } from '@/lib/i18n/localize';
import { getCanonicalUrl, getAlternateLanguages, getBaseUrl, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const supabase = getAdminClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('name, short_description, meta_title, meta_description, description, image_url, translations, images')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !product) {
    return { title: 'Touch.Memories' };
  }

  const tr = ((product.translations as any) || {})[locale] || {};
  const title = tr.meta_title || tr.name || product.meta_title || getLocalized(product, locale, 'name') || product.name || 'Touch.Memories';
  const rawDesc = tr.meta_description || tr.description || product.meta_description || getLocalized(product, locale, 'short_description') || product.description || '';
  const description = rawDesc.toString().slice(0, 160);
  const ogImage = product.image_url || (product.images && product.images[0]) || `${getBaseUrl()}/og-image.jpg`;
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
      type: 'website',
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
    .select('name, short_description, description, meta_title, meta_description, price, price_from, image_url, images, translations, categories(name, slug)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  const base = getBaseUrl();
  const productUrl = getCanonicalUrl(locale, `/catalog/${slug}`);

  let jsonLdProduct: Record<string, any> | null = null;
  let jsonLdBreadcrumb: Record<string, any> | null = null;

  if (product) {
    const tr = ((product.translations as any) || {})[locale] || {};
    const name = tr.name || getLocalized(product, locale, 'name') || product.name || 'Touch.Memories';
    const desc = (tr.meta_description || tr.description || product.meta_description
      || getLocalized(product, locale, 'short_description') || product.description || '').toString().slice(0, 300);
    const image = product.image_url || (product.images && (product.images as any[])[0]) || `${base}/og-image.jpg`;
    const price = Number(product.price_from || product.price || 0);
    const category = (product.categories as any) || null;

    jsonLdProduct = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description: desc,
      image: Array.isArray(image) ? image : [image],
      brand: { '@type': 'Brand', name: 'Touch.Memories' },
      url: productUrl,
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

    const crumbs: Record<string, any>[] = [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: getCanonicalUrl(locale) },
      { '@type': 'ListItem', position: 2, name: 'Каталог', item: getCanonicalUrl(locale, '/catalog') },
    ];
    if (category?.slug) {
      crumbs.push({
        '@type': 'ListItem',
        position: 3,
        name: category.name || 'Категорія',
        item: getCanonicalUrl(locale, `/catalog?category=${category.slug}`),
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
      <ProductClient params={Promise.resolve({ slug, locale })} />
    </>
  );
}
