/**
 * Server-side translation helper.
 * Use in server components that can't use useT() hook.
 */
import uk from '@/locales/uk.json';
import en from '@/locales/en.json';
import ro from '@/locales/ro.json';
import pl from '@/locales/pl.json';
import de from '@/locales/de.json';

const TRANSLATIONS: Record<string, any> = { uk, en, ro, pl, de };

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let val = obj;
  for (const key of keys) {
    if (val == null) return undefined;
    val = val[key];
  }
  return typeof val === 'string' ? val : undefined;
}

export function getServerT(locale: string) {
  const dict = TRANSLATIONS[locale] || TRANSLATIONS['uk'];
  // Fall back to Ukrainian for any key missing in this locale, then to the raw
  // key as a last resort — previously a missing key returned the dotted path.
  return (key: string): string =>
    getNestedValue(dict, key) ?? getNestedValue(TRANSLATIONS['uk'], key) ?? key;
}
