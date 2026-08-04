import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';
import { sanitizeDesign } from '@/lib/photographers/gallery-design';

export const dynamic = 'force-dynamic';

/** Update gallery settings (auth = cabinet token): the cover photo/video for
 *  the client gallery hero and the design options (bg, font, size, cover
 *  layout). Only the fields present in the body are touched — a design-only
 *  PATCH must not clear the cover and vice versa. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const photographer = await getPhotographerByToken(String(body?.token || ''));
    if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

    const admin = getAdminClient();
    const { data: gallery } = await admin
      .from('photographer_galleries')
      .select('id, design')
      .eq('id', id)
      .eq('photographer_id', photographer.id)
      .maybeSingle();
    if (!gallery) return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });

    const update: Record<string, unknown> = {};

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
