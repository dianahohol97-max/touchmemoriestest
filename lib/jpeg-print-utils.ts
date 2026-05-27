/**
 * JPEG print-prep helpers — DPI metadata patching and bleed extension.
 *
 * Browser canvas.toBlob('image/jpeg') writes a perfectly valid JPEG
 * but tags it as 96 DPI in the JFIF APP0 marker. Most printers don't
 * actually care about this metadata (they read the pixel dimensions
 * and the customer-supplied physical size), but some automated
 * prepress systems use the embedded DPI to compute scale, and a
 * 96-DPI file at A4 pixel dimensions can confuse them.
 *
 * `setJpegDpi300(blob)` rewrites the APP0 marker so the DPI fields
 * read 300×300 instead of 96×96, without changing a single pixel.
 *
 * `extendBleed(canvas, mmPerSide, dpi)` returns a new canvas that
 * has `mmPerSide` of extra "bleed" added on all four edges. The new
 * pixels are a mirror copy of the original's edge stripes, which is
 * the standard fallback when the artist didn't draw their own
 * bleed. It's not as pretty as a designed background, but it keeps
 * the trim line from showing white if the trimmer drifts by 1-2 mm.
 */

/**
 * Returns a new Blob that is byte-for-byte the same JPEG except the
 * DPI fields in the JFIF APP0 marker read 300×300 instead of 96×96.
 *
 * Browser-produced JPEGs always start with:
 *     FF D8                       (SOI)
 *     FF E0 ?? ??                 (APP0 length)
 *     'J','F','I','F',0           (identifier)
 *     01 ??                       (JFIF version)
 *     01                          (units = inches)
 *     XX XX                       (X density — big-endian)
 *     XX XX                       (Y density)
 *     ...
 * We rewrite the four density bytes to 0x01,0x2C,0x01,0x2C (= 300, 300).
 *
 * If for any reason the JPEG doesn't start with that exact structure
 * (a Safari oddity, a future browser change), we return the blob
 * unchanged rather than risk corrupting it.
 */
export async function setJpegDpi300(blob: Blob): Promise<Blob> {
  try {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Check SOI marker
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
    // Check APP0 marker
    if (bytes[2] !== 0xff || bytes[3] !== 0xe0) return blob;
    // Check 'JFIF\0' identifier at offset 6
    if (
      bytes[6] !== 0x4a /* J */ ||
      bytes[7] !== 0x46 /* F */ ||
      bytes[8] !== 0x49 /* I */ ||
      bytes[9] !== 0x46 /* F */ ||
      bytes[10] !== 0x00
    ) return blob;
    // Density units byte at offset 13. We expect 0x01 (inches).
    // If the source said 0x00 (no units), we still rewrite to inches
    // so 300 has a meaningful unit attached.
    bytes[13] = 0x01;
    // 300 in big-endian = 0x01 0x2C
    bytes[14] = 0x01; bytes[15] = 0x2c; // X density
    bytes[16] = 0x01; bytes[17] = 0x2c; // Y density
    return new Blob([bytes], { type: 'image/jpeg' });
  } catch (e) {
    console.warn('setJpegDpi300 failed, returning original blob:', e);
    return blob;
  }
}

/**
 * Returns a new canvas with `mmPerSide` of bleed added on each edge,
 * computed at the given DPI. The new edge pixels are a mirrored copy
 * of the inner edge — a 1-pixel-thick edge stripe stretched outward.
 *
 * Why mirror and not just extend the edge pixel? Two reasons:
 *   1) If the artwork has any colour gradient near the edge, a flat
 *      stretch would create a hard line at the trim. Mirroring keeps
 *      the gradient continuous.
 *   2) If the trimmer drifts inward by a millimetre or two, the
 *      mirrored bleed looks indistinguishable from the original
 *      composition — there's no white border, no obvious cut line.
 *
 * `mmPerSide` defaults to 5 mm which matches the printer's spec for
 * the journal/travel-book inner pages.
 */
export function extendBleed(
  canvas: HTMLCanvasElement,
  mmPerSide = 5,
  dpi = 300
): HTMLCanvasElement {
  const bleedPx = Math.round((mmPerSide / 25.4) * dpi);
  if (bleedPx <= 0) return canvas;

  const W = canvas.width;
  const H = canvas.height;
  const out = document.createElement('canvas');
  out.width = W + bleedPx * 2;
  out.height = H + bleedPx * 2;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1) Draw the original artwork in the centre.
  ctx.drawImage(canvas, bleedPx, bleedPx);

  // 2) Mirrored top stripe — flip the top `bleedPx` rows vertically and
  //    draw them above. Same for the other three sides.
  ctx.save();
  // Top stripe
  ctx.translate(bleedPx, bleedPx);
  ctx.scale(1, -1);
  ctx.drawImage(canvas, 0, 0, W, bleedPx, 0, 0, W, bleedPx);
  ctx.restore();

  ctx.save();
  // Bottom stripe
  ctx.translate(bleedPx, H + bleedPx);
  ctx.scale(1, -1);
  ctx.drawImage(canvas, 0, H - bleedPx, W, bleedPx, 0, -bleedPx, W, bleedPx);
  ctx.restore();

  ctx.save();
  // Left stripe
  ctx.translate(bleedPx, bleedPx);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0, bleedPx, H, 0, 0, bleedPx, H);
  ctx.restore();

  ctx.save();
  // Right stripe
  ctx.translate(W + bleedPx, bleedPx);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, W - bleedPx, 0, bleedPx, H, -bleedPx, 0, bleedPx, H);
  ctx.restore();

  // 3) Mirrored corners — flip both axes. Without this the four
  //    corners would be empty (the four stripes above don't cover
  //    them).
  ctx.save();
  // Top-left corner
  ctx.translate(bleedPx, bleedPx);
  ctx.scale(-1, -1);
  ctx.drawImage(canvas, 0, 0, bleedPx, bleedPx, 0, 0, bleedPx, bleedPx);
  ctx.restore();

  ctx.save();
  // Top-right corner
  ctx.translate(W + bleedPx, bleedPx);
  ctx.scale(-1, -1);
  ctx.drawImage(canvas, W - bleedPx, 0, bleedPx, bleedPx, -bleedPx, 0, bleedPx, bleedPx);
  ctx.restore();

  ctx.save();
  // Bottom-left corner
  ctx.translate(bleedPx, H + bleedPx);
  ctx.scale(-1, -1);
  ctx.drawImage(canvas, 0, H - bleedPx, bleedPx, bleedPx, 0, -bleedPx, bleedPx, bleedPx);
  ctx.restore();

  ctx.save();
  // Bottom-right corner
  ctx.translate(W + bleedPx, H + bleedPx);
  ctx.scale(-1, -1);
  ctx.drawImage(canvas, W - bleedPx, H - bleedPx, bleedPx, bleedPx, -bleedPx, -bleedPx, bleedPx, bleedPx);
  ctx.restore();

  return out;
}
