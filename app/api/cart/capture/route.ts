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
        product_id: it?.product_id || it?.id || undefined,
        name: String(it?.name || it?.title || '').slice(0, 200),
        qty: Number(it?.qty ?? it?.quantity) || 1,
        price: Number(it?.price ?? it?.unitPrice) || 0,
        image: typeof (it?.image || it?.imageUrl) === 'string' ? String(it.image || it.imageUrl).slice(0, 500) : undefined,
    }));

    const admin = getAdminClient();

    // Backfill any item missing name/price/image from the products table so the
    // abandoned-cart email always shows a real product (never "Товар · 0 ₴").
    const needsBackfill = items.some((it: any) => (!it.name || !it.price || !it.image) && it.product_id);
    if (needsBackfill) {
        const ids = Array.from(new Set(items.map((it: any) => it.product_id).filter(Boolean)));
        const { data: prods } = await admin
            .from('products')
            .select('id, name, price, images')
            .in('id', ids);
        const byId = new Map((prods || []).map((p: any) => [p.id, p]));
        for (const it of items) {
            const p = it.product_id ? byId.get(it.product_id) : null;
            if (!p) continue;
            if (!it.name) it.name = String(p.name || '').slice(0, 200);
            if (!it.price) it.price = Number(p.price) || 0;
            if (!it.image && Array.isArray(p.images) && p.images[0]) it.image = String(p.images[0]).slice(0, 500);
        }
    }

    // Total: trust the client value, else sum the (possibly backfilled) items.
    const total = Number(body?.total) || items.reduce((s: number, it: any) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
    const currency = typeof body?.currency === 'string' ? body.currency.slice(0, 8) : 'UAH';
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
