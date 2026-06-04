//
// Ukrainian → Latin transliteration, per the official Cabinet of Ministers of
// Ukraine table (Resolution No. 55, 27.01.2010) — the same standard used in
// passports and required by Nova Poshta / customs for international shipments.
//
// Used to prepare recipient name, city, address and cargo description in Latin
// so an international waybill can be created without manual retyping and without
// transliteration mistakes (a common cause of customs holds).
//

// Context-sensitive starts of word/syllable: Є Ї Й Ю Я and the г/зг case.
const SPECIAL_START: Record<string, string> = {
  'є': 'ye', 'ї': 'yi', 'й': 'y', 'ю': 'yu', 'я': 'ya',
};
const SPECIAL_MID: Record<string, string> = {
  'є': 'ie', 'ї': 'i', 'й': 'i', 'ю': 'iu', 'я': 'ia',
};

const BASE: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ь': '', 'ʼ': '', "'": '',
};

/**
 * Transliterate a Ukrainian string to Latin. Preserves Latin/ASCII as-is so
 * already-Latin input (e.g. a foreign city name) passes through unchanged.
 * Capitalisation of the first letter is preserved per token.
 */
export function transliterateUk(input: string | null | undefined): string {
  if (!input) return '';
  const chars = Array.from(input);
  let out = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const lower = ch.toLowerCase();
    const isUpper = ch !== lower;
    // "зг" → "zgh" exception (otherwise х/г collide on "kh")
    if (lower === 'г' && i > 0 && chars[i - 1].toLowerCase() === 'з') {
      out += isUpper ? 'Gh' : 'gh';
      continue;
    }

    let mapped: string | undefined;
    if (lower in SPECIAL_START) {
      // start of string or after a non-letter → word-initial form
      const prev = i > 0 ? chars[i - 1] : '';
      const atStart = i === 0 || !/[\p{L}]/u.test(prev);
      mapped = atStart ? SPECIAL_START[lower] : SPECIAL_MID[lower];
    } else if (lower in BASE) {
      mapped = BASE[lower];
    }

    if (mapped === undefined) {
      // not Ukrainian (Latin letter, digit, space, punctuation) — keep as-is
      out += ch;
      continue;
    }
    if (mapped === '') continue; // soft sign / apostrophe → dropped

    // Preserve casing: uppercase source → capitalise the mapped sequence.
    out += isUpper ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : mapped;
  }

  return out;
}

/** Transliterate and upper-case (some customs fields want all-caps). */
export function transliterateUpper(input: string | null | undefined): string {
  return transliterateUk(input).toUpperCase();
}
