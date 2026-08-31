/**
 * Canonical editor types.
 *
 * These shapes are the editor's data model. They used to live here AND be
 * re-declared privately inside components/BookLayoutEditor.tsx (and partly in
 * BookPreviewModal.tsx), and the copies drifted badly: the versions in this
 * file had PhotoData at 5 fields against the real 13, SlotData at 5 against
 * 11, and LayoutType as a bare `string` against a ~200-member union. Nothing
 * imported this file at all, while ARCHITECTURE.md named it the source of
 * truth — so anyone following the docs was reading shapes that had not been
 * accurate for a long time.
 *
 * The definitions below are now the real ones, lifted verbatim from the
 * editor, and the editor imports them from here. Change a shape HERE.
 */

//  Book Editor Types 

// `thumb` is a small (~360px) JPEG data URL generated in the focal-detection
// pass. The photo tray, film strip and page-navigator thumbnails render it
// instead of the full editor preview (up to 5000px) — decoding dozens of
// full-size bitmaps for 60px tiles was a constant source of scroll/paint jank.
export interface PhotoData { id: string; preview: string; thumb?: string; width: number; height: number; name: string; focalX?: number; focalY?: number; hasFace?: boolean; noBgUrl?: string; noBgLoading?: boolean; originalFile?: File; storagePath?: string; }

export interface BookConfig { productSlug: string; productId?: string; productName: string; selectedSize?: string; selectedCoverType?: string; selectedCoverColor?: string; selectedPageColor?: string; selectedDecoration?: string; selectedDecorationType?: string; selectedDecorationVariant?: string; selectedDecorationSize?: string; selectedDecorationColor?: string; selectedPageCount: string; selectedCopies?: string; decorationSurcharge?: number; totalPrice: number; selectedLamination?: string; selectedPageLamination?: string; selectedUrgency?: string | null; enableKalka?: boolean; enableEndpaper?: boolean; minPageCount?: number; productImage?: string; }

export type CoverDecoType = 'none'|'acryl'|'photovstavka'|'flex'|'metal'|'graviruvannya';

export interface CoverState {
  decoType: CoverDecoType;
  decoVariant: string;
  photoId: string | null;
  decoText: string;
  decoColor: string;
  textX: number;
  textY: number;
  textFontFamily: string;
  textFontSize: number;
  extraTexts: { id: string; text: string; x: number; y: number; fontFamily: string; fontSize: number; color: string; }[];
  // Method used to apply the inscription on the non-printed cover (velour /
  // fabric / leather / scrapbook). Set when the first extraText is added,
  // cleared when the last one is removed. Customer picks: 'flex' (Друк
  // кольором) or 'graviruvannya' (Гравірування). +180 ₴ is charged whenever
  // extraTexts.length > 0 — flat, regardless of how many inscriptions.
  inscriptionMethod?: 'flex' | 'graviruvannya' | null;
  printedPhotoSlot?: { x: number; y: number; w: number; h: number; shape: 'rect'|'circle'|'rounded'|'heart' } | null;
  printedPhotoSlots?: { x: number; y: number; w: number; h: number; shape: 'rect'|'circle'|'rounded'|'heart'; photoId?: string|null; cropX?: number; cropY?: number; zoom?: number }[];
  printedTextBlocks?: { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold: boolean }[];
  printedOverlay?: { type: 'none'|'color'|'gradient'; color: string; opacity: number; gradient: string };
  printedBgColor?: string;
  // Ready-made full-cover background image (travel book ready covers).
  // When set, the front cover renders this image full-bleed; the customer
  // can still add text on top. Mutually informative with printedBgColor.
  printedBgImage?: string | null;
  // WHICH ready cover it is, by identity rather than by URL. The image alone
  // told the admin card «якась готова обкладинка» and nothing more, so the only
  // way to name the customer's choice was to recognise the picture. Recorded at
  // the moment it is applied, from either entry point — the config step or the
  // picker inside the editor.
  readyCoverId?: string | null;
  readyCoverName?: string | null;
  backCoverBgColor?: string;
  backCoverPhotoId?: string | null;
  backCoverCropX?: number;
  backCoverCropY?: number;
  backCoverZoom?: number;
  backCoverSlot?: { x: number; y: number; w: number; h: number; shape: 'rect'|'circle'|'rounded'|'heart' };
  // Free-positioned text blocks rendered on the back cover. Same shape as
  // printedTextBlocks. Optional; presence of items means the back cover
  // has been customised with text. Renders only when isPrinted.
  backCoverTexts?: { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold: boolean }[];
}

export interface ExtraText {
  id: string;
  text: string;
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;
  color: string;
}

export interface PrintedPhotoSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'rect' | 'circle' | 'rounded' | 'heart';
}

export interface PrintedTextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
}

export interface PrintedOverlay {
  type: 'none' | 'color' | 'gradient';
  color: string;
  opacity: number;
  gradient: string;
}

export type LayoutType =
  // 1 photo
  'p-full' | 'p-center' | 'p-top' | 'p-bottom' | 'p-left' | 'p-right' |
  'p-1-top-strip' | 'p-1-bottom-strip' | 'p-1-left-wide' | 'p-1-right-wide' |
  'p-1-polaroid' | 'p-1-portrait' | 'p-1-landscape' | 'p-1-corner-tl' | 'p-1-corner-br' |
  // 2 photos
  'p-2-v' | 'p-2-h' | 'p-2-big-top' | 'p-2-big-bottom' | 'p-2-big-left' | 'p-2-big-right' | 'p-2-diag' |
  'p-2-overlap' | 'p-2-top-strip' | 'p-2-bottom-strip' | 'p-2-75-25' | 'p-2-25-75' |
  'p-2-center-pair' | 'p-2-cinema' | 'p-2-frame' |
  // 3 photos
  'p-3-row' | 'p-3-col' | 'p-3-top2' | 'p-3-bot2' | 'p-3-left2' | 'p-3-right2' | 'p-3-hero-top' | 'p-3-hero-left' |
  'p-3-hero-right' | 'p-3-strip-top' | 'p-3-strip-bot' | 'p-3-diagonal' | 'p-3-mosaic' | 'p-3-featured' | 'p-3-panorama' |
  // 4 photos
  'p-4-grid' | 'p-4-hero-top' | 'p-4-hero-left' | 'p-4-strip-h' | 'p-4-strip-v' | 'p-4-l-shape' |
  'p-4-mosaic' | 'p-4-top-bottom' | 'p-4-corner' | 'p-4-cinema' | 'p-4-focus' |
  'p-4-row-top' | 'p-4-hero-bottom' | 'p-4-cross' | 'p-4-uneven' |
  // 5 photos
  'p-5-hero' | 'p-5-grid' | 'p-5-strip' |
  'p-5-col' | 'p-5-row' | 'p-5-2-3' | 'p-5-3-2' | 'p-5-mosaic' | 'p-5-focus' |
  'p-5-big-left' | 'p-5-big-right' | 'p-5-cross' | 'p-5-panorama' | 'p-5-diagonal' | 'p-5-corner' |
  // 6 photos
  'p-6-grid' | 'p-6-3x2' | 'p-6-hero' |
  'p-6-strip-h' | 'p-6-strip-v' | 'p-6-mosaic' | 'p-6-hero-top' | 'p-6-hero-left' |
  'p-6-cols' | 'p-6-focus' | 'p-6-2-4' | 'p-6-4-2' | 'p-6-diagonal' | 'p-6-magazine' | 'p-6-uneven' |
  // 7 photos
  'p-7-grid' | 'p-7-hero' | 'p-7-3-4' | 'p-7-4-3' | 'p-7-mosaic' | 'p-7-col' |
  'p-7-big-top' | 'p-7-cols' | 'p-7-strip' | 'p-7-focus' |
  'p-7-row' | 'p-7-col-full' | 'p-7-panorama' | 'p-7-magazine' | 'p-7-diagonal' |
  // 8 photos
  'p-8-grid' | 'p-8-hero' | 'p-8-2x4' | 'p-8-mosaic' | 'p-8-strip-v' | 'p-8-focus' | 'p-8-cols' |
  'p-8-3-5' | 'p-8-5-3' | 'p-8-corner' | 'p-8-strip-h' | 'p-8-diagonal' | 'p-8-magazine' |
  'p-8-row' | 'p-8-col' | 'p-8-4-4' | 'p-8-big-top' | 'p-8-big-left' | 'p-8-panorama' | 'p-8-uneven' | 'p-8-cross' |
  // 9 photos
  'p-9-grid' | 'p-9-hero' | 'p-9-mosaic' | 'p-9-strip' | 'p-9-focus' |
  'p-9-cols' | 'p-9-3-3-3' | 'p-9-hero-top' | 'p-9-big-left' | 'p-9-magazine' | 'p-9-diagonal' | 'p-9-4-5' | 'p-9-5-4' | 'p-9-strip-h' |
  // text
  'p-text' | 'p-text-top' | 'p-text-bottom' |
  // SPREAD layouts (180° flat-lay photobooks — double width)
  'sp-full' | 'sp-2-v' | 'sp-2-h' | 'sp-2-big-left' | 'sp-2-big-right' | 'sp-2-big-top' | 'sp-2-big-bottom' |
  'sp-3-row' | 'sp-3-col' | 'sp-3-hero-left' | 'sp-3-hero-right' | 'sp-3-hero-top' | 'sp-3-hero-bottom' |
  'sp-4-grid' | 'sp-4-hero' | 'sp-4-hero-right' | 'sp-4-top-bottom' | 'sp-4-strip-h' |
  'sp-5-grid' | 'sp-5-hero' | 'sp-6-grid' |
  'sp-1-left' | 'sp-1-right' | 'sp-1-center' | 'sp-1-left-wide' | 'sp-1-right-wide' |
  'sp-2-left-pair' | 'sp-2-right-pair' | 'sp-2-diag' |
  'sp-3-l-shape' | 'sp-3-t-shape' | 'sp-3-center' |
  'sp-4-strip-v' | 'sp-4-mosaic' | 'sp-4-hero-top' | 'sp-4-hero-bottom' |
  'sp-5-quilt' | 'sp-6-hero' | 'sp-7-grid' | 'sp-8-grid' |
  'sp-5-strip' | 'sp-6-mosaic' | 'sp-7-hero' | 'sp-8-mosaic' |
  'sp-9-grid' | 'sp-10-grid' | 'sp-10-hero' | 'sp-12-grid' |
  'sp-1-top-strip' | 'sp-1-bottom-strip' | 'sp-2-75-25' | 'sp-2-25-75' | 'sp-2-cross' |
  'sp-3-uneven' | 'sp-3-steps' | 'sp-3-panorama' | 'sp-4-focus' | 'sp-4-corner' | 'sp-4-cinema' |
  'sp-5-focus' | 'sp-6-cols' | 'sp-9-hero' | 'sp-15-grid' | 'sp-16-grid' |
  'sp-1-polaroid' | 'sp-1-portrait' | 'sp-1-landscape' | 'sp-1-corner-tl' | 'sp-1-corner-br' |
  'sp-1-left-strip' | 'sp-1-right-strip' |
  'sp-2-triptych' | 'sp-2-overlap' | 'sp-2-frame' |
  'sp-3-magazine' | 'sp-3-focus' | 'sp-3-diagonal' |
  'sp-4-magazine' | 'sp-4-diagonal' | 'sp-4-uneven' |
  'p-1-oval' | 'p-1-inset-tl' | 'p-1-inset-br' | 'p-1-wide-center' | 'p-1-tall-center' |
  'p-2-triptych' | 'p-2-asymm-left' | 'p-2-asymm-right' | 'p-2-stacked-center' | 'p-2-wide-top' |
  'p-3-fan' | 'p-3-asymm' | 'p-3-stacked' | 'p-3-wide-mid' | 'p-3-2col' |
  'p-4-diamond' | 'p-4-t-shape' | 'p-4-asymm-col' | 'p-4-wide-bot' | 'p-4-center-focus' |
  'p-5-scattered' | 'p-5-pyramid' | 'p-5-2-1-2' | 'p-5-wide-center' | 'p-5-editorial' |
  'p-6-editorial' | 'p-6-3rows' | 'p-6-asymm' | 'p-6-pyramid' | 'p-6-center-hero' |
  'p-9-4-rows' | 'p-9-big-center' | 'p-9-2col-asym' | 'p-9-cross' | 'p-9-editorial' | 'p-9-zigzag' |
  'p-text-center' | 'p-text-left' | 'p-text-right' | 'p-text-photo-left' | 'p-text-photo-right' |
  'sp-1-tilt-left' | 'sp-1-tilt-right' | 'sp-1-wide-strip' | 'sp-1-panorama' | 'sp-1-inset' |
  'sp-2-stacked-left' | 'sp-2-stacked-right' | 'sp-2-panorama-pair' | 'sp-2-asymm-top' | 'sp-2-inset-small' |
  'sp-3-editorial' | 'sp-3-scattered' | 'sp-3-asymm-wide' | 'sp-3-two-col' | 'sp-3-one-two' |
  'sp-4-editorial' | 'sp-4-pyramid' | 'sp-4-scattered' | 'sp-4-2-2' | 'sp-4-asymm-wide' |
  'sp-5-editorial' | 'sp-6-editorial' | 'sp-8-editorial' | 'sp-11-grid' | 'sp-14-grid' |
  // Вертикальні слоти на сторінку + дзеркальні пари на розворот (поза лінією згину)
  'p-vert-1' | 'p-vert-2' | 'p-vert-3' | 'sp-mirror-1' | 'sp-mirror-2' | 'sp-mirror-3' |
  // Колаж зі стовпцями-парами (велике + пара фото стопкою)
  'sp-6-pairs' | 'sp-4-pairs-center';

export interface SlotData { photoId: string | null; cropX: number; cropY: number; zoom: number; rotation?: number; shape?: 'rect' | 'rounded' | 'circle' | 'heart'; customX?: number; customY?: number; customW?: number; customH?: number; customPct?: boolean; fit?: 'cover' | 'contain'; }

export interface TextBlock { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold: boolean; italic: boolean; zOrder?: number; /** Box width as % of its container. Unset = hug the content (the original behaviour). */ w?: number; }

export interface Page { id: number; label: string; layout: LayoutType; slots: SlotData[]; textBlocks: TextBlock[]; }

export interface LayoutDef {
  id: LayoutType;
  label: string;
  slots: number;
  group: string;
}

export interface StickerData {
  id: string;
  url: string;
  emoji?: string;
  x: number;
  y: number;
  w: number | string;
  h: number | string;
}

export interface KalkaState {
  text: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  imageUrl: string | null;
}

export interface EndpaperSide {
  enabled: boolean;
  text: string;
  textColor: string;
  imageUrl: string | null;
}

export interface EndpaperState {
  first: EndpaperSide;
  last: EndpaperSide;
}

export interface CtxMenu {
  x: number;
  y: number;
  type: 'text' | 'slot' | 'freeslot';
  id: string;
  pageIdx?: number;
}

export type LeftTab =
  | 'photos' | 'layouts' | 'text' | 'cover' | 'bg'
  | 'shapes' | 'frames' | 'stickers' | 'options'
  | 'kalka' | 'endpaper' | 'qr';

export type HistoryEntry = {
  pages: Page[];
  freeSlots: Record<number, any[]>;
};
