import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Ціни посторінкових товарів (журнали + Travel Book) з page_product_prices.
// Той самий контракт, що й /api/pricing/photobook: даних мало (87 рядків),
// міняються рідко, кеш 60 секунд — після правки ціни в базі прод підхоплює
// її без деплою в межах хвилини.
//
// Поки що цей роут читає лише аудит і майбутні споживачі; сторінки товарів
// ще рахують за старою схемою. Перемикання читання — окремий крок після
// кількох днів чистого аудиту (див. ARCHITECTURE.md, «Page-priced products»).
export const revalidate = 60;

export interface PageProductPriceRow {
    product_slug: string;
    page_count: number;
    price: number;
}

export interface PageProductPricingResponse {
    rows: PageProductPriceRow[];
    fetched_at: string;
}

export async function GET() {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('page_product_prices')
        .select('product_slug, page_count, price')
        .order('product_slug')
        .order('page_count');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: PageProductPriceRow[] = (data || []).map((r: any) => ({
        product_slug: String(r.product_slug),
        page_count: Number(r.page_count),
        price: Number(r.price),
    }));

    const payload: PageProductPricingResponse = {
        rows,
        fetched_at: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
        headers: {
            'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
    });
}
