'use client';

import React, { useState, useRef, useEffect, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Undo2, Redo2, Eye, ShoppingCart, Upload, Smartphone,
  Cloud, Image as ImageIcon, Sparkles, Plus, Trash2, MoveUp, MoveDown,
  Type, Settings, Palette, Layout, X, Replace, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PhotoItem {
  id: string;
  src: string;
  name: string;
  usedCount: number;
}

interface TextBlock {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  italic: boolean;
  bold: boolean;
  lineHeight: number;
  letterSpacing: number;
  isPreset: boolean;
}

interface SlotState {
  slotIndex: number;
  photoId: string | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

interface PageState {
  id: string;
  pageIndex: number;
  layoutId: string;
  bgColor: string;
  slots: SlotState[];
  textBlocks: TextBlock[];
}

interface MagazineState {
  pages: PageState[];
  photos: PhotoItem[];
  selectedPageIndex: number;
  selectedSlotIndex: number | null;
  selectedTextBlockId: string | null;
  magazineTitle: string;
  history: PageState[][];
  historyIndex: number;
}

type MagazineAction =
  | { type: 'ADD_PHOTOS'; payload: PhotoItem[] }
  | { type: 'PLACE_PHOTO'; payload: { pageIndex: number; slotIndex: number; photoId: string } }
  | { type: 'REMOVE_PHOTO_FROM_SLOT'; payload: { pageIndex: number; slotIndex: number } }
  | { type: 'UPDATE_SLOT_TRANSFORM'; payload: { pageIndex: number; slotIndex: number; zoom?: number; offsetX?: number; offsetY?: number } }
  | { type: 'CHANGE_PAGE_LAYOUT'; payload: { pageIndex: number; layoutId: string } }
  | { type: 'ADD_PAGE'; payload: { afterIndex: number } }
  | { type: 'REMOVE_PAGE'; payload: { pageIndex: number } }
  | { type: 'MOVE_PAGE'; payload: { pageIndex: number; direction: 'up' | 'down' } }
  | { type: 'DUPLICATE_PAGE'; payload: { pageIndex: number } }
  | { type: 'SET_PAGE_BG_COLOR'; payload: { pageIndex: number; color: string } }
  | { type: 'ADD_TEXT_BLOCK'; payload: { pageIndex: number; textBlock: Partial<TextBlock> } }
  | { type: 'UPDATE_TEXT_BLOCK'; payload: { pageIndex: number; textBlockId: string; updates: Partial<TextBlock> } }
  | { type: 'REMOVE_TEXT_BLOCK'; payload: { pageIndex: number; textBlockId: string } }
  | { type: 'SELECT_PAGE'; payload: number }
  | { type: 'SELECT_SLOT'; payload: { slotIndex: number } }
  | { type: 'SELECT_TEXT_BLOCK'; payload: { textBlockId: string } }
  | { type: 'DESELECT_ALL' }
  | { type: 'SET_MAGAZINE_TITLE'; payload: string }
  | { type: 'AUTO_FILL_ALL' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_PAGE'; payload: { pageIndex: number } };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUTS DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface LayoutDef {
  id: string;
  name: string;
  category: 'cover' | 'content';
  slots: Array<{ x: number; y: number; width: number; height: number }>;
  presetTexts: Array<{ content: string; x: number; y: number; width: number; fontSize: number; fontFamily: string; color: string; align: 'left' | 'center' | 'right'; italic: boolean; bold: boolean; lineHeight: number; letterSpacing: number }>;
  bgColor: string;
}

const MAGAZINE_LAYOUTS: LayoutDef[] = [
  {
    id: 'cover-full-title',
    name: 'Full Title Cover',
    category: 'cover',
    slots: [{ x: 0, y: 0, width: 100, height: 100 }],
    presetTexts: [
      { content: 'Magazine Title', x: 10, y: 40, width: 80, fontSize: 48, fontFamily: 'Playfair Display', color: '#ffffff', align: 'center', italic: false, bold: true, lineHeight: 1.2, letterSpacing: 2 },
      { content: 'Subtitle or tagline', x: 10, y: 55, width: 80, fontSize: 18, fontFamily: 'Lato', color: '#ffffff', align: 'center', italic: true, bold: false, lineHeight: 1.5, letterSpacing: 1 },
    ],
    bgColor: '#2c3e50',
  },
  {
    id: 'cover-dark-overlay',
    name: 'Dark Overlay Cover',
    category: 'cover',
    slots: [{ x: 0, y: 0, width: 100, height: 100 }],
    presetTexts: [
      { content: 'Magazine Title', x: 10, y: 70, width: 80, fontSize: 44, fontFamily: 'Playfair Display', color: '#ffffff', align: 'center', italic: false, bold: true, lineHeight: 1.2, letterSpacing: 2 },
      { content: 'Issue #1 | 2024', x: 10, y: 82, width: 80, fontSize: 14, fontFamily: 'Lato', color: '#e0e0e0', align: 'center', italic: false, bold: false, lineHeight: 1.5, letterSpacing: 1 },
    ],
    bgColor: '#000000',
  },
  {
    id: 'cover-split',
    name: 'Split Cover',
    category: 'cover',
    slots: [{ x: 0, y: 0, width: 50, height: 100 }],
    presetTexts: [
      { content: 'Magazine', x: 55, y: 35, width: 40, fontSize: 40, fontFamily: 'Playfair Display', color: '#2c3e50', align: 'left', italic: false, bold: true, lineHeight: 1.2, letterSpacing: 2 },
      { content: 'Stories that inspire', x: 55, y: 50, width: 40, fontSize: 16, fontFamily: 'Lato', color: '#555555', align: 'left', italic: true, bold: false, lineHeight: 1.6, letterSpacing: 0.5 },
    ],
    bgColor: '#f4f4f4',
  },
  {
    id: 'layout-full-bleed',
    name: 'Full Bleed Photo',
    category: 'content',
    slots: [{ x: 0, y: 0, width: 100, height: 100 }],
    presetTexts: [],
    bgColor: '#ffffff',
  },
  {
    id: 'layout-centered',
    name: 'Centered Photo',
    category: 'content',
    slots: [{ x: 10, y: 10, width: 80, height: 80 }],
    presetTexts: [],
    bgColor: '#ffffff',
  },
  {
    id: 'layout-header-photo',
    name: 'Header Photo',
    category: 'content',
    slots: [{ x: 5, y: 5, width: 90, height: 50 }],
    presetTexts: [
      { content: 'Section Title', x: 5, y: 60, width: 90, fontSize: 32, fontFamily: 'Playfair Display', color: '#2c3e50', align: 'left', italic: false, bold: true, lineHeight: 1.3, letterSpacing: 1 },
      { content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.', x: 5, y: 70, width: 90, fontSize: 14, fontFamily: 'Lato', color: '#555555', align: 'left', italic: false, bold: false, lineHeight: 1.7, letterSpacing: 0.3 },
    ],
    bgColor: '#ffffff',
  },
  {
    id: 'layout-header-collage3',
    name: 'Header 3-Photo Collage',
    category: 'content',
    slots: [
      { x: 5, y: 5, width: 40, height: 40 },
      { x: 50, y: 5, width: 22, height: 40 },
      { x: 77, y: 5, width: 18, height: 40 },
    ],
    presetTexts: [
      { content: 'Article Title', x: 5, y: 50, width: 90, fontSize: 28, fontFamily: 'Playfair Display', color: '#2c3e50', align: 'left', italic: false, bold: true, lineHeight: 1.3, letterSpacing: 1 },
      { content: 'Write your story here. Replace this text with your own content.', x: 5, y: 60, width: 90, fontSize: 13, fontFamily: 'Lato', color: '#555555', align: 'left', italic: false, bold: false, lineHeight: 1.7, letterSpacing: 0.3 },
    ],
    bgColor: '#ffffff',
  },
  {
    id: 'layout-header-collage4',
    name: 'Header 4-Photo Grid',
    category: 'content',
    slots: [
      { x: 5, y: 5, width: 21, height: 30 },
      { x: 29, y: 5, width: 21, height: 30 },
      { x: 53, y: 5, width: 21, height: 30 },
      { x: 77, y: 5, width: 18, height: 30 },
    ],
    presetTexts: [
      { content: 'Featured Collection', x: 5, y: 40, width: 90, fontSize: 26, fontFamily: 'Playfair Display', color: '#2c3e50', align: 'left', italic: false, bold: true, lineHeight: 1.3, letterSpacing: 1 },
      { content: 'A curated selection of moments that tell a story.', x: 5, y: 50, width: 90, fontSize: 13, fontFamily: 'Lato', color: '#555555', align: 'left', italic: false, bold: false, lineHeight: 1.7, letterSpacing: 0.3 },
    ],
    bgColor: '#ffffff',
  },
  {
    id: 'layout-split-photo-quote',
    name: 'Split Photo + Quote',
    category: 'content',
    slots: [{ x: 0, y: 0, width: 55, height: 100 }],
    presetTexts: [
      { content: '"Inspiring quote here"', x: 60, y: 40, width: 35, fontSize: 24, fontFamily: 'Playfair Display', color: '#2c3e50', align: 'center', italic: true, bold: false, lineHeight: 1.4, letterSpacing: 0.5 },
      { content: '— Author Name', x: 60, y: 55, width: 35, fontSize: 14, fontFamily: 'Lato', color: '#777777', align: 'center', italic: false, bold: false, lineHeight: 1.5, letterSpacing: 0.5 },
    ],
    bgColor: '#f9f9f9',
  },
  {
    id: 'layout-two-photos-v',
    name: 'Two Photos (Vertical)',
    category: 'content',
    slots: [
      { x: 5, y: 5, width: 90, height: 45 },
      { x: 5, y: 52, width: 90, height: 43 },
    ],
    presetTexts: [],
    bgColor: '#ffffff',
  },
  {
    id: 'layout-two-photos-h',
    name: 'Two Photos (Horizontal)',
    category: 'content',
    slots: [
      { x: 5, y: 5, width: 44, height: 90 },
      { x: 51, y: 5, width: 44, height: 90 },
    ],
    presetTexts: [],
    bgColor: '#ffffff',
  },
  {
    id: 'layout-article',
    name: 'Article Layout',
    category: 'content',
    slots: [{ x: 50, y: 10, width: 45, height: 50 }],
    presetTexts: [
      { content: 'Article Headline', x: 5, y: 10, width: 40, fontSize: 30, fontFamily: 'Playfair Display', color: '#2c3e50', align: 'left', italic: false, bold: true, lineHeight: 1.3, letterSpacing: 1 },
      { content: 'Your article text goes here. Tell your story in your own words. This is where you can share details, memories, and narratives that bring your photos to life.', x: 5, y: 25, width: 40, fontSize: 13, fontFamily: 'Lato', color: '#555555', align: 'left', italic: false, bold: false, lineHeight: 1.8, letterSpacing: 0.3 },
      { content: 'Caption or additional details', x: 50, y: 62, width: 45, fontSize: 11, fontFamily: 'Lato', color: '#888888', align: 'left', italic: true, bold: false, lineHeight: 1.6, letterSpacing: 0.2 },
    ],
    bgColor: '#ffffff',
  },
  {
    id: 'layout-quote',
    name: 'Quote Layout',
    category: 'content',
    slots: [],
    presetTexts: [
      { content: '"The best memories are made together"', x: 10, y: 35, width: 80, fontSize: 36, fontFamily: 'Playfair Display', color: '#2c3e50', align: 'center', italic: true, bold: false, lineHeight: 1.4, letterSpacing: 1 },
      { content: '— Anonymous', x: 10, y: 55, width: 80, fontSize: 16, fontFamily: 'Lato', color: '#777777', align: 'center', italic: false, bold: false, lineHeight: 1.5, letterSpacing: 0.5 },
    ],
    bgColor: '#fafafa',
  },
  {
    id: 'layout-dark-poem',
    name: 'Dark Poem Layout',
    category: 'content',
    slots: [],
    presetTexts: [
      { content: 'Verse Title', x: 10, y: 30, width: 80, fontSize: 28, fontFamily: 'Playfair Display', color: '#ffffff', align: 'center', italic: false, bold: true, lineHeight: 1.3, letterSpacing: 1.5 },
      { content: 'Write your poem or verse here.\nMultiple lines create rhythm.\nEach word tells a story.', x: 15, y: 45, width: 70, fontSize: 16, fontFamily: 'Lato', color: '#e0e0e0', align: 'center', italic: true, bold: false, lineHeight: 2, letterSpacing: 0.8 },
    ],
    bgColor: '#1a1a1a',
  },
  {
    id: 'layout-blank',
    name: 'Blank Canvas',
    category: 'content',
    slots: [],
    presetTexts: [],
    bgColor: '#ffffff',
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COLOR_SWATCHES = [
  '#ffffff', '#f8f9fa', '#f4f4f4', '#e9ecef', '#dee2e6',
  '#000000', '#1a1a1a', '#2c3e50', '#34495e', '#555555',
  '#e74c3c', '#c0392b', '#e67e22', '#d35400', '#f39c12',
  '#f1c40f', '#16a085', '#1abc9c', '#27ae60', '#2ecc71',
  '#3498db', '#2980b9', '#9b59b6', '#8e44ad', '#ecf0f1',
];

const FONT_FAMILIES = [
  'Playfair Display',
  'Lato',
  'Merriweather',
  'Open Sans',
  'Roboto',
  'Montserrat',
  'Georgia',
  'Arial',
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HISTORY HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function pushHistory(state: MagazineState): MagazineState {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(state.pages)));
  return {
    ...state,
    history: newHistory.slice(-50),
    historyIndex: Math.min(newHistory.length - 1, 49),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REDUCER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function magazineReducer(state: MagazineState, action: MagazineAction): MagazineState {
  switch (action.type) {
    case 'ADD_PHOTOS': {
      const newPhotos = action.payload.map((p) => {
        const existing = state.photos.find((ph) => ph.id === p.id);
        return existing || p;
      });
      const merged = [...state.photos];
      newPhotos.forEach((np) => {
        if (!merged.find((m) => m.id === np.id)) {
          merged.push(np);
        }
      });
      return { ...state, photos: merged };
    }

    case 'PLACE_PHOTO': {
      const { pageIndex, slotIndex, photoId } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;
      const slot = page.slots[slotIndex];
      if (!slot) return state;

      const oldPhotoId = slot.photoId;
      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        const newSlots = pg.slots.map((s, si) => {
          if (si !== slotIndex) return s;
          return { ...s, photoId, zoom: 1, offsetX: 0, offsetY: 0 };
        });
        return { ...pg, slots: newSlots };
      });

      const newPhotos = state.photos.map((ph) => {
        if (ph.id === photoId) return { ...ph, usedCount: ph.usedCount + 1 };
        if (oldPhotoId && ph.id === oldPhotoId) return { ...ph, usedCount: Math.max(0, ph.usedCount - 1) };
        return ph;
      });

      return pushHistory({ ...state, pages: newPages, photos: newPhotos });
    }

    case 'REMOVE_PHOTO_FROM_SLOT': {
      const { pageIndex, slotIndex } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;
      const slot = page.slots[slotIndex];
      if (!slot || !slot.photoId) return state;

      const photoId = slot.photoId;
      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        const newSlots = pg.slots.map((s, si) => {
          if (si !== slotIndex) return s;
          return { ...s, photoId: null, zoom: 1, offsetX: 0, offsetY: 0 };
        });
        return { ...pg, slots: newSlots };
      });

      const newPhotos = state.photos.map((ph) => {
        if (ph.id === photoId) return { ...ph, usedCount: Math.max(0, ph.usedCount - 1) };
        return ph;
      });

      return pushHistory({ ...state, pages: newPages, photos: newPhotos });
    }

    case 'UPDATE_SLOT_TRANSFORM': {
      const { pageIndex, slotIndex, zoom, offsetX, offsetY } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;
      const slot = page.slots[slotIndex];
      if (!slot) return state;

      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        const newSlots = pg.slots.map((s, si) => {
          if (si !== slotIndex) return s;
          return {
            ...s,
            zoom: zoom !== undefined ? zoom : s.zoom,
            offsetX: offsetX !== undefined ? offsetX : s.offsetX,
            offsetY: offsetY !== undefined ? offsetY : s.offsetY,
          };
        });
        return { ...pg, slots: newSlots };
      });

      return { ...state, pages: newPages };
    }

    case 'CHANGE_PAGE_LAYOUT': {
      const { pageIndex, layoutId } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;

      const layout = MAGAZINE_LAYOUTS.find((l) => l.id === layoutId);
      if (!layout) return state;

      const existingPhotos = page.slots.map((s) => s.photoId).filter(Boolean);
      const newSlots: SlotState[] = layout.slots.map((slotDef, idx) => {
        const photoId = existingPhotos[idx] || null;
        return {
          slotIndex: idx,
          photoId,
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
        };
      });

      const presetTexts: TextBlock[] = layout.presetTexts.map((pt, idx) => ({
        id: `preset-${pageIndex}-${idx}-${Date.now()}`,
        ...pt,
        isPreset: true,
      }));

      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        return {
          ...pg,
          layoutId,
          slots: newSlots,
          bgColor: layout.bgColor,
          textBlocks: presetTexts,
        };
      });

      return pushHistory({ ...state, pages: newPages });
    }

    case 'ADD_PAGE': {
      const { afterIndex } = action.payload;
      const newPage: PageState = {
        id: `page-${Date.now()}`,
        pageIndex: afterIndex + 1,
        layoutId: 'layout-blank',
        bgColor: '#ffffff',
        slots: [],
        textBlocks: [],
      };
      const newPages = [
        ...state.pages.slice(0, afterIndex + 1),
        newPage,
        ...state.pages.slice(afterIndex + 1),
      ].map((pg, idx) => ({ ...pg, pageIndex: idx }));

      return pushHistory({ ...state, pages: newPages, selectedPageIndex: afterIndex + 1 });
    }

    case 'REMOVE_PAGE': {
      const { pageIndex } = action.payload;
      if (state.pages.length <= 1) return state;

      const page = state.pages[pageIndex];
      const removedPhotos = page.slots.map((s) => s.photoId).filter(Boolean) as string[];

      const newPhotos = state.photos.map((ph) => {
        const count = removedPhotos.filter((id) => id === ph.id).length;
        return { ...ph, usedCount: Math.max(0, ph.usedCount - count) };
      });

      const newPages = state.pages.filter((_, i) => i !== pageIndex).map((pg, idx) => ({ ...pg, pageIndex: idx }));
      const newSelectedPageIndex = Math.min(state.selectedPageIndex, newPages.length - 1);

      return pushHistory({ ...state, pages: newPages, photos: newPhotos, selectedPageIndex: newSelectedPageIndex });
    }

    case 'MOVE_PAGE': {
      const { pageIndex, direction } = action.payload;
      const newIndex = direction === 'up' ? pageIndex - 1 : pageIndex + 1;
      if (newIndex < 0 || newIndex >= state.pages.length) return state;

      const newPages = [...state.pages];
      [newPages[pageIndex], newPages[newIndex]] = [newPages[newIndex], newPages[pageIndex]];
      const reindexed = newPages.map((pg, idx) => ({ ...pg, pageIndex: idx }));

      return pushHistory({ ...state, pages: reindexed, selectedPageIndex: newIndex });
    }

    case 'DUPLICATE_PAGE': {
      const { pageIndex } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;

      const duplicated: PageState = {
        ...JSON.parse(JSON.stringify(page)),
        id: `page-${Date.now()}`,
        pageIndex: pageIndex + 1,
      };

      const newPages = [
        ...state.pages.slice(0, pageIndex + 1),
        duplicated,
        ...state.pages.slice(pageIndex + 1),
      ].map((pg, idx) => ({ ...pg, pageIndex: idx }));

      const photosInDuplicate = duplicated.slots.map((s) => s.photoId).filter(Boolean) as string[];
      const newPhotos = state.photos.map((ph) => {
        const count = photosInDuplicate.filter((id) => id === ph.id).length;
        return { ...ph, usedCount: ph.usedCount + count };
      });

      return pushHistory({ ...state, pages: newPages, photos: newPhotos, selectedPageIndex: pageIndex + 1 });
    }

    case 'SET_PAGE_BG_COLOR': {
      const { pageIndex, color } = action.payload;
      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        return { ...pg, bgColor: color };
      });
      return pushHistory({ ...state, pages: newPages });
    }

    case 'ADD_TEXT_BLOCK': {
      const { pageIndex, textBlock } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;

      const newText: TextBlock = {
        id: `text-${Date.now()}`,
        content: textBlock.content || 'New Text',
        x: textBlock.x || 20,
        y: textBlock.y || 20,
        width: textBlock.width || 60,
        fontSize: textBlock.fontSize || 16,
        fontFamily: textBlock.fontFamily || 'Lato',
        color: textBlock.color || '#000000',
        align: textBlock.align || 'left',
        italic: textBlock.italic || false,
        bold: textBlock.bold || false,
        lineHeight: textBlock.lineHeight || 1.5,
        letterSpacing: textBlock.letterSpacing || 0,
        isPreset: false,
      };

      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        return { ...pg, textBlocks: [...pg.textBlocks, newText] };
      });

      return pushHistory({ ...state, pages: newPages, selectedTextBlockId: newText.id });
    }

    case 'UPDATE_TEXT_BLOCK': {
      const { pageIndex, textBlockId, updates } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;

      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        const newTextBlocks = pg.textBlocks.map((tb) => {
          if (tb.id !== textBlockId) return tb;
          return { ...tb, ...updates };
        });
        return { ...pg, textBlocks: newTextBlocks };
      });

      return { ...state, pages: newPages };
    }

    case 'REMOVE_TEXT_BLOCK': {
      const { pageIndex, textBlockId } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;

      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        return { ...pg, textBlocks: pg.textBlocks.filter((tb) => tb.id !== textBlockId) };
      });

      return pushHistory({ ...state, pages: newPages, selectedTextBlockId: null });
    }

    case 'SELECT_PAGE': {
      return { ...state, selectedPageIndex: action.payload, selectedSlotIndex: null, selectedTextBlockId: null };
    }

    case 'SELECT_SLOT': {
      return { ...state, selectedSlotIndex: action.payload.slotIndex, selectedTextBlockId: null };
    }

    case 'SELECT_TEXT_BLOCK': {
      return { ...state, selectedTextBlockId: action.payload.textBlockId, selectedSlotIndex: null };
    }

    case 'DESELECT_ALL': {
      return { ...state, selectedSlotIndex: null, selectedTextBlockId: null };
    }

    case 'SET_MAGAZINE_TITLE': {
      return { ...state, magazineTitle: action.payload };
    }

    case 'AUTO_FILL_ALL': {
      const unusedPhotos = state.photos.filter((p) => p.usedCount === 0);
      if (unusedPhotos.length === 0) return state;

      let photoIdx = 0;
      const newPages = state.pages.map((page) => {
        const newSlots = page.slots.map((slot) => {
          if (slot.photoId || photoIdx >= unusedPhotos.length) return slot;
          const photo = unusedPhotos[photoIdx];
          photoIdx++;
          return { ...slot, photoId: photo.id, zoom: 1, offsetX: 0, offsetY: 0 };
        });
        return { ...page, slots: newSlots };
      });

      const usedPhotoIds = newPages.flatMap((p) => p.slots.map((s) => s.photoId).filter(Boolean));
      const newPhotos = state.photos.map((ph) => {
        const count = usedPhotoIds.filter((id) => id === ph.id).length;
        return { ...ph, usedCount: count };
      });

      return pushHistory({ ...state, pages: newPages, photos: newPhotos });
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const restoredPages = JSON.parse(JSON.stringify(state.history[newIndex]));

      const usedPhotoIds = restoredPages.flatMap((p: PageState) => p.slots.map((s: SlotState) => s.photoId).filter(Boolean));
      const newPhotos = state.photos.map((ph) => {
        const count = usedPhotoIds.filter((id: string) => id === ph.id).length;
        return { ...ph, usedCount: count };
      });

      return { ...state, pages: restoredPages, photos: newPhotos, historyIndex: newIndex };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const restoredPages = JSON.parse(JSON.stringify(state.history[newIndex]));

      const usedPhotoIds = restoredPages.flatMap((p: PageState) => p.slots.map((s: SlotState) => s.photoId).filter(Boolean));
      const newPhotos = state.photos.map((ph) => {
        const count = usedPhotoIds.filter((id: string) => id === ph.id).length;
        return { ...ph, usedCount: count };
      });

      return { ...state, pages: restoredPages, photos: newPhotos, historyIndex: newIndex };
    }

    case 'CLEAR_PAGE': {
      const { pageIndex } = action.payload;
      const page = state.pages[pageIndex];
      if (!page) return state;

      const removedPhotos = page.slots.map((s) => s.photoId).filter(Boolean) as string[];
      const newPhotos = state.photos.map((ph) => {
        const count = removedPhotos.filter((id) => id === ph.id).length;
        return { ...ph, usedCount: Math.max(0, ph.usedCount - count) };
      });

      const newPages = state.pages.map((pg, i) => {
        if (i !== pageIndex) return pg;
        const clearedSlots = pg.slots.map((s) => ({ ...s, photoId: null, zoom: 1, offsetX: 0, offsetY: 0 }));
        return { ...pg, slots: clearedSlots, textBlocks: [], bgColor: '#ffffff' };
      });

      return pushHistory({ ...state, pages: newPages, photos: newPhotos });
    }

    default:
      return state;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function MagazineConstructorPage() {
  const router = useRouter();

  const initialPages: PageState[] = [
    {
      id: 'cover-page',
      pageIndex: 0,
      layoutId: 'cover-full-title',
      bgColor: '#2c3e50',
      slots: [{ slotIndex: 0, photoId: null, zoom: 1, offsetX: 0, offsetY: 0 }],
      textBlocks: MAGAZINE_LAYOUTS.find((l) => l.id === 'cover-full-title')!.presetTexts.map((pt, idx) => ({
        id: `preset-0-${idx}`,
        ...pt,
        isPreset: true,
      })),
    },
    {
      id: 'page-1',
      pageIndex: 1,
      layoutId: 'layout-blank',
      bgColor: '#ffffff',
      slots: [],
      textBlocks: [],
    },
  ];

  const initialState: MagazineState = {
    pages: initialPages,
    photos: [],
    selectedPageIndex: 0,
    selectedSlotIndex: null,
    selectedTextBlockId: null,
    magazineTitle: 'My Magazine',
    history: [JSON.parse(JSON.stringify(initialPages))],
    historyIndex: 0,
  };

  const [state, dispatch] = useReducer(magazineReducer, initialState);
  const [leftTab, setLeftTab] = useState<'photos' | 'layouts' | 'backgrounds' | 'text' | 'options'>('photos');
  const [showPreview, setShowPreview] = useState(false);
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const currentPage = state.pages[state.selectedPageIndex];
  const currentLayout = MAGAZINE_LAYOUTS.find((l) => l.id === currentPage.layoutId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: PhotoItem[] = files.map((file) => ({
      id: `photo-${Date.now()}-${Math.random()}`,
      src: URL.createObjectURL(file),
      name: file.name,
      usedCount: 0,
    }));
    dispatch({ type: 'ADD_PHOTOS', payload: newPhotos });
  };

  // Handle photo drag start
  const handlePhotoDragStart = (photoId: string) => {
    setDraggingPhotoId(photoId);
  };

  // Handle photo drop on slot
  const handlePhotoDropOnSlot = (slotIndex: number) => {
    if (!draggingPhotoId) return;
    dispatch({
      type: 'PLACE_PHOTO',
      payload: { pageIndex: state.selectedPageIndex, slotIndex, photoId: draggingPhotoId },
    });
    setDraggingPhotoId(null);
  };

  // Handle text double-click
  const handleTextDoubleClick = (textId: string) => {
    setEditingTextId(textId);
  };

  // Handle text blur
  const handleTextBlur = (textId: string, content: string) => {
    dispatch({
      type: 'UPDATE_TEXT_BLOCK',
      payload: { pageIndex: state.selectedPageIndex, textBlockId: textId, updates: { content } },
    });
    setEditingTextId(null);
  };

  // Handle checkout
  const handleCheckout = () => {
    const orderData = {
      productType: 'magazine',
      pages: state.pages,
      photos: state.photos,
      title: state.magazineTitle,
      pageCount: state.pages.length,
      basePrice: 2000,
      totalPrice: 2000 + (state.pages.length - 2) * 200,
    };
    localStorage.setItem('magazineOrder', JSON.stringify(orderData));
    router.push('/checkout');
  };

  const selectedSlot = currentPage.slots[state.selectedSlotIndex ?? -1];
  const selectedText = currentPage.textBlocks.find((tb) => tb.id === state.selectedTextBlockId);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/catalog/magazine')}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <input
            type="text"
            value={state.magazineTitle}
            onChange={(e) => dispatch({ type: 'SET_MAGAZINE_TITLE', payload: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={state.historyIndex <= 0}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Cmd+Z)"
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={state.historyIndex >= state.history.length - 1}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 size={20} />
          </button>
          <div className="h-6 w-px bg-gray-300 mx-2" />
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            <Eye size={18} />
            Preview
          </button>
          <button
            onClick={handleCheckout}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <ShoppingCart size={18} />
            Order Now
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Icon Strip */}
        <div className="w-16 bg-gray-800 flex flex-col items-center py-4 gap-2">
          <button
            onClick={() => setLeftTab('photos')}
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              leftTab === 'photos' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
            title="Photos"
          >
            <ImageIcon size={24} />
          </button>
          <button
            onClick={() => setLeftTab('layouts')}
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              leftTab === 'layouts' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
            title="Layouts"
          >
            <Layout size={24} />
          </button>
          <button
            onClick={() => setLeftTab('backgrounds')}
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              leftTab === 'backgrounds' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
            title="Backgrounds"
          >
            <Palette size={24} />
          </button>
          <button
            onClick={() => setLeftTab('text')}
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              leftTab === 'text' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
            title="Text"
          >
            <Type size={24} />
          </button>
          <button
            onClick={() => setLeftTab('options')}
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              leftTab === 'options' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
            title="Options"
          >
            <Settings size={24} />
          </button>
        </div>

        {/* Left Panel */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold capitalize">{leftTab}</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {leftTab === 'photos' && (
              <div className="space-y-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 flex items-center justify-center gap-2 text-gray-600"
                >
                  <Upload size={20} />
                  Upload Photos
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {state.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {state.photos.map((photo) => (
                      <div
                        key={photo.id}
                        draggable
                        onDragStart={() => handlePhotoDragStart(photo.id)}
                        className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group"
                      >
                        <img src={photo.src} alt={photo.name} className="w-full h-full object-cover" />
                        {photo.usedCount > 0 && (
                          <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                            {photo.usedCount}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all" />
                      </div>
                    ))}
                  </div>
                )}

                {state.photos.length > 0 && (
                  <button
                    onClick={() => dispatch({ type: 'AUTO_FILL_ALL' })}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <Sparkles size={18} />
                    Auto-fill All Pages
                  </button>
                )}
              </div>
            )}

            {leftTab === 'layouts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Cover Layouts</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {MAGAZINE_LAYOUTS.filter((l) => l.category === 'cover').map((layout) => (
                      <button
                        key={layout.id}
                        onClick={() =>
                          dispatch({
                            type: 'CHANGE_PAGE_LAYOUT',
                            payload: { pageIndex: state.selectedPageIndex, layoutId: layout.id },
                          })
                        }
                        className={`aspect-[3/4] border-2 rounded-lg overflow-hidden hover:border-blue-500 ${
                          currentPage.layoutId === layout.id ? 'border-blue-600' : 'border-gray-200'
                        }`}
                      >
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-600 p-2 text-center">
                          {layout.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Content Layouts</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {MAGAZINE_LAYOUTS.filter((l) => l.category === 'content').map((layout) => (
                      <button
                        key={layout.id}
                        onClick={() =>
                          dispatch({
                            type: 'CHANGE_PAGE_LAYOUT',
                            payload: { pageIndex: state.selectedPageIndex, layoutId: layout.id },
                          })
                        }
                        className={`aspect-[3/4] border-2 rounded-lg overflow-hidden hover:border-blue-500 ${
                          currentPage.layoutId === layout.id ? 'border-blue-600' : 'border-gray-200'
                        }`}
                      >
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-600 p-2 text-center">
                          {layout.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {leftTab === 'backgrounds' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Page Background</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_SWATCHES.map((color) => (
                      <button
                        key={color}
                        onClick={() =>
                          dispatch({
                            type: 'SET_PAGE_BG_COLOR',
                            payload: { pageIndex: state.selectedPageIndex, color },
                          })
                        }
                        className={`aspect-square rounded-lg border-2 ${
                          currentPage.bgColor === color ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {leftTab === 'text' && (
              <div className="space-y-4">
                <button
                  onClick={() =>
                    dispatch({
                      type: 'ADD_TEXT_BLOCK',
                      payload: { pageIndex: state.selectedPageIndex, textBlock: {} },
                    })
                  }
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add Text Block
                </button>

                {currentPage.textBlocks.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700">Text Blocks on Page</h3>
                    {currentPage.textBlocks.map((tb) => (
                      <div
                        key={tb.id}
                        onClick={() => dispatch({ type: 'SELECT_TEXT_BLOCK', payload: { textBlockId: tb.id } })}
                        className={`p-3 border rounded-lg cursor-pointer ${
                          state.selectedTextBlockId === tb.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-sm font-medium truncate">{tb.content}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {tb.fontSize}px • {tb.fontFamily}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {leftTab === 'options' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Magazine Info</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Pages: {state.pages.length}</div>
                    <div>Photos: {state.photos.length}</div>
                    <div>Used Photos: {state.photos.filter((p) => p.usedCount > 0).length}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Page Actions</h3>
                  <button
                    onClick={() => dispatch({ type: 'CLEAR_PAGE', payload: { pageIndex: state.selectedPageIndex } })}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Clear Current Page
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col bg-gray-100">
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-4xl mx-auto">
              <div
                ref={canvasRef}
                className="relative bg-white shadow-2xl mx-auto"
                style={{
                  width: '600px',
                  height: '800px',
                  backgroundColor: currentPage.bgColor,
                }}
                onClick={() => dispatch({ type: 'DESELECT_ALL' })}
              >
                {/* Slots */}
                {currentLayout?.slots.map((slotDef, idx) => {
                  const slotState = currentPage.slots[idx];
                  const photo = slotState?.photoId ? state.photos.find((p) => p.id === slotState.photoId) : null;

                  return (
                    <div
                      key={idx}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePhotoDropOnSlot(idx);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'SELECT_SLOT', payload: { slotIndex: idx } });
                      }}
                      className={`absolute border-2 overflow-hidden ${
                        state.selectedSlotIndex === idx
                          ? 'border-blue-600 ring-2 ring-blue-200'
                          : 'border-gray-300 border-dashed'
                      }`}
                      style={{
                        left: `${slotDef.x}%`,
                        top: `${slotDef.y}%`,
                        width: `${slotDef.width}%`,
                        height: `${slotDef.height}%`,
                      }}
                    >
                      {photo ? (
                        <div className="w-full h-full relative">
                          <img
                            src={photo.src}
                            alt={photo.name}
                            className="absolute"
                            style={{
                              width: `${slotState.zoom * 100}%`,
                              height: `${slotState.zoom * 100}%`,
                              left: `${slotState.offsetX}%`,
                              top: `${slotState.offsetY}%`,
                              objectFit: 'cover',
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
                          <ImageIcon size={32} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Text Blocks */}
                {currentPage.textBlocks.map((tb) => (
                  <div
                    key={tb.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'SELECT_TEXT_BLOCK', payload: { textBlockId: tb.id } });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleTextDoubleClick(tb.id);
                    }}
                    className={`absolute cursor-pointer ${
                      state.selectedTextBlockId === tb.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    style={{
                      left: `${tb.x}%`,
                      top: `${tb.y}%`,
                      width: `${tb.width}%`,
                      fontSize: `${tb.fontSize}px`,
                      fontFamily: tb.fontFamily,
                      color: tb.color,
                      textAlign: tb.align,
                      fontStyle: tb.italic ? 'italic' : 'normal',
                      fontWeight: tb.bold ? 'bold' : 'normal',
                      lineHeight: tb.lineHeight,
                      letterSpacing: `${tb.letterSpacing}px`,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {editingTextId === tb.id ? (
                      <textarea
                        autoFocus
                        defaultValue={tb.content}
                        onBlur={(e) => handleTextBlur(tb.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingTextId(null);
                          }
                        }}
                        className="w-full bg-transparent border-none outline-none resize-none"
                        style={{
                          fontSize: `${tb.fontSize}px`,
                          fontFamily: tb.fontFamily,
                          color: tb.color,
                          textAlign: tb.align,
                          fontStyle: tb.italic ? 'italic' : 'normal',
                          fontWeight: tb.bold ? 'bold' : 'normal',
                          lineHeight: tb.lineHeight,
                          letterSpacing: `${tb.letterSpacing}px`,
                        }}
                      />
                    ) : (
                      <div>{tb.content}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Filmstrip */}
          <div className="h-32 bg-white border-t border-gray-200 flex items-center gap-2 px-4 overflow-x-auto">
            {state.pages.map((page, idx) => (
              <div key={page.id} className="flex-shrink-0 flex flex-col items-center gap-2">
                <div
                  onClick={() => dispatch({ type: 'SELECT_PAGE', payload: idx })}
                  className={`w-20 h-24 border-2 rounded cursor-pointer overflow-hidden ${
                    state.selectedPageIndex === idx ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: page.bgColor }}
                >
                  <div className="w-full h-full text-xs text-gray-500 flex items-center justify-center">
                    {idx + 1}
                  </div>
                </div>
                <div className="flex gap-1">
                  {idx > 0 && (
                    <button
                      onClick={() => dispatch({ type: 'MOVE_PAGE', payload: { pageIndex: idx, direction: 'up' } })}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Move Up"
                    >
                      <MoveUp size={14} />
                    </button>
                  )}
                  {idx < state.pages.length - 1 && (
                    <button
                      onClick={() => dispatch({ type: 'MOVE_PAGE', payload: { pageIndex: idx, direction: 'down' } })}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Move Down"
                    >
                      <MoveDown size={14} />
                    </button>
                  )}
                  {state.pages.length > 1 && (
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_PAGE', payload: { pageIndex: idx } })}
                      className="p-1 hover:bg-red-200 text-red-600 rounded"
                      title="Delete Page"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() => dispatch({ type: 'ADD_PAGE', payload: { afterIndex: state.pages.length - 1 } })}
              className="flex-shrink-0 w-20 h-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Properties</h2>
          </div>
          <div className="flex-1 p-4 space-y-6">
            {state.selectedSlotIndex !== null && selectedSlot && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Photo Slot</h3>
                {selectedSlot.photoId && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Zoom</label>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={selectedSlot.zoom}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_SLOT_TRANSFORM',
                            payload: {
                              pageIndex: state.selectedPageIndex,
                              slotIndex: state.selectedSlotIndex!,
                              zoom: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 mt-1">{selectedSlot.zoom.toFixed(1)}x</div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Offset X</label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={selectedSlot.offsetX}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_SLOT_TRANSFORM',
                            payload: {
                              pageIndex: state.selectedPageIndex,
                              slotIndex: state.selectedSlotIndex!,
                              offsetX: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 mt-1">{selectedSlot.offsetX}%</div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Offset Y</label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={selectedSlot.offsetY}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_SLOT_TRANSFORM',
                            payload: {
                              pageIndex: state.selectedPageIndex,
                              slotIndex: state.selectedSlotIndex!,
                              offsetY: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 mt-1">{selectedSlot.offsetY}%</div>
                    </div>

                    <button
                      onClick={() =>
                        dispatch({
                          type: 'REMOVE_PHOTO_FROM_SLOT',
                          payload: { pageIndex: state.selectedPageIndex, slotIndex: state.selectedSlotIndex! },
                        })
                      }
                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Remove Photo
                    </button>
                  </>
                )}
              </div>
            )}

            {state.selectedTextBlockId && selectedText && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Text Block</h3>
                  <button
                    onClick={() =>
                      dispatch({
                        type: 'REMOVE_TEXT_BLOCK',
                        payload: { pageIndex: state.selectedPageIndex, textBlockId: state.selectedTextBlockId! },
                      })
                    }
                    className="p-1 hover:bg-red-100 text-red-600 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-2">Font Family</label>
                  <select
                    value={selectedText.fontFamily}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_TEXT_BLOCK',
                        payload: {
                          pageIndex: state.selectedPageIndex,
                          textBlockId: state.selectedTextBlockId!,
                          updates: { fontFamily: e.target.value },
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {FONT_FAMILIES.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-2">Font Size</label>
                  <input
                    type="range"
                    min="8"
                    max="72"
                    value={selectedText.fontSize}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_TEXT_BLOCK',
                        payload: {
                          pageIndex: state.selectedPageIndex,
                          textBlockId: state.selectedTextBlockId!,
                          updates: { fontSize: parseInt(e.target.value) },
                        },
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 mt-1">{selectedText.fontSize}px</div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-2">Color</label>
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_SWATCHES.map((color) => (
                      <button
                        key={color}
                        onClick={() =>
                          dispatch({
                            type: 'UPDATE_TEXT_BLOCK',
                            payload: {
                              pageIndex: state.selectedPageIndex,
                              textBlockId: state.selectedTextBlockId!,
                              updates: { color },
                            },
                          })
                        }
                        className={`aspect-square rounded-lg border-2 ${
                          selectedText.color === color ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-2">Text Align</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_TEXT_BLOCK',
                          payload: {
                            pageIndex: state.selectedPageIndex,
                            textBlockId: state.selectedTextBlockId!,
                            updates: { align: 'left' },
                          },
                        })
                      }
                      className={`flex-1 py-2 rounded border ${
                        selectedText.align === 'left' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      <AlignLeft size={16} className="mx-auto" />
                    </button>
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_TEXT_BLOCK',
                          payload: {
                            pageIndex: state.selectedPageIndex,
                            textBlockId: state.selectedTextBlockId!,
                            updates: { align: 'center' },
                          },
                        })
                      }
                      className={`flex-1 py-2 rounded border ${
                        selectedText.align === 'center' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      <AlignCenter size={16} className="mx-auto" />
                    </button>
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_TEXT_BLOCK',
                          payload: {
                            pageIndex: state.selectedPageIndex,
                            textBlockId: state.selectedTextBlockId!,
                            updates: { align: 'right' },
                          },
                        })
                      }
                      className={`flex-1 py-2 rounded border ${
                        selectedText.align === 'right' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      <AlignRight size={16} className="mx-auto" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-2">Style</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_TEXT_BLOCK',
                          payload: {
                            pageIndex: state.selectedPageIndex,
                            textBlockId: state.selectedTextBlockId!,
                            updates: { bold: !selectedText.bold },
                          },
                        })
                      }
                      className={`flex-1 py-2 rounded border flex items-center justify-center gap-2 ${
                        selectedText.bold ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      <Bold size={16} />
                      Bold
                    </button>
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_TEXT_BLOCK',
                          payload: {
                            pageIndex: state.selectedPageIndex,
                            textBlockId: state.selectedTextBlockId!,
                            updates: { italic: !selectedText.italic },
                          },
                        })
                      }
                      className={`flex-1 py-2 rounded border flex items-center justify-center gap-2 ${
                        selectedText.italic ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      <Italic size={16} />
                      Italic
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-2">Line Height</label>
                  <input
                    type="range"
                    min="0.8"
                    max="3"
                    step="0.1"
                    value={selectedText.lineHeight}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_TEXT_BLOCK',
                        payload: {
                          pageIndex: state.selectedPageIndex,
                          textBlockId: state.selectedTextBlockId!,
                          updates: { lineHeight: parseFloat(e.target.value) },
                        },
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 mt-1">{selectedText.lineHeight.toFixed(1)}</div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-2">Letter Spacing</label>
                  <input
                    type="range"
                    min="-2"
                    max="10"
                    step="0.5"
                    value={selectedText.letterSpacing}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_TEXT_BLOCK',
                        payload: {
                          pageIndex: state.selectedPageIndex,
                          textBlockId: state.selectedTextBlockId!,
                          updates: { letterSpacing: parseFloat(e.target.value) },
                        },
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 mt-1">{selectedText.letterSpacing}px</div>
                </div>
              </div>
            )}

            {!state.selectedSlotIndex && !state.selectedTextBlockId && (
              <div className="text-center text-gray-500 text-sm py-8">
                Select a photo slot or text block to edit properties
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-full overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Preview: {state.magazineTitle}</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-8">
              {state.pages.map((page) => {
                const layout = MAGAZINE_LAYOUTS.find((l) => l.id === page.layoutId);
                return (
                  <div key={page.id} className="space-y-2">
                    <div className="text-sm text-gray-600">Page {page.pageIndex + 1}</div>
                    <div
                      className="relative bg-white shadow-lg mx-auto"
                      style={{
                        width: '600px',
                        height: '800px',
                        backgroundColor: page.bgColor,
                      }}
                    >
                      {layout?.slots.map((slotDef, idx) => {
                        const slotState = page.slots[idx];
                        const photo = slotState?.photoId ? state.photos.find((p) => p.id === slotState.photoId) : null;

                        return (
                          <div
                            key={idx}
                            className="absolute overflow-hidden"
                            style={{
                              left: `${slotDef.x}%`,
                              top: `${slotDef.y}%`,
                              width: `${slotDef.width}%`,
                              height: `${slotDef.height}%`,
                            }}
                          >
                            {photo && (
                              <img
                                src={photo.src}
                                alt={photo.name}
                                className="absolute"
                                style={{
                                  width: `${slotState.zoom * 100}%`,
                                  height: `${slotState.zoom * 100}%`,
                                  left: `${slotState.offsetX}%`,
                                  top: `${slotState.offsetY}%`,
                                  objectFit: 'cover',
                                }}
                              />
                            )}
                          </div>
                        );
                      })}

                      {page.textBlocks.map((tb) => (
                        <div
                          key={tb.id}
                          className="absolute"
                          style={{
                            left: `${tb.x}%`,
                            top: `${tb.y}%`,
                            width: `${tb.width}%`,
                            fontSize: `${tb.fontSize}px`,
                            fontFamily: tb.fontFamily,
                            color: tb.color,
                            textAlign: tb.align,
                            fontStyle: tb.italic ? 'italic' : 'normal',
                            fontWeight: tb.bold ? 'bold' : 'normal',
                            lineHeight: tb.lineHeight,
                            letterSpacing: `${tb.letterSpacing}px`,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {tb.content}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
