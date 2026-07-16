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

  // Sum pending commissions (for the minimum-payout gate).
  const { data: pending } = await admin
    .from('agency_commissions')
    .select('id, total_commission')
    .eq('agency_id', agencyId)
    .eq('payout_status', 'pending');

  const pendingSum = (pending || []).reduce((s, c) => s + Number(c.total_commission), 0);
  if (!pending || pending.length === 0) {
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

  // Only bump the running total when this call actually paid something —
  // otherwise a racing no-op call could overwrite the winner's bump.
  if (paidSum > 0) {
    const { data: agency } = await admin
      .from('agency_partners')
      .select('total_paid_out')
      .eq('id', agencyId)
      .maybeSingle();
    await admin
      .from('agency_partners')
      // Also clear any open payout request — this payout fulfils it.
      .update({ total_paid_out: Number(agency?.total_paid_out || 0) + paidSum, payout_requested_at: null })
      .eq('id', agencyId);
  }

  return NextResponse.json({ ok: true, paid: paidSum, count: (flipped || []).length });
}
