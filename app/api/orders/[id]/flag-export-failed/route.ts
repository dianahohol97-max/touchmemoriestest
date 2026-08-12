import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * POST /api/orders/[id]/flag-export-failed
 *
 * Called by checkout when a constructor item's print-file export failed (the
 * editor produced no files — html2canvas captured nothing or every upload
 * errored). Without this, the order is created with no design file and nobody
 * notices until production. We prepend a loud warning to the order's `notes`
 * so the manager sees it on the admin order page and can re-request the design
 * from the customer before printing.
 *
 * Intentionally NOT auth-gated to staff: it's called from the customer's
 * checkout session right after their own order is created, and only ever
 * appends a warning string to that order's notes (no data exposure, no
 * destructive action). Uses the service role to bypass RLS for the update.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'order id required' }, { status: 400 });

  let count = 1;
  try {
    const body = await req.json();
    if (body && Number.isFinite(Number(body.count))) count = Math.max(1, Number(body.count));
  } catch { /* default count = 1 */ }

  const admin = getAdminClient();

  const { data: order, error: readErr } = await admin
    .from('orders')
    .select('id, notes')
    .eq('id', id)
    .maybeSingle();

  if (readErr || !order) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 });
  }

  const warning =
    `⚠️ УВАГА: файли для друку не завантажились для ${count} товар(ів) — ` +
    `макет з конструктора відсутній. Зв'яжіться з клієнтом і попросіть оформити дизайн ще раз ` +
    `або надіслати фото перед друком.`;

  // Don't duplicate the warning if it's somehow flagged twice.
  const existing = (order.notes || '').trim();
  if (existing.includes('файли для друку не завантажились')) {
    return NextResponse.json({ ok: true, alreadyFlagged: true });
  }

  const newNotes = existing ? `${warning}\n\n${existing}` : warning;

  const { error: updErr } = await admin
    .from('orders')
    .update({ notes: newNotes })
    .eq('id', id);

  if (updErr) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }

  // Tell the team NOW, not when production reaches the order (Diana,
  // 2026-08-12, on TM-001175: the photos never uploaded, the note sat on the
  // card, and the gap surfaced only when a manager opened it days later). The
  // customer still has the photos in hand at this moment — an hour later they
  // have closed the tab.
  try {
    const { data: order } = await admin
      .from('orders')
      .select('order_number, customer_name, customer_phone, customer_email, items')
      .eq('id', id)
      .maybeSingle();

    const { getAlertChatId, getWorkChatIds, sendViaPublicBot } = await import('@/lib/chatbot/telegram-business');
    const workChats = await getWorkChatIds();
    const target = workChats[0] ?? await getAlertChatId();

    if (target && order) {
      const products = Array.isArray(order.items)
        ? order.items.map((i: any) => i?.product_name).filter(Boolean).slice(0, 3).join(', ')
        : '';
      const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';
      await sendViaPublicBot({
        chat_id: target,
        text: [
          `⚠️ ${order.order_number}: фото від клієнта НЕ завантажились (${count} товар(ів))`,
          products ? `Товар: ${products}` : '',
          `Клієнт: ${order.customer_name || '—'}${order.customer_phone ? `, ${order.customer_phone}` : ''}`,
          'Звʼяжіться з клієнтом зараз — попросіть надіслати фото повторно.',
          `${site}/admin/orders/${id}`,
        ].filter(Boolean).join('\n'),
      });
    }
  } catch (e) {
    // The warning on the card is the durable record; a failed notification
    // must never fail the customer's checkout call.
    console.error('[flag-export-failed] alert failed:', e);
  }

  return NextResponse.json({ ok: true });
}
