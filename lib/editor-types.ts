export type ProductType = 'photobook' | 'travelbook' | 'magazine'

export type Format = '20x20' | '20x30' | '30x20' | '30x30' | '25x25'

export interface EditorProject {
  id: string
  productType: ProductType
  format: Format
  coverType?: string
  totalPages: number
  pages: EditorPage[]
  coverPage: EditorPage
  createdAt: string
  updatedAt: string
}

export interface EditorPage {
  id: string
  pageNumber: number
  layoutId: string
  background: { type: 'color' | 'image'; value: string }
  elements: EditorElement[]
}

export interface EditorElement {
  id: string
  type: 'photo' | 'text' | 'shape' | 'sticker'
  x: number        // 0–1 relative to page width
  y: number        // 0–1 relative to page height
  width: number    // 0–1 relative
  height: number   // 0–1 relative
  rotation: number // degrees
  // Photo-specific
  photoUrl?: string
  cropX?: number
  cropY?: number
  cropZoom?: number
  // Text-specific
  content?: string
  fontFamily?: string
  fontSize?: number
  color?: string
  align?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  letterSpacing?: number
  lineHeight?: number
  // Style
  opacity?: number
  zIndex?: number
}

export interface UploadedPhoto {
  id: string
  url: string
  name: string
}

export const FORMAT_CANVAS_SIZES: Record<Format, { width: number; height: number }> = {
  '20x20': { width: 800, height: 800 },
  '20x30': { width: 640, height: 960 },
  '30x20': { width: 960, height: 640 },
  '30x30': { width: 960, height: 960 },
  '25x25': { width: 800, height: 800 },
}
