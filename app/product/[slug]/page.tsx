import { createClient } from '@supabase/supabase-js';
import Content from './ProductContent';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import ProductContent from './ProductContent';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
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
