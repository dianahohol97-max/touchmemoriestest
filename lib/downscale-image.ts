'use client';

// Why this exists: full-quality camera photos (often 6000–8500px on the long
// edge, 15–60MB) overflow storage upload limits and make uploads slow/flaky.
// We downscale ONLY genuinely large images to a print-grade resolution; normal
// photos pass through untouched so we don't repeat the quality-loss regression
// from the old book-upload compression.
//
//   const f = await downscaleImageIfLarge(file);  // ~4500px long edge, q0.9
//
// 4500px on the long edge is still print-quality up to ~A3, so journal pages
// stay sharp while heavy originals become a few MB.

export async function downscaleImageIfLarge(
  file: File,
  maxEdge = 4500,
  quality = 0.9,
): Promise<File> {
  // Only touch raster photos; leave PDFs, GIFs (animation) and anything odd be.
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= maxEdge) {
      bitmap.close?.();
      return file; // already a sensible size — keep the original bytes
    }

    const scale = maxEdge / longest;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;

    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file; // never block the upload because optimisation failed
  }
}
