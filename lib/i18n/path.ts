/**
 * Prepend the current locale to a path so navigation stays in the same language.
 *
 * localePath('en', '/catalog/photobook') → '/en/catalog/photobook'
 * localePath('en', '/')                  → '/en'
 * localePath('en', 'https://...')        → 'https://...'  (external — unchanged)
 *
 * If the path already starts with /<locale>/ it is returned unchanged.
 */
export function localePath(locale: string, path: string): string {
  if (!path) return `/${locale}`;
  // External URLs — don't touch
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) return path;
  // Already has a locale prefix — replace it so switching locale works
  const localeRe = /^\/(uk|en|ro|pl|de)(\/|$)/;
  if (localeRe.test(path)) {
    return path.replace(localeRe, `/${locale}$2`);
  }
  // Plain path — prepend locale
  if (path === '/') return `/${locale}`;
  return `/${locale}${path.startsWith('/') ? path : '/' + path}`;
}
