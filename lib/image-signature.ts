/**
 * Який формат НАСПРАВДІ лежить у файлі.
 *
 * Ім'я файлу і MIME, який віддає браузер, — це те, що написано на конверті, а
 * не те, що всередині. TM-001343 і TM-001244 приїхали в друк порожніми
 * аркушами саме через цю різницю: фотографії з айфона звалися `.jpg`, у
 * сховищі лежали з написом `image/jpeg`, у Safari клієнтки малювалися
 * бездоганно, а всередині були HEIC. Chromium на Railway такого не читає, тож
 * рендер поставив порожній слот там, де мало бути фото, і зробив це мовчки.
 *
 * Модуль навмисно чистий: жодного DOM, жодного `window`. Розбір сигнатури
 * перевіряється тестами на байтах (`tests/image-signature.test.ts`), бо саме
 * тут помилка коштує цілого замовлення.
 */

export type ImageSignature =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'avif'
  | 'bmp'
  | 'heic'
  | 'pdf'
  | 'svg'
  | 'unknown';

/** Скільки байтів з початку файлу треба прочитати, щоб упізнати формат. */
export const SIGNATURE_BYTES = 32;

/**
 * Марки ISO-BMFF, за якими контейнер є HEIC/HEIF.
 *
 * `mif1` і `msf1` — загальні марки того самого контейнера, і їх носить також
 * AVIF, тож AVIF перевіряється ПЕРШИМ (див. нижче). Помилитися тут у той бік
 * означало б перекодовувати AVIF, який браузер і так читає.
 */
const HEIF_BRANDS = new Set([
  'heic', 'heix', 'heim', 'heis',
  'hevc', 'hevx', 'hevm', 'hevs',
  'mif1', 'msf1',
]);

const AVIF_BRANDS = new Set(['avif', 'avis']);

const ascii = (bytes: Uint8Array, from: number, to: number): string => {
  let out = '';
  for (let i = from; i < to && i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
};

const startsWith = (bytes: Uint8Array, expected: number[]): boolean =>
  bytes.length >= expected.length && expected.every((b, i) => bytes[i] === b);

/**
 * Марки контейнера ISO-BMFF: основна (байти 8–12) плюс сумісні, що йдуть
 * четвірками після номера версії. Читаємо рівно стільки, скільки дав заголовок.
 */
function isoBrands(bytes: Uint8Array): string[] {
  const brands = [ascii(bytes, 8, 12)];
  for (let i = 16; i + 4 <= bytes.length; i += 4) brands.push(ascii(bytes, i, i + 4));
  return brands.map(b => b.toLowerCase());
}

/**
 * Формат за першими байтами. `unknown` означає «ми цього не впізнали» — це не
 * діагноз файлу, а чесна відповідь, з якої викликач робить свій висновок.
 */
export function sniffImageSignature(bytes: Uint8Array): ImageSignature {
  if (!bytes || bytes.length < 4) return 'unknown';

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 2) === 'BM') return 'bmp';
  if (ascii(bytes, 0, 4) === '%PDF') return 'pdf';

  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brands = isoBrands(bytes);
    // AVIF першим: він носить ті самі загальні марки, що й HEIF, а браузери
    // його читають — перекодовувати його не треба і не можна.
    if (brands.some(b => AVIF_BRANDS.has(b))) return 'avif';
    if (brands.some(b => HEIF_BRANDS.has(b))) return 'heic';
    return 'unknown';
  }

  // SVG — це текст, і починається він або з розмітки, або з оголошення XML.
  // BOM і пробіли попереду трапляються, тож їх пропускаємо.
  const head = ascii(bytes, 0, Math.min(bytes.length, SIGNATURE_BYTES))
    .replace(/^﻿/, '')
    .trimStart()
    .toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'svg';

  return 'unknown';
}

/**
 * Чи намалює це будь-який браузер без нашої допомоги.
 *
 * Питання саме про браузер, а не про «правильність» файлу: макет для друку
 * знімає headless Chromium, і все, що він не читає, стає порожнім аркушем.
 */
export function isBrowserRenderable(signature: ImageSignature): boolean {
  return signature === 'jpeg'
    || signature === 'png'
    || signature === 'webp'
    || signature === 'gif'
    || signature === 'avif'
    || signature === 'bmp';
}

/**
 * Чи це взагалі растрове зображення, яке має сенс перемальовувати.
 *
 * PDF і SVG не чіпаємо: перший іде в друк як є, другий після canvas перестав
 * би бути векторним. Обидва проходять через ті самі завантажувачі.
 */
export function isRasterCandidate(signature: ImageSignature): boolean {
  return signature !== 'pdf' && signature !== 'svg';
}
