import { NextResponse, after } from 'next/server';
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
 *
 * Rendering every spread takes 1–2 min for a large book — far longer than a
 * click should block, and long enough that awaiting it timed the request out
 * ("Не вдалося перегенерувати"). So we validate, then TRIGGER the internal
 * render-order fire-and-forget via after() (keeps the function alive to dispatch
 * it after the response) and return immediately. render-order (maxDuration 300)
 * does the work and re-indexes order_files; the admin refreshes to see them.
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

  const secret = process.env.CRON_SECRET || '';
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET не налаштовано' }, { status: 500 });
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');

  // Fire the render in the background; don't make the click wait for it.
  after(async () => {
    try {
      const res = await fetch(`${base}/api/print/render-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
        body: JSON.stringify({ orderId: order.id }),
      });
      const detail: any = await res.json().catch(() => ({}));
      console.log('[rerender] render-order done', { order: order.order_number, status: res.status, detail });

      // A failed render used to be invisible: the click answered «Рендер
      // запущено — файли оновляться за 1–2 хв» and then nothing ever appeared,
      // with the reason sitting only in the Vercel log. TM-001096 was clicked
      // twice that way while Railway was crashing. Put the reason on the order
      // so the next person reads it instead of clicking again.
      if (detail && detail.ok === false) {
        const why = (detail.results || [])
          .map((r: any) => r?.error || r?.detail?.message || r?.detail?.error)
          .filter(Boolean)
          .join('; ');
        await admin.from('orders').update({
          notes: `⚠️ РЕНДЕР НЕ ВДАВСЯ (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC): `
            + `зібрано ${detail.rendered ?? 0} з ${detail.total ?? '?'}. `
            + (why ? `Причина: ${why}. ` : '')
            + 'Файлів для друку немає — не відправляти в друк.',
        }).eq('id', order.id);
      }
    } catch (e: any) {
      console.error('[rerender] render-order trigger failed', { order: order.order_number, error: e?.message });
    }
  });

  return NextResponse.json({ ok: true, started: true, order: order.order_number });
}
