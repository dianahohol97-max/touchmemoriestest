import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/orders/[id]/rerender
 *
 * Staff-triggered server-side re-render of an order's print layout via the
 * Railway service (headless, 300 DPI, full-res originals from storage — no
 * browser html2canvas, so none of the editor chrome / 1600px-preview softness).
 * Wraps the internal /api/print/render-order, which requires the CRON_SECRET
 * header (added here server-side, so no secret is exposed to the browser).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });

  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET не налаштовано' }, { status: 500 });

  try {
    const res = await fetch(`${base}/api/print/render-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
      body: JSON.stringify({ orderId: order.id }),
    });
    const detail = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: detail?.error || `Рендер не вдався (${res.status})`, detail }, { status: 502 });
    }
    return NextResponse.json({ ok: true, order: order.order_number, detail });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Помилка виклику рендер-сервісу' }, { status: 502 });
  }
}
