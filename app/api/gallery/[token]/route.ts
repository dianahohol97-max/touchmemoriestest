import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { daysLeft } from '@/lib/photographers/helpers';
import { fileUrl } from '@/lib/photographers/storage';
import { sanitizeDesign } from '@/lib/photographers/gallery-design';
import { readAllGalleryPhotos } from '@/lib/photographers/gallery-photos';
import { gallerySources, VARIANT_COLUMNS } from '@/lib/photographers/gallery-variant-paths';

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
      photographer:photographers(name, bio, phone, instagram, website, email, logo_url, avatar_url, is_active)
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
    },
  };

  if (expired) return NextResponse.json({ gallery: { ...base, photos: [] } });

  // Paged: a gallery holds up to 2000 files and one PostgREST read stops at
  // 1000 without saying so — the client would silently see half the shoot.
  const { rows: photos, error: photosErr } = await readAllGalleryPhotos<any>(
    admin, gallery.id, `id, storage_path, file_name, size_bytes, favorite, media_type, storage_provider, ${VARIANT_COLUMNS}`,
  );
  if (photosErr) {
    console.error('[gallery/token] photos read failed:', photosErr);
    return NextResponse.json({ error: 'Не вдалося завантажити фото' }, { status: 500 });
  }

  // `url` is the ORIGINAL and stays so: single downloads and «Завантажити все»
  // take it. The screen gets `sources` (copies of 640/1280/2048 px, see
  // lib/photographers/gallery-variant-paths.ts) plus the original's `w`/`h`
  // for width/height. No copies yet → empty `sources`, and the page shows
  // the original exactly as before. Videos are left alone.
  const list = photos.map(p => {
    const url = fileUrl(p.storage_path, p.storage_provider);
    const isVideo = p.media_type === 'video';
    return {
      id: p.id, file_name: p.file_name, size_bytes: p.size_bytes,
      favorite: !!p.favorite, media_type: isVideo ? 'video' : 'photo',
      url,
      w: p.width || null,
      h: p.height || null,
      sources: isVideo ? [] : gallerySources(p, path => fileUrl(path, p.storage_provider), url),
    };
  });
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
      cover_w: cover?.w || null,
      cover_h: cover?.h || null,
      cover_sources: cover?.sources || [],
      photos: list,
    },
  });
}
