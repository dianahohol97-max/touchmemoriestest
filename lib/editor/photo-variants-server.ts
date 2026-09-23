import sharp from 'sharp';
import {
    DISPLAY_MAX_EDGE,
    DISPLAY_QUALITY,
    THUMB_MAX_EDGE,
    THUMB_QUALITY,
    displayPathFor,
    thumbPathFor,
    photoNeedsVariants,
    missingVariantsOf,
    type VariantField,
} from './photo-variant-paths';

/**
 * Зменшені копії фото, зроблені на сервері.
 *
 * ЧОМУ ЦЕ ПОТРІБНО ОКРЕМО ВІД БРАУЗЕРА. Копії робить конструктор під час
 * збереження, і для всього нового цього досить. Але макети, збережені до того,
 * як копії зʼявилися, копій не мають, а зробити їх у браузері можна лише
 * ЗАВАНТАЖИВШИ оригінали — тобто рівно ту роботу, від якої ми тікаємо. Для
 * TM-001342 це 68 знімків на 184 МБ і тринадцять хвилин чекання, після яких
 * копії нарешті зʼявляться. Клієнтка вже чекала один раз, і просити її почекати
 * ще раз заради нашого зручного рішення було б дивно.
 *
 * Сервер бере ті самі байти зі сховища по швидкому внутрішньому каналу, ріже їх
 * через sharp і кладе копії поруч. Сорок фото на прохід — це секунд тридцять,
 * і клієнт бачить чесне «готуємо фото» замість мовчазних тринадцяти хвилин.
 *
 * ОРИГІНАЛ НЕ ЧІПАЄТЬСЯ. Шлях у `path` лишається тим самим: макет для друку
 * збирає Railway саме з нього, і жодна функція тут не пише за цим шляхом.
 */

const BUCKET = 'photobook-uploads';

/** Скільки фото беремо в один прохід, щоб укластися в час функції. */
export const VARIANTS_BATCH = 40;

/** Скільки ріжемо одночасно. Кожен sharp тримає розпакований кадр у памʼяті. */
const CONCURRENCY = 4;

export type PhotoMeta = {
    id?: string;
    name?: string;
    width?: number;
    height?: number;
    path?: string;
    previewPath?: string;
    thumbPath?: string;
    [k: string]: unknown;
};

export type VariantsResult = {
    photos: PhotoMeta[];
    made: number;
    skipped: number;
    failed: number;
    remaining: number;
};

type Admin = {
    storage: { from: (bucket: string) => any };
};

async function downloadOriginal(admin: Admin, path: string): Promise<Buffer | null> {
    try {
        const { data, error } = await admin.storage.from(BUCKET).download(path);
        if (error || !data) return null;
        const buf = Buffer.from(await data.arrayBuffer());
        return buf.length > 0 ? buf : null;
    } catch {
        return null;
    }
}

async function uploadVariant(admin: Admin, path: string, body: Buffer): Promise<boolean> {
    try {
        const { error } = await admin.storage.from(BUCKET).upload(path, body, {
            cacheControl: '31536000',
            upsert: true,
            contentType: 'image/jpeg',
        });
        return !error;
    } catch {
        return false;
    }
}

/**
 * Обидві копії одного фото з одного читання файлу.
 *
 * `rotate()` без аргументів застосовує поворот з EXIF і прибирає сам тег: без
 * цього копія лягла б боком там, де оригінал стоїть рівно, бо браузер читає
 * EXIF, а полотно вже ні.
 */
async function variantsForOne(
    admin: Admin,
    original: string,
    missing: VariantField[],
): Promise<{ previewPath?: string; thumbPath?: string } | null> {
    if (missing.length === 0) return {};
    const buf = await downloadOriginal(admin, original);
    if (!buf) return null;

    const out: { previewPath?: string; thumbPath?: string } = {};
    const specs: Array<['previewPath' | 'thumbPath', number, number, (p: string) => string]> = [
        ['previewPath', DISPLAY_MAX_EDGE, DISPLAY_QUALITY, displayPathFor],
        ['thumbPath', THUMB_MAX_EDGE, THUMB_QUALITY, thumbPathFor],
    ];

    // Тільки те, чого бракує. Переробляти копію, яка вже лежить у сховищі,
    // означало б перезаливати той самий файл: робота оплачена двічі, користі
    // нуль. Саме так у браузері за тиждень набігла 231 зайва копія з 1593.
    for (const [field, maxEdge, quality, pathFor] of specs.filter(s => missing.includes(s[0]))) {
        try {
            const body = await sharp(buf)
                .rotate()
                // `withoutEnlargement` лишає маленький оригінал як є: розтягувати
                // його до межі означало б важчий файл без жодного пікселя користі.
                .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: Math.round(quality * 100), mozjpeg: true })
                .toBuffer();
            // Копія, важча за оригінал, не має сенсу ні для каналу, ні для памʼяті.
            if (body.length > 0 && body.length < buf.length) {
                const path = pathFor(original);
                if (await uploadVariant(admin, path, body)) out[field] = path;
            }
        } catch {
            /* одне зіпсоване фото не має зупиняти решту макета */
        }
    }
    return out;
}

/**
 * Догнати копії для списку фото макета.
 *
 * Повертає новий список метаданих. Фото, для якого нічого не вийшло, лишається
 * як було: воно просто й далі показуватиметься з оригіналу, а це стан, у якому
 * сайт жив досі.
 */
export async function buildMissingVariants(
    admin: Admin,
    photos: unknown,
    opts: { limit?: number; deadline?: number } = {},
): Promise<VariantsResult> {
    const list: PhotoMeta[] = Array.isArray(photos) ? photos.map(p => ({ ...(p as PhotoMeta) })) : [];
    const limit = Math.max(1, opts.limit ?? VARIANTS_BATCH);
    const deadline = opts.deadline ?? Number.POSITIVE_INFINITY;

    const queue: number[] = [];
    list.forEach((p, i) => { if (photoNeedsVariants(p)) queue.push(i); });
    const total = queue.length;
    const take = queue.slice(0, limit);

    let made = 0;
    let failed = 0;
    try { sharp.concurrency(1); } catch { /* не критично */ }

    let next = 0;
    const worker = async () => {
        while (next < take.length) {
            if (Date.now() > deadline) return;
            const i = take[next++];
            const photo = list[i];
            const res = await variantsForOne(admin, String(photo.path), missingVariantsOf(photo));
            if (!res || (!res.previewPath && !res.thumbPath)) { failed++; continue; }
            if (res.previewPath) photo.previewPath = res.previewPath;
            if (res.thumbPath) photo.thumbPath = res.thumbPath;
            made++;
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, take.length || 1) }, worker));

    return {
        photos: list,
        made,
        skipped: list.length - total,
        failed,
        remaining: Math.max(0, total - made - failed),
    };
}
