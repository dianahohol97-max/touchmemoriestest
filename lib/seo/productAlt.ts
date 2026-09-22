import { getLocalized } from '@/lib/i18n/localize';

/**
 * Alt text for a product gallery image.
 *
 * The rule (Diana, 2026-09-22): describe the product, never the photograph.
 * Nobody has looked at these files, so anything about what a given frame
 * SHOWS — a spread, a map, a country — would be invented, and an invented alt
 * is worse than a plain one: it misdescribes the picture to the person using a
 * screen reader, which is who alt text is actually for.
 *
 * Shape: «{назва} — {тип обкладинки} — фото {N}», every part read off data the
 * row already carries.
 *
 * Two details worth the words:
 *
 *  • The name is taken from `h1` up to its first dash, falling back to `name`.
 *    The two differ on purpose: `name` is the cart/CRM label and for the travel
 *    book it is the English «Travel Book», while the heading opens with
 *    «Тревелбук 20×30» — the spelling people actually search in image search.
 *    Taking only the clause before the dash keeps it to that noun phrase
 *    instead of repeating a full sentence under all five thumbnails.
 *
 *  • The cover type comes from the `Обкладинка` row of `products.specs`, cut at
 *    its first comma: the stored value is «Тверда, картон 2 мм», and the board
 *    thickness belongs on the spec table, not in an alt. Products whose specs
 *    have no such row simply get the two-part form — the segment is dropped,
 *    never guessed.
 */
export function productImageAlt(
  product: any,
  locale: string,
  index: number,
  photoWord = 'фото',
): string {
  const heading = String(getLocalized(product, locale, 'h1') || product?.h1 || '').trim();
  const nameFromHeading = heading ? heading.split(/\s[—–-]\s/)[0].trim() : '';
  const name = nameFromHeading || getLocalized(product, locale, 'name') || product?.name || '';

  const parts = [name, coverType(product, locale)].filter(Boolean);
  parts.push(`${photoWord} ${index + 1}`);
  return parts.join(' — ');
}

/** «Тверда, картон 2 мм» → «Тверда». Empty when the row has no cover spec. */
export function coverType(product: any, locale: string): string {
  const specs = Array.isArray(product?.specs) ? product.specs : [];
  const row = specs.find((sp: any) => {
    const label = String(sp?.label || '').toLowerCase();
    return label === 'обкладинка' || label === 'cover';
  });
  if (!row) return '';
  // specs rows carry per-locale values as value_en / value_pl / value_de /
  // value_ro beside the Ukrainian `value` — the same convention the spec table
  // on the product page reads.
  const raw = String((locale !== 'uk' && row[`value_${locale}`]) || row.value || '').trim();
  if (!raw) return '';
  return raw.split(',')[0].trim();
}
