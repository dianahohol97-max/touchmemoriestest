import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

function genAgencyCode(name: string): string {
  // Readable prefix from the agency name + random suffix.
  const base = (name || 'AG')
    .toUpperCase()
    .replace(/[^A-ZА-ЯІЇЄ0-9]/gi, '')
    .slice(0, 4) || 'AG';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${base}${suffix}`;
}

// GET — list all agency partners with their commission totals + pending payout
export async function GET() {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const { data: partners } = await admin
    .from('agency_partners')
    .select('*')
    .order('created_at', { ascending: false });

  // Pending (unpaid) commission per agency
  const { data: pending } = await admin
    .from('agency_commissions')
    .select('agency_id, total_commission, payout_status');

  const pendingByAgency: Record<string, number> = {};
  for (const c of pending || []) {
    if (c.payout_status === 'pending') {
      pendingByAgency[c.agency_id] = (pendingByAgency[c.agency_id] || 0) + Number(c.total_commission);
    }
  }

  const enriched = (partners || []).map(p => ({
    ...p,
    pending_payout: pendingByAgency[p.id] || 0,
  }));

  return NextResponse.json({ partners: enriched });
}

// POST — approve a partnership request into an agency partner (creates the
// personal promo code + the agency_partners row). Body: { requestId } OR the
// raw fields { agencyName, email, ... }.
export async function POST(request: Request) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const admin = getAdminClient();

  const body = await request.json().catch(() => ({}));
  let { agencyName, contactName, email, phone, website, requestId } = body;
  const travelbookRate = Number(body?.travelbookRate ?? 10);
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
    return NextResponse.json({ error: `partner create failed: ${partnerErr.message}` }, { status: 500 });
  }

  // Mark the source request approved.
  if (requestId) {
    await admin.from('partnership_requests').update({ status: 'approved' }).eq('id', requestId);
  }

  // Welcome email to the partner with their code + terms. Fire-and-forget:
  // a mail failure must never fail the approval (the partner row already exists).
  if (getBrevoApiKey() && email) {
    const kindWord = partnerKind === 'travel_blogger' ? 'блогером' : 'агенцією';
    const refLink = `https://touchmemories.com.ua/?ref=${code}`;
    try {
      await sendBrevoEmail({
        to: email,
        toName: agencyName,
        subject: `Вітаємо! Ваш партнерський код touch.memories: ${code}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
            <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
              <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 12px">Вітаємо, ${agencyName}!</h2>
              <p style="font-size:14px;color:#334155;margin:0 0 16px">Ви стали партнером-${kindWord} touch.memories. Ось ваш персональний промокод:</p>
              <div style="text-align:center;margin:18px 0"><span style="display:inline-block;font-size:22px;font-weight:800;letter-spacing:.12em;color:#1e2d7d;background:#eef2ff;border:1px dashed #a5b4fc;border-radius:10px;padding:12px 22px">${code}</span></div>
              <table style="width:100%;font-size:14px;border-collapse:collapse;margin:8px 0 16px">
                <tr><td style="padding:6px 0;color:#6b7280">Комісія з тревелбуків:</td><td style="padding:6px 0;font-weight:700;text-align:right">${travelbookRate}%</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Комісія з решти товарів:</td><td style="padding:6px 0;font-weight:700;text-align:right">${otherRate}%</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Знижка клієнту за кодом:</td><td style="padding:6px 0;font-weight:700;text-align:right">${clientDiscount}%</td></tr>
              </table>
              <p style="font-size:14px;color:#334155;margin:0 0 8px">Клієнт вводить код при оформленні й отримує знижку, а вам нараховується комісія — <b>автоматично після оплати замовлення</b>. Можна ділитися і прямим посиланням:</p>
              <p style="font-size:14px;margin:0 0 16px"><a href="${refLink}" style="color:#263A99">${refLink}</a></p>
              <p style="font-size:13px;color:#94a3b8;margin:0">Дякуємо за співпрацю! Якщо виникнуть питання — просто відповідайте на цей лист.</p>
            </div>
          </div>`,
      });
    } catch (e) { console.error('partner welcome email failed (partner still created):', e); }
  }

  return NextResponse.json({ partner });
}
