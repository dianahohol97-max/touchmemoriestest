import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Minimum pending commission (UAH) before a payout can be requested.
export const MIN_PAYOUT_UAH = 500;

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Partner self-service cabinet, keyed by the per-partner cabinet_token (a random
 * UUID emailed to the partner on approval — so only the emailed person can open
 * it; the public referral_code is NOT enough to access earnings/bank details).
 *
 * GET  ?token=...  → partner summary + pending payout.
 * POST { token, payout_account } → save the partner's payout bank details.
 */
async function loadPartner(admin: ReturnType<typeof getAdminClient>, token: string) {
  const { data: partner } = await admin
    .from('agency_partners')
    .select('id, agency_name, contact_name, email, referral_code, partner_kind, travelbook_rate, other_rate, total_earned, total_paid_out, payout_account, status')
    .eq('cabinet_token', token)
    .maybeSingle();
  return partner;
}

async function pendingPayout(admin: ReturnType<typeof getAdminClient>, agencyId: string) {
  const { data: rows } = await admin
    .from('agency_commissions')
    .select('total_commission, payout_status')
    .eq('agency_id', agencyId)
    .eq('payout_status', 'pending');
  return (rows || []).reduce((s, r: any) => s + (Number(r.total_commission) || 0), 0);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: 'Невірне посилання' }, { status: 400 });

  const admin = getAdminClient();
  const partner = await loadPartner(admin, token);
  if (!partner) return NextResponse.json({ error: 'Партнера не знайдено' }, { status: 404 });

  const pending = await pendingPayout(admin, partner.id);

  return NextResponse.json({
    partner: {
      agency_name: partner.agency_name,
      contact_name: partner.contact_name,
      email: partner.email,
      referral_code: partner.referral_code,
      partner_kind: partner.partner_kind,
      travelbook_rate: partner.travelbook_rate,
      other_rate: partner.other_rate,
      total_earned: Number(partner.total_earned) || 0,
      total_paid_out: Number(partner.total_paid_out) || 0,
      pending_payout: pending,
      payout_account: partner.payout_account || '',
      status: partner.status,
    },
    min_payout: MIN_PAYOUT_UAH,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token || '');
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: 'Невірне посилання' }, { status: 400 });

  const account = String(body?.payout_account ?? '').trim().slice(0, 400);

  const admin = getAdminClient();
  const partner = await loadPartner(admin, token);
  if (!partner) return NextResponse.json({ error: 'Партнера не знайдено' }, { status: 404 });

  const { error } = await admin
    .from('agency_partners')
    .update({ payout_account: account || null })
    .eq('id', partner.id);
  if (error) return NextResponse.json({ error: 'Не вдалося зберегти' }, { status: 500 });

  return NextResponse.json({ ok: true, payout_account: account });
}
