import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { escapeHtml } from '@/lib/email/escape';

export const dynamic = 'force-dynamic';

/**
 * Client-side "Я оплатив(ла)" signal. Payments land directly in the
 * photographer's own bank (jar / WayForPay / card transfer), so the platform
 * can never SEE the money — this marks the booking payment_status='claimed'
 * and emails the photographer, who then verifies against their bank and
 * flips it to 'paid' in the cabinet. Slot id is the capability the client
 * received when booking.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slotId = String(body?.slot_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(slotId)) return NextResponse.json({ error: 'Невірний слот' }, { status: 400 });

  const admin = getAdminClient();
  const { data: slot, error } = await admin
    .from('photographer_slots')
    .update({ payment_status: 'claimed', payment_claimed_at: new Date().toISOString() })
    .eq('id', slotId)
    .eq('status', 'booked')
    .eq('payment_status', 'unpaid')
    .select('id, slot_date, slot_time, client_name, client_phone, price, photographer_id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!slot) return NextResponse.json({ success: true }); // already claimed/paid — idempotent for the client

  const { data: p } = await admin
    .from('photographers')
    .select('name, email')
    .eq('id', slot.photographer_id)
    .maybeSingle();

  if (p?.email && getBrevoApiKey()) {
    const dateHuman = new Date(`${slot.slot_date}T00:00:00`).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
    sendBrevoEmail({
      to: p.email,
      toName: p.name,
      subject: `Клієнт повідомив про оплату: ${dateHuman}, ${slot.slot_time}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
          <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
            <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 12px">💳 Клієнт повідомив про оплату</h2>
            <p style="font-size:14px;color:#475569;line-height:1.7;margin:0">
              <b>${escapeHtml(slot.client_name)}</b> (${escapeHtml(slot.client_phone)}) повідомляє, що оплатив(ла) зйомку
              <b>${dateHuman}, ${slot.slot_time}</b>${slot.price ? ` — ${slot.price}` : ''}.
            </p>
            <p style="font-size:13px;color:#64748b;margin:16px 0 0">Перевірте надходження у своєму банку та позначте бронювання «Оплачено» в кабінеті.</p>
          </div>
        </div>`,
    }).catch(e => console.error('[booking/claim] email failed:', e));
  }

  return NextResponse.json({ success: true });
}
