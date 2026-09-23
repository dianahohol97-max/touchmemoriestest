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
 * Чи має сенс доганяти це фото серверною генерацією.
 *
 * Без шляху до оригіналу генерувати нічого, а коли обидві копії вже записані,
 * повторний прохід лише витратить час функції.
 */
export function photoNeedsVariants(p: Record<string, unknown> | null | undefined): boolean {
    if (!p || typeof p !== 'object') return false;
    if (!p.path || typeof p.path !== 'string') return false;
    return missingVariantsOf(p).length > 0;
}

/** Скільки фото макета ще чекають на копії. */
export function countPhotosNeedingVariants(photos: unknown): number {
    if (!Array.isArray(photos)) return 0;
    return photos.filter(photoNeedsVariants).length;
}
