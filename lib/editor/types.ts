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

export type LayoutType = string;

export interface SlotData {
  photoId: string | null;
  cropX: number;
  cropY: number;
  zoom: number;
  rotation?: number; // degrees 0-360
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
  | 'kalka' | 'endpaper' | 'qr';

export type HistoryEntry = {
  pages: Page[];
  freeSlots: Record<number, any[]>;
};
