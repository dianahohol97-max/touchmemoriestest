import { NextResponse, after } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Opening text of the render-failure note block, used to write AND to clear it. */
const RENDER_FAIL_MARKER = '⚠️ РЕНДЕР НЕ ВДАВСЯ';

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

  // ?project=<id> — перегенерувати лише один виріб замовлення. Без нього
  // рендеряться всі, що на замовленні з пʼятьма книгами не вкладається в час.
  const projectId = new URL(_req.url).searchParams.get('project') || undefined;

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
        body: JSON.stringify({ orderId: order.id, ...(projectId ? { projectId } : {}) }),
      });
      const detail: any = await res.json().catch(() => ({}));
      console.log('[rerender] render-order done', { order: order.order_number, status: res.status, detail });

      // A failed render used to be invisible: the click answered «Рендер
      // запущено — файли оновляться за 1–2 хв» and then nothing ever appeared,
      // with the reason sitting only in the Vercel log. TM-001096 was clicked
      // twice that way while Railway was crashing. Put the reason on the order
      // so the next person reads it instead of clicking again.
      // Read the current notes so this never destroys what someone else wrote.
      // The first version assigned `notes:` outright, so every failed render
      // wiped the order's whole note field — TM-001108 lost its layout notes to
      // two failed clicks. Prepend, exactly like auditPrintArtifacts does.
      const { data: cur } = await admin
        .from('orders').select('notes').eq('id', order.id).maybeSingle();
      // Drop any previous render-failure block, so warnings never stack up and a
      // stale one can never outlive the failure it described.
      const kept = String((cur as any)?.notes || '')
        .split(/\n{2,}/)
        .filter((block) => !block.trimStart().startsWith(RENDER_FAIL_MARKER))
        .join('\n\n')
        .trim();

      if (detail && detail.ok === false) {
        const why = (detail.results || [])
          .map((r: any) => r?.error || r?.detail?.message || r?.detail?.error)
          .filter(Boolean)
          .join('; ');
        const warn = `${RENDER_FAIL_MARKER} (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC): `
          + `зібрано ${detail.rendered ?? 0} з ${detail.total ?? '?'}. `
          + (why ? `Причина: ${why}. ` : '')
          + 'Файлів для друку немає — не відправляти в друк.';
        await admin.from('orders')
          .update({ notes: kept ? `${warn}\n\n${kept}` : warn })
          .eq('id', order.id);
      } else if (String((cur as any)?.notes || '').includes(RENDER_FAIL_MARKER)) {
        // Success, and a warning from an earlier attempt is still sitting there.
        // It describes a render that no longer exists, so leaving it up means a
        // good order keeps reading «не відправляти в друк» with nothing to say
        // otherwise. `kept` is the notes with only that block removed.
        await admin.from('orders').update({ notes: kept || null }).eq('id', order.id);
      }
    } catch (e: any) {
      console.error('[rerender] render-order trigger failed', { order: order.order_number, error: e?.message });
    }
  });

  return NextResponse.json({ ok: true, started: true, order: order.order_number });
}
