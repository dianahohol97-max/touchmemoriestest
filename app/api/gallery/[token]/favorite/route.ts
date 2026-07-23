import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Client-facing "heart this photo" toggle, keyed by the same unguessable
 * client_token as the public gallery. The gallery client marks the shots they
 * want printed; the photographer then sees exactly which ones to order.
 *
 * Writes go through the service role (the browser never touches the DB
 * directly). We re-verify on every call that the photo belongs to the gallery
 * behind this token, and that the gallery is still live.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const photoId = String(body?.photoId || '');
  const favorite = body?.favorite === true;
  if (!photoId) return NextResponse.json({ error: 'Не вказано фото' }, { status: 400 });

  const admin = getAdminClient();

  const { data: gallery } = await admin
    .from('photographer_galleries')
    .select('id, expires_at, files_purged_at, photographer:photographers(is_active)')
    .eq('client_token', token)
    .maybeSingle();
  const photographer = Array.isArray(gallery?.photographer) ? gallery?.photographer[0] : gallery?.photographer;
  if (!gallery || !photographer?.is_active) {
    return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });
  }
  const expired = !!gallery.files_purged_at || new Date(gallery.expires_at).getTime() < Date.now();
  if (expired) return NextResponse.json({ error: 'Термін зберігання галереї минув' }, { status: 410 });

  // Scope the update to this gallery so a token can only toggle its own photos.
  const { data: updated, error } = await admin
    .from('photographer_gallery_photos')
    .update({ favorite })
    .eq('id', photoId)
    .eq('gallery_id', gallery.id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Фото не знайдено' }, { status: 404 });

  return NextResponse.json({ success: true, photoId, favorite });
}
