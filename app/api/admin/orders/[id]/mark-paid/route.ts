import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { processAgencyCommission } from '@/lib/agency/commission';
import { processReferralReward } from '@/lib/referral/referral';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/mark-paid
 *
 * Manual "mark as paid" for admins (e.g. cash/transfer settled outside the
 * payment provider). Runs the SAME paid-transition accruals as the Monobank
 * webhook and check-payment — partner commission + friend-referral bonus —
 * which a direct `orders.payment_status = 'paid'` update from the payments
 * page skipped, so a partner order marked paid by hand never accrued its
 * commission. Idempotent: only pending → paid, and the accruals are guarded
 * by their own UNIQUE(order_id) ledgers.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('id, payment_status, promo_code, items, customer_id, total')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
  if (order.payment_status === 'paid') {
    return NextResponse.json({ status: 'paid', message: 'Замовлення вже позначене оплаченим.' });
  }

  const { data: updated, error } = await admin
    .from('orders')
    .update({ payment_status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('payment_status', 'paid')
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updated) {
    try {
      await processAgencyCommission(admin, {
        orderId: order.id,
        promoCode: (order as any).promo_code ?? null,
        items: (order as any).items,
      });
    } catch (e) { console.error('[mark-paid] agency commission failed:', e); }
    try {
      await processReferralReward(admin, {
        orderId: order.id,
        customerId: (order as any).customer_id ?? null,
        orderTotal: Number((order as any).total) || 0,
      });
    } catch (e) { console.error('[mark-paid] referral reward failed:', e); }

    // Customer confirmation email — same guarded fire-and-forget as the webhook.
    try {
      const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
      await fetch(`${base}/api/email/transactional`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' },
        body: JSON.stringify({ action: 'paid', orderId: id }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => {});
    } catch { /* never block */ }
  }

  return NextResponse.json({ status: 'paid', message: 'Замовлення позначено оплаченим' });
}
