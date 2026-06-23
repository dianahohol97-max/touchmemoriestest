'use client';

// Why this exists: iPhones save photos as HEIC/HEIF by default, and browsers
// can't render those in <img>. Before this helper, HEIC uploads showed as
// broken thumbnails (background) or were silently dropped (main photo upload).
// We convert them to JPEG client-side, lazy-loading the heic2any library only
// when a HEIC actually appears so the editor bundle stays light for everyone
// else.

export function isHeic(file: File): boolean {
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
  const newName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '.jpg');

  // 1) Primary: heic2any. Works for most iPhone HEIC.
  try {
    const mod: any = await import('heic2any');
    const heic2any = mod.default || mod;
    const out: Blob | Blob[] = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    const blob: Blob = Array.isArray(out) ? out[0] : out;
    if (blob && blob.size > 0) {
      return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
    }
    throw new Error('heic2any returned empty blob');
  } catch (e) {
    console.warn('heic2any failed, trying canvas fallback:', e);
  }

  // 2) Fallback: some browsers (Safari, newer Chrome on macOS) can decode HEIC
  // natively. Draw it onto a canvas and export JPEG.
  try {
    const url = URL.createObjectURL(file);
    const jpeg = await new Promise<File>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx || !canvas.width || !canvas.height) { reject(new Error('no canvas / zero size')); return; }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => {
            if (b && b.size > 0) resolve(new File([b], newName, { type: 'image/jpeg', lastModified: file.lastModified }));
            else reject(new Error('canvas toBlob empty'));
          }, 'image/jpeg', 0.92);
        } catch (err) { reject(err); }
      };
      img.onerror = () => reject(new Error('browser cannot decode this HEIC'));
      img.src = url;
    });
    URL.revokeObjectURL(url);
    return jpeg;
  } catch (e2) {
    console.error('HEIC → JPEG conversion failed (both methods):', e2);
    // Hard fail: do NOT silently upload an unrenderable HEIC. The caller shows
    // a friendly error and the photo simply isn't saved as broken.
    throw new HeicConversionError();
  }
}

export class HeicConversionError extends Error {
  constructor() {
    super('HEIC_CONVERSION_FAILED');
    this.name = 'HeicConversionError';
  }
}
