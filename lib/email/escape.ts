/**
 * Escape a user-supplied string before interpolating it into email HTML.
 *
 * Transactional emails (corporate quotes, gift hints, etc.) build their HTML
 * body with template literals. Any customer-controlled field dropped into that
 * body unescaped lets an attacker inject arbitrary markup — a link, an image
 * beacon, styled phishing content — that renders inside an email we send from
 * our own domain. Always run untrusted values through this before interpolation.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
