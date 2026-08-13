import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/products — create a product from the admin catalogue panel.
 *
 * The companion of PATCH /api/admin/products/[id]: creating a product from the
 * browser hit the same RLS wall as editing one, except an INSERT blocked by RLS
 * does surface an error, so it failed loudly rather than silently. It moves here
 * anyway so both halves of the panel save the same way and through the same
 * field whitelist.
 */
const EDITABLE_FIELDS = [
    'name', 'slug', 'category_id',
    'price', 'sale_price', 'price_from', 'cost_price', 'designer_service_price',
    'short_description', 'description', 'production_time', 'fulfillment_type',
    'images', 'video_url', 'og_image',
    'options', 'is_active', 'is_personalized', 'has_designer_option',
    'stock_quantity', 'track_inventory',
    'tags', 'meta_title', 'meta_description',
    'is_popular', 'product_type',
] as const;

export async function POST(req: Request) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Очікується JSON' }, { status: 400 });
    }

    const row: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
        if (body && Object.prototype.hasOwnProperty.call(body, field)) {
            row[field] = body[field];
        }
    }

    if (!String(row.name || '').trim() || !String(row.slug || '').trim()) {
        return NextResponse.json({ error: 'Потрібні назва та slug' }, { status: 400 });
    }

    row.is_active = row.is_active !== false;
    row.status = row.is_active ? 'active' : 'draft';

    const admin = getAdminClient();
    const { data, error } = await admin
        .from('products')
        .insert(row)
        .select('id, slug, is_active, status')
        .single();

    if (error) {
        console.error('Product create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, product: data });
}
