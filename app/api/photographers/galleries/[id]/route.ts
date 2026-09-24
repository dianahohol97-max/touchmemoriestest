import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';
import { sanitizeDesign } from '@/lib/photographers/gallery-design';
import { extendedExpiry, EXTEND_DAY_OPTIONS } from '@/lib/photographers/gallery-term';
import { kyivDateParts } from '@/lib/photographers/notice-rules';

export const dynamic = 'force-dynamic';

/** Update gallery settings (auth = cabinet token): title/client/date, the
 *  cover photo/video, design options, and the storage term. Only the fields
 *  present in the body are touched — a design-only PATCH must not clear the
 *  cover and vice versa. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const photographer = await getPhotographerByToken(String(body?.token || ''));
    if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

    const admin = getAdminClient();
    const { data: gallery } = await admin
      .from('photographer_galleries')
      .select('id, design, expires_at, files_purged_at')
      .eq('id', id)
      .eq('photographer_id', photographer.id)
      .maybeSingle();
    if (!gallery) return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });

    const update: Record<string, unknown> = {};

    if ('title' in body) {
      const title = String(body.title || '').trim();
      if (!title || title.length > 200) return NextResponse.json({ error: 'Вкажіть назву' }, { status: 400 });
      update.title = title;
    }
    if ('client_name' in body) update.client_name = String(body.client_name || '').trim() || null;
    if ('shoot_date' in body) update.shoot_date = body.shoot_date || null;

    if ('extend_days' in body) {
      if (gallery.files_purged_at) return NextResponse.json({ error: 'Файли галереї вже видалено — продовжити неможливо' }, { status: 400 });
      const days = Number(body.extend_days);
      if (!(EXTEND_DAY_OPTIONS as readonly number[]).includes(days)) return NextResponse.json({ error: 'Термін: 30, 60 або 90 днів' }, { status: 400 });
      // Extends from the later of now and the current expiry, capped at
      // MAX_TERM_DAYS from today — but never below the current expiry: the cap
      // used to SHORTEN a longer term (see lib/photographers/gallery-term).
      const next = extendedExpiry(gallery.expires_at, days, new Date());
      if (next) {
        update.expires_at = next;
      } else if (Object.keys(body).every(k => k === 'token' || k === 'extend_days')) {
        // Only the extension was asked and it changes nothing. Saying «продовжено»
        // would be false, so the cabinet gets the reason in its alert instead.
        const { date } = kyivDateParts(gallery.expires_at);
        return NextResponse.json({
          error: `Галерея вже зберігається до ${date}, а це довше, ніж дає продовження, тому термін лишається без змін.`,
          unchanged: true,
        }, { status: 409 });
      }
    }

    if ('cover_photo_id' in body) {
      const coverPhotoId = body.cover_photo_id ? String(body.cover_photo_id) : null;
      if (coverPhotoId) {
        // The cover must be a photo of THIS gallery — otherwise a leaked photo
        // id from another gallery could be exposed on this gallery's hero.
        const { data: photo } = await admin
          .from('photographer_gallery_photos')
          .select('id')
          .eq('id', coverPhotoId)
          .eq('gallery_id', id)
          .maybeSingle();
        if (!photo) return NextResponse.json({ error: 'Фото не знайдено в цій галереї' }, { status: 400 });
      }
      update.cover_photo_id = coverPhotoId;
    }

    if ('design' in body) {
      update.design = sanitizeDesign(gallery.design, body.design);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Немає що оновлювати' }, { status: 400 });
    }

    const { error } = await admin
      .from('photographer_galleries')
      .update(update)
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, design: update.design });
  } catch {
    return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });
  }
}
