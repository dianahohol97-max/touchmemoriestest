import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';
import { createAgencyPartner } from '@/lib/agency/create-partner';

export const dynamic = 'force-dynamic';

/**
 * GET /api/photographers/referral?token=<cabinet_token>
 *
 * The photographer's entry into the SAME referral program travel agencies use.
 * Resolves (and on first open lazily creates) the photographer's
 * agency_partners row — partner_kind 'photographer', same default terms as
 * agencies: client −5%, commission 5% travelbooks / 3% everything else — and
 * returns the partner cabinet token. The cabinet UI then talks to the existing
 * /api/partnership/partner API for the summary, payout account and payout
 * requests, so there is exactly ONE payout pipeline to maintain and the
 * photographer shows up in the admin «Тревел-партнери» list like everyone
 * else.
 *
 * Lazy creation (instead of at registration) covers every photographer that
 * exists or will ever exist, including ones created by the admin by hand —
 * the row appears the first time they open the referral section.
 */
export async function GET(req: NextRequest) {
  const photographer = await getPhotographerByToken(req.nextUrl.searchParams.get('token') || '');
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const admin = getAdminClient();

  // MODERATION GATE (Diana, 2026-08-04 second pass): referral earnings are a
  // money-bearing perk and require the approved photographer application, the
  // same review that unlocks the 10% discount. Without it the section shows a
  // "подайте заявку" state instead of enrolling. Checked on every call, so an
  // approval later unlocks it with no extra step — and a partner row that
  // already exists (enrolled while verified) keeps working.
  const { data: cust } = photographer.customer_id
    ? await admin.from('customers').select('b2b_role, b2b_status').eq('id', photographer.customer_id).maybeSingle()
    : { data: null };
  const isVerified = cust?.b2b_role === 'photographer' && cust?.b2b_status === 'verified';
  if (!isVerified && !(photographer as any).partner_id) {
    return NextResponse.json({ pending: true });
  }

  // Already enrolled?
  if ((photographer as any).partner_id) {
    const { data: partner } = await admin
      .from('agency_partners')
      .select('cabinet_token, referral_code, status')
      .eq('id', (photographer as any).partner_id)
      .maybeSingle();
    if (partner) {
      return NextResponse.json({
        partner_token: partner.cabinet_token,
        code: partner.referral_code,
        active: partner.status === 'active',
      });
    }
    // partner_id points at a deleted row — fall through and re-create.
  }

  // A partner may already exist for this email (e.g. enrolled via the admin
  // flow before this endpoint existed) — link it instead of duplicating.
  const { data: existing } = await admin
    .from('agency_partners')
    .select('id, cabinet_token, referral_code, status')
    .ilike('email', photographer.email || '')
    .maybeSingle();
  if (existing) {
    await admin.from('photographers').update({ partner_id: existing.id }).eq('id', photographer.id);
    return NextResponse.json({
      partner_token: existing.cabinet_token,
      code: existing.referral_code,
      active: existing.status === 'active',
    });
  }

  try {
    const partner = await createAgencyPartner(admin, {
      name: photographer.name || 'Фотограф',
      email: photographer.email || '',
      phone: (photographer as any).phone || null,
      partnerKind: 'photographer',
      clientDiscount: 5,
      travelbookRate: 5,
      otherRate: 3,
    });
    await admin.from('photographers').update({ partner_id: partner.id }).eq('id', photographer.id);
    return NextResponse.json({
      partner_token: partner.cabinet_token,
      code: partner.referral_code,
      active: true,
    });
  } catch (e: any) {
    console.error('[photographers/referral] enrol failed:', e);
    return NextResponse.json({ error: e?.message || 'Не вдалося створити реферальний код' }, { status: 500 });
  }
}
