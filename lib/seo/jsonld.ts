/**
 * Serialise an object for embedding inside a <script type="application/ld+json">
 * block via dangerouslySetInnerHTML.
 *
 * Plain JSON.stringify does NOT escape '<', so any DB-authored string that ends
 * up in the structured data (a product name, blog title, category name, …)
 * containing "</script>" would close the script element early and let the rest
 * render as live HTML — stored XSS on every page that emits the block. Escaping
 * '<' (plus '>' and '&' for good measure) as unicode escapes keeps the JSON
 * valid while making the breakout impossible.
 */
export function serializeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
