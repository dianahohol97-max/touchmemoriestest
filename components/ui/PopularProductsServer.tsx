import { getAdminClient } from '@/lib/supabase/admin';
import { PopularProductsClient } from './PopularProductsClient';

export async function PopularProductsServer() {
    let products: any[] = [];
    let sectionData: any = undefined;

    try {
        const supabase = getAdminClient();
        if (!supabase) {
            console.error('[PopularProductsServer] Supabase client is null');
            return <PopularProductsClient products={[]} />;
        }

        // Fetch popular products
        const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('id, name, slug, price, sale_price, price_from, images')
            .eq('is_popular', true)
            .eq('is_active', true)
            .eq('status', 'active')
            .order('popular_order', { ascending: true, nullsFirst: false })
            .limit(8);

        if (productsError) {
            console.error('[PopularProductsServer] Error fetching products:', JSON.stringify(productsError));
        }
        products = productsData || [];
        console.log('[PopularProductsServer] products found:', products.length);

        // Fetch section content for heading and CTA
        const { data: sectionResult, error: sectionError } = await supabase
            .from('section_content')
            .select('*')
            .eq('section_name', 'popular_products')
            .eq('is_active', true)
            .single();

        if (sectionError && sectionError.code !== 'PGRST116') {
            console.error('[PopularProductsServer] Error fetching section_content:', JSON.stringify(sectionError));
        }
        sectionData = sectionResult || undefined;
    } catch (err) {
        console.error('[PopularProductsServer] CAUGHT ERROR:', err);
    }

    return (
        <PopularProductsClient
            products={products}
            sectionContent={sectionData}
        />
    );
}
