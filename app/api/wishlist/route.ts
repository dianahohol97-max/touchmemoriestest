import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const supabase = getAdminClient();
    const url = new URL(req.url);
    const session_id = url.searchParams.get('session_id');
    const user_id = url.searchParams.get('user_id');

    let q = supabase.from('wishlists').select('*').order('created_at', { ascending: false });
    if (user_id) q = q.eq('user_id', user_id);
    else if (session_id) q = q.eq('session_id', session_id);

    const { data } = await q;
    return NextResponse.json(data || []);
}

export async function POST(req: Request) {
    const supabase = getAdminClient();
    const body = await req.json();
    const { product_id, product_slug, product_name, product_image, product_price, user_id, session_id } = body;

    // Toggle: if exists — delete, if not — insert
    let existing;
    if (user_id) {
        const { data } = await supabase.from('wishlists').select('id').eq('user_id', user_id).eq('product_id', product_id).single();
        existing = data;
    } else if (session_id) {
        const { data } = await supabase.from('wishlists').select('id').eq('session_id', session_id).eq('product_id', product_id).maybeSingle();
        existing = data;
    }

    if (existing) {
        await supabase.from('wishlists').delete().eq('id', existing.id);
        return NextResponse.json({ action: 'removed' });
    } else {
        await supabase.from('wishlists').insert([{ product_id, product_slug, product_name, product_image, product_price, user_id, session_id }]);
        return NextResponse.json({ action: 'added' });
    }
}
