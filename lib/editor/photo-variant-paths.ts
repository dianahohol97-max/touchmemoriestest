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

/**
 * Чи має сенс доганяти це фото серверною генерацією.
 *
 * Без шляху до оригіналу генерувати нічого, а коли копія вже записана,
 * повторний прохід лише витратить час функції.
 */
export function photoNeedsVariants(p: Record<string, unknown> | null | undefined): boolean {
    if (!p || typeof p !== 'object') return false;
    if (!p.path || typeof p.path !== 'string') return false;
    return !p.previewPath && !p.thumbPath;
}

/** Скільки фото макета ще чекають на копії. */
export function countPhotosNeedingVariants(photos: unknown): number {
    if (!Array.isArray(photos)) return 0;
    return photos.filter(photoNeedsVariants).length;
}
