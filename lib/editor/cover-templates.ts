// Cover template presets — each template defines bg color, text blocks, and photo slot config
export interface CoverTemplate {
  id: string;
  label: string;
  group: string;
  bgColor: string;
  photoSlot: { x: number; y: number; w: number; h: number; shape: 'rect' | 'rounded' | 'circle' };
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
];
