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
