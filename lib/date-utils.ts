/**
 * Format a date value safely with null checks
 * @param value - Date string or null/undefined
 * @param options - Formatting options
 * @returns Formatted date string or fallback ('—')
 */
export function formatDate(
  value: string | null | undefined,
  options?: {
    dateStyle?: 'short' | 'medium' | 'long' | 'full';
    timeStyle?: 'short' | 'medium' | 'long' | 'full';
    locale?: string;
  }
): string {
  if (!value) return '—';

  try {
    const date = new Date(value);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '—';
    }

    const locale = options?.locale || 'uk-UA';
    const formatOptions: Intl.DateTimeFormatOptions = {};

    if (options?.dateStyle) {
      formatOptions.dateStyle = options.dateStyle;
    }
    if (options?.timeStyle) {
      formatOptions.timeStyle = options.timeStyle;
    }

    // Default to medium date and short time if no options provided
    if (!options?.dateStyle && !options?.timeStyle) {
      formatOptions.dateStyle = 'medium';
      formatOptions.timeStyle = 'short';
    }

    return date.toLocaleString(locale, formatOptions);
  } catch (error) {
    console.error('Date formatting error:', error);
    return '—';
  }
}

/**
 * Format date only (no time)
 */
export function formatDateOnly(
  value: string | null | undefined,
  locale: string = 'uk-UA'
): string {
  return formatDate(value, { dateStyle: 'medium', locale });
}

/**
 * Format time only (no date)
 */
export function formatTimeOnly(
  value: string | null | undefined,
  locale: string = 'uk-UA'
): string {
  if (!value) return '—';

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '—';

    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '—';
  }
}

/**
 * Format date with full details (date and time)
 */
export function formatDateTime(
  value: string | null | undefined,
  locale: string = 'uk-UA'
): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short', locale });
}
