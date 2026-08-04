import { getAdminClient } from '@/lib/supabase/admin';

export const GALLERY_BUCKET = 'photographer-galleries';
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // 25 МБ на файл
// Відео йдуть повз Vercel напряму в Supabase Storage (signed upload URL), тож
// ліміт тут — наш власний. Глобальний ліміт розміру файлу в налаштуваннях
// Supabase Storage має бути не меншим, інакше PUT відхилить сам Supabase.
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 МБ на відео
export const MAX_PHOTOS_PER_GALLERY = 500;

/** Resolve a photographer by their private cabinet token. Returns null when
 *  the token is unknown or the photographer is deactivated. */
export async function getPhotographerByToken(token: string) {
  if (!token) return null;
  const admin = getAdminClient();
  const { data } = await admin
    .from('photographers')
    .select('*')
    .eq('cabinet_token', token)
    .eq('is_active', true)
    .maybeSingle();
  return data;
}

/** Supabase-only public URL. Gallery photos/videos must NOT use this — they
 *  may live on R2, so they go through fileUrl() in ./storage, which resolves
 *  the row's own provider. Branding files (logo/avatar/portfolio) are tiny,
 *  few and stay on Supabase, so they keep using this. */
export function publicUrl(path: string): string {
  const admin = getAdminClient();
  return admin.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Days left before a gallery expires (never below 0). */
export function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

const sanitize = (name: string) =>
  name.replace(/[^\w.\-]+/g, '_').replace(/_{2,}/g, '_').slice(-80);

export function galleryPhotoPath(photographerId: string, galleryId: string, fileName: string) {
  return `${photographerId}/${galleryId}/${Date.now()}_${sanitize(fileName)}`;
}

export function brandingPath(photographerId: string, kind: 'logo' | 'avatar' | 'portfolio', fileName: string) {
  return `${photographerId}/branding/${kind}_${Date.now()}_${sanitize(fileName)}`;
}
