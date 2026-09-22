'use client';

import {
  SIGNATURE_BYTES,
  sniffImageSignature,
  isBrowserRenderable,
  isRasterCandidate,
  type ImageSignature,
} from './image-signature';

// Why this exists: iPhones save photos as HEIC/HEIF by default, and browsers
// can't render those in <img>. Before this helper, HEIC uploads showed as
// broken thumbnails (background) or were silently dropped (main photo upload).
// We convert them to JPEG client-side, lazy-loading the heic2any library only
// when a HEIC actually appears so the editor bundle stays light for everyone
// else.
//
// Рішення приймається ЗА БАЙТАМИ (2026-09-22). До того воно приймалося за
// MIME і розширенням, і на цьому лягли TM-001343 та TM-001244: знімки клієнтки
// були HEIC під іменем `.jpg`, isHeic() їх не впізнавала, конвертації не було,
// і в друк поїхали порожні аркуші. Ім'я і MIME лишилися запобіжником, але
// першим говорить вміст файлу.

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
 * Перші байти файлу — або null, якщо прочитати не вдалося.
 *
 * Читається рівно SIGNATURE_BYTES через file.slice(): браузер не тягне весь
 * файл у пам'ять заради тридцяти двох байтів, тож це дешево навіть для
 * сорока знімків поспіль.
 */
export async function readImageSignature(file: File): Promise<ImageSignature | null> {
  try {
    const head = file.slice(0, SIGNATURE_BYTES);
    const buf = await head.arrayBuffer();
    return sniffImageSignature(new Uint8Array(buf));
  } catch {
    // Файл зник між вибором і читанням, або середовище без slice/arrayBuffer.
    return null;
  }
}

/**
 * Чи треба цей файл конвертувати жорсткою гілкою HEIC.
 *
 * Одна умова на два місця: тут вирішується конвертація, а в конструкторі за
 * нею ж рахується тост «Конвертую N фото з iPhone…». Якби умови були дві,
 * вони б розійшлися, і набір таких файлів конвертувався б хвилину-дві в
 * цілковитій тиші.
 *
 * Ім'я і MIME лишаються запобіжником: файл, названий `.heic`, байти якого ми
 * не впізнали, іде сюди ж, а справжній JPEG під іменем `.heic` проходить як є.
 */
export function needsHeicConversion(file: File, signature: ImageSignature | null): boolean {
  return signature === 'heic'
    || (isHeic(file) && (signature === null || !isBrowserRenderable(signature)));
}

function jpegName(file: File): string {
  const base = file.name || 'photo';
  if (/\.jpe?g$/i.test(base)) return base;
  return `${base.replace(/\.[^./\\]*$/, '')}.jpg`;
}

/**
 * Намалювати файл на canvas і віддати JPEG.
 *
 * Спільний хелпер обох гілок нормалізації. Canvas звільняється одразу
 * (`canvas.width = 0`): полотно на 5000 px тримає близько ста мегабайтів, і
 * сорок знімків поспіль без цього кладуть вкладку на телефоні.
 */
export async function redrawAsJpeg(file: File, maxEdge: number, quality: number): Promise<File> {
  const newName = jpegName(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<File>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let canvas: HTMLCanvasElement | null = null;
        const release = () => {
          if (canvas) { canvas.width = 0; canvas.height = 0; canvas = null; }
        };
        try {
          const longest = Math.max(img.naturalWidth, img.naturalHeight);
          if (!longest) { reject(new Error('zero-size image')); return; }
          const scale = Math.min(1, maxEdge / longest);
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { release(); reject(new Error('no canvas 2d context')); return; }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((b) => {
            release();
            if (b && b.size > 0) {
              resolve(new File([b], newName, { type: 'image/jpeg', lastModified: file.lastModified }));
            } else {
              reject(new Error('canvas toBlob empty'));
            }
          }, 'image/jpeg', quality);
        } catch (err) {
          release();
          reject(err);
        }
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
 * Гілок три, і рішення між ними приймають БАЙТИ:
 *
 *   1. HEIC — конвертується. Спершу heic2any, потім малювання на canvas; на
 *      повній відмові кидається HeicConversionError. Ця жорсткість свідома:
 *      нечитабельний знімок краще не зберегти взагалі, ніж покласти в макет
 *      файл, якого рендер не намалює.
 *   2. Формат, який браузер малює сам (jpeg, png, webp, gif, avif, bmp), —
 *      віддається БАЙТ У БАЙТ. Перекодовувати камерний JPEG не можна: це
 *      подвійне стиснення, воно помітно розмиває краї, і ту «розмитість» ми
 *      вже одного разу прибирали.
 *   3. Решта растрового йде через canvas. Відмова тут М'ЯКА, з поверненням
 *      оригіналу, бо цим самим шляхом (prepareImageForUpload у
 *      lib/storage-upload.ts) ходять json, text і pdf.
 *
 * PDF і SVG не чіпаються взагалі.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  const signature = await readImageSignature(file);

  if (needsHeicConversion(file, signature)) {
    // 1) Primary: heic2any. Works for most iPhone HEIC. It's single-threaded and
    // memory-hungry, so very large HEIC (48MP iPhones, ~8000px) can make it throw
    // or hang — the catch below falls through to the browser-native path.
    const newName = jpegName(file);
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
    // Сторона обмежена 4000 px, щоб 48-мегапіксельний HEIC не з'їв пам'ять
    // полотна на телефоні (мовчазно порожній blob).
    try {
      return await redrawAsJpeg(file, 4000, 0.9);
    } catch (e2) {
      console.error('HEIC → JPEG conversion failed (both methods):', e2);
      // Hard fail: do NOT silently upload an unrenderable HEIC. The caller shows
      // a friendly error and the photo simply isn't saved as broken.
      throw new HeicConversionError();
    }
  }

  // PDF і SVG — не наша справа, віддаємо як є.
  if (signature !== null && !isRasterCandidate(signature)) return file;

  // Браузер це намалює сам — жодного перекодування.
  if (signature !== null && isBrowserRenderable(signature)) return file;

  // Усе інше растрове: спробувати перемалювати, і тихо віддати оригінал, якщо
  // це взагалі не картинка.
  try {
    return await redrawAsJpeg(file, 5000, 0.95);
  } catch {
    return file;
  }
}

export class HeicConversionError extends Error {
  constructor() {
    super('HEIC_CONVERSION_FAILED');
    this.name = 'HeicConversionError';
  }
}
