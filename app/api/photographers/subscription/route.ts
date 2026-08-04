import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRuntimeBaseUrl } from '@/lib/runtimeUrl';
import { getPhotographerByToken } from '@/lib/photographers/helpers';
import { getPlan, effectivePlanId, GALLERY_PLANS } from '@/lib/photographers/plans';
import { getStorageUsage } from '@/lib/photographers/usage';
import { monoCreateInvoice } from '@/lib/photographers/payments';

export const dynamic = 'force-dynamic';

/**
 * Storage-plan subscriptions for photographers.
 *
 * GET  → current plan, storage usage and the plan catalogue (drives the
 *        cabinet's usage bar and the upgrade dialog).
 * POST → create a Monobank invoice for the chosen plan and return its
 *        pageUrl. Money goes to the PLATFORM account (unlike shoot bookings,
 *        which use the photographer's own credentials), so the token comes
 *        from the same place as shop orders: the 'ua' bank_accounts row, with
 *        MONOBANK_TOKEN as fallback.
 *
 * The plan is granted by the webhook, never here — an unpaid invoice must not
 * unlock storage.
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

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const photographer = await getPhotographerByToken(token);
  if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const usage = await getStorageUsage(photographer);
  return NextResponse.json({
    usage,
    plan: {
      id: effectivePlanId(photographer),
      stored: photographer.plan || 'free',
      expires_at: photographer.plan_expires_at || null,
    },
    plans: GALLERY_PLANS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const photographer = await getPhotographerByToken(String(body?.token || ''));
    if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

    const planId = String(body?.plan || '');
    const plan = GALLERY_PLANS.find(p => p.id === planId);
    if (!plan || plan.priceUah <= 0) {
      return NextResponse.json({ error: 'Оберіть платний тариф' }, { status: 400 });
    }

    const monoToken = await platformMonoToken();
    if (!monoToken) {
      return NextResponse.json({ error: 'Оплата тимчасово недоступна — не налаштовано ключ Monobank.' }, { status: 503 });
    }

    const admin = getAdminClient();
    const { data: sub, error: subErr } = await admin
      .from('photographer_subscriptions')
      .insert({
        photographer_id: photographer.id,
        plan: plan.id,
        amount_uah: plan.priceUah,
        months: 1,
        status: 'pending',
      })
      .select('id')
      .single();
    if (subErr || !sub) return NextResponse.json({ error: subErr?.message || 'Не вдалося створити рахунок' }, { status: 500 });

    const baseUrl = getRuntimeBaseUrl();
    try {
      const invoice = await monoCreateInvoice({
        token: monoToken,
        amountUah: plan.priceUah,
        // The reference is the subscription row id — the webhook looks it up
        // by invoiceId, but keeping the reference makes support traceable.
        reference: sub.id,
        destination: `Тариф «${plan.name}» (${plan.storageGb} ГБ) — галереї Touch.Memories, 1 місяць`,
        redirectUrl: `${baseUrl}/uk/photographer/cabinet/${photographer.cabinet_token}?paid=1`,
        webHookUrl: `${baseUrl}/api/photographers/subscription/webhook`,
      });
      await admin
        .from('photographer_subscriptions')
        .update({ invoice_id: invoice.invoiceId, payment_url: invoice.pageUrl })
        .eq('id', sub.id);
      return NextResponse.json({ ok: true, payment_url: invoice.pageUrl });
    } catch (e: any) {
      await admin.from('photographer_subscriptions').update({ status: 'failed' }).eq('id', sub.id);
      return NextResponse.json({ error: e?.message || 'Не вдалося створити рахунок' }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });
  }
}
