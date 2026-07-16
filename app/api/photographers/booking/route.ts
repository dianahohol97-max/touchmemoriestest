import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

/**
 * Public booking of a photographer's time slot from the landing page.
 * Body: { slot_id, name, phone, email?, comment? }
 *
 * The slot is claimed with a conditional UPDATE (status='free' → 'booked'),
 * so two simultaneous clients can't book the same time. Payments go straight
 * to the photographer (their Mono jar / WayForPay link / manual requisites),
 * so the response returns whichever methods the photographer enabled and the
 * page shows them on the success screen — booking is not gated on payment,
 * the photographer confirms it themselves.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slotId = String(body?.slot_id || '');
  const name = String(body?.name || '').trim();
  const phone = String(body?.phone || '').trim();
  const email = String(body?.email || '').trim();
  const comment = String(body?.comment || '').trim();

  if (!/^[0-9a-f-]{36}$/i.test(slotId)) return NextResponse.json({ error: 'Невірний слот' }, { status: 400 });
  if (!name || name.length > 120) return NextResponse.json({ error: "Вкажіть ім'я" }, { status: 400 });
  if (!phone || phone.replace(/\D/g, '').length < 9) return NextResponse.json({ error: 'Вкажіть коректний телефон' }, { status: 400 });
  // Full contact details are mandatory for a booking — the photographer must
  // be able to reach the client by phone AND email.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Вкажіть коректний email' }, { status: 400 });

  const admin = getAdminClient();

  // Race-safe claim: only one caller can flip free → booked.
  const { data: booked, error } = await admin
    .from('photographer_slots')
    .update({
      status: 'booked',
      client_name: name,
      client_phone: phone,
      client_email: email,
      client_comment: comment || null,
      booked_at: new Date().toISOString(),
    })
    .eq('id', slotId)
    .eq('status', 'free')
    .select('id, slot_date, slot_time, duration_min, price, photographer_id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!booked) return NextResponse.json({ error: 'На жаль, цей час щойно зайняли. Оберіть інший слот.' }, { status: 409 });

  const { data: p } = await admin
    .from('photographers')
    .select('name, email, phone, pay_mono_enabled, pay_mono_link, pay_mono_token, pay_wfp_enabled, pay_wfp_link, pay_wfp_account, pay_wfp_secret, pay_requisites_enabled, pay_requisites')
    .eq('id', booked.photographer_id)
    .maybeSingle();

  // Only enabled AND filled methods reach the client. When the photographer
  // stored their own merchant credentials, the client gets the AUTO flow
  // (invoice via /booking/pay + provider webhook flips the status) instead
  // of a static link. Credentials themselves never leave the server.
  const monoAuto = !!(p?.pay_mono_enabled && p?.pay_mono_token);
  const wfpAuto = !!(p?.pay_wfp_enabled && p?.pay_wfp_account && p?.pay_wfp_secret);
  const payment = {
    mono_auto: monoAuto,
    wfp_auto: wfpAuto,
    mono_link: !monoAuto && p?.pay_mono_enabled && p?.pay_mono_link ? p.pay_mono_link : null,
    wfp_link: !wfpAuto && p?.pay_wfp_enabled && p?.pay_wfp_link ? p.pay_wfp_link : null,
    requisites: p?.pay_requisites_enabled && p?.pay_requisites ? p.pay_requisites : null,
  };

  // Notify the photographer (best-effort — the booking must not fail on mail).
  if (p?.email && getBrevoApiKey()) {
    const dateHuman = new Date(`${booked.slot_date}T00:00:00`).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
    sendBrevoEmail({
      to: p.email,
      toName: p.name,
      subject: `Нове бронювання: ${dateHuman}, ${booked.slot_time}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
          <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
            <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 16px">Нове бронювання зйомки</h2>
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#6b7280;width:120px">Дата:</td><td style="padding:6px 0;font-weight:700">${dateHuman}, ${booked.slot_time} (${booked.duration_min} хв)</td></tr>
              ${booked.price ? `<tr><td style="padding:6px 0;color:#6b7280">Вартість:</td><td style="padding:6px 0;font-weight:700">${booked.price}</td></tr>` : ''}
              <tr><td style="padding:6px 0;color:#6b7280">Клієнт:</td><td style="padding:6px 0;font-weight:600">${name}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Телефон:</td><td style="padding:6px 0"><a href="tel:${phone}">${phone}</a></td></tr>
              ${email ? `<tr><td style="padding:6px 0;color:#6b7280">Email:</td><td style="padding:6px 0">${email}</td></tr>` : ''}
              ${comment ? `<tr><td style="padding:6px 0;color:#6b7280">Коментар:</td><td style="padding:6px 0">${comment}</td></tr>` : ''}
            </table>
            <p style="font-size:13px;color:#64748b;margin:18px 0 0">Клієнту показано ваші способи оплати. Зв'яжіться з клієнтом для підтвердження.</p>
          </div>
        </div>`,
    }).catch(e => console.error('[booking] notify email failed:', e));
  }

  return NextResponse.json({
    success: true,
    slot: { date: booked.slot_date, time: booked.slot_time, duration_min: booked.duration_min, price: booked.price },
    photographer_name: p?.name || '',
    payment,
  });
}
