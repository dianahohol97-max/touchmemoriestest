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

function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.');
  let val = obj;
  for (const key of keys) {
    if (val == null) return path;
    val = val[key];
  }
  return typeof val === 'string' ? val : path;
}

export function getServerT(locale: string) {
  const dict = TRANSLATIONS[locale] || TRANSLATIONS['uk'];
  return (key: string): string => getNestedValue(dict, key);
}
