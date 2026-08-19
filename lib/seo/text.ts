/**
 * Plain-text helpers for anything that leaves the site as metadata rather than
 * as rendered HTML: <meta name="description">, Open Graph, JSON-LD, product
 * feeds.
 *
 * Product and blog bodies are stored in the DB as rich text (<p>, <ul>, <br>…).
 * When one of those bodies is used as a fallback description, the raw markup
 * has to be removed first — a meta description containing "<p>" is rendered
 * literally in the SERP snippet, and JSON-LD with markup inside it fails Google
 * Rich Results validation.
 */

/** Strip HTML tags and decode the entities our editor emits. */
export function stripHtml(html: string): string {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip markup and cut to `max` characters on a word boundary, so a truncated
 * meta description reads as a sentence fragment instead of a chopped word.
 * No ellipsis is appended — Google adds its own when it truncates further.
 */
export function toMetaText(html: string | null | undefined, max: number): string {
  const text = stripHtml(html || '');
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}
