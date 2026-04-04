import { getAdminClient } from '@/lib/supabase/admin';
import { PopularProductsClient } from './PopularProductsClient';

export async function PopularProductsServer({ locale = "uk" }: { locale?: string } = {}) {
    let products: any[] = [];
    let sectionData: any = undefined;

    try {
        const supabase = getAdminClient();
        if (!supabase) {
            console.error('[PopularProductsServer] Supabase client is null');
            if (sectionData && locale !== 'uk') {
        const trans = (sectionData as any).translations?.[locale];
        if (trans) {
            if (trans.heading) (sectionData as any).heading = trans.heading;
            if (trans.subheading) (sectionData as any).subheading = trans.subheading;
            if (trans.body) (sectionData as any).body_text = trans.body;
            if (trans.cta_text) (sectionData as any).cta_text = trans.cta_text;
        }
    }
    return <PopularProductsClient products={[]} />;
        }

        // Fetch popular products
        const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('id, name, slug, price, sale_price, price_from, images')
            .eq('is_popular', true)
            .eq('is_active', true)
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
            .maybeSingle();

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
