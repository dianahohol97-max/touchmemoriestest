import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

// POST { agencyId } — mark all pending commissions for this agency as paid,
// and move the sum from "earned/pending" into the agency's total_paid_out.
export async function POST(request: Request) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const { agencyId } = await request.json().catch(() => ({}));
  if (!agencyId) return NextResponse.json({ error: 'agencyId required' }, { status: 400 });

  // Sum pending commissions.
  const { data: pending } = await admin
    .from('agency_commissions')
    .select('id, total_commission')
    .eq('agency_id', agencyId)
    .eq('payout_status', 'pending');

  const sum = (pending || []).reduce((s, c) => s + Number(c.total_commission), 0);
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, paid: 0, message: 'Немає нарахувань до виплати' });
  }

  const now = new Date().toISOString();
  await admin
    .from('agency_commissions')
    .update({ payout_status: 'paid', paid_at: now })
    .eq('agency_id', agencyId)
    .eq('payout_status', 'pending');

  // Bump total_paid_out.
  const { data: agency } = await admin
    .from('agency_partners')
    .select('total_paid_out')
    .eq('id', agencyId)
    .maybeSingle();
  await admin
    .from('agency_partners')
    .update({ total_paid_out: Number(agency?.total_paid_out || 0) + sum })
    .eq('id', agencyId);

  return NextResponse.json({ ok: true, paid: sum, count: pending.length });
}
