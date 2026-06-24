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

  return NextResponse.json({ ok: true });
}
