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
  /** Кадр-обкладинка. Буває лише у відео. */
  poster?: Blob | null;
  /** Тривалість ролика в секундах. */
  durationSeconds?: number | null;
}

export const isVideoFile = (file: File) => (file.type || '').toLowerCase().startsWith('video/');

/**
 * Готує будь-який файл гостя: фото стискає, відео лишає як є і знімає обкладинку.
 *
 * ВІДЕО МИ НЕ ЧІПАЄМО. Перекодувати його в браузері можна хіба
 * WebCodecs, який на телефонах або відсутній, або зʼїдає батарею і кілька
 * хвилин часу — а гість за цей час закриє вкладку. Тому ролик летить
 * оригіналом, і межа для нього окрема, 200 МБ.
 */
export async function prepareMedia(input: File): Promise<PreparedPhoto> {
  if (isVideoFile(input)) return prepareVideo(input);
  return preparePhoto(input);
}

/**
 * Знімає перший придатний кадр ролика й міряє тривалість.
 *
 * НАВІЩО. Без обкладинки плитка в сітці або чорна, або мусить тягнути сам
 * ролик заради першого кадру — півсотні таких плиток на телефоні це десятки
 * мегабайтів заради картинок, які гість, може, й не відкриє.
 *
 * Кадр беремо не з нуля, а трохи згодом: найперший кадр у відео з телефона
 * часто чорний, бо камера ще не встигла виставити експозицію.
 */
async function prepareVideo(file: File): Promise<PreparedPhoto> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  // Без цього iOS відкриває ролик на весь екран замість того, щоб віддати кадр.
  video.playsInline = true;

  try {
    const meta = await new Promise<{ width: number; height: number; duration: number }>(
      (resolve, reject) => {
        video.onloadedmetadata = () =>
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: Number.isFinite(video.duration) ? video.duration : 0,
          });
        video.onerror = () => reject(new Error('VIDEO_DECODE_FAILED'));
        video.src = url;
      }
    );

    const poster = await grabFrame(video, Math.min(0.5, Math.max(0, meta.duration - 0.1)));

    return {
      file,
      width: meta.width || 0,
      height: meta.height || 0,
      poster,
      durationSeconds: meta.duration || null,
    };
  } catch {
    // Браузер не дав ані розмірів, ані кадру. Ролик усе одно вартий того, щоб
    // його надіслати: пара побачить його в альбомі, просто плитка буде порожня.
    return { file, width: 0, height: 0, poster: null, durationSeconds: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function grabFrame(video: HTMLVideoElement, at: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const draw = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.width || !canvas.height) {
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      } catch {
        resolve(null);
      }
    };

    video.onseeked = draw;
    video.onerror = () => resolve(null);
    try {
      video.currentTime = at;
    } catch {
      resolve(null);
    }
    // Перемотка на деяких телефонах не звітує ніколи. Без цього запобіжника
    // черга завантаження зупинилася б назавжди на одному ролику.
    setTimeout(() => resolve(null), 5000);
  });
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
