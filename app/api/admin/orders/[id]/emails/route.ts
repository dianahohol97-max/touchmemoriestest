import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { getResendClient } from '@/lib/email/resend';
import { escapeHtml } from '@/lib/email/escape';

export const dynamic = 'force-dynamic';

/**
 * Per-order email correspondence (Diana, 2026-08-07).
 *
 * GET  — the full history of everything the system has ever emailed the
 *        customer about this order, merged from the two log tables that
 *        already exist: email_logs (payment confirmations, cron mailings,
 *        manual letters) and notification_log (status-change notifications).
 * POST — send a manual letter to the order's customer right from the admin
 *        order page, so the dialogue lives on email instead of a personal
 *        phone/Viber. The letter is logged into email_logs WITH its text, so
 *        the history shows what exactly was written.
 *
 * Staff-gated (same as the rest of the order card); sending uses the Brevo
 * transport every other email on the site goes through.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'order id required' }, { status: 400 });

  const admin = getAdminClient();
  const [emailsRes, notifsRes] = await Promise.all([
    admin.from('email_logs')
      .select('id, customer_email, template, subject, body, status, error, sent_at')
      .eq('order_id', id)
      .order('sent_at', { ascending: false })
      .limit(100),
    admin.from('notification_log')
      .select('id, customer_email, old_status, new_status, sent_at')
      .eq('order_id', id)
      .order('sent_at', { ascending: false })
      .limit(100),
  ]);

  const items = [
    ...((emailsRes.data || []) as any[]).map((e) => ({
      id: `e-${e.id}`,
      kind: e.template === 'manual' ? 'manual' : 'auto',
      label: e.template === 'manual' ? 'Лист від магазину' : `Автоматичний лист (${e.template || 'розсилка'})`,
      to: e.customer_email,
      subject: e.subject,
      body: e.body || null,
      status: e.status,
      error: e.error || null,
      sent_at: e.sent_at,
    })),
    ...((notifsRes.data || []) as any[]).map((n) => ({
      id: `n-${n.id}`,
      kind: 'status',
      label: `Сповіщення про статус: ${n.old_status || '—'} → ${n.new_status}`,
      to: n.customer_email,
      subject: null,
      body: null,
      status: 'sent',
      error: null,
      sent_at: n.sent_at,
    })),
  ].sort((a, b) => String(b.sent_at || '').localeCompare(String(a.sent_at || '')));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'order id required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const subject = String(body?.subject || '').trim();
  const text = String(body?.body || '').trim();
  if (!subject || !text) {
    return NextResponse.json({ error: 'subject and body required' }, { status: 400 });
  }
  if (subject.length > 300 || text.length > 20000) {
    return NextResponse.json({ error: 'subject or body too long' }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, customer_name, customer_email')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 });
  if (!order.customer_email) {
    return NextResponse.json({ error: 'у замовлення немає email клієнта' }, { status: 400 });
  }

  // Plain letter in the site's tone: greeting with the customer's name, the
  // staff text with line breaks preserved, order number in the footer.
  const safeText = escapeHtml(text).replace(/\n/g, '<br/>');
  const safeName = escapeHtml(String(order.customer_name || '').trim());
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #1f2937; max-width: 640px;">
      ${safeName ? `<p>Вітаємо, ${safeName}!</p>` : ''}
      <p>${safeText}</p>
      <p style="margin-top: 28px; color: #6b7280; font-size: 13px;">
        Це лист щодо вашого замовлення ${escapeHtml(String(order.order_number || ''))} у touch.memories.
        Просто відповідайте на нього — ми читаємо відповіді.
      </p>
    </div>`;

  const resend = getResendClient();
  const { error: sendErr } = await resend.emails.send({
    to: order.customer_email,
    subject,
    html,
  });

  // Log the attempt either way — a failed send with its error is exactly the
  // kind of thing the history must show instead of silently losing.
  const { error: logErr } = await admin.from('email_logs').insert({
    order_id: order.id,
    customer_email: order.customer_email,
    template: 'manual',
    subject,
    body: text,
    status: sendErr ? 'failed' : 'sent',
    error: sendErr ? String((sendErr as any)?.message || sendErr) : null,
    sent_at: new Date().toISOString(),
  });
  if (logErr) console.error('[order-emails] log insert failed', { orderId: id, error: logErr.message });

  if (sendErr) {
    return NextResponse.json({ error: `Не вдалося надіслати: ${String((sendErr as any)?.message || sendErr)}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
