'use client';

import {
    DISPLAY_MAX_EDGE,
    DISPLAY_QUALITY,
    THUMB_MAX_EDGE,
    THUMB_QUALITY,
    displayPathFor,
    thumbPathFor,
    shouldDownscale,
    type PhotoVariantPaths,
} from './photo-variant-paths';

/**
 * Дві зменшені копії кожного фото, щоб відкритий макет не тягнув оригінали.
 *
 * ЧОМУ ЦЕ ІСНУЄ. Збережений макет зберігає в `uploaded_photos` лише шлях до
 * оригіналу, і на повторному відкритті конструктор підписує саме його. Для
 * TM-001342 це означало 68 знімків загальною вагою 184 МБ, які браузер тягнув
 * і розкодовував заради стрічки мініатюр і однієї відкритої сторінки. Клієнтка
 * порахувала за нас: «13 минут прошло, а загрузилось только 14 из 67», і вона
 * ж поставила правильне питання, чому взагалі вантажаться всі 67, якщо в
 * макеті стоїть 41. Вага тут навіть не головна біда: кожен оригінал це близько
 * дванадцяти мегапікселів, тобто майже пʼятдесят мегабайтів растру в памʼяті,
 * і шість десятків таких розкодувань вішають вкладку незалежно від каналу.
 *
 * ЧОМУ ЦЕ БЕЗПЕЧНО ДЛЯ ДРУКУ. Клієнтський знімок екрана через html2canvas
 * вимкнено (`SKIP_CLIENT_HTML2CANVAS` у BookLayoutEditor), макет для друку
 * повністю збирає сервіс на Railway і бере він оригінали зі сховища за полем
 * `path`. Тобто те, що бачить браузер, і те, що йде в друк, це вже різні файли.
 * Зменшені копії живуть поруч із оригіналом і НІКОЛИ не заміняють його в
 * `path` — саме тому нижче немає жодної функції, яка перезаписує оригінал.
 *
 * 1600 пікселів по довгій стороні обрано під найбільший розворот, який
 * конструктор малює на екрані, з запасом на екрани з подвійною щільністю.
 * 360 пікселів це стрічка фото, навігатор сторінок і картка дизайну в кабінеті,
 * де зображення ніколи не більше за сотню пікселів.
 */

export {
    DISPLAY_MAX_EDGE,
    DISPLAY_QUALITY,
    THUMB_MAX_EDGE,
    THUMB_QUALITY,
    displayPathFor,
    thumbPathFor,
    shouldDownscale,
} from './photo-variant-paths';
export type { PhotoVariantPaths } from './photo-variant-paths';

type VariantSpec = { key: 'display' | 'thumb'; maxEdge: number; quality: number };

/**
 * Обидві копії з ОДНОГО розкодування.
 *
 * Розкодувати оригінал двічі коштує рівно стільки ж, скільки відкрити ще одне
 * фото, а таких фото в макеті бувають сотні.
 */
export async function makeVariants(source: Blob): Promise<Record<string, Blob>> {
    const out: Record<string, Blob> = {};
    if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return out;
    if (!source || !source.size) return out;

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
    } catch {
        return out;
    }

    try {
        const longest = Math.max(bitmap.width, bitmap.height);
        if (!(longest > 0)) return out;
        const specs: VariantSpec[] = [
            { key: 'display', maxEdge: DISPLAY_MAX_EDGE, quality: DISPLAY_QUALITY },
            { key: 'thumb', maxEdge: THUMB_MAX_EDGE, quality: THUMB_QUALITY },
        ];
        for (const spec of specs) {
            if (!shouldDownscale(longest, spec.maxEdge)) continue;
            const scale = spec.maxEdge / longest;
            const w = Math.max(1, Math.round(bitmap.width * scale));
            const h = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            ctx.drawImage(bitmap, 0, 0, w, h);
            const blob: Blob | null = await new Promise(resolve => {
                canvas.toBlob(b => resolve(b), 'image/jpeg', spec.quality);
            });
            // Копія, важча за оригінал, не має сенсу ні для каналу, ні для памʼяті.
            if (blob && blob.size > 0 && blob.size < source.size) out[spec.key] = blob;
        }
    } catch {
        /* одна зіпсована картинка не має зупиняти збереження решти */
    } finally {
        try { bitmap.close?.(); } catch {}
    }
    return out;
}

/** Байти фото з того, що є під рукою: файл із вводу або вже завантажений URL. */
export async function readPhotoBytes(source: Blob | string): Promise<Blob | null> {
    try {
        if (typeof source !== 'string') return source;
        if (!source || source.startsWith('data:image/svg')) return null;
        const res = await fetch(source);
        if (!res.ok) return null;
        const blob = await res.blob();
        return blob && blob.size > 0 ? blob : null;
    } catch {
        return null;
    }
}

type StorageLike = { storage: { from: (bucket: string) => any } };

/**
 * Покласти обидві копії поруч із оригіналом і сказати, які шляхи вийшли.
 *
 * Помилка тут не має права зупинити збереження: без копії макет відкриється
 * так само повільно, як раніше, а от без оригіналу його не буде чим друкувати.
 */
export async function ensurePhotoVariants(
    sb: StorageLike,
    bucket: string,
    originalPath: string,
    source: Blob | string,
): Promise<PhotoVariantPaths> {
    const out: PhotoVariantPaths = {};
    if (!originalPath) return out;
    const bytes = await readPhotoBytes(source);
    if (!bytes) return out;

    const variants = await makeVariants(bytes);
    const targets: Array<[keyof PhotoVariantPaths, string, Blob | undefined]> = [
        ['previewPath', displayPathFor(originalPath), variants.display],
        ['thumbPath', thumbPathFor(originalPath), variants.thumb],
    ];

    for (const [field, path, blob] of targets) {
        if (!blob) continue;
        try {
            const { error } = await sb.storage.from(bucket).upload(path, blob, {
                cacheControl: '31536000',
                upsert: true,
                contentType: 'image/jpeg',
            });
            if (!error) out[field] = path;
        } catch {
            /* копія не обовʼязкова — оригінал уже в сховищі */
        }
    }
    return out;
}
