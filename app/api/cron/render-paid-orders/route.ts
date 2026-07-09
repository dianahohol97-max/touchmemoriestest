import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/render-paid-orders
 *
 * The missing middle of the print pipeline. /api/print/render-order has existed
 * for weeks and two code comments claim "Monobank webhook → render-order", but
 * NOTHING ever called it: photobooks shipped with the browser's html2canvas
 * snapshots (the ones that gave us blank pages, CORS blindness, stretched
 * photos and baked-in UI badges).
 *
 * It can't hang off the webhook — a render takes minutes and Vercel freezes the
 * lambda the moment it responds. So: the webhook stays fast, and this cron picks
 * up paid orders whose design was saved but whose 300-DPI print files don't
 * exist yet, and renders them on the Railway service (headless Chromium, a
 * controlled environment: no CORS, no transforms, no phone memory).
 *
 * Idempotent: an order with print files is skipped. Batched (3 per run) because
 * one book is dozens of 29-megapixel screenshots. Never throws — a render
 * failure must not break the cron chain; the order simply gets retried next run,
 * and missing-print-files still flags anything left behind for a human.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.RENDER_SERVICE_URL || !process.env.RENDER_SERVICE_TOKEN) {
    return NextResponse.json({ ok: true, skipped: 'render-service-not-configured' });
  }

  const admin = getAdminClient();
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');

  // Paid orders from the last 7 days that have a saved design.
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data: candidates, error } = await admin
    .from('projects')
    .select('order_id, orders!inner(id, order_number, payment_status, created_at)')
    .not('order_id', 'is', null)
    .eq('orders.payment_status', 'paid')
    .gte('orders.created_at', since)
    .limit(30);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const queue: Array<{ id: string; number: string }> = [];
  for (const row of candidates || []) {
    const order: any = (row as any).orders;
    if (!order?.id || seen.has(order.id)) continue;
    seen.add(order.id);

    // Already rendered server-side? Skip.
    const { count } = await admin
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id)
      .like('file_path', '%/print/%');
    if ((count || 0) > 0) continue;

    queue.push({ id: order.id, number: order.order_number });
    if (queue.length >= 3) break;
  }

  const results: Array<{ order: string; ok: boolean; detail?: string }> = [];
  for (const order of queue) {
    try {
      const res = await fetch(`${base}/api/print/render-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET! },
        body: JSON.stringify({ orderId: order.id }),
      });
      const detail = await res.json().catch(() => ({}));
      results.push({ order: order.number, ok: res.ok, detail: JSON.stringify(detail).slice(0, 300) });
    } catch (e: any) {
      results.push({ order: order.number, ok: false, detail: e?.message || 'fetch failed' });
    }
  }

  return NextResponse.json({ ok: true, considered: seen.size, rendered: results.length, results });
}
