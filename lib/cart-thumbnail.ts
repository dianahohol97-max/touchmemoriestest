/**
 * Builds a small, self-contained JPEG data-URL thumbnail from any image source
 * (blob:, https:, or data:). Cart items persist in localStorage, but blob: URLs
 * only live in the tab that created them — so storing a blob: URL as the cart
 * thumbnail means it shows as a broken/blank image (the "blue squares" bug) on
 * reload, on another device, or just when reopening the cart later.
 *
 * A ~240px JPEG data URL is self-contained, survives localStorage, and renders
 * anywhere without a network round-trip. Returns '' on failure so callers can
 * fall back to a catalog image.
 */
export async function makeCartThumbnail(
  src: string | undefined,
  maxDim = 240,
  quality = 0.7,
): Promise<string> {
  if (!src) return '';
  // Already persistent — keep as-is.
  if (src.startsWith('data:')) return src;
  if (typeof document === 'undefined') return '';

  try {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('thumbnail image failed to load'));
    });
    img.src = src;
    await loaded;

    const natW = img.naturalWidth || maxDim;
    const natH = img.naturalHeight || maxDim;
    const scale = Math.min(1, maxDim / Math.max(natW, natH));
    const w = Math.max(1, Math.round(natW * scale));
    const h = Math.max(1, Math.round(natH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return '';
  }
}
