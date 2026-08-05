import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { monoInvoiceStatus } from '@/lib/photographers/payments';
import { getPlan } from '@/lib/photographers/plans';
import { accrueGalleryCommission } from '@/lib/sales/commission';

export const dynamic = 'force-dynamic';

/**
 * Monobank webhook for storage-plan payments.
 *
 * The webhook body is NEVER trusted: anyone can POST here. We look the
 * subscription up by invoiceId and then re-ask Monobank for the real status
 * with the platform token before granting anything — the same pattern the
 * booking webhooks use.
 *
 * Granting is idempotent: a repeated 'success' for an already-paid row is a
 * no-op, so Monobank's retries can't stack extra months.
 */

async function platformMonoToken(): Promise<string | null> {
  const admin = getAdminClient();
  const { data: account } = await admin
    .from('bank_accounts')
    .select('api_key, is_active')
    .eq('region', 'ua')
    .eq('bank_name', 'Monobank')
    .maybeSingle();
  if (account?.is_active && account.api_key) return account.api_key;
  return process.env.MONOBANK_TOKEN || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const invoiceId = String((body as any)?.invoiceId || '');
    if (!invoiceId) return NextResponse.json({ ok: true });

    const admin = getAdminClient();
    const { data: sub } = await admin
      .from('photographer_subscriptions')
      .select('id, photographer_id, plan, status, amount_uah')
      .eq('invoice_id', invoiceId)
      .maybeSingle();
    if (!sub) return NextResponse.json({ ok: true });
    if (sub.status === 'paid') return NextResponse.json({ ok: true, already: true });

    const token = await platformMonoToken();
    if (!token) return NextResponse.json({ error: 'no token' }, { status: 503 });
    const status = await monoInvoiceStatus(token, invoiceId);
    if (status !== 'success') {
      if (status === 'failure' || status === 'expired') {
        await admin.from('photographer_subscriptions').update({ status: 'failed' }).eq('id', sub.id);
      }
      return NextResponse.json({ ok: true, status });
    }

    // Extend from the later of "now" and the current expiry, so paying early
    // adds a month instead of losing the remaining days.
    const { data: ph } = await admin
      .from('photographers')
      .select('plan, plan_expires_at')
      .eq('id', sub.photographer_id)
      .maybeSingle();
    const current = ph?.plan_expires_at ? new Date(ph.plan_expires_at).getTime() : 0;
    const base = Math.max(Date.now(), current);
    const expiresAt = new Date(base + 30 * 86400000).toISOString();

    await admin
      .from('photographers')
      .update({ plan: sub.plan, plan_expires_at: expiresAt })
      .eq('id', sub.photographer_id);
    await admin
      .from('photographer_subscriptions')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', sub.id);

    // The sales manager who brought this photographer earns their share of the
    // plan. Isolated: the photographer's plan is already granted above and must
    // not be rolled back by a bookkeeping failure.
    try {
      await accrueGalleryCommission(admin, {
        subscriptionId: sub.id,
        photographerId: sub.photographer_id,
        amountUah: Number(sub.amount_uah) || 0,
        planName: getPlan(sub.plan).name,
      });
    } catch (e) {
      console.error('[sales-commission] gallery accrual failed (plan still granted):', e);
    }

    console.log('[photographer-subscription] granted', {
      photographer: sub.photographer_id, plan: getPlan(sub.plan).name, expiresAt,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[photographer-subscription/webhook]', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
