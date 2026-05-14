import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Pricing data is small (~466 rows) and changes rarely (admin migrations only).
// We cache the response for 60 seconds. After a price migration, prod prices
// update within 60s without redeploy. This is the single source of truth —
// the old hardcoded table in lib/editor/pricing.ts has been removed.
export const revalidate = 60;

interface PriceRow {
    cover_type: string;       // canonical Ukrainian name from cover_types.name
    size: string;             // e.g. "20×20", "20×30"
    page_count: number;
    base_price: number;
    kalka_surcharge: number;
}

export interface PhotobookPricingResponse {
    rows: PriceRow[];
    fetched_at: string;       // ISO timestamp, used by client cache layer
}

export async function GET() {
    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from('photobook_prices')
        .select(`
            page_count,
            base_price,
            kalka_surcharge,
            cover_types ( name ),
            photobook_sizes ( name )
        `);

    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 },
        );
    }

    const rows: PriceRow[] = (data || []).map((r: any) => ({
        cover_type: r.cover_types?.name ?? '',
        size: r.photobook_sizes?.name ?? '',
        page_count: r.page_count,
        base_price: Number(r.base_price),
        kalka_surcharge: Number(r.kalka_surcharge ?? 0),
    })).filter(r => r.cover_type && r.size);

    const payload: PhotobookPricingResponse = {
        rows,
        fetched_at: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
        headers: {
            // Browser cache: 30s (shorter than server cache so a forced reload
            // can pick up changes between server revalidation windows).
            'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
    });
}
