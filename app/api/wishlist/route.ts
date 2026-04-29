import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Wishlist API.
 *
 * SECURITY MODEL:
 * - For authenticated users, customer_id is taken from the session — NOT from
 *   query string. Otherwise anyone could read/write any other customer's
 *   wishlist by passing their customer_id (IDOR).
 * - For anonymous users, the session_id is the capability — knowing it grants
 *   access. Sessions live in client-only state and are relatively
 *   short-lived; they're not strong auth, but they're enough for "save items
 *   before login" without exposing other users' data.
 *
 * The previous implementation accepted user_id from the query string and
 * looked it up directly via the service-role client, exposing every
 * authenticated user's wishlist to anyone — and on top of that, it used
 * column names (user_id, created_at, product_name, ...) that don't exist in
 * the actual `wishlists` schema, so it was silently broken end-to-end.
 *
 * Real schema: id, customer_id, session_id, product_id, added_at.
 * Product name/image/price are joined from `products`.
 */

async function resolveOwner(req: Request): Promise<{ customer_id?: string; session_id?: string } | null> {
    const url = new URL(req.url);
    const session_id = url.searchParams.get('session_id') || undefined;

    // Try to resolve from auth session first.
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const admin = getAdminClient();
        const { data: customer } = await admin
            .from('customers')
            .select('id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
        if (customer) {
            return { customer_id: (customer as any).id };
        }
        // Fall through to session_id if user has no customer record yet.
    }

    if (session_id) return { session_id };
    return null;
}

export async function GET(req: Request) {
    const owner = await resolveOwner(req);
    if (!owner) {
        return NextResponse.json([]);
    }

    const supabase = getAdminClient();
    let q = supabase
        .from('wishlists')
        .select('id, product_id, added_at, products(id, name, slug, price, images)')
        .order('added_at', { ascending: false });
    if (owner.customer_id) q = q.eq('customer_id', owner.customer_id);
    else if (owner.session_id) q = q.eq('session_id', owner.session_id);

    const { data } = await q;
    return NextResponse.json(data || []);
}

export async function POST(req: Request) {
    const owner = await resolveOwner(req);
    if (!owner) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const product_id = body?.product_id;
    if (!product_id || typeof product_id !== 'string') {
        return NextResponse.json({ error: 'product_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Toggle: if exists — delete, if not — insert.
    let existing: { id: string } | null = null;
    if (owner.customer_id) {
        const { data } = await supabase
            .from('wishlists')
            .select('id')
            .eq('customer_id', owner.customer_id)
            .eq('product_id', product_id)
            .maybeSingle();
        existing = data as any;
    } else if (owner.session_id) {
        const { data } = await supabase
            .from('wishlists')
            .select('id')
            .eq('session_id', owner.session_id)
            .eq('product_id', product_id)
            .maybeSingle();
        existing = data as any;
    }

    if (existing) {
        await supabase.from('wishlists').delete().eq('id', existing.id);
        return NextResponse.json({ action: 'removed' });
    }

    await supabase.from('wishlists').insert([{
        product_id,
        customer_id: owner.customer_id ?? null,
        session_id: owner.session_id ?? null,
    }]);
    return NextResponse.json({ action: 'added' });
}
