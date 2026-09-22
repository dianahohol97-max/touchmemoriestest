'use client';

import {
  SIGNATURE_BYTES,
  isBrowserRenderable,
  isRasterCandidate,
  sniffImageSignature,
  type ImageSignature,
} from './image-signature';

// Why this exists: iPhones save photos as HEIC/HEIF by default, and browsers
// can't render those in <img>. Before this helper, HEIC uploads showed as
// broken thumbnails (background) or were silently dropped (main photo upload).
// We convert them to JPEG client-side, lazy-loading the heic2any library only
// when a HEIC actually appears so the editor bundle stays light for everyone
// else.
//
// Ім'я файлу і MIME тут НЕ вирішують — вирішують перші байти (2026-09-22).
// TM-001343 і TM-001244 однієї клієнтки приїхали в друк майже порожніми: її
// знімки звалися `.jpg`, у сховищі лежали з написом `image/jpeg`, але були
// HEIC. Safari на її техніці читає HEIC рідно, тому і вона, і ми бачили
// бездоганний макет, а headless Chromium, яким рендериться друк, малював
// порожній слот. З сорока фото домалювалися рівно три — ті, що справді були
// JPEG. Правило звідси одне: у сховище їде або формат, який читає будь-який
// браузер, або байти, які ми перемалювали самі.

/** Довга сторона перемальованого майстра. A3 @ 300 DPI = 4961 px. */
const REDRAW_MAX_EDGE = 5000;
/** Стеля для HEIC: 48-мегапіксельний знімок інакше рве пам'ять на телефоні. */
const HEIC_MAX_EDGE = 4000;

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

/** Формат за першими байтами; `null`, якщо файл не вдалося прочитати. */
export async function readImageSignature(file: File | Blob): Promise<ImageSignature | null> {
  try {
    const head = await file.slice(0, SIGNATURE_BYTES).arrayBuffer();
    return sniffImageSignature(new Uint8Array(head));
  } catch {
    return null;
  }
}

const jpegName = (file: File): string =>
  (file.name || 'photo').replace(/\.(heic|heif|tiff?|bmp|avif)$/i, '.jpg');

/**
 * Перемалювати файл у JPEG руками самого браузера.
 *
 * Тут важливо, ЧИЙ це браузер: перемальовує той самий браузер, який щойно
 * показав знімок клієнтці. Тобто декодер, який точно впорався, віддає байти,
 * які потім прочитає будь-який інший — саме це й лікує порожні аркуші.
 */
async function redrawAsJpeg(file: File, maxEdge: number, quality: number): Promise<File> {
  if (typeof document === 'undefined') throw new Error('no document');
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<File>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx || !w || !h) { reject(new Error('no canvas / zero size')); return; }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((b) => {
            // Полотно звільняємо одразу: на телефоні кілька таких підряд
            // з'їдають пам'ять швидше, ніж встигає прибиральник.
            canvas.width = 0;
            canvas.height = 0;
            if (b && b.size > 0) {
              resolve(new File([b], jpegName(file), { type: 'image/jpeg', lastModified: file.lastModified }));
            } else {
              reject(new Error('canvas toBlob empty'));
            }
          }, 'image/jpeg', quality);
        } catch (err) { reject(err); }
      };
      img.onerror = () => reject(new Error('browser cannot decode this image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns a browser-renderable image File.
 *
 * Рішення ухвалюється за першими байтами файлу, і гілок три:
 *
 *   1. HEIC/HEIF — конвертуємо в JPEG. Відмова тут жорстка (`HeicConversionError`),
 *      бо нечитабельний знімок краще не зберегти взагалі, ніж зберегти таким,
 *      що виглядає справним до самого друку.
 *   2. Формат, який читає будь-який браузер (JPEG, PNG, WebP, GIF, AVIF, BMP) —
 *      віддаємо байт у байт. Перекодовувати камерний JPEG НЕ МОЖНА: подвійне
 *      стиснення і є та сама «розмитість», яку ми вже одного разу ловили.
 *   3. Усе інше растрове — перемальовуємо через canvas. Сюди потрапляє те, чого
 *      ми не впізнали: якщо браузер клієнтки це показує, ми забираємо картинку
 *      з нього і зберігаємо вже нормальним JPEG.
 *
 * PDF і SVG проходять недоторканими, бо через ці самі завантажувачі їдуть і
 * вони. Коли байти прочитати не вдалося, лишається стара поведінка за іменем
 * і MIME — гірше, ніж було, від цього не стає.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  const signature = await readImageSignature(file);

  // Байти вирішують, але ім'я і MIME лишаються запобіжником: файл, названий
  // `.heic`, байти якого ми не впізнали, мусить і далі йти жорсткою гілкою з
  // відмовою, а не м'яким перемальовуванням. Якщо ж усередині виявився
  // справжній JPEG, ім'я більше нічого не вирішує і файл проходить як є.
  const looksHeic = signature === 'heic'
    || (isHeic(file) && (signature === null || !isBrowserRenderable(signature)));
  if (!looksHeic) {
    if (!signature) return file;                      // байти не прочиталися — лишається стара поведінка
    if (isBrowserRenderable(signature)) return file;  // камерний JPEG недоторканий
    if (!isRasterCandidate(signature)) return file;   // PDF, SVG
    // Лишається нерозпізнане. Перемальовуємо м'яко: через цей самий шлях
    // ходять і не картинки (json, text), тож відмова canvas означає «лиши як
    // було», а не помилку — інакше зламався б завантажувач, який зараз працює.
    try {
      return await redrawAsJpeg(file, REDRAW_MAX_EDGE, 0.95);
    } catch (e) {
      console.warn('[normalizeImageFile] не вдалося перемалювати файл:', e);
      return file;
    }
  }

  const newName = (file.name || 'photo').replace(/\.(heic|heif)$/i, '.jpg');

  // 1) Primary: heic2any. Works for most iPhone HEIC. It's single-threaded and
  // memory-hungry, so very large HEIC (48MP iPhones, ~8000px) can make it throw
  // or hang — the catch below falls through to the browser-native path.
  try {
    const mod: any = await import('heic2any');
    const heic2any = mod.default || mod;
    const out: Blob | Blob[] = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const blob: Blob = Array.isArray(out) ? out[0] : out;
    if (blob && blob.size > 0) {
      return new File([blob], newName, { type: 'image/jpeg', lastModified: file.lastModified });
    }
    throw new Error('heic2any returned empty blob');
  } catch (e) {
    console.warn('heic2any failed, trying canvas fallback:', e);
  }

  // 2) Fallback: some browsers (Safari, newer Chrome on macOS, iOS Safari) can
  // decode HEIC natively. Draw it onto a canvas and export JPEG. This is often
  // the one that saves iPhone users — mobile Safari decodes HEIC natively.
  try {
    return await redrawAsJpeg(file, HEIC_MAX_EDGE, 0.9);
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
