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

// Що взагалі можна надіслати клієнту: макет на погодження (PDF або
// зображення) і нічого виконуваного.
const ALLOWED_ATTACHMENT_CT = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
]);
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;   // на один файл
// Brevo відмовляє на листі понад 10 МБ разом із вкладеннями. Тримаємось нижче
// із запасом на base64 (він додає близько третини) і на сам текст листа: усе,
// що не влізло, їде посиланням, а не втрачається.
const MAX_INLINE_TOTAL_BYTES = 6 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // місяць на погодження макета

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'order id required' }, { status: 400 });

  // Лист із файлами приходить як multipart, без файлів — як JSON. Приймаємо
  // обидва, щоб старі виклики продовжували працювати без змін.
  let subject = '';
  let text = '';
  let files: File[] = [];
  // Файли, які браузер уже поклав у сховище сам і передав лише шляхами.
  let preUploaded: { path: string; name: string }[] = [];
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
    subject = String(form.get('subject') || '').trim();
    text = String(form.get('body') || '').trim();
    files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  } else {
    const body = await req.json().catch(() => null);
    subject = String(body?.subject || '').trim();
    text = String(body?.body || '').trim();
    if (Array.isArray(body?.attachments)) {
      preUploaded = body.attachments
        .filter((a: any) => a && typeof a.path === 'string')
        .map((a: any) => ({ path: String(a.path), name: String(a.name || '').trim() || 'file' }))
        .slice(0, 10);
    }
  }

  // Шлях приходить від клієнта, тож звужуємо його до теки, яку видає
  // /api/admin/storage-upload-url. Інакше staff-запит міг би націлити лист на
  // будь-який обʼєкт у бакеті замовлень і надіслати його клієнту.
  for (const a of preUploaded) {
    if (!/^admin-letters\/[A-Za-z0-9._-]+$/.test(a.path)) {
      return NextResponse.json({ error: `${a.name}: недопустимий шлях вкладення` }, { status: 400 });
    }
  }

  if (!subject || !text) {
    return NextResponse.json({ error: 'subject and body required' }, { status: 400 });
  }
  if (subject.length > 300 || text.length > 20000) {
    return NextResponse.json({ error: 'subject or body too long' }, { status: 400 });
  }
  if (files.length + preUploaded.length > 10) {
    return NextResponse.json({ error: 'не більше 10 файлів за раз' }, { status: 400 });
  }
  for (const f of files) {
    if (!ALLOWED_ATTACHMENT_CT.has((f.type || '').toLowerCase())) {
      return NextResponse.json({ error: `${f.name}: можна надсилати лише PDF та зображення` }, { status: 400 });
    }
    if (f.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: `${f.name}: файл більший за 25 МБ` }, { status: 413 });
    }
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

  // Файли спершу лягають у сховище, і аж потім їдуть листом. Порядок саме
  // такий, бо посилання переживе поштову скриньку: клієнтка зможе відкрити
  // макет із телефона, переслати чоловікові, повернутися до нього через
  // тиждень — і нам не доведеться шукати, що саме ми надсилали.
  const uploaded: { name: string; url: string; size: number; path: string }[] = [];
  const inline: { name: string; content: string }[] = [];
  let inlineBytes = 0;

  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: `${f.name}: файл порожній` }, { status: 400 });
    }
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
    const path = `admin-letters/${order.id}/${Date.now()}_${safeName}`;
    const { error: upErr } = await admin.storage
      .from('order-files')
      .upload(path, buf, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (upErr) {
      console.error('[order-emails] attachment upload failed', { orderId: id, path, error: upErr.message });
      return NextResponse.json({ error: `Не вдалося зберегти ${f.name}: ${upErr.message}` }, { status: 502 });
    }
    const { data: signed } = await admin.storage
      .from('order-files')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    uploaded.push({ name: f.name, url: signed?.signedUrl || '', size: buf.length, path });

    // Вкладенням — лише те, що поміститься в лист. Решта лишається
    // посиланням: краще великий макет, який доїхав, ніж лист, який Brevo
    // відхилив цілком через розмір.
    if (inlineBytes + buf.length <= MAX_INLINE_TOTAL_BYTES) {
      inline.push({ name: f.name, content: buf.toString('base64') });
      inlineBytes += buf.length;
    }
  }

  // Файли, завантажені браузером напряму у сховище. Вони не проходили через
  // цей запит, тому обмеження Vercel на розмір тіла їх не стосується — саме
  // тому макет на 35 МБ тепер доїжджає. Байти читаємо зі сховища лише щоб
  // вирішити, чи поміщається файл вкладенням; завеликі лишаються посиланням і
  // не завантажуються сюди взагалі.
  for (const a of preUploaded) {
    const { data: signed } = await admin.storage
      .from('order-files')
      .createSignedUrl(a.path, SIGNED_URL_TTL_SECONDS);
    if (!signed?.signedUrl) {
      return NextResponse.json({ error: `${a.name}: файл не знайдено у сховищі` }, { status: 404 });
    }

    let size = 0;
    let buf: Buffer | null = null;
    if (inlineBytes < MAX_INLINE_TOTAL_BYTES) {
      const { data: blob } = await admin.storage.from('order-files').download(a.path);
      if (blob) {
        buf = Buffer.from(await blob.arrayBuffer());
        size = buf.length;
      }
    }
    if (!size) {
      // Не читали або не прочитали — розмір беремо з метаданих сховища.
      const folder = a.path.slice(0, a.path.lastIndexOf('/'));
      const base = a.path.slice(a.path.lastIndexOf('/') + 1);
      const { data: listed } = await admin.storage.from('order-files').list(folder, { search: base, limit: 1 });
      size = Number(listed?.[0]?.metadata?.size) || 0;
    }

    uploaded.push({ name: a.name, url: signed.signedUrl, size, path: a.path });

    if (buf && inlineBytes + buf.length <= MAX_INLINE_TOTAL_BYTES) {
      inline.push({ name: a.name, content: buf.toString('base64') });
      inlineBytes += buf.length;
    }
  }

  const linkOnly = uploaded.filter(u => !inline.some(i => i.name === u.name));
  const fmtSize = (n: number) => n >= 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(n / 1024))} КБ`;

  const filesBlock = uploaded.length
    ? `<div style="margin-top: 22px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
         <div style="font-size: 14px; font-weight: 700; color: #1e2d7d; margin-bottom: 10px;">
           ${uploaded.length === 1 ? 'Файл до листа' : 'Файли до листа'}
         </div>
         ${uploaded.map(u => `
           <div style="margin-bottom: 8px; font-size: 14px;">
             <a href="${escapeHtml(u.url)}" style="color: #1e2d7d; font-weight: 600;">${escapeHtml(u.name)}</a>
             <span style="color: #94a3b8; font-size: 12px;"> — ${fmtSize(u.size)}</span>
           </div>`).join('')}
         <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
           ${linkOnly.length
             ? 'Великі файли не вкладаються в лист, тож відкривайте їх за посиланням вище. Воно працює місяць.'
             : 'Файли також додані вкладенням до цього листа, а посилання діють місяць.'}
         </div>
       </div>`
    : '';

  // Plain letter in the site's tone: greeting with the customer's name, the
  // staff text with line breaks preserved, order number in the footer.
  const safeText = escapeHtml(text).replace(/\n/g, '<br/>');
  const safeName = escapeHtml(String(order.customer_name || '').trim());
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #1f2937; max-width: 640px;">
      ${safeName ? `<p>Вітаємо, ${safeName}!</p>` : ''}
      <p>${safeText}</p>
      ${filesBlock}
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
    ...(inline.length ? { attachments: inline } : {}),
  });

  // Log the attempt either way — a failed send with its error is exactly the
  // kind of thing the history must show instead of silently losing.
  // В email_logs немає окремої колонки під вкладення, а заводити її заради
  // переліку імен зайве — дописуємо їх у кінець збереженого тексту, щоб
  // історія в адмінці показувала, який саме макет пішов клієнту і коли.
  const loggedBody = uploaded.length
    ? `${text}\n\n— Файли: ${uploaded.map(u => `${u.name} (${fmtSize(u.size)})`).join(', ')}`
    : text;

  const { error: logErr } = await admin.from('email_logs').insert({
    order_id: order.id,
    customer_email: order.customer_email,
    template: 'manual',
    subject,
    body: loggedBody,
    status: sendErr ? 'failed' : 'sent',
    error: sendErr ? String((sendErr as any)?.message || sendErr) : null,
    sent_at: new Date().toISOString(),
  });
  if (logErr) console.error('[order-emails] log insert failed', { orderId: id, error: logErr.message });

  if (sendErr) {
    return NextResponse.json({ error: `Не вдалося надіслати: ${String((sendErr as any)?.message || sendErr)}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, attached: inline.length, linked: linkOnly.length });
}
