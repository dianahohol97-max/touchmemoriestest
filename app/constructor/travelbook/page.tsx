'use client'

import React, { useReducer, useRef, useState, useEffect, DragEvent, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Image as ImageIcon, Layout, Type, Palette, BookOpen, Undo2, Redo2, Eye, ShoppingCart, Plus, Trash2, Copy, Grid, X, ZoomIn, ZoomOut, RotateCw, Plane, Heart, Mountain, MapPin, Compass } from 'lucide-react'

// ============================================================================
// TYPESCRIPT INTERFACES & TYPES
// ============================================================================

interface PhotoSlot {
  id: string
  x: number
  y: number
  w: number
  h: number
  photoId: string | null
  scale: number
  offsetX: number
  offsetY: number
  rotation: number
  filter: string
}

interface TextBlock {
  id: string
  text: string
  x: number
  y: number
  w: number
  h: number
  fontSize: number
  fontFamily: string
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
  lineHeight: number
}

interface Page {
  id: string
  type: 'cover' | 'content'
  layoutId: string
  slots: PhotoSlot[]
  textBlocks: TextBlock[]
  bgColor: string
  bgImage: string | null
}

interface Photo {
  id: string
  url: string
  file: File
  thumbnail: string
}

interface Layout {
  id: string
  name: string
  category: 'single' | 'double' | 'triple' | 'multi' | 'text'
  slots: Array<{ x: number; y: number; w: number; h: number }>
}

interface CoverTemplate {
  id: string
  name: string
  category: 'minimalist' | 'travel' | 'romantic' | 'adventure'
  bgColor: string
  bgGradient?: string
  textBlocks: Array<{
    text: string
    x: number
    y: number
    w: number
    fontSize: number
    fontFamily: string
    color: string
    align: 'left' | 'center' | 'right'
    bold: boolean
    italic: boolean
    uppercase?: boolean
  }>
  photoSlot?: { x: number; y: number; w: number; h: number }
  decorations?: Array<{
    type: 'line' | 'border' | 'icon' | 'shape' | 'badge'
    style: Record<string, string | number>
  }>
}

interface HistoryState {
  pages: Page[]
  tripTitle: string
}

interface State {
  pages: Page[]
  currentPageIndex: number
  photos: Photo[]
  tripTitle: string
  selectedSlotId: string | null
  selectedTextBlockId: string | null
  activeTab: 'photos' | 'covers' | 'layouts' | 'text' | 'backgrounds'
  history: HistoryState[]
  historyIndex: number
  mode: 'smart' | 'manual'
  isDragging: boolean
  draggedPhotoId: string | null
}

type Action =
  | { type: 'ADD_PHOTOS'; photos: Photo[] }
  | { type: 'PLACE_PHOTO'; slotId: string; photoId: string }
  | { type: 'REMOVE_PHOTO_FROM_SLOT'; slotId: string }
  | { type: 'UPDATE_SLOT_TRANSFORM'; slotId: string; scale?: number; offsetX?: number; offsetY?: number; rotation?: number; filter?: string }
  | { type: 'CHANGE_PAGE_LAYOUT'; pageIndex: number; layoutId: string }
  | { type: 'APPLY_COVER_TEMPLATE'; templateId: string }
  | { type: 'ADD_PAGE'; afterIndex?: number }
  | { type: 'REMOVE_PAGE'; pageIndex: number }
  | { type: 'MOVE_PAGE'; fromIndex: number; toIndex: number }
  | { type: 'DUPLICATE_PAGE'; pageIndex: number }
  | { type: 'CLEAR_PAGE'; pageIndex: number }
  | { type: 'SET_PAGE_BG_COLOR'; pageIndex: number; color: string }
  | { type: 'SET_PAGE_BG_IMAGE'; pageIndex: number; imageUrl: string | null }
  | { type: 'ADD_TEXT_BLOCK'; pageIndex: number; textBlock?: Partial<TextBlock> }
  | { type: 'UPDATE_TEXT_BLOCK'; textBlockId: string; updates: Partial<TextBlock> }
  | { type: 'REMOVE_TEXT_BLOCK'; textBlockId: string }
  | { type: 'SELECT_PAGE'; pageIndex: number }
  | { type: 'SELECT_SLOT'; slotId: string | null }
  | { type: 'SELECT_TEXT_BLOCK'; textBlockId: string | null }
  | { type: 'DESELECT_ALL' }
  | { type: 'SET_TRIP_TITLE'; title: string }
  | { type: 'AUTO_FILL_ALL' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_MODE'; mode: 'smart' | 'manual' }
  | { type: 'SET_ACTIVE_TAB'; tab: 'photos' | 'covers' | 'layouts' | 'text' | 'backgrounds' }
  | { type: 'START_DRAG'; photoId: string }
  | { type: 'END_DRAG' }

// ============================================================================
// LAYOUTS DATA - All interior page layouts
// ============================================================================

const TRAVEL_LAYOUTS: Layout[] = [
  {
    id: 'layout-full-bleed',
    name: 'Full Bleed',
    category: 'single',
    slots: [{ x: 0, y: 0, w: 100, h: 100 }]
  },
  {
    id: 'layout-centered',
    name: 'Centered',
    category: 'single',
    slots: [{ x: 10, y: 10, w: 80, h: 80 }]
  },
  {
    id: 'layout-portrait',
    name: 'Portrait',
    category: 'single',
    slots: [{ x: 20, y: 5, w: 60, h: 85 }]
  },
  {
    id: 'layout-landscape',
    name: 'Landscape',
    category: 'single',
    slots: [{ x: 5, y: 25, w: 90, h: 50 }]
  },
  {
    id: 'layout-two-v',
    name: 'Two Vertical',
    category: 'double',
    slots: [
      { x: 2, y: 5, w: 46, h: 90 },
      { x: 52, y: 5, w: 46, h: 90 }
    ]
  },
  {
    id: 'layout-two-h',
    name: 'Two Horizontal',
    category: 'double',
    slots: [
      { x: 5, y: 2, w: 90, h: 46 },
      { x: 5, y: 52, w: 90, h: 46 }
    ]
  },
  {
    id: 'layout-three-main',
    name: 'Three Main',
    category: 'triple',
    slots: [
      { x: 2, y: 2, w: 63, h: 96 },
      { x: 68, y: 2, w: 30, h: 46 },
      { x: 68, y: 52, w: 30, h: 46 }
    ]
  },
  {
    id: 'layout-four-grid',
    name: 'Four Grid',
    category: 'multi',
    slots: [
      { x: 2, y: 2, w: 46, h: 46 },
      { x: 52, y: 2, w: 46, h: 46 },
      { x: 2, y: 52, w: 46, h: 46 },
      { x: 52, y: 52, w: 46, h: 46 }
    ]
  },
  {
    id: 'layout-collage-5',
    name: 'Collage 5',
    category: 'multi',
    slots: [
      { x: 2, y: 2, w: 48, h: 48 },
      { x: 52, y: 2, w: 23, h: 48 },
      { x: 77, y: 2, w: 21, h: 48 },
      { x: 2, y: 52, w: 31, h: 46 },
      { x: 35, y: 52, w: 63, h: 46 }
    ]
  },
  {
    id: 'layout-caption-bottom',
    name: 'Caption Bottom',
    category: 'single',
    slots: [{ x: 5, y: 5, w: 90, h: 65 }]
  },
  {
    id: 'layout-caption-right',
    name: 'Caption Right',
    category: 'single',
    slots: [{ x: 5, y: 5, w: 60, h: 90 }]
  },
  {
    id: 'layout-caption-left',
    name: 'Caption Left',
    category: 'single',
    slots: [{ x: 35, y: 5, w: 60, h: 90 }]
  },
  {
    id: 'layout-quote-photo',
    name: 'Quote + Photo',
    category: 'single',
    slots: [{ x: 5, y: 35, w: 90, h: 60 }]
  },
  {
    id: 'layout-quote-only',
    name: 'Quote Only',
    category: 'text',
    slots: []
  },
  {
    id: 'layout-article',
    name: 'Article',
    category: 'text',
    slots: []
  },
  {
    id: 'layout-blank',
    name: 'Blank',
    category: 'text',
    slots: []
  }
]

// ============================================================================
// COVER TEMPLATES DATA - All 16 cover designs with visual specifications
// ============================================================================

const COVER_TEMPLATES: CoverTemplate[] = [
  // MINIMALIST (3)
  {
    id: 'cover-minimal-light',
    name: 'Minimal Light',
    category: 'minimalist',
    bgColor: '#f9f6f2',
    photoSlot: { x: 10, y: 5, w: 80, h: 55 },
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 65,
        w: 80,
        fontSize: 28,
        fontFamily: 'Playfair Display',
        color: '#2c2c2c',
        align: 'center',
        bold: true,
        italic: false
      },
      {
        text: '[SUBTITLE]',
        x: 10,
        y: 72,
        w: 80,
        fontSize: 14,
        fontFamily: 'Montserrat',
        color: '#666666',
        align: 'center',
        bold: false,
        italic: false,
        uppercase: true
      }
    ]
  },
  {
    id: 'cover-minimal-dark',
    name: 'Minimal Dark',
    category: 'minimalist',
    bgColor: '#1a1a1a',
    photoSlot: { x: 10, y: 5, w: 80, h: 58 },
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 68,
        w: 80,
        fontSize: 32,
        fontFamily: 'Cormorant',
        color: '#ffffff',
        align: 'center',
        bold: false,
        italic: true
      }
    ]
  },
  {
    id: 'cover-minimal-line',
    name: 'Minimal Line',
    category: 'minimalist',
    bgColor: '#ffffff',
    photoSlot: { x: 15, y: 15, w: 70, h: 50 },
    decorations: [
      { type: 'line', style: { top: '10%', left: '10%', width: '80%', borderTop: '1px solid #333' } },
      { type: 'line', style: { top: '90%', left: '10%', width: '80%', borderTop: '1px solid #333' } }
    ],
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 15,
        y: 70,
        w: 70,
        fontSize: 22,
        fontFamily: 'Montserrat',
        color: '#1a1a1a',
        align: 'center',
        bold: true,
        italic: false,
        uppercase: true
      }
    ]
  },

  // TRAVEL/DESTINATION (6)
  {
    id: 'cover-travel-explore',
    name: 'Travel Explore',
    category: 'travel',
    bgColor: '#2c3e50',
    bgGradient: 'linear-gradient(to bottom, rgba(44,62,80,0.6), rgba(44,62,80,0.9))',
    photoSlot: { x: 0, y: 0, w: 100, h: 100 },
    textBlocks: [
      {
        text: 'EXPLORE',
        x: 10,
        y: 15,
        w: 80,
        fontSize: 18,
        fontFamily: 'Montserrat',
        color: '#ffffff',
        align: 'center',
        bold: false,
        italic: false,
        uppercase: true
      },
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 40,
        w: 80,
        fontSize: 36,
        fontFamily: 'Playfair Display',
        color: '#ffffff',
        align: 'center',
        bold: true,
        italic: false
      },
      {
        text: '40.7128° N, 74.0060° W',
        x: 10,
        y: 75,
        w: 80,
        fontSize: 12,
        fontFamily: 'Courier New',
        color: '#e0e0e0',
        align: 'center',
        bold: false,
        italic: false
      }
    ]
  },
  {
    id: 'cover-travel-coordinates',
    name: 'Travel Coordinates',
    category: 'travel',
    bgColor: '#f0ebe3',
    photoSlot: { x: 10, y: 5, w: 80, h: 55 },
    textBlocks: [
      {
        text: '✦',
        x: 10,
        y: 63,
        w: 80,
        fontSize: 24,
        fontFamily: 'serif',
        color: '#8b6f47',
        align: 'center',
        bold: false,
        italic: false
      },
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 70,
        w: 80,
        fontSize: 26,
        fontFamily: 'Playfair Display',
        color: '#2c2c2c',
        align: 'center',
        bold: true,
        italic: false
      },
      {
        text: '48.8566° N, 2.3522° E',
        x: 10,
        y: 78,
        w: 80,
        fontSize: 11,
        fontFamily: 'Montserrat',
        color: '#666666',
        align: 'center',
        bold: false,
        italic: false
      }
    ]
  },
  {
    id: 'cover-travel-stamp',
    name: 'Travel Stamp',
    category: 'travel',
    bgColor: '#fdf8f0',
    photoSlot: { x: 15, y: 15, w: 70, h: 60 },
    decorations: [
      { type: 'border', style: { top: '14%', left: '14%', width: '72%', height: '62%', border: '3px double #8b6f47' } }
    ],
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 15,
        y: 78,
        w: 70,
        fontSize: 24,
        fontFamily: 'Playfair Display',
        color: '#2c2c2c',
        align: 'center',
        bold: true,
        italic: false
      }
    ]
  },
  {
    id: 'cover-travel-vintage',
    name: 'Travel Vintage',
    category: 'travel',
    bgColor: '#2d1f0e',
    photoSlot: { x: 12, y: 12, w: 76, h: 60 },
    decorations: [
      { type: 'badge', style: { top: '35%', left: '35%', width: '30%', height: '30%', border: '4px solid #d4af37', borderRadius: '50%', opacity: '0.3' } }
    ],
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 76,
        w: 80,
        fontSize: 28,
        fontFamily: 'Playfair Display',
        color: '#d4af37',
        align: 'center',
        bold: true,
        italic: false
      },
      {
        text: 'VINTAGE TRAVEL',
        x: 10,
        y: 84,
        w: 80,
        fontSize: 10,
        fontFamily: 'Montserrat',
        color: '#d4af37',
        align: 'center',
        bold: false,
        italic: false,
        uppercase: true
      }
    ]
  },
  {
    id: 'cover-travel-map',
    name: 'Travel Map',
    category: 'travel',
    bgColor: '#f4e8d0',
    photoSlot: { x: 20, y: 18, w: 55, h: 55 },
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 8,
        w: 80,
        fontSize: 30,
        fontFamily: 'Playfair Display',
        color: '#2c2c2c',
        align: 'center',
        bold: true,
        italic: false
      },
      {
        text: 'A Journey Through Time',
        x: 10,
        y: 78,
        w: 80,
        fontSize: 14,
        fontFamily: 'Montserrat',
        color: '#666666',
        align: 'center',
        bold: false,
        italic: true
      }
    ]
  },
  {
    id: 'cover-travel-passport',
    name: 'Travel Passport',
    category: 'travel',
    bgColor: '#8b4513',
    photoSlot: { x: 15, y: 20, w: 70, h: 45 },
    decorations: [
      { type: 'shape', style: { top: '18%', left: '13%', width: '74%', height: '49%', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '4px' } }
    ],
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 70,
        w: 80,
        fontSize: 32,
        fontFamily: 'Oswald',
        color: '#ffffff',
        align: 'center',
        bold: true,
        italic: false,
        uppercase: true
      },
      {
        text: 'TRAVEL MEMORIES',
        x: 10,
        y: 8,
        w: 80,
        fontSize: 12,
        fontFamily: 'Montserrat',
        color: '#ffffff',
        align: 'center',
        bold: false,
        italic: false,
        uppercase: true
      }
    ]
  },

  // ROMANTIC (4)
  {
    id: 'cover-romantic-soft',
    name: 'Romantic Soft',
    category: 'romantic',
    bgColor: '#fff0f5',
    bgGradient: 'linear-gradient(135deg, #ffc3d5 0%, #fff0f5 50%, #e6d5ff 100%)',
    photoSlot: { x: 15, y: 15, w: 70, h: 50 },
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 70,
        w: 80,
        fontSize: 28,
        fontFamily: 'Dancing Script',
        color: '#8b4789',
        align: 'center',
        bold: false,
        italic: false
      },
      {
        text: 'Our Love Story',
        x: 10,
        y: 78,
        w: 80,
        fontSize: 14,
        fontFamily: 'Montserrat',
        color: '#d4739f',
        align: 'center',
        bold: false,
        italic: true
      }
    ]
  },
  {
    id: 'cover-romantic-gold',
    name: 'Romantic Gold',
    category: 'romantic',
    bgColor: '#1c1209',
    photoSlot: { x: 0, y: 0, w: 100, h: 100 },
    bgGradient: 'linear-gradient(to bottom, rgba(28,18,9,0.3), rgba(28,18,9,0.7))',
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 40,
        w: 80,
        fontSize: 34,
        fontFamily: 'Cormorant',
        color: '#d4af37',
        align: 'center',
        bold: false,
        italic: true
      },
      {
        text: '♥',
        x: 10,
        y: 75,
        w: 80,
        fontSize: 20,
        fontFamily: 'serif',
        color: '#d4af37',
        align: 'center',
        bold: false,
        italic: false
      }
    ]
  },
  {
    id: 'cover-romantic-floral',
    name: 'Romantic Floral',
    category: 'romantic',
    bgColor: '#fdf9f5',
    photoSlot: { x: 10, y: 5, w: 80, h: 50 },
    textBlocks: [
      {
        text: '❀',
        x: 10,
        y: 58,
        w: 80,
        fontSize: 18,
        fontFamily: 'serif',
        color: '#d4739f',
        align: 'center',
        bold: false,
        italic: false
      },
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 65,
        w: 80,
        fontSize: 30,
        fontFamily: 'Dancing Script',
        color: '#2c2c2c',
        align: 'center',
        bold: false,
        italic: false
      },
      {
        text: 'Together Forever',
        x: 10,
        y: 75,
        w: 80,
        fontSize: 12,
        fontFamily: 'Montserrat',
        color: '#999999',
        align: 'center',
        bold: false,
        italic: true
      }
    ]
  },
  {
    id: 'cover-romantic-blush',
    name: 'Romantic Blush',
    category: 'romantic',
    bgColor: '#fff5f5',
    photoSlot: { x: 20, y: 15, w: 60, h: 50 },
    decorations: [
      { type: 'border', style: { top: '13%', left: '18%', width: '64%', height: '54%', border: '2px solid #ffc3d5', borderRadius: '8px' } }
    ],
    textBlocks: [
      {
        text: '♡',
        x: 10,
        y: 68,
        w: 80,
        fontSize: 16,
        fontFamily: 'serif',
        color: '#ff6b9d',
        align: 'center',
        bold: false,
        italic: false
      },
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 74,
        w: 80,
        fontSize: 26,
        fontFamily: 'Dancing Script',
        color: '#8b4789',
        align: 'center',
        bold: false,
        italic: false
      }
    ]
  },

  // ADVENTURE (3)
  {
    id: 'cover-adventure-bold',
    name: 'Adventure Bold',
    category: 'adventure',
    bgColor: '#0d1b2a',
    photoSlot: { x: 0, y: 0, w: 100, h: 100 },
    decorations: [
      { type: 'shape', style: { top: '38%', left: '0%', width: '100%', height: '24%', backgroundColor: 'rgba(220,38,38,0.85)' } }
    ],
    textBlocks: [
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 42,
        w: 80,
        fontSize: 38,
        fontFamily: 'Oswald',
        color: '#ffffff',
        align: 'center',
        bold: true,
        italic: false,
        uppercase: true
      }
    ]
  },
  {
    id: 'cover-adventure-nature',
    name: 'Adventure Nature',
    category: 'adventure',
    bgColor: '#1b4332',
    photoSlot: { x: 5, y: 5, w: 90, h: 65 },
    textBlocks: [
      {
        text: 'INTO THE WILD',
        x: 10,
        y: 73,
        w: 80,
        fontSize: 14,
        fontFamily: 'Montserrat',
        color: '#90ee90',
        align: 'center',
        bold: false,
        italic: false,
        uppercase: true
      },
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 80,
        w: 80,
        fontSize: 30,
        fontFamily: 'Oswald',
        color: '#ffffff',
        align: 'center',
        bold: true,
        italic: false
      }
    ]
  },
  {
    id: 'cover-adventure-map',
    name: 'Adventure Map',
    category: 'adventure',
    bgColor: '#f4e8d0',
    photoSlot: { x: 25, y: 20, w: 50, h: 50 },
    textBlocks: [
      {
        text: '✈',
        x: 10,
        y: 8,
        w: 80,
        fontSize: 24,
        fontFamily: 'serif',
        color: '#2c3e50',
        align: 'center',
        bold: false,
        italic: false
      },
      {
        text: '[TRIP TITLE]',
        x: 10,
        y: 74,
        w: 80,
        fontSize: 28,
        fontFamily: 'Oswald',
        color: '#2c3e50',
        align: 'center',
        bold: true,
        italic: false,
        uppercase: true
      },
      {
        text: 'Adventure Awaits',
        x: 10,
        y: 82,
        w: 80,
        fontSize: 12,
        fontFamily: 'Montserrat',
        color: '#666666',
        align: 'center',
        bold: false,
        italic: true
      }
    ]
  }
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function pushHistory(state: State): State {
  const newHistory = state.history.slice(0, state.historyIndex + 1)
  newHistory.push({
    pages: JSON.parse(JSON.stringify(state.pages)),
    tripTitle: state.tripTitle
  })

  // Limit history to 50 states
  if (newHistory.length > 50) {
    newHistory.shift()
  }

  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1
  }
}

function createPhotoSlot(slotDef: { x: number; y: number; w: number; h: number }): PhotoSlot {
  return {
    id: generateId(),
    x: slotDef.x,
    y: slotDef.y,
    w: slotDef.w,
    h: slotDef.h,
    photoId: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    filter: 'none'
  }
}

function createTextBlock(data?: Partial<TextBlock>): TextBlock {
  return {
    id: generateId(),
    text: data?.text || 'New Text',
    x: data?.x || 20,
    y: data?.y || 20,
    w: data?.w || 60,
    h: data?.h || 10,
    fontSize: data?.fontSize || 16,
    fontFamily: data?.fontFamily || 'Montserrat',
    color: data?.color || '#000000',
    align: data?.align || 'left',
    bold: data?.bold || false,
    italic: data?.italic || false,
    lineHeight: data?.lineHeight || 1.4
  }
}

function buildInitialPages(tripTitle: string): Page[] {
  // Create cover page with default template
  const coverTemplate = COVER_TEMPLATES[0]
  const coverPage: Page = {
    id: generateId(),
    type: 'cover',
    layoutId: 'cover-minimal-light',
    slots: coverTemplate.photoSlot ? [createPhotoSlot(coverTemplate.photoSlot)] : [],
    textBlocks: coverTemplate.textBlocks.map(tb => createTextBlock({
      text: tb.text.replace('[TRIP TITLE]', tripTitle || 'My Travel Book'),
      x: tb.x,
      y: tb.y,
      w: tb.w,
      fontSize: tb.fontSize,
      fontFamily: tb.fontFamily,
      color: tb.color,
      align: tb.align,
      bold: tb.bold,
      italic: tb.italic
    })),
    bgColor: coverTemplate.bgColor,
    bgImage: null
  }

  // Create 10 content pages with various layouts
  const contentPages: Page[] = []
  const layoutIds = ['layout-full-bleed', 'layout-two-v', 'layout-centered', 'layout-landscape', 'layout-four-grid', 'layout-caption-bottom', 'layout-three-main', 'layout-two-h', 'layout-collage-5', 'layout-portrait']

  for (let i = 0; i < 10; i++) {
    const layoutId = layoutIds[i % layoutIds.length]
    const layout = TRAVEL_LAYOUTS.find(l => l.id === layoutId) || TRAVEL_LAYOUTS[0]

    contentPages.push({
      id: generateId(),
      type: 'content',
      layoutId: layout.id,
      slots: layout.slots.map(createPhotoSlot),
      textBlocks: [],
      bgColor: '#ffffff',
      bgImage: null
    })
  }

  return [coverPage, ...contentPages]
}

// ============================================================================
// REDUCER FUNCTION - State management with all actions
// ============================================================================

function travelBookReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_PHOTOS': {
      return {
        ...state,
        photos: [...state.photos, ...action.photos]
      }
    }

    case 'PLACE_PHOTO': {
      const newState = pushHistory(state)
      const currentPage = newState.pages[newState.currentPageIndex]
      const slot = currentPage.slots.find(s => s.id === action.slotId)

      if (!slot) return state

      slot.photoId = action.photoId
      slot.scale = 1
      slot.offsetX = 0
      slot.offsetY = 0
      slot.rotation = 0

      return {
        ...newState,
        pages: [...newState.pages]
      }
    }

    case 'REMOVE_PHOTO_FROM_SLOT': {
      const newState = pushHistory(state)
      const currentPage = newState.pages[newState.currentPageIndex]
      const slot = currentPage.slots.find(s => s.id === action.slotId)

      if (!slot) return state

      slot.photoId = null
      slot.scale = 1
      slot.offsetX = 0
      slot.offsetY = 0
      slot.rotation = 0

      return {
        ...newState,
        pages: [...newState.pages]
      }
    }

    case 'UPDATE_SLOT_TRANSFORM': {
      const currentPage = state.pages[state.currentPageIndex]
      const slot = currentPage.slots.find(s => s.id === action.slotId)

      if (!slot) return state

      if (action.scale !== undefined) slot.scale = action.scale
      if (action.offsetX !== undefined) slot.offsetX = action.offsetX
      if (action.offsetY !== undefined) slot.offsetY = action.offsetY
      if (action.rotation !== undefined) slot.rotation = action.rotation
      if (action.filter !== undefined) slot.filter = action.filter

      return {
        ...state,
        pages: [...state.pages]
      }
    }

    case 'CHANGE_PAGE_LAYOUT': {
      const newState = pushHistory(state)
      const page = newState.pages[action.pageIndex]
      const layout = TRAVEL_LAYOUTS.find(l => l.id === action.layoutId)

      if (!layout || !page) return state

      page.layoutId = layout.id
      page.slots = layout.slots.map(createPhotoSlot)

      return {
        ...newState,
        pages: [...newState.pages],
        selectedSlotId: null
      }
    }

    case 'APPLY_COVER_TEMPLATE': {
      const newState = pushHistory(state)
      const template = COVER_TEMPLATES.find(t => t.id === action.templateId)
      const coverPage = newState.pages.find(p => p.type === 'cover')

      if (!template || !coverPage) return state

      coverPage.layoutId = template.id
      coverPage.bgColor = template.bgColor
      coverPage.slots = template.photoSlot ? [createPhotoSlot(template.photoSlot)] : []
      coverPage.textBlocks = template.textBlocks.map(tb => createTextBlock({
        text: tb.text.replace('[TRIP TITLE]', newState.tripTitle || 'My Travel Book').replace('[SUBTITLE]', '2024'),
        x: tb.x,
        y: tb.y,
        w: tb.w,
        fontSize: tb.fontSize,
        fontFamily: tb.fontFamily,
        color: tb.color,
        align: tb.align,
        bold: tb.bold,
        italic: tb.italic
      }))

      return {
        ...newState,
        pages: [...newState.pages]
      }
    }

    case 'ADD_PAGE': {
      const newState = pushHistory(state)
      const insertIndex = action.afterIndex !== undefined ? action.afterIndex + 1 : newState.pages.length

      const newPage: Page = {
        id: generateId(),
        type: 'content',
        layoutId: 'layout-centered',
        slots: TRAVEL_LAYOUTS.find(l => l.id === 'layout-centered')!.slots.map(createPhotoSlot),
        textBlocks: [],
        bgColor: '#ffffff',
        bgImage: null
      }

      newState.pages.splice(insertIndex, 0, newPage)

      return {
        ...newState,
        pages: [...newState.pages],
        currentPageIndex: insertIndex
      }
    }

    case 'REMOVE_PAGE': {
      if (state.pages.length <= 1) return state

      const newState = pushHistory(state)
      newState.pages.splice(action.pageIndex, 1)

      return {
        ...newState,
        pages: [...newState.pages],
        currentPageIndex: Math.min(state.currentPageIndex, newState.pages.length - 1)
      }
    }

    case 'MOVE_PAGE': {
      const newState = pushHistory(state)
      const [movedPage] = newState.pages.splice(action.fromIndex, 1)
      newState.pages.splice(action.toIndex, 0, movedPage)

      return {
        ...newState,
        pages: [...newState.pages],
        currentPageIndex: action.toIndex
      }
    }

    case 'DUPLICATE_PAGE': {
      const newState = pushHistory(state)
      const pageToDuplicate = newState.pages[action.pageIndex]

      if (!pageToDuplicate) return state

      const duplicatedPage: Page = JSON.parse(JSON.stringify(pageToDuplicate))
      duplicatedPage.id = generateId()
      duplicatedPage.slots = duplicatedPage.slots.map(slot => ({
        ...slot,
        id: generateId()
      }))
      duplicatedPage.textBlocks = duplicatedPage.textBlocks.map(tb => ({
        ...tb,
        id: generateId()
      }))

      newState.pages.splice(action.pageIndex + 1, 0, duplicatedPage)

      return {
        ...newState,
        pages: [...newState.pages],
        currentPageIndex: action.pageIndex + 1
      }
    }

    case 'CLEAR_PAGE': {
      const newState = pushHistory(state)
      const page = newState.pages[action.pageIndex]

      if (!page) return state

      page.slots.forEach(slot => {
        slot.photoId = null
        slot.scale = 1
        slot.offsetX = 0
        slot.offsetY = 0
        slot.rotation = 0
      })
      page.textBlocks = []

      return {
        ...newState,
        pages: [...newState.pages]
      }
    }

    case 'SET_PAGE_BG_COLOR': {
      const newState = pushHistory(state)
      const page = newState.pages[action.pageIndex]

      if (!page) return state

      page.bgColor = action.color

      return {
        ...newState,
        pages: [...newState.pages]
      }
    }

    case 'SET_PAGE_BG_IMAGE': {
      const newState = pushHistory(state)
      const page = newState.pages[action.pageIndex]

      if (!page) return state

      page.bgImage = action.imageUrl

      return {
        ...newState,
        pages: [...newState.pages]
      }
    }

    case 'ADD_TEXT_BLOCK': {
      const newState = pushHistory(state)
      const page = newState.pages[action.pageIndex]

      if (!page) return state

      const newTextBlock = createTextBlock(action.textBlock)
      page.textBlocks.push(newTextBlock)

      return {
        ...newState,
        pages: [...newState.pages],
        selectedTextBlockId: newTextBlock.id,
        selectedSlotId: null
      }
    }

    case 'UPDATE_TEXT_BLOCK': {
      const currentPage = state.pages[state.currentPageIndex]
      const textBlock = currentPage.textBlocks.find(tb => tb.id === action.textBlockId)

      if (!textBlock) return state

      Object.assign(textBlock, action.updates)

      return {
        ...state,
        pages: [...state.pages]
      }
    }

    case 'REMOVE_TEXT_BLOCK': {
      const newState = pushHistory(state)
      const currentPage = newState.pages[newState.currentPageIndex]
      const index = currentPage.textBlocks.findIndex(tb => tb.id === action.textBlockId)

      if (index === -1) return state

      currentPage.textBlocks.splice(index, 1)

      return {
        ...newState,
        pages: [...newState.pages],
        selectedTextBlockId: null
      }
    }

    case 'SELECT_PAGE': {
      return {
        ...state,
        currentPageIndex: action.pageIndex,
        selectedSlotId: null,
        selectedTextBlockId: null
      }
    }

    case 'SELECT_SLOT': {
      return {
        ...state,
        selectedSlotId: action.slotId,
        selectedTextBlockId: null
      }
    }

    case 'SELECT_TEXT_BLOCK': {
      return {
        ...state,
        selectedTextBlockId: action.textBlockId,
        selectedSlotId: null
      }
    }

    case 'DESELECT_ALL': {
      return {
        ...state,
        selectedSlotId: null,
        selectedTextBlockId: null
      }
    }

    case 'SET_TRIP_TITLE': {
      const newState = pushHistory(state)
      newState.tripTitle = action.title

      // Update cover page title
      const coverPage = newState.pages.find(p => p.type === 'cover')
      if (coverPage) {
        coverPage.textBlocks.forEach(tb => {
          if (tb.text.includes('My Travel Book') || tb.text.includes('[TRIP TITLE]')) {
            tb.text = action.title || 'My Travel Book'
          }
        })
      }

      return {
        ...newState,
        pages: [...newState.pages]
      }
    }

    case 'AUTO_FILL_ALL': {
      const newState = pushHistory(state)
      let photoIndex = 0

      newState.pages.forEach(page => {
        page.slots.forEach(slot => {
          if (!slot.photoId && photoIndex < newState.photos.length) {
            slot.photoId = newState.photos[photoIndex].id
            photoIndex++
          }
        })
      })

      return {
        ...newState,
        pages: [...newState.pages]
      }
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state

      const newIndex = state.historyIndex - 1
      const historyState = state.history[newIndex]

      return {
        ...state,
        pages: JSON.parse(JSON.stringify(historyState.pages)),
        tripTitle: historyState.tripTitle,
        historyIndex: newIndex,
        selectedSlotId: null,
        selectedTextBlockId: null
      }
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state

      const newIndex = state.historyIndex + 1
      const historyState = state.history[newIndex]

      return {
        ...state,
        pages: JSON.parse(JSON.stringify(historyState.pages)),
        tripTitle: historyState.tripTitle,
        historyIndex: newIndex,
        selectedSlotId: null,
        selectedTextBlockId: null
      }
    }

    case 'SET_MODE': {
      return {
        ...state,
        mode: action.mode
      }
    }

    case 'SET_ACTIVE_TAB': {
      return {
        ...state,
        activeTab: action.tab
      }
    }

    case 'START_DRAG': {
      return {
        ...state,
        isDragging: true,
        draggedPhotoId: action.photoId
      }
    }

    case 'END_DRAG': {
      return {
        ...state,
        isDragging: false,
        draggedPhotoId: null
      }
    }

    default:
      return state
  }
}

// ============================================================================
// MAIN COMPONENT - TravelBookConstructorPage
// ============================================================================

export default function TravelBookConstructorPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const initialState: State = {
    pages: buildInitialPages('My Travel Book'),
    currentPageIndex: 0,
    photos: [],
    tripTitle: 'My Travel Book',
    selectedSlotId: null,
    selectedTextBlockId: null,
    activeTab: 'photos',
    history: [{ pages: buildInitialPages('My Travel Book'), tripTitle: 'My Travel Book' }],
    historyIndex: 0,
    mode: 'smart',
    isDragging: false,
    draggedPhotoId: null
  }

  const [state, dispatch] = useReducer(travelBookReducer, initialState)
  const [zoom, setZoom] = useState(1)
  const [showPreview, setShowPreview] = useState(false)

  const currentPage = state.pages[state.currentPageIndex]
  const canUndo = state.historyIndex > 0
  const canRedo = state.historyIndex < state.history.length - 1

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newPhotos: Photo[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const url = URL.createObjectURL(file)

      newPhotos.push({
        id: generateId(),
        url,
        file,
        thumbnail: url
      })
    }

    dispatch({ type: 'ADD_PHOTOS', photos: newPhotos })

    // Auto-fill if in smart mode
    if (state.mode === 'smart' && newPhotos.length > 0) {
      setTimeout(() => {
        dispatch({ type: 'AUTO_FILL_ALL' })
      }, 100)
    }
  }

  const handlePhotoDragStart = (e: DragEvent<HTMLDivElement>, photoId: string) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('photoId', photoId)
    dispatch({ type: 'START_DRAG', photoId })
  }

  const handlePhotoDragEnd = () => {
    dispatch({ type: 'END_DRAG' })
  }

  const handleSlotDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleSlotDrop = (e: DragEvent<HTMLDivElement>, slotId: string) => {
    e.preventDefault()
    const photoId = e.dataTransfer.getData('photoId')

    if (photoId) {
      dispatch({ type: 'PLACE_PHOTO', slotId, photoId })
    }

    dispatch({ type: 'END_DRAG' })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      dispatch({ type: 'UNDO' })
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      dispatch({ type: 'REDO' })
    }

    // Delete
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedSlotId) {
        e.preventDefault()
        dispatch({ type: 'REMOVE_PHOTO_FROM_SLOT', slotId: state.selectedSlotId })
      }
      if (state.selectedTextBlockId) {
        e.preventDefault()
        dispatch({ type: 'REMOVE_TEXT_BLOCK', textBlockId: state.selectedTextBlockId })
      }
    }

    // Escape
    if (e.key === 'Escape') {
      dispatch({ type: 'DESELECT_ALL' })
    }

    // Arrow keys for page navigation
    if (e.key === 'ArrowLeft' && state.currentPageIndex > 0) {
      dispatch({ type: 'SELECT_PAGE', pageIndex: state.currentPageIndex - 1 })
    }
    if (e.key === 'ArrowRight' && state.currentPageIndex < state.pages.length - 1) {
      dispatch({ type: 'SELECT_PAGE', pageIndex: state.currentPageIndex + 1 })
    }
  }

  const handleCheckout = () => {
    // Prepare order data
    const orderData = {
      productType: 'travelbook',
      tripTitle: state.tripTitle,
      pageCount: state.pages.length,
      pages: state.pages.map(page => ({
        type: page.type,
        layoutId: page.layoutId,
        bgColor: page.bgColor,
        slots: page.slots.map(slot => ({
          photoId: slot.photoId,
          scale: slot.scale,
          offsetX: slot.offsetX,
          offsetY: slot.offsetY,
          rotation: slot.rotation,
          filter: slot.filter
        })),
        textBlocks: page.textBlocks
      })),
      photos: state.photos.map(p => p.url)
    }

    // Store in sessionStorage
    sessionStorage.setItem('travelbook_order', JSON.stringify(orderData))

    // Navigate to checkout
    router.push('/checkout')
  }

  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      handleKeyDown(e as any)
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [state.selectedSlotId, state.selectedTextBlockId, state.currentPageIndex, canUndo, canRedo])

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderCoverPreview = (template: CoverTemplate) => {
    const bgStyle: React.CSSProperties = {
      background: template.bgGradient || template.bgColor,
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }

    return (
      <div style={bgStyle}>
        {/* Photo slot preview */}
        {template.photoSlot && (
          <div
            style={{
              position: 'absolute',
              left: `${template.photoSlot.x}%`,
              top: `${template.photoSlot.y}%`,
              width: `${template.photoSlot.w}%`,
              height: `${template.photoSlot.h}%`,
              backgroundColor: 'rgba(200,200,200,0.3)',
              border: '1px dashed rgba(0,0,0,0.2)'
            }}
          />
        )}

        {/* Decorations */}
        {template.decorations?.map((dec, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              ...dec.style
            }}
          />
        ))}

        {/* Text blocks preview */}
        {template.textBlocks.map((tb, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${tb.x}%`,
              top: `${tb.y}%`,
              width: `${tb.w}%`,
              fontSize: `${tb.fontSize * 0.4}px`,
              fontFamily: tb.fontFamily,
              color: tb.color,
              textAlign: tb.align,
              fontWeight: tb.bold ? 'bold' : 'normal',
              fontStyle: tb.italic ? 'italic' : 'normal',
              textTransform: tb.uppercase ? 'uppercase' : 'none'
            }}
          >
            {tb.text.replace('[TRIP TITLE]', 'Title').replace('[SUBTITLE]', 'Subtitle')}
          </div>
        ))}
      </div>
    )
  }

  const renderLayoutPreview = (layout: Layout) => {
    return (
      <div className="relative w-full h-full bg-white">
        {layout.slots.map((slot, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: `${slot.w}%`,
              height: `${slot.h}%`,
              border: '1px solid #ccc',
              backgroundColor: '#f5f5f5'
            }}
          />
        ))}
      </div>
    )
  }

  const selectedSlot = state.selectedSlotId
    ? currentPage.slots.find(s => s.id === state.selectedSlotId)
    : null

  const selectedTextBlock = state.selectedTextBlockId
    ? currentPage.textBlocks.find(tb => tb.id === state.selectedTextBlockId)
    : null

  const selectedPhoto = selectedSlot?.photoId
    ? state.photos.find(p => p.id === selectedSlot.photoId)
    : null

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-hidden" tabIndex={0}>
      {/* TOP BAR */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/constructor')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Back</span>
          </button>

          <div className="h-8 w-px bg-gray-300" />

          <div className="flex items-center gap-2">
            <BookOpen size={24} className="text-blue-600" />
            <span className="font-bold text-lg">Travel Book</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!canUndo}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>

          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={18} />
          </button>

          <div className="h-8 w-px bg-gray-300" />

          <input
            type="text"
            value={state.tripTitle}
            onChange={(e) => dispatch({ type: 'SET_TRIP_TITLE', title: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Trip title..."
          />

          <div className="text-sm text-gray-600">
            {state.pages.length} pages
          </div>

          <div className="h-8 w-px bg-gray-300" />

          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <Eye size={18} />
            <span>Preview</span>
          </button>

          <button
            onClick={handleCheckout}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
          >
            <ShoppingCart size={18} />
            <span>Checkout</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT ICON STRIP */}
        <div className="w-16 bg-gray-800 flex flex-col items-center py-4 gap-2 flex-shrink-0">
          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'photos' })}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
              state.activeTab === 'photos' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
            }`}
            title="Photos"
          >
            <ImageIcon size={22} />
          </button>

          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'covers' })}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
              state.activeTab === 'covers' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
            }`}
            title="Covers"
          >
            <BookOpen size={22} />
          </button>

          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'layouts' })}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
              state.activeTab === 'layouts' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
            }`}
            title="Layouts"
          >
            <Layout size={22} />
          </button>

          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'text' })}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
              state.activeTab === 'text' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
            }`}
            title="Text"
          >
            <Type size={22} />
          </button>

          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'backgrounds' })}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
              state.activeTab === 'backgrounds' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
            }`}
            title="Backgrounds"
          >
            <Palette size={22} />
          </button>
        </div>

        {/* LEFT PANEL - Tab Content */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          {/* PHOTOS TAB */}
          {state.activeTab === 'photos' && (
            <div className="p-4">
              <h2 className="text-lg font-bold mb-4">Photos</h2>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium mb-4 transition-colors"
              >
                Upload Photos
              </button>

              {state.photos.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => dispatch({ type: 'AUTO_FILL_ALL' })}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Auto-Fill All Pages
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {state.photos.map((photo) => (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={(e) => handlePhotoDragStart(e, photo.id)}
                    onDragEnd={handlePhotoDragEnd}
                    className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-move hover:ring-2 hover:ring-blue-500 transition-all"
                  >
                    <img
                      src={photo.url}
                      alt="Photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              {state.photos.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <ImageIcon size={48} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No photos uploaded yet</p>
                  <p className="text-xs mt-1">Click Upload Photos to add images</p>
                </div>
              )}
            </div>
          )}

          {/* COVERS TAB */}
          {state.activeTab === 'covers' && (
            <div className="p-4">
              <h2 className="text-lg font-bold mb-4">Cover Templates</h2>

              {['minimalist', 'travel', 'romantic', 'adventure'].map((category) => (
                <div key={category} className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3 flex items-center gap-2">
                    {category === 'minimalist' && <Grid size={16} />}
                    {category === 'travel' && <Plane size={16} />}
                    {category === 'romantic' && <Heart size={16} />}
                    {category === 'adventure' && <Mountain size={16} />}
                    {category}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {COVER_TEMPLATES.filter(t => t.category === category).map((template) => (
                      <button
                        key={template.id}
                        onClick={() => dispatch({ type: 'APPLY_COVER_TEMPLATE', templateId: template.id })}
                        className={`aspect-[5/7] rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                          currentPage.layoutId === template.id
                            ? 'border-blue-600 ring-2 ring-blue-300'
                            : 'border-gray-200 hover:border-blue-400'
                        }`}
                      >
                        {renderCoverPreview(template)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LAYOUTS TAB */}
          {state.activeTab === 'layouts' && (
            <div className="p-4">
              <h2 className="text-lg font-bold mb-4">Page Layouts</h2>

              {['single', 'double', 'triple', 'multi', 'text'].map((category) => {
                const layouts = TRAVEL_LAYOUTS.filter(l => l.category === category)
                if (layouts.length === 0) return null

                return (
                  <div key={category} className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">
                      {category === 'single' && 'Single Photo'}
                      {category === 'double' && 'Two Photos'}
                      {category === 'triple' && 'Three Photos'}
                      {category === 'multi' && 'Multiple Photos'}
                      {category === 'text' && 'Text Layouts'}
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {layouts.map((layout) => (
                        <button
                          key={layout.id}
                          onClick={() => dispatch({ type: 'CHANGE_PAGE_LAYOUT', pageIndex: state.currentPageIndex, layoutId: layout.id })}
                          className={`aspect-[4/5] rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                            currentPage.layoutId === layout.id
                              ? 'border-blue-600 ring-2 ring-blue-300'
                              : 'border-gray-200 hover:border-blue-400'
                          }`}
                        >
                          {renderLayoutPreview(layout)}
                          <div className="text-xs mt-1 text-gray-600">{layout.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TEXT TAB */}
          {state.activeTab === 'text' && (
            <div className="p-4">
              <h2 className="text-lg font-bold mb-4">Text Elements</h2>

              <button
                onClick={() => dispatch({ type: 'ADD_TEXT_BLOCK', pageIndex: state.currentPageIndex })}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium mb-4 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Add Text Block
              </button>

              <div className="space-y-3">
                {currentPage.textBlocks.map((tb, idx) => (
                  <div
                    key={tb.id}
                    onClick={() => dispatch({ type: 'SELECT_TEXT_BLOCK', textBlockId: tb.id })}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      state.selectedTextBlockId === tb.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium">Text Block {idx + 1}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatch({ type: 'REMOVE_TEXT_BLOCK', textBlockId: tb.id })
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div
                      className="text-xs text-gray-600 truncate"
                      style={{
                        fontFamily: tb.fontFamily,
                        fontWeight: tb.bold ? 'bold' : 'normal',
                        fontStyle: tb.italic ? 'italic' : 'normal'
                      }}
                    >
                      {tb.text || 'Empty text'}
                    </div>
                  </div>
                ))}
              </div>

              {currentPage.textBlocks.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Type size={48} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No text blocks yet</p>
                  <p className="text-xs mt-1">Click Add Text Block to start</p>
                </div>
              )}
            </div>
          )}

          {/* BACKGROUNDS TAB */}
          {state.activeTab === 'backgrounds' && (
            <div className="p-4">
              <h2 className="text-lg font-bold mb-4">Backgrounds</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Background Color
                </label>
                <input
                  type="color"
                  value={currentPage.bgColor}
                  onChange={(e) => dispatch({ type: 'SET_PAGE_BG_COLOR', pageIndex: state.currentPageIndex, color: e.target.value })}
                  className="w-full h-12 rounded-lg cursor-pointer"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preset Colors
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {['#ffffff', '#f9f6f2', '#fdf8f0', '#f0ebe3', '#1a1a1a', '#2c3e50', '#8b4513', '#1b4332', '#fff0f5', '#fff5f5', '#0d1b2a', '#f4e8d0'].map(color => (
                    <button
                      key={color}
                      onClick={() => dispatch({ type: 'SET_PAGE_BG_COLOR', pageIndex: state.currentPageIndex, color })}
                      className="aspect-square rounded-lg border-2 border-gray-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER - CANVAS AREA */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas toolbar */}
          <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center justify-center gap-4 px-4 flex-shrink-0">
            <button
              onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>

            <span className="text-sm font-medium w-16 text-center">{Math.round(zoom * 100)}%</span>

            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>

            <div className="h-6 w-px bg-gray-300" />

            <button
              onClick={() => setZoom(1)}
              className="text-sm px-3 py-1 hover:bg-gray-200 rounded transition-colors"
            >
              Fit
            </button>
          </div>

          {/* Canvas scroll area */}
          <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-8">
            <div
              ref={canvasRef}
              className="bg-white shadow-2xl relative"
              style={{
                width: `${560 * zoom}px`,
                height: `${792 * zoom}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'center',
                backgroundColor: currentPage.bgColor
              }}
              onClick={() => dispatch({ type: 'DESELECT_ALL' })}
            >
              {/* Background image if set */}
              {currentPage.bgImage && (
                <img
                  src={currentPage.bgImage}
                  alt="Background"
                  className="absolute inset-0 w-full h-full object-cover opacity-20"
                />
              )}

              {/* Photo slots */}
              {currentPage.slots.map((slot) => {
                const photo = slot.photoId ? state.photos.find(p => p.id === slot.photoId) : null
                const isSelected = state.selectedSlotId === slot.id

                return (
                  <div
                    key={slot.id}
                    onDragOver={handleSlotDragOver}
                    onDrop={(e) => handleSlotDrop(e, slot.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'SELECT_SLOT', slotId: slot.id })
                    }}
                    className={`absolute overflow-hidden cursor-pointer transition-all ${
                      isSelected ? 'ring-4 ring-blue-500' : 'ring-1 ring-gray-300'
                    }`}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.w}%`,
                      height: `${slot.h}%`,
                      backgroundColor: photo ? 'transparent' : '#f5f5f5'
                    }}
                  >
                    {photo ? (
                      <img
                        src={photo.url}
                        alt="Placed"
                        className="w-full h-full object-cover"
                        style={{
                          transform: `scale(${slot.scale}) translate(${slot.offsetX}px, ${slot.offsetY}px) rotate(${slot.rotation}deg)`,
                          filter: slot.filter !== 'none' ? slot.filter : 'none'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon size={32} />
                      </div>
                    )}

                    {isSelected && photo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatch({ type: 'REMOVE_PHOTO_FROM_SLOT', slotId: slot.id })
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Text blocks */}
              {currentPage.textBlocks.map((tb) => {
                const isSelected = state.selectedTextBlockId === tb.id

                return (
                  <div
                    key={tb.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'SELECT_TEXT_BLOCK', textBlockId: tb.id })
                    }}
                    className={`absolute cursor-text transition-all ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                    style={{
                      left: `${tb.x}%`,
                      top: `${tb.y}%`,
                      width: `${tb.w}%`,
                      minHeight: `${tb.h}%`
                    }}
                  >
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        dispatch({
                          type: 'UPDATE_TEXT_BLOCK',
                          textBlockId: tb.id,
                          updates: { text: e.currentTarget.textContent || '' }
                        })
                      }}
                      style={{
                        fontSize: `${tb.fontSize}px`,
                        fontFamily: tb.fontFamily,
                        color: tb.color,
                        textAlign: tb.align,
                        fontWeight: tb.bold ? 'bold' : 'normal',
                        fontStyle: tb.italic ? 'italic' : 'normal',
                        lineHeight: tb.lineHeight,
                        outline: 'none',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {tb.text}
                    </div>

                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatch({ type: 'REMOVE_TEXT_BLOCK', textBlockId: tb.id })
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Properties */}
        <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-4">
            <h2 className="text-lg font-bold mb-4">Properties</h2>

            {/* Photo slot properties */}
            {selectedSlot && selectedPhoto && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Photo Settings</h3>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Scale: {selectedSlot.scale.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={selectedSlot.scale}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_SLOT_TRANSFORM',
                      slotId: selectedSlot.id,
                      scale: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Rotation: {selectedSlot.rotation}°
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={selectedSlot.rotation}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_SLOT_TRANSFORM',
                      slotId: selectedSlot.id,
                      rotation: parseInt(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Filter
                  </label>
                  <select
                    value={selectedSlot.filter}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_SLOT_TRANSFORM',
                      slotId: selectedSlot.id,
                      filter: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="none">None</option>
                    <option value="grayscale(100%)">Grayscale</option>
                    <option value="sepia(100%)">Sepia</option>
                    <option value="brightness(1.2)">Bright</option>
                    <option value="brightness(0.8)">Dark</option>
                    <option value="contrast(1.3)">High Contrast</option>
                    <option value="saturate(1.5)">Vibrant</option>
                  </select>
                </div>

                <button
                  onClick={() => dispatch({ type: 'REMOVE_PHOTO_FROM_SLOT', slotId: selectedSlot.id })}
                  className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Remove Photo
                </button>
              </div>
            )}

            {/* Text block properties */}
            {selectedTextBlock && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Text Settings</h3>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Font Size: {selectedTextBlock.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="72"
                    value={selectedTextBlock.fontSize}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_TEXT_BLOCK',
                      textBlockId: selectedTextBlock.id,
                      updates: { fontSize: parseInt(e.target.value) }
                    })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Font Family
                  </label>
                  <select
                    value={selectedTextBlock.fontFamily}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_TEXT_BLOCK',
                      textBlockId: selectedTextBlock.id,
                      updates: { fontFamily: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="Montserrat">Montserrat</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="Cormorant">Cormorant</option>
                    <option value="Dancing Script">Dancing Script</option>
                    <option value="Oswald">Oswald</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Arial">Arial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    value={selectedTextBlock.color}
                    onChange={(e) => dispatch({
                      type: 'UPDATE_TEXT_BLOCK',
                      textBlockId: selectedTextBlock.id,
                      updates: { color: e.target.value }
                    })}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Alignment
                  </label>
                  <div className="flex gap-2">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => dispatch({
                          type: 'UPDATE_TEXT_BLOCK',
                          textBlockId: selectedTextBlock.id,
                          updates: { align }
                        })}
                        className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                          selectedTextBlock.align === align
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {align.charAt(0).toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => dispatch({
                      type: 'UPDATE_TEXT_BLOCK',
                      textBlockId: selectedTextBlock.id,
                      updates: { bold: !selectedTextBlock.bold }
                    })}
                    className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
                      selectedTextBlock.bold
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    B
                  </button>

                  <button
                    onClick={() => dispatch({
                      type: 'UPDATE_TEXT_BLOCK',
                      textBlockId: selectedTextBlock.id,
                      updates: { italic: !selectedTextBlock.italic }
                    })}
                    className={`flex-1 py-2 rounded text-sm italic transition-colors ${
                      selectedTextBlock.italic
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    I
                  </button>
                </div>

                <button
                  onClick={() => dispatch({ type: 'REMOVE_TEXT_BLOCK', textBlockId: selectedTextBlock.id })}
                  className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Remove Text
                </button>
              </div>
            )}

            {/* Page actions */}
            {!selectedSlot && !selectedTextBlock && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Page Actions</h3>

                <button
                  onClick={() => dispatch({ type: 'ADD_PAGE', afterIndex: state.currentPageIndex })}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Add Page
                </button>

                <button
                  onClick={() => dispatch({ type: 'DUPLICATE_PAGE', pageIndex: state.currentPageIndex })}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Copy size={14} />
                  Duplicate Page
                </button>

                <button
                  onClick={() => dispatch({ type: 'CLEAR_PAGE', pageIndex: state.currentPageIndex })}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Clear Page
                </button>

                {state.pages.length > 1 && (
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_PAGE', pageIndex: state.currentPageIndex })}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} />
                    Delete Page
                  </button>
                )}
              </div>
            )}

            {/* Help text */}
            {!selectedSlot && !selectedTextBlock && (
              <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
                <p className="font-semibold mb-1">Keyboard Shortcuts:</p>
                <ul className="space-y-1">
                  <li>Ctrl+Z: Undo</li>
                  <li>Ctrl+Y: Redo</li>
                  <li>Delete: Remove selected</li>
                  <li>Arrows: Navigate pages</li>
                  <li>Escape: Deselect</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM FILMSTRIP */}
      <div className="h-32 bg-white border-t border-gray-200 overflow-x-auto flex-shrink-0">
        <div className="h-full px-4 flex items-center gap-3">
          {state.pages.map((page, index) => (
            <div
              key={page.id}
              onClick={() => dispatch({ type: 'SELECT_PAGE', pageIndex: index })}
              className={`flex-shrink-0 cursor-pointer transition-all ${
                index === state.currentPageIndex
                  ? 'ring-4 ring-blue-500 scale-105'
                  : 'ring-1 ring-gray-300 hover:ring-blue-300'
              }`}
              style={{
                width: '70px',
                height: '99px',
                backgroundColor: page.bgColor
              }}
            >
              <div className="w-full h-full relative overflow-hidden">
                {/* Mini preview of slots */}
                {page.slots.map((slot) => {
                  const photo = slot.photoId ? state.photos.find(p => p.id === slot.photoId) : null
                  return (
                    <div
                      key={slot.id}
                      className="absolute"
                      style={{
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        width: `${slot.w}%`,
                        height: `${slot.h}%`,
                        backgroundColor: photo ? 'transparent' : '#e5e5e5'
                      }}
                    >
                      {photo && (
                        <img
                          src={photo.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  )
                })}

                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 text-center">
                  {index === 0 ? 'Cover' : `Page ${index}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {state.pages.map((page, index) => (
                <div key={page.id} className="border-2 border-gray-300 rounded-lg overflow-hidden">
                  <div
                    className="relative"
                    style={{
                      width: '560px',
                      height: '792px',
                      backgroundColor: page.bgColor,
                      margin: '0 auto'
                    }}
                  >
                    {page.slots.map((slot) => {
                      const photo = slot.photoId ? state.photos.find(p => p.id === slot.photoId) : null
                      return (
                        <div
                          key={slot.id}
                          className="absolute overflow-hidden"
                          style={{
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            width: `${slot.w}%`,
                            height: `${slot.h}%`
                          }}
                        >
                          {photo && (
                            <img
                              src={photo.url}
                              alt=""
                              className="w-full h-full object-cover"
                              style={{
                                transform: `scale(${slot.scale}) translate(${slot.offsetX}px, ${slot.offsetY}px) rotate(${slot.rotation}deg)`,
                                filter: slot.filter !== 'none' ? slot.filter : 'none'
                              }}
                            />
                          )}
                        </div>
                      )
                    })}

                    {page.textBlocks.map((tb) => (
                      <div
                        key={tb.id}
                        className="absolute"
                        style={{
                          left: `${tb.x}%`,
                          top: `${tb.y}%`,
                          width: `${tb.w}%`,
                          fontSize: `${tb.fontSize}px`,
                          fontFamily: tb.fontFamily,
                          color: tb.color,
                          textAlign: tb.align,
                          fontWeight: tb.bold ? 'bold' : 'normal',
                          fontStyle: tb.italic ? 'italic' : 'normal',
                          lineHeight: tb.lineHeight
                        }}
                      >
                        {tb.text}
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-100 px-4 py-2 text-sm text-gray-600 text-center">
                    {index === 0 ? 'Cover' : `Page ${index}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
