import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Security check
    if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) return NextResponse.json({ error: 'No Brevo key' }, { status: 500 });

    // Find active certs expiring in 6-8 days (window to catch the ~7d mark)
    const now = new Date();
    const in6 = new Date(now); in6.setDate(in6.getDate() + 6);
    const in8 = new Date(now); in8.setDate(in8.getDate() + 8);

    const { data: certs, error } = await supabase
        .from('gift_certificates')
        .select('id, code, amount, recipient_name, recipient_email, expires_at, reminder_7d_sent')
        .eq('status', 'active')
        .eq('reminder_7d_sent', false)
        .gte('expires_at', in6.toISOString())
        .lte('expires_at', in8.toISOString())
        .not('recipient_email', 'is', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!certs?.length) return NextResponse.json({ sent: 0, message: 'No certs to remind' });

    let sent = 0;
    for (const cert of certs) {
        const expiryStr = new Date(cert.expires_at).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
        const daysLeft = Math.ceil((new Date(cert.expires_at).getTime() - Date.now()) / 86400000);

        const html = `
<div style="font-family:'Montserrat',sans-serif;max-width:540px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center">
    <p style="color:white;font-size:40px;margin:0">⏰</p>
    <h2 style="color:white;margin:8px 0 0;font-size:20px;font-weight:900">Ваш сертифікат закінчується!</h2>
  </div>
  <div style="padding:32px">
    ${cert.recipient_name ? `<p style="font-size:16px;font-weight:700;color:#374151;margin:0 0 16px">Привіт, ${cert.recipient_name}!</p>` : ''}
    <p style="color:#64748b;margin:0 0 24px;line-height:1.6">
      Нагадуємо, що ваш подарунковий сертифікат <strong>Touch.Memories</strong> закінчується через <strong style="color:#f59e0b">${daysLeft} ${daysLeft === 7 ? 'днів' : 'дні'}</strong>.
    </p>
    <div style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase">Код сертифікату</p>
      <p style="font-size:28px;font-weight:900;color:#92400e;letter-spacing:0.15em;margin:8px 0">${cert.code}</p>
      <p style="font-size:24px;font-weight:800;color:#d97706;margin:0">${cert.amount} грн</p>
      <p style="margin:8px 0 0;font-size:13px;color:#92400e">Дійсний до: ${expiryStr}</p>
    </div>
    <a href="https://touchmemories.com.ua" style="display:block;text-align:center;padding:16px;background:#263A99;color:white;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
      Використати зараз →
    </a>
  </div>
</div>`;

        const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: { name: 'Touch.Memories', email: 'hello@touchmemories.com.ua' },
                to: [{ email: cert.recipient_email, name: cert.recipient_name || '' }],
                subject: `⏰ Ваш сертифікат Touch.Memories закінчується через ${daysLeft} днів`,
                htmlContent: html
            })
        });

        if (emailRes.ok) {
            await supabase.from('gift_certificates')
                .update({ reminder_7d_sent: true, reminder_sent_at: new Date().toISOString() })
                .eq('id', cert.id);
            sent++;
        }
    }

    return NextResponse.json({ sent, total: certs.length });
}
