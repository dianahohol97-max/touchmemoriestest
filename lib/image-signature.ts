/**
 * Який насправді формат у цього файлу — за байтами, а не за назвою.
 *
 * Чому це окремий модуль без DOM і без 'use client': ту саму відповідь треба
 * знати і в браузері (перед конвертацією), і в тесті, і колись на сервері.
 * Тут немає ні canvas, ні File, ні fetch — тільки перші байти.
 *
 * Історія, яка цього вимагала: TM-001343 поїхало в друк одинадцятьма
 * порожніми аркушами з чотирнадцяти, бо клієнтка завантажила HEIC під іменем
 * `.jpg`. Ім'я і MIME брехали обидва, ми вірили їм обом, і жодна перевірка не
 * подивилася всередину файлу. Safari на її техніці HEIC декодує рідно, тож
 * макет і в неї, і в нас в адмінці виглядав справним; headless Chromium, яким
 * рендериться друк, такого не читає.
 */

/** Скільки байтів треба прочитати, щоб відповісти на питання. */
export const SIGNATURE_BYTES = 32;

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

/**
 * Марки контейнера ISO-BMFF, які означають AVIF.
 *
 * Перевіряються ПЕРШИМИ і це принципово: `mif1` та `msf1` носить і AVIF теж,
 * тож набір HEIC, перевірений раніше, забрав би з собою частину AVIF. AVIF
 * браузери читають, і перекодовувати його немає жодної причини.
 */
const AVIF_BRANDS = new Set(['avif', 'avis']);

/** Марки того самого контейнера, які означають HEIC/HEIF. */
const HEIC_BRANDS = new Set([
    'heic', 'heix', 'heim', 'heis',
    'hevc', 'hevx', 'hevm', 'hevs',
    'mif1', 'msf1',
]);

/** Формати, які браузер малює в `<img>` сам. */
const BROWSER_RENDERABLE = new Set<ImageSignature>(['jpeg', 'png', 'webp', 'gif', 'avif', 'bmp']);

/** Рядок ASCII з байтів; порожній, якщо байтів забракло. */
function ascii(bytes: Uint8Array, at: number, len: number): string {
    if (bytes.length < at + len) return '';
    let out = '';
    for (let i = at; i < at + len; i++) out += String.fromCharCode(bytes[i]);
    return out;
}

function startsWithBytes(bytes: Uint8Array, expected: number[]): boolean {
    if (bytes.length < expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
        if (bytes[i] !== expected[i]) return false;
    }
    return true;
}

/**
 * Марка контейнера ISO-BMFF: основна з байтів 8..12 плюс сумісні четвірками
 * від зсуву 16. Файл заявляє себе кількома марками одразу, і достатньо однієї
 * впізнаної, тому дивимося на весь список.
 */
function isoBmffBrands(bytes: Uint8Array): string[] {
    const brands: string[] = [];
    const major = ascii(bytes, 8, 4).toLowerCase();
    if (major) brands.push(major);
    for (let at = 16; at + 4 <= bytes.length; at += 4) {
        const brand = ascii(bytes, at, 4).toLowerCase();
        if (brand.trim()) brands.push(brand);
    }
    return brands;
}

/** Чи схожий початок файлу на SVG — після BOM і пробілів. */
function looksLikeSvg(bytes: Uint8Array): boolean {
    let at = 0;
    if (startsWithBytes(bytes, [0xef, 0xbb, 0xbf])) at = 3; // UTF-8 BOM
    while (at < bytes.length) {
        const b = bytes[at];
        // пробіл, таб, перенесення рядка, повернення каретки
        if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) at++;
        else break;
    }
    const head = ascii(bytes, at, 5).toLowerCase();
    return head.startsWith('<svg') || head.startsWith('<?xml');
}

/**
 * Що це за файл за першими байтами.
 *
 * Повертає 'unknown' там, де впізнати не вдалося, і НЕ вгадує за назвою:
 * здогадка тут коштувала б рівно стільки ж, скільки коштувала довіра до
 * розширення.
 */
export function sniffImageSignature(bytes: Uint8Array): ImageSignature {
    if (!bytes || bytes.length < 4) return 'unknown';

    // JPEG: FF D8 FF
    if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';

    // GIF87a / GIF89a
    if (ascii(bytes, 0, 4) === 'GIF8') return 'gif';

    // RIFF....WEBP
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';

    // BMP
    if (ascii(bytes, 0, 2) === 'BM') return 'bmp';

    // PDF
    if (ascii(bytes, 0, 4) === '%PDF') return 'pdf';

    // ISO-BMFF: 'ftyp' на зсуві 4. AVIF ПЕРШИМ — див. AVIF_BRANDS.
    if (ascii(bytes, 4, 4) === 'ftyp') {
        const brands = isoBmffBrands(bytes);
        if (brands.some(b => AVIF_BRANDS.has(b))) return 'avif';
        if (brands.some(b => HEIC_BRANDS.has(b))) return 'heic';
        return 'unknown';
    }

    if (looksLikeSvg(bytes)) return 'svg';

    return 'unknown';
}

/** Чи намалює це браузер у `<img>` без нашої допомоги. */
export function isBrowserRenderable(sig: ImageSignature): boolean {
    return BROWSER_RENDERABLE.has(sig);
}

/**
 * Чи має сенс намагатися перемалювати це в JPEG.
 *
 * Хибна для pdf і svg: перший — документ, другий — вектор, і обидва ходять
 * тим самим шляхом підготовки файлу, що й фотографії.
 */
export function isRasterCandidate(sig: ImageSignature): boolean {
    return sig !== 'pdf' && sig !== 'svg';
}
