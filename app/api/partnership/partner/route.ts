import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

// Minimum pending commission (UAH) before a payout can be requested.
export const MIN_PAYOUT_UAH = 500;

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Partner self-service cabinet, keyed by the per-partner cabinet_token (a random
 * UUID emailed to the partner on approval — so only the emailed person can open
 * it; the public referral_code is NOT enough to access earnings/bank details).
 *
 * GET  ?token=...  → partner summary + pending payout + commission history.
 * POST { token, payout_account }            → save payout bank details.
 * POST { token, action: 'request_payout' }  → payout request (≥ min, account set)
 *                                             → flags the partner + emails admin.
 */
async function loadPartner(admin: ReturnType<typeof getAdminClient>, token: string) {
  const { data: partner } = await admin
    .from('agency_partners')
    .select('id, agency_name, contact_name, email, referral_code, partner_kind, travelbook_rate, other_rate, total_earned, total_paid_out, payout_account, payout_requested_at, status')
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

  // Commission history: which orders earned what, and whether it's paid out.
  // Order numbers come via the FK join; totals are already per-order rows.
  const { data: commissionRows } = await admin
    .from('agency_commissions')
    .select('id, total_commission, travelbook_commission, other_commission, payout_status, paid_at, created_at, orders(order_number)')
    .eq('agency_id', partner.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const commissions = (commissionRows || []).map((c: any) => ({
    id: c.id,
    order_number: (Array.isArray(c.orders) ? c.orders[0] : c.orders)?.order_number || '—',
    total_commission: Number(c.total_commission) || 0,
    payout_status: c.payout_status,
    paid_at: c.paid_at,
    created_at: c.created_at,
  }));

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
      payout_requested_at: partner.payout_requested_at,
      status: partner.status,
    },
    commissions,
    min_payout: MIN_PAYOUT_UAH,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token || '');
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: 'Невірне посилання' }, { status: 400 });

  const admin = getAdminClient();
  const partner = await loadPartner(admin, token);
  if (!partner) return NextResponse.json({ error: 'Партнера не знайдено' }, { status: 404 });

  // ── Payout request ────────────────────────────────────────────────
  if (body?.action === 'request_payout') {
    const pending = await pendingPayout(admin, partner.id);
    if (pending < MIN_PAYOUT_UAH) {
      return NextResponse.json({ error: `Мінімальна сума виведення — ${MIN_PAYOUT_UAH} грн` }, { status: 400 });
    }
    if (!partner.payout_account) {
      return NextResponse.json({ error: 'Спершу збережіть рахунок для виплати' }, { status: 400 });
    }
    if (partner.payout_requested_at) {
      return NextResponse.json({ ok: true, payout_requested_at: partner.payout_requested_at });
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from('agency_partners')
      .update({ payout_requested_at: now })
      .eq('id', partner.id);
    if (error) return NextResponse.json({ error: 'Не вдалося надіслати запит' }, { status: 500 });

    if (getBrevoApiKey()) {
      sendBrevoEmail({
        to: 'touch.memories3@gmail.com',
        toName: 'Touch.Memories',
        subject: `💸 Запит на виплату: ${partner.agency_name} — ${Math.round(pending)} грн`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
            <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
              <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 16px">Партнер просить виплату</h2>
              <table style="width:100%;font-size:14px;border-collapse:collapse">
                <tr><td style="padding:6px 0;color:#6b7280;width:130px">Партнер:</td><td style="padding:6px 0;font-weight:700">${partner.agency_name} (${partner.partner_kind === 'travel_blogger' ? 'блогер' : 'агенція'})</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Сума:</td><td style="padding:6px 0;font-weight:700">${Math.round(pending)} грн</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Рахунок:</td><td style="padding:6px 0;white-space:pre-wrap">${partner.payout_account}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Email:</td><td style="padding:6px 0">${partner.email}</td></tr>
              </table>
              <p style="font-size:13px;color:#64748b;margin:18px 0 0">Провести виплату: адмінка → Тревел-партнери → картка партнера → «Виплатити».</p>
            </div>
          </div>`,
      }).catch(e => console.error('[partner] payout request email failed:', e));
    }

    return NextResponse.json({ ok: true, payout_requested_at: now });
  }

  // ── Save payout account ───────────────────────────────────────────
  const account = String(body?.payout_account ?? '').trim().slice(0, 400);
  const { error } = await admin
    .from('agency_partners')
    .update({ payout_account: account || null })
    .eq('id', partner.id);
  if (error) return NextResponse.json({ error: 'Не вдалося зберегти' }, { status: 500 });

  return NextResponse.json({ ok: true, payout_account: account });
}
