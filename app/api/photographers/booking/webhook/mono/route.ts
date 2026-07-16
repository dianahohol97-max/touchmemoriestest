import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { monoInvoiceStatus } from '@/lib/photographers/payments';

export const dynamic = 'force-dynamic';

/**
 * Monobank acquiring webhook for photographer bookings. We do NOT trust the
 * webhook body: the invoiceId is looked up, then the status is re-fetched
 * from Monobank's API with the photographer's own stored token — only a
 * confirmed 'success' flips the booking to paid. Idempotent.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const invoiceId = String(body?.invoiceId || '');
  if (!invoiceId) return NextResponse.json({ ok: true }); // nothing to do, ack

  const admin = getAdminClient();
  const { data: slot } = await admin
    .from('photographer_slots')
    .select('id, payment_status, photographer_id')
    .eq('invoice_provider', 'mono')
    .eq('invoice_id', invoiceId)
    .maybeSingle();
  if (!slot || slot.payment_status === 'paid') return NextResponse.json({ ok: true });

  const { data: p } = await admin
    .from('photographers')
    .select('pay_mono_token')
    .eq('id', slot.photographer_id)
    .maybeSingle();
  if (!p?.pay_mono_token) return NextResponse.json({ ok: true });

  const status = await monoInvoiceStatus(p.pay_mono_token, invoiceId);
  if (status === 'success') {
    await admin.from('photographer_slots')
      .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', slot.id)
      .neq('payment_status', 'paid');
  }
  return NextResponse.json({ ok: true });
}
