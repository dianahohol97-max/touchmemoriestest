import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { monoInvoiceStatus } from '@/lib/photographers/payments';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

// A booking whose client started an ONLINE payment (an invoice was created) but
// never completed it within this window is treated as abandoned and the slot is
// freed for others. Manual bookings (no invoice) are never auto-released — the
// photographer manages those (they confirm payment or delete the slot in the
// cabinet), so a genuine "pay by card transfer" booking is never dropped.
const HOLD_HOURS = 2;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  const cutoff = new Date(Date.now() - HOLD_HOURS * 3600_000).toISOString();

  const { data: slots } = await admin
    .from('photographer_slots')
    .select('id, slot_date, slot_time, price, photographer_id, invoice_provider, invoice_id, client_name, client_email')
    .eq('status', 'booked')
    .neq('payment_status', 'paid')
    .not('invoice_id', 'is', null)
    .lt('booked_at', cutoff);

  let released = 0;
  let healed = 0;

  for (const s of slots || []) {
    // Mono: re-verify before releasing. A missed webhook can leave a genuinely
    // paid booking looking unpaid — in that case mark it paid instead of freeing.
    if (s.invoice_provider === 'mono' && s.invoice_id) {
      const { data: p } = await admin
        .from('photographers')
        .select('pay_mono_token')
        .eq('id', s.photographer_id)
        .maybeSingle();
      if (p?.pay_mono_token) {
        const status = await monoInvoiceStatus(p.pay_mono_token, s.invoice_id);
        if (status === 'success') {
          await admin.from('photographer_slots')
            .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', s.id)
            .neq('payment_status', 'paid');
          healed++;
          continue;
        }
      }
    }

    // Release back to a free, bookable slot (guarded so we never free a slot
    // that flipped to paid between the query and now).
    const { data: freed } = await admin
      .from('photographer_slots')
      .update({
        status: 'free',
        client_name: null, client_phone: null, client_email: null, client_comment: null,
        booked_at: null, invoice_provider: null, invoice_id: null,
        payment_status: 'unpaid', payment_claimed_at: null, paid_at: null,
      })
      .eq('id', s.id)
      .eq('status', 'booked')
      .neq('payment_status', 'paid')
      .select('id')
      .maybeSingle();
    if (!freed) continue;
    released++;

    // Let the photographer know a tentative booking expired (best-effort).
    if (getBrevoApiKey()) {
      const { data: ph } = await admin
        .from('photographers')
        .select('name, email')
        .eq('id', s.photographer_id)
        .maybeSingle();
      if (ph?.email) {
        const dateHuman = new Date(`${s.slot_date}T00:00:00`).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
        sendBrevoEmail({
          to: ph.email,
          toName: ph.name,
          subject: `Бронювання скасовано (не оплачено): ${dateHuman}, ${s.slot_time}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
              <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
              <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
                <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 12px">Слот знову вільний</h2>
                <p style="font-size:14px;color:#475569;line-height:1.7;margin:0">
                  Клієнт <b>${s.client_name || '—'}</b> почав онлайн-оплату зйомки
                  <b>${dateHuman}, ${s.slot_time}</b>${s.price ? ` (${s.price})` : ''}, але не завершив її за ${HOLD_HOURS} год.
                  Слот автоматично звільнено — його знову можна забронювати.
                </p>
              </div>
            </div>`,
        }).catch(e => console.error('[slot-release] notify failed:', e));
      }
    }
  }

  return NextResponse.json({ ok: true, scanned: slots?.length || 0, released, healed });
}
