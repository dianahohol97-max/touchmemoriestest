import { getAdminClient } from '@/lib/supabase/admin';
import { PopularProductsClient } from './PopularProductsClient';

export async function PopularProductsServer() {
    const supabase = getAdminClient();

    // Fetch popular products
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug, price, sale_price, price_from, images')
        .eq('is_popular', true)
        .eq('is_active', true)
        .order('popular_order', { ascending: true, nullsFirst: false })
        .limit(8);

    if (productsError) {
        console.error('[PopularProductsServer] Error fetching products:', productsError);
    }

    console.log('[PopularProductsServer] products found:', products?.length || 0);

    // Fetch section content for heading and CTA
    const { data: sectionData, error: sectionError } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'popular_products')
        .eq('is_active', true)
        .single();

    if (sectionError) {
        console.error('[PopularProductsServer] Error fetching section_content:', sectionError);
    }

    return (
        <PopularProductsClient
            products={products || []}
            sectionContent={sectionData || undefined}
        />
    );
}
