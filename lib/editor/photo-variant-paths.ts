/**
 * Де лежать зменшені копії фото і якого вони розміру.
 *
 * ЧОМУ ОКРЕМИЙ МОДУЛЬ БЕЗ 'use client'. Ці самі числа і ті самі шляхи потрібні
 * трьом сторонам: конструктору в браузері, який робить копії під час
 * збереження, серверному маршруту, який доганяє старі макети через sharp, і
 * кабінету, який їх підписує. Модуль із директивою 'use client' затягнув би в
 * серверний маршрут цілу клієнтську межу, а розійтися цим числам не можна: шлях,
 * порахований по-різному на двох сторонах, означає копію, яку ніхто не знайде.
 *
 * Повна історія, навіщо копії взагалі зʼявилися, — у lib/editor/photo-variants.ts.
 */

/** Довга сторона копії, яку конструктор показує на полотні. */
export const DISPLAY_MAX_EDGE = 1600;
export const DISPLAY_QUALITY = 0.82;

/** Довга сторона копії для стрічки, навігатора сторінок і карток кабінету. */
export const THUMB_MAX_EDGE = 360;
export const THUMB_QUALITY = 0.72;

export type PhotoVariantPaths = { previewPath?: string; thumbPath?: string };

/** `drafts/u/d/abc.jpg` + `_display` → `drafts/u/d/abc_display.jpg`. */
function withSuffix(path: string, suffix: string): string {
    const slash = path.lastIndexOf('/');
    const dot = path.lastIndexOf('.');
    if (dot > slash && dot > 0) return `${path.slice(0, dot)}${suffix}${path.slice(dot)}`;
    return `${path}${suffix}.jpg`;
}

export function displayPathFor(originalPath: string): string {
    return withSuffix(originalPath, '_display');
}

export function thumbPathFor(originalPath: string): string {
    return withSuffix(originalPath, '_thumb');
}

/**
 * Чи варто взагалі робити копію такого розміру.
 *
 * Оригінал, який і так менший за межу, переживає повторне кодування тільки
 * гірше: ваги це не зменшить, а різкості відбере. Тоді копії просто немає, і
 * читач відкочується на оригінал — він у цьому разі й так легкий.
 */
export function shouldDownscale(longestEdge: number, maxEdge: number): boolean {
    return Number.isFinite(longestEdge) && longestEdge > maxEdge;
}

export type VariantField = 'previewPath' | 'thumbPath';

/**
 * Яких саме копій бракує цьому фото.
 *
 * ЧОМУ НЕ «ОБОХ АБО ЖОДНОЇ». Довго перевірка стояла так: копії потрібні, лише
 * якщо немає ОБОХ. Через це фото, у якого вийшла одна копія, а друга ні,
 * назавжди випадало з черги — маршрут його не брав, бо формально щось уже є.
 * Станом на 23.09.2026 таких було 201 у сімнадцяти макетах: усі мали `thumbPath`
 * без `previewPath`, тобто відкривалися з оригіналу на полотні, і догнати їх
 * не міг ніхто. Беруться вони звідти, що в браузері джерелом була копія на
 * 1600 px, і копія на 1600 px із неї не проходила перевірку «легша за джерело»,
 * а стрічкова на 360 px проходила.
 */
export function missingVariantsOf(p: Record<string, unknown> | null | undefined): VariantField[] {
    if (!p || typeof p !== 'object') return [];
    const out: VariantField[] = [];
    if (!p.previewPath) out.push('previewPath');
    if (!p.thumbPath) out.push('thumbPath');
    return out;
}

/**
 * Скільки разів пробувати зробити копію, яка не виходить, і скільки чекати
 * між спробами.
 *
 * ЧОМУ БЕЗ ЦЬОГО НЕ МОЖНА. Відколи черга рахується з того, чого БРАКУЄ, фото,
 * для якого копія не робиться в принципі, лишалося б у черзі назавжди. А таке
 * фото буває: побитий файл, формат, якого не бере sharp, або оригінал, легший
 * за власну копію (тоді перевірка «копія має бути меншою» відкидає її щоразу, і
 * щоразу справедливо). Кабінет на КОЖНОМУ відкритті писав би «Готуємо N фото до
 * швидкого відкриття», чекав на маршрут і відкривався повільніше — тобто рівно
 * те очікування, заради усунення якого копії й зʼявилися, тільки тепер вічне.
 *
 * Три спроби з добою між ними дають місце тимчасовій біді (сховище не
 * відповіло, функція обірвалася на межі часу) і не дають вічного циклу.
 */
export const VARIANT_MAX_TRIES = 3;
export const VARIANT_RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Скільки разів для цього фото вже пробували зробити копії й не змогли. */
export function variantTriesOf(p: Record<string, unknown> | null | undefined): number {
    const n = p && typeof p === 'object' ? (p as Record<string, unknown>).variantTries : undefined;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Чи вичерпані спроби для цього фото: або їх було досить, або остання надто
 * свіжа, щоб пробувати знову.
 */
export function variantRetryExhausted(
    p: Record<string, unknown> | null | undefined,
    now: number = Date.now(),
): boolean {
    if (variantTriesOf(p) >= VARIANT_MAX_TRIES) return true;
    const raw = p && typeof p === 'object' ? (p as Record<string, unknown>).variantTriedAt : undefined;
    const triedAt = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;
    if (!Number.isFinite(triedAt)) return false;
    // Позначка з майбутнього — зіпсовані дані, а не причина мовчати назавжди.
    if (triedAt > now) return false;
    return now - triedAt < VARIANT_RETRY_COOLDOWN_MS;
}

/**
 * Чи має сенс доганяти це фото серверною генерацією.
 *
 * Без шляху до оригіналу генерувати нічого; коли обидві копії вже записані,
 * повторний прохід лише витратить час функції; а коли попередні спроби нічого
 * не дали, чекаємо добу і здаємося після третьої.
 */
export function photoNeedsVariants(
    p: Record<string, unknown> | null | undefined,
    now: number = Date.now(),
): boolean {
    if (!p || typeof p !== 'object') return false;
    if (!p.path || typeof p.path !== 'string') return false;
    if (missingVariantsOf(p).length === 0) return false;
    return !variantRetryExhausted(p, now);
}

/** Скільки фото макета ще чекають на копії. */
export function countPhotosNeedingVariants(photos: unknown, now: number = Date.now()): number {
    if (!Array.isArray(photos)) return 0;
    return photos.filter(p => photoNeedsVariants(p, now)).length;
}
