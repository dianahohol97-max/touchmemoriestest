import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/admin/one-off/rerender?key=...&order=TM-001046
 *
 * Key-protected wrapper around the internal /api/print/render-order (which
 * requires the x-cron-secret header and therefore can't be triggered from a
 * browser). Built for TM-001046: Angelina's placements are saved, so her
 * blank book is re-rendered server-side (Railway, headless — immune to the
 * browser CORS blindness) with ZERO effort from the customer. Reusable for
 * any order via ?order=TM-NNNNNN.
 */
const KEY = 'tm-rerender-2026-07-07-k4v8';

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    if (url.searchParams.get('key') !== KEY) {
        return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const orderNumber = url.searchParams.get('order');
    if (!orderNumber) return NextResponse.json({ error: 'order required' }, { status: 400 });

    const admin = getAdminClient();
    const { data: order } = await admin
        .from('orders')
        .select('id, order_number')
        .eq('order_number', orderNumber)
        .maybeSingle();
    if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 });

    const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
    const res = await fetch(`${base}/api/print/render-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
        body: JSON.stringify({ orderId: order.id }),
    });
    const detail = await res.json().catch(() => ({}));
    return NextResponse.json({ order: order.order_number, status: res.status, detail });
}
