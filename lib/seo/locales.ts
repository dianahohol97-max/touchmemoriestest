export const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uk';

// Full BCP47 codes for hreflang. Google prefers region-specific where
// the audience is geographically targeted; bare 'en' for the English
// version because it serves a global audience, not specifically en-US
// or en-GB.
export const HREFLANG_MAP: Record<Locale, string> = {
  uk: 'uk-UA',
  en: 'en',
  ro: 'ro-RO',
  pl: 'pl-PL',
  de: 'de-DE',
};

// OG locale codes use underscore convention, not hyphen.
export const OG_LOCALE_MAP: Record<Locale, string> = {
  uk: 'uk_UA',
  en: 'en_US',
  ro: 'ro_RO',
  pl: 'pl_PL',
  de: 'de_DE',
};

export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Canonical production domain. Set NEXT_PUBLIC_SITE_URL in Vercel to override;
  // the fallback must be the real domain (not the vercel.app host) so robots,
  // sitemap, canonical and hreflang stay correct even if the env var is missing.
  return 'https://touchmemories.com.ua';
}

export function getCanonicalUrl(locale: Locale, path: string = ''): string {
  const base = getBaseUrl();
  const cleanPath = path === '' || path === '/' ? '' : (path.startsWith('/') ? path : `/${path}`);
  return `${base}/${locale}${cleanPath}`;
}

// Some meta_title values in the DB already end with "| Touch.Memories" while
// page code appends the brand suffix too, producing "… | Touch.Memories |
// Touch.Memories" in the SERP. Strip any existing suffix first so the brand
// appears exactly once regardless of how the DB row was authored.
const BRAND_SUFFIX_RE = /\s*\|\s*Touch\.?\s?Memories\s*$/i;

export function stripBrandSuffix(title: string): string {
  return title.replace(BRAND_SUFFIX_RE, '').trim();
}

export function withBrandSuffix(title: string): string {
  const clean = stripBrandSuffix(title);
  return clean ? `${clean} | Touch.Memories` : 'Touch.Memories';
}

/**
 * Сторінка існує тільки однією мовою, хоч і відкривається за будь-якою локаллю.
 *
 * Такий випадок у нас є: лендінги партнерської програми (/partnery і дві
 * профільні сторінки, до 21.09.2026 — /travel-agencies) мають
 * український текст на всіх пʼяти локалях, і перекладати його Діана не планує
 * (16.09.2026). Поки він віддавав повний набір hreflang, ми самі казали Google,
 * що /de/partnery — це німецька версія: пошуковик індексував пʼять
 * адрес з однаковим українським текстом, тобто пʼять дублів, і жодна з них не
 * була тим, що обіцяв hreflang.
 *
 * Тут віддається тільки та мова, якою сторінка справді написана, плюс
 * x-default на неї ж. Разом із канонічним посиланням на ту саму адресу (а його
 * ставить сторінка) це означає: заходити можна звідки завгодно, індексується
 * одна версія. Сторінка лишається повністю доступною — це вказівка пошуковику,
 * а не заборона відвідувачу.
 */
export function getSingleLocaleAlternates(
  path: string = '',
  locale: Locale = DEFAULT_LOCALE,
): Record<string, string> {
  return {
    [HREFLANG_MAP[locale]]: getCanonicalUrl(locale, path),
    'x-default': getCanonicalUrl(locale, path),
  };
}

/**
 * Сторінка існує кількома мовами, але не всіма пʼятьма.
 *
 * Саме такий випадок у блозі: український текст пишеться завжди, переклади
 * зʼявляються вибірково і не для кожної статті. Повний набір із пʼяти
 * посилань сказав би Google, що /de/blog/… — німецька версія, тоді як за тією
 * адресою лежить той самий український текст. Це не «запасний варіант», це
 * пʼять дублів, про які ми повідомили самі.
 *
 * `x-default` веде на базову мову статті, а не на `uk` наосліп: стаття,
 * написана англійською і не перекладена, має віддавати англійську.
 */
export function getSubsetAlternates(
  path: string,
  locales: readonly Locale[],
  base: Locale = DEFAULT_LOCALE,
): Record<string, string> {
  const unique = Array.from(new Set(locales.length ? locales : [base]));
  const result: Record<string, string> = {};
  for (const loc of unique) {
    result[HREFLANG_MAP[loc]] = getCanonicalUrl(loc, path);
  }
  result['x-default'] = getCanonicalUrl(unique.includes(base) ? base : unique[0], path);
  return result;
}

export function getAlternateLanguages(path: string = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const loc of LOCALES) {
    result[HREFLANG_MAP[loc]] = getCanonicalUrl(loc, path);
  }
  result['x-default'] = getCanonicalUrl(DEFAULT_LOCALE, path);
  return result;
}
