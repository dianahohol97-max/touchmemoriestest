import type { ImageSource } from './gallery-variant-paths';

/**
 * Атрибути <img> для фото галереї: src, srcset, sizes, width і height.
 *
 * Без важких імпортів і без 'use client': це чиста функція, її ганяють тести
 * (tests/gallery-variants.test.ts) і нею ж користуються клієнтська галерея й
 * кабінет.
 *
 * ФОЛБЕК. Коли копій ще немає (`sources` порожній — фото до бекфілу або
 * таке, для якого копія не вийшла), повертається оригінал, як до 24.09.2026.
 * Порожнього тайла не буває за жодного стану даних.
 */

export interface GalleryImageInput {
  /** Адреса оригіналу. Лишається для завантаження і як останній фолбек. */
  url: string;
  /** Сторони оригіналу з урахуванням EXIF-повороту, якщо відомі. */
  w?: number | null;
  h?: number | null;
  /** Екранні копії від меншої до більшої (див. gallerySources). */
  sources?: ImageSource[] | null;
}

export interface GalleryImgAttrs {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
}

/**
 * `purpose`:
 *   'thumb' — src найменша копія (для браузера, який srcset не знає);
 *   'full'  — src найбільша копія (лайтбокс, обкладинка).
 */
export function galleryImgAttrs(
  photo: GalleryImageInput,
  purpose: 'thumb' | 'full',
  sizes?: string,
): GalleryImgAttrs {
  const w = Number(photo.w) || 0;
  const h = Number(photo.h) || 0;
  const dims = w > 0 && h > 0 ? { width: w, height: h } : {};
  const list = (photo.sources || []).filter(s => s && s.url && s.w > 0);
  if (list.length === 0) return { src: photo.url, ...dims };
  const sorted = [...list].sort((a, b) => a.w - b.w);
  const src = purpose === 'thumb' ? sorted[0].url : sorted[sorted.length - 1].url;
  return {
    src,
    srcSet: sorted.map(s => `${s.url} ${s.w}w`).join(', '),
    ...(sizes ? { sizes } : {}),
    ...dims,
  };
}

/** Найменша екранна копія або оригінал — для мініатюр без srcset. */
export function galleryThumbUrl(photo: GalleryImageInput): string {
  return galleryImgAttrs(photo, 'thumb').src;
}

/**
 * `sizes` для тайла сітки. Числа повторюють GalleryClient.module.css
 * (.container 1400 px з полями по 20, колонки на 520/760/900 px), бо саме
 * за ними браузер вирішує, яку копію тягнути.
 *
 * Для розкладок із кадруванням у квадрат або фіксовану висоту (grid, mixed)
 * горизонтальне фото заповнює тайл ВИСОТОЮ, тож його ширина на екрані більша
 * за ширину тайла в стільки разів, у скільки ширина більша за висоту.
 */
export function gridSizes(layout: string | undefined, aspect: number, big = false): string {
  const cover = layout === 'grid' || layout === 'mixed';
  const k = (cover && aspect > 1 ? aspect : 1) * (big ? 2 : 1);
  // Every length is wrapped: a bare `100vw - 40px` is not a valid source
  // size, and the browser silently skips the whole entry.
  const f = (expr: string) => (k === 1 ? `calc(${expr})` : `calc((${expr}) * ${Math.round(k * 100) / 100})`);
  if (layout === 'large') {
    return `(max-width: 760px) ${f('100vw - 40px')}, ${f('min(50vw - 31px, 669px)')}`;
  }
  if (cover) {
    return `(max-width: 900px) ${f('50vw - 27px')}, ${f('min(33.3vw - 22px, 457px)')}`;
  }
  return `(max-width: 520px) ${f('100vw - 40px')}, (max-width: 900px) ${f('50vw - 27px')}, ${f('min(33.3vw - 22px, 457px)')}`;
}

/** `sizes` для лайтбокса: .lbImg обмежено min(94vw, 1600px) × 86vh. */
export function lightboxSizes(aspect: number): string {
  const a = Number.isFinite(aspect) && aspect > 0 ? Math.round(aspect * 1000) / 1000 : 1;
  return `min(94vw, 1600px, calc(86vh * ${a}))`;
}

/** `sizes` для обкладинки на весь екран (object-fit: cover). */
export function heroSizes(aspect: number): string {
  const a = Number.isFinite(aspect) && aspect > 0 ? Math.round(aspect * 1000) / 1000 : 1;
  return `max(100vw, calc(100vh * ${a}))`;
}
