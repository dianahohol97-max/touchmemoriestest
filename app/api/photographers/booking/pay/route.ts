import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getBaseUrl } from '@/lib/seo/locales';
import { monoCreateInvoice, wfpCreateInvoice, parsePriceUah } from '@/lib/photographers/payments';

export const dynamic = 'force-dynamic';

/**
 * Create a payment invoice for a booked slot USING THE PHOTOGRAPHER'S OWN
 * merchant credentials (Monobank acquiring token or WayForPay account) —
 * money goes straight to them; the provider's webhook marks the slot paid.
 * Public: the slot id is the capability the client received when booking.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slotId = String(body?.slot_id || '');
  const provider = String(body?.provider || '');
  if (!/^[0-9a-f-]{36}$/i.test(slotId)) return NextResponse.json({ error: 'Невірний слот' }, { status: 400 });
  if (!['mono', 'wfp'].includes(provider)) return NextResponse.json({ error: 'Невідомий спосіб оплати' }, { status: 400 });

  const admin = getAdminClient();
  const { data: slot } = await admin
    .from('photographer_slots')
    .select('id, slot_date, slot_time, price, status, payment_status, photographer_id')
    .eq('id', slotId)
    .eq('status', 'booked')
    .maybeSingle();
  if (!slot) return NextResponse.json({ error: 'Бронювання не знайдено' }, { status: 404 });
  if (slot.payment_status === 'paid') return NextResponse.json({ error: 'Уже оплачено' }, { status: 409 });

  const amount = parsePriceUah(slot.price);
  if (!amount) return NextResponse.json({ error: 'Для цього слота не вказано ціну — звʼяжіться з фотографом' }, { status: 400 });

  const { data: p } = await admin
    .from('photographers')
    .select('name, slug, pay_mono_enabled, pay_mono_token, pay_wfp_enabled, pay_wfp_account, pay_wfp_secret')
    .eq('id', slot.photographer_id)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: 'Фотографа не знайдено' }, { status: 404 });

  const site = getBaseUrl();
  const returnUrl = `${site}/uk/photographer/${p.slug}`;
  const destination = `Фотозйомка ${slot.slot_date} ${slot.slot_time} — ${p.name}`;

  try {
    if (provider === 'mono') {
      if (!p.pay_mono_enabled || !p.pay_mono_token) {
        return NextResponse.json({ error: 'Автооплата Monobank не налаштована' }, { status: 400 });
      }
      const { invoiceId, pageUrl } = await monoCreateInvoice({
        token: p.pay_mono_token,
        amountUah: amount,
        reference: slot.id,
        destination,
        redirectUrl: returnUrl,
        webHookUrl: `${site}/api/photographers/booking/webhook/mono`,
      });
      await admin.from('photographer_slots')
        .update({ invoice_provider: 'mono', invoice_id: invoiceId })
        .eq('id', slot.id);
      return NextResponse.json({ url: pageUrl });
    }

    if (!p.pay_wfp_enabled || !p.pay_wfp_account || !p.pay_wfp_secret) {
      return NextResponse.json({ error: 'Автооплата WayForPay не налаштована' }, { status: 400 });
    }
    // WFP orderReference must be unique per invoice attempt.
    const reference = `slot-${slot.id}-${Date.now()}`;
    const { invoiceUrl } = await wfpCreateInvoice({
      merchantAccount: p.pay_wfp_account,
      merchantSecret: p.pay_wfp_secret,
      domain: site.replace(/^https?:\/\//, ''),
      amountUah: amount,
      reference,
      productName: destination,
      serviceUrl: `${site}/api/photographers/booking/webhook/wfp`,
      returnUrl,
    });
    await admin.from('photographer_slots')
      .update({ invoice_provider: 'wfp', invoice_id: reference })
      .eq('id', slot.id);
    return NextResponse.json({ url: invoiceUrl });
  } catch (e: any) {
    console.error('[booking/pay] invoice failed:', e);
    return NextResponse.json({ error: e?.message || 'Не вдалося створити рахунок' }, { status: 502 });
  }
}
