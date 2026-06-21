import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const { token, rating, text, name, orderId } = await request.json();
    if (!token || !rating || !text || !orderId) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    try {
        const decoded = Buffer.from(token, 'base64url').toString();
        const parts = decoded.split(':');
        if (parts.length < 3) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

        const sig = parts.pop()!;
        const expiresAt = Number(parts.pop()!);
        const tokenOrderId = parts.join(':');

        if (tokenOrderId !== orderId || Date.now() > expiresAt) {
            return NextResponse.json({ error: 'Token invalid or expired' }, { status: 400 });
        }

        const secret = process.env.REVIEW_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'tm-review-secret';
        const expected = crypto.createHmac('sha256', secret).update(`${tokenOrderId}:${expiresAt}`).digest('hex');
        if (sig !== expected) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

        const supabase = getAdminClient();
        const { data: order } = await supabase!
            .from('orders')
            .select('id, items')
            .eq('id', orderId)
            .single();

        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        const productId = Array.isArray(order.items) && order.items[0]?.product_id
            ? order.items[0].product_id : null;

        await supabase!.from('reviews').insert({
            product_id: productId,
            rating: Number(rating),
            caption: text.trim(),
            author: name?.trim() || null,
            status: 'pending',   // moderation queue
            is_active: false,    // hidden until admin approves
        });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[review/submit]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
