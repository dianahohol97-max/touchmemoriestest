import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRuntimeBaseUrl } from '@/lib/runtimeUrl';
import { getPhotographerByToken } from '@/lib/photographers/helpers';
import { GALLERY_PLANS, effectivePlanId } from '@/lib/photographers/plans';
import { monoCreateInvoice, monoInvoiceStatus } from '@/lib/photographers/payments';

export const dynamic = 'force-dynamic';

/**
 * Payment self-test for storage plans (Diana, 2026-08-05: «давай перевіримо
 * оплату»). Acquiring can only be trusted once real money has moved, so this
 * endpoint makes that cheap and safe to do.
 *
 *   ?token=…                    → config report, no side effects
 *   ?token=…&invoice=…          → ask Monobank for that invoice's real status
 *   ?token=…&create=1&plan=start&test=1
 *                               → create a genuine 1 ₴ invoice for a real
 *                                 pending subscription row, so paying it runs
 *                                 the whole chain: Monobank → webhook →
 *                                 status re-check → plan granted
 *
 * The 1 ₴ price is limited to the accounts below: everyone else is charged the
 * real plan price, so this can never become a discount hole.
 */
const TEST_EMAILS = ['gogolka16@gmail.com', 'dianahohol97@gmail.com'];

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const photographer = await getPhotographerByToken(q.get('token') || '');
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const admin = getAdminClient();
  const { data: account } = await admin
    .from('bank_accounts')
    .select('api_key, is_active')
    .eq('region', 'ua')
    .eq('bank_name', 'Monobank')
    .maybeSingle();
  const fromDb = Boolean(account?.is_active && account?.api_key);
  const monoToken = fromDb ? account!.api_key : (process.env.MONOBANK_TOKEN || null);

  const baseUrl = getRuntimeBaseUrl();
  const info: Record<string, any> = {
    token_source: fromDb ? 'bank_accounts (region=ua)' : monoToken ? 'MONOBANK_TOKEN env' : 'НЕМАЄ',
    base_url: baseUrl,
    webhook_url: `${baseUrl}/api/photographers/subscription/webhook`,
    plan_now: effectivePlanId(photographer),
    plan_expires_at: photographer.plan_expires_at || null,
  };
  if (!monoToken) return NextResponse.json({ ...info, error: 'Ключ Monobank не налаштовано' }, { status: 503 });

  // Status of an invoice we already made — the same call the webhook trusts.
  const invoiceId = q.get('invoice');
  if (invoiceId) {
    const status = await monoInvoiceStatus(monoToken, invoiceId);
    const { data: sub } = await admin
      .from('photographer_subscriptions')
      .select('id, plan, amount_uah, status, paid_at, created_at')
      .eq('invoice_id', invoiceId)
      .maybeSingle();
    return NextResponse.json({ ...info, invoice_id: invoiceId, monobank_status: status, subscription: sub || null });
  }

  if (q.get('create') !== '1') {
    const { data: recent } = await admin
      .from('photographer_subscriptions')
      .select('id, plan, amount_uah, status, invoice_id, paid_at, created_at')
      .eq('photographer_id', photographer.id)
      .order('created_at', { ascending: false })
      .limit(5);
    return NextResponse.json({ ...info, recent_subscriptions: recent || [] });
  }

  const plan = GALLERY_PLANS.find(p => p.id === (q.get('plan') || 'start'));
  if (!plan || plan.priceUah <= 0) return NextResponse.json({ ...info, error: 'Оберіть платний тариф' }, { status: 400 });

  const wantsTestPrice = q.get('test') === '1' && TEST_EMAILS.includes(String(photographer.email || '').toLowerCase());
  const amountUah = wantsTestPrice ? 1 : plan.priceUah;

  const { data: sub, error: subErr } = await admin
    .from('photographer_subscriptions')
    .insert({
      photographer_id: photographer.id,
      plan: plan.id,
      amount_uah: amountUah,
      months: 1,
      status: 'pending',
    })
    .select('id')
    .single();
  if (subErr || !sub) return NextResponse.json({ ...info, error: subErr?.message || 'Не вдалося створити рахунок' }, { status: 500 });

  try {
    const invoice = await monoCreateInvoice({
      token: monoToken,
      amountUah,
      reference: sub.id,
      destination: wantsTestPrice
        ? `Тестова оплата тарифу «${plan.name}» — Touch.Memories`
        : `Тариф «${plan.name}» (${plan.storageGb} ГБ) — галереї Touch.Memories, 1 місяць`,
      redirectUrl: `${baseUrl}/uk/photographer/cabinet/${photographer.cabinet_token}?paid=1`,
      webHookUrl: `${baseUrl}/api/photographers/subscription/webhook`,
    });
    await admin
      .from('photographer_subscriptions')
      .update({ invoice_id: invoice.invoiceId, payment_url: invoice.pageUrl })
      .eq('id', sub.id);
    return NextResponse.json({
      ...info,
      created: true,
      plan: plan.id,
      amount_uah: amountUah,
      test_price: wantsTestPrice,
      invoice_id: invoice.invoiceId,
      payment_url: invoice.pageUrl,
      note: 'Відкрийте payment_url і оплатіть. Далі цей самий endpoint з ?invoice=… покаже статус.',
    });
  } catch (e: any) {
    await admin.from('photographer_subscriptions').update({ status: 'failed' }).eq('id', sub.id);
    return NextResponse.json({ ...info, error: e?.message || 'Monobank відмовив у створенні рахунку' }, { status: 502 });
  }
}
