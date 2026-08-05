/**
 * Нормалізація контактів ліда.
 *
 * Частина лідів приходить не з пошти, а з Instagram — менеджер знаходить
 * студію в стрічці й пише в директ. Нікнейм при цьому вводять по-різному:
 * «@studio.svitlo», «studio.svitlo», посилання на профіль цілком. Без
 * приведення до одного вигляду перевірка «цього ліда вже хтось веде» просто не
 * спрацьовує, і двоє менеджерів пишуть тій самій студії.
 */
export function normalizeInstagram(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const handle = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/^@/, '')
    .toLowerCase();
  // Лишаємо тільки те, що взагалі може бути нікнеймом.
  const clean = handle.replace(/[^a-z0-9._]/g, '');
  return clean ? clean.slice(0, 100) : null;
}
