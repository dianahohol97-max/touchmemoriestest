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
  return <ProductClient params={params} />;
}
