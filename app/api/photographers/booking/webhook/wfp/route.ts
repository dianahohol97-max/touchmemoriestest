import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { wfpVerifyCallback, wfpAcceptResponse } from '@/lib/photographers/payments';

export const dynamic = 'force-dynamic';

/**
 * WayForPay serviceUrl callback for photographer bookings. The signature is
 * verified with the photographer's own stored merchant secret (looked up by
 * orderReference); only a valid 'Approved' flips the booking to paid.
 * Responds with the accept envelope WFP expects. Idempotent.
 */
export async function POST(req: NextRequest) {
  // WFP may send JSON either as a raw body or as a single form key.
  let body: any = {};
  const raw = await req.text();
  try { body = JSON.parse(raw); }
  catch {
    try { body = JSON.parse(decodeURIComponent(raw.split('=')[0])); } catch { body = {}; }
  }

  const reference = String(body?.orderReference || '');
  if (!reference) return NextResponse.json({ ok: true });

  const admin = getAdminClient();
  const { data: slot } = await admin
    .from('photographer_slots')
    .select('id, payment_status, photographer_id')
    .eq('invoice_provider', 'wfp')
    .eq('invoice_id', reference)
    .maybeSingle();
  if (!slot) return NextResponse.json({ ok: true });

  const { data: p } = await admin
    .from('photographers')
    .select('pay_wfp_secret')
    .eq('id', slot.photographer_id)
    .maybeSingle();
  if (!p?.pay_wfp_secret) return NextResponse.json({ ok: true });

  if (!wfpVerifyCallback(p.pay_wfp_secret, body)) {
    console.error('[booking/webhook/wfp] bad signature for', reference);
    return NextResponse.json({ error: 'bad signature' }, { status: 403 });
  }

  if (String(body?.transactionStatus) === 'Approved' && slot.payment_status !== 'paid') {
    await admin.from('photographer_slots')
      .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', slot.id)
      .neq('payment_status', 'paid');
  }

  return NextResponse.json(wfpAcceptResponse(p.pay_wfp_secret, reference));
}
