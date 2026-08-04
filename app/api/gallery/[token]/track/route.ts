import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** Download telemetry from the client gallery: the cabinet shows the
 *  photographer how many times the ZIP and single photos were downloaded.
 *  Auth = the unguessable client token; counters only ever increment, so
 *  the worst an abuser can do is inflate their own gallery's numbers. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const type = String(body?.type || '');

    const admin = getAdminClient();
    const { data: gallery } = await admin
      .from('photographer_galleries')
      .select('id')
      .eq('client_token', token)
      .maybeSingle();
    if (!gallery) return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });

    if (type === 'zip') {
      await admin.rpc('increment_gallery_zip_downloads', { gallery: gallery.id });
      return NextResponse.json({ ok: true });
    }
    if (type === 'photo') {
      const photoId = String(body?.photoId || '');
      const { data: photo } = await admin
        .from('photographer_gallery_photos')
        .select('id')
        .eq('id', photoId)
        .eq('gallery_id', gallery.id)
        .maybeSingle();
      if (!photo) return NextResponse.json({ error: 'Фото не знайдено' }, { status: 404 });
      await admin.rpc('increment_photo_downloads', { photo: photo.id });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Невідомий тип' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Некоректний запит' }, { status: 400 });
  }
}
