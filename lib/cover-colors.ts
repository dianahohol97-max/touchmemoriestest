/**
 * Cover-colour codes — one place that turns a colour NAME into the workshop's
 * article code.
 *
 * Orders only ever stored the human name ("Колір обкладинки: Темно-зелений").
 * That is ambiguous in production: «Темно-зелений» is В-13 in velour but Ш-21
 * in leatherette, and thirteen more names collide the same way. TM-001094 went
 * to the workshop with nothing but the name, and the code had to be guessed.
 *
 * So: resolve the code from `cover_colors` scoped to the item's COVER TYPE, and
 * carry it on the order. Never guess from the name alone.
 */

export type CoverColorRow = {
  code: string;
  name: string;
  hex: string | null;
  coverType: string;
};

/** Normalise for comparison: case, spacing, and the ё/e + hyphen variants. */
function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Do these two cover-type labels describe the same material?
 *
 * Order options say «Велюр»; the DB also has «Велюр (файликові альбоми) 200».
 * Exact equality misses those, so fall back to a prefix match on the base word
 * — but only within the same material family, never across velour/leatherette.
 */
function coverTypeMatches(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.startsWith(y) || y.startsWith(x);
}

/** Build the lookup index from the `cover_colors` rows. */
export function buildCoverColorIndex(rows: any[]): CoverColorRow[] {
  return (rows || [])
    .map((r) => {
      // The embedded relation comes back as an object, but PostgREST returns an
      // array for some embeddings — accept both rather than silently indexing
      // every colour under an empty cover type (which matches nothing).
      const rel = Array.isArray(r?.cover_type) ? r.cover_type[0] : r?.cover_type;
      return {
        code: String(r.code || ''),
        name: String(r.name || ''),
        hex: r.hex_approx || r.hex || null,
        coverType: String(rel?.name || r.coverType || r.coverTypeName || r.cover_type_name || ''),
      };
    })
    .filter((r) => r.code && r.name && r.coverType);
}

/**
 * Find the colour for a (cover type, colour name) pair.
 *
 * Returns null when the pair is unknown OR when it resolves to more than one
 * DISTINCT code — an ambiguous answer is worse than none, because it is the
 * kind of thing that quietly reaches the workshop as fact.
 */
export function matchCoverColor(
  index: CoverColorRow[],
  coverTypeName: string,
  colorName: string,
): CoverColorRow | null {
  if (!coverTypeName || !colorName) return null;
  const wanted = norm(colorName);
  const byName = index.filter((r) => norm(r.name) === wanted);
  // Exact cover-type match FIRST. The prefix fallback exists for label drift
  // («Велюр» vs a DB row named slightly longer), but when the exact type IS in
  // the DB the prefix pass must not widen the answer: «Велюр · Молочний» is
  // В-01, yet the prefix also matched «Велюр (файликові альбоми) 200/500»
  // (ВФ-02), two distinct codes read as ambiguous, and the admin page told the
  // manager the code was undefined (TM-001171).
  const exact = byName.filter((r) => norm(r.coverType) === norm(coverTypeName));
  const hits = exact.length > 0
    ? exact
    : byName.filter((r) => coverTypeMatches(r.coverType, coverTypeName));
  if (hits.length === 0) return null;
  const codes = new Set(hits.map((h) => h.code));
  if (codes.size > 1) return null;
  return hits[0];
}

/** «Велюр В-13 · Темно-зелений» — the label the workshop can act on. */
export function formatCoverColor(coverTypeName: string, code: string, colorName: string): string {
  const type = String(coverTypeName || '').trim();
  return `${type ? type + ' ' : ''}${code} · ${colorName}`;
}

/** Option keys, kept here so the writer and the reader can never drift apart. */
export const COVER_COLOR_CODE_KEY = 'Код кольору обкладинки';
export const COVER_COLOR_KEY_RE = /колір\s*обкладинки/i;
export const COVER_TYPE_KEY_RE = /^(обкладинка|тип\s*обкладинки|матеріал\s*обкладинки)$/i;

/**
 * Read the cover type + colour an order item was placed with.
 * Items carry them under slightly different labels per product, hence regexes.
 */
export function readCoverSelection(options: Record<string, any> | undefined | null): {
  coverType: string;
  colorName: string;
  code: string;
} {
  const out = { coverType: '', colorName: '', code: '' };
  if (!options || typeof options !== 'object') return out;
  for (const [k, v] of Object.entries(options)) {
    const val = String(v ?? '').trim();
    if (!val) continue;
    if (k === COVER_COLOR_CODE_KEY) out.code = val;
    else if (COVER_COLOR_KEY_RE.test(k)) out.colorName = val;
    else if (COVER_TYPE_KEY_RE.test(k.trim())) out.coverType = val;
  }
  return out;
}
