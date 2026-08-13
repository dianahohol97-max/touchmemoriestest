import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/products/[id]
 *
 * Saves a product from the admin catalogue panel with the service-role key.
 *
 * Why this exists (Diana, 2026-08-13: «я ставлю його неактивним, зберігаю, а
 * потім воно знову мені світиться активним»): the panel used to write straight
 * from the browser with the anon key. The products table has RLS — writes need
 * `is_admin()`, which reads the Supabase JWT. When that session is missing or
 * expired (the admin panel keeps working, because reading products is public),
 * PostgREST does not fail the request: the UPDATE simply matches zero rows and
 * returns success. The panel then showed «Збережено», кеш оновлювався, а в базі
 * не змінювалось нічого — товар знову з'являвся активним після перезавантаження.
 *
 * The same trap was already patched for the images array in
 * `[id]/images/route.ts`; this route closes it for the product card as a whole.
 *
 * Two guarantees the browser write could not give:
 *   1. The caller is verified server-side (`requireStaff`), so authorisation no
 *      longer depends on a JWT that may have quietly expired.
 *   2. The response carries the row that was actually written — an update that
 *      touches nothing returns 404, so the panel can report a real failure
 *      instead of a false «Збережено».
 */

/**
 * Only the fields the catalogue panel owns. A whitelist rather than a spread of
 * the body: the panel posts the whole product object it holds in state, and we
 * must not let stray keys (id, created_at, or anything a future field adds)
 * reach the table.
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

function pickEditable(body: any): Record<string, any> {
    const patch: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
        if (body && Object.prototype.hasOwnProperty.call(body, field)) {
            patch[field] = body[field];
        }
    }
    return patch;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Не вказано товар' }, { status: 400 });

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Очікується JSON' }, { status: 400 });
    }

    const patch = pickEditable(body);
    if (!Object.keys(patch).length) {
        return NextResponse.json({ error: 'Немає полів для збереження' }, { status: 400 });
    }

    // `status` and `is_active` are two names for one decision, and the storefront
    // reads both depending on the surface. Keeping them in step here means a
    // product hidden from the panel is hidden everywhere, without the panel
    // having to know about the legacy column.
    if (Object.prototype.hasOwnProperty.call(patch, 'is_active')) {
        patch.is_active = patch.is_active !== false;
        patch.status = patch.is_active ? 'active' : 'draft';
    }

    const admin = getAdminClient();
    const { data, error } = await admin
        .from('products')
        .update(patch)
        .eq('id', id)
        .select('id, slug, is_active, status')
        .maybeSingle();

    if (error) {
        console.error('Product save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
        return NextResponse.json({ error: 'Товар не знайдено' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, product: data });
}
