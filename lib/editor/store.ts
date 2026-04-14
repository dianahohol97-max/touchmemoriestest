'use client';

import { create } from 'zustand';
import type {
  PhotoData, BookConfig, CoverState, CoverDecoType, Page, TextBlock,
  KalkaState, EndpaperState, CtxMenu, LeftTab, HistoryEntry,
  StickerData,
} from './types';
import type { FreeSlot } from '@/components/FreeSlotLayer';
import type { Shape, ShapeType } from '@/components/ShapesLayer';
import type { PageBackground } from '@/components/BackgroundLayer';
import type { FrameConfig } from '@/components/FramesLayer';
import { DEFAULT_BG } from '@/components/BackgroundLayer';
import { DEFAULT_FRAME } from '@/components/FramesLayer';
import {
  makeSlots, initPages, initCoverStateFromConfig, handleCoverChange,
  getActivePageIdx as _getActivePageIdx,
} from './utils';
import { LAYOUTS } from './constants';
import { haptic } from '@/lib/hooks/useMobileInteractions';

// ── Default cover state ──────────────────────────────────────────────────────

const DEFAULT_COVER_STATE: CoverState = {
  decoType: 'none',
  decoVariant: '',
  photoId: null,
  decoText: '',
  decoColor: '#D4AF37',
  textX: 50,
  textY: 85,
  textFontFamily: 'Marck Script',
  textFontSize: 14,
  extraTexts: [],
};

// ── Store interface ──────────────────────────────────────────────────────────

interface BookEditorState {
  // Core data
  config: BookConfig | null;
  photos: PhotoData[];
  pages: Page[];
  coverState: CoverState;

  // Navigation
  currentIdx: number;
  activeSide: 0 | 1;
  zoom: number;
  isMobile: boolean;

  // UI state
  leftTab: LeftTab;
  mobilePanel: boolean;
  textTool: boolean;
  showPreview: boolean;
  showTooltips: boolean;
  tooltipStep: number;
  showMobileGuide: boolean;
  showDecoList: boolean;

  // Selection state
  dragPhotoId: string | null;
  tapSelectedPhotoId: string | null;
  dropTarget: string | null;
  selectedTextId: string | null;
  selectedTextPageIdx: number;
  editingTextId: string | null;
  selectedFreeSlotId: string | null;
  selectedShapeId: string | null;
  photoEditSlot: string | null;
  coverColorOverride: string | null;

  // Text tool defaults
  tFontSize: number;
  tFontFamily: string;
  tColor: string;
  tBold: boolean;
  tItalic: boolean;

  // Per-page data
  freeSlots: Record<number, FreeSlot[]>;
  pageBgs: Record<number, PageBackground>;
  pageShapes: Record<number, Shape[]>;
  pageFrames: Record<number, FrameConfig>;
  pageStickers: Record<number, StickerData[]>;

  // Kalka & Endpaper
  kalkaState: KalkaState;
  endpaperState: EndpaperState;

  // Context menu
  ctxMenu: CtxMenu | null;

  // Cross-page drag
  crossPageDragShapeId: string | null;
  crossDragPos: { x: number; y: number } | null;

  // Designer mode
  designerOrderId: string | null;
  designerSaving: boolean;

  // History (undo)
  history: HistoryEntry[];

  // ── Computed helpers ──
  getActivePageIdx: () => number;
  getEffectiveCoverColor: () => string;

  // ── Actions ──
  setConfig: (config: BookConfig) => void;
  setPhotos: (photos: PhotoData[] | ((prev: PhotoData[]) => PhotoData[])) => void;
  setPages: (pages: Page[] | ((prev: Page[]) => Page[])) => void;
  setCoverState: (coverState: CoverState | ((prev: CoverState) => CoverState)) => void;
  updateCoverFromChange: (cfg: Partial<CoverState>) => void;
  setCurrentIdx: (idx: number | ((prev: number) => number)) => void;
  setActiveSide: (side: 0 | 1) => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setIsMobile: (v: boolean) => void;
  setLeftTab: (tab: LeftTab) => void;
  setMobilePanel: (v: boolean) => void;
  setTextTool: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowPreview: (v: boolean) => void;
  setShowTooltips: (v: boolean) => void;
  setTooltipStep: (v: number) => void;
  setShowMobileGuide: (v: boolean) => void;
  setShowDecoList: (v: boolean) => void;
  setDragPhotoId: (id: string | null) => void;
  setTapSelectedPhotoId: (id: string | null) => void;
  setDropTarget: (id: string | null) => void;
  setSelectedTextId: (id: string | null) => void;
  setSelectedTextPageIdx: (idx: number) => void;
  setEditingTextId: (id: string | null) => void;
  setSelectedFreeSlotId: (id: string | null) => void;
  setSelectedShapeId: (id: string | null) => void;
  setPhotoEditSlot: (id: string | null) => void;
  setCoverColorOverride: (color: string | null) => void;
  setTFontSize: (v: number) => void;
  setTFontFamily: (v: string) => void;
  setTColor: (v: string) => void;
  setTBold: (v: boolean) => void;
  setTItalic: (v: boolean) => void;
  setFreeSlots: (slots: Record<number, FreeSlot[]> | ((prev: Record<number, FreeSlot[]>) => Record<number, FreeSlot[]>)) => void;
  setPageBgs: (bgs: Record<number, PageBackground> | ((prev: Record<number, PageBackground>) => Record<number, PageBackground>)) => void;
  setPageShapes: (shapes: Record<number, Shape[]> | ((prev: Record<number, Shape[]>) => Record<number, Shape[]>)) => void;
  setPageFrames: (frames: Record<number, FrameConfig> | ((prev: Record<number, FrameConfig>) => Record<number, FrameConfig>)) => void;
  setPageStickers: (stickers: Record<number, StickerData[]> | ((prev: Record<number, StickerData[]>) => Record<number, StickerData[]>)) => void;
  setKalkaState: (state: KalkaState | ((prev: KalkaState) => KalkaState)) => void;
  setEndpaperState: (state: EndpaperState | ((prev: EndpaperState) => EndpaperState)) => void;
  setCtxMenu: (menu: CtxMenu | null) => void;
  setCrossPageDragShapeId: (id: string | null) => void;
  setCrossDragPos: (pos: { x: number; y: number } | null) => void;
  setDesignerSaving: (v: boolean) => void;

  // ── Complex actions ──
  pushHistory: () => void;
  undo: () => void;
  initFromConfig: (config: BookConfig) => void;
  restoreDraft: () => void;
  saveDraft: () => void;
  addPhotos: (newPhotos: PhotoData[]) => void;
  changeLayout: (layout: string, pageW: number, cH: number, forceIdx?: number) => void;
  addSpread: () => void;
  removeCurrentSpread: (minPagesLen: number, minSpreads: number) => void;
  addFreeSlot: (pageW: number, cH: number) => void;
  addShape: (type: ShapeType, pageIdx: number, pageW: number, cH: number) => void;
  updateTextForPage: (id: string, changes: Partial<TextBlock>, pageIdx: number) => void;
  deleteTextForPage: (id: string, pageIdx: number) => void;
  clearSlot: (pi: number, si: number) => void;
  autoFill: () => void;
}

// ── Helper: apply a setter that can be value or function ──────────────────────

function applyUpdate<T>(current: T, update: T | ((prev: T) => T)): T {
  return typeof update === 'function' ? (update as (prev: T) => T)(current) : update;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useBookEditorStore = create<BookEditorState>((set, get) => ({
  // Core data
  config: null,
  photos: [],
  pages: [],
  coverState: DEFAULT_COVER_STATE,

  // Navigation
  currentIdx: 0,
  activeSide: 0,
  zoom: typeof window !== 'undefined' && window.innerWidth < 768 ? 40 : 70,
  isMobile: false,

  // UI state
  leftTab: 'photos',
  mobilePanel: false,
  textTool: false,
  showPreview: false,
  showTooltips: false,
  tooltipStep: 0,
  showMobileGuide: false,
  showDecoList: false,

  // Selection state
  dragPhotoId: null,
  tapSelectedPhotoId: null,
  dropTarget: null,
  selectedTextId: null,
  selectedTextPageIdx: 1,
  editingTextId: null,
  selectedFreeSlotId: null,
  selectedShapeId: null,
  photoEditSlot: null,
  coverColorOverride: null,

  // Text tool
  tFontSize: 28,
  tFontFamily: 'Montserrat',
  tColor: '#1e2d7d',
  tBold: false,
  tItalic: false,

  // Per-page data
  freeSlots: {},
  pageBgs: {},
  pageShapes: {},
  pageFrames: {},
  pageStickers: {},

  // Kalka & Endpaper
  kalkaState: { text: '', textColor: '#333333', fontSize: 24, fontFamily: 'Playfair Display', imageUrl: null },
  endpaperState: {
    first: { enabled: false, text: '', textColor: '#333333', imageUrl: null },
    last: { enabled: false, text: '', textColor: '#333333', imageUrl: null },
  },

  // Context menu
  ctxMenu: null,

  // Cross-page drag
  crossPageDragShapeId: null,
  crossDragPos: null,

  // Designer mode
  designerOrderId: null,
  designerSaving: false,

  // History
  history: [],

  // ── Computed ──
  getActivePageIdx: () => {
    const { currentIdx, activeSide } = get();
    return _getActivePageIdx(currentIdx, activeSide);
  },

  getEffectiveCoverColor: () => {
    const { coverColorOverride, config } = get();
    return coverColorOverride ?? (config?.selectedCoverColor || '');
  },

  // ── Simple setters ──
  setConfig: (config) => set({ config }),
  setPhotos: (update) => set(s => ({ photos: applyUpdate(s.photos, update) })),
  setPages: (update) => set(s => ({ pages: applyUpdate(s.pages, update) })),
  setCoverState: (update) => set(s => ({ coverState: applyUpdate(s.coverState, update) })),
  updateCoverFromChange: (cfg) => set(s => ({ coverState: handleCoverChange(cfg, s.coverState) })),
  setCurrentIdx: (update) => set(s => ({ currentIdx: applyUpdate(s.currentIdx, update) })),
  setActiveSide: (side) => set({ activeSide: side }),
  setZoom: (update) => set(s => ({ zoom: applyUpdate(s.zoom, update) })),
  setIsMobile: (v) => set({ isMobile: v }),
  setLeftTab: (tab) => set({ leftTab: tab }),
  setMobilePanel: (v) => set({ mobilePanel: v }),
  setTextTool: (update) => set(s => ({ textTool: applyUpdate(s.textTool, update) })),
  setShowPreview: (v) => set({ showPreview: v }),
  setShowTooltips: (v) => set({ showTooltips: v }),
  setTooltipStep: (v) => set({ tooltipStep: v }),
  setShowMobileGuide: (v) => set({ showMobileGuide: v }),
  setShowDecoList: (v) => set({ showDecoList: v }),
  setDragPhotoId: (id) => set({ dragPhotoId: id }),
  setTapSelectedPhotoId: (id) => set({ tapSelectedPhotoId: id }),
  setDropTarget: (id) => set({ dropTarget: id }),
  setSelectedTextId: (id) => set({ selectedTextId: id }),
  setSelectedTextPageIdx: (idx) => set({ selectedTextPageIdx: idx }),
  setEditingTextId: (id) => set({ editingTextId: id }),
  setSelectedFreeSlotId: (id) => set({ selectedFreeSlotId: id }),
  setSelectedShapeId: (id) => set({ selectedShapeId: id }),
  setPhotoEditSlot: (id) => set({ photoEditSlot: id }),
  setCoverColorOverride: (color) => set({ coverColorOverride: color }),
  setTFontSize: (v) => set({ tFontSize: v }),
  setTFontFamily: (v) => set({ tFontFamily: v }),
  setTColor: (v) => set({ tColor: v }),
  setTBold: (v) => set({ tBold: v }),
  setTItalic: (v) => set({ tItalic: v }),
  setFreeSlots: (update) => set(s => ({ freeSlots: applyUpdate(s.freeSlots, update) })),
  setPageBgs: (update) => set(s => ({ pageBgs: applyUpdate(s.pageBgs, update) })),
  setPageShapes: (update) => set(s => ({ pageShapes: applyUpdate(s.pageShapes, update) })),
  setPageFrames: (update) => set(s => ({ pageFrames: applyUpdate(s.pageFrames, update) })),
  setPageStickers: (update) => set(s => ({ pageStickers: applyUpdate(s.pageStickers, update) })),
  setKalkaState: (update) => set(s => ({ kalkaState: applyUpdate(s.kalkaState, update) })),
  setEndpaperState: (update) => set(s => ({ endpaperState: applyUpdate(s.endpaperState, update) })),
  setCtxMenu: (menu) => set({ ctxMenu: menu }),
  setCrossPageDragShapeId: (id) => set({ crossPageDragShapeId: id }),
  setCrossDragPos: (pos) => set({ crossDragPos: pos }),
  setDesignerSaving: (v) => set({ designerSaving: v }),

  // ── Complex actions ──

  pushHistory: () => set(s => ({
    history: [
      ...s.history.slice(-19),
      {
        pages: JSON.parse(JSON.stringify(s.pages)),
        freeSlots: JSON.parse(JSON.stringify(s.freeSlots)),
      },
    ],
  })),

  undo: () => {
    haptic.light();
    const { history } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      pages: prev.pages,
      freeSlots: prev.freeSlots,
      history: history.slice(0, -1),
    });
  },

  initFromConfig: (config) => {
    const coverUpdate = initCoverStateFromConfig(config);
    set(s => ({
      config,
      coverState: { ...s.coverState, ...coverUpdate },
    }));
  },

  restoreDraft: () => {
    try {
      const draft = sessionStorage.getItem('bookEditorDraft');
      if (!draft) return;
      const d = JSON.parse(draft);
      const updates: Partial<BookEditorState> = {};
      if (d.pages?.length) updates.pages = d.pages;
      if (d.freeSlots) updates.freeSlots = d.freeSlots;
      if (d.pageStickers) updates.pageStickers = d.pageStickers;
      if (d.pageShapes) updates.pageShapes = d.pageShapes;
      if (d.pageBgs) updates.pageBgs = d.pageBgs;
      if (d.coverState) updates.coverState = d.coverState;
      set(updates);
    } catch { /* empty */ }
  },

  saveDraft: () => {
    const { pages, freeSlots, pageStickers, pageShapes, pageBgs, coverState } = get();
    if (!pages.length) return;
    try {
      sessionStorage.setItem('bookEditorDraft', JSON.stringify({
        pages, freeSlots, pageStickers, pageShapes, pageBgs, coverState,
      }));
    } catch { /* empty */ }
  },

  addPhotos: (newPhotos) => set(s => ({
    photos: [...s.photos, ...newPhotos],
  })),

  changeLayout: (layout, pageW, cH, forceIdx) => {
    const state = get();
    const def = LAYOUTS.find(l => l.id === layout);
    if (!def) return;

    const targetIdx = forceIdx !== undefined ? forceIdx : state.getActivePageIdx();
    state.pushHistory();

    const page = state.pages[targetIdx];
    const oldPhotos = page ? page.slots.map(s2 => s2.photoId).filter(Boolean) as string[] : [];

    if (def.slots > 0) {
      // Import getSlotDefs dynamically to avoid circular deps
      // For now, create FreeSlots with basic positioning
      const { getSlotDefs } = require('./slot-defs');
      const defs = getSlotDefs(layout, pageW, cH);
      const newFreeSlots: FreeSlot[] = defs.map((d: any, di: number) => ({
        id: 'free-' + Date.now() + '-' + di,
        x: Number(d.s.left) || 0,
        y: Number(d.s.top) || 0,
        w: Number(d.s.width) || pageW,
        h: Number(d.s.height) || cH,
        shape: 'rect' as const,
        photoId: oldPhotos[di] ?? null,
        cropX: 50, cropY: 50, zoom: 1,
      }));

      set(s => ({
        pages: s.pages.map((p, i) =>
          i !== targetIdx ? p : { ...p, layout, slots: [] }
        ),
        freeSlots: { ...s.freeSlots, [targetIdx]: newFreeSlots },
        selectedFreeSlotId: newFreeSlots[0]?.id ?? null,
      }));
    } else {
      set(s => ({
        pages: s.pages.map((p, i) =>
          i !== targetIdx ? p : { ...p, layout, slots: [] }
        ),
      }));
    }
  },

  addSpread: () => {
    get().pushHistory();
    set(s => {
      const newId1 = s.pages.length;
      const newId2 = s.pages.length + 1;
      const newSpreadIdx = Math.ceil(s.pages.length / 2);
      return {
        pages: [
          ...s.pages,
          { id: newId1, label: `Стор. ${newId1}`, layout: 'p-full' as string, slots: makeSlots(1), textBlocks: [] },
          { id: newId2, label: `Стор. ${newId2}`, layout: 'p-full' as string, slots: makeSlots(1), textBlocks: [] },
        ],
        currentIdx: newSpreadIdx,
      };
    });
  },

  removeCurrentSpread: (minPagesLen, minSpreads) => {
    const { currentIdx, pages } = get();
    if (pages.length <= minPagesLen) return;
    if (currentIdx === 0) return;

    get().pushHistory();
    const p1 = (currentIdx - 1) * 2 + 1;
    const p2 = p1 + 1;
    set(s => ({
      pages: s.pages.filter((_, i) => i !== p1 && i !== p2),
      currentIdx: Math.max(1, Math.min(s.currentIdx, Math.ceil((s.pages.length - 3) / 2))),
    }));
  },

  addFreeSlot: (pageW, cH) => {
    get().pushHistory();
    const targetPageIdx = get().getActivePageIdx();
    const id = 'free-' + Date.now();
    const newSlot: FreeSlot = {
      id, x: pageW * 0.2, y: cH * 0.2,
      w: pageW * 0.5, h: cH * 0.4,
      shape: 'rect', photoId: null, cropX: 50, cropY: 50, zoom: 1,
    };
    set(s => ({
      freeSlots: {
        ...s.freeSlots,
        [targetPageIdx]: [...(s.freeSlots[targetPageIdx] || []), newSlot],
      },
      selectedFreeSlotId: id,
    }));
  },

  addShape: (type, pageIdx, pageW, cH) => {
    const id = 'shape-' + Date.now();
    const newShape: Shape = {
      id, type,
      x: pageW * 0.2, y: cH * 0.2,
      w: pageW * 0.35, h: type === 'line' ? 0 : cH * 0.25,
      fill: type === 'line' ? 'transparent' : '#1e2d7d',
      stroke: '#1e2d7d', strokeWidth: type === 'line' ? 4 : 0,
      opacity: 80, rotation: 0,
    };
    set(s => ({
      pageShapes: {
        ...s.pageShapes,
        [pageIdx]: [...(s.pageShapes[pageIdx] || []), newShape],
      },
      selectedShapeId: id,
    }));
  },

  updateTextForPage: (id, changes, pageIdx) => set(s => ({
    pages: s.pages.map((p, i) =>
      i !== pageIdx ? p : {
        ...p,
        textBlocks: p.textBlocks.map(t => t.id === id ? { ...t, ...changes } : t),
      }
    ),
  })),

  deleteTextForPage: (id, pageIdx) => {
    get().pushHistory();
    set(s => ({
      pages: s.pages.map((p, i) =>
        i !== pageIdx ? p : {
          ...p,
          textBlocks: p.textBlocks.filter(t => t.id !== id),
        }
      ),
      selectedTextId: null,
      editingTextId: null,
    }));
  },

  clearSlot: (pi, si) => {
    get().pushHistory();
    set(s => ({
      pages: s.pages.map((p, i) =>
        i !== pi ? p : {
          ...p,
          slots: p.slots.map((sl, j) => j !== si ? sl : { ...sl, photoId: null }),
        }
      ),
    }));
  },

  autoFill: () => {
    get().pushHistory();
    let pi = 0;
    set(s => ({
      pages: s.pages.map(p => ({
        ...p,
        slots: p.slots.map(sl => {
          if (sl.photoId) return sl;
          const ph = s.photos[pi];
          if (!ph) return sl;
          pi++;
          return { ...sl, photoId: ph.id };
        }),
      })),
    }));
  },
}));
