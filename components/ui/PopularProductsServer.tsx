import { getAdminClient } from '@/lib/supabase/admin';
import { PopularProductsClient } from './PopularProductsClient';

export async function PopularProductsServer() {
    const supabase = getAdminClient();

    // Fetch popular products
    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug, price, sale_price, price_from, images')
        .eq('is_popular', true)
        .eq('is_active', true)
        .eq('status', 'active')
        .order('popular_order', { ascending: true, nullsFirst: false })
        .limit(4);

    // Fetch section content for heading and CTA
    const { data: sectionData } = await supabase
        .from('section_content')
        .select('*')
        .eq('section_name', 'popular_products')
        .eq('is_active', true)
        .single();

    return (
        <PopularProductsClient
            products={products || []}
            sectionContent={sectionData || undefined}
        />
    );
}
