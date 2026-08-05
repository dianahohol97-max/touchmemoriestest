import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff, requireAdmin } from '@/lib/auth/guards';
import { sendPartnerWelcomeEmail } from '@/lib/agency/welcome-email';
import { findLeadAttribution, attachManagerToPartner, logAttributionClaim } from '@/lib/sales/attribution';

export const dynamic = 'force-dynamic';

// Code generation moved to lib/agency/create-partner so the photographer
// cabinet (which enrols into the same program) can't drift from this flow.
import { genAgencyCode } from '@/lib/agency/create-partner';

// GET — list all agency partners with their commission totals + pending payout
export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const { data: partners } = await admin
    .from('agency_partners')
    .select('*')
    .order('created_at', { ascending: false });

  // Комісії партнера + скільки замовлень і виручки пройшло за його кодом
  // (Diana, 2026-08-06). Рядок в agency_commissions зʼявляється лише після
  // підтвердженої оплати, тож це оплачені замовлення, а не створені кошики.
  const { data: pending } = await admin
    .from('agency_commissions')
    .select('agency_id, total_commission, payout_status, travelbook_subtotal, other_subtotal');

  const pendingByAgency: Record<string, number> = {};
  const ordersByAgency: Record<string, { count: number; revenue: number }> = {};
  for (const c of pending || []) {
    if (c.payout_status === 'pending') {
      pendingByAgency[c.agency_id] = (pendingByAgency[c.agency_id] || 0) + Number(c.total_commission);
    }
    const cur = ordersByAgency[c.agency_id] || { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(c.travelbook_subtotal || 0) + Number(c.other_subtotal || 0);
    ordersByAgency[c.agency_id] = cur;
  }

  const enriched = (partners || []).map(p => ({
    ...p,
    pending_payout: pendingByAgency[p.id] || 0,
    orders_count: ordersByAgency[p.id]?.count || 0,
    orders_revenue: Math.round(ordersByAgency[p.id]?.revenue || 0),
  }));

  return NextResponse.json({ partners: enriched });
}

// POST — approve a partnership request into an agency partner (creates the
// personal promo code + the agency_partners row). Body: { requestId } OR the
// raw fields { agencyName, email, ... }.
export async function POST(request: Request) {
  // Approval mints a client-facing discount promo code and a partner row —
  // an admin-only action, not general staff.
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const body = await request.json().catch(() => ({}));
  let { agencyName, contactName, email, phone, website, requestId } = body;
  const travelbookRate = Number(body?.travelbookRate ?? 5);
  const otherRate = Number(body?.otherRate ?? 3);
  const clientDiscount = Number(body?.clientDiscount ?? 5); // % discount the code gives the client
  // travel_agency | travel_blogger — same mechanics/rates, label only.
  let partnerKind = body?.kind === 'travel_blogger' ? 'travel_blogger' : 'travel_agency';

  // If approving an existing request, pull its details.
  if (requestId) {
    const { data: req } = await admin
      .from('partnership_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (req) {
      agencyName = agencyName || req.agency_name;
      contactName = contactName || req.contact_name;
      email = email || req.email;
      phone = phone || req.phone;
      website = website || req.website;
      if (req.kind === 'travel_blogger') partnerKind = 'travel_blogger';
    }
  }

  if (!agencyName || !email) {
    return NextResponse.json({ error: 'agencyName and email required' }, { status: 400 });
  }

  // Generate a unique code (retry on collision).
  let code = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = genAgencyCode(agencyName);
    const { data: clash } = await admin
      .from('agency_partners')
      .select('id')
      .ilike('referral_code', candidate)
      .maybeSingle();
    if (!clash) { code = candidate; break; }
  }
  if (!code) return NextResponse.json({ error: 'could not generate code' }, { status: 500 });

  // Create the client-facing promo code (percentage discount for the client).
  const { data: promo, error: promoErr } = await admin
    .from('promo_codes')
    .insert({
      code,
      type: 'percent',
      value: clientDiscount,
      applies_to: 'all',
      is_active: true,
      created_by: 'agency-partner',
      notes: `Промокод тревел-агенції ${agencyName}`,
    })
    .select('id')
    .single();
  if (promoErr) {
    return NextResponse.json({ error: `promo create failed: ${promoErr.message}` }, { status: 500 });
  }

  const { data: partner, error: partnerErr } = await admin
    .from('agency_partners')
    .insert({
      agency_name: agencyName,
      contact_name: contactName || null,
      email,
      phone: phone || null,
      website: website || null,
      referral_code: code,
      promo_code_id: promo.id,
      travelbook_rate: travelbookRate,
      other_rate: otherRate,
      status: 'active',
      partner_kind: partnerKind,
      source_request_id: requestId || null,
    })
    .select('*')
    .single();
  if (partnerErr) {
    // Roll the promo row back — without this, a failed partner insert left an
    // ACTIVE discount code with no partner behind it: a live -N% code nobody
    // knows exists, invisible in the partners list, redeemable at checkout.
    await admin.from('promo_codes').delete().eq('id', promo.id);
    return NextResponse.json({ error: `partner create failed: ${partnerErr.message}` }, { status: 500 });
  }

  // Mark the source request approved.
  if (requestId) {
    await admin.from('partnership_requests').update({ status: 'approved' }).eq('id', requestId);
  }

  /**
   * Хто привів (Diana, 2026-08-06). Заявка з форми на сайті нічого не знає про
   * менеджерів, тому партнер тут завжди створювався з порожнім
   * sales_manager_id — навіть коли менеджер до того місяць вів цю саму студію
   * в директі, а вона просто дійшла до сайту сама. Шукаємо лід із тими самими
   * контактами (пошта або нікнейм, зокрема з поля «сайт», куди часто дають
   * посилання на Instagram) і записуємо його менеджера.
   *
   * Привʼязка зворотна: у списку партнерів менеджера видно і можна змінити.
   */
  let creditedManager: string | null = null;
  try {
    const attribution = await findLeadAttribution(admin, { email, website });
    if (attribution) {
      await attachManagerToPartner(admin, {
        partnerId: partner.id,
        managerId: attribution.managerId,
        email,
        leadId: attribution.leadId,
      });
      await logAttributionClaim(admin, {
        leadId: attribution.leadId,
        managerId: attribution.managerId,
        partnerId: partner.id,
        businessName: agencyName,
        email,
        comment: `Партнер зареєструвався самостійно, збіг із лідом за ${attribution.matchedBy === 'email' ? 'поштою' : 'Instagram'} від ${new Date(attribution.leadCreatedAt).toLocaleDateString('uk-UA')}`,
      });
      creditedManager = attribution.managerName;
    }
  } catch (e) {
    // Бухгалтерія не має валити оформлення партнера, який уже створений.
    console.error('[agency-partners] manager attribution failed:', e);
  }

  // Welcome email to the partner with their code + terms. Fire-and-forget:
  // a mail failure must never fail the approval (the partner row already
  // exists). The template lives in lib/agency/welcome-email so this route and
  // the manager-request approval can't drift apart on terms wording.
  await sendPartnerWelcomeEmail({
    email,
    name: agencyName,
    code,
    cabinetToken: partner.cabinet_token,
    partnerKind,
    clientDiscount,
    travelbookRate,
    otherRate,
  });

  return NextResponse.json({ partner, credited_manager: creditedManager });
}
