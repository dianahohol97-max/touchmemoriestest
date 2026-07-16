import { getAdminClient } from '@/lib/supabase/admin';

export const GALLERY_BUCKET = 'photographer-galleries';
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // 25 МБ на файл
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
