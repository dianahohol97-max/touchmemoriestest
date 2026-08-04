/** Gallery design constructor options. The single source of truth for what
 *  the cabinet can save and the client gallery can render — both sides import
 *  from here so a new option only needs to be added once. */

export const GALLERY_BG = ['light', 'cream', 'dark'] as const;
export const GALLERY_FONTS = ['playfair', 'cormorant', 'montserrat', 'caveat'] as const;
export const GALLERY_FONT_SCALES = ['s', 'm', 'l'] as const;
export const GALLERY_COVERS = ['classic', 'bottom', 'split', 'minimal'] as const;
// How the photo grid is laid out: masonry columns, an even cropped grid, or
// a large editorial two-column flow.
export const GALLERY_LAYOUTS = ['masonry', 'grid', 'large'] as const;
// Languages the client gallery can speak — picked for where Ukrainian
// photographers actually work abroad (Diana, 2026-08-04): PL/DE/CZ plus the
// big Western European markets and the site's existing RO locale.
export const GALLERY_LANGS = ['uk', 'en', 'pl', 'de', 'cs', 'it', 'es', 'fr', 'ro'] as const;

export type GalleryBg = typeof GALLERY_BG[number];
export type GalleryFont = typeof GALLERY_FONTS[number];
export type GalleryFontScale = typeof GALLERY_FONT_SCALES[number];
export type GalleryCover = typeof GALLERY_COVERS[number];
export type GalleryLayout = typeof GALLERY_LAYOUTS[number];
export type GalleryLang = typeof GALLERY_LANGS[number];

export interface GalleryDesign {
  bg: GalleryBg;
  font: GalleryFont;
  font_scale: GalleryFontScale;
  cover: GalleryCover;
  layout: GalleryLayout;
  lang: GalleryLang;
}

export const DEFAULT_DESIGN: GalleryDesign = {
  bg: 'light',
  font: 'playfair',
  font_scale: 'm',
  cover: 'classic',
  layout: 'masonry',
  lang: 'uk',
};

/** Merge an untrusted partial design over the current one, dropping unknown
 *  keys and invalid values instead of failing the whole request. */
export function sanitizeDesign(current: Partial<GalleryDesign> | null, patch: unknown): GalleryDesign {
  const p = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>;
  const pick = <T extends readonly string[]>(allowed: T, ...vals: unknown[]): T[number] => {
    for (const v of vals) if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T[number];
    return allowed[0];
  };
  return {
    bg: pick(GALLERY_BG, p.bg, current?.bg, DEFAULT_DESIGN.bg),
    font: pick(GALLERY_FONTS, p.font, current?.font, DEFAULT_DESIGN.font),
    font_scale: pick(GALLERY_FONT_SCALES, p.font_scale, current?.font_scale, DEFAULT_DESIGN.font_scale),
    cover: pick(GALLERY_COVERS, p.cover, current?.cover, DEFAULT_DESIGN.cover),
    layout: pick(GALLERY_LAYOUTS, p.layout, current?.layout, DEFAULT_DESIGN.layout),
    lang: pick(GALLERY_LANGS, p.lang, current?.lang, DEFAULT_DESIGN.lang),
  };
}
