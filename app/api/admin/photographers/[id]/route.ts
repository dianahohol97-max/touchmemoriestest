import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { sendBrevoEmail } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

// Staff-managed fields. Cabinet-editable fields live in /api/photographers/profile.
const STAFF_FIELDS = ['name', 'email', 'slug', 'is_active', 'custom_domain', 'custom_domain_paid', 'landing_enabled'] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const key of STAFF_FIELDS) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Немає полів' }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const admin = getAdminClient();
  const { data, error } = await admin.from('photographers').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ photographer: data });
}

/** POST = send (or resend) the welcome email with the cabinet link. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();
  const { data: p } = await admin.from('photographers').select('*').eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Фотографа не знайдено' }, { status: 404 });

  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
  const cabinetUrl = `${site}/uk/photographer/cabinet/${p.cabinet_token}`;
  const landingUrl = `${site}/uk/photographer/${p.slug}`;

  try {
    await sendBrevoEmail({
      to: p.email,
      toName: p.name,
      subject: 'Ваш кабінет фотографа на Touch.Memories',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
          <h2 style="color:#1e2d7d">Вітаємо, ${p.name}!</h2>
          <p>Для вас створено кабінет фотографа на Touch.Memories. У ньому ви можете:</p>
          <ul>
            <li>створювати галереї та завантажувати фото своїх клієнтів;</li>
            <li>ділитися з клієнтами посиланням на галерею (фото зберігаються 30 днів);</li>
            <li>налаштувати свою сторінку-візитку: логотип, контакти, портфоліо, прайс.</li>
          </ul>
          <p style="margin:24px 0">
            <a href="${cabinetUrl}" style="background:#1e2d7d;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">Відкрити кабінет</a>
          </p>
          <p>Ваша публічна сторінка: <a href="${landingUrl}">${landingUrl}</a></p>
          <p style="color:#6b7280;font-size:13px">Посилання на кабінет — особисте, не передавайте його стороннім.</p>
        </div>`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не вдалося надіслати лист' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
