import { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import ProductClient from './ProductClient';
import { notFound } from 'next/navigation';
import { getLocalized } from '@/lib/i18n/localize';

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

// Force dynamic rendering so product data is always fresh
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug, locale } = await params;
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('name, short_description, meta_title, meta_description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    return {
      title: 'Product not found | Touch.Memories',
    };
  }

  // Use meta_title/meta_description if available, otherwise fallback to name/short_description
  return {
    title: product.meta_title || `${getLocalized(product, locale || 'uk', 'name')} | Touch.Memories`,
    description: product.meta_description || getLocalized(product, locale || 'uk', 'short_description') || 'Touch.Memories',
  };
}

export default async function ProductPage({ params }: Props) {
  // In Next.js 15+, params is a promise
  return <ProductClient params={params} />;
}
