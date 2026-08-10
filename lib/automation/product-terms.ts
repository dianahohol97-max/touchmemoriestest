import { getAdminClient } from '@/lib/supabase/admin';
import { parseProductionDays } from '@/lib/automation/deadline-resolver';

/**
 * Published per-product production terms, in working days, keyed by slug.
 *
 * One query for the whole catalogue (79 rows) rather than per-order lookups:
 * every caller that resolves deadlines in a loop — the calendar, the digest
 * back-fill — needs the same map, and the catalogue is small.
 */
export async function fetchProductTermsBySlug(): Promise<Record<string, number>> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('products')
        .select('slug, production_time')
        .not('slug', 'is', null);

    if (error) {
        console.error('[product-terms] read failed:', error.message);
        return {};
    }

    const map: Record<string, number> = {};
    for (const row of data || []) {
        const days = parseProductionDays(row.production_time);
        if (days) map[String(row.slug)] = days;
    }
    return map;
}
