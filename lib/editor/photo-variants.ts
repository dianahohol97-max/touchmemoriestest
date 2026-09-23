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

type VariantKey = 'display' | 'thumb';
type VariantSpec = { key: VariantKey; maxEdge: number; quality: number };

const ALL_SPECS: VariantSpec[] = [
    { key: 'display', maxEdge: DISPLAY_MAX_EDGE, quality: DISPLAY_QUALITY },
    { key: 'thumb', maxEdge: THUMB_MAX_EDGE, quality: THUMB_QUALITY },
];

/**
 * Обидві копії з ОДНОГО розкодування.
 *
 * Розкодувати оригінал двічі коштує рівно стільки ж, скільки відкрити ще одне
 * фото, а таких фото в макеті бувають сотні.
 *
 * `only` звужує роботу до тих копій, яких справді бракує: коли одну з них
 * конструктор уже має готовою (див. `ensurePhotoVariants`), розкодування
 * оригіналу заради другої має рахувати тільки другу.
 */
export async function makeVariants(source: Blob, only?: VariantKey[]): Promise<Record<string, Blob>> {
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
        const specs = only ? ALL_SPECS.filter(s => only.includes(s.key)) : ALL_SPECS;
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
 * Копії, які конструктор уже зробив, поки відкривав фото.
 *
 * ЧОМУ ЦЕ ІСНУЄ. Нарізка з оригіналу коштувала 117 мс на знімок 12 Мп, і ці
 * мілісекунди платилися двічі за одне й те саме: імпорт уже розкодовує
 * оригінал і малює з нього `preview` рівно на 1600 px (`PREVIEW_MAX` у
 * BookLayoutEditor — те саме число, що `DISPLAY_MAX_EDGE`), а детектор фокуса
 * з того самого розкодування робить `thumb` рівно на 360 px (`THUMB_MAX_EDGE`).
 * Обидві копії вже лежать у `PhotoData`, і залишалося тільки не викидати їх:
 * узяти готові байти замість того, щоб розкодовувати 12 мегапікселів удруге.
 * Вимір на тридцяти знімках: 117 мс на фото стало 7 мс, тобто «Додати в
 * кошик» втрачає близько 5,6 секунди процесора, а перший прогін
 * автозбереження — усі свої кілька секунд горіння відразу після того, як
 * людина відпустила мишу.
 *
 * ЧОМУ ТІЛЬКИ `data:`. Підписане посилання у `preview` означає не копію, а
 * ОРИГІНАЛ із хмари: так виглядає фото зі старого макета, у якого копій ще
 * немає. Покласти його під імʼя `_display` означало б підсунути читачеві
 * дванадцять мегапікселів там, де він просить екранну копію, — тобто рівно та
 * повільність, від якої копії й рятують. Старі макети доганяє сервер
 * (`POST /api/projects/[id]/photo-variants`), і це правильне місце для них.
 * `data:` віддає тільки імпорт цієї сесії, тому перевірка на нього і є межею
 * між «копія» і «оригінал».
 */
export type ReadyVariantSources = {
    /** `preview` фото: копія на 1600 px, якщо її зробив імпорт (`data:image/…`). */
    display?: string;
    /** `thumb` фото: копія на 360 px від детектора фокуса (`data:image/…`). */
    thumb?: string;
    /** Сторони оригіналу в пікселях — щоб не робити копію, більшу за саме фото. */
    originalWidth?: number;
    originalHeight?: number;
    /** Вага оригіналу в байтах, коли вона відома. */
    originalBytes?: number;
};

/**
 * Байти готової копії, якщо їй можна вірити.
 *
 * PNG сюди не проходить: шляхи копій завжди закінчуються на `.jpg`, і покласти
 * під таким імʼям PNG означало б віддавати читачеві не той формат, який він
 * просить. Прозорість буває у графіці, не у знімках, тож такий рідкісний
 * випадок просто йде старим шляхом — через розкодування оригіналу.
 */
async function readyVariantBlob(url: string | undefined): Promise<Blob | null> {
    if (typeof url !== 'string' || !url.startsWith('data:image/')) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob || blob.size === 0 || blob.type !== 'image/jpeg') return null;
        return blob;
    } catch {
        return null;
    }
}

/**
 * Покласти обидві копії поруч із оригіналом і сказати, які шляхи вийшли.
 *
 * Помилка тут не має права зупинити збереження: без копії макет відкриється
 * так само повільно, як раніше, а от без оригіналу його не буде чим друкувати.
 *
 * `ready` — копії, які конструктор уже тримає в памʼяті. Чого в них немає,
 * те нарізається з `source` як раніше, і оригінал розкодовується лише тоді,
 * коли без нього справді не обійтися.
 */
export async function ensurePhotoVariants(
    sb: StorageLike,
    bucket: string,
    originalPath: string,
    source: Blob | string,
    ready?: ReadyVariantSources,
): Promise<PhotoVariantPaths> {
    const out: PhotoVariantPaths = {};
    if (!originalPath) return out;

    // Сторони оригіналу вирішують, чи копія взагалі потрібна. Раніше це знання
    // приходило з розкодування; тепер воно приходить із `PhotoData`, і саме це
    // дозволяє НЕ розкодовувати оригінал заради відповіді «копія не потрібна».
    const longestOriginal = Math.max(ready?.originalWidth || 0, ready?.originalHeight || 0);
    const wanted = (maxEdge: number) => !longestOriginal || shouldDownscale(longestOriginal, maxEdge);
    // Копія, важча за оригінал, не має сенсу ні для каналу, ні для памʼяті —
    // та сама умова, що й у makeVariants, тільки міряна проти відомої ваги.
    const lighterThanOriginal = (blob: Blob) => !ready?.originalBytes || blob.size < ready.originalBytes;

    const picked: Record<string, Blob> = {};
    if (wanted(DISPLAY_MAX_EDGE)) {
        const blob = await readyVariantBlob(ready?.display);
        if (blob && lighterThanOriginal(blob)) picked.display = blob;
    }
    if (wanted(THUMB_MAX_EDGE)) {
        const blob = await readyVariantBlob(ready?.thumb);
        if (blob && lighterThanOriginal(blob)) picked.thumb = blob;
    }

    const missing: VariantKey[] = [];
    if (wanted(DISPLAY_MAX_EDGE) && !picked.display) missing.push('display');
    if (wanted(THUMB_MAX_EDGE) && !picked.thumb) missing.push('thumb');

    if (missing.length > 0) {
        const bytes = await readPhotoBytes(source);
        if (bytes) {
            const made = await makeVariants(bytes, missing);
            for (const key of missing) if (made[key]) picked[key] = made[key];
        }
    }
    if (!picked.display && !picked.thumb) return out;

    const targets: Array<[keyof PhotoVariantPaths, string, Blob | undefined]> = [
        ['previewPath', displayPathFor(originalPath), picked.display],
        ['thumbPath', thumbPathFor(originalPath), picked.thumb],
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
