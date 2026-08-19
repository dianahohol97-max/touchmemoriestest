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

    const report = auditPagePricing(data || []);
    return NextResponse.json({
        clean: isPricingClean(report),
        summary: describePricingAudit(report),
        ...report,
    });
}
