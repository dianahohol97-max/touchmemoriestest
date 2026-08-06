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
 * description of what gets engraved. Акрил, фотовставка and металева вставка
 * carry the customer's PHOTO, which the renderer does not have and would
 * silently replace with an empty rectangle. For those, no file at all is safer
 * than a confident wrong one.
 */
export function canRenderMonoCover(decoRaw: string): boolean {
  const d = (decoRaw || '').toLowerCase();
  if (d.includes('акрил') || d.includes('acryl')) return false;
  if (d.includes('фотовставк') || d.includes('photo')) return false;
  if (d.includes('метал') || d.includes('metal')) return false;
  return d.includes('гравір') || d.includes('гравію') || d.includes('engrav') || d.includes('graviruvannya')
    || d.includes('флекс') || d.includes('flex') || d.includes('друк кольор');
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
    if (isSoftCoverMaterial(material) && canRenderMonoCover(deco)) return it;
  }
  return null;
}
