import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { publicUrl, daysLeft } from '@/lib/photographers/helpers';
import { sanitizeDesign } from '@/lib/photographers/gallery-design';

export const dynamic = 'force-dynamic';

/**
 * Public client-facing gallery, keyed by the unguessable client_token.
 * Expired galleries keep returning photographer contacts (the page shows a
 * "storage period is over" state) but never the photos.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getAdminClient();

  const { data: gallery } = await admin
    .from('photographer_galleries')
    .select(`
      id, title, client_name, shoot_date, expires_at, files_purged_at, created_at, cover_photo_id, design,
      photographer:photographers(name, bio, phone, instagram, website, email, logo_url, avatar_url, slug, is_active, landing_enabled)
    `)
    .eq('client_token', token)
    .maybeSingle();

  const photographer = Array.isArray(gallery?.photographer) ? gallery?.photographer[0] : gallery?.photographer;
  if (!gallery || !photographer?.is_active) {
    return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });
  }

  const expired = !!gallery.files_purged_at || new Date(gallery.expires_at).getTime() < Date.now();
  const base = {
    title: gallery.title,
    design: sanitizeDesign(gallery.design, null),
    client_name: gallery.client_name,
    shoot_date: gallery.shoot_date,
    expires_at: gallery.expires_at,
    days_left: expired ? 0 : daysLeft(gallery.expires_at),
    expired,
    photographer: {
      name: photographer.name,
      bio: photographer.bio,
      phone: photographer.phone,
      instagram: photographer.instagram,
      website: photographer.website,
      email: photographer.email,
      logo_url: photographer.logo_url,
      avatar_url: photographer.avatar_url,
      slug: photographer.landing_enabled ? photographer.slug : null,
    },
  };

  if (expired) return NextResponse.json({ gallery: { ...base, photos: [] } });

  const { data: photos } = await admin
    .from('photographer_gallery_photos')
    .select('id, storage_path, file_name, size_bytes, favorite, media_type')
    .eq('gallery_id', gallery.id)
    .order('created_at', { ascending: true });

  const list = (photos || []).map(p => ({
    id: p.id, file_name: p.file_name, size_bytes: p.size_bytes,
    favorite: !!p.favorite, media_type: p.media_type === 'video' ? 'video' : 'photo',
    url: publicUrl(p.storage_path),
  }));
  // Cover for the fullscreen hero: the photographer's pick, else the first
  // PHOTO (a video only becomes the cover by explicit choice — an accidental
  // first-uploaded video autoplaying as hero would surprise).
  const cover = list.find(p => p.id === gallery.cover_photo_id)
    || list.find(p => p.media_type === 'photo')
    || list[0]
    || null;

  return NextResponse.json({
    gallery: {
      ...base,
      cover_url: cover?.url || null,
      cover_type: cover?.media_type || 'photo',
      photos: list,
    },
  });
}
