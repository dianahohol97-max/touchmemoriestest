import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import {
    auditPagePricing,
    describePricingAudit,
    isPricingClean,
    PAGE_PRICED_PRODUCTS,
} from '@/lib/pricing/audit';
import { auditRotatedSizes, describeRotatedSizes } from '@/lib/pricing/rotated-sizes';

export const dynamic = 'force-dynamic';

/**
 * Price drift check for the page-priced products (журнали + Travel Book).
 *
 * Open it after ANY price change — in the admin panel, in a migration, or in
 * lib/products — and before telling a customer a number. It recomputes both
 * halves of the pricing (the scale in lib/products versus products.price plus
 * the option surcharges in the DB) for every page count and prints every
 * hryvnia of disagreement.
 *
 * `clean: true` means the site charges exactly the price list, everywhere.
 * Anything else is a live overcharge or undercharge and names the fix.
 */
export async function GET() {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('products')
        .select('slug, name, price, options')
        .in('slug', PAGE_PRICED_PRODUCTS.map(p => p.slug));

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Третя копія — page_product_prices. Тут, на ручному роуті, помилка її
    // читання ПОКАЗУЄТЬСЯ (на відміну від best-effort у ops-digest): людина
    // відкрила перевірку — людина має побачити, що таблицю прочитати не вдалось.
    const { data: tableRows, error: tableError } = await supabase
        .from('page_product_prices')
        .select('product_slug, page_count, price');
    if (tableError) {
        return NextResponse.json({ error: `page_product_prices: ${tableError.message}` }, { status: 500 });
    }

    // Фотокниги живуть в іншій таблиці й під цей аудит не потрапляли зовсім.
    // Повного звіряння з прайсом тут поки немає, але одна річ перевіряється
    // дешево й ловить саме те, що вже сталося: 20×30 і 30×20 — це один виріб
    // боком, і ціни в них мусять збігатися. Помилка в кроці шкали лишила
    // 30×20 дешевшим на 5–95 ₴ у дев'ятнадцяти тарифах із двадцяти одного.
    const { data: bookRows, error: bookError } = await supabase
        .from('photobook_prices')
        .select('page_count, base_price, size:photobook_sizes(name), cover_type:cover_types(name)');
    if (bookError) {
        return NextResponse.json({ error: `photobook_prices: ${bookError.message}` }, { status: 500 });
    }
    const rotatedSizes = auditRotatedSizes(
        (bookRows || []).map((r: any) => ({
            size: r.size?.name ?? '',
            cover: r.cover_type?.name ?? '',
            page_count: r.page_count,
            base_price: r.base_price,
        })),
    );

    const report = auditPagePricing(data || [], tableRows || []);
    return NextResponse.json({
        clean: isPricingClean(report) && rotatedSizes.length === 0,
        summary: [...describePricingAudit(report), ...describeRotatedSizes(rotatedSizes)],
        ...report,
        rotatedSizes,
    });
}
