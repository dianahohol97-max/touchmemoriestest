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
  return 'https://touchmemories1.vercel.app';
}

export function getCanonicalUrl(locale: Locale, path: string = ''): string {
  const base = getBaseUrl();
  const cleanPath = path === '' || path === '/' ? '' : (path.startsWith('/') ? path : `/${path}`);
  return `${base}/${locale}${cleanPath}`;
}

export function getAlternateLanguages(path: string = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const loc of LOCALES) {
    result[HREFLANG_MAP[loc]] = getCanonicalUrl(loc, path);
  }
  result['x-default'] = getCanonicalUrl(DEFAULT_LOCALE, path);
  return result;
}
