import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { escapeHtml } from '@/lib/email/escape';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Standalone photographer-cabinet signup — NO B2B application, NO moderation.
 * For people who want only the client galleries + the business-card landing
 * (the 10% discount stays behind the separate B2B application). Creates the
 * auth user + customer + photographers row and emails the cabinet link.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const phone = body?.phone ? String(body.phone).trim() : null;

    if (!name || name.length > 200) return NextResponse.json({ error: 'Вкажіть імʼя' }, { status: 400 });
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Невірний email' }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: 'Пароль мінімум 8 символів' }, { status: 400 });

    const admin = getAdminClient();

    // Existing cabinet for this email → just point them at their account.
    const { data: existingPh } = await admin
      .from('photographers')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (existingPh) {
      return NextResponse.json({
        error: 'Кабінет із цією поштою вже існує. Увійдіть в акаунт — посилання на кабінет є у вашому профілі.',
      }, { status: 409 });
    }

    // Auth user (auto-confirmed — no discount is granted here, so it's safe).
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError || !authData?.user) {
      const msg = authError?.message || '';
      if (/already been registered|already exists/i.test(msg)) {
        return NextResponse.json({
          error: 'Акаунт із цією поштою вже існує. Увійдіть — і створіть кабінет одним кліком у своєму профілі.',
        }, { status: 409 });
      }
      return NextResponse.json({ error: msg || 'Не вдалося створити акаунт' }, { status: 400 });
    }
    const userId = authData.user.id;

    const { data: cust } = await admin
      .from('customers')
      .upsert({ id: userId, auth_user_id: userId, email, name, phone }, { onConflict: 'id' })
      .select('id')
      .maybeSingle();
    const customerId = cust?.id ?? userId;

    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/[а-яіїєґ]/gi, '')
      .replace(/^-+|-+$/g, '') || 'photographer';
    const { data: created, error: phError } = await admin
      .from('photographers')
      .insert({
        name, email, phone,
        slug: `${baseSlug}-${String(Date.now()).slice(-5)}`,
        customer_id: customerId,
      })
      .select('cabinet_token, slug')
      .single();
    if (phError || !created) {
      return NextResponse.json({ error: phError?.message || 'Не вдалося створити кабінет' }, { status: 500 });
    }

    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
    const cabinetUrl = `${site}/uk/photographer/cabinet/${created.cabinet_token}`;

    if (getBrevoApiKey()) {
      try {
        await sendBrevoEmail({
          to: email,
          toName: name,
          subject: 'Ваш кабінет фотографа готовий 🎉',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
              <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
              <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                <h2 style="color:#1e2d7d;font-size:22px;margin:0 0 12px">Привіт, ${escapeHtml(name)}!</h2>
                <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 14px">Ваш кабінет фотографа створено: галереї для передачі фото клієнтам (зберігання 30 днів) і сторінка-візитка з портфоліо та прайсом.</p>
                <p style="margin:18px 0 0"><a href="${cabinetUrl}" style="background:#1e2d7d;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Відкрити кабінет</a></p>
                <p style="font-size:13px;color:#94a3b8;margin:14px 0 0">Посилання особисте — не передавайте його стороннім. Ваша публічна сторінка: <a href="${site}/uk/photographer/${created.slug}">${site}/uk/photographer/${created.slug}</a></p>
                <p style="font-size:13px;color:#94a3b8;margin:10px 0 0">Хочете ще й знижку 10% на фотокниги для клієнтських проєктів? Подайте заявку: <a href="${site}/uk/photographers">touchmemories.com.ua/uk/photographers</a></p>
              </div>
            </div>`,
        });
      } catch (e) {
        console.error('[photographers/register] welcome email failed:', e);
      }
    }

    return NextResponse.json({ photographer: { cabinet_token: created.cabinet_token, slug: created.slug } });
  } catch (err: any) {
    console.error('[photographers/register]', err);
    return NextResponse.json({ error: err.message || 'Помилка' }, { status: 500 });
  }
}
