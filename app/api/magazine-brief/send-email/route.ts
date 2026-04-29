import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

const supabase = getAdminClient();

export async function POST(request: NextRequest) {
  // Internal endpoint: called from cron and admin UI. Either cron secret or
  // admin auth is required so a stranger can't spam customers via this route.
  const cronSecret = request.headers.get('x-cron-secret');
  const cronOk = !!process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;
  if (!cronOk) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
  }

  try {
    const { briefId, customerEmail, customerName, subjectName } = await request.json();
    if (!customerEmail || !briefId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';
    const reviewUrl = `${siteUrl}/uk/account/magazine-text/${briefId}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #222;">
  <div style="text-align: center; margin-bottom: 40px;">
    <img src="https://touchmemories1.vercel.app/logo.png" alt="Touch.Memories" style="height: 40px;" onerror="this.style.display='none'">
  </div>
  
  <h2 style="font-size: 28px; font-weight: 400; letter-spacing: 0.05em; color: #1a1a1a; margin-bottom: 8px;">
    Ваш текст готовий
  </h2>
  <p style="color: #888; font-size: 14px; margin-bottom: 32px; letter-spacing: 0.1em; text-transform: uppercase;">
    Глянцевий журнал для ${subjectName || 'вашої близької людини'}
  </p>

  <p style="font-size: 16px; line-height: 1.8; color: #333;">
    ${customerName ? `${customerName}, м` : 'М'}и підготували текст для вашого журналу. 
    Він написаний спеціально для вас — з деталями, які ви нам довірили.
  </p>
  
  <p style="font-size: 16px; line-height: 1.8; color: #333;">
    Перегляньте кожну сторінку, відредагуйте якщо потрібно, і натисніть "Підтвердити" — 
    текст автоматично додасться у ваш журнал.
  </p>

  <div style="text-align: center; margin: 40px 0;">
    <a href="${reviewUrl}" style="display: inline-block; background: #1e2d7d; color: #fff; text-decoration: none; padding: 16px 40px; border-radius: 4px; font-size: 15px; letter-spacing: 0.08em;">
      Переглянути текст
    </a>
  </div>

  <p style="font-size: 13px; color: #aaa; line-height: 1.6;">
    Якщо текст вам не підходить — ви можете редагувати кожну сторінку прямо на сайті 
    або написати нам і ми все переробимо.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
  <p style="font-size: 12px; color: #bbb; text-align: center;">
    Touch.Memories · Тернопіль · touch.memories3@gmail.com
  </p>
</body>
</html>`;

    // Send via Brevo
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY || '',
      },
      body: JSON.stringify({
        sender: { name: 'Touch.Memories', email: 'noreply@touchmemories.ua' },
        to: [{ email: customerEmail, name: customerName || customerEmail }],
        subject: `✨ Текст для вашого журналу готовий — Touch.Memories`,
        htmlContent,
      }),
    });

    if (!brevoRes.ok) {
      const err = await brevoRes.text();
      console.error('[send-email] Brevo error:', err);
      return NextResponse.json({ error: 'Email failed', details: err }, { status: 500 });
    }

    // Mark email sent
    await supabase.from('magazine_briefs').update({ updated_at: new Date().toISOString() }).eq('id', briefId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
