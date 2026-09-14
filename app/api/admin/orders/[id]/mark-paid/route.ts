import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { processAgencyCommission } from '@/lib/agency/commission';
import { processReferralReward } from '@/lib/referral/referral';
import { redeemOrderCertificate } from '@/lib/certificates/redeemCertificate';

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
    .select('id, payment_status, monobank_invoice_id, promo_code, items, customer_id, total, certificate_code, certificate_redeemed, certificate_applied')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Замовлення не знайдено' }, { status: 404 });
  if (order.payment_status === 'paid') {
    return NextResponse.json({ status: 'paid', message: 'Замовлення вже позначене оплаченим.' });
  }

  // Стадія інвойсу дописується ЛИШЕ якщо рахунок Monobank справді існує.
  //
  // Після 20260914_monobank_stage_order колонка monobank_invoice_status стала
  // захисною: apply_monobank_payment порівнює ранг події з тим, що збережено, і
  // окреме суворе правило «після success назад тільки reversed» читає саме її.
  // Замовлення, яке залишилося зі стадією 'created' (ранг 10), беззахисне:
  // запізніла подія 'failure' (ранг 35) проходить умову «не менший ранг» і
  // переводить щойно підтверджену оплату у 'failed'.
  //
  // Але дописувати 'success' наосліп не можна. Цю кнопку тиснуть і на
  // замовленнях, за які заплатили повз Monobank узагалі — готівкою, переказом,
  // накладеним. Писати їм стадію банківського рахунку означало б вигадати
  // подію, якої не було. Тому умова: є monobank_invoice_id — пишемо, немає —
  // не чіпаємо стадію взагалі. Це чесно з обох боків (Diana, 14.09.2026).
  //
  // paid_at тут ставиться, як і ставився. Він і має ставитися: ручне
  // підтвердження — це і є перший перехід в оплачено, і заявка вебхука на
  // нього має програти, бо гроші вже враховані.
  const hasInvoice = !!(order as any).monobank_invoice_id;

  const { data: updated, error } = await admin
    .from('orders')
    .update({
      payment_status: 'paid',
      ...(hasInvoice ? { monobank_invoice_status: 'success' } : {}),
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
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

    // Certificate redemption — the webhook does this on its paid transition, so
    // the manual path must too. Without it a cert used to pay a cash/transfer
    // order stays redeemed=false; after the 24h reservation TTL the SAME code
    // becomes spendable again → the certificate value is double-spent.
    // Idempotent via the certificate_redeemed flag + the atomic redeemed check.
    if ((order as any).certificate_code && !(order as any).certificate_redeemed) {
      try {
        await redeemOrderCertificate(admin, {
          orderId: order.id,
          code: (order as any).certificate_code,
          applied: Number((order as any).certificate_applied) || 0,
          customerId: (order as any).customer_id ?? null,
        });
      } catch (e) { console.error('[mark-paid] certificate redemption failed:', e); }
    }

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
