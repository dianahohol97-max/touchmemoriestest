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

export function formatUKDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    const date = value instanceof Date ? value : new Date(value as string);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function addWorkingDays(startValue: string | Date | null | undefined, days: number): Date {
  const date = startValue instanceof Date ? new Date(startValue) : new Date((startValue as string) || '');
  if (isNaN(date.getTime())) return new Date();
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date;
}

export function getDeadlineStatus(deadline: Date): 'red' | 'yellow' | 'green' {
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'red';
  if (diffDays <= 1) return 'yellow';
  return 'green';
}
