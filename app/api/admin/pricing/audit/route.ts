import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import {
    auditPagePricing,
    describePricingAudit,
    isPricingClean,
    PAGE_PRICED_PRODUCTS,
} from '@/lib/pricing/audit';

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

    const report = auditPagePricing(data || [], tableRows || []);
    return NextResponse.json({
        clean: isPricingClean(report),
        summary: describePricingAudit(report),
        ...report,
    });
}
