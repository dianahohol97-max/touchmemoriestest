/**
 * Supabase Image Transformation helper.
 *
 * Converts a raw Supabase Storage URL
 *   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * to the render-image endpoint which resizes + converts to WebP on the fly:
 *   https://<ref>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=…&quality=…&format=webp
 *
 * Non-Supabase URLs are returned unchanged so the helper is safe to call
 * on any image src string.
 *
 * Supabase Image Transformation is available on Pro plan and above.
 * On Free plan the transform endpoint 404s — to detect this we check the
 * NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM env flag (set to "1" when Pro).
 */

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const TRANSFORM_ENABLED = process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM === '1';

export interface ImgTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'origin';
  resize?: 'cover' | 'contain' | 'fill';
}

export function supabaseImg(
  src: string | null | undefined,
  opts: ImgTransformOptions = {}
): string {
  if (!src) return '';

  // Only transform Supabase storage public URLs
  const isSupabaseStorage =
    src.includes('.supabase.co/storage/v1/object/public/') ||
    src.includes('.supabase.co/storage/v1/object/sign/');

  if (!isSupabaseStorage || !TRANSFORM_ENABLED) return src;

  // /object/public/ → /render/image/public/
  // /object/sign/  → /render/image/sign/
  const transformed = src
    .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    .replace('/storage/v1/object/sign/', '/storage/v1/render/image/sign/');

  // Strip existing query string so we don't double-encode
  const [base, existingQs] = transformed.split('?');
  const params = new URLSearchParams(existingQs ?? '');

  const { width, height, quality = 80, format = 'webp', resize = 'cover' } = opts;
  if (width)  params.set('width',   String(width));
  if (height) params.set('height',  String(height));
  params.set('quality', String(quality));
  params.set('format',  format);
  params.set('resize',  resize);

  return `${base}?${params.toString()}`;
}

/** Shorthand presets */
export const imgProduct    = (src: string) => supabaseImg(src, { width: 800,  quality: 80 });
export const imgThumbnail  = (src: string) => supabaseImg(src, { width: 200,  quality: 70 });
export const imgHero       = (src: string) => supabaseImg(src, { width: 1920, quality: 75 });
export const imgMockup     = (src: string) => supabaseImg(src, { width: 1280, quality: 75 });
export const imgCategory   = (src: string) => supabaseImg(src, { width: 800,  quality: 75 });
