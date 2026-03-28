import { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import ProductClient from './ProductClient';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

// Force dynamic rendering so product data is always fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('name, short_description, meta_title, meta_description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    return {
      title: 'Товар не знайдено | Touch.Memories',
    };
  }

  // Use meta_title/meta_description if available, otherwise fallback to name/short_description
  return {
    title: product.meta_title || `${product.name} | Touch.Memories`,
    description: product.meta_description || product.short_description || 'Фотокнига від Touch.Memories',
  };
}

export default async function ProductPage({ params }: Props) {
  // In Next.js 15+, params is a promise
  return <ProductClient params={params} />;
}
