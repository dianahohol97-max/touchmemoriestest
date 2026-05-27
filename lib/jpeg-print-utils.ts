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
// Base64-encoded sRGB IEC61966-2.1 ICC v2 profile, 3268 bytes
// Source: standard sRGB profile from texlive-colorprofiles package
// (originally HP/Microsoft 1998 reference profile, public domain)
// Decoded length: 3268 bytes

export const SRGB_ICC_BASE64 =
  'AAAMxGFyZ2wCIAAAbW50clJHQiBYWVogB+AACQAJAAcAEQAbYWNzcE1TRlQAAAAASUVDIHNSR0IA' +
  'AAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1hcmdsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAASZGVzYwAAAVwAAACZY3BydAAAAfgAAABnZG1uZAAAAmAAAABwZG1k' +
  'ZAAAAtAAAACIdGVjaAAAA1gAAAAMdnVlZAAAA2QAAABndmlldwAAA8wAAAAkbHVtaQAAA/AAAAAU' +
  'bWVhcwAABAQAAAAkd3RwdAAABCgAAAAUYmtwdAAABDwAAAAUclhZWgAABFAAAAAUZ1hZWgAABGQA' +
  'AAAUYlhZWgAABHgAAAAUclRSQwAABIwAAAgMZ1RSQwAABIwAAAgMYlRSQwAABIwAAAgMYXJ0cwAA' +
  'DJgAAAAsZGVzYwAAAAAAAAA/c1JHQiBJRUM2MTk2Ni0yLjEgKEVxdWl2YWxlbnQgdG8gd3d3LnNy' +
  'Z2IuY29tIDE5OTggSFAgcHJvZmlsZSkAAAAAAAAAAAAAAD9zUkdCIElFQzYxOTY2LTIuMSAoRXF1' +
  'aXZhbGVudCB0byB3d3cuc3JnYi5jb20gMTk5OCBIUCBwcm9maWxlKQAAAAAAAAAAdGV4dAAAAABD' +
  'cmVhdGVkIGJ5IEdyYWVtZSBXLiBHaWxsLiBSZWxlYXNlZCBpbnRvIHRoZSBwdWJsaWMgZG9tYWlu' +
  'LiBObyBXYXJyYW50eSwgVXNlIGF0IHlvdXIgb3duIHJpc2suAABkZXNjAAAAAAAAABZJRUMgaHR0' +
  'cDovL3d3dy5pZWMuY2gAAAAAAAAAAAAAABZJRUMgaHR0cDovL3d3dy5pZWMuY2gAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZGVzYwAAAAAAAAAuSUVDIDYxOTY2' +
  'LTIuMSBEZWZhdWx0IFJHQiBjb2xvdXIgc3BhY2UgLSBzUkdCAAAAAAAAAAAAAAAuSUVDIDYxOTY2' +
  'LTIuMSBEZWZhdWx0IFJHQiBjb2xvdXIgc3BhY2UgLSBzUkdCAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AHNpZyAAAAAAQ1JUIGRlc2MAAAAAAAAADUlFQzYxOTY2LTIuMQAAAAAAAAAAAAAADUlFQzYxOTY2' +
  'LTIuMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAdmlldwAAAAAAE6SAABRfMAAQzgoAA+2zAAQTCgADXGgAAAABWFlaIAAAAAAATApAAFAAAABX' +
  'HtBtZWFzAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAACjwAAAAJYWVogAAAAAAAA81EAAQAAAAEW' +
  'zFhZWiAAAAAAAAAAAAAAAAAAAAAAWFlaIAAAAAAAAG+gAAA49QAAA5BYWVogAAAAAAAAYpcAALeH' +
  'AAAY2VhZWiAAAAAAAAAknwAAD4QAALbEY3VydgAAAAAAAAQAAAAABQAKAA8AFAAZAB4AIwAoAC0A' +
  'MgA3ADsAQABFAEoATwBUAFkAXgBjAGgAbQByAHcAfACBAIYAiwCQAJUAmgCfAKQAqQCuALIAtwC8' +
  'AMEAxgDLANAA1QDbAOAA5QDrAPAA9gD7AQEBBwENARMBGQEfASUBKwEyATgBPgFFAUwBUgFZAWAB' +
  'ZwFuAXUBfAGDAYsBkgGaAaEBqQGxAbkBwQHJAdEB2QHhAekB8gH6AgMCDAIUAh0CJgIvAjgCQQJL' +
  'AlQCXQJnAnECegKEAo4CmAKiAqwCtgLBAssC1QLgAusC9QMAAwsDFgMhAy0DOANDA08DWgNmA3ID' +
  'fgOKA5YDogOuA7oDxwPTA+AD7AP5BAYEEwQgBC0EOwRIBFUEYwRxBH4EjASaBKgEtgTEBNME4QTw' +
  'BP4FDQUcBSsFOgVJBVgFZwV3BYYFlgWmBbUFxQXVBeUF9gYGBhYGJwY3BkgGWQZqBnsGjAadBq8G' +
  'wAbRBuMG9QcHBxkHKwc9B08HYQd0B4YHmQesB78H0gflB/gICwgfCDIIRghaCG4IggiWCKoIvgjS' +
  'COcI+wkQCSUJOglPCWQJeQmPCaQJugnPCeUJ+woRCicKPQpUCmoKgQqYCq4KxQrcCvMLCwsiCzkL' +
  'UQtpC4ALmAuwC8gL4Qv5DBIMKgxDDFwMdQyODKcMwAzZDPMNDQ0mDUANWg10DY4NqQ3DDd4N+A4T' +
  'Di4OSQ5kDn8Omw62DtIO7g8JDyUPQQ9eD3oPlg+zD88P7BAJECYQQxBhEH4QmxC5ENcQ9RETETER' +
  'TxFtEYwRqhHJEegSBxImEkUSZBKEEqMSwxLjEwMTIxNDE2MTgxOkE8UT5RQGFCcUSRRqFIsUrRTO' +
  'FPAVEhU0FVYVeBWbFb0V4BYDFiYWSRZsFo8WshbWFvoXHRdBF2UXiReuF9IX9xgbGEAYZRiKGK8Y' +
  '1Rj6GSAZRRlrGZEZtxndGgQaKhpRGncanhrFGuwbFBs7G2MbihuyG9ocAhwqHFIcexyjHMwc9R0e' +
  'HUcdcB2ZHcMd7B4WHkAeah6UHr4e6R8THz4faR+UH78f6iAVIEEgbCCYIMQg8CEcIUghdSGhIc4h' +
  '+yInIlUigiKvIt0jCiM4I2YjlCPCI/AkHyRNJHwkqyTaJQklOCVoJZclxyX3JicmVyaHJrcm6CcY' +
  'J0kneierJ9woDSg/KHEooijUKQYpOClrKZ0p0CoCKjUqaCqbKs8rAis2K2krnSvRLAUsOSxuLKIs' +
  '1y0MLUEtdi2rLeEuFi5MLoIuty7uLyQvWi+RL8cv/jA1MGwwpDDbMRIxSjGCMbox8jIqMmMymzLU' +
  'Mw0zRjN/M7gz8TQrNGU0njTYNRM1TTWHNcI1/TY3NnI2rjbpNyQ3YDecN9c4FDhQOIw4yDkFOUI5' +
  'fzm8Ofk6Njp0OrI67zstO2s7qjvoPCc8ZTykPOM9Ij1hPaE94D4gPmA+oD7gPyE/YT+iP+JAI0Bk' +
  'QKZA50EpQWpBrEHuQjBCckK1QvdDOkN9Q8BEA0RHRIpEzkUSRVVFmkXeRiJGZ0arRvBHNUd7R8BI' +
  'BUhLSJFI10kdSWNJqUnwSjdKfUrESwxLU0uaS+JMKkxyTLpNAk1KTZNN3E4lTm5Ot08AT0lPk0/d' +
  'UCdQcVC7UQZRUFGbUeZSMVJ8UsdTE1NfU6pT9lRCVI9U21UoVXVVwlYPVlxWqVb3V0RXklfgWC9Y' +
  'fVjLWRpZaVm4WgdaVlqmWvVbRVuVW+VcNVyGXNZdJ114XcleGl5sXr1fD19hX7NgBWBXYKpg/GFP' +
  'YaJh9WJJYpxi8GNDY5dj62RAZJRk6WU9ZZJl52Y9ZpJm6Gc9Z5Nn6Wg/aJZo7GlDaZpp8WpIap9q' +
  '92tPa6dr/2xXbK9tCG1gbbluEm5rbsRvHm94b9FwK3CGcOBxOnGVcfByS3KmcwFzXXO4dBR0cHTM' +
  'dSh1hXXhdj52m3b4d1Z3s3gReG54zHkqeYl553pGeqV7BHtje8J8IXyBfOF9QX2hfgF+Yn7CfyN/' +
  'hH/lgEeAqIEKgWuBzYIwgpKC9INXg7qEHYSAhOOFR4Wrhg6GcobXhzuHn4gEiGmIzokziZmJ/opk' +
  'isqLMIuWi/yMY4zKjTGNmI3/jmaOzo82j56QBpBukNaRP5GokhGSepLjk02TtpQglIqU9JVflcmW' +
  'NJaflwqXdZfgmEyYuJkkmZCZ/JpomtWbQpuvnByciZz3nWSd0p5Anq6fHZ+Ln/qgaaDYoUehtqIm' +
  'opajBqN2o+akVqTHpTilqaYapoum/adup+CoUqjEqTepqaocqo+rAqt1q+msXKzQrUStuK4trqGv' +
  'Fq+LsACwdbDqsWCx1rJLssKzOLOutCW0nLUTtYq2AbZ5tvC3aLfguFm40blKucK6O7q1uy67p7wh' +
  'vJu9Fb2Pvgq+hL7/v3q/9cBwwOzBZ8Hjwl/C28NYw9TEUcTOxUvFyMZGxsPHQce/yD3IvMk6ybnK' +
  'OMq3yzbLtsw1zLXNNc21zjbOts83z7jQOdC60TzRvtI/0sHTRNPG1EnUy9VO1dHWVdbY11zX4Nhk' +
  '2OjZbNnx2nba+9uA3AXcit0Q3ZbeHN6i3ynfr+A24L3hROHM4lPi2+Nj4+vkc+T85YTmDeaW5x/n' +
  'qegy6LzpRunQ6lvq5etw6/vshu0R7ZzuKO6070DvzPBY8OXxcvH/8ozzGfOn9DT0wvVQ9d72bfb7' +
  '94r4Gfio+Tj5x/pX+uf7d/wH/Jj9Kf26/kv+3P9t//9zZjMyAAAAAAAA5SUAAEQz///Wr///P/QA' +
  'AbaoAAAJZQAACfX//+54AAEHlA==';

/**
 * Decodes the embedded base64 sRGB ICC profile into raw bytes once,
 * cached on first call. Doing the decode at module load time would
 * cost ~3 KB of memory permanently; the lazy cache keeps the cost
 * only during the checkout flow when files are actually being
 * exported.
 */
let _iccBytesCache: Uint8Array | null = null;
function getSRGBProfileBytes(): Uint8Array {
  if (_iccBytesCache) return _iccBytesCache;
  // atob() turns the base64 string back into a binary string; we
  // then unpack each character code into a Uint8Array byte.
  const bin = atob(SRGB_ICC_BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  _iccBytesCache = bytes;
  return bytes;
}

/**
 * Embeds the standard sRGB IEC61966-2.1 ICC profile into a JPEG
 * blob as an APP2 marker, so prepress systems that read the
 * embedded colour profile see a real one instead of falling back
 * to "assume sRGB". The pixel data is unchanged.
 *
 * JPEG with embedded ICC looks like this:
 *     FF D8                         SOI
 *     FF E0 <len> 'JFIF\0' ...      APP0 (JFIF)  — existing
 *     FF E2 <len> 'ICC_PROFILE\0' 01 01 <bytes>  APP2 (ICC)  — new
 *     FF DB ... rest of the JPEG ...
 *
 * For small profiles (under 65517 bytes, ours is ~3.3 KB) we can
 * use a single APP2 chunk. The 01 01 after the identifier means
 * "sequence 1 of 1". The length field is big-endian and counts
 * itself + the identifier + sequence bytes + the profile.
 *
 * If the source JPEG already has an APP2 ICC marker we skip the
 * insert — the second profile would not be picked up by most
 * readers and just wastes bytes.
 */
export async function embedSRGBProfile(blob: Blob): Promise<Blob> {
  try {
    const src = new Uint8Array(await blob.arrayBuffer());
    // Validate SOI
    if (src[0] !== 0xff || src[1] !== 0xd8) return blob;
    // Find where to insert. We insert immediately after the APP0
    // (JFIF) marker, which is the conventional position.
    let insertAt = 2;
    if (src[2] === 0xff && src[3] === 0xe0) {
      const app0Len = (src[4] << 8) | src[5];
      insertAt = 4 + app0Len;
    }
    // Check whether an APP2 ICC marker already exists; if it does,
    // bail and return the original blob unchanged.
    let p = insertAt;
    while (p < src.length - 1) {
      if (src[p] !== 0xff) break;
      const marker = src[p + 1];
      // SOS — start of scan, no more app markers ahead.
      if (marker === 0xda) break;
      // Length field follows immediately for app markers.
      const segLen = (src[p + 2] << 8) | src[p + 3];
      if (marker === 0xe2) {
        // APP2 — check the identifier
        const sig = String.fromCharCode(
          src[p + 4], src[p + 5], src[p + 6], src[p + 7],
          src[p + 8], src[p + 9], src[p + 10], src[p + 11],
          src[p + 12], src[p + 13], src[p + 14], src[p + 15]
        );
        if (sig === 'ICC_PROFILE\0') return blob; // already embedded
      }
      p += 2 + segLen;
    }

    const profile = getSRGBProfileBytes();
    // Build APP2 marker body:
    //   12 bytes 'ICC_PROFILE\0'
    //   1 byte sequence number (01)
    //   1 byte total chunks (01)
    //   N bytes profile data
    const idBytes = new Uint8Array([
      0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46,
      0x49, 0x4c, 0x45, 0x00, // ICC_PROFILE\0
      0x01, 0x01,             // sequence 1 of 1
    ]);
    const segPayloadLen = 2 + idBytes.length + profile.length; // length field counts itself
    const seg = new Uint8Array(2 + 2 + idBytes.length + profile.length);
    seg[0] = 0xff;
    seg[1] = 0xe2;             // APP2
    seg[2] = (segPayloadLen >> 8) & 0xff;
    seg[3] = segPayloadLen & 0xff;
    seg.set(idBytes, 4);
    seg.set(profile, 4 + idBytes.length);

    // Stitch: SOI + APP0 + new APP2 + rest of JPEG
    const out = new Uint8Array(src.length + seg.length);
    out.set(src.subarray(0, insertAt), 0);
    out.set(seg, insertAt);
    out.set(src.subarray(insertAt), insertAt + seg.length);
    return new Blob([out], { type: 'image/jpeg' });
  } catch (e) {
    console.warn('embedSRGBProfile failed, returning original blob:', e);
    return blob;
  }
}

/* ─── COVER INSET RENDERERS ────────────────────────────────────────────────
 *
 * When a soft-cover product (velour / fabric / leatherette) has a decoration
 * (acryl insert, photo insert, metal plate, flex, engraving), the print shop
 * expects separate files for the decoration content alongside or instead of
 * the regular cover.jpg. Each decoration type has its own physical size and
 * colour requirements:
 *
 *   • Acrylic insert  100×100 mm  →  akryl_100x100.jpg  (colour, customer photo)
 *   • Acrylic round   Ø145 mm     →  akryl_145.jpg      (colour, customer photo)
 *   • Photo insert    100×100 mm  →  photo_100x100.jpg  (colour, customer photo)
 *   • Metal plate     60×60 mm    →  metal_60x60.jpg    (BLACK text on WHITE)
 *   • Engraving       front cover →  gravirovka.jpg     (BLACK text on WHITE,
 *                                                       sized to front face)
 *   • Flex            front cover →  flex.jpg           (BLACK text on WHITE,
 *                                                       sized to front face)
 *
 * Metal, engraving and flex are lasered onto opaque material so the printer
 * only needs the artwork in black on white — anything else gets ignored by
 * the laser. Acrylic / photo inserts are full-colour printed plates that
 * sit on the cover, so the customer's photo is what goes there.
 *
 * The front-face dimensions of each book size are listed in
 * FRONT_FACE_DIMS_MM — these come from the printer spec and exclude the
 * fold-in margins (so for a 20×20 cover sheet 457×243 mm the front face is
 * 200×200 mm).
 */

// Front face of the cover in mm — used for graviruvannya / flex files
// which the print shop wants sized to the visible front of the book.
const FRONT_FACE_DIMS_MM: Record<string, { w: number; h: number }> = {
  '20x20': { w: 200, h: 200 }, '20×20': { w: 200, h: 200 },
  '25x25': { w: 250, h: 250 }, '25×25': { w: 250, h: 250 },
  '20x30': { w: 200, h: 300 }, '20×30': { w: 200, h: 300 },
  '30x20': { w: 300, h: 200 }, '30×20': { w: 300, h: 200 },
  '30x30': { w: 300, h: 300 }, '30×30': { w: 300, h: 300 },
  'A4':          { w: 210, h: 297 },
  'magazine-A4': { w: 210, h: 297 },
  'travelbook':  { w: 200, h: 300 },
  '23x23':       { w: 230, h: 230 }, '23×23': { w: 230, h: 230 },
};

export interface InsetRenderInput {
  // Cover config from the editor — fields we read:
  //   decoType, decoVariant, decoText, decoColor,
  //   textFontFamily, textFontSize, textX, textY,
  //   photoId, photoCropX, photoCropY, photoZoom
  decoType: string;
  decoVariant?: string;
  decoText?: string;
  decoColor?: string;
  textFontFamily?: string;
  textFontSize?: number;
  textX?: number; // %
  textY?: number; // %
  photoId?: string | null;
  photoCropX?: number;
  photoCropY?: number;
  photoZoom?: number;
  photoRotation?: number;
  // Catalog of photos in the editor — used to resolve photoId
  photos: Array<{ id: string; preview: string }>;
  // Book size key, used for graviruvannya/flex files sized to the front face
  sizeKey: string;
}

/**
 * Loads an image and returns the HTMLImageElement once decoded.
 * Resolves to null if the load fails.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const _mm = (mm: number) => Math.round(mm * 300 / 25.4);

/**
 * Renders a single rectangular photo into a canvas of the given mm size,
 * honouring cropX/cropY/zoom from the editor state. Returns the canvas
 * ready for toBlob.
 *
 * cropX/Y are 0-100 (percentage), zoom is a multiplier (1 = fit). The
 * algorithm matches what the editor preview shows: image is sized to
 * cover the slot, scaled by zoom around the cropX/Y anchor point.
 */
function renderPhotoInsetCanvas(
  img: HTMLImageElement,
  widthMm: number,
  heightMm: number,
  cropX: number,
  cropY: number,
  zoom: number,
  rotationDeg: number,
  circular: boolean,
): HTMLCanvasElement {
  const W = _mm(widthMm);
  const H = _mm(heightMm);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background — white inside the printable area.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Circular clip if needed.
  if (circular) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2);
    ctx.clip();
  }

  // Photo-cover algorithm: scale the image so it covers the slot, then
  // multiply by zoom. The anchor point comes from cropX/cropY.
  const imgAR = img.width / img.height;
  const slotAR = W / H;
  let baseW: number, baseH: number;
  if (imgAR > slotAR) {
    baseH = H;
    baseW = baseH * imgAR;
  } else {
    baseW = W;
    baseH = baseW / imgAR;
  }
  const z = Math.max(1, zoom);
  const drawW = baseW * z;
  const drawH = baseH * z;

  // Anchor at cropX/cropY percent of the photo, positioned at cropX/cropY
  // of the slot. Matches the editor's `object-position: cropX% cropY%`
  // plus `transform: scale(z)`.
  const ax = cropX / 100;
  const ay = cropY / 100;
  const dx = -(drawW * ax) + W * ax;
  const dy = -(drawH * ay) + H * ay;

  if (rotationDeg !== 0) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.drawImage(img, dx - W / 2, dy - H / 2, drawW, drawH);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  if (circular) ctx.restore();
  return canvas;
}

/**
 * Renders a text-only canvas: BLACK text on WHITE background, intended
 * for the laser. Used for metal / engraving / flex. The font is sized
 * relative to the canvas height so the same input string fills a small
 * metal plate proportionally the same as a full front cover engraving.
 */
function renderTextInsetCanvas(
  text: string,
  widthMm: number,
  heightMm: number,
  fontFamily: string,
  fontSizePctOfCanvas: number = 10,
  textX: number = 50,
  textY: number = 50,
): HTMLCanvasElement {
  const W = _mm(widthMm);
  const H = _mm(heightMm);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // White background, full-bleed.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Black text.
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Pick a font size so the longest line fits within 80% of the canvas
  // width, capping at fontSizePctOfCanvas% of canvas height.
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return canvas;

  let fontPx = Math.round(H * fontSizePctOfCanvas / 100);
  const targetWidth = W * 0.8;
  ctx.font = `bold ${fontPx}px ${fontFamily}, Playfair Display, Georgia, serif`;
  const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
  if (widest > targetWidth) {
    fontPx = Math.floor(fontPx * (targetWidth / widest));
    ctx.font = `bold ${fontPx}px ${fontFamily}, Playfair Display, Georgia, serif`;
  }

  const cx = W * (textX / 100);
  const cy = H * (textY / 100);
  const lineH = fontPx * 1.2;
  const startY = cy - (lineH * (lines.length - 1)) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, startY + i * lineH);
  }

  return canvas;
}

/**
 * Top-level dispatcher — returns an array of {fileName, canvas} entries
 * the JPG export loop should serialise. Empty array means the cover
 * doesn't need any extra inset files (e.g. printed cover, or soft cover
 * with no decoration).
 *
 * The caller is responsible for running each canvas through toBlob with
 * quality 0.98, then setJpegDpi300 → embedSRGBProfile, and uploading
 * with the returned fileName.
 */
export async function renderInsetFiles(
  input: InsetRenderInput
): Promise<Array<{ fileName: string; canvas: HTMLCanvasElement }>> {
  const out: Array<{ fileName: string; canvas: HTMLCanvasElement }> = [];
  const front = FRONT_FACE_DIMS_MM[input.sizeKey] ?? FRONT_FACE_DIMS_MM['A4'];

  // No decoration = nothing to emit.
  if (!input.decoType || input.decoType === 'none') return out;

  // Helpers
  const resolvePhoto = async (): Promise<HTMLImageElement | null> => {
    const p = input.photos.find(x => x.id === input.photoId);
    if (!p?.preview) return null;
    return await loadImage(p.preview);
  };

  // === Acrylic insert ===========================================
  // decoVariant: 'acryl_100x100' | 'acryl_d145'
  if (input.decoType === 'acryl') {
    const img = await resolvePhoto();
    if (!img) return out; // nothing to render without a photo
    if (input.decoVariant === 'acryl_d145') {
      out.push({
        fileName: 'akryl_145.jpg',
        canvas: renderPhotoInsetCanvas(
          img, 145, 145,
          input.photoCropX ?? 50,
          input.photoCropY ?? 50,
          input.photoZoom ?? 1,
          input.photoRotation ?? 0,
          true, // circular clip
        ),
      });
    } else {
      // Default to 100×100 mm square
      out.push({
        fileName: 'akryl_100x100.jpg',
        canvas: renderPhotoInsetCanvas(
          img, 100, 100,
          input.photoCropX ?? 50,
          input.photoCropY ?? 50,
          input.photoZoom ?? 1,
          input.photoRotation ?? 0,
          false,
        ),
      });
    }
    return out;
  }

  // === Photo insert =============================================
  // decoVariant: 'foto_100x100' (single variant for now)
  if (input.decoType === 'photovstavka') {
    const img = await resolvePhoto();
    if (!img) return out;
    out.push({
      fileName: 'photo_100x100.jpg',
      canvas: renderPhotoInsetCanvas(
        img, 100, 100,
        input.photoCropX ?? 50,
        input.photoCropY ?? 50,
        input.photoZoom ?? 1,
        input.photoRotation ?? 0,
        false,
      ),
    });
    return out;
  }

  // === Metal plate ==============================================
  // Fixed 60×60 mm laser-engraving plate; black text on white.
  if (input.decoType === 'metal') {
    out.push({
      fileName: 'metal_60x60.jpg',
      canvas: renderTextInsetCanvas(
        input.decoText || '',
        60, 60,
        input.textFontFamily || 'Montserrat',
        18, // bigger font on a small plate so it reads well after engraving
        input.textX ?? 50,
        input.textY ?? 50,
      ),
    });
    return out;
  }

  // === Engraving on cover material ==============================
  // Black text on white, sized to the front face of the book.
  if (input.decoType === 'graviruvannya') {
    out.push({
      fileName: 'gravirovka.jpg',
      canvas: renderTextInsetCanvas(
        input.decoText || '',
        front.w, front.h,
        input.textFontFamily || 'Playfair Display',
        8,
        input.textX ?? 50,
        input.textY ?? 50,
      ),
    });
    return out;
  }

  // === Flex ====================================================
  // Heat-pressed coloured film; the printer still wants a single
  // black-on-white reference so they know exactly where the cut lines go.
  // Colour selection is communicated separately via the order options.
  if (input.decoType === 'flex') {
    out.push({
      fileName: 'flex.jpg',
      canvas: renderTextInsetCanvas(
        input.decoText || '',
        front.w, front.h,
        input.textFontFamily || 'Playfair Display',
        8,
        input.textX ?? 50,
        input.textY ?? 50,
      ),
    });
    return out;
  }

  return out;
}
