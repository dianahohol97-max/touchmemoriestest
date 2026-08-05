import { NextResponse } from 'next/server';
import { requireAdmin, likeEscape } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { createAgencyPartner } from '@/lib/agency/create-partner';
import { sendPartnerWelcomeEmail } from '@/lib/agency/welcome-email';
import { PARTNER_KINDS } from '@/lib/sales/partner-activation';

export const dynamic = 'force-dynamic';

const FROM_EMAIL = 'hello@touchmemories.com.ua';

/**
 * Рішення по заявках менеджерів на оформлення партнера (Diana, 2026-08-06).
 *
 * Підтвердження — це одна дія, яка робить усе, що раніше робилося руками й у
 * різних місцях: створює партнера з персональним промокодом, одразу записує
 * менеджера, який його привів, переводить ліда в «Угоду» і надсилає партнеру
 * лист із кодом та посиланням на кабінет. Пропущений крок «привʼязати
 * менеджера» коштував менеджеру комісії за закриту ним угоду, тому він більше
 * не окремий крок.
 *
 * requireAdmin, а не requireStaff: підтвердження випускає в світ активний
 * промокод зі знижкою.
 */

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('partner_activation_requests')
    .select('*, manager:sales_managers(id, name, email), lead:leads(id, status, business_type, city, notes)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requests: data || [] });
}

/**
 * PATCH — { request_id, action: 'approve' | 'decline', ... }
 *
 * approve приймає уточнені умови: partner_kind, client_discount,
 * travelbook_rate, other_rate. Менеджер їх не задає — вони приходять у заявці
 * стандартними, і саме тут їх можна змінити перед випуском коду.
 * decline приймає decline_reason — його бачить менеджер у своєму кабінеті.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const admin = getAdminClient();

  const { data: req } = await admin
    .from('partner_activation_requests')
    .select('*')
    .eq('id', String(body?.request_id || ''))
    .maybeSingle();
  if (!req) return NextResponse.json({ error: 'Заявку не знайдено' }, { status: 404 });
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'Заявку вже опрацьовано' }, { status: 409 });
  }

  if (body?.action === 'decline') {
    const { error } = await admin
      .from('partner_activation_requests')
      .update({
        status: 'declined',
        decline_reason: body?.decline_reason ? String(body.decline_reason).slice(0, 1000) : null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', req.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.action !== 'approve') {
    return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
  }

  // Партнер із такою поштою міг зʼявитися після подання заявки — наприклад,
  // фотограф сам увімкнув реферальний код у себе в кабінеті.
  const { data: clash } = await admin
    .from('agency_partners')
    .select('id, agency_name, referral_code')
    .ilike('email', likeEscape(req.email))
    .maybeSingle();
  if (clash) {
    return NextResponse.json({
      error: `Партнер із поштою ${req.email} уже існує: ${clash.agency_name}, код ${clash.referral_code}`,
    }, { status: 409 });
  }

  const partnerKind = PARTNER_KINDS.includes(body?.partner_kind) ? body.partner_kind : req.partner_kind;
  const clientDiscount = Number(body?.client_discount ?? req.client_discount);
  const travelbookRate = Number(body?.travelbook_rate ?? req.travelbook_rate);
  const otherRate = Number(body?.other_rate ?? req.other_rate);

  let partner: any;
  try {
    partner = await createAgencyPartner(admin, {
      name: req.business_name,
      email: req.email,
      contactName: req.contact_name,
      phone: req.phone,
      website: req.website,
      partnerKind,
      clientDiscount,
      travelbookRate,
      otherRate,
      // Ось заради чого весь цей роут: менеджер записується разом зі
      // створенням партнера, а не окремим кроком, який можна забути.
      salesManagerId: req.manager_id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не вдалося створити партнера' }, { status: 500 });
  }

  await admin
    .from('partner_activation_requests')
    .update({
      status: 'approved',
      partner_id: partner.id,
      partner_kind: partnerKind,
      client_discount: clientDiscount,
      travelbook_rate: travelbookRate,
      other_rate: otherRate,
      decided_at: new Date().toISOString(),
    })
    .eq('id', req.id);

  if (req.lead_id) {
    await admin.from('leads')
      .update({ status: 'won', updated_at: new Date().toISOString() })
      .eq('id', req.lead_id);
  }

  // Фотограф із тією ж поштою отримує того самого менеджера: інакше комісія з
  // оплачених тарифів памʼяті (5%) не нарахувалась би нікому, хоча фотографа
  // привела та сама людина. Чужу привʼязку не чіпаємо.
  if (partnerKind === 'photographer') {
    const { data: photographer } = await admin
      .from('photographers')
      .select('id, sales_manager_id')
      .ilike('email', likeEscape(req.email))
      .maybeSingle();
    if (photographer && !photographer.sales_manager_id && req.manager_id) {
      await admin.from('photographers')
        .update({ sales_manager_id: req.manager_id })
        .eq('id', photographer.id);
    }
  }

  // Лист із кодом. Ніколи не валить підтвердження — партнер уже створений.
  const mail = await sendPartnerWelcomeEmail({
    email: req.email,
    name: req.business_name,
    code: partner.referral_code,
    cabinetToken: partner.cabinet_token,
    partnerKind,
    clientDiscount,
    travelbookRate,
    otherRate,
  });

  // Той самий лист лягає в переписку з лідом, щоб менеджер бачив у своєму
  // кабінеті, що саме отримав його партнер, і міг на це послатися.
  if (req.lead_id && mail.sent) {
    await admin.from('lead_messages').insert({
      lead_id: req.lead_id,
      direction: 'out',
      channel: 'email',
      subject: mail.subject,
      body: mail.text,
      from_email: FROM_EMAIL,
      to_email: req.email,
      meta: { partner_activation_request: req.id, partner_id: partner.id },
    });
  }

  return NextResponse.json({
    partner: { id: partner.id, referral_code: partner.referral_code, cabinet_token: partner.cabinet_token },
    email_sent: mail.sent,
  });
}
