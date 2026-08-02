/**
 * Print geometry — one derivation, used by the editor, the /print page and the
 * render service.
 *
 * These numbers lived in three places that had quietly drifted apart: the DB
 * (`photobook_sizes`), PRINT_DIMS_MM + BLEED_MARGINS in the editor, and a
 * hand-copied PRINT_DIMS_MM in render-service. The editor drew its canvas as
 * the FINISHED page while the render service treated the same canvas as the
 * finished page and then invented a bleed ring around it — so the bleed the
 * customer designed was thrown away and replaced with synthetic pixels.
 *
 * The model here has exactly three facts and derives the rest:
 *
 *   sheet    — the file the printer expects (photobook_sizes.spread_*_mm)
 *   finished — what survives the guillotine: 2 × page for a spread, and a page
 *              is width_cm × height_cm. This is physics, not a preference:
 *              a 20×30 book has 200×300 mm pages.
 *   overhang — (sheet − finished) / 2. THIS is the real bleed. Nothing invents
 *              it; it is the space the customer's artwork must reach into.
 *
 * `photobook_sizes.bleed_*_mm` is then read as a KEEP-CLEAR margin measured from
 * the sheet edge, not as the trim allowance — because taking it as trim gives
 * impossible finished sizes (20×30 would come out 412×288 mm instead of
 * 400×300). Where a stored margin is smaller than the real overhang it would
 * under-warn the customer, so the guide uses max(safety, overhang): the warning
 * is never weaker than the cut.
 */

export type SizeGeometry = {
  sizeKey: string;
  /** The print file's size in mm — what gets uploaded. */
  sheet: { w: number; h: number };
  /** One finished page in mm, after trimming. */
  page: { w: number; h: number };
  /** The finished SPREAD (two pages) in mm, after trimming. */
  finished: { w: number; h: number };
  /** Real bleed per side in mm — how far the sheet runs past the finished spread. */
  overhang: { x: number; y: number };
  /** Keep-clear margin from the sheet edge in mm; never weaker than `overhang`. */
  safety: { top: number; bottom: number; left: number; right: number };
  /** Full cover sheet in mm, including the fold-in that wraps the board. */
  cover: { w: number; h: number };
  /** Fold-in margin per side in mm. */
  coverFold: number;
  /** True when the numbers came from the DB rather than the fallback table. */
  fromDb: boolean;
};

/** 300 DPI is the whole pipeline's fixed output resolution. */
export const DPI = 300;
export const mmToPx = (mm: number) => Math.round((mm * DPI) / 25.4);

/**
 * Sheet sizes for keys `photobook_sizes` does not carry (magazines, travel
 * books, 23×23). Kept as a fallback only — anything present in the DB wins.
 */
const FALLBACK_SHEETS: Record<string, { spread: { w: number; h: number }; cover: { w: number; h: number } }> = {
  '20x20': { spread: { w: 405, h: 203 }, cover: { w: 457, h: 243 } },
  '25x25': { spread: { w: 500, h: 254 }, cover: { w: 566, h: 293 } },
  '20x30': { spread: { w: 420, h: 305 }, cover: { w: 470, h: 328 } },
  '30x20': { spread: { w: 610, h: 203 }, cover: { w: 646, h: 238 } },
  '30x30': { spread: { w: 610, h: 305 }, cover: { w: 646, h: 330 } },
  '23x23': { spread: { w: 460, h: 230 }, cover: { w: 506, h: 256 } },
  'A4': { spread: { w: 420, h: 307 }, cover: { w: 470, h: 328 } },
  'magazine-A4': { spread: { w: 420, h: 307 }, cover: { w: 470, h: 328 } },
  'travelbook': { spread: { w: 420, h: 305 }, cover: { w: 470, h: 328 } },
};

/** Finished page size for keys that are not literally "WxH" centimetres. */
const NAMED_PAGE_MM: Record<string, { w: number; h: number }> = {
  'A4': { w: 210, h: 297 },
  'magazine-A4': { w: 210, h: 297 },
  'travelbook': { w: 200, h: 300 },
};

/** '20×30 см' → '20x30'. */
export function normalizeSizeKey(key: string): string {
  const k = String(key || '').trim();
  if (NAMED_PAGE_MM[k] || FALLBACK_SHEETS[k]) return k;
  return k.replace(/[×х]/g, 'x').replace(/\s|см|cm/gi, '');
}

/** One finished page in mm, or null when the key says nothing about size. */
export function pageMm(sizeKey: string): { w: number; h: number } | null {
  const k = normalizeSizeKey(sizeKey);
  if (NAMED_PAGE_MM[k]) return { ...NAMED_PAGE_MM[k] };
  const m = k.match(/^(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const w = parseFloat(m[1].replace(',', '.')) * 10;   // the key is centimetres
  const h = parseFloat(m[2].replace(',', '.')) * 10;
  return w > 0 && h > 0 ? { w, h } : null;
}

/**
 * Which size key a saved project renders at.
 *
 * Mirrors resolveSizeKey() in render-service/server.ts — the two MUST agree.
 * TM-001108 is what happens when they don't: a paid glossy magazine whose
 * config carried no size at all. The render service resolved it from the slug
 * ('…magazine' → A4) and was ready to render, while the /print page's fallback
 * table listed only travelbook, so the page refused with «розмір виробу не
 * збережено в макеті» and the order sat with zero print files.
 *
 * Order of truth: saved config → projects.format → the product's fixed size.
 * Products with exactly one possible size are resolved from their type/slug;
 * anything genuinely variable (photobooks, wishbooks) must carry its own size
 * and returns '' so the caller can refuse rather than guess.
 */
export function resolveProjectSizeKey(project: {
  product_type?: string | null;
  format?: string | null;
  config?: { selectedSize?: string | null; productSlug?: string | null } | null;
}): string {
  const cfg = project.config || {};
  const explicit = normalizeSizeKey(String(cfg.selectedSize || project.format || ''));
  if (explicit) return explicit;

  const hay = `${cfg.productSlug || ''} ${project.product_type || ''}`.toLowerCase();
  if (/travel/.test(hay)) return '20x30';
  if (/magazine|zhurnal|journal|fotozhurnal|журнал/.test(hay)) return 'magazine-A4';
  return '';
}

/** A `photobook_sizes` row, as selected from the DB. */
export type SizeRow = {
  name?: string | null;
  width_cm?: number | string | null;
  height_cm?: number | string | null;
  spread_width_mm?: number | string | null;
  spread_height_mm?: number | string | null;
  cover_width_mm?: number | string | null;
  cover_height_mm?: number | string | null;
  bleed_top_mm?: number | string | null;
  bleed_bottom_mm?: number | string | null;
  bleed_left_mm?: number | string | null;
  bleed_right_mm?: number | string | null;
  cover_fold_margin_mm?: number | string | null;
};

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Derive the full geometry for a size.
 *
 * Returns null rather than guessing when the finished page size cannot be
 * established — a wrong sheet is a wrong print run, and a loud failure is
 * cheaper than a silently distorted book (this is the same reason /print
 * refuses to render when `selectedSize` is missing).
 */
export function deriveGeometry(sizeKey: string, row?: SizeRow | null): SizeGeometry | null {
  const key = normalizeSizeKey(sizeKey);

  // Finished page: prefer the DB's own centimetres, else parse the key.
  const dbPage = row && num(row.width_cm) > 0 && num(row.height_cm) > 0
    ? { w: num(row.width_cm) * 10, h: num(row.height_cm) * 10 }
    : null;
  const page = dbPage || pageMm(key);
  if (!page) return null;

  const fb = FALLBACK_SHEETS[key];
  const sheetW = num(row?.spread_width_mm) || fb?.spread.w || 0;
  const sheetH = num(row?.spread_height_mm) || fb?.spread.h || 0;
  if (!(sheetW > 0 && sheetH > 0)) return null;

  const finished = { w: page.w * 2, h: page.h };   // a spread is two pages wide

  // Real bleed. Clamped at 0: a sheet smaller than the finished spread is a
  // data error, and a negative overhang would silently crop the artwork.
  const overhang = {
    x: Math.max(0, (sheetW - finished.w) / 2),
    y: Math.max(0, (sheetH - finished.h) / 2),
  };

  // Keep-clear margins, never weaker than the actual cut.
  const safety = {
    top: Math.max(num(row?.bleed_top_mm), overhang.y),
    bottom: Math.max(num(row?.bleed_bottom_mm), overhang.y),
    left: Math.max(num(row?.bleed_left_mm), overhang.x),
    right: Math.max(num(row?.bleed_right_mm), overhang.x),
  };

  return {
    sizeKey: key,
    sheet: { w: sheetW, h: sheetH },
    page,
    finished,
    overhang,
    safety,
    cover: {
      w: num(row?.cover_width_mm) || fb?.cover.w || 0,
      h: num(row?.cover_height_mm) || fb?.cover.h || 0,
    },
    coverFold: num(row?.cover_fold_margin_mm, 18),
    fromDb: !!row,
  };
}

/**
 * Does the stored keep-clear margin under-state the real cut?
 *
 * 20×30 does: the sheet runs 10 mm past the finished spread on each side, but
 * `bleed_left/right_mm` says 4. The guide compensates with max(), but the data
 * itself is still wrong in one of its two numbers and only the printer can say
 * which — so surface it instead of letting it sit silently in a table.
 */
export function safetyUnderstated(g: SizeGeometry, row?: SizeRow | null): string | null {
  if (!row) return null;
  const problems: string[] = [];
  if (num(row.bleed_left_mm) < g.overhang.x || num(row.bleed_right_mm) < g.overhang.x) {
    problems.push(`по горизонталі в базі ${num(row.bleed_left_mm)} мм, а аркуш виступає на ${g.overhang.x} мм`);
  }
  if (num(row.bleed_top_mm) < g.overhang.y || num(row.bleed_bottom_mm) < g.overhang.y) {
    problems.push(`по вертикалі в базі ${Math.min(num(row.bleed_top_mm), num(row.bleed_bottom_mm))} мм, а аркуш виступає на ${g.overhang.y} мм`);
  }
  return problems.length ? problems.join('; ') : null;
}
