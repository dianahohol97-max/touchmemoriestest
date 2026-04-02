'use client';

import { useState, useEffect, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ShoppingCart, Image as ImageIcon, Type, Trash2, LayoutGrid, Wand2, RotateCcw, Eye, Plus, HelpCircle, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';
import { CoverEditor, FLEX_COLORS, METAL_COLORS, ACRYLIC_VARIANTS, PHOTO_INSERT_VARIANTS, METAL_VARIANTS, LEATHERETTE_COLORS, FABRIC_COLORS } from './CoverEditor';
import { BookPreviewModal } from './BookPreviewModal';
import { FreeSlot, FreeSlotLayer, FreeSlotControls, SlotShape } from './FreeSlotLayer';
import { haptic, startPointerDrag, useLongPress } from '@/lib/hooks/useMobileInteractions';

// Cyrillic decorative fonts
const CYRILLIC_DECORATIVE_FONTS = [
  { label:'Marck Script', value:'Marck Script', style:'cursive' },
  { label:'Caveat', value:'Caveat', style:'cursive' },
  { label:'Comfortaa', value:'Comfortaa', style:'rounded' },
  { label:'Philosopher', value:'Philosopher', style:'serif' },
  { label:'Cormorant Garamond', value:'Cormorant Garamond', style:'elegant' },
  { label:'Montserrat', value:'Montserrat', style:'sans' },
  { label:'Lobster', value:'Lobster', style:'cursive' },
  { label:'Pacifico', value:'Pacifico', style:'cursive' },
  { label:'Rubik', value:'Rubik', style:'rounded' },
  { label:'Nunito', value:'Nunito', style:'rounded' },
  { label:'Ubuntu', value:'Ubuntu', style:'sans' },
];
import { PageBackground, DEFAULT_BG, BackgroundLayer, BackgroundControls } from './BackgroundLayer';
import { Shape, ShapeType, ShapesLayer, ShapeControls } from './ShapesLayer';
import { FrameConfig, DEFAULT_FRAME, FrameLayer, FrameControls } from './FramesLayer';

interface PhotoData { id: string; preview: string; width: number; height: number; name: string; }
interface BookConfig { productSlug: string; productName: string; selectedSize?: string; selectedCoverType?: string; selectedCoverColor?: string; selectedDecoration?: string; selectedDecorationType?: string; selectedDecorationVariant?: string; selectedDecorationSize?: string; selectedDecorationColor?: string; selectedPageCount: string; totalPrice: number; selectedLamination?: string; enableKalka?: boolean; enableEndpaper?: boolean; minPageCount?: number; }

type CoverDecoType = 'none'|'acryl'|'photovstavka'|'flex'|'metal'|'graviruvannya';
interface CoverState {
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
  printedPhotoSlot?: { x: number; y: number; w: number; h: number; shape: 'rect'|'circle'|'rounded' };
  printedTextBlocks?: { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold: boolean }[];
  printedOverlay?: { type: 'none'|'color'|'gradient'; color: string; opacity: number; gradient: string };
  printedBgColor?: string;
  backCoverBgColor?: string;
  backCoverPhotoId?: string | null;
}

type LayoutType =
  // 1 photo
  'p-full' | 'p-center' | 'p-top' | 'p-bottom' | 'p-left' | 'p-right' |
  // 2 photos
  'p-2-v' | 'p-2-h' | 'p-2-big-top' | 'p-2-big-bottom' | 'p-2-big-left' | 'p-2-big-right' | 'p-2-diag' |
  // 3 photos
  'p-3-row' | 'p-3-col' | 'p-3-top2' | 'p-3-bot2' | 'p-3-left2' | 'p-3-right2' | 'p-3-hero-top' | 'p-3-hero-left' |
  // 4 photos
  'p-4-grid' | 'p-4-hero-top' | 'p-4-hero-left' | 'p-4-strip-h' | 'p-4-strip-v' | 'p-4-l-shape' |
  // 5 photos
  'p-5-hero' | 'p-5-grid' | 'p-5-strip' |
  // 6 photos
  'p-6-grid' | 'p-6-3x2' | 'p-6-hero' |
  // 7-9
  'p-7-grid' | 'p-8-grid' | 'p-9-grid' |
  // text
  'p-text' | 'p-text-top' | 'p-text-bottom';

interface SlotData { photoId: string | null; cropX: number; cropY: number; zoom: number; }
interface TextBlock { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold: boolean; italic: boolean; }
interface Page { id: number; label: string; layout: LayoutType; slots: SlotData[]; textBlocks: TextBlock[]; }

const LAYOUTS: { id: LayoutType; label: string; slots: number; group: string }[] = [
  // 1 фото
  { id: 'p-full',         label: 'На всю сторінку',  slots: 1, group: '1 фото' },
  { id: 'p-center',       label: 'По центру',         slots: 1, group: '1 фото' },
  { id: 'p-top',          label: 'Зверху',            slots: 1, group: '1 фото' },
  { id: 'p-bottom',       label: 'Знизу',             slots: 1, group: '1 фото' },
  { id: 'p-left',         label: 'Ліворуч',           slots: 1, group: '1 фото' },
  { id: 'p-right',        label: 'Праворуч',          slots: 1, group: '1 фото' },
  // 2 фото
  { id: 'p-2-v',          label: '2 вертикально',     slots: 2, group: '2 фото' },
  { id: 'p-2-h',          label: '2 горизонтально',   slots: 2, group: '2 фото' },
  { id: 'p-2-big-top',    label: 'Велике зверху',     slots: 2, group: '2 фото' },
  { id: 'p-2-big-bottom', label: 'Велике знизу',      slots: 2, group: '2 фото' },
  { id: 'p-2-big-left',   label: 'Велике ліворуч',    slots: 2, group: '2 фото' },
  { id: 'p-2-big-right',  label: 'Велике праворуч',   slots: 2, group: '2 фото' },
  { id: 'p-2-diag',       label: 'Діагональ',         slots: 2, group: '2 фото' },
  // 3 фото
  { id: 'p-3-row',        label: '3 в рядок',         slots: 3, group: '3 фото' },
  { id: 'p-3-col',        label: '3 в стовпець',      slots: 3, group: '3 фото' },
  { id: 'p-3-top2',       label: '2 зверху + 1',      slots: 3, group: '3 фото' },
  { id: 'p-3-bot2',       label: '1 + 2 знизу',       slots: 3, group: '3 фото' },
  { id: 'p-3-left2',      label: '2 ліво + 1',        slots: 3, group: '3 фото' },
  { id: 'p-3-right2',     label: '1 + 2 право',       slots: 3, group: '3 фото' },
  { id: 'p-3-hero-top',   label: 'Велике + 2 знизу',  slots: 3, group: '3 фото' },
  { id: 'p-3-hero-left',  label: 'Велике + 2 право',  slots: 3, group: '3 фото' },
  // 4 фото
  { id: 'p-4-grid',       label: '4 рівно',           slots: 4, group: '4 фото' },
  { id: 'p-4-hero-top',   label: 'Велике + 3 знизу',  slots: 4, group: '4 фото' },
  { id: 'p-4-hero-left',  label: 'Велике + 3 право',  slots: 4, group: '4 фото' },
  { id: 'p-4-strip-h',    label: '4 горизонт смуга',  slots: 4, group: '4 фото' },
  { id: 'p-4-strip-v',    label: '4 вертик смуга',    slots: 4, group: '4 фото' },
  { id: 'p-4-l-shape',    label: 'Г-подібний',        slots: 4, group: '4 фото' },
  // 5 фото
  { id: 'p-5-hero',       label: 'Велике + 4',        slots: 5, group: '5 фото' },
  { id: 'p-5-grid',       label: '5 сітка',           slots: 5, group: '5 фото' },
  { id: 'p-5-strip',      label: '1 + 4 смуга',       slots: 5, group: '5 фото' },
  // 6 фото
  { id: 'p-6-grid',       label: '6 рівно (2×3)',     slots: 6, group: '6 фото' },
  { id: 'p-6-3x2',        label: '6 рівно (3×2)',     slots: 6, group: '6 фото' },
  { id: 'p-6-hero',       label: 'Велике + 5',        slots: 6, group: '6 фото' },
  // 7-9 фото
  { id: 'p-7-grid',       label: '7 сітка',           slots: 7, group: '7–9 фото' },
  { id: 'p-8-grid',       label: '8 сітка',           slots: 8, group: '7–9 фото' },
  { id: 'p-9-grid',       label: '9 рівно (3×3)',     slots: 9, group: '7–9 фото' },
  // Текст
  { id: 'p-text',         label: 'Тільки текст',      slots: 0, group: 'Текст' },
  { id: 'p-text-top',     label: 'Фото + текст знизу', slots: 1, group: 'Текст' },
  { id: 'p-text-bottom',  label: 'Текст + фото знизу', slots: 1, group: 'Текст' },
];

const PAGE_PROPORTIONS: Record<string, { w: number; h: number }> = {
  '20x20': { w: 200, h: 200 }, '20×20': { w: 200, h: 200 },
  '25x25': { w: 250, h: 250 }, '25×25': { w: 250, h: 250 },
  '20x30': { w: 200, h: 300 }, '20×30': { w: 200, h: 300 },
  '30x20': { w: 300, h: 200 }, '30×20': { w: 300, h: 200 },
  '30x30': { w: 300, h: 300 }, '30×30': { w: 300, h: 300 },
  'A4': { w: 210, h: 297 },
  '23x23': { w: 230, h: 230 }, '23×23': { w: 230, h: 230 },
  // Magazines (A4 format)
  'magazine-A4': { w: 210, h: 297 },
  // Travel Book (20×30 landscape — wider format)
  'travelbook': { w: 300, h: 200 },
};

// Auto-detect size key from product slug and config
function getSizeKeyForProduct(config: BookConfig | null): string {
  if (!config) return 'A4';
  const slug = (config.productSlug || '').toLowerCase();
  // TravelBook — 20×30 vertical (portrait)
  if (slug.includes('travel')) return '20x30';
  // Wishbook — use selectedSize (20x30, 30x20, 23x23)
  if (slug.includes('wish') || slug.includes('guest') || slug.includes('pobazhan')) {
    const s = config?.selectedSize?.replace('×','x') || '20x30';
    return s;
  }
  // Magazines — A4
  if (slug.includes('magazine') || slug.includes('journal') || slug.includes('zhurnal') || slug.includes('fotozhurnal'))
    return 'magazine-A4';
  // Photobooks — use selectedSize
  return config.selectedSize ?? 'A4';
}

function makeSlots(n: number): SlotData[] {
  return Array.from({ length: n }, () => ({ photoId: null, cropX: 50, cropY: 50, zoom: 1 }));
}

const FONT_GROUPS = [
  { group: 'Сучасні', fonts: ['Montserrat','Inter','Lato','Raleway','Nunito','Poppins','Oswald','Josefin Sans'] },
  { group: 'Класичні', fonts: ['Playfair Display','Georgia','Cormorant Garamond','EB Garamond','Libre Baskerville'] },
  { group: 'Каліграфічні', fonts: ['Dancing Script','Great Vibes','Pacifico','Sacramento','Satisfy','Alex Brush','Pinyon Script','Italianno'] },
  { group: 'Кириличні', fonts: ['Marck Script','Philosopher','Russo One','Comfortaa','Lobster','Caveat','Poiret One','Open Sans'] },
  { group: 'Декоративні', fonts: ['Abril Fatface','Cinzel','Bebas Neue','Righteous'] },
];
const FONTS = FONT_GROUPS.flatMap(g => g.fonts);
const COLORS = ['#1e2d7d', '#ffffff', '#000000', '#e63946', '#2a9d8f', '#f4a261', '#264653', '#e9c46a'];

function getSlotDefs(layout: LayoutType, W: number, H: number): { i: number; s: React.CSSProperties }[] {
  const g = 4;
  const w2 = (W - g) / 2, h2 = (H - g) / 2;
  const w3 = (W - 2 * g) / 3, h3 = (H - 2 * g) / 3;
  const w4 = (W - 3 * g) / 4, h4 = (H - 3 * g) / 4;
  const b: React.CSSProperties = { position: 'absolute', overflow: 'hidden', borderRadius: 3 };

  const S = (i: number, x: number, y: number, w: number, h: number, extra?: React.CSSProperties) =>
    ({ i, s: { ...b, left: x, top: y, width: w, height: h, ...extra } });

  if (layout === 'p-full')        return [S(0, 0, 0, W, H)];
  if (layout === 'p-center')      return [S(0, W*0.08, H*0.08, W*0.84, H*0.84)];
  if (layout === 'p-top')         return [S(0, 0, 0, W, H*0.65)];
  if (layout === 'p-bottom')      return [S(0, 0, H*0.35, W, H*0.65)];
  if (layout === 'p-left')        return [S(0, 0, 0, W*0.65, H)];
  if (layout === 'p-right')       return [S(0, W*0.35, 0, W*0.65, H)];

  if (layout === 'p-2-v')         return [S(0, 0, 0, w2, H), S(1, w2+g, 0, w2, H)];
  if (layout === 'p-2-h')         return [S(0, 0, 0, W, h2), S(1, 0, h2+g, W, h2)];
  if (layout === 'p-2-big-top')   return [S(0, 0, 0, W, H*0.65), S(1, 0, H*0.65+g, W, H*0.35-g)];
  if (layout === 'p-2-big-bottom') return [S(0, 0, 0, W, H*0.35), S(1, 0, H*0.35+g, W, H*0.65-g)];
  if (layout === 'p-2-big-left')  return [S(0, 0, 0, W*0.65, H), S(1, W*0.65+g, 0, W*0.35-g, H)];
  if (layout === 'p-2-big-right') return [S(0, 0, 0, W*0.35, H), S(1, W*0.35+g, 0, W*0.65-g, H)];
  if (layout === 'p-2-diag')      return [S(0, 0, 0, W*0.6, H*0.6), S(1, W*0.4, H*0.4, W*0.6, H*0.6)];

  if (layout === 'p-3-row')       return [S(0,0,0,w3,H), S(1,w3+g,0,w3,H), S(2,(w3+g)*2,0,w3,H)];
  if (layout === 'p-3-col')       return [S(0,0,0,W,h3), S(1,0,h3+g,W,h3), S(2,0,(h3+g)*2,W,h3)];
  if (layout === 'p-3-top2')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,W,h2)];
  if (layout === 'p-3-bot2')      return [S(0,0,0,W,h2), S(1,0,h2+g,w2,h2), S(2,w2+g,h2+g,w2,h2)];
  if (layout === 'p-3-left2')     return [S(0,0,0,w2,h2), S(1,0,h2+g,w2,h2), S(2,w2+g,0,w2,H)];
  if (layout === 'p-3-right2')    return [S(0,0,0,w2,H), S(1,w2+g,0,w2,h2), S(2,w2+g,h2+g,w2,h2)];
  if (layout === 'p-3-hero-top')  return [S(0,0,0,W,H*0.55), S(1,0,H*0.55+g,w2,H*0.45-g), S(2,w2+g,H*0.55+g,w2,H*0.45-g)];
  if (layout === 'p-3-hero-left') return [S(0,0,0,W*0.55,H), S(1,W*0.55+g,0,W*0.45-g,h2), S(2,W*0.55+g,h2+g,W*0.45-g,h2)];

  if (layout === 'p-4-grid')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,w2,h2), S(3,w2+g,h2+g,w2,h2)];
  if (layout === 'p-4-hero-top')  { const bh=H*0.55, sh=H-bh-g; return [S(0,0,0,W,bh), S(1,0,bh+g,w3,sh), S(2,w3+g,bh+g,w3,sh), S(3,(w3+g)*2,bh+g,w3,sh)]; }
  if (layout === 'p-4-hero-left') { const bw=W*0.55, sw=W-bw-g; const sh=(H-2*g)/3; return [S(0,0,0,bw,H), S(1,bw+g,0,sw,sh), S(2,bw+g,sh+g,sw,sh), S(3,bw+g,(sh+g)*2,sw,sh)]; }
  if (layout === 'p-4-strip-h')   return [S(0,0,0,W,h4), S(1,0,h4+g,W,h4), S(2,0,(h4+g)*2,W,h4), S(3,0,(h4+g)*3,W,h4)];
  if (layout === 'p-4-strip-v')   return [S(0,0,0,w4,H), S(1,w4+g,0,w4,H), S(2,(w4+g)*2,0,w4,H), S(3,(w4+g)*3,0,w4,H)];
  if (layout === 'p-4-l-shape')   { const bw=W*0.6, sh=(H-g)/2; return [S(0,0,0,bw,H), S(1,bw+g,0,W-bw-g,sh), S(2,bw+g,sh+g,W-bw-g,sh), S(3,0,H-H*0.25,bw,H*0.25)]; }

  if (layout === 'p-5-hero')      { const bh=H*0.55; const sw=(W-2*g)/4; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3].map(i=>S(i+1,i*(sw+g),bh+g,sw,sh))]; }
  if (layout === 'p-5-grid')      return [S(0,0,0,w2,h2), S(1,w2+g,0,w2,h2), S(2,0,h2+g,w3,h2), S(3,w3+g,h2+g,w3,h2), S(4,(w3+g)*2,h2+g,w3,h2)];
  if (layout === 'p-5-strip')     { const bh=H*0.55; const sw=(W-3*g)/4; const sh=H-bh-g; return [S(0,0,0,W,bh), ...[0,1,2,3].map(i=>S(i+1,i*(sw+g),bh+g,sw,sh))]; }

  if (layout === 'p-6-grid')      return [[0,1].flatMap(col=>[0,1,2].map(row=>S(col*3+row, col*(w2+g), row*(h3+g), w2, h3)))].flat();
  if (layout === 'p-6-3x2')       return [[0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row, col*(w3+g), row*(h2+g), w3, h2)))].flat();
  if (layout === 'p-6-hero')      { const bh=H*0.5; const sw=(W-2*g)/3; const sh2=(H-bh-g-g)/2; return [S(0,0,0,W*0.5,bh), S(1,W*0.5+g,0,W*0.5-g,bh), ...[0,1,2].map(i=>S(i+2,i*(sw+g),bh+g,sw,sh2)), ...[0,1,2].map(i=>S(i+5,i*(sw+g),bh+g+sh2+g,sw,sh2))]; }

  if (layout === 'p-7-grid')      { const sw=(W-2*g)/3, sh=(H-2*g)/3; return [[0,1,2].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(sw+g),row*(sh+g),sw,sh))).concat(S(6,0,(sh+g)*2,W,sh))].flat(); }
  if (layout === 'p-8-grid')      return [[0,1,2,3].flatMap(col=>[0,1].map(row=>S(col*2+row,col*(w4+g),row*(h2+g),w4,h2)))].flat();
  if (layout === 'p-9-grid')      return [[0,1,2].flatMap(col=>[0,1,2].map(row=>S(col*3+row,col*(w3+g),row*(h3+g),w3,h3)))].flat();

  if (layout === 'p-text')        return [];
  if (layout === 'p-text-top')    return [S(0, 0, 0, W, H*0.65)];
  if (layout === 'p-text-bottom') return [S(0, 0, H*0.35, W, H*0.65)];

  return [S(0, 0, 0, W, H)];
}

function LayoutSVG({ layout, active }: { layout: LayoutType; active: boolean }) {
  const W = 36, H = 46;
  const defs = getSlotDefs(layout, W, H);
  const c = active ? '#fff' : '#94a3b8';
  return (
    <svg width={W} height={H} style={{ display: 'block', borderRadius: 2, overflow: 'hidden', background: active ? 'rgba(255,255,255,0.15)' : '#f1f5f9', flexShrink: 0 }}>
      {defs.map(({ i, s }) => (
        <rect key={i} x={Number(s.left)||0} y={Number(s.top)||0} width={Number(s.width)||0} height={Number(s.height)||0} rx={1} fill={c} opacity={active?0.9:0.7} />
      ))}
      {defs.length === 0 && <text x={W/2} y={H/2+4} textAnchor="middle" fontSize={10} fill={c} fontWeight={700}>T</text>}
    </svg>
  );
}

export default function BookLayoutEditor() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false); // bottom sheet open
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const { addItem } = useCartStore();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const designerOrderId = searchParams?.get('designer_order_id') || null;
  const [designerSaving, setDesignerSaving] = useState(false);

  const [config, setConfig] = useState<BookConfig | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [zoom, setZoom] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 40 : 70);
  const [leftTab, setLeftTab] = useState<'photos'|'layouts'|'text'|'cover'|'bg'|'shapes'|'frames'|'stickers'|'options'>('photos');
  const [coverState, setCoverState] = useState<CoverState>(() => {
    // Synchronously read config to initialize cover state immediately
    try {
      const cfg = typeof window !== 'undefined' ? sessionStorage.getItem('bookConstructorConfig') : null;
      if (cfg) {
        const c = JSON.parse(cfg);
        const deco = (c.selectedDecorationType || c.selectedDecoration || '').toLowerCase();
        let decoType: CoverDecoType = 'none';
        if (deco.includes('акрил') || deco.includes('acrylic') || deco.includes('acryl')) decoType = 'acryl';
        else if (deco.includes('фотовставка') || deco.includes('photo_insert') || deco.includes('photo insert')) decoType = 'photovstavka';
        else if (deco.includes('флекс') || deco.includes('flex')) decoType = 'flex';
        else if (deco.includes('метал') || deco.includes('metal')) decoType = 'metal';
        else if (deco.includes('гравір') || deco.includes('engraving') || deco.includes('graviruvannya')) decoType = 'graviruvannya';
        const variant = c.selectedDecorationVariant || '';
        const dc = (c.selectedDecorationColor || '').toLowerCase();
        let decoColor = '#D4AF37';
        if (dc.includes('срібн') || dc.includes('silver')) decoColor = '#C0C0C0';
        else if (dc.includes('білий') || dc.includes('white')) decoColor = '#FFFFFF';
        else if (dc.includes('чорн') || dc.includes('black')) decoColor = '#1A1A1A';
        return { decoType, decoVariant: variant, photoId: null, decoText: '', decoColor, textX: 50, textY: 85, textFontFamily: 'Marck Script', textFontSize: 14, extraTexts: [] };
      }
    } catch {}
    return { decoType: 'none', decoVariant: '', photoId: null, decoText: '', decoColor: '#D4AF37', textX: 50, textY: 85, textFontFamily: 'Marck Script', textFontSize: 14, extraTexts: [] };
  });
  const [freeSlots, setFreeSlots] = useState<Record<number, FreeSlot[]>>({});
  const [selectedFreeSlotId, setSelectedFreeSlotId] = useState<string | null>(null);
  const [pageBgs, setPageBgs] = useState<Record<number, PageBackground>>({});
  const [pageShapes, setPageShapes] = useState<Record<number, Shape[]>>({});
  const [pageFrames, setPageFrames] = useState<Record<number, FrameConfig>>({});

  // Undo history
  type HistoryEntry = { pages: Page[]; freeSlots: Record<number, FreeSlot[]> };
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const pushHistory = () => {
    setHistory(prev => [...prev.slice(-19), { pages: JSON.parse(JSON.stringify(pages)), freeSlots: JSON.parse(JSON.stringify(freeSlots)) }]);
  };
  const undo = () => { haptic.light();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setPages(prev.pages);
    setFreeSlots(prev.freeSlots);
    setHistory(h => h.slice(0, -1));
  };
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [tapSelectedPhotoId, setTapSelectedPhotoId] = useState<string | null>(null); // mobile tap-to-place
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [textTool, setTextTool] = useState(false);
  const [photoEditSlot, setPhotoEditSlot] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [crossPageDragShapeId, setCrossPageDragShapeId] = useState<string|null>(null);
  const [crossDragPos, setCrossDragPos] = useState<{x:number;y:number}|null>(null);
  const crossDragShape = crossPageDragShapeId
    ? Object.values(pageShapes).flat().find((s:any) => s.id === crossPageDragShapeId) ?? null
    : null;
  const [coverColorOverride, setCoverColorOverride] = useState<string|null>(null);
  const effectiveCoverColor = coverColorOverride ?? (config?.selectedCoverColor || '');
  const [pageStickers, setPageStickers] = useState<Record<number,{id:string;url:string;emoji?:string;x:number;y:number;w:number|string;h:number|string}[]>>({});
  const [selectedTextPageIdx, setSelectedTextPageIdx] = useState<number>(1);
  const [showDecoList, setShowDecoList] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Калька state: text, uploaded illustration
  const [kalkaState, setKalkaState] = useState<{ text: string; textColor: string; fontSize: number; fontFamily: string; imageUrl: string | null; }>({ text: '', textColor: '#333333', fontSize: 24, fontFamily: 'Playfair Display', imageUrl: null });
  const kalkaImageInputRef = useRef<HTMLInputElement>(null);
  // Форзац state: each endpaper can have optional content (costs +200₴)
  const [endpaperState, setEndpaperState] = useState<{ first: { enabled: boolean; text: string; textColor: string; imageUrl: string | null }; last: { enabled: boolean; text: string; textColor: string; imageUrl: string | null } }>({
    first: { enabled: false, text: '', textColor: '#333333', imageUrl: null },
    last:  { enabled: false, text: '', textColor: '#333333', imageUrl: null },
  });
  const endpaperImageRef = useRef<{ first: HTMLInputElement | null; last: HTMLInputElement | null }>({ first: null, last: null });
  const [showTooltips, setShowTooltips] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('editor_tooltips_seen');
  });
  // Context menu (long-press on mobile)
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number;
    type: 'text' | 'slot' | 'freeslot';
    id: string; pageIdx?: number;
  } | null>(null);
  const closeCtxMenu = () => setCtxMenu(null);

  const [showMobileGuide, setShowMobileGuide] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 && !localStorage.getItem('mobile_editor_guide_seen');
  });
  const dismissMobileGuide = () => {
    localStorage.setItem('mobile_editor_guide_seen', '1');
    setShowMobileGuide(false);
  };
  const [tooltipStep, setTooltipStep] = useState(0);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tFontSize, setTFontSize] = useState(28);
  const [tFontFamily, setTFontFamily] = useState('Montserrat');
  const [tColor, setTColor] = useState('#1e2d7d');
  const [tBold, setTBold] = useState(false);
  const [tItalic, setTItalic] = useState(false);
  const cropRef = useRef<{ key: string; sx: number; sy: number; cx: number; cy: number } | null>(null);
  const txtRef = useRef<{ id: string; sx: number; sy: number; tx: number; ty: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Ctrl+Z undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [history]);

  useEffect(() => {
    const fams = ['Inter','Lato','Raleway','Nunito','Poppins','Oswald','Josefin+Sans',
      'Playfair+Display','Cormorant+Garamond','EB+Garamond','Libre+Baskerville',
      'Dancing+Script','Great+Vibes','Pacifico','Sacramento','Satisfy',
      'Alex+Brush','Pinyon+Script','Italianno','Marck+Script','Philosopher',
      'Russo+One','Comfortaa','Lobster','Caveat','Poiret+One','Open+Sans',
      'Abril+Fatface','Cinzel','Bebas+Neue','Righteous'];
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + fams.join('&family=') + '&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch{} };
  }, []);

  useEffect(() => {
    const cfg = sessionStorage.getItem('bookConstructorConfig');
    if (cfg) setConfig(JSON.parse(cfg));
    else { toast.error('Конфігурація не знайдена'); router.push('/order/book'); }
    const ph = sessionStorage.getItem('bookConstructorPhotos');
    if (ph) setPhotos(JSON.parse(ph));
    // Restore editor draft if user navigated back
    const draft = sessionStorage.getItem('bookEditorDraft');
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.pages?.length) setPages(d.pages);
        if (d.freeSlots) setFreeSlots(d.freeSlots);
        if (d.pageStickers) setPageStickers(d.pageStickers);
        if (d.pageShapes) setPageShapes(d.pageShapes);
        if (d.pageBgs) setPageBgs(d.pageBgs);
        if (d.coverState) setCoverState(d.coverState);
      } catch {}
    }
  }, [router]);

  // Auto-save editor state to sessionStorage so it survives "back" navigation
  useEffect(() => {
    if (!pages.length) return;
    const draft = {
      pages,
      freeSlots,
      pageStickers,
      pageShapes,
      pageBgs,
      coverState,
    };
    try {
      sessionStorage.setItem('bookEditorDraft', JSON.stringify(draft));
    } catch {}
  }, [pages, freeSlots, pageStickers, pageShapes, pageBgs, coverState]);

  // Auto-switch to cover tab on page 0
  useEffect(() => {
    if (currentIdx === 0) setLeftTab('cover');
    else if (leftTab === 'cover') setLeftTab('photos');
  }, [currentIdx]);

  useEffect(() => {
    if (!config) return;
    // Skip re-initialization if we restored a draft (pages already set)
    const draft = sessionStorage.getItem('bookEditorDraft');
    if (draft) {
      try { const d = JSON.parse(draft); if (d.pages?.length) return; } catch {}
    }
    const m = config.selectedPageCount.match(/(\d+)/);
    const total = m ? parseInt(m[0]) : 20;
    const hasKalka = !!(config.enableKalka) && (config.productSlug || '').toLowerCase().includes('photobook');
    const ps: Page[] = [];
    ps.push({ id: 0, label: 'Обкладинка', layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
    // Content pages: 2 individual pages per spread
    for (let i = 1; i <= total; i++) {
      ps.push({ id: i, label: `${i}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
    }
    // Kalka rule: add extra blank last spread
    if (hasKalka) {
      const n = ps.length;
      ps.push({ id: n, label: `${n}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
      ps.push({ id: n+1, label: `${n+1}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
    }
    setPages(ps);
  }, [config]);

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) ?? null : null;
  const usedIds = new Set(pages.flatMap(p => p.slots.map(sl => sl.photoId).filter(Boolean)));
  const _slug = (config?.productSlug || '').toLowerCase();
  const isPrinted = (config?.selectedCoverType || '').toLowerCase().includes('друков') ||
    (config?.selectedCoverType || '').toLowerCase().includes('print') ||
    (config?.selectedCoverType || '').toLowerCase().includes('м\'яка') ||
    (config?.selectedCoverType || '').toLowerCase().includes('soft') ||
    _slug.includes('magazine') || _slug.includes('journal') ||
    _slug.includes('zhurnal') || _slug.includes('fotozhurnal') ||
    _slug.includes('travel') ||
    _slug.includes('wish') || _slug.includes('guest') || _slug.includes('pobazhan') ||
    (config?.productName || '').toLowerCase().includes('журнал') ||
    (config?.productName || '').toLowerCase().includes('тревел') ||
    (config?.productName || '').toLowerCase().includes('побажань');

  // Калька: first left page (page index 1) is blank/kalka, last spread is blank
  const hasKalka = !!(config?.enableKalka) && _slug.includes('photobook');
  const kalkaPageIdx = hasKalka ? 1 : -1;
  const kalkaEndPageIdxStart = hasKalka ? pages.length - 2 : -1;
  const isKalkaPage = (pageIdx: number) => hasKalka && pageIdx === kalkaPageIdx;
  const isKalkaEndPage = (pageIdx: number) => hasKalka && pageIdx >= kalkaEndPageIdxStart && kalkaEndPageIdxStart > 0;
  // Форзац: travelbook or magazine with enableEndpaper=true
  const hasEndpaper = !!(config?.enableEndpaper) && (_slug.includes('travelbook') || _slug.includes('magazine') || _slug.includes('journal'));
  const endpaperFirstIdx = hasEndpaper ? 1 : -1;
  const endpaperLastIdx = hasEndpaper ? pages.length - 1 : -1;
  const isEndpaperPage = (pageIdx: number) => hasEndpaper && (pageIdx === endpaperFirstIdx || pageIdx === endpaperLastIdx);
  const cur = pages[currentIdx];

  const sizeKey = getSizeKeyForProduct(config);
  const prop = PAGE_PROPORTIONS[sizeKey] ?? PAGE_PROPORTIONS['A4'];
  // Spread = 2 pages side by side
  const baseH = 460;
  const baseW = baseH * (2 * prop.w) / prop.h; // spread width = 2 pages
  const cW = baseW * zoom / 100; // full spread width
  const cH = baseH * zoom / 100;
  const pageW = cW / 2; // single page width

  // Load Google Fonts
  useEffect(() => {
    const fonts = [
      'Marck+Script','Caveat','Comfortaa','Philosopher','Cormorant+Garamond',
      'Montserrat','Lobster','Pacifico','Rubik','Nunito','Ubuntu',
      'Dancing+Script','Great+Vibes','Pinyon+Script','Sacramento','Playfair+Display','Cinzel'
    ].map(f => `family=${f}:ital,wght@0,400;0,700;1,400`).join('&');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${fonts}&display=swap`;
    document.head.appendChild(link);
  }, []);

  // Init cover state from config
  useEffect(() => {
    if (!config) return;
    const deco = (config.selectedDecorationType || config.selectedDecoration || '').toLowerCase();
    let decoType: CoverDecoType = 'none';
    if (deco.includes('акрил') || deco.includes('acrylic') || deco.includes('acryl')) decoType = 'acryl';
    else if (deco.includes('фотовставка') || deco.includes('photo_insert') || deco.includes('photo insert')) decoType = 'photovstavka';
    else if (deco.includes('флекс') || deco.includes('flex')) decoType = 'flex';
    else if (deco.includes('метал') || deco.includes('metal')) decoType = 'metal';
    else if (deco.includes('гравір') || deco.includes('engraving') || deco.includes('graviruvannya')) decoType = 'graviruvannya';
    // Map decoVariant from config
    // config.selectedDecorationVariant = e.g. "60×60 золотий" or raw variant name
    const variant = config.selectedDecorationVariant || '';

    // Map decoColor from config
    const dc = config.selectedDecorationColor?.toLowerCase() || '';
    let decoColor = '#D4AF37'; // default gold
    if (dc.includes('срібн') || dc.includes('silver')) decoColor = '#C0C0C0';
    else if (dc.includes('білий') || dc.includes('white')) decoColor = '#FFFFFF';
    else if (dc.includes('чорн') || dc.includes('black')) decoColor = '#1A1A1A';

    // Auto-select first variant for size if none provided
    const sizeKey = (config.selectedSize || '20x20').replace(/[×х]/g, 'x').replace(/\s*см/g, '').trim();
    let autoVariant = variant;
    if (!autoVariant && decoType !== 'none' && decoType !== 'flex' && decoType !== 'graviruvannya') {
      const variantMap: Record<string, Record<string, string[]>> = {
        acryl: ACRYLIC_VARIANTS,
        photovstavka: PHOTO_INSERT_VARIANTS,
        metal: METAL_VARIANTS,
      };
      const variants = variantMap[decoType]?.[sizeKey] || variantMap[decoType]?.['20x20'] || [];
      // Pick variant matching color if possible
      if (decoType === 'metal' && variants.length > 0) {
        if (dc.includes('срібн') || dc.includes('silver')) {
          autoVariant = variants.find(v => v.includes('срібний')) || variants[0];
        } else {
          autoVariant = variants.find(v => v.includes('золотий')) || variants[0];
        }
      } else {
        autoVariant = variants[0] || '';
      }
    }

    setCoverState(prev => ({ ...prev, decoType, decoVariant: autoVariant, decoColor }));
  }, [config]);

  // curFreeSlots defined below after getActivePageIdx

  // Add spread (2 pages)
  const shuffleLayout = () => {
    const targetIdx = getActivePageIdx();
    const page = pages[targetIdx];
    if (!page) return;
    // Use freeSlots count if page uses freeSlot layout (slots=[])
    const curFreeCount = (freeSlots[targetIdx] || []).length;
    const slotCount = page.slots.length > 0 ? page.slots.length : curFreeCount;
    // Find compatible layouts by slot count
    const compatible = slotCount > 0
      ? LAYOUTS.filter(l => l.slots === slotCount)
      : LAYOUTS.filter(l => l.slots > 0); // fallback: all layouts with slots
    const pool = compatible.length > 0 ? compatible : LAYOUTS;
    // Find current layout — page.layout may be 'p-text' for freeSlot pages,
    // so track by last applied layout stored in page or just cycle forward
    const curRealLayout = page.layout === 'p-text' ? null : page.layout;
    const cur = curRealLayout ? pool.findIndex(l => l.id === curRealLayout) : -1;
    const next = (cur + 1) % pool.length;
    changeLayout(pool[next].id as LayoutType, targetIdx);
  };

  const addSpread = () => {
    pushHistory();
    const newId1 = pages.length;
    const newId2 = pages.length + 1;
    setPages(prev => [
      ...prev,
      { id: newId1, label: `Стор. ${newId1}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] },
      { id: newId2, label: `Стор. ${newId2}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] },
    ]);
    // Navigate to new spread
    const newSpreadIdx = Math.ceil(pages.length / 2);
    setCurrentIdx(newSpreadIdx);
  };

  const removeCurrentSpread = () => {
    pushHistory();
    if (pages.length <= minPagesLen) { toast.error(`Мінімальна кількість розворотів: ${minSpreads}`); return; }
    if (currentIdx === 0) { toast.error('Не можна видалити обкладинку'); return; }
    // pages[0] = cover, spread N = pages[(N-1)*2+1] and pages[(N-1)*2+2]
    const p1 = (currentIdx - 1) * 2 + 1;
    const p2 = p1 + 1;
    setPages(prev => prev.filter((_, i) => i !== p1 && i !== p2));
    setCurrentIdx(prev => Math.max(1, Math.min(prev, Math.ceil((pages.length - 3) / 2))));
    toast.success('Розворот видалено');
  };

  const getCurBg = (idx: number): PageBackground => pageBgs[idx] || DEFAULT_BG;
  const getCurFrame = (idx: number): FrameConfig => pageFrames[idx] || DEFAULT_FRAME;
  const getCurShapes = (idx: number): Shape[] => pageShapes[idx] || [];

  const addShape = (type: ShapeType, pageIdx: number) => {
    const id = 'shape-' + Date.now();
    const newShape: Shape = { id, type, x: pageW*0.2, y: cH*0.2, w: pageW*0.35, h: type==='line'?0:cH*0.25, fill: type==='line'?'transparent':'#1e2d7d', stroke: '#1e2d7d', strokeWidth: type==='line'?4:0, opacity: 80, rotation: 0 };
    setPageShapes(prev => ({ ...prev, [pageIdx]: [...(prev[pageIdx]||[]), newShape] }));
    setSelectedShapeId(id); // auto-select so style controls appear immediately
  };

  const addFreeSlot = () => {
    pushHistory();
    const targetPageIdx = getActivePageIdx();
    const id = 'free-' + Date.now();
    const newSlot: FreeSlot = {
      id, x: pageW * 0.2, y: cH * 0.2,
      w: pageW * 0.5, h: cH * 0.4,
      shape: 'rect', photoId: null, cropX: 50, cropY: 50, zoom: 1,
    };
    setFreeSlots(prev => ({ ...prev, [targetPageIdx]: [...(prev[targetPageIdx]||[]), newSlot] }));
    setSelectedFreeSlotId(id);
  };

  // In spread view, changeLayout applies to the hovered/selected page side
  const [activeSide, setActiveSide] = useState<0|1>(0);
  const getActivePageIdx = () => currentIdx === 0 ? 0 : (currentIdx - 1) * 2 + 1 + activeSide;
  // Minimum spreads = minPageCount / 2 (from product config, e.g. 20×20 = 6/2 = 3)
  const minPageCount = config?.minPageCount ?? 6;
  const minSpreads = Math.max(1, Math.floor(minPageCount / 2));
  // pages array: 1 cover + N content pages; minimum = minPageCount + 1
  const minPagesLen = minPageCount + 1;
  const curFreeSlots = freeSlots[getActivePageIdx()] || [];
  const setCurFreeSlots = (slots: FreeSlot[] | ((prev: FreeSlot[]) => FreeSlot[])) => {
    const idx = getActivePageIdx();
    setFreeSlots(prev => ({
      ...prev,
      [idx]: typeof slots === 'function' ? slots(prev[idx] || []) : slots,
    }));
  };

  const changeLayout = (layout: LayoutType, forceIdx?: number) => {
    const def = LAYOUTS.find(l => l.id === layout);
    if (!def) return;
    const targetIdx = forceIdx !== undefined ? forceIdx : getActivePageIdx();
    pushHistory(); // save state before change

    const page = pages[targetIdx];
    const oldPhotos = page ? page.slots.map(s2 => s2.photoId).filter(Boolean) as string[] : [];

    if (def.slots > 0) {
      // Auto-convert to FreeSlots so user can drag/resize/reshape immediately
      const defs = getSlotDefs(layout, pageW, cH);
      const newFreeSlots: FreeSlot[] = defs.map((d, di) => ({
        id: 'free-' + Date.now() + '-' + di,
        x: Number(d.s.left) || 0,
        y: Number(d.s.top) || 0,
        w: Number(d.s.width) || pageW,
        h: Number(d.s.height) || cH,
        shape: 'rect' as const,
        photoId: oldPhotos[di] ?? null,
        cropX: 50, cropY: 50, zoom: 1,
      }));
      // Save real layout ID so shuffleLayout can cycle correctly
      setPages(prev => prev.map((p, i) =>
        i !== targetIdx ? p : { ...p, layout, slots: [] }
      ));
      setFreeSlots(prev => ({ ...prev, [targetIdx]: newFreeSlots }));
      setSelectedFreeSlotId(newFreeSlots[0]?.id ?? null);
    } else {
      // Text-only layout — no slots
      setPages(prev => prev.map((p, i) =>
        i !== targetIdx ? p : { ...p, layout, slots: [] }
      ));
    }
  };

  const autoFill = () => {
    pushHistory();
    let pi = 0;
    setPages(prev => prev.map(p => ({ ...p, slots: p.slots.map(sl => { if (sl.photoId) return sl; const ph = photos[pi]; if (!ph) return sl; pi++; return { ...sl, photoId: ph.id }; }) })));
    toast.success('Фото розставлено');
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let done = 0;
    const newPhotos: PhotoData[] = [];
    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new window.Image();
        img.onload = () => {
          newPhotos.push({ id: 'up-' + Date.now() + '-' + Math.random(), preview: ev.target!.result as string, width: img.width, height: img.height, name: file.name });
          if (++done === files.length) { setPhotos(prev => [...prev, ...newPhotos]); toast.success(`Завантажено ${files.length} фото`); }
        };
        img.src = ev.target!.result as string;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent, pi: number, si: number) => {
    pushHistory();
    e.preventDefault();
    const photoId = e.dataTransfer?.getData('photoId') || e.dataTransfer?.getData('text/plain');
    if (!photoId) return;
    setPages(prev => prev.map((p, pi2) => pi2 !== pi ? p : {
      ...p, slots: p.slots.map((s2, si2) => si2 !== si ? s2 : { ...s2, photoId }),
    }));
  };
  const clearSlot = (pi: number, si: number) => {
    pushHistory();
    setPages(prev => prev.map((p, i) => i !== pi ? p : { ...p, slots: p.slots.map((sl, j) => j !== si ? sl : { ...sl, photoId: null }) }));
  };

  // Crop via Pointer Events — works on mouse, touch, stylus
  const startCrop = (e: React.PointerEvent, key: string, cx: number, cy: number) => {
    e.preventDefault(); e.stopPropagation();
    haptic.light();
    const [pi, si] = key.split('-').map(Number);
    const sensitivity = 30 / Math.max(0.5, pages[pi]?.slots[si]?.zoom || 1);
    startPointerDrag(e,
      (dx, dy) => setPages(prev => prev.map((p, i) => i !== pi ? p : {
        ...p, slots: p.slots.map((sl, j) => j !== si ? sl : {
          ...sl, cropX: Math.max(0,Math.min(100, cx - dx/sensitivity)),
                cropY: Math.max(0,Math.min(100, cy - dy/sensitivity))
        })
      }))
    );
  };
  // Keep legacy aliases so existing JSX doesn't break
  const startCropTouch = startCrop;

  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!textTool) { setSelectedTextId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const id = 'txt-' + Date.now();
    pushHistory();
    setPages(prev => prev.map((p, i) => i !== currentIdx ? p : { ...p, textBlocks: [...p.textBlocks, { id, text: 'Текст', x: ((e.clientX - rect.left) / cW) * 100, y: ((e.clientY - rect.top) / cH) * 100, fontSize: tFontSize, fontFamily: tFontFamily, color: tColor, bold: tBold, italic: tItalic }] }));
    setSelectedTextId(id); setEditingTextId(id); setTextTool(false);
  };

  // Per-page text helpers for spread view
  const onCanvasClickForPage = (e: React.MouseEvent<HTMLDivElement>, pageIdx: number) => {
    if (!textTool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const id = 'txt-' + Date.now();
    pushHistory();
    setPages(prev => prev.map((p, i) => i !== pageIdx ? p : { ...p, textBlocks: [...p.textBlocks, { id, text: 'Текст', x: ((e.clientX - rect.left) / pageW) * 100, y: ((e.clientY - rect.top) / cH) * 100, fontSize: tFontSize, fontFamily: tFontFamily, color: tColor, bold: tBold, italic: tItalic }] }));
    setSelectedTextId(id); setEditingTextId(id); setTextTool(false);
  };
  const updateTxtForPage = (id: string, ch: Partial<TextBlock>, pageIdx: number) => setPages(prev => prev.map((p, i) => i !== pageIdx ? p : { ...p, textBlocks: p.textBlocks.map(t => t.id === id ? { ...t, ...ch } : t) }));
  const deleteTxtForPage = (id: string, pageIdx: number) => {
    pushHistory();
    setPages(prev => prev.map((p, i) => i !== pageIdx ? p : { ...p, textBlocks: p.textBlocks.filter(t => t.id !== id) }));
    setSelectedTextId(null); setEditingTextId(null);
  };
  const startTxtDragForPage = (e: React.PointerEvent, id: string, tx: number, ty: number, pageIdx: number) => {
    e.stopPropagation(); e.preventDefault();
    haptic.light();
    startPointerDrag(e,
      (dx, dy) => updateTxtForPage(id, {
        x: Math.max(0, Math.min(95, tx + (dx/pageW)*100)),
        y: Math.max(0, Math.min(95, ty + (dy/cH)*100)),
      }, pageIdx)
    );
  };

  const updateTxt = (id: string, ch: Partial<TextBlock>) => setPages(prev => prev.map((p, i) => i !== currentIdx ? p : { ...p, textBlocks: p.textBlocks.map(t => t.id === id ? { ...t, ...ch } : t) }));
  const deleteTxt = (id: string) => { setPages(prev => prev.map((p, i) => i !== currentIdx ? p : { ...p, textBlocks: p.textBlocks.filter(t => t.id !== id) })); setSelectedTextId(null); setEditingTextId(null); };

  const startTxtDrag = (e: React.PointerEvent, id: string, tx: number, ty: number) => {
    e.stopPropagation(); e.preventDefault();
    haptic.light();
    startPointerDrag(e,
      (dx, dy) => updateTxt(id, {
        x: Math.max(0, Math.min(95, tx + (dx/cW)*100)),
        y: Math.max(0, Math.min(95, ty + (dy/cH)*100)),
      })
    );
  };

  const saveDesignerProject = async (action: 'save' | 'send_for_review' = 'save') => {
    if (!designerOrderId) return;
    setDesignerSaving(true);
    try {
      const res = await fetch('/api/designer-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: designerOrderId,
          action,
          title: config?.productName || 'Макет',
          format: config?.selectedSize || '',
          cover_type: config?.selectedCoverType || '',
          page_count: pages.length - 1,
          canvas_data: { pages, coverState, photos: photos.map(p => ({ id: p.id, name: p.name, width: p.width, height: p.height })) },
        }),
      });
      if (res.ok) {
        toast.success(action === 'send_for_review' ? 'Надіслано клієнту на узгодження!' : 'Макет збережено!');
      } else {
        toast.error('Помилка збереження');
      }
    } catch {
      toast.error('Помилка збереження');
    }
    setDesignerSaving(false);
  };

  const addToCart = () => {
    if (!config) return;
    addItem({ id: `pb-${Date.now()}`, name: config.productName || 'Фотокнига', price: dynamicPrice, qty: 1, image: getPhoto(pages[0]?.slots[0]?.photoId ?? null)?.preview || '', options: { 'Розмір': config.selectedSize || '', 'Сторінок': config.selectedPageCount }, personalization_note: `${pages.length} сторінок` });
    // Clear editor draft — user successfully added to cart
    sessionStorage.removeItem('bookEditorDraft');
    sessionStorage.removeItem('bookConstructorConfig');
    toast.success('Додано до кошика!');
    router.push('/cart');
  };

  if (!config || pages.length === 0) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;


// ── Real prices from photobook_prices table ──────────────────────────────────
// Key format: "coverType_WxH_pages"  e.g. "velour_20x20_20"
const PHOTOBOOK_PRICES: Record<string, number> = {
  // Велюр / Тканина / Шкірзамінник (same prices) — 20×20
  velour_20x20_6:1050, velour_20x20_8:1100, velour_20x20_10:1150, velour_20x20_12:1200,
  velour_20x20_14:1250, velour_20x20_16:1300, velour_20x20_18:1350, velour_20x20_20:1400,
  velour_20x20_22:1450, velour_20x20_24:1500, velour_20x20_26:1550, velour_20x20_28:1600,
  velour_20x20_30:1650, velour_20x20_32:1700, velour_20x20_34:1750, velour_20x20_36:1800,
  velour_20x20_38:1850, velour_20x20_40:1900, velour_20x20_42:1950, velour_20x20_44:2000,
  velour_20x20_46:2050, velour_20x20_48:2100, velour_20x20_50:2150,
  // Велюр — 25×25
  velour_25x25_8:1290, velour_25x25_10:1365, velour_25x25_12:1445, velour_25x25_14:1525,
  velour_25x25_16:1605, velour_25x25_18:1685, velour_25x25_20:1765, velour_25x25_22:1840,
  velour_25x25_24:1925, velour_25x25_26:2010, velour_25x25_28:2095, velour_25x25_30:2175,
  velour_25x25_32:2255, velour_25x25_34:2335, velour_25x25_36:2415, velour_25x25_38:2495,
  velour_25x25_40:2575, velour_25x25_42:2655, velour_25x25_44:2735, velour_25x25_46:2820,
  velour_25x25_48:2905, velour_25x25_50:2990,
  // Велюр — 30×30
  velour_30x30_16:1700, velour_30x30_18:1790, velour_30x30_20:1880, velour_30x30_22:1970,
  velour_30x30_24:2060, velour_30x30_26:2150, velour_30x30_28:2240, velour_30x30_30:2330,
  velour_30x30_32:2420, velour_30x30_34:2510, velour_30x30_36:2600, velour_30x30_38:2690,
  velour_30x30_40:2780, velour_30x30_42:2875, velour_30x30_44:2970, velour_30x30_46:3065,
  velour_30x30_48:3160, velour_30x30_50:3255,
  // Друкована — 20×20
  printed_20x20_6:450, printed_20x20_8:500, printed_20x20_10:550, printed_20x20_12:600,
  printed_20x20_14:650, printed_20x20_16:700, printed_20x20_18:750, printed_20x20_20:800,
  printed_20x20_22:850, printed_20x20_24:900, printed_20x20_26:950, printed_20x20_28:1000,
  printed_20x20_30:1050, printed_20x20_32:1110, printed_20x20_34:1170, printed_20x20_36:1230,
  printed_20x20_38:1290, printed_20x20_40:1350, printed_20x20_42:1410, printed_20x20_44:1470,
  printed_20x20_46:1530, printed_20x20_48:1590, printed_20x20_50:1650,
  // Друкована — 20×30
  printed_20x30_10:740, printed_20x30_12:815, printed_20x30_14:890, printed_20x30_16:965,
  printed_20x30_18:1040, printed_20x30_20:1115, printed_20x30_22:1190, printed_20x30_24:1265,
  printed_20x30_26:1340, printed_20x30_28:1415, printed_20x30_30:1490, printed_20x30_32:1565,
  printed_20x30_34:1640, printed_20x30_36:1715, printed_20x30_38:1790, printed_20x30_40:1865,
  printed_20x30_42:1940, printed_20x30_44:2015, printed_20x30_46:2090, printed_20x30_48:2165,
  printed_20x30_50:2240,
  // Друкована — 30×20
  printed_30x20_10:740, printed_30x20_12:815, printed_30x20_14:890, printed_30x20_16:965,
  printed_30x20_18:1040, printed_30x20_20:1115, printed_30x20_22:1190, printed_30x20_24:1265,
  printed_30x20_26:1340, printed_30x20_28:1415, printed_30x20_30:1490, printed_30x20_32:1565,
  printed_30x20_34:1640, printed_30x20_36:1715, printed_30x20_38:1790, printed_30x20_40:1865,
  printed_30x20_42:1940, printed_30x20_44:2015, printed_30x20_46:2090, printed_30x20_48:2165,
  printed_30x20_50:2240,
  // Друкована — 25×25
  printed_25x25_8:700, printed_25x25_10:770, printed_25x25_12:845, printed_25x25_14:995,
  printed_25x25_16:1070, printed_25x25_18:1145, printed_25x25_20:1220, printed_25x25_22:1295,
  printed_25x25_24:1370, printed_25x25_26:1445, printed_25x25_28:1520, printed_25x25_30:1595,
  printed_25x25_32:1670, printed_25x25_34:1745, printed_25x25_36:1820, printed_25x25_38:1895,
  printed_25x25_40:1970, printed_25x25_42:2045, printed_25x25_44:2120, printed_25x25_46:2195,
  printed_25x25_48:2270, printed_25x25_50:2345,
  // Друкована — 30×30
  printed_30x30_16:1105, printed_30x30_18:1190, printed_30x30_20:1275, printed_30x30_22:1360,
  printed_30x30_24:1445, printed_30x30_26:1530, printed_30x30_28:1615, printed_30x30_30:1700,
  printed_30x30_32:1785, printed_30x30_34:1840, printed_30x30_36:1960, printed_30x30_38:2050,
  printed_30x30_40:2140, printed_30x30_42:2230, printed_30x30_44:2320, printed_30x30_46:2410,
  printed_30x30_48:2500, printed_30x30_50:2590,
};

function getCoverTypeKey(coverType: string): string {
  const ct = (coverType || '').toLowerCase();
  if (ct.includes('велюр') || ct.includes('velour')) return 'velour';
  if (ct.includes('тканин') || ct.includes('fabric')) return 'velour'; // same prices as velour
  if (ct.includes('шкір') || ct.includes('leather')) return 'velour'; // same prices as velour
  if (ct.includes('друков') || ct.includes('print')) return 'printed';
  return 'velour';
}

function lookupPrice(coverType: string, sizeValue: string, pageCount: number): number {
  const ctKey = getCoverTypeKey(coverType);
  // Normalize size: "20x20", "20×20", "20x30" etc → "20x20"
  const sizeKey = (sizeValue || '20x20').replace(/[×х]/g, 'x').replace(/\s*см/g, '').trim();
  // Find exact match first
  const key = `${ctKey}_${sizeKey}_${pageCount}`;
  if (PHOTOBOOK_PRICES[key] !== undefined) return PHOTOBOOK_PRICES[key];
  // Find nearest page count (round up to nearest even)
  const nearestPages = [6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50];
  const closest = nearestPages.reduce((prev, curr) =>
    Math.abs(curr - pageCount) < Math.abs(prev - pageCount) ? curr : prev
  );
  const fallbackKey = `${ctKey}_${sizeKey}_${closest}`;
  return PHOTOBOOK_PRICES[fallbackKey] ?? config?.totalPrice ?? 0;
}

  // Dynamic price calculation using real DB prices
  const currentPageCount = Math.max(0, pages.length - 1); // exclude cover
  const sizeVal = (config.selectedSize || '20x20').replace(/[×х]/g, 'x').replace(/\s*см/g, '').trim();
  const dynamicPrice = lookupPrice(config.selectedCoverType || 'Велюр', sizeVal, currentPageCount);
  const basePageCount = parseInt(config.selectedPageCount?.match(/\d+/)?.[0] || '20');
  const basePrice = lookupPrice(config.selectedCoverType || 'Велюр', sizeVal, basePageCount);
  const priceDiff = dynamicPrice - basePrice;

  const slotDefs = cur ? getSlotDefs(cur.layout, cW, cH) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6fb' }}>

      {/* TOP BAR */}
      {isMobile ? (
        /* MOBILE: 2-row compact topbar */
        <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
          {/* Row 1: Back + title + Cart */}
          <div style={{ display:'flex', alignItems:'center', padding:'6px 10px', gap:8 }}>
            <button onClick={()=>{ if(window.confirm('Вийти з редактора?')) router.back(); }}
              style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:'#374151', padding:'4px 6px', borderRadius:6, flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:13, color:'#1e2d7d', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{config.productName || 'Фотокнига'}</div>
              <div style={{ fontSize:10, color:'#94a3b8' }}>{photos.length} фото • {pages.length} стор.</div>
            </div>
            <div style={{ fontSize:13, fontWeight:800, color:'#1e2d7d', flexShrink:0 }}>{dynamicPrice} ₴</div>
            {designerOrderId ? (
              <button onClick={()=>saveDesignerProject('save')} disabled={designerSaving}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0, opacity:designerSaving?0.6:1 }}>
                💾 Зберегти
              </button>
            ) : (
              <button onClick={addToCart}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
                ✓ Готово
              </button>
            )}
          </div>
          {/* Row 2: Авто + Undo + Zoom + Preview */}
          <div style={{ display:'flex', alignItems:'center', padding:'4px 10px 6px', gap:6, borderTop:'1px solid #f1f5f9' }}>
            <button onClick={autoFill}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', border:'1px solid #e2e8f0', borderRadius:7, background:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, color:'#1e2d7d' }}>
              <Wand2 size={12}/> Авто
            </button>
            <button onClick={undo} disabled={history.length===0}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', border:'1px solid #e2e8f0', borderRadius:7, background:'#fff', cursor:history.length===0?'not-allowed':'pointer', fontSize:12, fontWeight:600, color:history.length===0?'#cbd5e1':'#1e2d7d', opacity:history.length===0?0.5:1 }}>
              <RotateCcw size={12}/> Undo
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:4, marginLeft:'auto' }}>
              <button onClick={()=>setZoom(z=>Math.max(30,z-10))} style={{ padding:'5px 7px', border:'1px solid #d1d5db', borderRadius:6, background:'#fff', cursor:'pointer' }}><ZoomOut size={12}/></button>
              <span style={{ fontSize:11, fontWeight:700, color:'#475569', minWidth:30, textAlign:'center' }}>{zoom}%</span>
              <button onClick={()=>setZoom(z=>Math.min(130,z+10))} style={{ padding:'5px 7px', border:'1px solid #d1d5db', borderRadius:6, background:'#fff', cursor:'pointer' }}><ZoomIn size={12}/></button>
            </div>
            <button onClick={()=>setShowPreview(true)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', background:'#f0f3ff', color:'#1e2d7d', border:'1px solid #c7d2fe', borderRadius:7, fontWeight:700, fontSize:12, cursor:'pointer' }}>
              <Eye size={12}/> Перегляд
            </button>
          </div>
        </div>
      ) : (
        /* DESKTOP: original single-row topbar */
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={()=>{ if(window.confirm('Вийти з редактора? Незбережені зміни буде втрачено.')) router.back(); }}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:6, color:'#374151' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>НАЗАД</span>
            </button>
            <div style={{ width:1, height:32, background:'#e2e8f0' }}/>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#1e2d7d' }}>{config.productName || 'Фотокнига'}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>
                Редактор • {photos.length} фото • {pages.length} сторінок
                {_slug.includes('travel') ? ' • 20×30 см' : (_slug.includes('magazine')||_slug.includes('journal')||_slug.includes('zhurnal')) ? ' • A4' : config?.selectedSize ? ` • ${config.selectedSize} см` : ''}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={autoFill} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1e2d7d' }}><Wand2 size={14}/> Авто</button>
            <button onClick={undo} disabled={history.length===0} title="Скасувати (Ctrl+Z)" style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:history.length===0?'not-allowed':'pointer', fontSize:13, fontWeight:600, color:history.length===0?'#cbd5e1':'#1e2d7d', opacity:history.length===0?0.5:1 }}><RotateCcw size={14}/> Undo</button>
            <button onClick={()=>setZoom(z=>Math.max(30,z-10))} style={{ padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:6, background:'#fff', cursor:'pointer' }}><ZoomOut size={14}/></button>
            <span style={{ fontSize:12, fontWeight:700, color:'#475569', minWidth:36, textAlign:'center' }}>{zoom}%</span>
            <button onClick={()=>setZoom(z=>Math.min(130,z+10))} style={{ padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:6, background:'#fff', cursor:'pointer' }}><ZoomIn size={14}/></button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ textAlign:'right', paddingRight:4 }}>
              <div style={{ fontSize:11, color:'#94a3b8' }}>{pages.length-1} стор. ({Math.ceil((pages.length-1)/2)} розворот{Math.ceil((pages.length-1)/2)===1?'':'и'})</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#1e2d7d' }}>{dynamicPrice} ₴{priceDiff!==0&&<span style={{ fontSize:11, color:priceDiff>0?'#10b981':'#ef4444', marginLeft:4 }}>{priceDiff>0?'+':''}{priceDiff}₴</span>}</div>
            </div>
            <button onClick={()=>setShowPreview(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', background:'#f0f3ff', color:'#1e2d7d', border:'1px solid #c7d2fe', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer' }}><Eye size={14}/> Попередній перегляд</button>
            <button onClick={()=>{ setTooltipStep(0); setShowTooltips(true); }} title="Підказки" style={{ padding:'9px 10px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' }}><HelpCircle size={14}/></button>
            {designerOrderId ? (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>saveDesignerProject('save')} disabled={designerSaving}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', opacity:designerSaving?0.6:1 }}>
                  💾 Зберегти макет
                </button>
                <button onClick={()=>saveDesignerProject('send_for_review')} disabled={designerSaving}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'#0891b2', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', opacity:designerSaving?0.6:1 }}>
                  ✉️ Надіслати на узгодження
                </button>
              </div>
            ) : (
              <button onClick={addToCart} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 22px', background:'#16a34a', color:'#fff', border:'none', borderRadius:10, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 4px 16px rgba(22,163,74,0.35)' }}>✓ Зберегти та замовити</button>
            )}
          </div>
        </div>
      )}

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>

        {/* ICON SIDEBAR — desktop only */}
        {!isMobile && <div style={{ width: 72, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, borderRight: '1px solid #f1f5f9', flexShrink: 0 }}>
          {([
            ['photos', <ImageIcon key="p" size={20}/>, 'Зображення'],
            ['layouts', <LayoutGrid key="l" size={20}/>, 'Шаблон'],
            ['text', <Type key="t" size={20}/>, 'Текст'],
            ['bg', <span key="bg" style={{fontSize:16,fontWeight:700}}>Фн</span>, 'Фон'],
            ['shapes', <span key="sh" style={{fontSize:16,fontWeight:700}}>◻</span>, 'Фігури'],
            ['stickers', <span key="stk" style={{fontSize:16}}>★</span>, 'Стікери'],
            ['frames', <span key="fr" style={{fontSize:16,fontWeight:700}}>⬜</span>, 'Рамки'],
            ...(hasKalka?[['kalka', <span key="kl" style={{fontSize:13,fontWeight:700}}>КЛ</span>, 'Калька']]:[] as any),
            ...(hasEndpaper?[['endpaper', <span key="ep" style={{fontSize:11,fontWeight:700}}>ФЗ</span>, 'Форзац']]:[] as any),
            ...(currentIdx===0?[['cover', <span key="cv" style={{fontSize:18}}>▣</span>, 'Обкладинка']]:[] as any),
          ] as [string, React.ReactNode, string][]).map(([id, icon, label]) => (
            <button key={id} onClick={() => { setLeftTab(id as any); if (id === 'layouts' && currentIdx === 0) setCurrentIdx(1); }}
              style={{ width: '100%', padding: '12px 4px', border: 'none', cursor: 'pointer', background: leftTab === id ? '#1e2d7d' : 'transparent', color: leftTab === id ? '#fff' : '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, marginBottom: 2, transition: 'background 0.15s' }}>
              {icon}
              <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
            </button>
          ))}
        </div>}

        {/* CONTENT PANEL — desktop only, mobile uses bottom sheet */}
        {!isMobile && <div style={{ width: 200, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: 12, color: '#1e2d7d' }}>
            {({'photos':'Зображення','layouts':'Шаблон','text':'Текст','bg':'Фон','shapes':'Фігури','frames':'Рамки','stickers':'Стікери','options':'Опції','cover':'Обкладинка'} as Record<string,string>)[leftTab] || leftTab}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>

            {/* PHOTOS */}
            {leftTab === 'photos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 8px', border: '2px dashed #263a99', borderRadius: 10, background: '#f0f3ff', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#1e2d7d', width: '100%' }}>
                  <ImageIcon size={15} /> Завантажити фото
                </button>
                {/* Add free slot button — only on content pages */}
                {currentIdx !== 0 && (
                  <button onClick={addFreeSlot}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 8px', border: '2px dashed #10b981', borderRadius: 10, background: '#f0fdf4', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#059669', width: '100%' }}>
                    + Додати слот вручну
                  </button>
                )}

                {/* Free slot shape controls */}
                {(() => {
                  // Find selected slot across ALL pages
                  let selectedSlot: FreeSlot | null = null;
                  let selectedSlotPageIdx = -1;
                  if (selectedFreeSlotId) {
                    for (const [pi, slots] of Object.entries(freeSlots)) {
                      const found = (slots as FreeSlot[]).find(s => s.id === selectedFreeSlotId);
                      if (found) { selectedSlot = found; selectedSlotPageIdx = Number(pi); break; }
                    }
                  }
                  return (
                    <FreeSlotControls
                      selectedSlot={selectedSlot}
                      onChangeShape={(shape: SlotShape) => {
                        if (!selectedSlot || selectedSlotPageIdx < 0) return;
                        setFreeSlots(prev => ({
                          ...prev,
                          [selectedSlotPageIdx]: (prev[selectedSlotPageIdx] || []).map(s =>
                            s.id === selectedFreeSlotId ? { ...s, shape } : s
                          )
                        }));
                      }}
                    />
                  );
                })()}

                {photos.length === 0 && <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: 0 }}>Додайте фото щоб почати</p>}
                {tapSelectedPhotoId && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 11, color: '#1d4ed8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    👆 Тапніть фотослот щоб розмістити фото
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {photos.map((ph, i) => {
                    const used = usedIds.has(ph.id);
                    return (
                      <div key={ph.id} draggable={!used}
                        onDragStart={e => { if(used) return; setDragPhotoId(ph.id); e.dataTransfer.setData('photoId', ph.id); e.dataTransfer.setData('text/plain', ph.id); e.dataTransfer.effectAllowed='copy'; }}
                        onDragEnd={() => { setDragPhotoId(null); setDropTarget(null); }}
                        onClick={() => { if (!used) setTapSelectedPhotoId(tapSelectedPhotoId === ph.id ? null : ph.id); }}
                        style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', cursor: used ? 'default' : 'pointer', opacity: used ? 0.45 : 1, border: tapSelectedPhotoId === ph.id ? '2px solid #3b82f6' : '1px solid #e2e8f0', outline: tapSelectedPhotoId === ph.id ? '2px solid rgba(59,130,246,0.4)' : 'none' }}>
                        <img src={ph.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                        {used && <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✓</div>}
                        {tapSelectedPhotoId === ph.id && <div style={{ position: 'absolute', inset: 0, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👆</div>}
                        <span style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LAYOUTS */}
            {leftTab === 'layouts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['1 фото', '2 фото', '3 фото', '4 фото', '5 фото', '6 фото', '7–9 фото', 'Текст'].map(group => {
                  const gl = LAYOUTS.filter(l => l.group === group);
                  return (
                    <div key={group}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', padding: '8px 4px 4px', textTransform: 'uppercase' }}>{group}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {gl.map(l => {
                          const activeIdx = getActivePageIdx();
                          const active = pages[activeIdx]?.layout === l.id;
                          return (
                            <button key={l.id} onClick={() => changeLayout(l.id, activeIdx)} title={l.label}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '7px 4px', border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: active ? '#1e2d7d' : '#fff', cursor: 'pointer' }}>
                              <LayoutSVG layout={l.id} active={active} />
                              <span style={{ fontSize: 9, fontWeight: 600, color: active ? '#fff' : '#374151', textAlign: 'center', lineHeight: 1.2 }}>{l.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>

                  <button onClick={() => { const idx = getActivePageIdx(); setPages(prev => prev.map((p, i) => i !== idx ? p : { ...p, slots: makeSlots(LAYOUTS.find(l => l.id === p.layout)?.slots || 0) })); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff7f7', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#ef4444', width: '100%' }}>
                    <RotateCcw size={13} /> Очистити сторінку
                  </button>
                </div>
              </div>
            )}

            {/* COVER */}
            {leftTab === 'cover' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* PRINTED COVER CONTROLS — for all printed/soft-cover products */}
                {isPrinted && (() => {
                  const pt = coverState.printedTextBlocks ?? [];
                  const ov = coverState.printedOverlay ?? { type:'none', color:'#000000', opacity:40, gradient:'linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.6) 100%)' };
                  const ps = coverState.printedPhotoSlot ?? { x:0, y:0, w:100, h:100, shape:'rect' };
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {/* Photo slot shape */}
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Форма фотослота</div>
                        <div style={{ display:'flex', gap:4 }}>
                          {(['rounded','circle'] as const).map(sh => (
                            <button key={sh} onClick={()=>setCoverState(p=>({...p,printedPhotoSlot:{...ps,shape:sh}}))}
                              style={{ flex:1, padding:'6px 4px', border: ps.shape===sh ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius:6, background: ps.shape===sh ? '#f0f3ff' : '#fff', cursor:'pointer', fontSize:16 }}>
                              {sh==='rounded'?'▢':'◯'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Reset slot */}
                      <button onClick={()=>setCoverState(p=>({...p,printedPhotoSlot:{x:0,y:0,w:100,h:100,shape:'rect'}}))}
                        style={{ padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', cursor:'pointer', fontSize:11, fontWeight:600, color:'#64748b' }}>
                        ↺ На весь розмір
                      </button>
                      {/* Overlay */}
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Накладення</div>
                        <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                          {(['none','color','gradient'] as const).map(ot => (
                            <button key={ot} onClick={()=>setCoverState(p=>({...p,printedOverlay:{...ov,type:ot}}))}
                              style={{ flex:1, padding:'5px 2px', border: ov.type===ot ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius:6, background: ov.type===ot ? '#f0f3ff' : '#fff', cursor:'pointer', fontSize:9, fontWeight:700, color: ov.type===ot ? '#1e2d7d' : '#64748b' }}>
                              {ot==='none'?'Немає':ot==='color'?'Колір':'Градієнт'}
                            </button>
                          ))}
                        </div>
                        {ov.type === 'color' && (
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <input type="color" value={ov.color} onChange={e=>setCoverState(p=>({...p,printedOverlay:{...ov,color:e.target.value}}))}
                              style={{ width:32, height:28, border:'none', borderRadius:4, cursor:'pointer' }}/>
                            <input type="range" min={5} max={90} value={ov.opacity} onChange={e=>setCoverState(p=>({...p,printedOverlay:{...ov,opacity:+e.target.value}}))}
                              style={{ flex:1 }}/>
                            <span style={{ fontSize:10, color:'#94a3b8', minWidth:28 }}>{ov.opacity}%</span>
                          </div>
                        )}
                      </div>
                      {/* Add text */}
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Текст на обкладинці</div>
                        <button onClick={()=>setCoverState(p=>({...p,printedTextBlocks:[...(p.printedTextBlocks||[]),{id:'ptxt-'+Date.now(),text:'Ваш текст',x:50,y:50,fontSize:24,fontFamily:'Playfair Display',color:'#ffffff',bold:true}]}))}
                          style={{ width:'100%', padding:'7px 10px', border:'1px dashed #c7d2fe', borderRadius:8, background:'#f0f3ff', cursor:'pointer', fontSize:12, fontWeight:700, color:'#1e2d7d' }}>
                          + Додати текст
                        </button>
                        {pt.map(tb => (
                          <div key={tb.id} style={{ marginTop:6, padding:'6px 8px', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', display:'flex', flexDirection:'column', gap:4 }}>
                            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                              <input value={tb.text} onChange={e=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,text:e.target.value}:t)}))}
                                style={{ flex:1, padding:'3px 6px', border:'1px solid #e2e8f0', borderRadius:4, fontSize:11 }}/>
                              <button onClick={()=>setCoverState(p=>({...p,printedTextBlocks:pt.filter(t=>t.id!==tb.id)}))}
                                style={{ width:20, height:20, borderRadius:'50%', background:'#ef4444', color:'#fff', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                            </div>
                            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                              <input type="color" value={tb.color} onChange={e=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,color:e.target.value}:t)}))}
                                style={{ width:24, height:24, border:'none', borderRadius:3, cursor:'pointer' }}/>
                              <input type="range" min={10} max={72} value={tb.fontSize} onChange={e=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,fontSize:+e.target.value}:t)}))}
                                style={{ flex:1 }}/>
                              <span style={{ fontSize:10, color:'#94a3b8', minWidth:20 }}>{tb.fontSize}</span>
                              <button onClick={()=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,bold:!t.bold}:t)}))}
                                style={{ padding:'2px 6px', border: tb.bold?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:4, background: tb.bold?'#f0f3ff':'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>B</button>
                            </div>
                            <select value={tb.fontFamily} onChange={e=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,fontFamily:e.target.value}:t)}))}
                              style={{ width:'100%', padding:'4px 6px', border:'1px solid #e2e8f0', borderRadius:5, fontSize:11, cursor:'pointer', fontFamily:tb.fontFamily }}>
                              {[
                                ['Playfair Display','Playfair Display'],
                                ['Cormorant Garamond','Cormorant Garamond'],
                                ['Cinzel','Cinzel'],
                                ['EB Garamond','EB Garamond'],
                                ['Dancing Script','Dancing Script'],
                                ['Great Vibes','Great Vibes'],
                                ['Pinyon Script','Pinyon Script'],
                                ['Sacramento','Sacramento'],
                                ['Pacifico','Pacifico'],
                                ['Lobster','Lobster'],
                                ['Caveat','Caveat'],
                                ['Montserrat','Montserrat'],
                                ['Raleway','Raleway'],
                                ['Oswald','Oswald'],
                                ['Bebas Neue','Bebas Neue'],
                              ].map(([val, label]) => (
                                <option key={val} value={val} style={{ fontFamily:val }}>{label}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Printed cover — bg color + back cover controls */}
                {isPrinted && (
                  <div style={{ display:'flex', flexDirection:'column', gap:10, borderTop:'1px solid #f1f5f9', paddingTop:10 }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Колір фону передньої</div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="color" value={coverState.printedBgColor || '#ffffff'}
                          onChange={e=>setCoverState(p=>({...p,printedBgColor:e.target.value}))}
                          style={{ width:36, height:28, border:'1px solid #e2e8f0', borderRadius:5, cursor:'pointer', padding:2 }}/>
                        <span style={{ fontSize:10, color:'#94a3b8' }}>{coverState.printedBgColor || '#ffffff'}</span>
                        <button onClick={()=>setCoverState(p=>({...p,printedBgColor:'#ffffff'}))}
                          style={{ padding:'3px 7px', border:'1px solid #e2e8f0', borderRadius:5, fontSize:10, cursor:'pointer', color:'#64748b', background:'#f8fafc' }}>↺</button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Задня обкладинка</div>
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
                        <span style={{ fontSize:10, color:'#94a3b8', flexShrink:0 }}>Колір фону</span>
                        <input type="color" value={coverState.backCoverBgColor || '#f1f5f9'}
                          onChange={e=>setCoverState(p=>({...p,backCoverBgColor:e.target.value}))}
                          style={{ width:30, height:24, border:'1px solid #e2e8f0', borderRadius:4, cursor:'pointer', padding:1 }}/>
                        <button onClick={()=>setCoverState(p=>({...p,backCoverBgColor:'#f1f5f9'}))}
                          style={{ padding:'2px 6px', border:'1px solid #e2e8f0', borderRadius:4, fontSize:10, cursor:'pointer', color:'#64748b', background:'#f8fafc' }}>↺</button>
                      </div>
                      <div style={{ fontSize:10, color:'#94a3b8', marginBottom:4 }}>Перетягніть фото прямо на задню обкладинку</div>
                      {coverState.backCoverPhotoId && (
                        <button onClick={()=>setCoverState(p=>({...p,backCoverPhotoId:null}))}
                          style={{ width:'100%', padding:'5px', fontSize:11, color:'#ef4444', background:'#fff7f7', border:'1px solid #fee2e2', borderRadius:6, cursor:'pointer' }}>
                          × Видалити фото з задньої
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  {/* Photo picker for acrylic/photo insert */}
                  {(coverState.decoType === 'acryl' || coverState.decoType === 'photovstavka') && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>
                        Фото для вставки — перетягніть на рамку
                      </div>
                      {photos.length === 0 ? (
                        <div style={{ fontSize:10, color:'#94a3b8', padding:'8px', background:'#f8fafc', borderRadius:6, textAlign:'center' }}>
                          Спочатку завантажте фото у вкладці Зображення
                        </div>
                      ) : (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4 }}>
                          {photos.slice(0,9).map(ph => (
                            <div key={ph.id}
                              draggable
                              onDragStart={e => { e.dataTransfer.setData('photoId', ph.id); e.dataTransfer.setData('text/plain', ph.id); e.dataTransfer.effectAllowed='copy'; }}
                              style={{ aspectRatio:'1', borderRadius:4, overflow:'hidden', cursor:'grab', border: coverState.photoId===ph.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0' }}>
                              <img src={ph.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>
                            </div>
                          ))}
                        </div>
                      )}
                      {coverState.photoId && (
                        <button onClick={() => setCoverState(prev=>({...prev, photoId:null}))}
                          style={{ marginTop:4, width:'100%', padding:'4px', fontSize:10, color:'#ef4444', background:'#fff7f7', border:'1px solid #fee2e2', borderRadius:4, cursor:'pointer' }}>
                          × Видалити фото з вставки
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cover color picker */}
                  {config?.selectedCoverType && config.selectedCoverType !== 'Друкована' && (() => {
                    const mat = config.selectedCoverType?.toLowerCase() || '';
                    const colors = mat.includes('шкір') ? LEATHERETTE_COLORS : mat.includes('тканин') ? FABRIC_COLORS : {
                      'Молочний':'#F0EAD6','Бежевий':'#D9C8B0','Таупе':'#A89880','Рожевий':'#E8B4B8',
                      'Бордо':'#7A2838','Сірий перловий':'#9A9898','Лаванда':'#B8A8C8','Синій':'#1A2040',
                      'Графітовий':'#3A3038','Бірюзовий':'#1A9090','Марсала':'#6E2840','Блакитно-сірий':'#607080',
                      'Темно-зелений':'#1E3028','Жовтий':'#D4A020',
                    };
                    return (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Колір обкладинки</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:4 }}>
                          {Object.entries(colors).map(([name, hex]) => (
                            <button key={name} title={name}
                              onClick={() => setCoverColorOverride(name)}
                              style={{ width:24, height:24, borderRadius:'50%', background:hex,
                                border: effectiveCoverColor === name ? '3px solid #1e2d7d' : '1.5px solid #e2e8f0',
                                cursor:'pointer', flexShrink:0,
                                boxShadow: effectiveCoverColor === name ? '0 0 0 2px #fff, 0 0 0 3px #1e2d7d' : 'none',
                                transition:'all 0.12s',
                              }}/>
                          ))}
                        </div>
                        {effectiveCoverColor && (
                          <div style={{ fontSize:10, color:'#64748b' }}>{effectiveCoverColor}</div>
                        )}
                      </div>
                    );
                  })()}
                  <div style={{ fontSize:11, fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6, display: isPrinted ? 'none' : 'block' }}>ОЗДОБЛЕННЯ</div>
                  <div style={{ display: isPrinted ? 'none' : 'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', border:'2px solid #1e2d7d', borderRadius:8, background:'#f0f3ff' }}>
                    <span style={{ fontWeight:700, fontSize:13, color:'#1e2d7d' }}>
                      {({'none':'Без оздоблення','acryl':'Акрил','photovstavka':'Фотовставка','metal':'Металева вставка','flex':'Флекс','graviruvannya':'Гравірування'} as Record<string,string>)[coverState.decoType] || 'Без'}
                      {coverState.decoVariant ? <span style={{ fontWeight:400, color:'#64748b', marginLeft:6, fontSize:11 }}>{coverState.decoVariant}</span> : null}
                    </span>
                    <button onClick={() => setShowDecoList(v=>!v)} style={{ fontSize:11, fontWeight:700, color:'#1e2d7d', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                      {showDecoList ? 'Сховати' : 'Змінити'}
                    </button>
                  </div>
                  {showDecoList && !isPrinted && (
                    <div style={{ display:'flex', flexDirection:'column', gap:3, marginTop:4 }}>
                      {(['none','acryl','photovstavka','metal','flex','graviruvannya'] as CoverDecoType[]).map(id => (
                        <button key={id} onClick={() => {
                          const sizeKey = (config?.selectedSize || '20x20').replace(/[×х]/g,'x').replace(/\s*см/g,'').trim();
                          const firstVariant =
                            id==='metal' ? (METAL_VARIANTS[sizeKey]||METAL_VARIANTS['20x20']||[''])[0] :
                            id==='acryl' ? (ACRYLIC_VARIANTS[sizeKey]||ACRYLIC_VARIANTS['20x20']||[''])[0] :
                            id==='photovstavka' ? (PHOTO_INSERT_VARIANTS[sizeKey]||PHOTO_INSERT_VARIANTS['20x20']||[''])[0] : '';
                          const firstColor = id==='metal' ? 'gold' : id==='flex' ? 'gold' : '#D4AF37';
                          setCoverState(prev=>({...prev, decoType:id as CoverDecoType, decoVariant:firstVariant, decoColor:firstColor}));
                          setShowDecoList(false);
                        }}
                          style={{ padding:'7px 12px', border:coverState.decoType===id?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:coverState.decoType===id?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:600, fontSize:12, color:coverState.decoType===id?'#1e2d7d':'#374151', textAlign:'left' }}>
                          {({'none':'Без оздоблення','acryl':'Акрил','photovstavka':'Фотовставка','metal':'Металева вставка','flex':'Флекс','graviruvannya':'Гравірування'} as Record<string,string>)[id]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {coverState.decoType==='flex' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5 }}>Колір флексу</div>
                      <div style={{ display:'flex', gap:6 }}>
                        {([{v:'gold',c:'#D4AF37',l:'Золотий'},{v:'silver',c:'#C0C0C0',l:'Срібний'},{v:'white',c:'#FFFFFF',l:'Білий'},{v:'black',c:'#1A1A1A',l:'Чорний'}]).map(fc => (
                          <button key={fc.v} onClick={() => setCoverState(prev=>({...prev, decoColor:fc.v}))} title={fc.l}
                            style={{ width:28, height:28, borderRadius:'50%', background:fc.c, border:coverState.decoColor===fc.v?'3px solid #1e2d7d':'2px solid #e2e8f0', cursor:'pointer', boxShadow:fc.v==='white'?'inset 0 0 0 1px #d1d5db':'' }}/>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>Шрифт</div>
                      <select value={coverState.textFontFamily} onChange={e=>setCoverState(prev=>({...prev,textFontFamily:e.target.value}))}
                        style={{ width:'100%', padding:'6px 8px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12 }}>
                        <optgroup label="Кириличні каліграфічні"><option value="Marck Script">Marck Script</option><option value="Caveat">Caveat</option><option value="Philosopher">Philosopher</option><option value="Comfortaa">Comfortaa</option><option value="Lobster">Lobster</option></optgroup>
                        <optgroup label="Латинські каліграфічні"><option value="Dancing Script">Dancing Script</option><option value="Great Vibes">Great Vibes</option><option value="Pinyon Script">Pinyon Script</option><option value="Sacramento">Sacramento</option><option value="Pacifico">Pacifico</option></optgroup>
                        <optgroup label="Елегантні"><option value="Playfair Display">Playfair Display</option><option value="Cormorant Garamond">Cormorant Garamond</option><option value="Cinzel">Cinzel</option><option value="Montserrat">Montserrat</option></optgroup>
                      </select>
                    </div>
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#94a3b8', marginBottom:3 }}><span>Розмір</span><span>{coverState.textFontSize||24}px</span></div>
                      <input type="range" min={12} max={80} value={coverState.textFontSize||24} onChange={e=>setCoverState(prev=>({...prev,textFontSize:+e.target.value}))} style={{ width:'100%' }}/>
                    </div>
                  </div>
                )}
                {coverState.decoType==='graviruvannya' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>Шрифт</div>
                      <select value={coverState.textFontFamily} onChange={e=>setCoverState(prev=>({...prev,textFontFamily:e.target.value}))}
                        style={{ width:'100%', padding:'6px 8px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12 }}>
                        <optgroup label="Кириличні каліграфічні"><option value="Marck Script">Marck Script</option><option value="Caveat">Caveat</option><option value="Philosopher">Philosopher</option><option value="Comfortaa">Comfortaa</option></optgroup>
                        <optgroup label="Латинські каліграфічні"><option value="Dancing Script">Dancing Script</option><option value="Great Vibes">Great Vibes</option><option value="Sacramento">Sacramento</option></optgroup>
                        <optgroup label="Елегантні"><option value="Playfair Display">Playfair Display</option><option value="Cinzel">Cinzel</option><option value="Cormorant Garamond">Cormorant Garamond</option></optgroup>
                      </select>
                    </div>
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#94a3b8', marginBottom:3 }}><span>Розмір</span><span>{coverState.textFontSize||24}px</span></div>
                      <input type="range" min={12} max={80} value={coverState.textFontSize||24} onChange={e=>setCoverState(prev=>({...prev,textFontSize:+e.target.value}))} style={{ width:'100%' }}/>
                    </div>
                  </div>
                )}
                {/* Variant selector — shows for acryl, photovstavka, metal */}
                {(() => {
                  const sizeKey = (config?.selectedSize || '20x20').replace(/[×х]/g,'x').replace(/\s*см/g,'').trim();
                  const variants =
                    coverState.decoType==='acryl' ? (ACRYLIC_VARIANTS[sizeKey] || ACRYLIC_VARIANTS['20x20'] || ['100×100 мм']) :
                    coverState.decoType==='photovstavka' ? (PHOTO_INSERT_VARIANTS[sizeKey] || PHOTO_INSERT_VARIANTS['20x20'] || ['100×100 мм']) :
                    coverState.decoType==='metal' ? (METAL_VARIANTS[sizeKey] || METAL_VARIANTS['20x20'] || ['60×60 золотий','60×60 срібний']) :
                    [];
                  if (!variants.length) return null;
                  // Auto-select first variant when none selected or decoType just changed
                  if (!coverState.decoVariant && variants.length > 0) {
                    setTimeout(() => setCoverState(prev => prev.decoVariant ? prev : ({...prev, decoVariant: variants[0]})), 0);
                  }
                  return (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5 }}>Розмір вставки</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {variants.map(v => (
                          <button key={v} onClick={() => setCoverState(prev => {
                            const patch: any = { decoVariant: v };
                            // Auto-set metal color from variant name
                            if (prev.decoType === 'metal') {
                              if (v.includes('золотий')) patch.decoColor = 'gold';
                              else if (v.includes('срібний')) patch.decoColor = 'silver';
                            }
                            return {...prev, ...patch};
                          })}
                            style={{ padding:'5px 9px', border:coverState.decoVariant===v?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background:coverState.decoVariant===v?'#f0f3ff':'#fff', cursor:'pointer', fontSize:11, fontWeight:600, color:coverState.decoVariant===v?'#1e2d7d':'#374151' }}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {(coverState.decoType === 'flex' || coverState.decoType === 'graviruvannya') && (
                <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Написи на обкладинці</div>
                  <button onClick={() => setCoverState(prev=>({...prev, extraTexts:[...(prev.extraTexts||[]), {id:'et-'+Date.now(), text:'Ваш напис', x:50, y:75, fontFamily:prev.textFontFamily||'Marck Script', fontSize:20, color:'#ffffff'}]}))}
                    style={{ width:'100%', padding:'7px', border:'1px dashed #1e2d7d', borderRadius:8, background:'#f0f3ff', cursor:'pointer', fontWeight:700, fontSize:12, color:'#1e2d7d', marginBottom:6 }}>
                    + Додати напис
                  </button>
                  {(coverState.extraTexts||[]).map(et => (
                    <div key={et.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', border:'1px solid #e2e8f0', borderRadius:6, background:'#f8fafc', marginBottom:4 }}>
                      <span style={{ flex:1, fontSize:11, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{et.text}</span>
                      <input type="color" value={et.color.startsWith('#')?et.color:'#ffffff'} onChange={e=>setCoverState(prev=>({...prev,extraTexts:(prev.extraTexts||[]).map(t2=>t2.id===et.id?{...t2,color:e.target.value}:t2)}))} style={{ width:22, height:22, border:'none', padding:0, cursor:'pointer' }}/>
                      <button onClick={() => setCoverState(prev=>({...prev,extraTexts:(prev.extraTexts||[]).filter(t2=>t2.id!==et.id)}))} style={{ width:18, height:18, borderRadius:'50%', background:'#fee2e2', color:'#ef4444', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>x</button>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}
            {/* BACKGROUND */}
            {leftTab === 'bg' && (
              <BackgroundControls
                bg={getCurBg(currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide)}
                onChange={bg => {
                  const idx = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
                  setPageBgs(prev=>({...prev,[idx]:bg}));
                }}
              />
            )}

            {/* SHAPES */}
            {leftTab === 'shapes' && (() => {
              const spi = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
              const shapes = getCurShapes(spi);
              // Search both pages of spread for the selected shape
              const allSpreadIdxs = currentIdx===0 ? [0] : [(currentIdx-1)*2+1, (currentIdx-1)*2+2];
              let selShape = null as typeof shapes[0] | null;
              let selSpi = spi;
              for (const pi of allSpreadIdxs) {
                const found = getCurShapes(pi).find(s=>s.id===selectedShapeId);
                if (found) { selShape = found; selSpi = pi; break; }
              }
              return (
                <ShapeControls
                  selectedShape={selShape}
                  onChange={patch => {
                    if (!selShape) return;
                    setPageShapes(prev=>({...prev,[selSpi]:(prev[selSpi]||[]).map(s=>s.id===selShape!.id?{...s,...patch}:s)}));
                  }}
                  onAdd={type => addShape(type, spi)}
                />
              );
            })()}

            {/* FRAMES */}
            {leftTab === 'frames' && (
              <FrameControls
                frame={getCurFrame(currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide)}
                onChange={frame => {
                  const idx = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
                  setPageFrames(prev=>({...prev,[idx]:frame}));
                }}
              />
            )}

            {/* КАЛЬКА */}
            {(leftTab as string) === 'kalka' && hasKalka && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'8px 10px', fontSize:11, color:'#1d4ed8' }}>
                  Калька — напівпрозора сторінка перед першою фотосторінкою
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Ілюстрація</div>
                  <input ref={kalkaImageInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setKalkaState(p => ({ ...p, imageUrl: URL.createObjectURL(f as Blob) }));
                  }}/>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => kalkaImageInputRef.current?.click()}
                      style={{ flex:1, padding:'8px 10px', border:'1.5px dashed #c7d2fe', borderRadius:8, background:'#f0f3ff', cursor:'pointer', fontSize:12, fontWeight:600, color:'#1e2d7d' }}>
                      📎 Завантажити зображення
                    </button>
                    {kalkaState.imageUrl && (
                      <button onClick={() => setKalkaState(p => ({ ...p, imageUrl: null }))}
                        style={{ padding:'8px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff7f7', cursor:'pointer', fontSize:11, color:'#ef4444' }}>✕</button>
                    )}
                  </div>
                  {kalkaState.imageUrl && (
                    <img src={kalkaState.imageUrl} style={{ marginTop:6, width:'100%', maxHeight:80, objectFit:'contain', borderRadius:6, border:'1px solid #e2e8f0' }}/>
                  )}
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Напис</div>
                  <textarea value={kalkaState.text} onChange={e => setKalkaState(p=>({...p,text:e.target.value}))}
                    placeholder="Введіть напис (необов'язково)"
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, resize:'vertical', minHeight:56, boxSizing:'border-box' }}/>
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Шрифт</div>
                  <select value={kalkaState.fontFamily} onChange={e => setKalkaState(p=>({...p,fontFamily:e.target.value}))}
                    style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 }}>
                    {['Playfair Display','Great Vibes','Cormorant Garamond','Montserrat','Open Sans','Dancing Script','Pacifico','Caveat','Lato','Raleway'].map(f=>(
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>Розмір: {kalkaState.fontSize}px</div>
                    <input type="range" min={12} max={72} value={kalkaState.fontSize}
                      onChange={e => setKalkaState(p=>({...p,fontSize:+e.target.value}))} style={{ width:'100%' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>Колір</div>
                    <label style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 8px', position:'relative', overflow:'hidden' }}>
                      <div style={{ width:24, height:24, borderRadius:4, background:kalkaState.textColor, border:'1px solid rgba(0,0,0,0.1)' }}/>
                      <input type="color" value={kalkaState.textColor} onChange={e=>setKalkaState(p=>({...p,textColor:e.target.value}))}
                        style={{ position:'absolute', inset:0, opacity:0.01, width:'100%', height:'100%', cursor:'pointer' }}/>
                    </label>
                  </div>
                </div>
              </div>
            )}


            {/* ФОРЗАЦ */}
            {(leftTab as string) === 'endpaper' && hasEndpaper && (() => {
              const renderEp = (key: 'first' | 'last', label: string) => {
                const ep = endpaperState[key];
                return (
                  <div key={key} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:'12px', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#1e2d7d' }}>{label}</span>
                      <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:11, color:'#64748b' }}>
                        <input type="checkbox" checked={ep.enabled} onChange={e=>setEndpaperState(p=>({...p,[key]:{...p[key],enabled:e.target.checked}}))}/>
                        Друк на форзаці +200₴
                      </label>
                    </div>
                    {!ep.enabled && (
                      <div style={{ fontSize:11, color:'#94a3b8', padding:'6px 0' }}>Білий (без друку)</div>
                    )}
                    {ep.enabled && (
                      <>
                        <div style={{ marginBottom:8 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5 }}>Ілюстрація</div>
                          <input type="file" accept="image/*" style={{ display:'none' }}
                            ref={el => { endpaperImageRef.current[key] = el; }}
                            onChange={e => {
                              const f = e.target.files?.[0]; if (!f) return;
                              setEndpaperState(p=>({...p,[key]:{...p[key],imageUrl:URL.createObjectURL(f as Blob)}}));
                            }}/>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={()=>endpaperImageRef.current[key]?.click()}
                              style={{ flex:1, padding:'7px', border:'1.5px dashed #c7d2fe', borderRadius:8, background:'#f0f3ff', cursor:'pointer', fontSize:11, fontWeight:600, color:'#1e2d7d' }}>
                              📎 Завантажити
                            </button>
                            {ep.imageUrl && <button onClick={()=>setEndpaperState(p=>({...p,[key]:{...p[key],imageUrl:null}}))}
                              style={{ padding:'7px 10px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff7f7', cursor:'pointer', color:'#ef4444', fontSize:11 }}>✕</button>}
                          </div>
                          {ep.imageUrl && <img src={ep.imageUrl} style={{ marginTop:6, width:'100%', maxHeight:70, objectFit:'contain', borderRadius:6, border:'1px solid #e2e8f0' }}/>}
                        </div>
                        <div style={{ marginBottom:8 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5 }}>Напис</div>
                          <textarea value={ep.text} onChange={e=>setEndpaperState(p=>({...p,[key]:{...p[key],text:e.target.value}}))}
                            placeholder="Напис на форзаці"
                            style={{ width:'100%', padding:'7px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, resize:'none', height:48, boxSizing:'border-box' }}/>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Колір тексту</span>
                          <label style={{ display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'5px 8px', position:'relative', overflow:'hidden' }}>
                            <div style={{ width:20, height:20, borderRadius:4, background:ep.textColor, border:'1px solid rgba(0,0,0,0.1)' }}/>
                            <input type="color" value={ep.textColor} onChange={e=>setEndpaperState(p=>({...p,[key]:{...p[key],textColor:e.target.value}}))}
                              style={{ position:'absolute', inset:0, opacity:0.01, width:'100%', height:'100%', cursor:'pointer' }}/>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                );
              };
              return (
                <div>
                  <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:8, padding:'8px 10px', fontSize:11, color:'#92400e', marginBottom:12 }}>
                    Форзац — перша та остання сторінка книги. За замовчуванням білі. Друк на форзаці +200₴
                  </div>
                  {renderEp('first', 'Перший форзац (ліва сторінка)')}
                  {renderEp('last', 'Останній форзац (права сторінка)')}
                </div>
              );
            })()}

            {/* TEXT */}
            {leftTab === 'stickers' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input type="text" placeholder="Пошук стікерів..." 
                  style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, outline:'none' }}/>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                  {[
                    {name:'Серце', emoji:'❤️', url:''},
                    {name:'Зірка', emoji:'⭐', url:''},
                    {name:'Сонце', emoji:'☀️', url:''},
                    {name:'Квітка', emoji:'🌸', url:''},
                    {name:'Корона', emoji:'👑', url:''},
                    {name:'Метелик', emoji:'🦋', url:''},
                    {name:'Місяць', emoji:'🌙', url:''},
                    {name:'Хмара', emoji:'☁️', url:''},
                    {name:'Діамант', emoji:'💎', url:''},
                    {name:'Веселка', emoji:'🌈', url:''},
                    {name:"Полум'я", emoji:'🔥', url:''},
                    {name:'Блискавка', emoji:'⚡', url:''},
                    {name:'Зірочки', emoji:'✨', url:''},
                    {name:'Бант', emoji:'🎀', url:''},
                    {name:'Кулька', emoji:'🎈', url:''},
                    {name:'Сніжинка', emoji:'❄️', url:''},
                  ].map(sticker => (
                    <button key={sticker.name}
                      onClick={() => {
                        const spi = getActivePageIdx();
                        const newS = { id:'stk-'+Date.now(), url:sticker.url, emoji:(sticker as any).emoji||'', x:42, y:42, w:'12%', h:'12%' };
                        setPageStickers(prev => ({...prev, [spi]: [...(prev[spi]||[]), newS]}));
                        toast.success('Стікер додано на активну сторінку', { duration: 1500 });
                      }}
                      style={{ padding:6, border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}
                      title={sticker.name}>
                      <span style={{ fontSize:28, lineHeight:1 }}>{(sticker as any).emoji || '★'}</span>
                      <span style={{ fontSize:9, color:'#64748b', textAlign:'center' }}>{sticker.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {leftTab === 'options' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Розмір книги</div>
                  <div style={{ padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, background:'#f8fafc', fontSize:13, fontWeight:700, color:'#374151' }}>
                    {config?.selectedSize || '20×20 см'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Розворот {currentIdx > 0 ? currentIdx : '—'} · Сторінок: {pages.length - 1}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <button onClick={addSpread}
                      style={{ flex:1, padding:'9px 8px', border:'1px solid #d1fae5', borderRadius:8, background:'#f0fdf4', cursor:'pointer', fontWeight:700, fontSize:12, color:'#059669', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                      <span style={{fontSize:16}}>+</span> Додати розворот
                    </button>
                    <button onClick={removeCurrentSpread} disabled={currentIdx === 0 || pages.length <= minPagesLen}
                      style={{ flex:1, padding:'9px 8px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff7f7', cursor: currentIdx === 0 || pages.length <= minPagesLen ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:12, color: currentIdx === 0 || pages.length <= minPagesLen ? '#fca5a5' : '#ef4444', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                      <span style={{fontSize:16}}>−</span> Видалити цей
                    </button>
                  </div>
                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:6, textAlign:'center' }}>
                    Ціна оновлюється автоматично · {dynamicPrice} ₴
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Тип обкладинки</div>
                  <div style={{ padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, background:'#f8fafc', fontSize:13, color:'#374151' }}>
                    {config?.selectedCoverType || '—'}
                    {effectiveCoverColor ? <span style={{ color:'#94a3b8', marginLeft:6 }}>· {config.selectedCoverColor}</span> : null}
                  </div>
                </div>
                {config?.selectedLamination && (
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Ламінація</div>
                    <div style={{ padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, background:'#f8fafc', fontSize:13, color:'#374151' }}>
                      {config.selectedLamination}
                    </div>
                  </div>
                )}
              </div>
            )}

            {leftTab === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setTextTool(t => !t)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: textTool ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: textTool ? '#f0f3ff' : '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: textTool ? '#1e2d7d' : '#374151' }}>
                  <Type size={15} /> {textTool ? '↖ Клікніть на сторінку' : 'Додати текст'}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Шрифт</div>
                  <select value={tFontFamily}
                    onChange={e => { const v=e.target.value; setTFontFamily(v); if (selectedTextId) updateTxtForPage(selectedTextId, { fontFamily: v }, selectedTextPageIdx); }}
                    style={{ padding:'6px 8px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, width:'100%', fontFamily:tFontFamily }}>
                    {FONT_GROUPS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.fonts.map(f => <option key={f} value={f}>{f}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Розмір: {tFontSize}px</div>
                    {!selectedTextId && <span style={{ fontSize:9, color:'#f59e0b', fontWeight:600 }}>↑ клікніть на текст</span>}
                    {selectedTextId && <span style={{ fontSize:9, color:'#10b981', fontWeight:600 }}>✓ активний</span>}
                  </div>
                  <input type="range" min={8} max={120} value={tFontSize} onChange={e => { const v = +e.target.value; setTFontSize(v); if (selectedTextId) updateTxtForPage(selectedTextId, { fontSize: v }, selectedTextPageIdx); }} style={{ width: '100%', accentColor: selectedTextId ? '#1e2d7d' : '#94a3b8' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Колір</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {COLORS.map(c => <button key={c} onClick={() => { setTColor(c); if (selectedTextId) updateTxtForPage(selectedTextId, { color: c }, selectedTextPageIdx); }} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: tColor === c ? '3px solid #1e2d7d' : '2px solid #e2e8f0', cursor: 'pointer' }} />)}
                    <input type="color" value={tColor} onChange={e => { setTColor(e.target.value); if (selectedTextId) updateTxtForPage(selectedTextId, { color: e.target.value }, selectedTextPageIdx); }} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { const v = !tBold; setTBold(v); if (selectedTextId) updateTxtForPage(selectedTextId, { bold: v }, selectedTextPageIdx); }} style={{ flex: 1, padding: '6px', border: tBold ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: tBold ? '#f0f3ff' : '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 14, color: tBold ? '#1e2d7d' : '#374151' }}>B</button>
                    <button onClick={() => { const v = !tItalic; setTItalic(v); if (selectedTextId) updateTxtForPage(selectedTextId, { italic: v }, selectedTextPageIdx); }} style={{ flex: 1, padding: '6px', border: tItalic ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: tItalic ? '#f0f3ff' : '#fff', cursor: 'pointer', fontStyle: 'italic', fontSize: 14, color: tItalic ? '#1e2d7d' : '#374151' }}>I</button>
                  </div>
                </div>
                {selectedTextId && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>Двічі клікніть для редагування</p>
                    <button onClick={() => deleteTxtForPage(selectedTextId!, selectedTextPageIdx)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff7f7', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#ef4444', width: '100%' }}>
                      <Trash2 size={13} /> Видалити
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>}

        {/* CANVAS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', overflow: 'auto', padding: isMobile ? '12px 8px 72px 8px' : 32, background: '#f4f6fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} style={{ background: 'none', border: 'none', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer', opacity: currentIdx === 0 ? 0.3 : 1, color: '#1e2d7d' }}><ChevronLeft size={20} /></button>
            <span>{currentIdx === 0 ? 'Обкладинка' : `${(currentIdx-1)*2+1}–${(currentIdx-1)*2+2}`}</span>
            <button onClick={() => setCurrentIdx(i => Math.min(Math.ceil((pages.length - 1) / 2), i + 1))} disabled={currentIdx === Math.ceil((pages.length - 1) / 2)} style={{ background: 'none', border: 'none', cursor: currentIdx === Math.ceil((pages.length - 1) / 2) ? 'not-allowed' : 'pointer', opacity: currentIdx === Math.ceil((pages.length - 1) / 2) ? 0.3 : 1, color: '#1e2d7d' }}><ChevronRight size={20} /></button>
            {currentIdx !== 0 && (
              <button onClick={shuffleLayout} title="Змінити розкладку"
                style={{ display:'flex', alignItems:'center', gap:5, marginLeft:8, padding:'5px 12px', border:'1px solid #c7d2fe', borderRadius:8, background:'#f0f3ff', cursor:'pointer', color:'#1e2d7d', fontWeight:700, fontSize:12 }}>
                <Shuffle size={13}/> Інший шаблон
              </button>
            )}
            {/* Add / Remove spread — desktop only, mobile has it in Layouts panel */}
            {!isMobile && (
              <>
                <button onClick={addSpread} title="Додати розворот"
                  style={{ display:'flex', alignItems:'center', gap:3, padding:'5px 10px', border:'1px solid #d1fae5', borderRadius:8, background:'#f0fdf4', cursor:'pointer', color:'#059669', fontWeight:700, fontSize:12 }}>
                  + розворот
                </button>
                {currentIdx !== 0 && (
                  <button onClick={removeCurrentSpread} title="Видалити поточний розворот" disabled={pages.length <= minPagesLen}
                    style={{ display:'flex', alignItems:'center', gap:3, padding:'5px 10px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff7f7', cursor:pages.length<=3?'not-allowed':'pointer', color:pages.length<=3?'#fca5a5':'#ef4444', fontWeight:700, fontSize:12, opacity:pages.length<=3?0.5:1 }}>
                    − розворот
                  </button>
                )}
              </>
            )}
          </div>

          {/* Active page indicator */}
          {currentIdx !== 0 && (
            <div style={{ fontSize:11, color:'#94a3b8', marginBottom:8, textAlign:'center' }}>
              Активна сторінка: <b style={{color:'#1e2d7d'}}>{activeSide === 0 ? 'ліва' : 'права'}</b> — клікніть на сторінку для вибору
            </div>
          )}
          {currentIdx === 0 ? (
            <div style={{ width: cW, height: cH, display: 'flex', borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                {/* Back cover — editable */}
                {(() => {
                  const mat = (config.selectedCoverType||'').toLowerCase();
                  const n = effectiveCoverColor;
                  const softBg = mat.includes('тканин')||mat.includes('fabric')
                    ? ({'Бежевий/пісочний':'#C4AA88','Теракотовий':'#A04838','Фуксія':'#B838A0','Марсала/бордо':'#602838','Коричневий':'#6E4830','Сірий/графітовий':'#586058','Червоний яскравий':'#C02030','Оливковий/зелений':'#A0A020'} as Record<string,string>)[n]||'#C4AA88'
                    : mat.includes('шкір')||mat.includes('leather')
                    ? ({'Білий':'#F5F5F0','Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Рудий':'#C8844E','Бордо темний':'#7A2838','Золотистий':'#C4A83A','Теракотовий':'#C25A3C','Рожевий ніжний':'#E8B4B8','Червоний насичений':'#A01030','Коричневий':'#8E5038','Вишневий':'#7A2020','Графітовий темний':'#3A3038','Темно-синій':'#1A2040','Чорний':'#1A1A1A'} as Record<string,string>)[n]||'#D9C8B0'
                    : mat.includes('велюр')||mat.includes('velour')
                    ? ({'Молочний':'#F0EAD6','Бежевий':'#D9C8B0','Таупе':'#A89880','Рожевий':'#E8B4B8','Бордо':'#7A2838','Сірий перловий':'#9A9898','Лаванда':'#B8A8C8','Синій':'#1A2040','Графітовий':'#3A3038','Бірюзовий':'#1A9090','Марсала':'#6E2840','Блакитно-сірий':'#607080','Темно-зелений':'#1E3028','Жовтий':'#D4A020'} as Record<string,string>)[n]||'#D9C8B0'
                    : '#f1f5f9';
                  const backBg = isPrinted ? (coverState.backCoverBgColor || '#f1f5f9') : softBg;
                  const backPhoto = isPrinted ? getPhoto(coverState.backCoverPhotoId ?? null) : null;
                  const [backDragOver, setBackDragOver] = [false, (_:any)=>{}]; // simple state
                  return (
                    <div style={{ width: pageW, height: cH, flexShrink: 0, position: 'relative', background: backBg, borderRight: '2px solid rgba(0,0,0,0.12)' }}
                      onDragOver={e=>{e.preventDefault();}}
                      onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(id&&isPrinted)setCoverState(p=>({...p,backCoverPhotoId:id}));}}>
                      {backPhoto && <img src={backPhoto.preview} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} draggable={false}/>}
                      {backPhoto && isPrinted && <button onClick={()=>setCoverState(p=>({...p,backCoverPhotoId:null}))} style={{ position:'absolute',top:4,right:8,width:20,height:20,borderRadius:'50%',background:'rgba(0,0,0,0.55)',color:'#fff',border:'none',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',zIndex:20 }}>×</button>}
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                        {isPrinted && !backPhoto && <span style={{ color:'rgba(0,0,0,0.2)', fontSize:9, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', writingMode:'vertical-rl' }}>ЗАДНЯ — перетягніть фото</span>}
                        {!isPrinted && <span style={{ color:'rgba(255,255,255,0.2)', fontSize:9, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', writingMode:'vertical-rl' }}>ЗАДНЯ</span>}
                      </div>
                    </div>
                  );
                })()}
                {/* Front cover with decoration */}
                <CoverEditor
                  canvasW={pageW}
                  canvasH={cH}
                  sizeValue={(config.selectedSize || '20x20').replace(/[×х]/g,'x').replace(/\s*см/,'')}
                  config={{
                    coverMaterial: (config.selectedCoverType?.toLowerCase().includes('велюр') ? 'velour' : config.selectedCoverType?.toLowerCase().includes('шкір') ? 'leatherette' : config.selectedCoverType?.toLowerCase().includes('тканин') ? 'fabric' : 'printed') as any,
                    coverColorName: effectiveCoverColor,
                    decoType: coverState.decoType as any,
                    decoVariant: coverState.decoVariant,
                    decoColor: coverState.decoColor,
                    photoId: coverState.photoId,
                    decoText: coverState.decoText,
                    textX: coverState.textX,
                    textY: coverState.textY,
                    textFontFamily: coverState.textFontFamily,
                    textFontSize: coverState.textFontSize,
                    extraTexts: coverState.extraTexts || [],
                    printedPhotoSlot: coverState.printedPhotoSlot,
                    printedTextBlocks: coverState.printedTextBlocks,
                    printedOverlay: coverState.printedOverlay,
                    printedBgColor: coverState.printedBgColor,
                  }}
                  photos={photos}
                  onChange={(cfg) => setCoverState(prev => ({ ...prev,
                    ...(cfg.photoId !== undefined && { photoId: cfg.photoId ?? null }),
                    ...(cfg.decoText !== undefined && { decoText: cfg.decoText }),
                    ...(cfg.textX !== undefined && { textX: cfg.textX }),
                    ...(cfg.textY !== undefined && { textY: cfg.textY }),
                    ...(cfg.extraTexts !== undefined && { extraTexts: cfg.extraTexts }),
                    ...(cfg.printedPhotoSlot !== undefined && { printedPhotoSlot: cfg.printedPhotoSlot }),
                    ...(cfg.printedTextBlocks !== undefined && { printedTextBlocks: cfg.printedTextBlocks }),
                    ...(cfg.printedOverlay !== undefined && { printedOverlay: cfg.printedOverlay }),
                  }))}
                />
              </div>
          ) : (
          <div
            style={{ position: 'relative', width: cW, height: cH, display: 'flex', flexShrink: 0 }}
          >
            {currentIdx === 0 ? (
              /* Cover: left=back spine(grey), right=front cover with deco */
              <div style={{ width: cW, height: cH, display: 'flex', borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                {/* Back cover — plain */}
                <div style={{ width: pageW, height: cH, background: (() => { const n=effectiveCoverColor; const mat=config.selectedCoverType?.toLowerCase()||''; const vc={'Молочний':'#F0EAD6','Бежевий':'#D9C8B0','Таупе':'#A89880','Рожевий':'#E8B4B8','Бордо':'#7A2838','Сірий перловий':'#9A9898','Лаванда':'#B8A8C8','Синій':'#1A2040','Графітовий':'#3A3038','Бірюзовий':'#1A9090','Марсала':'#6E2840','Блакитно-сірий':'#607080','Темно-зелений':'#1E3028','Жовтий':'#D4A020'} as Record<string,string>; const lc={'Білий':'#F5F5F0','Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Рудий':'#C8844E','Бордо темний':'#7A2838','Золотистий':'#C4A83A','Теракотовий':'#C25A3C','Рожевий ніжний':'#E8B4B8','Червоний насичений':'#A01030','Коричневий':'#8E5038','Вишневий':'#7A2020','Графітовий темний':'#3A3038','Темно-синій':'#1A2040','Чорний':'#1A1A1A'} as Record<string,string>; const fc={'Бежевий/пісочний':'#C4AA88','Теракотовий':'#A04838','Фуксія':'#B838A0','Марсала/бордо':'#602838','Коричневий':'#6E4830','Сірий/графітовий':'#586058','Червоний яскравий':'#C02030','Оливковий/зелений':'#A0A020'} as Record<string,string>; if(mat.includes('тканин')||mat.includes('fabric')) return fc[n]||'#C4AA88'; if(mat.includes('шкір')||mat.includes('leather')) return lc[n]||'#D9C8B0'; if(mat.includes('велюр')||mat.includes('velour')) return vc[n]||'#D9C8B0'; return '#e8ecf4'; })(), borderRight: '2px solid rgba(0,0,0,0.12)', position:'relative' }}>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'rgba(255,255,255,0.15)', fontSize:9, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', writingMode:'vertical-rl' }}>ЗАДНЯ ОБКЛАДИНКА</span>
                  </div>
                  {/* Spine line */}
                  <div style={{ position:'absolute', right:0, top:0, width:2, height:'100%', background:'rgba(0,0,0,0.15)' }}/>
                </div>
                {/* Front cover — with deco */}
                <CoverEditor
                  canvasW={pageW}
                  canvasH={cH}
                  sizeValue={(config.selectedSize || '20x20').replace(/[×х]/g,'x').replace(/\s*см/,'')}
                  config={{
                    coverMaterial: (config.selectedCoverType?.toLowerCase().includes('велюр') ? 'velour' : config.selectedCoverType?.toLowerCase().includes('шкір') ? 'leatherette' : config.selectedCoverType?.toLowerCase().includes('тканин') ? 'fabric' : 'printed') as any,
                    coverColorName: effectiveCoverColor,
                    decoType: coverState.decoType as any,
                    decoVariant: coverState.decoVariant,
                    photoId: coverState.photoId,
                    decoText: coverState.decoText,
                    decoColor: coverState.decoColor,
                    textX: coverState.textX,
                    textY: coverState.textY,
                    textFontFamily: coverState.textFontFamily,
                    textFontSize: coverState.textFontSize,
                  }}
                  photos={photos}
                  onChange={(cfg: any) => setCoverState(prev => ({ ...prev, ...(cfg.photoId !== undefined && { photoId: cfg.photoId ?? null }), ...(cfg.decoText !== undefined && { decoText: cfg.decoText }), ...(cfg.decoColor !== undefined && { decoColor: cfg.decoColor }), ...(cfg.textX !== undefined && { textX: cfg.textX }), ...(cfg.textY !== undefined && { textY: cfg.textY }), ...(cfg.textFontFamily !== undefined && { textFontFamily: cfg.textFontFamily }), ...(cfg.textFontSize !== undefined && { textFontSize: cfg.textFontSize }) }))}
                />
              </div>
            ) : (
              /* Spread: left page + right page */
              <>
                {[0, 1].map(side => {
                  const pageIdx = currentIdx === 0 ? 0 : (currentIdx - 1) * 2 + 1 + side;
                  const page = pages[pageIdx];
                  const pageRenderKey = `${side}-${page?.layout || 'empty'}-${page?.slots?.length || 0}`;

                  // КАЛЬКА: first left page (pageIdx===1, side===0 on spread 1)
                  if (isKalkaPage(pageIdx)) return (
                    <div key={pageRenderKey} onClick={() => setLeftTab('kalka' as any)}
                      style={{ width: pageW, height: cH, position: 'relative', background: '#fff', borderRadius: '4px 0 0 4px', boxShadow: 'inset -1px 0 3px rgba(0,0,0,0.08)', overflow: 'hidden', cursor: 'pointer',
                        border: leftTab === ('kalka' as any) ? '2px solid #3b82f6' : 'none' }}>
                      {/* Калька texture */}
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(240,245,255,0.85)', backdropFilter: 'blur(0.5px)', pointerEvents: 'none' }}/>
                      {/* Uploaded illustration */}
                      {kalkaState.imageUrl && (
                        <img src={kalkaState.imageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.7 }} draggable={false}/>
                      )}
                      {/* Text */}
                      {kalkaState.text && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <span style={{ fontSize: kalkaState.fontSize, fontFamily: kalkaState.fontFamily, color: kalkaState.textColor, textAlign: 'center', padding: '0 16px', opacity: 0.8, whiteSpace: 'pre-wrap' }}>{kalkaState.text}</span>
                        </div>
                      )}
                      {/* Label */}
                      <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#94a3b8', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', pointerEvents: 'none' }}>КАЛЬКА — тисніть для редагування</div>
                    </div>
                  );

                  // ПОРОЖНІЙ ФОРЗАЦ (останні 2 сторінки при кальці)
                  if (isKalkaEndPage(pageIdx)) return (
                    <div key={pageRenderKey}
                      style={{ width: pageW, height: cH, background: '#fff', borderRadius: side === 0 ? '4px 0 0 4px' : '0 4px 4px 0', boxShadow: side === 0 ? 'inset -1px 0 3px rgba(0,0,0,0.08)' : 'inset 1px 0 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#e2e8f0', fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', writingMode: 'vertical-rl' }}>ФОРЗАЦ (порожній)</span>
                    </div>
                  );

                  // ФОРЗАЦ (для журналів і тревел-буків)
                  if (isEndpaperPage(pageIdx)) {
                    const isFirst = pageIdx === endpaperFirstIdx;
                    const ep = isFirst ? endpaperState.first : endpaperState.last;
                    const epKey = isFirst ? 'first' : 'last';
                    return (
                      <div key={pageRenderKey}
                        onClick={() => setLeftTab('endpaper' as any)}
                        style={{ width: pageW, height: cH, position: 'relative', background: '#fff',
                          borderRadius: side === 0 ? '4px 0 0 4px' : '0 4px 4px 0',
                          boxShadow: side === 0 ? 'inset -1px 0 3px rgba(0,0,0,0.08)' : 'inset 1px 0 3px rgba(0,0,0,0.08)',
                          overflow: 'hidden', cursor: 'pointer',
                          border: leftTab === ('endpaper' as any) ? '2px solid #3b82f6' : 'none' }}>
                        {ep.imageUrl && <img src={ep.imageUrl} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.85 }} draggable={false}/>}
                        {ep.text && (
                          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ fontSize: 20, color: ep.textColor, textAlign:'center', padding:'0 16px', whiteSpace:'pre-wrap' }}>{ep.text}</span>
                          </div>
                        )}
                        <div style={{ position:'absolute', bottom:6, left:0, right:0, textAlign:'center', fontSize:9, color:'#94a3b8', fontWeight:600, letterSpacing:1, textTransform:'uppercase', pointerEvents:'none' }}>
                          ФОРЗАЦ {isFirst ? '(перший)' : '(останній)'} {ep.enabled ? '· друк +200₴' : '· білий'}
                        </div>
                        {!ep.enabled && !ep.imageUrl && !ep.text && (
                          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                            <span style={{ color:'#e2e8f0', fontSize:9, fontWeight:600, letterSpacing:1, textTransform:'uppercase', writingMode:'vertical-rl' }}>ФОРЗАЦ — тисніть для редагування</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  const pageDefs = getSlotDefs(page.layout, pageW, cH);
                  if (side === 0) console.log('[SLOTS]', { layout: page.layout, pageW: Math.round(pageW), cH: Math.round(cH), defsCount: pageDefs.length, firstDef: pageDefs[0]?.s });
                  const pageKey = (si: number) => `${pageIdx}-${si}`;
                  return (
                    <div key={pageRenderKey}
                      onPointerDown={() => setActiveSide(side as 0|1)}
                      style={{ width: pageW, height: cH, position: 'relative', background: dragPhotoId ? '#fafafa' : '#fff', overflow: 'hidden', borderRadius: side === 0 ? '4px 0 0 4px' : '0 4px 4px 0', boxShadow: side === 0 ? 'inset -1px 0 3px rgba(0,0,0,0.08)' : 'inset 1px 0 3px rgba(0,0,0,0.08)', cursor: textTool ? 'crosshair' : 'default', outline: activeSide === side && currentIdx !== 0 ? '2px solid rgba(30,45,125,0.3)' : 'none' }}
                      onClick={(e) => { setActiveSide(side as 0|1); setSelectedFreeSlotId(null); setSelectedTextId(null); if (textTool && page) onCanvasClickForPage(e, pageIdx); }}
                    >
                      {/* Background layer — MUST be first so it's below slots */}
                      <BackgroundLayer bg={getCurBg(pageIdx)} canvasW={pageW} canvasH={cH}/>

                      {/* Empty page hint — shown when no slots (template was deleted) */}
                      {pageDefs.length === 0 && !textTool && currentIdx !== 0 && (
                        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, zIndex:2 }}>
                          <div style={{ padding:'16px 20px', background:'rgba(238,240,251,0.95)', borderRadius:12, border:'2px dashed #c7d2fe', textAlign:'center', maxWidth:'85%', pointerEvents:'none' }}>
                            <div style={{ fontSize:26, marginBottom:6 }}>📋</div>
                            <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:4 }}>Сторінка без шаблону</div>
                            <div style={{ fontSize:11, color:'#6b7280', lineHeight:1.5 }}>
                              Оберіть шаблон у панелі<br/>
                              <b>«Шаблони»</b> ліворуч
                            </div>
                          </div>
                          <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); addFreeSlot(); }}
                            style={{ padding:'8px 16px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 2px 8px rgba(30,45,125,0.3)' }}>
                            + Додати фото-слот
                          </button>
                        </div>
                      )}

                      {pageDefs.map(({ i, s }) => {
                        const slot = page?.slots[i];
                        const photo = slot ? getPhoto(slot.photoId) : null;
                        const key = pageKey(i);
                        const isOver = dropTarget === key;
                        return (
                          <div key={i}
                            onDragOver={e => { e.preventDefault(); setDropTarget(key); }}
                            onDragLeave={() => setDropTarget(null)}
                            onDrop={e => onDrop(e, pageIdx, i)}
                            onClick={(e) => {
                              e.stopPropagation(); // prevent canvas deselect
                              if (tapSelectedPhotoId) {
                                haptic.success();
                                setPages(prev => prev.map((p, pi) => pi !== pageIdx ? p : { ...p, slots: p.slots.map((s2, si2) => si2 !== i ? s2 : { ...s2, photoId: tapSelectedPhotoId }) }));
                                setTapSelectedPhotoId(null);
                              }
                            }}
                            style={{ ...s, zIndex: 1, background: photo ? 'transparent' : (isOver ? '#dbeafe' : 'rgba(99,102,241,0.15)'), border: isOver ? '2px dashed #1e2d7d' : (photo ? 'none' : '2px dashed #818cf8'), transition: 'border-color 0.15s', cursor: dragPhotoId ? 'copy' : 'default', boxSizing: 'border-box' }}
                          >
                            {photo ? (
                              <>
                                <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: photoEditSlot === key ? 'crosshair' : 'default' }}
                                  onWheel={e => { if (photoEditSlot !== key) return; e.preventDefault(); const delta = e.deltaY > 0 ? -0.05 : 0.05; const nz = Math.max(0.5, Math.min(4, (slot!.zoom||1)+delta)); setPages(prev => prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:nz})})); }}
                                  onClick={() => setPhotoEditSlot(photoEditSlot === key ? null : key)}>
                                  <img src={photo.preview} draggable={photoEditSlot !== key} onDragStart={e=>{if(photoEditSlot===key){e.preventDefault();return;}e.dataTransfer.setData('photoId',photo.id);e.dataTransfer.setData('text/plain',photo.id);}} alt=""
                                    onPointerDown={e => { if (photoEditSlot===key) startCrop(e, key, slot!.cropX ?? 50, slot!.cropY ?? 50); }}
                                    style={{ width:`${(slot!.zoom||1)*100}%`, height:`${(slot!.zoom||1)*100}%`, objectFit:'cover', objectPosition:`${slot!.cropX}% ${slot!.cropY}%`, userSelect:'none', cursor:photoEditSlot===key?'grab':'default', display:'block', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', touchAction:'none' }}/>
                                  {photoEditSlot===key && (
                                    <div onMouseDown={e=>e.stopPropagation()} style={{position:'absolute',bottom:4,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:4,background:'rgba(0,0,0,0.75)',borderRadius:20,padding:'3px 8px',zIndex:40}}>
                                      <button onClick={e=>{e.stopPropagation();setPages(prev=>prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:Math.max(0.5,(sl.zoom||1)-0.1)})}));}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:14,padding:'0 2px'}}>−</button>
                                      <span style={{color:'#fff',fontSize:9,fontWeight:700,minWidth:28,textAlign:'center'}}>{Math.round((slot!.zoom||1)*100)}%</span>
                                      <button onClick={e=>{e.stopPropagation();setPages(prev=>prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:Math.min(4,(sl.zoom||1)+0.1)})}));}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:14,padding:'0 2px'}}>+</button>
                                      <div style={{width:1,height:12,background:'rgba(255,255,255,0.3)',margin:'0 2px'}}/>
                                      <button onClick={e=>{e.stopPropagation();setPages(prev=>prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:1,cropX:50,cropY:50})}));}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:9,fontWeight:700,padding:'0 2px'}}>↺</button>
                                      <div style={{width:1,height:12,background:'rgba(255,255,255,0.3)',margin:'0 2px'}}/>
                                      <button onClick={e=>{e.stopPropagation();clearSlot(pageIdx,i);setPhotoEditSlot(null);}} style={{background:'rgba(239,68,68,0.8)',border:'none',color:'#fff',cursor:'pointer',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>✕ фото</button>
                                    </div>
                                  )}
                                </div>
                                <button onClick={()=>clearSlot(pageIdx,i)} style={{position:'absolute',top:4,right:4,width:20,height:20,borderRadius:'50%',background:'rgba(0,0,0,0.55)',color:'#fff',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.15s'}} className="del-btn"><Trash2 size={10}/></button>
                                <style>{`.del-btn{opacity:0!important}div:hover>.del-btn{opacity:1!important}`}</style>
                              </>
                            ) : (
                              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#818cf8',gap:6,pointerEvents:'none'}}>
                                <ImageIcon size={Math.min(24, Math.max(12, (s.width as number||100)*0.15))} color="#818cf8"/>
                                <span style={{fontSize:8,fontWeight:700,color:'#818cf8',textAlign:'center',letterSpacing:'0.05em'}}>ФОТО</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Text blocks for this page */}
                      {page?.textBlocks?.map(tb => {
                        const isSel = selectedTextId === tb.id;
                        const isEd = editingTextId === tb.id;
                        return (
                          <div key={tb.id}
                            onPointerDown={e=>{e.stopPropagation();setSelectedTextId(tb.id);setSelectedTextPageIdx(pageIdx);setTFontSize(tb.fontSize||28);setTFontFamily(tb.fontFamily||'Open Sans');setTColor(tb.color||'#000');setTBold(!!tb.bold);setTItalic(!!tb.italic);if(!isEd)startTxtDragForPage(e,tb.id,tb.x,tb.y,pageIdx);}}
                            onContextMenu={e=>{e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,type:'text',id:tb.id,pageIdx});}}
                            onDoubleClick={e=>{e.stopPropagation();setEditingTextId(tb.id);setSelectedTextId(tb.id);setSelectedTextPageIdx(pageIdx);setTFontSize(tb.fontSize||28);setTFontFamily(tb.fontFamily||'Open Sans');setTColor(tb.color||'#000');setTBold(!!tb.bold);setTItalic(!!tb.italic);}}
                            style={{position:'absolute',left:tb.x+'%',top:tb.y+'%',transform:'translate(-50%,-50%)',zIndex:20,cursor:isEd?'text':'move',outline:isSel?'2px solid #3b82f6':'none',borderRadius:3,padding:'2px 4px',background:isSel?'rgba(255,255,255,0.1)':'transparent',minWidth:30,touchAction:'none'}}>
                            {isEd?(
                              <textarea
                autoFocus
                value={tb.text}
                onBlur={e=>{setEditingTextId(null);}}
                onChange={e=>{updateTxtForPage(tb.id,{text:e.target.value},pageIdx);}}
                onClick={e=>e.stopPropagation()}
                onMouseDown={e=>e.stopPropagation()}
                style={{background:'transparent',border:'none',outline:'1px dashed rgba(59,130,246,0.5)',fontSize:(tb.fontSize*(zoom/100))+'px',fontFamily:tb.fontFamily,color:tb.color,fontWeight:tb.bold?700:400,fontStyle:tb.italic?'italic':'normal',resize:'none',minWidth:80,display:'block',padding:'2px'}}
                rows={2}
              />
                            ):(
                              <span style={{fontSize:(tb.fontSize*(zoom/100))+'px',fontFamily:tb.fontFamily,color:tb.color,fontWeight:tb.bold?700:400,fontStyle:tb.italic?'italic':'normal',display:'block',whiteSpace:'pre',userSelect:'none',textShadow:'0 1px 2px rgba(0,0,0,0.2)'}}>{tb.text}</span>
                            )}
                            {isSel&&!isEd&&<button onMouseDown={e=>{e.stopPropagation();deleteTxtForPage(tb.id,pageIdx);}} style={{position:'absolute',top:-8,right:-8,width:18,height:18,borderRadius:'50%',background:'#ef4444',color:'#fff',border:'none',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',zIndex:30}}>×</button>}
                          </div>
                        );
                      })}
                      {/* Free slots */}
                      <FreeSlotLayer
                        slots={freeSlots[pageIdx] || []}
                        photos={photos}
                        canvasW={pageW}
                        canvasH={cH}
                        dragPhotoId={dragPhotoId}
                        tapPhotoId={tapSelectedPhotoId}
                        onChange={(newSlots) => { setFreeSlots(prev=>({...prev,[pageIdx]:newSlots})); setTapSelectedPhotoId(null); }}
                        selectedId={selectedFreeSlotId}
                        onSelect={setSelectedFreeSlotId}
                        isMobile={isMobile}
                      />
                      {/* Shapes layer */}
                      <ShapesLayer
                        shapes={getCurShapes(pageIdx)}
                        canvasW={pageW} canvasH={cH}
                        onChange={newShapes => setPageShapes(prev=>({...prev,[pageIdx]:newShapes}))}
                        selectedId={selectedShapeId}
                        onSelectId={id => { setSelectedShapeId(id); if (id) { setLeftTab('shapes'); if (isMobile) setMobilePanel(true); } }}
                        onDragShapeStart={id => setCrossPageDragShapeId(id)}
                        onDragShapeEnd={() => setCrossPageDragShapeId(null)}
                        onMoveToOtherPage={shape => {
                          // Move shape to the other page in this spread
                          const otherSide = side === 0 ? 1 : 0;
                          const otherPageIdx = currentIdx === 0 ? 0 : (currentIdx - 1) * 2 + 1 + otherSide;
                          if (otherPageIdx === pageIdx || !pages[otherPageIdx]) return;
                          setPageShapes(prev => ({
                            ...prev,
                            [pageIdx]: (prev[pageIdx] || []).filter(s => s.id !== shape.id),
                            [otherPageIdx]: [...(prev[otherPageIdx] || []), { ...shape }],
                          }));
                          setActiveSide(otherSide as 0 | 1);
                        }}
                      />
                      {/* Cross-page drop zone: visible when dragging a shape */}
                      {crossPageDragShapeId && (() => {
                        const curShapePageIdx = Object.entries(pageShapes).find(([,shapes]) =>
                          (shapes as any[]).some((s:any) => s.id === crossPageDragShapeId)
                        )?.[0];
                        const isSource = curShapePageIdx === String(pageIdx);
                        return !isSource ? (
                          <div
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => {
                              const shapeId = e.dataTransfer.getData('shape-id');
                              if (!shapeId) return;
                              let sourceIdx = -1; let movedShape: any = null;
                              Object.entries(pageShapes).forEach(([pi, ss]) => {
                                const f = (ss as any[]).find((s:any) => s.id === shapeId);
                                if (f) { sourceIdx = Number(pi); movedShape = f; }
                              });
                              if (movedShape && sourceIdx !== -1 && sourceIdx !== pageIdx) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const nx = Math.max(0, Math.min(pageW - movedShape.w, e.clientX - rect.left - movedShape.w/2));
                                const ny = Math.max(0, Math.min(cH - movedShape.h, e.clientY - rect.top - movedShape.h/2));
                                setPageShapes(prev => ({
                                  ...prev,
                                  [sourceIdx]: (prev[sourceIdx]||[]).filter((s:any) => s.id !== shapeId),
                                  [pageIdx]: [...(prev[pageIdx]||[]), { ...movedShape, x: nx, y: ny }]
                                }));
                                setSelectedShapeId(shapeId);
                              }
                              setCrossPageDragShapeId(null);
                            }}
                            style={{ position:'absolute', inset:0, zIndex:60,
                              background:'rgba(30,45,125,0.08)', border:'2px dashed rgba(30,45,125,0.3)',
                              display:'flex', alignItems:'center', justifyContent:'center', borderRadius:4 }}
                          >
                            <span style={{ fontSize:11, fontWeight:700, color:'rgba(30,45,125,0.5)', pointerEvents:'none' }}>Перенести сюди</span>
                          </div>
                        ) : null;
                      })()}
                      {/* Frame layer */}
                      <FrameLayer frame={getCurFrame(pageIdx)} canvasW={pageW} canvasH={cH}/>
                      {/* Sticker layer */}
                      {(pageStickers[pageIdx]||[]).map(stk => (
                        <div key={stk.id} style={{ position:'absolute', left:stk.x+'%', top:stk.y+'%', width:stk.w, height:stk.h, cursor:'move', userSelect:'none', zIndex:40, touchAction:'none' }}
                          onPointerDown={e => {
                            e.stopPropagation();
                            haptic.light();
                            const origX=stk.x, origY=stk.y;
                            startPointerDrag(e, (dx,dy) =>
                              setPageStickers(prev=>({...prev,[pageIdx]:(prev[pageIdx]||[]).map(s=>s.id===stk.id?{...s,x:Math.max(0,Math.min(90,origX+dx/pageW*100)),y:Math.max(0,Math.min(90,origY+dy/cH*100))}:s)}))
                            );
                          }}>
                          {stk.emoji ? <span style={{ fontSize: typeof stk.w === 'string' && stk.w.endsWith('%') ? Math.round(pageW * parseFloat(stk.w) / 100 * 0.7) : Math.min(parseInt(stk.w as string)||48, 48), lineHeight:1, pointerEvents:'none', userSelect:'none', display:'block', textAlign:'center' }}>{stk.emoji}</span> : <img src={stk.url} style={{ width:'100%', height:'100%', objectFit:'contain', pointerEvents:'none' }} draggable={false}/>}
                          <button onClick={e=>{e.stopPropagation();setPageStickers(prev=>({...prev,[pageIdx]:(prev[pageIdx]||[]).filter(s=>s.id!==stk.id)}));}}
                            style={{ position:'absolute',top:-6,right:-6,width:16,height:16,borderRadius:'50%',background:'#ef4444',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center' }}>x</button>
                        </div>
                      ))}
                      {/* Spine shadow */}
                      {side===0 && <div style={{position:'absolute',right:0,top:0,width:4,height:'100%',background:'linear-gradient(to right,transparent,rgba(0,0,0,0.08))',pointerEvents:'none',zIndex:5}}/>}
                      {side===1 && <div style={{position:'absolute',left:0,top:0,width:4,height:'100%',background:'linear-gradient(to left,transparent,rgba(0,0,0,0.08))',pointerEvents:'none',zIndex:5}}/>}
                      {/* Page number */}
                      <div style={{position:'absolute',bottom:4,left:'50%',transform:'translateX(-50%)',fontSize:8,color:'#94a3b8',fontWeight:600,pointerEvents:'none'}}>{pageIdx}</div>
                    </div>
                  );
                })}
                {/* Box shadow wrap */}
              </>
            )}
          </div>
          )}
        </div>

        {/* RIGHT PANEL — Spread Navigator — desktop only */}
        {!isMobile &&
        <div style={{ width: 180, borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e2d7d' }}>Розвороти</span>
            <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>{Math.ceil((pages.length - 1) / 2)}{hasEndpaper ? ' +2ФЗ' : ''}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Cover spread */}
            {(() => {
              const active = currentIdx === 0;
              const pg = pages[0];
              const ph = pg ? getPhoto(pg.slots[0]?.photoId ?? null) : null;
              const TW = 130, TH = Math.round(TW * prop.h / prop.w);
              return (
                <button key="cover" onClick={() => setCurrentIdx(0)}
                  style={{ width: '100%', padding: '4px', border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: active ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ width: '100%', aspectRatio: `${prop.w*2}/${prop.h}`, background: isPrinted ? (coverState.backCoverBgColor || '#f1f5f9') : '#d4b896', borderRadius: 3, marginBottom: 3, position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', right:0, top:0, width:'50%', height:'100%', background: isPrinted ? (coverState.printedBgColor || '#fff') : '#c4a882' }}>
                      {ph && <img src={ph.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>}
                    </div>
                    <div style={{ position:'absolute', left:0, top:0, width:'50%', height:'100%', background:'rgba(0,0,0,0.08)' }}/>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#1e2d7d' : '#64748b' }}>Обкладинка</span>
                </button>
              );
            })()}
            {/* Endpaper thumbnails — shown after cover when hasEndpaper */}
            {hasEndpaper && (() => {
              const epPages = [
                { label: 'Форзац (перший)', pageIdx: endpaperFirstIdx, surcharge: _slug.includes('travelbook') ? 100 : 200 },
                { label: 'Форзац (останній)', pageIdx: endpaperLastIdx, surcharge: _slug.includes('travelbook') ? 100 : 200 },
              ];
              return epPages.map(({ label, pageIdx, surcharge }) => {
                const ep = pageIdx === endpaperFirstIdx ? endpaperState.first : endpaperState.last;
                const active = false; // endpaper pages aren't navigable as own spread
                return (
                  <button key={label}
                    onClick={() => setLeftTab('endpaper' as any)}
                    title={`${label} — клікніть для редагування`}
                    style={{ width:'100%', padding:'4px', border:'1px solid #d1fae5', borderRadius:6, background:'#f0fdf4', cursor:'pointer', textAlign:'center' }}>
                    <div style={{ width:'100%', aspectRatio:`${prop.w}/${prop.h}`, background: ep.enabled ? '#e0f2fe' : '#f1f5f9', borderRadius:3, marginBottom:3, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {ep.imageUrl
                        ? <img src={ep.imageUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>
                        : <span style={{ fontSize:8, color:'#94a3b8', fontWeight:600, letterSpacing:1, textTransform:'uppercase', writingMode:'vertical-rl' }}>ФОРЗАЦ</span>
                      }
                      {ep.enabled && <div style={{ position:'absolute', bottom:2, left:0, right:0, textAlign:'center', fontSize:7, fontWeight:700, color:'#0369a1', background:'rgba(255,255,255,0.8)' }}>+{surcharge}₴</div>}
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, color:'#059669' }}>{label.replace(' (перший)', ' 1').replace(' (останній)', ' 2')}</span>
                  </button>
                );
              });
            })()}

            {/* Content spreads */}
            {Array.from({ length: Math.ceil((pages.length - 1) / 2) }, (_, si) => {
              const spreadIdx = si + 1;
              const active = currentIdx === spreadIdx;
              const leftIdx = (spreadIdx - 1) * 2 + 1;
              const rightIdx = leftIdx + 1;
              const pgL = pages[leftIdx];
              const pgR = pages[rightIdx];
              const TW = 130;
              const renderThumbPage = (pg: typeof pages[0] | undefined, side: 'left'|'right') => {
                if (!pg) return <div style={{ flex:1, height:'100%', background:'#f1f5f9' }}/>;
                const defs = getSlotDefs(pg.layout, TW/2, TW * prop.h / prop.w / 1);
                return (
                  <div style={{ flex:1, height:'100%', position:'relative', overflow:'hidden', background:'#fff',
                    borderLeft: side==='right' ? '1px solid rgba(0,0,0,0.1)' : 'none' }}>
                    {defs.map(({i, s}) => {
                      const slot = pg.slots[i];
                      const ph = slot ? getPhoto(slot.photoId) : null;
                      const scale = (TW/2) / (cW/2);
                      const ss: React.CSSProperties = {
                        position: 'absolute',
                        left: `${((s.left as number)||0) / (cW/2) * 100}%`,
                        top: `${((s.top as number)||0) / cH * 100}%`,
                        width: `${((s.width as number)||cW/2) / (cW/2) * 100}%`,
                        height: `${((s.height as number)||cH) / cH * 100}%`,
                        overflow: 'hidden',
                        background: ph ? 'transparent' : 'rgba(99,102,241,0.12)',
                        border: ph ? 'none' : '1px dashed #818cf8',
                        borderRadius: 2,
                      };
                      return (
                        <div key={i} style={ss}>
                          {ph && <img src={ph.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>}
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return (
                <button key={spreadIdx} onClick={() => setCurrentIdx(spreadIdx)}
                  onDragOver={e => { if (crossPageDragShapeId) e.preventDefault(); }}
                  onDrop={e => {
                    const shapeId = e.dataTransfer.getData('shape-id');
                    if (!shapeId) return;
                    let sourceIdx = -1; let movedShape: any = null;
                    Object.entries(pageShapes).forEach(([pi, ss]) => {
                      const f = (ss as any[]).find((s:any) => s.id === shapeId);
                      if (f) { sourceIdx = Number(pi); movedShape = f; }
                    });
                    if (movedShape && sourceIdx !== -1) {
                      const targetPageIdx = leftIdx; // drop to left page of this spread
                      if (targetPageIdx !== sourceIdx) {
                        setPageShapes(prev => ({
                          ...prev,
                          [sourceIdx]: (prev[sourceIdx]||[]).filter((s:any) => s.id !== shapeId),
                          [targetPageIdx]: [...(prev[targetPageIdx]||[]), { ...movedShape, x: 20, y: 20 }],
                        }));
                        setSelectedShapeId(shapeId);
                        setCurrentIdx(spreadIdx);
                      }
                    }
                    setCrossPageDragShapeId(null);
                  }}
                  style={{ width: '100%', padding: '4px', border: crossPageDragShapeId ? '2px dashed #3b82f6' : (active ? '2px solid #1e2d7d' : '1px solid #e2e8f0'), borderRadius: 6, background: crossPageDragShapeId ? 'rgba(59,130,246,0.05)' : (active ? '#f0f3ff' : '#fff'), cursor: crossPageDragShapeId ? 'copy' : 'pointer', textAlign: 'center' }}>
                  <div style={{ width: '100%', aspectRatio: `${prop.w*2}/${prop.h}`, display:'flex', borderRadius: 3, marginBottom: 3, overflow:'hidden' }}>
                    {renderThumbPage(pgL, 'left')}
                    {renderThumbPage(pgR, 'right')}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#1e2d7d' : '#64748b' }}>
                    {pgL?.label?.replace('Стор. ', '')}{pgR ? `–${pgR.label?.replace('Стор. ', '')}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        }{/* end right panel */}

      </div>

      {/* Tooltips onboarding */}
      {showTooltips && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:32, maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            {tooltipStep === 0 && (
              <>
                <div style={{ fontSize:24, marginBottom:12 }}>👋</div>
                <h3 style={{ fontWeight:800, fontSize:18, color:'#1e2d7d', marginBottom:8 }}>Ласкаво просимо до редактора!</h3>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6, marginBottom:20 }}>
                  Тут ви можете створити свій унікальний {config?.productName ? `«${config.productName}»` : 'виріб'}. Давайте розберемось як це працює.
                </p>
                <button onClick={() => setTooltipStep(1)} style={{ width:'100%', padding:'12px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                  Почати →
                </button>
              </>
            )}
            {tooltipStep === 1 && (
              <>
                <div style={{ fontSize:24, marginBottom:12 }}></div>
                <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:8 }}>Зображення</h3>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6, marginBottom:8 }}>
                  В панелі <b>Зображення</b> завантажте фото та перетягніть їх на слоти сторінки.
                </p>
                <p style={{ color:'#64748b', fontSize:13, lineHeight:1.6, marginBottom:20 }}>
                  Натисніть <b>Авто</b> — редактор розставить всі фото автоматично.
                </p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setTooltipStep(0)} style={{ flex:1, padding:'10px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, color:'#64748b' }}>← Назад</button>
                  <button onClick={() => setTooltipStep(2)} style={{ flex:2, padding:'10px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>Далі →</button>
                </div>
              </>
            )}
            {tooltipStep === 2 && (
              <>
                <div style={{ fontSize:24, marginBottom:12 }}>📐</div>
                <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:8 }}>Шаблони та активна сторінка</h3>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6, marginBottom:8 }}>
                  <b>Клікніть на ліву або праву сторінку</b> розвороту щоб зробити її активною.
                </p>
                <p style={{ color:'#64748b', fontSize:13, lineHeight:1.6, marginBottom:20 }}>
                  Потім оберіть шаблон у лівій панелі — він застосується до активної сторінки.
                </p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setTooltipStep(1)} style={{ flex:1, padding:'10px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, color:'#64748b' }}>← Назад</button>
                  <button onClick={() => setTooltipStep(3)} style={{ flex:2, padding:'10px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>Далі →</button>
                </div>
              </>
            )}
            {tooltipStep === 3 && (
              <>
                <div style={{ fontSize:24, marginBottom:12 }}>✏️</div>
                <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:8 }}>Текст, фон та фігури</h3>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6, marginBottom:8 }}>
                  В панелі <b>Текст</b> — натисніть «Додати текст», потім клікніть на сторінку.
                </p>
                <p style={{ color:'#64748b', fontSize:13, lineHeight:1.6, marginBottom:20 }}>
                  <b>Фон</b> — колір або фото для кожної сторінки окремо.<br/>
                  <b>Фігури</b> — геометричні елементи на сторінці.<br/>
                  <b>Рамки</b> — декоративні рамки поверх сторінки.
                </p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setTooltipStep(2)} style={{ flex:1, padding:'10px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, color:'#64748b' }}>← Назад</button>
                  <button onClick={() => setTooltipStep(4)} style={{ flex:2, padding:'10px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>Далі →</button>
                </div>
              </>
            )}
            {tooltipStep === 4 && (
              <>
                <div style={{ fontSize:24, marginBottom:12 }}>👁️</div>
                <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:8 }}>Попередній перегляд та замовлення</h3>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6, marginBottom:8 }}>
                  Натисніть <b>Попередній перегляд</b> щоб переглянути виріб з перегортанням сторінок.
                </p>
                <p style={{ color:'#64748b', fontSize:13, lineHeight:1.6, marginBottom:8 }}>
                  Хочете більше сторінок? Натисніть <b>+ Розворот</b> в правій панелі. Ціна оновлюється автоматично.
                </p>
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#15803d' }}>
                  ✓ Коли завершите — натисніть зелену кнопку <b>«Зберегти та замовити»</b> у верхньому правому куті.
                </div>
                <button onClick={() => {
                  setShowTooltips(false);
                  localStorage.setItem('editor_tooltips_seen', '1');
                }} style={{ width:'100%', padding:'12px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                  Зрозуміло, почнемо! 🚀
                </button>
                <button onClick={() => {
                  setShowTooltips(false);
                  localStorage.setItem('editor_tooltips_seen', '1');
                }} style={{ width:'100%', padding:'8px', background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#94a3b8', marginTop:8 }}>
                  Більше не показувати
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MOBILE: First-time guide overlay */}
      {/* Context menu (long-press) */}
      {ctxMenu && (
        <div style={{ position:'fixed', inset:0, zIndex:9999 }} onClick={closeCtxMenu}>
          <div onClick={e=>e.stopPropagation()} style={{
            position:'fixed', left: Math.min(ctxMenu.x, window.innerWidth-160), top: ctxMenu.y,
            background:'#fff', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
            padding:'6px 0', minWidth:150, border:'1px solid #e2e8f0', zIndex:9999,
          }}>
            {ctxMenu.type === 'text' && <>
              <button onClick={()=>{ haptic.light(); setEditingTextId(ctxMenu.id); closeCtxMenu(); }}
                style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:14, color:'#1e2d7d', fontWeight:600 }}>
                ✏️ Редагувати текст
              </button>
              <button onClick={()=>{ haptic.error(); if (ctxMenu.pageIdx !== undefined) deleteTxtForPage(ctxMenu.id, ctxMenu.pageIdx); else deleteTxt(ctxMenu.id); closeCtxMenu(); }}
                style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:14, color:'#ef4444', fontWeight:600 }}>
                🗑️ Видалити
              </button>
            </>}
            {ctxMenu.type === 'slot' && <>
              <button onClick={()=>{ haptic.light();
                const [pi,si] = ctxMenu.id.split('-').map(Number);
                setPages(prev=>prev.map((p,i)=>i!==pi?p:{...p,slots:p.slots.map((s,j)=>j!==si?s:{...s,photoId:null,cropX:50,cropY:50})}));
                closeCtxMenu();
              }} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:14, color:'#374151', fontWeight:500 }}>
                🖼️ Очистити слот
              </button>
              <button onClick={()=>{ haptic.light(); setPhotoEditSlot(ctxMenu.id); closeCtxMenu(); }}
                style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:14, color:'#1e2d7d', fontWeight:500 }}>
                ✂️ Режим кадрування
              </button>
            </>}
          </div>
        </div>
      )}

      {isMobile && showMobileGuide && (
        <div onClick={dismissMobileGuide} style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(10,15,40,0.92)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:'0 0 24px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:'24px 24px 0 0', padding:'24px 20px 8px', display:'flex', flexDirection:'column', gap:0 }}>
            {/* Handle */}
            <div style={{ width:40, height:4, borderRadius:2, background:'#e2e8f0', margin:'0 auto 20px' }}/>
            <div style={{ fontSize:18, fontWeight:800, color:'#1e2d7d', marginBottom:4, textAlign:'center' }}>Як користуватись редактором</div>
            <div style={{ fontSize:12, color:'#94a3b8', textAlign:'center', marginBottom:20 }}>Підказки для роботи на телефоні</div>

            {/* Steps */}
            {[
              { icon:'📸', title:'Додати фото в слот', desc:'Відкрий "Зображення" → тапни фото → тапни слот на сторінці' },
              { icon:'✌️', title:'Збільшити/зменшити фото', desc:'Зведи або розведи два пальці на фото (pinch-zoom)' },
              { icon:'👆👆', title:'Змінити кадрування', desc:'Двічі тапни на фото → переміщай пальцем → "Готово"' },
              { icon:'☝️', title:'Перемістити слот', desc:'Один палець на рамці фотослота → тягни в потрібне місце' },
              { icon:'↔️', title:'Змінити розмір слота', desc:'Тапни слот → тягни за білі кутові ручки' },
              { icon:'⊡', title:'Редагувати обкладинку', desc:'Перейди на "Обкладинка" → налаштуй фото, текст, накладення' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:22, width:36, textAlign:'center', flexShrink:0, marginTop:2 }}>{icon}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:2 }}>{title}</div>
                  <div style={{ fontSize:11, color:'#64748b', lineHeight:1.4 }}>{desc}</div>
                </div>
              </div>
            ))}

            <button onClick={dismissMobileGuide}
              style={{ width:'100%', marginTop:16, padding:'14px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer' }}>
              Зрозуміло, починаємо! →
            </button>
            <button onClick={dismissMobileGuide}
              style={{ width:'100%', marginTop:8, marginBottom:8, padding:'10px', background:'none', color:'#94a3b8', border:'none', fontSize:12, cursor:'pointer' }}>
              Більше не показувати
            </button>
          </div>
        </div>
      )}

      {/* MOBILE: Tap-to-place floating banner */}
      {isMobile && tapSelectedPhotoId && !mobilePanel && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:250, background:'#1e2d7d', color:'#fff', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 2px 12px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize:13, fontWeight:600 }}>👆 Тапніть на фотослот для розміщення</span>
          <button onClick={()=>setTapSelectedPhotoId(null)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, fontWeight:600 }}>Скасувати</button>
        </div>
      )}

      {/* MOBILE: Bottom Tab Bar */}
      {isMobile && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #e2e8f0', display:'flex', zIndex:200, paddingBottom:'env(safe-area-inset-bottom)' }}>
          {[
            ['photos', <ImageIcon key="p" size={18}/>, 'Фото'],
            ['layouts', <LayoutGrid key="l" size={18}/>, 'Шаблон'],
            ['text', <Type key="t" size={18}/>, 'Текст'],
            ['bg', <span key="bg" style={{fontSize:14,fontWeight:700}}>Фн</span>, 'Фон'],
            ['shapes', <span key="sh" style={{fontSize:14}}>◻</span>, 'Фігури'],
            ['stickers', <span key="stk" style={{fontSize:14}}>★</span>, 'Стікери'],
            ['frames', <span key="fr" style={{fontSize:14}}>⬜</span>, 'Рамки'],
            ...(hasKalka?[['kalka', <span key="kl" style={{fontSize:12,fontWeight:700}}>КЛ</span>, 'Калька']]:[] as any),
            ...(hasEndpaper?[['endpaper', <span key="ep" style={{fontSize:11,fontWeight:700}}>ФЗ</span>, 'Форзац']]:[] as any),
            ...(currentIdx===0?[['cover', <span key="cv" style={{fontSize:14}}>▣</span>, 'Обкл.']]:[] as any),
          ].map(([id, icon, label]) => (
            <button key={id as string} onClick={() => { setLeftTab(id as any); setMobilePanel(true); if (id === 'layouts' && currentIdx === 0) setCurrentIdx(1); }}
              style={{ flex:1, padding:'8px 2px', border:'none', background: leftTab===id && mobilePanel ? '#1e2d7d' : 'transparent', color: leftTab===id && mobilePanel ? '#fff' : '#64748b', display:'flex', flexDirection:'column', alignItems:'center', gap:2, cursor:'pointer', minWidth:0 }}>
              {icon as React.ReactNode}
              <span style={{ fontSize:9, fontWeight:700, whiteSpace:'nowrap' }}>{label as string}</span>
            </button>
          ))}
        </div>
      )}

      {/* MOBILE: Bottom Sheet Panel */}
      {isMobile && mobilePanel && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, width:'100vw', maxWidth:'100vw', zIndex:300, background:'#fff', borderRadius:'16px 16px 0 0', boxShadow:'0 -8px 32px rgba(0,0,0,0.15)', maxHeight:'70vh', display:'flex', flexDirection:'column', paddingBottom:'calc(56px + env(safe-area-inset-bottom))', overflow:'hidden', boxSizing:'border-box' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #f1f5f9' }}>
            <span style={{ fontWeight:800, fontSize:13, color:'#1e2d7d' }}>{({'photos':'Зображення','layouts':'Шаблон','text':'Текст','bg':'Фон','shapes':'Фігури','stickers':'Стікери','cover':'Обкладинка','frames':'Рамки','kalka':'Калька','endpaper':'Форзац'} as Record<string,string>)[leftTab]}</span>
            <button onClick={()=>setMobilePanel(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', fontSize:20, lineHeight:1, padding:'0 4px' }}>×</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'12px 14px', boxSizing:'border-box', width:'100%', minWidth:0 }}>
            {/* Render the same content as desktop left panel */}
            {leftTab === 'layouts' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {LAYOUTS.filter(l => l.group !== undefined).map(l => {
                    const activeIdx = getActivePageIdx();
                    const active = pages[activeIdx]?.layout === l.id;
                    return (
                      <button key={l.id} onClick={()=>{ changeLayout(l.id, activeIdx); setMobilePanel(false); }}
                        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'8px 4px', border: active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background: active?'#1e2d7d':'#fff', cursor:'pointer' }}>
                        <LayoutSVG layout={l.id} active={active}/>
                        <span style={{ fontSize:9, fontWeight:600, color: active?'#fff':'#374151', textAlign:'center', lineHeight:1.2 }}>{l.label}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Add/Remove spread buttons */}
                <div style={{ display:'flex', gap:8, marginTop:10, paddingTop:10, borderTop:'1px solid #f1f5f9' }}>
                  <button onClick={()=>{ addSpread(); setMobilePanel(false); }}
                    style={{ flex:1, padding:'10px 6px', border:'1px solid #d1fae5', borderRadius:10, background:'#f0fdf4', cursor:'pointer', fontWeight:700, fontSize:12, color:'#059669', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                    <span style={{fontSize:18,lineHeight:1}}>+</span> Додати розворот
                  </button>
                  <button onClick={()=>{ removeCurrentSpread(); setMobilePanel(false); }} disabled={currentIdx===0||pages.length<=3}
                    style={{ flex:1, padding:'10px 6px', border:'1px solid #fee2e2', borderRadius:10, background:'#fff7f7', cursor:currentIdx===0||pages.length<=3?'not-allowed':'pointer', fontWeight:700, fontSize:12, color:currentIdx===0||pages.length<=3?'#fca5a5':'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                    <span style={{fontSize:18,lineHeight:1}}>−</span> Видалити цей
                  </button>
                </div>
              </>
            )}
            {leftTab === 'photos' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button onClick={()=>document.getElementById('photo-upload-mobile')?.click()} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', border:'2px dashed #c7d2fe', borderRadius:10, background:'#f0f3ff', cursor:'pointer', fontWeight:700, fontSize:13, color:'#1e2d7d' }}>
                  <ImageIcon size={16}/> Завантажити фото
                </button>
                <input id="photo-upload-mobile" type="file" multiple accept="image/*" style={{display:'none'}} onChange={handleUpload}/>
                {tapSelectedPhotoId && (
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'8px 10px', marginBottom:8, fontSize:11, color:'#1d4ed8', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span>👆 Тапніть фотослот на сторінці</span>
                    <button onClick={()=>setTapSelectedPhotoId(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', fontSize:14, padding:'0 4px' }}>×</button>
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {photos.map((ph, i) => {
                    const used = usedIds.has(ph.id);
                    const isTapped = tapSelectedPhotoId === ph.id;
                    return (
                      <div key={ph.id}
                        onClick={() => {
                          if (used) return;
                          if (isTapped) { setTapSelectedPhotoId(null); return; }
                          setTapSelectedPhotoId(ph.id);
                          setMobilePanel(false); // close sheet so canvas is visible
                        }}
                        style={{ aspectRatio:'1', borderRadius:8, overflow:'hidden', cursor: used ? 'default' : 'pointer',
                          border: isTapped ? '3px solid #3b82f6' : '2px solid ' + (used ? '#10b981' : '#e2e8f0'),
                          opacity: used ? 0.6 : 1, position:'relative' }}>
                        <img src={ph.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>
                        {used && <div style={{ position:'absolute', inset:0, background:'rgba(16,185,129,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>✓</div>}
                        {isTapped && <div style={{ position:'absolute', inset:0, background:'rgba(59,130,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>👆</div>}
                        <span style={{ position:'absolute', bottom:2, left:2, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:9, fontWeight:700, padding:'1px 4px', borderRadius:3 }}>{i+1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {leftTab === 'stickers' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
                {['❤️','⭐','☀️','🌸','👑','🦋','🌙','☁️','💎','🌈','🔥','⚡','✨','🎀','🎈','❄️'].map((em,i) => (
                  <button key={i} onClick={()=>{ const spi=getActivePageIdx(); setPageStickers(prev=>({...prev,[spi]:[...(prev[spi]||[]),{id:'stk-'+Date.now(),url:'',emoji:em,x:42,y:42,w:'12%',h:'12%'}]})); toast.success('Стікер додано'); setMobilePanel(false); }}
                    style={{ padding:8, border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:24, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {em}
                  </button>
                ))}
              </div>
            )}

            {/* MOBILE COVER PANEL */}
            {leftTab === 'cover' && (() => {
              const isPrintedMobile = isPrinted; // use same logic as desktop
              const ps = coverState.printedPhotoSlot ?? { x:0, y:0, w:100, h:100, shape:'rect' };
              const pt = coverState.printedTextBlocks ?? [];
              const ov = coverState.printedOverlay ?? { type:'none', color:'#000000', opacity:40, gradient:'linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.6) 100%)' };
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {isPrintedMobile ? (
                    <>
                      {/* Photo slot shape */}
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Форма фотослота</div>
                        <div style={{ display:'flex', gap:8 }}>
                          {(['rounded','circle'] as const).map(sh => (
                            <button key={sh} onClick={()=>setCoverState(p=>({...p,printedPhotoSlot:{...ps,shape:sh}}))}
                              style={{ flex:1, padding:'10px 4px', border: ps.shape===sh?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background: ps.shape===sh?'#f0f3ff':'#fff', cursor:'pointer', fontSize:20 }}>
                              {sh==='rounded'?'▢':'◯'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Overlay */}
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Накладення</div>
                        <div style={{ display:'flex', gap:6 }}>
                          {(['none','color','gradient'] as const).map(t => (
                            <button key={t} onClick={()=>setCoverState(p=>({...p,printedOverlay:{...ov,type:t}}))}
                              style={{ flex:1, padding:'8px 4px', border: ov.type===t?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background: ov.type===t?'#f0f3ff':'#fff', cursor:'pointer', fontSize:11, fontWeight:600, color: ov.type===t?'#1e2d7d':'#374151' }}>
                              {t==='none'?'Немає':t==='color'?'Колір':'Градієнт'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* BG color */}
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Фон обкладинки</div>
                        <label style={{ display:'inline-flex', alignItems:'center', gap:10, cursor:'pointer', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px', position:'relative', overflow:'hidden' }}>
                          <div style={{ width:32, height:32, borderRadius:6, background: coverState.printedBgColor||'#ffffff', border:'1px solid rgba(0,0,0,0.15)', flexShrink:0 }}/>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Обрати колір</div>
                            <div style={{ fontSize:10, color:'#94a3b8' }}>{coverState.printedBgColor||'#ffffff'}</div>
                          </div>
                          <input type="color" value={coverState.printedBgColor||'#ffffff'}
                            onChange={e=>setCoverState(p=>({...p,printedBgColor:e.target.value}))}
                            style={{ position:'absolute', inset:0, opacity:0.01, width:'100%', height:'100%', cursor:'pointer', border:'none', padding:0 }}/>
                        </label>
                      </div>
                      {/* Text blocks */}
                      <div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#64748b' }}>Текст на обкладинці</div>
                          <button onClick={()=>setCoverState(p=>({...p,printedTextBlocks:[...(p.printedTextBlocks||[]),{id:'ptxt-'+Date.now(),text:'Ваш текст',x:50,y:50,fontSize:24,fontFamily:'Playfair Display',color:'#ffffff',bold:true}]}))}
                            style={{ padding:'6px 12px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                            + Додати текст
                          </button>
                        </div>
                        {pt.map(tb => (
                          <div key={tb.id} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px', marginBottom:8, display:'flex', flexDirection:'column', gap:8 }}>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <input value={tb.text} onChange={e=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,text:e.target.value}:t)}))}
                                style={{ flex:1, padding:'8px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:13 }}/>
                              <button onClick={()=>setCoverState(p=>({...p,printedTextBlocks:pt.filter(t=>t.id!==tb.id)}))}
                                style={{ width:28, height:28, borderRadius:'50%', background:'#ef4444', color:'#fff', border:'none', cursor:'pointer', fontSize:14, flexShrink:0 }}>×</button>
                            </div>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              <input type="color" value={tb.color}
                                onChange={e=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,color:e.target.value}:t)}))}
                                style={{ width:32, height:32, border:'none', borderRadius:4, cursor:'pointer' }}/>
                              <input type="range" min={10} max={72} value={tb.fontSize}
                                onChange={e=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,fontSize:+e.target.value}:t)}))}
                                style={{ flex:1 }}/>
                              <span style={{ fontSize:11, color:'#94a3b8', minWidth:28 }}>{tb.fontSize}</span>
                              <button onClick={()=>setCoverState(p=>({...p,printedTextBlocks:pt.map(t=>t.id===tb.id?{...t,bold:!t.bold}:t)}))}
                                style={{ padding:'4px 8px', border: tb.bold?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background: tb.bold?'#f0f3ff':'#fff', cursor:'pointer', fontSize:12, fontWeight:700 }}>B</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Non-printed: color picker + deco */}
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Колір обкладинки</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{effectiveCoverColor || 'Не вибрано'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Текст на обкладинці</div>
                        <input value={coverState.decoText||''} onChange={e=>setCoverState(p=>({...p,decoText:e.target.value}))}
                          placeholder="Ваш напис"
                          style={{ width:'100%', padding:'10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, boxSizing:'border-box' }}/>
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Колір тексту</div>
                        <label style={{ display:'inline-flex', alignItems:'center', gap:10, cursor:'pointer', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px', position:'relative', overflow:'hidden' }}>
                          <div style={{ width:32, height:32, borderRadius:6, background: coverState.decoColor||'#D4AF37', border:'1px solid rgba(0,0,0,0.15)', flexShrink:0 }}/>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Обрати колір</div>
                            <div style={{ fontSize:10, color:'#94a3b8' }}>{coverState.decoColor||'#D4AF37'}</div>
                          </div>
                          <input type="color" value={coverState.decoColor||'#D4AF37'}
                            onChange={e=>setCoverState(p=>({...p,decoColor:e.target.value}))}
                            style={{ position:'absolute', inset:0, opacity:0.01, width:'100%', height:'100%', cursor:'pointer', border:'none', padding:0 }}/>
                        </label>
                      </div>
                    </>
                  )}
                  {/* Back cover */}
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Задня обкладинка — колір фону</div>
                    <label style={{ display:'inline-flex', alignItems:'center', gap:10, cursor:'pointer', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px', position:'relative', overflow:'hidden' }}>
                      <div style={{ width:32, height:32, borderRadius:6, background: coverState.backCoverBgColor||'#f1f5f9', border:'1px solid rgba(0,0,0,0.15)', flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Обрати колір</div>
                        <div style={{ fontSize:10, color:'#94a3b8' }}>{coverState.backCoverBgColor||'#f1f5f9'}</div>
                      </div>
                      <input type="color" value={coverState.backCoverBgColor||'#f1f5f9'}
                        onChange={e=>setCoverState(p=>({...p,backCoverBgColor:e.target.value}))}
                        style={{ position:'absolute', inset:0, opacity:0.01, width:'100%', height:'100%', cursor:'pointer', border:'none', padding:0 }}/>
                    </label>
                  </div>
                </div>
              );
            })()}

            {/* TEXT */}
            {leftTab === 'text' && (() => {
              const spi = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
              const curPage = pages[currentIdx];
              const textBlocks = currentIdx === 0 ? [] : (curPage?.textBlocks || []);
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {/* Add text button */}
                  <button
                    onClick={() => {
                      const id = 'txt-' + Date.now();
                      setPages(prev => prev.map((p, i) => i !== currentIdx ? p : {
                        ...p,
                        textBlocks: [...p.textBlocks, {
                          id, text: 'Текст', x: 50, y: 50,
                          fontSize: tFontSize, fontFamily: tFontFamily,
                          color: tColor, bold: tBold, italic: tItalic
                        }]
                      }));
                      setSelectedTextId(id);
                      setSelectedTextPageIdx(currentIdx);
                    }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px', border:'2px dashed #c7d2fe', borderRadius:10, background:'#f0f3ff', cursor:'pointer', fontWeight:700, fontSize:13, color:'#1e2d7d' }}>
                    <span style={{fontSize:18}}>T</span> + Додати текст на сторінку
                  </button>

                  {/* Style controls */}
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Шрифт</div>
                    <select value={tFontFamily}
                      onChange={e => { const v=e.target.value; setTFontFamily(v); if (selectedTextId) updateTxtForPage(selectedTextId, { fontFamily: v }, selectedTextPageIdx); }}
                      style={{ padding:'8px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, width:'100%', fontFamily:tFontFamily }}>
                      {FONT_GROUPS.map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.fonts.map(f => <option key={f} value={f}>{f}</option>)}
                        </optgroup>
                      ))}
                    </select>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Розмір</div>
                      <span style={{ fontSize:11, fontWeight:700, color:'#1e2d7d' }}>{tFontSize}px</span>
                    </div>
                    <input type="range" min={8} max={120} value={tFontSize}
                      onChange={e => { const v=+e.target.value; setTFontSize(v); if (selectedTextId) updateTxt(selectedTextId, { fontSize: v }); }}
                      style={{ width:'100%' }} />

                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Колір</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
                      {COLORS.map(c => (
                        <button key={c} onClick={() => { setTColor(c); if (selectedTextId) updateTxtForPage(selectedTextId, { color: c }, selectedTextPageIdx); }}
                          style={{ width:30, height:30, borderRadius:'50%', background:c, border:tColor===c?'3px solid #1e2d7d':'2px solid #e2e8f0', cursor:'pointer', flexShrink:0 }} />
                      ))}
                      <label style={{ position:'relative', overflow:'hidden', width:30, height:30, borderRadius:'50%', border:'2px dashed #94a3b8', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                        +
                        <input type="color" value={tColor}
                          onChange={e => { setTColor(e.target.value); if (selectedTextId) updateTxtForPage(selectedTextId, { color: e.target.value }, selectedTextPageIdx); }}
                          style={{ position:'absolute', inset:0, opacity:0.01, width:'100%', height:'100%', cursor:'pointer', border:'none', padding:0 }}/>
                      </label>
                    </div>

                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => { const v=!tBold; setTBold(v); if (selectedTextId) updateTxtForPage(selectedTextId, { bold: v }, selectedTextPageIdx); }}
                        style={{ flex:1, padding:'8px', border:tBold?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:tBold?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:900, fontSize:16, color:tBold?'#1e2d7d':'#374151' }}>B</button>
                      <button onClick={() => { const v=!tItalic; setTItalic(v); if (selectedTextId) updateTxtForPage(selectedTextId, { italic: v }, selectedTextPageIdx); }}
                        style={{ flex:1, padding:'8px', border:tItalic?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:tItalic?'#f0f3ff':'#fff', cursor:'pointer', fontStyle:'italic', fontSize:16, color:tItalic?'#1e2d7d':'#374151' }}>I</button>
                    </div>
                  </div>

                  {/* Existing text blocks list */}
                  {textBlocks.length > 0 && (
                    <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:10 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8 }}>Тексти на сторінці:</div>
                      {textBlocks.map(tb => (
                        <div key={tb.id}
                          onClick={() => { setSelectedTextId(tb.id); setSelectedTextPageIdx(currentIdx); setTFontFamily(tb.fontFamily); setTFontSize(tb.fontSize); setTColor(tb.color); setTBold(tb.bold); setTItalic(!!tb.italic); }}
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', border:selectedTextId===tb.id?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:selectedTextId===tb.id?'#f0f3ff':'#fff', cursor:'pointer', marginBottom:6 }}>
                          <span style={{ flex:1, fontSize:13, fontFamily:tb.fontFamily, color:tb.color, fontWeight:tb.bold?700:400, fontStyle:tb.italic?'italic':'normal', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tb.text}</span>
                          <button onClick={e => { e.stopPropagation(); deleteTxtForPage(tb.id, currentIdx); if (selectedTextId===tb.id) setSelectedTextId(null); }}
                            style={{ width:24, height:24, borderRadius:'50%', background:'#fee2e2', border:'none', color:'#ef4444', cursor:'pointer', fontSize:14, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edit selected text inline */}
                  {selectedTextId && (() => {
                    const tb = textBlocks.find(t => t.id === selectedTextId);
                    if (!tb) return null;
                    return (
                      <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:10 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Редагувати текст:</div>
                        <input
                          value={tb.text}
                          onChange={e => updateTxtForPage(selectedTextId, { text: e.target.value }, selectedTextPageIdx)}
                          style={{ width:'100%', padding:'10px', border:'2px solid #1e2d7d', borderRadius:8, fontSize:14, fontFamily:tb.fontFamily, color:tb.color, fontWeight:tb.bold?700:400, fontStyle:tb.italic?'italic':'normal', boxSizing:'border-box' }}
                          autoFocus
                        />
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* SHAPES */}
            {leftTab === 'shapes' && (() => {
              const spi = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
              const allSpreadIdxs = currentIdx===0 ? [0] : [(currentIdx-1)*2+1, (currentIdx-1)*2+2];
              let selShape = null as any;
              let selSpi = spi;
              for (const pi of allSpreadIdxs) {
                const found = getCurShapes(pi).find((s:any)=>s.id===selectedShapeId);
                if (found) { selShape = found; selSpi = pi; break; }
              }
              return (
                <ShapeControls
                  selectedShape={selShape}
                  onChange={patch => {
                    if (!selShape) return;
                    setPageShapes(prev=>({...prev,[selSpi]:(prev[selSpi]||[]).map((s:any)=>s.id===selShape!.id?{...s,...patch}:s)}));
                  }}
                  onAdd={type => { addShape(type, spi); }}
                />
              );
            })()}

            {/* BG */}
            {leftTab === 'bg' && (
              <BackgroundControls
                bg={getCurBg(currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide)}
                onChange={bg => {
                  const idx = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
                  setPageBgs(prev=>({...prev,[idx]:bg}));
                }}
              />
            )}

            {/* FRAMES */}
            {leftTab === 'frames' && (
              <FrameControls
                frame={getCurFrame(currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide)}
                onChange={frame => {
                  const idx = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
                  setPageFrames(prev=>({...prev,[idx]:frame}));
                }}
              />
            )}

            {/* КАЛЬКА — mobile */}
            {(leftTab as string) === 'kalka' && hasKalka && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'8px 10px', fontSize:11, color:'#1d4ed8' }}>
                  Калька — напівпрозора сторінка перед першою фотосторінкою
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Ілюстрація</div>
                  <input ref={kalkaImageInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setKalkaState(p => ({ ...p, imageUrl: URL.createObjectURL(f as Blob) }));
                  }}/>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => kalkaImageInputRef.current?.click()}
                      style={{ flex:1, padding:'10px', border:'1.5px dashed #c7d2fe', borderRadius:10, background:'#f0f3ff', cursor:'pointer', fontSize:12, fontWeight:600, color:'#1e2d7d' }}>
                      📎 Завантажити зображення
                    </button>
                    {kalkaState.imageUrl && (
                      <button onClick={() => setKalkaState(p => ({ ...p, imageUrl: null }))}
                        style={{ padding:'10px 14px', border:'1px solid #fee2e2', borderRadius:10, background:'#fff7f7', cursor:'pointer', color:'#ef4444', fontWeight:700 }}>✕</button>
                    )}
                  </div>
                  {kalkaState.imageUrl && (
                    <img src={kalkaState.imageUrl} style={{ marginTop:8, width:'100%', maxHeight:100, objectFit:'contain', borderRadius:8, border:'1px solid #e2e8f0' }}/>
                  )}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Напис</div>
                  <textarea value={kalkaState.text} onChange={e => setKalkaState(p=>({...p,text:e.target.value}))}
                    placeholder="Введіть напис (необов\'язково)"
                    style={{ width:'100%', padding:'10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, resize:'none', height:64, boxSizing:'border-box' }}/>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8 }}>Шрифт</div>
                  <select value={kalkaState.fontFamily} onChange={e => setKalkaState(p=>({...p,fontFamily:e.target.value}))}
                    style={{ width:'100%', padding:'10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13 }}>
                    {['Playfair Display','Great Vibes','Cormorant Garamond','Montserrat','Open Sans','Dancing Script','Caveat'].map(f=>(
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6 }}>Розмір: {kalkaState.fontSize}px</div>
                    <input type="range" min={12} max={72} value={kalkaState.fontSize}
                      onChange={e => setKalkaState(p=>({...p,fontSize:+e.target.value}))} style={{ width:'100%' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6 }}>Колір</div>
                    <label style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'8px 10px', position:'relative', overflow:'hidden' }}>
                      <div style={{ width:28, height:28, borderRadius:6, background:kalkaState.textColor, border:'1px solid rgba(0,0,0,0.1)', flexShrink:0 }}/>
                      <input type="color" value={kalkaState.textColor} onChange={e=>setKalkaState(p=>({...p,textColor:e.target.value}))}
                        style={{ position:'absolute', inset:0, opacity:0.01, width:'100%', height:'100%', cursor:'pointer' }}/>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <BookPreviewModal
          pages={pages}
          photos={photos}
          propW={prop.w}
          propH={prop.h}
          freeSlots={freeSlots}
          coverState={coverState}
          isPrinted={isPrinted}
          selectedCoverType={config?.selectedCoverType || ''}
          effectiveCoverColor={effectiveCoverColor}
          onClose={() => setShowPreview(false)}
        />
      )}

    </div>
  );
}
