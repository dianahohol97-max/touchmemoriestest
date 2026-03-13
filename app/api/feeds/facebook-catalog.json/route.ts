import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com';

export async function GET() {
    const supabase = getAdminClient();
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;

        const catalog = products.map((product) => {
            let availability = 'in stock';
            if (product.track_inventory && product.stock_available <= 0) {
                availability = 'out of stock';
            }

            return {
                id: product.id,
                title: product.name,
                description: product.description || product.name,
                availability: availability,
                condition: 'new',
                price: `${product.price} UAH`,
                link: `${SITE_URL}/product/${product.slug}`,
                image_link: product.images?.[0] || `${SITE_URL}/placeholder.png`,
                brand: 'TouchMemories',
                item_group_id: product.category_id || 'general'
            };
        });

        return NextResponse.json(catalog, {
            status: 200,
            headers: {
                'Cache-Control': 's-maxage=3600, stale-while-revalidate',
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
