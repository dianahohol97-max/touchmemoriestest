import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { sendBrevoEmail } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

// Staff-managed fields. Cabinet-editable fields live in /api/photographers/profile.
const STAFF_FIELDS = ['name', 'email', 'slug', 'is_active', 'custom_domain', 'custom_domain_paid', 'landing_enabled'] as const;

/**
 * GET — галереї одного фотографа з розмірами (Diana, 2026-08-06: «я б хотіла
 * переглянути цю галерею і загалом бачити скільки місця вони займають»).
 *
 * Розмір рахується з size_bytes кожного фото — це те, що реально лежить у
 * сховищі, а не оцінка. Посилання на перегляд — клієнтське (client_token):
 * адміністратор бачить галерею рівно так, як її бачить клієнт фотографа.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();

  const { data: galleries, error } = await admin
    .from('photographer_galleries')
    .select('id, title, client_name, client_token, shoot_date, expires_at, files_purged_at, created_at, zip_downloads')
    .eq('photographer_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (galleries || []).map(g => g.id);
  const bytesByGallery: Record<string, number> = {};
  const countByGallery: Record<string, number> = {};
  if (ids.length) {
    // Постранично, бо PostgREST віддає максимум 1000 рядків за раз, а велика
    // галерея легко має більше фото — без циклу сума була б занижена.
    for (let from = 0; ; from += 1000) {
      const { data: photos } = await admin
        .from('photographer_gallery_photos')
        .select('gallery_id, size_bytes')
        .in('gallery_id', ids)
        .range(from, from + 999);
      (photos || []).forEach((ph: any) => {
        bytesByGallery[ph.gallery_id] = (bytesByGallery[ph.gallery_id] || 0) + Number(ph.size_bytes || 0);
        countByGallery[ph.gallery_id] = (countByGallery[ph.gallery_id] || 0) + 1;
      });
      if (!photos || photos.length < 1000) break;
    }
  }

  return NextResponse.json({
    galleries: (galleries || []).map(g => ({
      ...g,
      photo_count: countByGallery[g.id] || 0,
      size_bytes: bytesByGallery[g.id] || 0,
    })),
  });
}

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
