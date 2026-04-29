import { getAdminClient } from '@/lib/supabase/admin';
import ProductContent from './ProductContent';

// ISR: product data changes rarely — revalidate every hour
export const revalidate = 3600;

// Public product fields. Internal fields (cost_price, stock_quantity,
// stock_reserved, cost_price_notes, etc.) are intentionally excluded —
// SSR sends this object to the client where it's visible in page source,
// and exposing margins / exact inventory levels is business-data leak.
const PUBLIC_PRODUCT_FIELDS = [
    'id', 'category_id', 'name', 'slug', 'description', 'short_description',
    'price', 'price_from', 'sale_price',
    'min_pages', 'max_pages',
    'cover_options', 'format_options', 'options', 'specs',
    'images', 'og_image', 'video_url',
    'meta_title', 'meta_description',
    'is_personalized', 'is_partially_personalized',
    'has_designer_option', 'designer_service_price', 'max_free_revisions',
    'is_popular', 'popular_order',
    'variants', 'custom_attributes', 'attribute_price_modifiers',
    'tags', 'characteristics', 'sku', 'status',
    'product_type', 'translations', 'features',
    'is_active', 'created_at', 'updated_at',
].join(', ');

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
    const supabase = getAdminClient();
    const { slug } = await params;
    const { data: product } = await supabase
        .from('products')
        .select(`${PUBLIC_PRODUCT_FIELDS}, categories(name)`)
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
        ...(product as any),
        has_designer_option: true,
        designer_service_price: 500
    };

    return <ProductContent product={productWithDesigner} />;
}
