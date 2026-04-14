// Cover template presets — each template defines bg color, text blocks, and photo slot config
export type PhotoSlotDef = { x: number; y: number; w: number; h: number; shape: 'rect' | 'rounded' | 'circle' | 'heart' };

export interface CoverTemplate {
  id: string;
  label: string;
  group: string;
  tags?: string[]; // product type filter: 'photobook', 'magazine', 'travelbook', 'journal' — empty = all
  bgColor: string;
  photoSlot: PhotoSlotDef;          // primary slot (legacy)
  photoSlots?: PhotoSlotDef[];       // multi-slot override — if set, used instead of photoSlot
  texts: {
    text: string;
    x: number; // % from left
    y: number; // % from top
    fontSize: number;
    fontFamily: string;
    color: string;
    bold: boolean;
  }[];
  overlay?: { type: 'none' | 'color' | 'gradient'; color: string; opacity: number; gradient: string };
}

export const COVER_TEMPLATES: CoverTemplate[] = [
  // ── Мінімалістичні ──
  {
    id: 'minimal-classic',
    label: 'Класика',
    group: 'Мінімалістичні',
    bgColor: '#ffffff',
    photoSlot: { x: 15, y: 35, w: 70, h: 40, shape: 'rect' },
    texts: [
      { text: 'Наша історія', x: 50, y: 12, fontSize: 28, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: 'Імʼя ♥ Імʼя', x: 50, y: 24, fontSize: 42, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: '01.01.2025', x: 50, y: 85, fontSize: 24, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
    ],
  },
  {
    id: 'minimal-proposal',
    label: 'Пропозиція',
    group: 'Мінімалістичні',
    bgColor: '#ffffff',
    photoSlot: { x: 20, y: 42, w: 60, h: 30, shape: 'rect' },
    texts: [
      { text: 'Proposal in Paris', x: 50, y: 10, fontSize: 26, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: 'Ivan ♥ Anhelina', x: 50, y: 25, fontSize: 40, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: '08.10.2023', x: 50, y: 88, fontSize: 26, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
    ],
  },
  {
    id: 'minimal-names-only',
    label: 'Тільки імена',
    group: 'Мінімалістичні',
    bgColor: '#faf9f6',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    texts: [
      { text: 'Олег & Марія', x: 50, y: 50, fontSize: 48, fontFamily: 'Cormorant Garamond', color: '#2c2c2c', bold: false },
    ],
  },
  {
    id: 'minimal-date-center',
    label: 'Дата по центру',
    group: 'Мінімалістичні',
    bgColor: '#ffffff',
    photoSlot: { x: 10, y: 10, w: 80, h: 55, shape: 'rounded' },
    texts: [
      { text: 'Наше весілля', x: 50, y: 72, fontSize: 32, fontFamily: 'Playfair Display', color: '#333333', bold: false },
      { text: '15 серпня 2025', x: 50, y: 84, fontSize: 20, fontFamily: 'Cormorant Garamond', color: '#666666', bold: false },
    ],
  },
  {
    id: 'minimal-serif',
    label: 'Serif елегант',
    group: 'Мінімалістичні',
    bgColor: '#f5f0eb',
    photoSlot: { x: 15, y: 30, w: 70, h: 45, shape: 'rect' },
    texts: [
      { text: 'ВЕСІЛЛЯ', x: 50, y: 10, fontSize: 14, fontFamily: 'Montserrat', color: '#8a7968', bold: true },
      { text: 'Андрій та Катерина', x: 50, y: 18, fontSize: 30, fontFamily: 'Playfair Display', color: '#3d3429', bold: false },
      { text: '2025', x: 50, y: 88, fontSize: 20, fontFamily: 'Montserrat', color: '#8a7968', bold: false },
    ],
  },

  // ── Елегантні ──
  {
    id: 'elegant-dark',
    label: 'Темний елегант',
    group: 'Елегантні',
    bgColor: '#1a1a2e',
    photoSlot: { x: 15, y: 25, w: 70, h: 45, shape: 'rect' },
    texts: [
      { text: 'Наша історія кохання', x: 50, y: 10, fontSize: 22, fontFamily: 'Cormorant Garamond', color: '#d4af37', bold: false },
      { text: '12.06.2025', x: 50, y: 80, fontSize: 18, fontFamily: 'Montserrat', color: '#c0b283', bold: false },
    ],
  },
  {
    id: 'elegant-burgundy',
    label: 'Бордо',
    group: 'Елегантні',
    bgColor: '#5c1a1a',
    photoSlot: { x: 10, y: 20, w: 80, h: 50, shape: 'rounded' },
    texts: [
      { text: 'Олександр & Вікторія', x: 50, y: 8, fontSize: 28, fontFamily: 'Great Vibes', color: '#f0d9b5', bold: false },
      { text: 'Осінь 2025', x: 50, y: 80, fontSize: 20, fontFamily: 'Cormorant Garamond', color: '#e8d5b7', bold: false },
    ],
  },
  {
    id: 'elegant-forest',
    label: 'Ліс',
    group: 'Елегантні',
    bgColor: '#2d3b2d',
    photoSlot: { x: 12, y: 22, w: 76, h: 48, shape: 'rect' },
    texts: [
      { text: 'Наше весілля', x: 50, y: 8, fontSize: 26, fontFamily: 'Playfair Display', color: '#c8b88a', bold: false },
      { text: 'ДМИТРО & АННА', x: 50, y: 78, fontSize: 16, fontFamily: 'Montserrat', color: '#c8b88a', bold: true },
      { text: '2025', x: 50, y: 88, fontSize: 14, fontFamily: 'Montserrat', color: '#a09070', bold: false },
    ],
  },
  {
    id: 'elegant-navy',
    label: 'Темно-синій',
    group: 'Елегантні',
    bgColor: '#1e2d4d',
    photoSlot: { x: 15, y: 20, w: 70, h: 50, shape: 'rounded' },
    texts: [
      { text: 'Подорож до мрії', x: 50, y: 8, fontSize: 24, fontFamily: 'Dancing Script', color: '#e8d5b7', bold: false },
      { text: '2025', x: 50, y: 82, fontSize: 28, fontFamily: 'Playfair Display', color: '#c8a96e', bold: false },
    ],
  },

  // ── Фото на весь фон ──
  {
    id: 'fullphoto-simple',
    label: 'Фото + підпис',
    group: 'Фото на весь фон',
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 50, gradient: 'linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.7) 100%)' },
    texts: [
      { text: 'Наша сімʼя', x: 50, y: 82, fontSize: 36, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: '2025', x: 50, y: 92, fontSize: 16, fontFamily: 'Montserrat', color: '#e0e0e0', bold: false },
    ],
  },
  {
    id: 'fullphoto-center-text',
    label: 'Фото + центр',
    group: 'Фото на весь фон',
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'color', color: '#000000', opacity: 35, gradient: '' },
    texts: [
      { text: 'НАШІ СПОГАДИ', x: 50, y: 42, fontSize: 14, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'Імʼя & Імʼя', x: 50, y: 52, fontSize: 38, fontFamily: 'Great Vibes', color: '#ffffff', bold: false },
      { text: '2025', x: 50, y: 64, fontSize: 18, fontFamily: 'Montserrat', color: '#dddddd', bold: false },
    ],
  },
  {
    id: 'fullphoto-top-text',
    label: 'Фото + верх',
    group: 'Фото на весь фон',
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 60, gradient: 'linear-gradient(0deg,transparent 50%,rgba(0,0,0,0.6) 100%)' },
    texts: [
      { text: 'Подорож мрії', x: 50, y: 12, fontSize: 32, fontFamily: 'Dancing Script', color: '#ffffff', bold: false },
      { text: 'Балі • 2025', x: 50, y: 22, fontSize: 16, fontFamily: 'Montserrat', color: '#e0e0e0', bold: false },
    ],
  },

  // ── Дитячі ──
  {
    id: 'kids-first-year',
    label: 'Перший рік',
    group: 'Дитячі',
    bgColor: '#fef9f0',
    photoSlot: { x: 20, y: 30, w: 60, h: 40, shape: 'circle' },
    texts: [
      { text: 'Мій перший рік', x: 50, y: 10, fontSize: 28, fontFamily: 'Caveat', color: '#c09060', bold: false },
      { text: 'Софійка', x: 50, y: 22, fontSize: 36, fontFamily: 'Lobster', color: '#d4956b', bold: false },
      { text: '2024 – 2025', x: 50, y: 82, fontSize: 18, fontFamily: 'Caveat', color: '#c09060', bold: false },
    ],
  },
  {
    id: 'kids-pastel',
    label: 'Пастель',
    group: 'Дитячі',
    bgColor: '#f0e6f6',
    photoSlot: { x: 15, y: 25, w: 70, h: 45, shape: 'rounded' },
    texts: [
      { text: 'Наше маленьке диво', x: 50, y: 10, fontSize: 24, fontFamily: 'Comfortaa', color: '#7b5ea7', bold: false },
      { text: '♡', x: 50, y: 80, fontSize: 28, fontFamily: 'Inter', color: '#c9a0dc', bold: false },
    ],
  },

  // ── З референсів Діани ──
  {
    id: 'ref-wedding-moments',
    label: 'Wedding Moments',
    group: 'Елегантні',
    bgColor: '#ffffff',
    photoSlot: { x: 20, y: 8, w: 60, h: 52, shape: 'rect' },
    texts: [
      { text: 'WEDDING', x: 50, y: 68, fontSize: 22, fontFamily: 'Cormorant Garamond', color: '#9e9e9e', bold: false },
      { text: 'moments', x: 50, y: 78, fontSize: 30, fontFamily: 'Dancing Script', color: '#9e9e9e', bold: false },
      { text: '15.06.2024', x: 50, y: 90, fontSize: 16, fontFamily: 'Cormorant Garamond', color: '#bdbdbd', bold: false },
    ],
  },
  {
    id: 'ref-we',
    label: 'WE.',
    group: 'Мінімалістичні',
    bgColor: '#ffffff',
    photoSlot: { x: 7, y: 5, w: 86, h: 82, shape: 'rect' },
    texts: [
      { text: 'WE.', x: 62, y: 88, fontSize: 52, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
    ],
  },
  {
    id: 'ref-nashi-spohady',
    label: 'Наші спогади',
    group: 'Мінімалістичні',
    bgColor: '#4ec8c8',
    photoSlot: { x: 35, y: 55, w: 30, h: 30, shape: 'rect' },
    texts: [
      { text: 'Наші спогади', x: 50, y: 38, fontSize: 36, fontFamily: 'Dancing Script', color: '#ffffff', bold: false },
    ],
  },
  {
    id: 'ref-family-memories',
    label: 'Family Memories',
    group: 'Фото на весь фон',
    bgColor: '#ffffff',
    photoSlot: { x: 25, y: 0, w: 75, h: 100, shape: 'rect' },
    overlay: { type: 'none' as const, color: '#000000', opacity: 0, gradient: '' },
    texts: [
      { text: '2025', x: 14, y: 78, fontSize: 52, fontFamily: 'Cormorant Garamond', color: '#8a7a50', bold: false },
      { text: 'THE FAMILY MEMORIES', x: 14, y: 90, fontSize: 11, fontFamily: 'Montserrat', color: '#8a7a50', bold: false },
    ],
  },

  {
    id: 'ref-heart-photo',
    label: 'Серце з фото',
    group: 'Мінімалістичні',
    bgColor: '#ffffff',
    photoSlot: { x: 10, y: 8, w: 80, h: 72, shape: 'heart' },
    texts: [
      { text: 'ІМʼЯ & ІМʼЯ', x: 50, y: 86, fontSize: 28, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: '19.11.2025', x: 50, y: 94, fontSize: 16, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
    ],
  },
  {
    id: 'ref-our-wedding-day',
    label: 'Our Wedding Day',
    group: 'Елегантні',
    bgColor: '#f2d5c0',
    photoSlot: { x: 50, y: 50, w: 0, h: 0, shape: 'rect' },
    texts: [
      { text: 'OUR', x: 50, y: 42, fontSize: 16, fontFamily: 'Cormorant Garamond', color: '#b8966a', bold: false },
      { text: 'wedding', x: 50, y: 54, fontSize: 40, fontFamily: 'Dancing Script', color: '#b8966a', bold: false },
      { text: 'DAY', x: 50, y: 63, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#b8966a', bold: false },
      { text: '04.10.2025', x: 50, y: 88, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#b8966a', bold: false },
    ],
  },

  {
    id: 'ref-baby-newborn',
    label: 'Новонароджений',
    group: 'Дитячі',
    bgColor: '#ffffff',
    // Primary slot = slot[0] top-left
    photoSlot: { x: 2, y: 2, w: 35, h: 37, shape: 'rect' },
    // All 6 slots: top row (4 equal) + bottom row (2 wide)
    photoSlots: [
      { x: 2,  y: 2,  w: 23, h: 37, shape: 'rect' }, // top 1
      { x: 27, y: 2,  w: 23, h: 37, shape: 'rect' }, // top 2
      { x: 52, y: 2,  w: 23, h: 37, shape: 'rect' }, // top 3
      { x: 77, y: 2,  w: 21, h: 37, shape: 'rect' }, // top 4
      { x: 2,  y: 41, w: 48, h: 32, shape: 'rect' }, // bottom left (wide)
      { x: 52, y: 41, w: 46, h: 32, shape: 'rect' }, // bottom right (wide)
    ],
    texts: [
      { text: 'Аделіночка', x: 50, y: 80, fontSize: 36, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: '20.10.2025 · 16:57', x: 50, y: 89, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#777777', bold: false },
      { text: '3320 г · 53 см', x: 50, y: 95, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#777777', bold: false },
    ],
  },

  {
    id: 'ref-wedding-magazine',
    label: 'WEDDING Magazine',
    group: 'Елегантні',
    bgColor: '#ffffff',
    photoSlot: { x: 20, y: 14, w: 60, h: 58, shape: 'rect' },
    texts: [
      { text: 'WEDDING', x: 50, y: 10, fontSize: 56, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'Імʼя та Імʼя', x: 50, y: 80, fontSize: 28, fontFamily: 'Cormorant Garamond', color: '#1a1a1a', bold: false },
      { text: '05/08/2025', x: 50, y: 88, fontSize: 18, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
    ],
  },
  {
    id: 'ref-wedding-3col',
    label: 'Три фото в ряд',
    group: 'Елегантні',
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 22, w: 34, h: 52, shape: 'rect' },
    photoSlots: [
      { x: 0,  y: 22, w: 34, h: 52, shape: 'rect' },
      { x: 35, y: 14, w: 30, h: 60, shape: 'rect' },
      { x: 66, y: 22, w: 34, h: 52, shape: 'rect' },
    ],
    texts: [
      { text: 'Імʼя & Імʼя', x: 50, y: 82, fontSize: 30, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: 'WEDDING DAY', x: 50, y: 90, fontSize: 13, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: '20.09.2025', x: 50, y: 95, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
    ],
  },

  // ── Подорожі ──
  {
    id: 'travel-adventure',
    label: 'Пригоди',
    group: 'Подорожі',
    bgColor: '#f5f0e8',
    photoSlot: { x: 10, y: 25, w: 80, h: 50, shape: 'rect' },
    texts: [
      { text: 'НАШІ ПРИГОДИ', x: 50, y: 8, fontSize: 16, fontFamily: 'Montserrat', color: '#5c4a32', bold: true },
      { text: '2025', x: 50, y: 85, fontSize: 32, fontFamily: 'Playfair Display', color: '#5c4a32', bold: false },
    ],
  },
  {
    id: 'travel-country',
    label: 'Країна',
    group: 'Подорожі',
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 70, shape: 'rect' },
    texts: [
      { text: 'CAMBODIA', x: 50, y: 80, fontSize: 28, fontFamily: 'Bebas Neue', color: '#2c2c2c', bold: false },
      { text: '2025', x: 50, y: 90, fontSize: 16, fontFamily: 'Montserrat', color: '#888888', bold: false },
    ],
  },

  // ── Журнали (Magazine) ──
  {
    id: 'mag-editorial',
    label: 'Editorial',
    group: 'Журнали',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 50, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.5) 0%,transparent 30%,transparent 60%,rgba(0,0,0,0.6) 100%)' },
    texts: [
      { text: 'MOMENTS', x: 45, y: 8, fontSize: 32, fontFamily: 'Playfair Display', color: '#ffffff', bold: true },
      { text: 'Імʼя та Імʼя', x: 50, y: 88, fontSize: 22, fontFamily: 'Cormorant Garamond', color: '#ffffff', bold: false },
      { text: '15.06.2025', x: 50, y: 95, fontSize: 12, fontFamily: 'Montserrat', color: '#dddddd', bold: false },
    ],
  },
  {
    id: 'mag-vogue',
    label: 'Glamour Style',
    group: 'Журнали',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 40, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.6) 0%,transparent 25%,transparent 75%,rgba(0,0,0,0.4) 100%)' },
    texts: [
      { text: 'OUR', x: 50, y: 6, fontSize: 14, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'WEDDING', x: 45, y: 14, fontSize: 32, fontFamily: 'Playfair Display', color: '#ffffff', bold: true },
      { text: 'DAY', x: 50, y: 22, fontSize: 14, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: '05 / 08 / 2025', x: 50, y: 92, fontSize: 14, fontFamily: 'Montserrat', color: '#e0e0e0', bold: false },
    ],
  },
  {
    id: 'mag-minimal-title',
    label: 'Мінімалізм',
    group: 'Журнали',
    tags: ['magazine', 'journal'],
    bgColor: '#f5f0eb',
    photoSlot: { x: 0, y: 20, w: 100, h: 65, shape: 'rect' },
    texts: [
      { text: 'НАША ІСТОРІЯ', x: 50, y: 8, fontSize: 14, fontFamily: 'Montserrat', color: '#8a7968', bold: true },
      { text: '2025', x: 50, y: 92, fontSize: 20, fontFamily: 'Playfair Display', color: '#8a7968', bold: false },
    ],
  },
  {
    id: 'mag-portrait',
    label: 'Портрет',
    group: 'Журнали',
    tags: ['magazine', 'journal'],
    bgColor: '#1a1a1a',
    photoSlot: { x: 10, y: 5, w: 80, h: 70, shape: 'rect' },
    overlay: { type: 'none' as const, color: '#000000', opacity: 0, gradient: '' },
    texts: [
      { text: 'FAMILY', x: 45, y: 82, fontSize: 32, fontFamily: 'Playfair Display', color: '#d4af37', bold: true },
      { text: 'portrait', x: 50, y: 90, fontSize: 20, fontFamily: 'Dancing Script', color: '#c0a060', bold: false },
      { text: '2025', x: 50, y: 95, fontSize: 11, fontFamily: 'Montserrat', color: '#888888', bold: false },
    ],
  },
  {
    id: 'mag-split',
    label: '2 фото',
    group: 'Журнали',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 50, h: 100, shape: 'rect' },
    photoSlots: [
      { x: 0, y: 0, w: 50, h: 100, shape: 'rect' },
      { x: 52, y: 0, w: 48, h: 100, shape: 'rect' },
    ],
    texts: [
      { text: 'OUR STORY', x: 50, y: 50, fontSize: 18, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
    ],
  },
  {
    id: 'mag-baby',
    label: 'Перший рік',
    group: 'Журнали',
    tags: ['magazine', 'journal'],
    bgColor: '#fef9f0',
    photoSlot: { x: 15, y: 10, w: 70, h: 55, shape: 'rounded' },
    texts: [
      { text: 'Мій перший рік', x: 45, y: 72, fontSize: 28, fontFamily: 'Caveat', color: '#c09060', bold: false },
      { text: 'Софійка', x: 45, y: 82, fontSize: 32, fontFamily: 'Lobster', color: '#d4956b', bold: false },
      { text: '2024 – 2025', x: 50, y: 92, fontSize: 14, fontFamily: 'Caveat', color: '#c09060', bold: false },
    ],
  },
  {
    id: 'mag-wedding-classic',
    label: 'Весілля класика',
    group: 'Журнали — Весільні',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 45, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.4) 0%,transparent 25%,transparent 70%,rgba(0,0,0,0.5) 100%)' },
    texts: [
      { text: 'Імʼя & Імʼя', x: 45, y: 10, fontSize: 32, fontFamily: 'Great Vibes', color: '#ffffff', bold: false },
      { text: 'WEDDING DAY', x: 50, y: 90, fontSize: 14, fontFamily: 'Montserrat', color: '#e0e0e0', bold: true },
      { text: '15.06.2025', x: 50, y: 95, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#cccccc', bold: false },
    ],
  },
  {
    id: 'mag-wedding-gold',
    label: 'Весілля золото',
    group: 'Журнали — Весільні',
    tags: ['magazine', 'journal'],
    bgColor: '#1a1a2e',
    photoSlot: { x: 10, y: 15, w: 80, h: 55, shape: 'rect' },
    texts: [
      { text: 'OUR WEDDING', x: 50, y: 6, fontSize: 16, fontFamily: 'Montserrat', color: '#d4af37', bold: true },
      { text: 'Імʼя та Імʼя', x: 45, y: 78, fontSize: 28, fontFamily: 'Great Vibes', color: '#d4af37', bold: false },
      { text: '2025', x: 50, y: 90, fontSize: 18, fontFamily: 'Playfair Display', color: '#c0a060', bold: false },
    ],
  },
  {
    id: 'mag-wedding-blush',
    label: 'Весілля рожевий',
    group: 'Журнали — Весільні',
    tags: ['magazine', 'journal'],
    bgColor: '#fdf2f0',
    photoSlot: { x: 5, y: 5, w: 90, h: 60, shape: 'rounded' },
    texts: [
      { text: 'Love Story', x: 45, y: 72, fontSize: 32, fontFamily: 'Dancing Script', color: '#c07080', bold: false },
      { text: 'Імʼя & Імʼя', x: 50, y: 84, fontSize: 20, fontFamily: 'Cormorant Garamond', color: '#9a6070', bold: false },
      { text: '2025', x: 50, y: 94, fontSize: 14, fontFamily: 'Montserrat', color: '#b08090', bold: false },
    ],
  },
  {
    id: 'mag-wedding-3photo',
    label: 'Весілля 3 фото',
    group: 'Журнали — Весільні',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 15, w: 34, h: 55, shape: 'rect' },
    photoSlots: [
      { x: 0, y: 15, w: 34, h: 55, shape: 'rect' },
      { x: 35, y: 8, w: 30, h: 62, shape: 'rect' },
      { x: 66, y: 15, w: 34, h: 55, shape: 'rect' },
    ],
    texts: [
      { text: 'НАШЕ ВЕСІЛЛЯ', x: 50, y: 5, fontSize: 14, fontFamily: 'Montserrat', color: '#333333', bold: true },
      { text: 'Імʼя та Імʼя', x: 45, y: 82, fontSize: 26, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: '2025', x: 50, y: 92, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#888888', bold: false },
    ],
  },
  {
    id: 'mag-family-warm',
    label: 'Сімейний теплий',
    group: 'Журнали — Сімейні',
    tags: ['magazine', 'journal'],
    bgColor: '#f5f0e8',
    photoSlot: { x: 0, y: 0, w: 100, h: 72, shape: 'rect' },
    texts: [
      { text: 'НАША СІМʼЯ', x: 50, y: 80, fontSize: 22, fontFamily: 'Playfair Display', color: '#5c4a32', bold: true },
      { text: '2025', x: 45, y: 90, fontSize: 28, fontFamily: 'Playfair Display', color: '#8a7968', bold: false },
    ],
  },
  {
    id: 'mag-family-modern',
    label: 'Сімейний модерн',
    group: 'Журнали — Сімейні',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'color', color: '#000000', opacity: 30, gradient: '' },
    texts: [
      { text: 'THE', x: 50, y: 38, fontSize: 14, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'Family', x: 45, y: 50, fontSize: 32, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: 'MEMORIES', x: 50, y: 62, fontSize: 14, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
    ],
  },
  {
    id: 'mag-travel-journal',
    label: 'Travel Journal',
    group: 'Журнали — Подорожі',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 50, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.5) 0%,transparent 30%,transparent 65%,rgba(0,0,0,0.4) 100%)' },
    texts: [
      { text: 'TRAVEL', x: 45, y: 8, fontSize: 32, fontFamily: 'Playfair Display', color: '#ffffff', bold: true },
      { text: 'journal', x: 50, y: 17, fontSize: 20, fontFamily: 'Dancing Script', color: '#e0e0e0', bold: false },
      { text: 'Країна • 2025', x: 50, y: 92, fontSize: 14, fontFamily: 'Montserrat', color: '#dddddd', bold: false },
    ],
  },
  {
    id: 'mag-travel-passport',
    label: 'Passport Style',
    group: 'Журнали — Подорожі',
    tags: ['magazine', 'journal'],
    bgColor: '#1e3a5f',
    photoSlot: { x: 15, y: 20, w: 70, h: 45, shape: 'rounded' },
    texts: [
      { text: 'OUR ADVENTURES', x: 50, y: 8, fontSize: 14, fontFamily: 'Montserrat', color: '#d4af37', bold: true },
      { text: '2025', x: 45, y: 75, fontSize: 32, fontFamily: 'Playfair Display', color: '#d4af37', bold: false },
      { text: 'Назва країни', x: 50, y: 88, fontSize: 16, fontFamily: 'Cormorant Garamond', color: '#c0b888', bold: false },
    ],
  },
  {
    id: 'mag-baby-pastel',
    label: 'Малюк пастель',
    group: 'Журнали — Дитячі',
    tags: ['magazine', 'journal'],
    bgColor: '#f0e6f6',
    photoSlot: { x: 20, y: 10, w: 60, h: 50, shape: 'circle' },
    texts: [
      { text: 'Наше маленьке', x: 50, y: 68, fontSize: 20, fontFamily: 'Comfortaa', color: '#7b5ea7', bold: false },
      { text: 'ДИВО', x: 45, y: 78, fontSize: 28, fontFamily: 'Playfair Display', color: '#7b5ea7', bold: true },
      { text: '♡', x: 45, y: 90, fontSize: 24, fontFamily: 'Inter', color: '#c9a0dc', bold: false },
    ],
  },
  {
    id: 'mag-baby-birth',
    label: 'Народження',
    group: 'Журнали — Дитячі',
    tags: ['magazine', 'journal'],
    bgColor: '#fef9f0',
    photoSlot: { x: 10, y: 5, w: 80, h: 55, shape: 'rounded' },
    texts: [
      { text: 'Імʼя', x: 45, y: 68, fontSize: 32, fontFamily: 'Dancing Script', color: '#c09060', bold: false },
      { text: '20.10.2025', x: 50, y: 80, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#a08060', bold: false },
      { text: '3320 г · 53 см', x: 50, y: 88, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#b0a080', bold: false },
    ],
  },
  {
    id: 'mag-graduation',
    label: 'Випускний',
    group: 'Журнали — Особливі',
    tags: ['magazine', 'journal'],
    bgColor: '#1a1a2e',
    photoSlot: { x: 10, y: 10, w: 80, h: 58, shape: 'rect' },
    texts: [
      { text: 'ВИПУСКНИЙ', x: 50, y: 76, fontSize: 20, fontFamily: 'Montserrat', color: '#d4af37', bold: true },
      { text: '2025', x: 45, y: 88, fontSize: 32, fontFamily: 'Playfair Display', color: '#d4af37', bold: false },
    ],
  },
  // ── Журнальні обкладинки (стиль глянцевих журналів) ──
  {
    id: 'mag-model-birthday',
    label: 'Birthday Edition',
    group: 'Журнали — День народження',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 25, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.15) 0%,transparent 20%,transparent 75%,rgba(0,0,0,0.3) 100%)' },
    texts: [
      { text: 'MODEL', x: 45, y: 8, fontSize: 38, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: 'BIRTHDAY', x: 35, y: 22, fontSize: 32, fontFamily: 'Playfair Display', color: '#d4a530', bold: true },
      { text: 'HAPPY BIRTHDAY', x: 28, y: 35, fontSize: 20, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: '2026', x: 18, y: 82, fontSize: 32, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: false },
      { text: 'glow up', x: 20, y: 90, fontSize: 24, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: 'EXCLUSIVE MAGAZINE', x: 72, y: 95, fontSize: 10, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
    ],
  },
  {
    id: 'mag-boss',
    label: 'BOSS',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'none' as const, color: '#000000', opacity: 0, gradient: '' },
    texts: [
      { text: 'BOSS', x: 45, y: 10, fontSize: 42, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
    ],
  },
  {
    id: 'mag-enjoy-life',
    label: 'ENJOY LIFE',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 20, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.1) 0%,transparent 25%,transparent 80%,rgba(0,0,0,0.25) 100%)' },
    texts: [
      { text: 'ENJOY LIFE', x: 45, y: 10, fontSize: 32, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: 'EXCLUSIVE MAGAZINE', x: 72, y: 95, fontSize: 9, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
    ],
  },
  {
    id: 'mag-love-story',
    label: 'LOVE Story',
    group: 'Журнали — Весільні',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 15, w: 100, h: 85, shape: 'rect' },
    overlay: { type: 'gradient', color: '#ffffff', opacity: 80, gradient: 'linear-gradient(180deg,rgba(255,255,255,0.95) 0%,rgba(255,255,255,0.3) 25%,transparent 50%)' },
    texts: [
      { text: 'LOVE', x: 40, y: 10, fontSize: 42, fontFamily: 'Playfair Display', color: '#c02030', bold: true },
      { text: 'story', x: 55, y: 22, fontSize: 32, fontFamily: 'Dancing Script', color: '#c02030', bold: false },
      { text: 'IRYNA & ARTEM', x: 50, y: 32, fontSize: 16, fontFamily: 'Montserrat', color: '#333333', bold: true },
      { text: 'EXCLUSIVE MAGAZINE', x: 25, y: 95, fontSize: 9, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
      { text: '12.05.2024', x: 70, y: 95, fontSize: 12, fontFamily: 'Dancing Script', color: '#ffffff', bold: false },
    ],
  },
  {
    id: 'mag-birthday-special',
    label: 'Birthday Special',
    group: 'Журнали — День народження',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 35, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.5) 0%,transparent 22%,transparent 75%,rgba(0,0,0,0.2) 100%)' },
    texts: [
      { text: 'MAGAZINE SPECIAL EDITION', x: 50, y: 5, fontSize: 10, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
      { text: 'BIRTHDAY', x: 45, y: 14, fontSize: 38, fontFamily: 'Playfair Display', color: '#ffffff', bold: true },
      { text: 'HAPPY 20TH BIRTHDAY', x: 25, y: 65, fontSize: 18, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'THE BEST DAY', x: 62, y: 88, fontSize: 20, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
    ],
  },
  {
    id: 'mag-vogue-dark',
    label: 'Dark Glamour',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#0a0a0a',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 30, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.4) 0%,transparent 25%,transparent 80%,rgba(0,0,0,0.5) 100%)' },
    texts: [
      { text: 'GLAMOUR', x: 45, y: 8, fontSize: 38, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: 'Імʼя', x: 45, y: 88, fontSize: 24, fontFamily: 'Cormorant Garamond', color: '#d4af37', bold: false },
      { text: 'EXCLUSIVE EDITION', x: 50, y: 95, fontSize: 10, fontFamily: 'Montserrat', color: '#888888', bold: true },
    ],
  },
  {
    id: 'mag-style-minimal',
    label: 'Style Minimal',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 15, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.2) 0%,transparent 20%,transparent 85%,rgba(0,0,0,0.15) 100%)' },
    texts: [
      { text: 'STYLE', x: 45, y: 8, fontSize: 38, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: 'MAGAZINE', x: 50, y: 95, fontSize: 38, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
    ],
  },
  {
    id: 'mag-her-story',
    label: 'Her Story',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 30, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.35) 0%,transparent 30%,transparent 70%,rgba(0,0,0,0.4) 100%)' },
    texts: [
      { text: 'HER', x: 45, y: 6, fontSize: 32, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: 'STORY', x: 45, y: 15, fontSize: 28, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'Імʼя', x: 50, y: 90, fontSize: 22, fontFamily: 'Great Vibes', color: '#ffffff', bold: false },
      { text: 'MAGAZINE • 2025', x: 50, y: 95, fontSize: 9, fontFamily: 'Montserrat', color: '#cccccc', bold: false },
    ],
  },
  {
    id: 'mag-fashion-full',
    label: 'FASHION',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 35, gradient: 'linear-gradient(180deg,transparent 0%,transparent 65%,rgba(0,0,0,0.6) 100%)' },
    texts: [
      { text: 'FASHION', x: 45, y: 8, fontSize: 38, fontFamily: 'Playfair Display', color: '#ffffff', bold: true },
      { text: 'MOST STYLISH GIRL', x: 22, y: 18, fontSize: 10, fontFamily: 'Montserrat', color: '#d4af37', bold: false },
      { text: 'APR 2026', x: 18, y: 22, fontSize: 10, fontFamily: 'Montserrat', color: '#d4af37', bold: false },
      { text: 'Імʼя', x: 25, y: 50, fontSize: 24, fontFamily: 'Playfair Display', color: '#d4af37', bold: false },
      { text: 'NEVER GIVE UP', x: 42, y: 85, fontSize: 28, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'EXCLUSIVE MAGAZINE', x: 50, y: 95, fontSize: 8, fontFamily: 'Montserrat', color: '#d4af37', bold: false },
    ],
  },
  {
    id: 'mag-beauty-code',
    label: 'BEAUTY CODE',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#3d2b1f',
    photoSlot: { x: 0, y: 0, w: 65, h: 93, shape: 'rect' },
    texts: [
      { text: 'BEAUTY CODE', x: 65, y: 50, fontSize: 28, fontFamily: 'Playfair Display', color: '#f5f0e8', bold: false },
      { text: 'PROFESSIONAL FASHION MODEL', x: 22, y: 95, fontSize: 7, fontFamily: 'Montserrat', color: '#c0b0a0', bold: false },
      { text: 'EXCLUSIVE MAGAZINE', x: 72, y: 95, fontSize: 7, fontFamily: 'Montserrat', color: '#c0b0a0', bold: false },
    ],
  },
  {
    id: 'mag-birthday-frame',
    label: 'Birthday Frame',
    group: 'Журнали — День народження',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 2, y: 2, w: 96, h: 96, shape: 'rect' },
    overlay: { type: 'none' as const, color: '#000000', opacity: 0, gradient: '' },
    texts: [
      { text: 'BIRTHDAY', x: 45, y: 10, fontSize: 38, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: 'до 40', x: 63, y: 28, fontSize: 28, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'ВИПУСКУ', x: 68, y: 34, fontSize: 12, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
      { text: 'EXCLUSIVE MAGAZINE', x: 72, y: 95, fontSize: 7, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
    ],
  },
  {
    id: 'mag-your-era',
    label: 'YOUR ERA',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 15, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.15) 0%,transparent 20%,transparent 85%,rgba(0,0,0,0.1) 100%)' },
    texts: [
      { text: 'YOUR ERA', x: 45, y: 8, fontSize: 36, fontFamily: 'Playfair Display', color: '#8b1a1a', bold: false },
      { text: 'PROFESSIONAL FASHION MODEL', x: 22, y: 95, fontSize: 7, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
      { text: 'EXCLUSIVE MAGAZINE', x: 72, y: 95, fontSize: 7, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
    ],
  },
  {
    id: 'mag-name-only',
    label: 'Тільки імʼя',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'none' as const, color: '#000000', opacity: 0, gradient: '' },
    texts: [
      { text: 'ІМʼЯ', x: 45, y: 10, fontSize: 32, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: 'PROFESSIONAL FASHION MODEL', x: 22, y: 95, fontSize: 7, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
      { text: 'EXCLUSIVE MAGAZINE', x: 72, y: 95, fontSize: 7, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
    ],
  },
  {
    id: 'mag-ukrainian',
    label: 'UKRAINIAN',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 10, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.1) 0%,transparent 15%,transparent 90%,rgba(0,0,0,0.1) 100%)' },
    texts: [
      { text: 'UKRAINIAN', x: 45, y: 8, fontSize: 32, fontFamily: 'Playfair Display', color: '#e06030', bold: false },
      { text: 'EXCLUSIVE MAGAZINE', x: 15, y: 16, fontSize: 8, fontFamily: 'Montserrat', color: '#e06030', bold: false },
      { text: 'May 2025', x: 68, y: 16, fontSize: 12, fontFamily: 'Dancing Script', color: '#e06030', bold: false },
      { text: 'Імʼя', x: 25, y: 58, fontSize: 22, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: '8 причин чому ми тебе любимо', x: 55, y: 42, fontSize: 11, fontFamily: 'Montserrat', color: '#e06030', bold: false },
    ],
  },
  {
    id: 'mag-limited-edition',
    label: 'Limited Edition',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 25, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.3) 0%,transparent 25%,transparent 70%,rgba(0,0,0,0.3) 100%)' },
    texts: [
      { text: 'VOL. 21', x: 15, y: 5, fontSize: 10, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
      { text: 'JULY 2025', x: 72, y: 5, fontSize: 10, fontFamily: 'Montserrat', color: '#ffffff', bold: false },
      { text: 'MAGAZINE', x: 45, y: 14, fontSize: 38, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'LIMITED EDITION', x: 63, y: 28, fontSize: 16, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'Серцем назавжди', x: 63, y: 35, fontSize: 12, fontFamily: 'Dancing Script', color: '#ffffff', bold: false },
      { text: 'ІМʼЯ', x: 22, y: 78, fontSize: 22, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
    ],
  },
  {
    id: 'mag-happy-bday-bold',
    label: 'Happy Birthday Bold',
    group: 'Журнали — День народження',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'none' as const, color: '#000000', opacity: 0, gradient: '' },
    texts: [
      { text: 'HAPPY', x: 30, y: 8, fontSize: 28, fontFamily: 'Montserrat', color: '#d4a520', bold: true },
      { text: 'BIRTHDAY', x: 45, y: 18, fontSize: 38, fontFamily: 'Playfair Display', color: '#d4a520', bold: true },
      { text: 'Get to know', x: 22, y: 60, fontSize: 14, fontFamily: 'Dancing Script', color: '#ffffff', bold: false },
      { text: 'ІМʼЯ', x: 22, y: 70, fontSize: 24, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: '8 причин чому ми тебе любимо', x: 22, y: 92, fontSize: 10, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
    ],
  },
  {
    id: 'mag-glam-portrait',
    label: 'Glam Portrait',
    group: 'Журнали — Стиль',
    tags: ['magazine', 'journal'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 20, gradient: 'linear-gradient(180deg,rgba(0,0,0,0.2) 0%,transparent 18%,transparent 75%,rgba(0,0,0,0.25) 100%)' },
    texts: [
      { text: 'GLAM', x: 50, y: 6, fontSize: 38, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'UKRAINE', x: 50, y: 16, fontSize: 14, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'DEC 2025', x: 15, y: 23, fontSize: 10, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: 'HAPPY BIRTHDAY', x: 65, y: 35, fontSize: 14, fontFamily: 'Montserrat', color: '#c02030', bold: true },
      { text: 'A PORTRAIT OF', x: 22, y: 60, fontSize: 10, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'ІМʼЯ', x: 22, y: 69, fontSize: 20, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: 'BEAUTIFUL AND INSPIRING', x: 30, y: 82, fontSize: 11, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
    ],
  },

  // ── Книга побажань (Wishbook) ──
  {
    id: 'wish-elegant',
    label: 'Елегантна',
    group: 'Книга побажань',
    tags: ['wishbook'],
    bgColor: '#faf8f5',
    photoSlot: { x: 15, y: 15, w: 70, h: 45, shape: 'rounded' },
    texts: [
      { text: 'Книга побажань', x: 50, y: 70, fontSize: 28, fontFamily: 'Playfair Display', color: '#3d3429', bold: false },
      { text: 'Імʼя & Імʼя', x: 50, y: 80, fontSize: 22, fontFamily: 'Dancing Script', color: '#8a7968', bold: false },
      { text: '2025', x: 50, y: 90, fontSize: 16, fontFamily: 'Montserrat', color: '#b0a090', bold: false },
    ],
  },
  {
    id: 'wish-gold',
    label: 'Золотий текст',
    group: 'Книга побажань',
    tags: ['wishbook'],
    bgColor: '#1a1a2e',
    photoSlot: { x: 50, y: 50, w: 0, h: 0, shape: 'rect' },
    texts: [
      { text: 'КНИГА', x: 50, y: 30, fontSize: 16, fontFamily: 'Montserrat', color: '#d4af37', bold: true },
      { text: 'побажань', x: 50, y: 45, fontSize: 42, fontFamily: 'Great Vibes', color: '#d4af37', bold: false },
      { text: 'Олександр & Вікторія', x: 50, y: 62, fontSize: 20, fontFamily: 'Cormorant Garamond', color: '#e8d5b7', bold: false },
      { text: '15.06.2025', x: 50, y: 75, fontSize: 14, fontFamily: 'Montserrat', color: '#c0a060', bold: false },
    ],
  },
  {
    id: 'wish-photo-full',
    label: 'Фото на весь фон',
    group: 'Книга побажань',
    tags: ['wishbook'],
    bgColor: '#ffffff',
    photoSlot: { x: 0, y: 0, w: 100, h: 100, shape: 'rect' },
    overlay: { type: 'gradient', color: '#000000', opacity: 55, gradient: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.7) 100%)' },
    texts: [
      { text: 'Книга побажань', x: 50, y: 78, fontSize: 32, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: '2025', x: 50, y: 90, fontSize: 16, fontFamily: 'Montserrat', color: '#e0e0e0', bold: false },
    ],
  },
  {
    id: 'wish-minimal',
    label: 'Мінімалізм',
    group: 'Книга побажань',
    tags: ['wishbook'],
    bgColor: '#ffffff',
    photoSlot: { x: 20, y: 25, w: 60, h: 40, shape: 'circle' },
    texts: [
      { text: 'Книга побажань', x: 50, y: 10, fontSize: 22, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: '♡', x: 50, y: 78, fontSize: 28, fontFamily: 'Inter', color: '#d4af37', bold: false },
      { text: 'Імʼя & Імʼя', x: 50, y: 88, fontSize: 18, fontFamily: 'Dancing Script', color: '#555555', bold: false },
    ],
  },
  {
    id: 'wish-burgundy',
    label: 'Бордо',
    group: 'Книга побажань',
    tags: ['wishbook'],
    bgColor: '#5c1a1a',
    photoSlot: { x: 15, y: 15, w: 70, h: 45, shape: 'rounded' },
    texts: [
      { text: 'КНИГА ПОБАЖАНЬ', x: 50, y: 68, fontSize: 14, fontFamily: 'Montserrat', color: '#f0d9b5', bold: true },
      { text: 'Ваше весілля', x: 50, y: 80, fontSize: 28, fontFamily: 'Great Vibes', color: '#f0d9b5', bold: false },
      { text: '2025', x: 50, y: 92, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#e8d5b7', bold: false },
    ],
  },
  {
    id: 'wish-heart',
    label: 'Серце',
    group: 'Книга побажань',
    tags: ['wishbook'],
    bgColor: '#fff5f5',
    photoSlot: { x: 15, y: 10, w: 70, h: 55, shape: 'heart' },
    texts: [
      { text: 'Побажання', x: 50, y: 74, fontSize: 30, fontFamily: 'Dancing Script', color: '#c06070', bold: false },
      { text: 'для нас', x: 50, y: 86, fontSize: 20, fontFamily: 'Cormorant Garamond', color: '#a08080', bold: false },
    ],
  },
];
