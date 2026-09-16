'use client';

import { normalizeImageFile, HeicConversionError } from '@/lib/heic-to-jpeg';
import { JPEG_QUALITY, MAX_LONG_EDGE } from './config';

// Підготовка фото гостя до відправки.
//
// ЧОМУ СТИСКАЄМО НА КЛІЄНТІ, А НЕ НА СЕРВЕРІ. Весільний Wi-Fi ділять сто
// гостей, і вузьке місце тут — канал, а не процесор. Стиснення на сервері
// економило б лише місце в бакеті, тоді як фото все одно їхало б оригіналом:
// вісім мегабайт замість одного, двадцять разів поспіль, з телефона в підвалі
// ресторану. Тому зменшуємо ДО відправки, а не після.
//
// ЧОМУ HEIC ТЕЖ НА КЛІЄНТІ. Серверний шлях вимагав би libheif або sharp зі
// збіркою під HEIF, а sharp у Vercel цього не вміє з коробки. У проєкті вже є
// heic-to-jpeg: heic2any, а якщо він не впорається — нативний декодер браузера
// через canvas. Саме той запасний шлях і рятує iPhone, бо Safari читає HEIC
// сам. Додаткова вигода: після конвертації фото одразу стискається тут же,
// тобто HEIC на 20 МБ ніколи не торкається мережі.

export interface PreparedPhoto {
  file: File;
  width: number;
  height: number;
}

/**
 * HEIC → JPEG, далі зменшення довшої сторони до MAX_LONG_EDGE.
 *
 * Кидає HeicConversionError, якщо HEIC не піддався жодним способом — тоді
 * викликач показує зрозуміле повідомлення, а не мовчки кладе в бакет файл,
 * який потім ніде не відкриється.
 *
 * Розміри повертаються завжди, навіть коли стискати не довелося: галерея
 * ставить ними співвідношення сторін у сітці, і без них плитки стрибають, поки
 * фото вантажаться.
 */
export async function preparePhoto(input: File): Promise<PreparedPhoto> {
  // Кидає HeicConversionError, якщо обидва шляхи конвертації відмовили.
  const normalized = await normalizeImageFile(input);

  const bitmap = await decode(normalized);
  // У HTMLImageElement width/height — це розмір для верстки, і він збігається з
  // природним лише поки атрибути не виставлені. Питаємо natural*, коли він є.
  const srcW = (bitmap as HTMLImageElement).naturalWidth || bitmap.width;
  const srcH = (bitmap as HTMLImageElement).naturalHeight || bitmap.height;

  const longEdge = Math.max(srcW, srcH);
  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  // Фото вже в межах і вже JPEG — чіпати його немає навіщо. Перекодування
  // тільки заради однакового шляху в коді вдруге стиснуло б те, що вже
  // стиснене, і зробило б його мʼякшим без жодної вигоди.
  if (scale === 1 && normalized.type === 'image/jpeg') {
    close(bitmap);
    return { file: normalized, width, height };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Полотно не виділилося — на старому телефоні таке буває. Краще надіслати
    // оригінал повільно, ніж не надіслати взагалі.
    close(bitmap);
    return { file: normalized, width: srcW, height: srcH };
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  close(bitmap);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );

  // Порожній blob або несподівано більший за оригінал — обидва випадки означають,
  // що стиснення не допомогло. Відправляємо те, що було.
  if (!blob || blob.size === 0 || blob.size >= normalized.size) {
    return { file: normalized, width: srcW, height: srcH };
  }

  const name = normalized.name.replace(/\.(jpe?g|png|webp|heic|heif)$/i, '') || 'photo';
  const file = new File([blob], `${name}.jpg`, {
    type: 'image/jpeg',
    lastModified: normalized.lastModified,
  });
  return { file, width, height };
}

export { HeicConversionError };

/**
 * createImageBitmap там, де він є, і <img> як запасний шлях.
 *
 * Bitmap економить памʼять (декодування поза головним потоком), і на телефоні
 * це різниця між двадцятьма фото поспіль і вкладкою, яку браузер перезавантажив
 * посеред завантаження. Але Safari довго не мав його для частини форматів, тож
 * запасний шлях лишається.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Формат, який bitmap не взяв. Нижче спробує <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function close(bitmap: ImageBitmap | HTMLImageElement) {
  if (typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap) bitmap.close();
}
