import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Stores a snapshot of a customer's cart keyed by email so the abandoned-cart
// cron can remind them later. Called from checkout once a valid email is
// entered. Public endpoint: validates and caps input; no auth (the customer
// isn't logged in yet). Low-risk — it only stores a cart snapshot.
export async function POST(req: Request) {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const email = String(body?.email || '').trim().toLowerCase();
    if (!/.+@.+\..+/.test(email) || email.length > 200) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const rawItems = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
    const items = rawItems.map((it: any) => ({
        name: String(it?.name || '').slice(0, 200),
        qty: Number(it?.qty) || 1,
        price: Number(it?.price) || 0,
        image: typeof it?.image === 'string' ? it.image.slice(0, 500) : undefined,
    }));
    const total = Number(body?.total) || 0;
    const currency = typeof body?.currency === 'string' ? body.currency.slice(0, 8) : 'UAH';

    const admin = getAdminClient();
    try {
        if (items.length === 0) {
            // Cart emptied — drop any stored snapshot for this email.
            await admin.from('abandoned_carts').delete().eq('email', email);
            return NextResponse.json({ ok: true, cleared: true });
        }
        const { error } = await admin.rpc('abandoned_cart_upsert', {
            p_email: email,
            p_items: items,
            p_total: total,
            p_currency: currency,
        });
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Capture failed' }, { status: 500 });
    }
}
