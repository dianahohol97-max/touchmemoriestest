/**
 * Which covers get a server-generated monochrome engraving макет.
 *
 * Kept in its own module, free of next/og and sharp, so the hourly cron and any
 * other caller can ask the question without pulling the whole renderer into
 * their bundle. lib/print/wishbook-cover.tsx re-exports both.
 */

/**
 * A cover made of soft material — велюр, шкірзамінник, тканина. Its decoration
 * is physical (гравіювання / тиснення / флекс), so production works from a
 * monochrome макет; a printed cover needs none.
 */
export function isSoftCoverMaterial(material: string): boolean {
  const m = (material || '').toLowerCase();
  return m.includes('велюр') || m.includes('velour')
    || m.includes('ткан') || m.includes('fabric')
    || m.includes('шкір') || m.includes('leather');
}

/**
 * Whether the mono renderer can honestly reproduce this decoration.
 *
 * It draws a background, a decoration plate and one line of text — nothing
 * else. Гравіювання and флекс are exactly that, so the макет is a faithful
 * description of what gets engraved. Акрил and металева вставка carry the
 * customer's PHOTO / their own plate artwork, which this check cannot vouch
 * for — for those, no file at all is safer than a confident wrong one.
 * Фотовставка is NOT excluded here as a decoration word, because its напис is
 * engraved on the COVER, not on the insert — but whether there is anything to
 * engrave depends on the item's text options, so callers go through
 * findMonoCoverItem which checks both.
 */
export function canRenderMonoCover(decoRaw: string): boolean {
  const d = (decoRaw || '').toLowerCase();
  if (d.includes('акрил') || d.includes('acryl')) return false;
  if (d.includes('фотовставк') || d.includes('photo')) return false;
  if (d.includes('метал') || d.includes('metal')) return false;
  return d.includes('гравір') || d.includes('гравію') || d.includes('engrav') || d.includes('graviruvannya')
    || d.includes('флекс') || d.includes('flex') || d.includes('друк кольор');
}

/** A фотовставка decoration — the insert holds a photo, the напис sits on the cover. */
export function isPhotoInsertDeco(decoRaw: string): boolean {
  const d = (decoRaw || '').toLowerCase();
  return d.includes('фотовставк') || d.includes('photovstavka') || d.includes('photo insert');
}

/** Does the item carry a cover inscription text in any of its option dialects? */
export function hasInscriptionText(opts: Record<string, any>): boolean {
  for (const k of ['Текст на обкладинці', 'Напис на обкладинку', 'Напис на декорації', 'Напис', 'Title', 'Text']) {
    if (typeof opts?.[k] === 'string' && opts[k].trim()) return true;
  }
  return false;
}

/** The order item, if any, that qualifies for a mono engraving макет. */
export function findMonoCoverItem(items: any[]): any | null {
  for (const it of items || []) {
    const slug = String(it?.slug || it?.product_type || '').toLowerCase();
    const name = String(it?.product_name || it?.name || '').toLowerCase();
    // Wishbooks are served by generate-wishbook-cover, which writes the same
    // path along with the colour cover — two routes must not fight over it.
    if (slug.includes('wish') || slug.includes('pobazhan') || slug.includes('guest') || name.includes('побажан')) continue;
    const opts = it?.options || {};
    const material = String(opts['Обкладинка'] || opts['Матеріал обкладинки'] || opts['Cover'] || '');
    const deco = String(opts['Декорація обкладинки'] || opts['Оздоблення'] || opts['Decoration'] || '');
    if (!isSoftCoverMaterial(material)) continue;
    // Гравіювання / флекс covers always qualify; a фотовставка cover qualifies
    // when it ALSO carries a напис — the напис is engraved/printed on the cover
    // itself and production needs its mono sheet (TM-001171), while the insert
    // photo ships as its own file.
    if (canRenderMonoCover(deco) || (isPhotoInsertDeco(deco) && hasInscriptionText(opts))) return it;
  }
  return null;
}
