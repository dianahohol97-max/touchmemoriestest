import type { ProductType } from './editor-types'

export interface Layout {
  id: string
  name: string
  thumbnail: string  // emoji or URL placeholder
  productTypes: ProductType[]
  slots: LayoutSlot[]
}

export interface LayoutSlot {
  id: string
  type: 'photo' | 'text'
  x: number
  y: number
  width: number
  height: number  // all 0–1 relative coordinates
}

export const LAYOUTS: Layout[] = [
  // Full bleed photo (1 photo fills entire page)
  {
    id: 'full-bleed',
    name: 'На весь розворот',
    thumbnail: '🖼',
    productTypes: ['photobook', 'travelbook', 'magazine'],
    slots: [{ id: 's1', type: 'photo', x: 0, y: 0, width: 1, height: 1 }]
  },
  // 2 photos side by side
  {
    id: 'two-cols',
    name: 'Дві фотографії',
    thumbnail: '⬜⬜',
    productTypes: ['photobook', 'travelbook'],
    slots: [
      { id: 's1', type: 'photo', x: 0, y: 0, width: 0.49, height: 1 },
      { id: 's2', type: 'photo', x: 0.51, y: 0, width: 0.49, height: 1 }
    ]
  },
  // 1 photo + text below
  {
    id: 'photo-caption',
    name: 'Фото + напис',
    thumbnail: '📝',
    productTypes: ['photobook', 'travelbook', 'magazine'],
    slots: [
      { id: 's1', type: 'photo', x: 0.05, y: 0.05, width: 0.9, height: 0.75 },
      { id: 's2', type: 'text', x: 0.05, y: 0.83, width: 0.9, height: 0.12 }
    ]
  },
  // 3 photos grid
  {
    id: 'three-grid',
    name: 'Три фотографії',
    thumbnail: '⬜⬜⬜',
    productTypes: ['photobook'],
    slots: [
      { id: 's1', type: 'photo', x: 0, y: 0, width: 0.49, height: 1 },
      { id: 's2', type: 'photo', x: 0.51, y: 0, width: 0.49, height: 0.49 },
      { id: 's3', type: 'photo', x: 0.51, y: 0.51, width: 0.49, height: 0.49 }
    ]
  },
  // 4 equal grid
  {
    id: 'four-grid',
    name: 'Чотири фотографії',
    thumbnail: '⬜⬜⬜⬜',
    productTypes: ['photobook'],
    slots: [
      { id: 's1', type: 'photo', x: 0, y: 0, width: 0.49, height: 0.49 },
      { id: 's2', type: 'photo', x: 0.51, y: 0, width: 0.49, height: 0.49 },
      { id: 's3', type: 'photo', x: 0, y: 0.51, width: 0.49, height: 0.49 },
      { id: 's4', type: 'photo', x: 0.51, y: 0.51, width: 0.49, height: 0.49 }
    ]
  },
  // Text only (for title pages)
  {
    id: 'text-only',
    name: 'Тільки текст',
    thumbnail: 'T',
    productTypes: ['photobook', 'travelbook', 'magazine'],
    slots: [{ id: 's1', type: 'text', x: 0.1, y: 0.3, width: 0.8, height: 0.4 }]
  },
  // Magazine header: full-width photo + text overlay
  {
    id: 'mag-cover',
    name: 'Обкладинка журналу',
    thumbnail: '📰',
    productTypes: ['magazine'],
    slots: [
      { id: 's1', type: 'photo', x: 0, y: 0, width: 1, height: 1 },
      { id: 's2', type: 'text', x: 0.05, y: 0.6, width: 0.9, height: 0.35 }
    ]
  },
  // Blank layout
  {
    id: 'blank',
    name: 'Чиста сторінка',
    thumbnail: '⬜',
    productTypes: ['photobook', 'travelbook', 'magazine'],
    slots: []
  },
]

// Predefined background colors
export const BACKGROUND_COLORS = [
  { name: 'Білий', value: '#ffffff' },
  { name: 'Кремовий', value: '#fef9f3' },
  { name: 'Світло-сірий', value: '#f3f4f6' },
  { name: 'Темно-сірий', value: '#6b7280' },
  { name: 'Чорний', value: '#000000' },
  { name: 'Блакитний', value: '#dbeafe' },
  { name: 'Рожевий', value: '#fce7f3' },
  { name: 'Зелений', value: '#dcfce7' },
]
