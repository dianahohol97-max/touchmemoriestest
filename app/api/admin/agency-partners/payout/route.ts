import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

// POST { agencyId } — mark all pending commissions for this agency as paid,
// and move the sum from "earned/pending" into the agency's total_paid_out.
// Admin-only: this is a financial action (releases money to a partner).
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const { agencyId } = await request.json().catch(() => ({}));
  if (!agencyId) return NextResponse.json({ error: 'agencyId required' }, { status: 400 });

  // Сума до виплати для перевірки мінімуму. Рахує Postgres, а не JavaScript:
  // вибірка всіх рядків журналу впиралася б у тисячу, яку PostgREST віддає
  // мовчки, і поріг у 500 ₴ рахувався б від неповної суми.
  const { data: statRows, error: statErr } = await admin.rpc('agency_commission_stats');
  if (statErr) return NextResponse.json({ error: statErr.message }, { status: 500 });
  const stat = (statRows || []).find((r: any) => r.agency_id === agencyId);
  const pendingSum = Number(stat?.pending_sum || 0);
  if (pendingSum <= 0) {
    return NextResponse.json({ ok: true, paid: 0, message: 'Немає нарахувань до виплати' });
  }
  // Minimum payout threshold.
  if (pendingSum < 500) {
    return NextResponse.json({ error: `Мінімальна сума виведення — 500 грн (зараз ${Math.round(pendingSum)} грн)` }, { status: 400 });
  }

  const now = new Date().toISOString();
  // Atomically flip pending → paid and read back exactly the rows THIS call
  // flipped. A concurrent second call flips 0 rows, so it can't double-count
  // the same commissions into total_paid_out.
  const { data: flipped } = await admin
    .from('agency_commissions')
    .update({ payout_status: 'paid', paid_at: now })
    .eq('agency_id', agencyId)
    .eq('payout_status', 'pending')
    .select('total_commission');

  const paidSum = (flipped || []).reduce((s, c) => s + Number(c.total_commission), 0);

  // Зведення партнера перераховується з журналу, а не додається до колонки.
  // Читання-запис тут мало ту саму ваду, що й у нарахуванні: два виклики, які
  // розминулися в часі на мілісекунду, писали одне й те саме значення, і одна
  // виплата зникала зі «Виплачено». Функція в базі рахує обидві суми одним
  // оператором, тож повторний виклик безпечний за побудовою.
  if (paidSum > 0) {
    const { error: recalcErr } = await admin.rpc('recalc_agency_partner_totals', { p_agency_id: agencyId });
    if (recalcErr) console.error('[agency-payout] totals recalc failed:', recalcErr.message);
    // Запит на виплату закритий саме цією виплатою.
    await admin
      .from('agency_partners')
      .update({ payout_requested_at: null })
      .eq('id', agencyId);
  }

  return NextResponse.json({ ok: true, paid: paidSum, count: (flipped || []).length });
}
