import { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import ProductClient from './ProductClient';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

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

  return {
    title: `${product.name} | Touch.Memories`,
    description: product.short_description || 'Фотокнига від Touch.Memories',
  };
}

export default function ProductPage({ params }: Props) {
  return <ProductClient params={params} />;
}
