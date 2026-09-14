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
/**
 * Під якими ключами замовлення несе КОЛІР обкладинки.
 *
 * Конструктор пише «Колір обкладинки», а картка товару — назву матеріалу:
 * «Колір велюру», «Колір шкірзамінника», «Колір тканини». Регулярка знала
 * лише перший варіант, тож дев'ять замовлень із кольором, обраним на картці
 * товару, адмінка бачила як замовлення без кольору взагалі: ні плашки з
 * кольором, ні артикула для майстерні.
 *
 * «Колір сторінок», «Колір напису», «Колір флексу» і «Колір рамки» сюди не
 * належать — це інші деталі виробу, і прив'язка їх до обкладинки дала б
 * майстерні артикул, якого ніхто не замовляв.
 */
export const COVER_COLOR_KEY_RE = /^колір\s*(обкладинки|велюру|шкірзамінник\p{L}*|шкіри|тканини)$/iu;
export const COVER_TYPE_KEY_RE = /^(обкладинка|тип\s*обкладинки|матеріал\s*обкладинки)$/i;

/**
 * Матеріал обкладинки, названий у самому ключі кольору.
 *
 * «Колір велюру» — це велюр, і окремого поля матеріалу такому замовленню не
 * потрібно. Без цього артикул не резолвиться: пошук у cover_colors іде за
 * парою «тип обкладинки + назва кольору», а тип нізвідки взяти.
 */
function coverTypeFromColorKey(key: string): string {
  const k = norm(key);
  if (k.includes('велюр')) return 'Велюр';
  if (k.includes('шкірзамінник') || k.includes('шкіри')) return 'Шкірзамінник';
  if (k.includes('тканини')) return 'Тканина';
  return '';
}

/**
 * Матеріал обкладинки за артикулом товару.
 *
 * Окремі товари — photobook-leatherette, photobook-velour, photobook-fabric —
 * не мають опції «Матеріал обкладинки»: матеріал зашитий в артикул. Друковані
 * і випускні обкладинки кольору не мають узагалі, для них повертаємо порожнє.
 */
export function coverTypeFromSlug(slugOrName: string | null | undefined): string {
  const s = norm(slugOrName || '');
  if (!s) return '';
  if (s.includes('printed') || s.includes('drukov') || s.includes('друков')) return '';
  if (s.includes('graduation') || s.includes('vypusk') || s.includes('випуск')) return '';
  if (s.includes('velour') || s.includes('velyur') || s.includes('велюр')) return 'Велюр';
  if (s.includes('leather') || s.includes('shkir') || s.includes('шкірзам')) return 'Шкірзамінник';
  if (s.includes('fabric') || s.includes('tkanina') || s.includes('тканин')) return 'Тканина';
  return '';
}

/**
 * Чи мусить це замовлення нести колір обкладинки, і під яким ключем.
 *
 * Одне правило на три місця: картка товару блокує замовлення, поки колір не
 * обрано, вона ж підписує сітку зразків, а картка замовлення в адмінці
 * попереджає, коли колір усе-таки не записався. TM-001296 приїхав саме таким:
 * обкладинка зі шкірзамінника, а якого кольору — ніде.
 */
export function coverColorRequirement(
  slug: string | null | undefined,
  options?: Record<string, any> | null,
): { key: string; coverType: string } | null {
  const material = String(options?.['Матеріал обкладинки'] ?? '').trim();
  // Обраний матеріал важить більше за артикул: у книгах побажань обкладинку
  // обирають опцією, і друкована тверда кольору не має.
  const coverType = material ? coverTypeFromSlug(material) : coverTypeFromSlug(slug);
  if (!coverType) return null;
  const key = coverType === 'Велюр' ? 'Колір велюру'
    : coverType === 'Шкірзамінник' ? 'Колір шкірзамінника'
    : 'Колір тканини';
  return { key, coverType };
}

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
    else if (COVER_COLOR_KEY_RE.test(k.trim())) {
      out.colorName = val;
      // Ключ сам називає матеріал («Колір велюру»), і це єдине місце, де він
      // узагалі записаний для товарів без опції «Матеріал обкладинки».
      if (!out.coverType) out.coverType = coverTypeFromColorKey(k);
    }
    else if (COVER_TYPE_KEY_RE.test(k.trim())) out.coverType = val;
  }
  return out;
}
