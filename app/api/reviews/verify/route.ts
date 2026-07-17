import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) return NextResponse.json({ valid: false });

    try {
        const decoded = Buffer.from(token, 'base64url').toString();
        const parts = decoded.split(':');
        if (parts.length < 3) return NextResponse.json({ valid: false });

        const sig = parts.pop()!;
        const expiresAt = Number(parts.pop()!);
        const orderId = parts.join(':');

        if (Date.now() > expiresAt) return NextResponse.json({ valid: false, reason: 'expired' });

        // SECURITY NOTE: the fallback 'tm-review-secret' is committed in this
        // public repo — if neither REVIEW_TOKEN_SECRET nor NEXTAUTH_SECRET is set
        // in the environment, review tokens are forgeable. Set REVIEW_TOKEN_SECRET
        // in Vercel; once it is guaranteed present the fallback should be removed
        // here AND in reviews/request + reviews/submit (which sign/verify with the
        // same key). Impact if unset is low (reviews are moderated before display),
        // so we do not fail closed here to avoid breaking live review links.
        const secret = process.env.REVIEW_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'tm-review-secret';
        const payload = `${orderId}:${expiresAt}`;
        const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        if (sig !== expected) return NextResponse.json({ valid: false, reason: 'invalid_sig' });

        const supabase = getAdminClient();
        const { data: order } = await supabase!
            .from('orders')
            .select('id, order_number, items')
            .eq('id', orderId)
            .single();

        if (!order) return NextResponse.json({ valid: false });

        const productName = Array.isArray(order.items) && order.items[0]?.name
            ? order.items[0].name : 'ваш товар';

        return NextResponse.json({
            valid: true, orderId,
            orderNumber: order.order_number || orderId.substring(0, 8).toUpperCase(),
            productName,
        });
    } catch {
        return NextResponse.json({ valid: false });
    }
}
