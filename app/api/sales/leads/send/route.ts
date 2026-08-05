import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getManagerByToken } from '@/lib/sales/commission';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { buildOfferEmail, type LeadBusinessType } from '@/lib/leads/offers';

export const dynamic = 'force-dynamic';

const FROM_EMAIL = 'hello@touchmemories.com.ua';
const FROM_NAME = 'Touch.Memories';

/**
 * Send the partner offer to one of the manager's own leads, or a custom
 * message. Mirrors the admin route, with the cabinet token as auth and the
 * ownership check on top — a manager can only write to their own leads.
 *
 * Every message is logged to lead_messages, so the thread in the cabinet shows
 * exactly what the client received, and replies arriving through the inbound
 * webhook land in the same thread.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, String(body?.token || ''));
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const { data: lead } = await admin
    .from('leads').select('*').eq('id', String(body?.lead_id || '')).maybeSingle();
  if (!lead || lead.sales_manager_id !== manager.id) {
    return NextResponse.json({ error: 'Ліда не знайдено' }, { status: 404 });
  }
  if (!lead.email) return NextResponse.json({ error: 'У ліда немає email' }, { status: 400 });

  const mode = body?.mode === 'custom' ? 'custom' : 'offer';
  let subject: string;
  let html: string;
  let textBody: string;

  if (mode === 'offer') {
    const offer = buildOfferEmail((lead.business_type as LeadBusinessType) || 'other', lead.contact_name || '');
    subject = offer.subject;
    html = offer.html;
    textBody = offer.text;
  } else {
    subject = String(body?.subject || '').trim().slice(0, 200);
    const raw = String(body?.body || '').trim();
    if (!subject || !raw) return NextResponse.json({ error: 'Вкажіть тему і текст листа' }, { status: 400 });
    textBody = raw.slice(0, 10000);
    const paragraphs = textBody.split('\n\n').map(p => p.replace(/\n/g, '<br>'))
      .join('</p><p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#374151">');
    html = `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto">
        <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
        <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#374151">${paragraphs}</p>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Touch.Memories · touchmemories.com.ua</p>
        </div>
      </div>`;
  }

  let messageId: string | null = null;
  try {
    const result = await sendBrevoEmail({
      to: lead.email,
      toName: lead.contact_name || lead.business_name,
      subject, html, fromName: FROM_NAME, fromEmail: FROM_EMAIL,
    });
    messageId = result?.messageId || null;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не вдалося надіслати лист' }, { status: 502 });
  }

  await admin.from('lead_messages').insert({
    lead_id: lead.id, direction: 'out', channel: 'email',
    subject, body: textBody, from_email: FROM_EMAIL, to_email: lead.email,
    message_id: messageId,
    meta: { sent_by_manager: manager.id, manager_name: manager.name },
  });

  await admin.from('leads').update({
    status: lead.status === 'new' ? 'contacted' : lead.status,
    offer_sent_at: lead.offer_sent_at || (mode === 'offer' ? new Date().toISOString() : lead.offer_sent_at),
    updated_at: new Date().toISOString(),
  }).eq('id', lead.id);

  return NextResponse.json({ ok: true });
}

/** GET ?token=…&lead_id=… — the message thread of an own lead. */
export async function GET(req: NextRequest) {
  const admin = getAdminClient();
  const manager = await getManagerByToken(admin, req.nextUrl.searchParams.get('token') || '');
  if (!manager) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

  const leadId = req.nextUrl.searchParams.get('lead_id') || '';
  const { data: lead } = await admin
    .from('leads').select('id, sales_manager_id').eq('id', leadId).maybeSingle();
  if (!lead || lead.sales_manager_id !== manager.id) {
    return NextResponse.json({ error: 'Ліда не знайдено' }, { status: 404 });
  }

  const { data: messages } = await admin
    .from('lead_messages')
    .select('id, direction, subject, body, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });
  return NextResponse.json({ messages: messages || [] });
}
