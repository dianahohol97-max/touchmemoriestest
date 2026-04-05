/**
 * Localization helper for database-driven content.
 * 
 * Products and blog posts store a `translations` JSONB column:
 * {
 *   "en": { "name": "Photo Book", "short_description": "..." },
 *   "ro": { "name": "Album foto", "short_description": "..." },
 *   ...
 * }
 * 
 * This helper resolves the localized value, falling back to the original Ukrainian field.
 */

export type SupportedLocale = 'uk' | 'en' | 'ro' | 'pl' | 'de';

interface Translatable {
  translations?: Record<string, Record<string, string>> | null;
  [key: string]: any;
}

/**
 * Get a localized field from an object with a `translations` JSONB column.
 * Falls back to the original field if no translation exists.
 * 
 * @example
 * getLocalized(product, 'en', 'name') 
 * // → product.translations?.en?.name || product.name
 * 
 * getLocalized(blogPost, 'ro', 'title')
 * // → blogPost.translations?.ro?.title || blogPost.title
 */
export function getLocalized<T extends Translatable>(
  obj: T | null | undefined,
  locale: string,
  field: string
): string {
  if (!obj) return '';
  
  // Ukrainian is the source language — no translation needed
  if (locale === 'uk') return obj[field] ?? '';
  
  // Try translated value
  const translated = obj.translations?.[locale]?.[field];
  if (translated) return translated;
  
  // Fallback to original (Ukrainian)
  return obj[field] ?? '';
}

/**
 * Batch-localize multiple fields from an object.
 * Returns a new object with the specified fields localized.
 * 
 * @example
 * const localized = localizeFields(product, 'en', ['name', 'short_description']);
 * // → { name: 'Photo Book', short_description: '...' }
 */
export function localizeFields<T extends Translatable>(
  obj: T | null | undefined,
  locale: string,
  fields: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    result[field] = getLocalized(obj, locale, field);
  }
  return result;
}
