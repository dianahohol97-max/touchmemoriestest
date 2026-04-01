import { getAdminClient } from '@/lib/supabase/admin';
import ProductContent from './ProductContent';

// Force dynamic rendering (cart requires client-side)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    return <ProductContent product={productWithDesigner} />;
}
