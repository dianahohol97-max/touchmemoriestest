// ── Book Editor Types ────────────────────────────────────────────────────────

export interface PhotoData {
  id: string;
  preview: string;
  width: number;
  height: number;
  name: string;
}

export interface BookConfig {
  productSlug: string;
  productName: string;
  selectedSize?: string;
  selectedCoverType?: string;
  selectedCoverColor?: string;
  selectedDecoration?: string;
  selectedDecorationType?: string;
  selectedDecorationVariant?: string;
  selectedDecorationSize?: string;
  selectedDecorationColor?: string;
  selectedPageCount: string;
  totalPrice: number;
  selectedLamination?: string;
  enableKalka?: boolean;
  enableEndpaper?: boolean;
  minPageCount?: number;
}

export type CoverDecoType = 'none' | 'acryl' | 'photovstavka' | 'flex' | 'metal' | 'graviruvannya';

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
  extraTexts: ExtraText[];
  printedPhotoSlot?: PrintedPhotoSlot;
  printedTextBlocks?: PrintedTextBlock[];
  printedOverlay?: PrintedOverlay;
  printedBgColor?: string;
  backCoverBgColor?: string;
  backCoverPhotoId?: string | null;
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
  shape: 'rect' | 'circle' | 'rounded';
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
  | 'p-full' | 'p-center' | 'p-top' | 'p-bottom' | 'p-left' | 'p-right'
  // 2 photos
  | 'p-2-v' | 'p-2-h' | 'p-2-big-top' | 'p-2-big-bottom' | 'p-2-big-left' | 'p-2-big-right' | 'p-2-diag'
  // 3 photos
  | 'p-3-row' | 'p-3-col' | 'p-3-top2' | 'p-3-bot2' | 'p-3-left2' | 'p-3-right2' | 'p-3-hero-top' | 'p-3-hero-left'
  // 4 photos
  | 'p-4-grid' | 'p-4-hero-top' | 'p-4-hero-left' | 'p-4-strip-h' | 'p-4-strip-v' | 'p-4-l-shape'
  // 5 photos
  | 'p-5-hero' | 'p-5-grid' | 'p-5-strip'
  // 6 photos
  | 'p-6-grid' | 'p-6-3x2' | 'p-6-hero'
  // 7-9
  | 'p-7-grid' | 'p-8-grid' | 'p-9-grid'
  // text
  | 'p-text' | 'p-text-top' | 'p-text-bottom'
  // SPREAD layouts (180° flat-lay photobooks — double width)
  | 'sp-full' | 'sp-2-v' | 'sp-2-h' | 'sp-2-big-left' | 'sp-2-big-right'
  | 'sp-3-row' | 'sp-3-hero-left' | 'sp-3-hero-right'
  | 'sp-4-grid' | 'sp-4-hero' | 'sp-1-left' | 'sp-1-right' | 'sp-1-center';

export interface SlotData {
  photoId: string | null;
  cropX: number;
  cropY: number;
  zoom: number;
}

export interface TextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface Page {
  id: number;
  label: string;
  layout: LayoutType;
  slots: SlotData[];
  textBlocks: TextBlock[];
}

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
  | 'kalka' | 'endpaper';

export type HistoryEntry = {
  pages: Page[];
  freeSlots: Record<number, any[]>;
};
