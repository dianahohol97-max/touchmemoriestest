import { ImageResponse } from 'next/og';
import { deriveGeometry, normalizeSizeKey as geoNormalizeSizeKey } from './geometry';

export { isSoftCoverMaterial, canRenderMonoCover, findMonoCoverItem } from './cover-eligibility';

/**
 * Server-side wishbook cover generator.
 *
 * Why this exists: a wishbook (книга побажань) has NO customer photos — the
 * whole design is the cover (velour/printed colour + decoration plate +
 * engraved title). All of that is captured in the order's `items[].options`,
 * so we can render the print cover entirely on the server with zero dependence
 * on the customer's browser. This guarantees a cover.jpg always exists, which
 * is the fix for orders that shipped with no print file (TM-001016/017).
 *
 * The output is a clean, production-readable cover at the correct physical size
 * for the chosen format (300 DPI). It is NOT a photoreal velour reproduction —
 * it faithfully encodes everything the print shop needs: exact background
 * colour, the decoration plate (metal/acryl/photo-insert footprint) and the
 * engraved title in the chosen font at the chosen position.
 *
 * next/og (Satori) renders a subset of CSS to PNG. We then leave JPEG
 * conversion to the caller (sharp/jimp) so the stored file matches the
 * cover.jpg production spec.
 */

// ── Colour maps (kept in sync with lib/editor/constants.ts) ──────────────────
const VELOUR_COLORS: Record<string, string> = {
  'Молочний': '#F0EAD6', 'Бежевий': '#D9C8B0', 'Таупе': '#7C7167', 'Рожевий': '#E8B4B8',
  'Бордо': '#7A2838', 'Сірий перловий': '#9A9898', 'Лаванда': '#B8A8C8', 'Синій': '#1A2040',
  'Графітовий': '#3A3038', 'Бірюзовий': '#1A9090', 'Фіолетовий': '#8C2D80', 'Блакитно-сірий': '#607080',
  'Темно-зелений': '#1A6A53', 'Жовтий': '#D4A020', 'Чорний': '#1A1A1A',
};
const LEATHERETTE_COLORS: Record<string, string> = {
  'Білий': '#F5F5F0', 'Бежевий': '#D9C8B0', 'Пісочний': '#D4A76A', 'Рудий': '#C8844E',
  'Бордо темний': '#7A2838', 'Золотистий': '#C4A83A', 'Теракотовий': '#C25A3C', 'Жовтий': '#F0B820',
  'Рожевий ніжний': '#E8B4B8', 'Фуксія': '#D84080', 'Червоний насичений': '#A01030',
  'Коричневий': '#8E5038', 'Вишневий': '#7A2020', 'Марсала': '#6E2840', 'Графітовий темний': '#3A3038',
  'Фіолетовий яскравий': '#8030A0', 'Фіолетовий темний': '#502060', 'Бірюзовий': '#4E9090',
  'Оливковий': '#A0A030', 'Темно-зелений': '#1E3028', 'Бірюзовий яскравий': '#00B0B0',
  'Блакитний яскравий': '#0088D0', 'Темно-синій': '#1A2040', 'Чорний': '#1A1A1A', 'Персиковий': '#E8A8A0',
};
const FABRIC_COLORS: Record<string, string> = {
  'Бежевий/пісочний': '#C4AA88', 'Теракотовий/цегляний': '#A04838', 'Фуксія/пурпурний': '#B838A0',
  'Фіолетовий темний': '#582050', 'Марсала/бордо': '#602838', 'Коричневий': '#6E4830',
  'Сірий/графітовий': '#586058', 'Червоний яскравий': '#C02030', 'Оливковий/зелений': '#A0A020',
};

// ── Cover physical dimensions (mm) per format, incl. fold-in. ───────────────
// Last-resort fallback only: deriveGeometry() in lib/print/geometry.ts is the
// single source of truth and covers every photobook format too, which matters
// now that soft-cover photobooks (велюр / шкірзамінник / тканина) use this
// renderer for their engraving макет — 20×20, 25×25 and 30×30 are not wishbook
// formats and were never in this table.
const COVER_MM: Record<string, { w: number; h: number }> = {
  '23x23': { w: 506, h: 256 },
  '20x30': { w: 470, h: 328 },
  '30x20': { w: 646, h: 238 },
};

/** Cover sheet + finished page in mm for a size key, geometry module first. */
function resolveSizeMm(sizeKey: string): { cover: { w: number; h: number }; page: { w: number; h: number } } {
  const g = deriveGeometry(sizeKey);
  if (g && g.cover.w > 0 && g.cover.h > 0 && g.page.w > 0 && g.page.h > 0) {
    return { cover: g.cover, page: g.page };
  }
  return {
    cover: COVER_MM[sizeKey] || COVER_MM['20x30'],
    page: PAGE_MM[sizeKey] || PAGE_MM['20x30'],
  };
}

// Page (single leaf) dimensions per format, WITHOUT the spine and fold-in that
// COVER_MM carries. The editor's cover canvas represents exactly this area, so
// the inscription size has to be converted through it.
const PAGE_MM: Record<string, { w: number; h: number }> = {
  '23x23': { w: 230, h: 230 },
  '20x30': { w: 200, h: 300 },
  '30x20': { w: 300, h: 200 },
};

// Height of the editor's cover canvas at 100 % zoom (CoverEditor's
// EDITOR_BASE_CANVAS_H — kept as a literal so this print module stays free of
// React imports). A stored size of N px is N / 460 of the page height.
const EDITOR_BASE_CANVAS_H = 460;

const mmToPx300 = (mm: number) => Math.round((mm * 300) / 25.4);

// Cap the longest cover side so Satori/sharp stay within memory + the og size
// limit, then upscale on JPEG encode. 646 mm @300dpi ≈ 7630px which is large;
// we render at a comfortable resolution and the print file is still sharp
// because the content is flat colour + vector text (no raster detail to lose).
const MAX_RENDER_PX = 2600;

export interface WishbookCoverSpec {
  sizeKey: string;        // normalised '23x23' | '20x30' | '30x20'
  material: string;       // 'Велюр' | 'Друкована' | 'Шкірзамінник' | 'Тканина'
  coverColorName: string; // e.g. 'Блакитно-сірий'
  decoType: string;       // 'metal' | 'acryl' | 'photovstavka' | 'flex' | 'graviruvannya' | 'none'
  decoVariant: string;    // e.g. '90×50 срібний'
  decoColorName: string;  // 'Золотий' | 'Срібний' | ...
  title: string;          // engraved/printed text
  fontFamily: string;     // e.g. 'Cormorant Garamond'
  /**
   * Exact inscription layout from the editor's saved cover_data, when the
   * order has a linked project. Without it the title is centred at an
   * estimated size — which is NOT what the customer saw (TM-001132: the
   * напис came out мізерним and in the wrong colour). xPct/yPct are the
   * editor's percent position on the FRONT cover; fontPxEditor is the editor's
   * stored font size, in px on its base cover canvas (EDITOR_BASE_CANVAS_H tall
   * = the page height); color is the chosen ink.
   */
  layout?: { xPct?: number; yPct?: number; fontPxEditor?: number; color?: string } | null;
}

// Normalise a raw size label ("30×20 см (горизонтальна)", "23х23") to a key.
// Wishbook formats only — the fallback is a wishbook size, so never call this
// for a photobook.
export function normalizeWishbookSize(raw: string): string {
  const s = (raw || '').toLowerCase().replace(/[х×]/g, 'x').replace(/\s/g, '');
  if (s.includes('23x23')) return '23x23';
  if (s.includes('30x20')) return '30x20';
  if (s.includes('20x30')) return '20x30';
  return '20x30';
}

/**
 * Any book format this renderer can draw — the wishbook sizes plus every
 * photobook one (20×20, 25×25, 30×30 …), now that soft-cover photobooks use it
 * for their engraving макет. Falls back to the wishbook normaliser only when the
 * geometry module does not recognise the key, so an unknown label still renders
 * something rather than throwing.
 */
export function normalizeCoverSize(raw: string): string {
  const k = geoNormalizeSizeKey(String(raw || ''));
  if (k && deriveGeometry(k)) return k;
  return normalizeWishbookSize(raw);
}

function detectDecoType(s: string): WishbookCoverSpec['decoType'] {
  const d = (s || '').toLowerCase();
  if (d.includes('акрил') || d.includes('acryl')) return 'acryl';
  if (d.includes('фотовставка') || d.includes('photo')) return 'photovstavka';
  if (d.includes('флекс') || d.includes('flex') || d.includes('друк кольор')) return 'flex';
  if (d.includes('метал') || d.includes('metal')) return 'metal';
  if (d.includes('гравір') || d.includes('engrav')) return 'graviruvannya';
  return 'none';
}

function resolveCoverColor(material: string, colorName: string): string {
  const m = (material || '').toLowerCase();
  if (m.includes('тканин') || m.includes('fabric')) return FABRIC_COLORS[colorName] || '#C4AA88';
  if (m.includes('шкір') || m.includes('leather')) return LEATHERETTE_COLORS[colorName] || '#D9C8B0';
  if (m.includes('велюр') || m.includes('velour')) return VELOUR_COLORS[colorName] || '#D9C8B0';
  // Printed cover — light neutral; the colour comes from the print itself.
  return '#EAE7E0';
}

// Parse "90×50 срібний" → { w: 90, h: 50 }. Falls back to a sane plate size.
function parseVariantDims(variant: string): { w: number; h: number } {
  const m = (variant || '').match(/(\d+)\s*[х×x]\s*(\d+)/i);
  if (m) return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
  return { w: 90, h: 50 };
}

function decoMetalColor(decoColorName: string): { fill: string; text: string } {
  const c = (decoColorName || '').toLowerCase();
  if (c.includes('срібн') || c.includes('silver')) return { fill: '#C8C8C8', text: '#1A1A1A' };
  if (c.includes('білий') || c.includes('white')) return { fill: '#F0F0F0', text: '#1A1A1A' };
  if (c.includes('чорн') || c.includes('black')) return { fill: '#2A2A2A', text: '#FFFFFF' };
  return { fill: '#D4AF37', text: '#3D2800' }; // gold
}

/** Pick a readable text colour against an arbitrary background hex. */
function contrastText(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#2A2A2A' : '#FFFFFF';
}

/**
 * Fetch a Google Font's TTF bytes for Satori. Returns null on failure so the
 * caller can fall back to the default font (Satori still renders, just not in
 * the exact typeface).
 */
const fontCache = new Map<string, ArrayBuffer | null>();

async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  // The colour sheet and the mono макет are rendered back to back from the same
  // spec, so without this cache we fetch the identical TTF twice per order.
  const cacheKey = `${family}::${text}`;
  if (fontCache.has(cacheKey)) return fontCache.get(cacheKey) ?? null;
  const loaded = await fetchGoogleFont(family, text);
  fontCache.set(cacheKey, loaded);
  return loaded;
}

async function fetchGoogleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&text=${encodeURIComponent(text)}`;
    const cssRes = await fetch(url, {
      headers: {
        // Ask for TTF (Satori cannot parse woff2).
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const m = css.match(/src:\s*url\(([^)]+\.ttf)\)/) || css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/);
    if (!m) return null;
    const fontRes = await fetch(m[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export interface WishbookRenderOptions {
  /**
   * Monochrome production макет: FRONT COVER ONLY, pure white background, pure
   * black text. Production engraves / embosses from this file, so it has to be
   * clean two-tone artwork. Desaturating the colour sheet instead (what we did
   * until 2026-08-06) produced a grey background with a barely visible light
   * inscription, and it carried the back cover along with the front. The colour
   * cover.jpg is unaffected by this flag.
   */
  mono?: boolean;
}

/**
 * Render the wishbook cover to PNG bytes (Uint8Array). Caller converts to JPEG.
 */
export async function renderWishbookCoverPng(
  spec: WishbookCoverSpec,
  opts: WishbookRenderOptions = {}
): Promise<Uint8Array> {
  const mono = opts.mono === true;
  const sizeKey = normalizeCoverSize(spec.sizeKey);
  const sizeMm = resolveSizeMm(sizeKey);
  const mm = sizeMm.cover;

  // Full print pixel size at 300 DPI, then clamp the render to MAX_RENDER_PX on
  // the longest side (keeps the same aspect ratio).
  const fullW = mmToPx300(mm.w);
  const fullH = mmToPx300(mm.h);
  const k = Math.min(1, MAX_RENDER_PX / Math.max(fullW, fullH));
  const sheetW = Math.round(fullW * k);
  const H = Math.round(fullH * k);

  // The front cover is the RIGHT half of the full sheet (back | spine | front)
  // — the same split the editor's xPct coordinates are measured against. The
  // mono макет renders that half on its own canvas, so the inscription keeps
  // exactly the position the customer gave it in the editor.
  const W = mono ? Math.round(sheetW / 2) : sheetW;
  const frontLeft = mono ? 0 : W / 2;
  const frontW = mono ? W : W / 2;

  const bg = mono ? '#FFFFFF' : resolveCoverColor(spec.material, spec.coverColorName);
  const title = (spec.title || '').trim();
  const decoType = spec.decoType;

  // Decoration plate footprint (mm → px). The plate is a physical object, so it
  // is measured against the full sheet width in both modes.
  const plate = parseVariantDims(spec.decoVariant);
  const plateW = Math.max(sheetW * 0.14, Math.min(sheetW * 0.9, (plate.w / mm.w) * sheetW));
  const plateH = Math.max(H * 0.08, Math.min(H * 0.9, (plate.h / mm.h) * H));

  const metal = decoMetalColor(spec.decoColorName);
  const titleFont = spec.fontFamily || 'Playfair Display';

  // Font size: title fills a good fraction of the plate (metal/acryl) or the
  // cover (engraving / printed). Scaled to the render size.
  const onPlate = decoType === 'metal' || decoType === 'acryl' || decoType === 'photovstavka';
  const titleAreaW = onPlate ? plateW * 0.86 : W * 0.78;
  // Rough fit: assume ~0.58 aspect per glyph; clamp to sane bounds.
  const approxFontByWidth = title.length > 0 ? (titleAreaW / (title.length * 0.56)) : W * 0.06;
  const estimatedFontSize = Math.max(W * 0.02, Math.min(onPlate ? plateH * 0.5 : H * 0.16, approxFontByWidth));
  // Editor-exact size when the layout is known. The stored value is px on the
  // editor's base cover canvas, which represents the PAGE (200×300 mm and the
  // like) — while H here spans the whole print sheet, page plus fold-in. So the
  // conversion has to go through millimetres, not through a bare pixel ratio:
  // the old `fontPx700 * (H / 700)` was short by about a quarter and made the
  // напис print noticeably smaller than the customer set it.
  const pageMm = sizeMm.page;
  const pxPerMmPrint = H / mm.h;
  const pxPerMmEditor = EDITOR_BASE_CANVAS_H / pageMm.h;
  const fontSize = (!onPlate && spec.layout?.fontPxEditor)
    ? Math.max(W * 0.008, spec.layout.fontPxEditor * (pxPerMmPrint / pxPerMmEditor))
    : estimatedFontSize;

  const titleColor = mono
    ? '#000000'
    : onPlate
    ? metal.text
    : (spec.layout?.color || contrastText(bg));

  // The decoration plate element (for metal/acryl/photo-insert). For engraving
  // / flex / none there's no raised plate — the title sits on the cover.
  const decorationPlate = onPlate ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${plateW}px`,
        height: `${plateH}px`,
        borderRadius: decoType === 'acryl' ? '8px' : '4px',
        // Mono макет: the plate is drawn as an outline only, so the sheet stays
        // white-background / black-ink and production sees just the footprint.
        background: mono
          ? '#FFFFFF'
          : decoType === 'metal'
            ? metal.fill
            : decoType === 'acryl'
            ? 'rgba(255,255,255,0.22)'
            : 'rgba(255,255,255,0.14)',
        border: mono
          ? (decoType === 'photovstavka' ? '3px dashed #000000' : '3px solid #000000')
          : decoType === 'acryl'
            ? '3px solid rgba(255,255,255,0.55)'
            : decoType === 'photovstavka'
            ? '3px dashed rgba(255,255,255,0.55)'
            : '0',
        boxShadow: !mono && decoType === 'metal' ? 'inset 0 2px 2px rgba(255,255,255,0.4)' : 'none',
        padding: '0 4%',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontFamily: `"${titleFont}"`,
          fontWeight: 700,
          fontSize: `${fontSize}px`,
          color: titleColor,
          textAlign: 'center',
          lineHeight: 1.15,
          letterSpacing: '0.02em',
        }}
      >
        {title}
      </div>
    </div>
  ) : spec.layout && (spec.layout.xPct !== undefined || spec.layout.yPct !== undefined) ? (
    // Editor-exact placement: xPct/yPct are percentages of the FRONT cover,
    // which is the RIGHT half of the full sheet (back | spine | front) — and
    // the whole canvas in mono mode.
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        left: `${Math.round(frontLeft + ((spec.layout.xPct ?? 50) / 100) * frontW)}px`,
        top: `${Math.round(((spec.layout.yPct ?? 50) / 100) * H)}px`,
        transform: 'translate(-50%, -50%)',
        fontFamily: `"${titleFont}"`,
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        color: titleColor,
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: '0.02em',
        maxWidth: `${frontW * 0.92}px`,
      }}
    >
      {title}
    </div>
  ) : (
    <div
      style={{
        display: 'flex',
        fontFamily: `"${titleFont}"`,
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        color: titleColor,
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: '0.02em',
        maxWidth: `${W * 0.82}px`,
        padding: '0 6%',
      }}
    >
      {title}
    </div>
  );

  // Load the title font (Cyrillic-capable Google fonts). Fall back silently.
  const fontData = await loadGoogleFont(titleFont, title || 'Книга побажань');
  const fonts = fontData
    ? [{ name: titleFont, data: fontData, weight: 700 as const, style: 'normal' as const }]
    : [];

  const image = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          background: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {decorationPlate}
      </div>
    ),
    {
      width: W,
      height: H,
      fonts,
    }
  );

  const buf = await image.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Build a WishbookCoverSpec from an order item's options object. Handles the
 * two option-key dialects seen in real orders ("Розмір книги" vs "Розмір",
 * "Декорація обкладинки" vs "Оформлення", etc.).
 */
export function specFromOrderOptions(options: Record<string, any>): WishbookCoverSpec {
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const v = options?.[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };

  const sizeRaw = get('Розмір книги', 'Розмір', 'Size');
  const material = get('Обкладинка', 'Матеріал обкладинки', 'Cover') || 'Велюр';
  const coverColorName = get('Колір обкладинки', 'Cover color');
  const decoRaw = get('Декорація обкладинки', 'Оздоблення', 'Decoration');
  const decoVariant = get('Варіант декорації', 'Варіант оздоблення', 'Decoration variant');
  const decoColorName = get('Колір напису', 'Колір декорації', 'Decoration color');
  const title = get('Напис на декорації', 'Напис на обкладинку', 'Напис', 'Title', 'Text');
  const fontFamily = get('Шрифт напису', 'Шрифт', 'Font') || 'Playfair Display';

  return {
    sizeKey: normalizeCoverSize(sizeRaw),
    material,
    coverColorName,
    decoType: detectDecoType(decoRaw),
    decoVariant,
    decoColorName,
    title,
    fontFamily,
  };
}
