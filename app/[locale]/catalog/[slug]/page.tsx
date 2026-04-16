import { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import ProductClient from './ProductClient';
import { notFound } from 'next/navigation';
import { getLocalized } from '@/lib/i18n/localize';

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

// ISR: revalidate every hour. Remove force-dynamic so ISR caching works.
export const revalidate = 60;

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug, locale } = await params;
  // Use admin client — more reliable in SSR/ISR context (bypasses RLS, no cookie dependency)
  const supabase = getAdminClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('name, short_description, meta_title, meta_description, translations, images')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    return {
      title: 'Touch.Memories',
    };
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';
  const title = product.meta_title || `${getLocalized(product, locale || 'uk', 'name')} | Touch.Memories`;
  const description = product.meta_description || getLocalized(product, locale || 'uk', 'short_description') || 'Touch.Memories';
  const ogImage = (product.images && product.images[0]) || `${SITE_URL}/og-image.jpg`;

  // Use meta_title/meta_description if available, otherwise fallback to name/short_description
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/catalog/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}/catalog/${slug}`,
      type: 'website',
      siteName: 'Touch.Memories',
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

export default async function ProductPage({ params }: Props) {
  // In Next.js 15+, params is a promise
  return <ProductClient params={params} />;
}
