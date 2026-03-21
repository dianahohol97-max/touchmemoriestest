import { createClient } from '@supabase/supabase-js';
import Content from './ProductContent';

import { getAdminClient } from '@/lib/supabase/admin';

import ProductContent from './ProductContent';

// Revalidate every hour
export const revalidate = 3600;

// Generate static params for all products
export async function generateStaticParams() {
  const supabase = getAdminClient();

  const { data: products } = await supabase
    .from('products')
    .select('slug')
    .eq('is_active', true);

  return (products ?? []).map((product) => ({
    slug: product.slug,
  }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
    const supabase = getAdminClient();
    const { slug } = await params;
    const { data: product } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('slug', slug)
        .single();

    if (!product) {
        return (
            <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
                <h1>Товар не знайдено</h1>
                <a href="/catalog" className="btn-shop">Назад до каталогу</a>
            </div>
        );
    }

    // TEMPORARY: Add designer option until DB is set up
    const productWithDesigner = {
        ...product,
        has_designer_option: true,
        designer_service_price: 500
    };

    return <Content product={productWithDesigner} />;
}
