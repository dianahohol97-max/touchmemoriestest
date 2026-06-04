'use client';

// Why this exists: iPhones save photos as HEIC/HEIF by default, and browsers
// can't render those in <img>. Before this helper, HEIC uploads showed as
// broken thumbnails (background) or were silently dropped (main photo upload).
// We convert them to JPEG client-side, lazy-loading the heic2any library only
// when a HEIC actually appears so the editor bundle stays light for everyone
// else.

function isHeic(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (
    type === 'image/heic' ||
    type === 'image/heif' ||
    type === 'image/heic-sequence' ||
    type === 'image/heif-sequence'
  ) {
    return true;
  }
  // Browsers (and Telegram, AirDrop, etc.) often hand over HEIC with an empty
  // MIME type, so fall back to the extension.
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

/**
 * Returns a browser-renderable image File. HEIC/HEIF inputs are converted to
 * JPEG; everything else is returned untouched. On conversion failure the
 * original file is returned so the caller's own decode step can surface a
 * friendly error instead of crashing.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const mod: any = await import('heic2any');
    const heic2any = mod.default || mod;
    const out: Blob | Blob[] = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const blob: Blob = Array.isArray(out) ? out[0] : out;
    const newName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch (e) {
    console.warn('HEIC → JPEG conversion failed, using original file:', e);
    return file;
  }
}
