import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getPhotographerByToken } from '@/lib/photographers/helpers';

export const dynamic = 'force-dynamic';

/** Update gallery settings (auth = cabinet token). Currently only the cover
 *  photo for the client gallery's fullscreen hero. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const photographer = await getPhotographerByToken(String(body?.token || ''));
    if (!photographer) return NextResponse.json({ error: 'Кабінет не знайдено' }, { status: 404 });

    const admin = getAdminClient();
    const { data: gallery } = await admin
      .from('photographer_galleries')
      .select('id')
      .eq('id', id)
      .eq('photographer_id', photographer.id)
      .maybeSingle();
    if (!gallery) return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });

    const coverPhotoId = body?.cover_photo_id ? String(body.cover_photo_id) : null;
    if (coverPhotoId) {
      // The cover must be a photo of THIS gallery — otherwise a leaked photo id
      // from another gallery could be exposed on this gallery's hero.
      const { data: photo } = await admin
        .from('photographer_gallery_photos')
        .select('id')
        .eq('id', coverPhotoId)
        .eq('gallery_id', id)
        .maybeSingle();
      if (!photo) return NextResponse.json({ error: 'Фото не знайдено в цій галереї' }, { status: 400 });
    }

    const { error } = await admin
      .from('photographer_galleries')
      .update({ cover_photo_id: coverPhotoId })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });
  }
}
