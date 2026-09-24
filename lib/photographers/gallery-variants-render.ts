import sharp from 'sharp';
import {
  GALLERY_VARIANT_QUALITY,
  variantEdgesFor,
  type GalleryVariantEdge,
} from './gallery-variant-paths';

/**
 * Нарізка екранних копій одного фото через sharp.
 *
 * ПАМʼЯТЬ І ЧАС. Найбільший файл у живих галереях — 21 МБ JPEG. libvips
 * розкодовує JPEG одразу зменшеним (shrink-on-load: 1/2, 1/4, 1/8), тож для
 * копії на 2048 px кадр на 24–45 Мп у памʼяті стає 12–18 Мп, а не всі
 * мегапікселі. Далі з цього ОДНОГО розкодування робляться всі три копії:
 * 1280 і 640 ріжуться з растру на 2048, а не з оригіналу вдруге. На
 * функцію Vercel (2 ГБ) це десятки мегабайтів на фото і менше секунди.
 *
 * `rotate()` застосовує поворот з EXIF: інакше вертикальний знімок лежав би
 * в сітці боком. `flatten` кладе прозорий PNG на білий, бо JPEG прозорості не
 * має. Колірний профіль (Adobe RGB з камери) переводиться в sRGB — sharp
 * робить це сам, коли пише JPEG без `keepIccProfile`.
 */

export interface RenderedVariants {
  /** Сторони оригіналу після EXIF-повороту. */
  width: number;
  height: number;
  variants: { edge: GalleryVariantEdge; body: Buffer }[];
}

export async function renderGalleryVariants(original: Buffer): Promise<RenderedVariants> {
  const meta = await sharp(original, { failOn: 'none' }).metadata();
  let width = meta.width || 0;
  let height = meta.height || 0;
  // EXIF 5–8 — поворот на 90°: на екрані ширина і висота міняються місцями.
  if ((meta.orientation || 1) >= 5) [width, height] = [height, width];
  if (!(width > 0 && height > 0)) throw new Error('не вдалося прочитати розміри зображення');

  const edges = variantEdgesFor(width, height);
  if (edges.length === 0) return { width, height, variants: [] };

  const top = edges[edges.length - 1];
  const base = await sharp(original, { failOn: 'none' })
    .rotate()
    .resize({ width: top, height: top, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const variants: RenderedVariants['variants'] = [];
  for (const edge of edges) {
    const body = await sharp(base.data, {
      raw: { width: base.info.width, height: base.info.height, channels: base.info.channels as 3 },
    })
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: GALLERY_VARIANT_QUALITY[edge], mozjpeg: true, progressive: true })
      .toBuffer();
    variants.push({ edge, body });
  }
  return { width, height, variants };
}
