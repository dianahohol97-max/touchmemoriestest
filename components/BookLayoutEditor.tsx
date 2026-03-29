'use client';

import { useState, useEffect, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ShoppingCart, Image as ImageIcon, Type, Trash2, LayoutGrid, Wand2, RotateCcw, Eye, Plus, HelpCircle, Shuffle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { CoverEditor, FLEX_COLORS, METAL_COLORS, ACRYLIC_VARIANTS, PHOTO_INSERT_VARIANTS, METAL_VARIANTS } from './CoverEditor';
import { BookPreviewModal } from './BookPreviewModal';
import { FreeSlot, FreeSlotLayer, FreeSlotControls, SlotShape } from './FreeSlotLayer';
import { PageBackground, DEFAULT_BG, BackgroundLayer, BackgroundControls } from './BackgroundLayer';
import { Shape, ShapeType, ShapesLayer, ShapeControls } from './ShapesLayer';
import { FrameConfig, DEFAULT_FRAME, FrameLayer, FrameControls } from './FramesLayer';

interface PhotoData { id: string; preview: string; width: number; height: number; name: string; }
interface BookConfig { productSlug: string; productName: string; selectedSize?: string; selectedCoverType?: string; selectedCoverColor?: string; selectedDecoration?: string; selectedDecorationVariant?: string; selectedDecorationSize?: string; selectedDecorationColor?: string; selectedPageCount: string; totalPrice: number; selectedLamination?: string; }

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
};

function makeSlots(n: number): SlotData[] {
  return Array.from({ length: n }, () => ({ photoId: null, cropX: 50, cropY: 50, zoom: 1 }));
}

const FONT_GROUPS = [
  { group: 'Сучасні', fonts: ['Montserrat','Inter','Lato','Raleway','Nunito','Poppins','Oswald','Josefin Sans','Open Sans'] },
  { group: 'Класичні', fonts: ['Playfair Display','Georgia','Cormorant Garamond','EB Garamond','Libre Baskerville','Lora','Merriweather'] },
  { group: 'Каліграфічні', fonts: ['Dancing Script','Great Vibes','Pacifico','Sacramento','Satisfy','Alex Brush','Pinyon Script','Italianno','Allura','Tangerine'] },
  { group: 'Кириличні', fonts: ['Marck Script','Philosopher','Russo One','Comfortaa','Lobster','Caveat','Poiret One','Cuprum','Jura','Neucha','Didact Gothic'] },
  { group: 'Декоративні', fonts: ['Abril Fatface','Cinzel','Bebas Neue','Righteous','Spectral','Rozha One'] },
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
  const { addItem } = useCartStore();

  const [config, setConfig] = useState<BookConfig | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [zoom, setZoom] = useState(70);
  const [leftTab, setLeftTab] = useState<'photos'|'layouts'|'text'|'cover'|'bg'|'shapes'|'frames'|'options'>('photos');
  const [coverState, setCoverState] = useState<CoverState>({ decoType: 'none', decoVariant: '', photoId: null, decoText: '', decoColor: '#D4AF37', textX: 50, textY: 85, textFontFamily: 'Georgia', textFontSize: 14 });
  const [freeSlots, setFreeSlots] = useState<Record<number, FreeSlot[]>>({});
  const [pageBgs, setPageBgs] = useState<Record<number, PageBackground>>({});
  const [pageShapes, setPageShapes] = useState<Record<number, Shape[]>>({});
  const [pageFrames, setPageFrames] = useState<Record<number, FrameConfig>>({});
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [textTool, setTextTool] = useState(false);
  const [photoEditSlot, setPhotoEditSlot] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedTextPageIdx, setSelectedTextPageIdx] = useState<number>(1);
  const [showDecoList, setShowDecoList] = useState(false);
  const [stickerSearch, setStickerSearch] = useState('');
  const [dbStickers, setDbStickers] = useState<{id:string;name:string;category:string;image_url:string;tags:string[]}[]>([]);
  const [pageStickers, setPageStickers] = useState<Record<number,{id:string;url:string;x:number;y:number;w:number;h:number}[]>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [showTooltips, setShowTooltips] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('editor_tooltips_seen');
  });
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

  // Load stickers from DB
  useEffect(() => {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    sb.from('editor_stickers').select('*').eq('is_active', true).order('sort_order').then(({data}) => {
      if (data) setDbStickers(data);
    });
  }, []);

  useEffect(() => {
    const fams = ['Inter','Lato','Raleway','Nunito','Poppins','Oswald','Josefin+Sans','Open+Sans',
      'Playfair+Display','Cormorant+Garamond','EB+Garamond','Libre+Baskerville','Lora','Merriweather',
      'Dancing+Script','Great+Vibes','Pacifico','Sacramento','Satisfy',
      'Alex+Brush','Pinyon+Script','Italianno','Allura','Tangerine',
      'Marck+Script','Philosopher','Russo+One','Comfortaa','Lobster','Caveat','Poiret+One',
      'Cuprum','Jura','Neucha','Didact+Gothic',
      'Abril+Fatface','Cinzel','Bebas+Neue','Righteous','Spectral','Rozha+One'];
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
  }, [router]);

  // Auto-switch to cover tab on page 0
  useEffect(() => {
    if (currentIdx === 0) setLeftTab('cover');
    else if (leftTab === 'cover') setLeftTab('photos');
  }, [currentIdx]);

  useEffect(() => {
    if (!config) return;
    const m = config.selectedPageCount.match(/(\d+)/);
    const total = m ? parseInt(m[0]) : 20;
    const ps: Page[] = [];
    ps.push({ id: 0, label: 'Обкладинка', layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
    // Content pages in pairs (spreads)
    for (let i = 1; i <= total; i += 2) {
      ps.push({ id: i, label: `${i}–${Math.min(i+1, total)}`, layout: 'p-full', slots: makeSlots(1), textBlocks: [] });
    }
    setPages(ps);
  }, [config]);

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) ?? null : null;
  const usedIds = new Set(pages.flatMap(p => p.slots.map(sl => sl.photoId).filter(Boolean)));
  const cur = pages[currentIdx];

  const sizeKey = config?.selectedSize ?? 'A4';
  const prop = PAGE_PROPORTIONS[sizeKey] ?? PAGE_PROPORTIONS['A4'];
  // Spread = 2 pages side by side
  const baseH = 460;
  const baseW = baseH * (2 * prop.w) / prop.h; // spread width = 2 pages
  const cW = baseW * zoom / 100; // full spread width
  const cH = baseH * zoom / 100;
  const pageW = cW / 2; // single page width

  // Init cover state from config
  useEffect(() => {
    if (!config) return;
    const deco = config.selectedDecoration?.toLowerCase() || '';
    let decoType: CoverDecoType = 'none';
    if (deco.includes('акрил')) decoType = 'acryl';
    else if (deco.includes('фотовставка') || deco.includes('photo')) decoType = 'photovstavka';
    else if (deco.includes('флекс') || deco.includes('flex')) decoType = 'flex';
    else if (deco.includes('метал')) decoType = 'metal';
    else if (deco.includes('гравір')) decoType = 'graviruvannya';
    const dc = config.selectedDecorationColor?.toLowerCase() || '';
    setCoverState(prev => ({ ...prev, decoType }));
  }, [config]);

  const curFreeSlots = freeSlots[currentIdx] || [];
  const setCurFreeSlots = (slots: FreeSlot[] | ((prev: FreeSlot[]) => FreeSlot[])) => {
    setFreeSlots(prev => ({
      ...prev,
      [currentIdx]: typeof slots === 'function' ? slots(prev[currentIdx] || []) : slots,
    }));
  };

  // Shuffle layout for active page — pick next compatible layout with same slot count
  const shuffleLayout = () => {
    const targetIdx = getActivePageIdx();
    const currentPage = pages[targetIdx];
    if (!currentPage) return;
    const currentSlotCount = currentPage.slots.length;
    // Get all layouts with same slot count
    const compatibleLayouts = LAYOUTS.filter(l => {
      const slotCount = l.slots;
      return slotCount === currentSlotCount;
    });
    if (compatibleLayouts.length <= 1) {
      // Try layouts with +/-1 slot
      const broader = LAYOUTS.filter(l => Math.abs(l.slots - currentSlotCount) <= 1);
      if (broader.length === 0) return;
      const current = broader.findIndex(l => l.id === currentPage.layout);
      const nextIdx = (current + 1) % broader.length;
      changeLayout(broader[nextIdx].id as LayoutType);
    } else {
      const current = compatibleLayouts.findIndex(l => l.id === currentPage.layout);
      const nextIdx = (current + 1) % compatibleLayouts.length;
      changeLayout(compatibleLayouts[nextIdx].id as LayoutType);
    }
  };

  // Add spread (2 pages)
  const addSpread = () => {
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

  const removeLastSpread = () => {
    if (pages.length <= 3) { toast.error('Мінімум 1 розворот'); return; }
    setPages(prev => prev.slice(0, -2));
    setCurrentIdx(prev => Math.min(prev, Math.ceil((pages.length - 3) / 2)));
  };

  const getCurBg = (idx: number): PageBackground => pageBgs[idx] || DEFAULT_BG;
  const getCurFrame = (idx: number): FrameConfig => pageFrames[idx] || DEFAULT_FRAME;
  const getCurShapes = (idx: number): Shape[] => pageShapes[idx] || [];

  const addShape = (type: ShapeType, pageIdx: number) => {
    const id = 'shape-' + Date.now();
    const newShape: Shape = { id, type, x: pageW*0.2, y: cH*0.2, w: pageW*0.35, h: type==='line'?0:cH*0.25, fill: type==='line'?'transparent':'#1e2d7d', stroke: '#1e2d7d', strokeWidth: type==='line'?4:0, opacity: 80, rotation: 0 };
    setPageShapes(prev => ({ ...prev, [pageIdx]: [...(prev[pageIdx]||[]), newShape] }));
  };

  const addFreeSlot = () => {
    const targetPageIdx = getActivePageIdx();
    const id = 'free-' + Date.now();
    const newSlot: FreeSlot = {
      id, x: pageW * 0.2, y: cH * 0.2,
      w: pageW * 0.5, h: cH * 0.4,
      shape: 'rect', photoId: null, cropX: 50, cropY: 50, zoom: 1,
    };
    setFreeSlots(prev => ({ ...prev, [targetPageIdx]: [...(prev[targetPageIdx]||[]), newSlot] }));
  };

  // In spread view, changeLayout applies to the hovered/selected page side
  const [activeSide, setActiveSide] = useState<0|1>(0);
  const getActivePageIdx = () => currentIdx === 0 ? 0 : (currentIdx - 1) * 2 + 1 + activeSide;

  const changeLayout = (layout: LayoutType) => {
    const def = LAYOUTS.find(l => l.id === layout);
    if (!def) return;
    const targetIdx = getActivePageIdx();
    const newSlotCount = def.slots;
    setPages(prev => prev.map((p, i) => {
      if (i !== targetIdx) return p;
      const existingPhotos = p.slots.map(s => s.photoId).filter(Boolean);
      const newSlots: SlotData[] = Array.from({ length: newSlotCount }, (_, si) => ({
        photoId: existingPhotos[si] ?? null, cropX: 50, cropY: 50, zoom: 1,
      }));
      return { ...p, layout, slots: newSlots };
    }));
  };

  const autoFill = () => {
    let pi = 0;
    setPages(prev => prev.map(p => ({ ...p, slots: p.slots.map(sl => { if (sl.photoId) return sl; const ph = photos[pi]; if (!ph) return sl; pi++; return { ...sl, photoId: ph.id }; }) })));
    toast.success('Фото розставлено');
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let done = 0;
    const newPhotos: PhotoData[] = [];
    files.forEach(file => {
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
    e.preventDefault();
    const photoId = e.dataTransfer?.getData('photoId') || e.dataTransfer?.getData('text/plain');
    if (!photoId) return;
    setPages(prev => prev.map((p, pi2) => pi2 !== pi ? p : {
      ...p,
      slots: p.slots.map((s2, si2) => si2 !== si ? s2 : { ...s2, photoId }),
    }));
  };
  const clearSlot = (pi: number, si: number) => setPages(prev => prev.map((p, i) => i !== pi ? p : { ...p, slots: p.slots.map((sl, j) => j !== si ? sl : { ...sl, photoId: null }) }));

  const startCrop = (e: React.MouseEvent, key: string, cx: number, cy: number) => {
    e.preventDefault();
    cropRef.current = { key, sx: e.clientX, sy: e.clientY, cx, cy };
    const onMove = (me: MouseEvent) => {
      if (!cropRef.current) return;
      const [pi, si] = cropRef.current.key.split('-').map(Number);
      const nx = Math.max(0, Math.min(100, cropRef.current.cx - (me.clientX - cropRef.current.sx) / 3));
      const ny = Math.max(0, Math.min(100, cropRef.current.cy - (me.clientY - cropRef.current.sy) / 3));
      setPages(prev => prev.map((p, i) => i !== pi ? p : { ...p, slots: p.slots.map((sl, j) => j !== si ? sl : { ...sl, cropX: nx, cropY: ny }) }));
    };
    const onUp = () => { cropRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!textTool) { setSelectedTextId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const id = 'txt-' + Date.now();
    setPages(prev => prev.map((p, i) => i !== currentIdx ? p : { ...p, textBlocks: [...p.textBlocks, { id, text: 'Текст', x: ((e.clientX - rect.left) / cW) * 100, y: ((e.clientY - rect.top) / cH) * 100, fontSize: tFontSize, fontFamily: tFontFamily, color: tColor, bold: tBold, italic: tItalic }] }));
    setSelectedTextId(id); setEditingTextId(id); setTextTool(false);
  };

  // Per-page text helpers for spread view
  const onCanvasClickForPage = (e: React.MouseEvent<HTMLDivElement>, pageIdx: number) => {
    if (!textTool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const id = 'txt-' + Date.now();
    setPages(prev => prev.map((p, i) => i !== pageIdx ? p : { ...p, textBlocks: [...p.textBlocks, { id, text: 'Текст', x: ((e.clientX - rect.left) / pageW) * 100, y: ((e.clientY - rect.top) / cH) * 100, fontSize: tFontSize, fontFamily: tFontFamily, color: tColor, bold: tBold, italic: tItalic }] }));
    setSelectedTextId(id); setEditingTextId(id); setTextTool(false);
  };
  const updateTxtForPage = (id: string, ch: Partial<TextBlock>, pageIdx: number) => setPages(prev => prev.map((p, i) => i !== pageIdx ? p : { ...p, textBlocks: p.textBlocks.map(t => t.id === id ? { ...t, ...ch } : t) }));
  const deleteTxtForPage = (id: string, pageIdx: number) => { setPages(prev => prev.map((p, i) => i !== pageIdx ? p : { ...p, textBlocks: p.textBlocks.filter(t => t.id !== id) })); setSelectedTextId(null); setEditingTextId(null); };
  const startTxtDragForPage = (e: React.MouseEvent, id: string, tx: number, ty: number, pageIdx: number) => {
    e.stopPropagation(); e.preventDefault();
    txtRef.current = { id, sx: e.clientX, sy: e.clientY, tx, ty };
    const onMove = (me: MouseEvent) => { if (!txtRef.current) return; updateTxtForPage(txtRef.current.id, { x: Math.max(0,Math.min(95,txtRef.current.tx+((me.clientX-txtRef.current.sx)/pageW)*100)), y: Math.max(0,Math.min(95,txtRef.current.ty+((me.clientY-txtRef.current.sy)/cH)*100)) }, pageIdx); };
    const onUp = () => { txtRef.current=null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
  };

  const updateTxt = (id: string, ch: Partial<TextBlock>) => setPages(prev => prev.map((p, i) => i !== currentIdx ? p : { ...p, textBlocks: p.textBlocks.map(t => t.id === id ? { ...t, ...ch } : t) }));
  const deleteTxt = (id: string) => { setPages(prev => prev.map((p, i) => i !== currentIdx ? p : { ...p, textBlocks: p.textBlocks.filter(t => t.id !== id) })); setSelectedTextId(null); setEditingTextId(null); };

  const startTxtDrag = (e: React.MouseEvent, id: string, tx: number, ty: number) => {
    e.stopPropagation(); e.preventDefault();
    txtRef.current = { id, sx: e.clientX, sy: e.clientY, tx, ty };
    const onMove = (me: MouseEvent) => { if (!txtRef.current) return; updateTxt(txtRef.current.id, { x: Math.max(0, Math.min(95, txtRef.current.tx + ((me.clientX - txtRef.current.sx) / cW) * 100)), y: Math.max(0, Math.min(95, txtRef.current.ty + ((me.clientY - txtRef.current.sy) / cH) * 100)) }); };
    const onUp = () => { txtRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  const addToCart = () => {
    if (!config) return;
    addItem({ id: `pb-${Date.now()}`, name: config.productName || 'Фотокнига', price: dynamicPrice, qty: 1, image: getPhoto(pages[0]?.slots[0]?.photoId ?? null)?.preview || '', options: { 'Розмір': config.selectedSize || '', 'Сторінок': config.selectedPageCount }, personalization_note: `${pages.length} сторінок` });
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, gap: 16 }}>
        {/* Back button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              if (window.confirm('Вийти з редактора? Незбережені зміни буде втрачено.')) {
                router.back();
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: '#374151' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>НАЗАД</span>
          </button>
          <div style={{ width: 1, height: 32, background: '#e2e8f0' }}/>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1e2d7d' }}>{config.productName || 'Фотокнига'}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Редактор • {photos.length} фото • {pages.length} сторінок</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={autoFill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e2d7d' }}><Wand2 size={14} /> Авто</button>
          <button onClick={() => setZoom(z => Math.max(30, z - 10))} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomOut size={14} /></button>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(130, z + 10))} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomIn size={14} /></button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Live price */}
          <div style={{ textAlign:'right', paddingRight:4 }}>
            <div style={{ fontSize:11, color:'#94a3b8' }}>{pages.length - 1} стор. ({Math.ceil((pages.length-1)/2)} розворот{Math.ceil((pages.length-1)/2)===1?'':'и'})</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#1e2d7d' }}>
              {dynamicPrice} ₴
              {priceDiff !== 0 && <span style={{ fontSize:11, color: priceDiff > 0 ? '#10b981':'#ef4444', marginLeft:4 }}>{priceDiff>0?'+':''}{priceDiff}₴</span>}
            </div>
          </div>
          {/* Preview */}
          <button onClick={() => setShowPreview(true)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', background:'#f0f3ff', color:'#1e2d7d', border:'1px solid #c7d2fe', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            <Eye size={14}/> Превью
          </button>
          {/* Help */}
          <button onClick={() => { setTooltipStep(0); setShowTooltips(true); }} title="Підказки"
            style={{ padding:'9px 10px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' }}>
            <HelpCircle size={14}/>
          </button>
          {/* Add to cart */}
          <button onClick={addToCart}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 22px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 16px rgba(38,58,153,0.3)' }}>
            <ShoppingCart size={15}/> До кошика
          </button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ICON SIDEBAR */}
        <div style={{ width: 72, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, borderRight: '1px solid #f1f5f9', flexShrink: 0 }}>
          {([
            ['photos', <ImageIcon key="p" size={20}/>, 'Зображення'],
            ['layouts', <LayoutGrid key="l" size={20}/>, 'Шаблон'],
            ['text', <Type key="t" size={20}/>, 'Текст'],
            ['bg', <span key="bg" style={{fontSize:16}}>▣</span>, 'Фон'],
            ['shapes', <span key="sh" style={{fontSize:16}}>◇</span>, 'Фігури'],
            ['frames', <span key="fr" style={{fontSize:16}}>▤</span>, 'Рамки'],
            ['stickers', <span key="stk" style={{fontSize:18}}>★</span>, 'Стікери'],
            ['options', <Settings key="opt" size={20}/>, 'Опції'],
            ...(currentIdx===0?[['cover', <span key="cv" style={{fontSize:16}}>▣</span>, 'Обкладинка']]:[] as any),
          ] as [string, React.ReactNode, string][]).map(([id, icon, label]) => (
            <button key={id} onClick={() => setLeftTab(id as any)}
              style={{ width: '100%', padding: '12px 4px', border: 'none', cursor: 'pointer', background: leftTab === id ? '#1e2d7d' : 'transparent', color: leftTab === id ? '#fff' : '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, marginBottom: 2, transition: 'background 0.15s' }}>
              {icon}
              <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
            </button>
          ))}
        </div>

        {/* CONTENT PANEL */}
        <div style={{ width: 200, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: 12, color: '#1e2d7d' }}>
            {leftTab === 'photos' ? 'Зображення' : leftTab === 'layouts' ? 'Шаблон' : 'Текст'}
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
                <FreeSlotControls
                  selectedSlot={curFreeSlots.find(s => true) ?? null}
                  onChangeShape={(shape: SlotShape) => {
                    // Apply to last added/selected slot
                    const last = curFreeSlots[curFreeSlots.length - 1];
                    if (last) setCurFreeSlots(prev => prev.map(s => s.id === last.id ? { ...s, shape } : s));
                  }}
                />

                {photos.length === 0 && <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: 0 }}>Додайте фото щоб почати</p>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {photos.map((ph, i) => {
                    const used = usedIds.has(ph.id);
                    return (
                      <div key={ph.id} draggable={!used} onDragStart={() => !used && setDragPhotoId(ph.id)} onDragEnd={() => { setDragPhotoId(null); setDropTarget(null); }}
                        style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', cursor: used ? 'default' : 'grab', opacity: used ? 0.45 : 1, border: '1px solid #e2e8f0' }}>
                        <img src={ph.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                        {used && <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✓</div>}
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
                          const active = cur?.layout === l.id;
                          return (
                            <button key={l.id} onClick={() => changeLayout(l.id)} title={l.label}
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
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
                  <button onClick={() => setPages(prev => prev.map((p, i) => i !== currentIdx ? p : { ...p, slots: makeSlots(LAYOUTS.find(l => l.id === p.layout)?.slots || 0) }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff7f7', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#ef4444', width: '100%' }}>
                    <RotateCcw size={13} /> Очистити сторінку
                  </button>
                </div>
              </div>
            )}

            {/* COVER */}
            {leftTab === 'cover' && currentIdx === 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em' }}>Оздоблення</div>
{/* Show selected decoration from product page or allow change */}
                {(() => {
                  const decoLabels: Record<string, string> = {
                    none: 'Без оздоблення', acryl: 'Акрил',
                    photovstavka: 'Фотовставка', metal: 'Металева вставка',
                    flex: 'Флекс', graviruvannya: 'Гравірування',
                  };
                  // use showDecoList from component state
                  const allDecoOpts = config.selectedCoverType?.toLowerCase().includes('шкір')
                    ? ['none','acryl','photovstavka','metal','flex']
                    : ['none','acryl','photovstavka','metal','flex','graviruvannya'];

                  return (
                    <>
                      {/* Current deco display */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', border:'2px solid #1e2d7d', borderRadius:8, background:'#f0f3ff' }}>
                        <span style={{ fontWeight:700, fontSize:13, color:'#1e2d7d' }}>
                          {decoLabels[coverState.decoType] || 'Без оздоблення'}
                          {coverState.decoVariant ? <span style={{ fontWeight:400, color:'#64748b', marginLeft:6, fontSize:11 }}>{coverState.decoVariant}</span> : null}
                        </span>
                        <button
                          onClick={() => setShowDecoList(v => !v)}  
                          style={{ fontSize:11, fontWeight:700, color:'#1e2d7d', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                          {showDecoList ? 'Сховати' : 'Змінити'}
                        </button>
                      </div>
                      {/* Expandable list */}
                      {showDecoList && (
                        <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:6 }}>
                          {allDecoOpts.map(id => (
                            <button key={id}
                              onClick={() => {
                                const firstVariant = id==='acryl' ? (ACRYLIC_VARIANTS[(config.selectedSize||'20x20').replace(/[×х]/g,'x').replace(/\s*см/g,'').trim()]||['100×100 мм'])[0]
                                  : id==='photovstavka' ? (PHOTO_INSERT_VARIANTS[(config.selectedSize||'20x20').replace(/[×х]/g,'x').replace(/\s*см/g,'').trim()]||['100×100 мм'])[0]
                                  : id==='metal' ? (METAL_VARIANTS[(config.selectedSize||'20x20').replace(/[×х]/g,'x').replace(/\s*см/g,'').trim()]||['60×60 золотий'])[0]
                                  : '';
                                setCoverState(prev => ({ ...prev, decoType: id as CoverDecoType, decoVariant: firstVariant }));
                                setShowDecoList(false);
                              }}
                              style={{ padding:'8px 12px', border: coverState.decoType===id ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius:8, background: coverState.decoType===id ? '#f0f3ff' : '#fff', cursor:'pointer', fontWeight:600, fontSize:12, color: coverState.decoType===id ? '#1e2d7d' : '#374151', textAlign:'left' }}>
                              {decoLabels[id]}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Flex color + font + size */}
                      {coverState.decoType === 'flex' && (
                        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:10 }}>
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Колір флексу</div>
                            <div style={{ display:'flex', gap:8 }}>
                              {FLEX_COLORS.map(c => (
                                <button key={c.value}
                                  onClick={() => setCoverState(prev => ({...prev, decoColor: c.value}))}
                                  title={c.label}
                                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                                  <div style={{ width:30, height:30, borderRadius:'50%', background:c.color, border: coverState.decoColor===c.value ? '3px solid #1e2d7d':'2px solid #e2e8f0', boxShadow:c.value==='white'?'inset 0 0 0 1px #ccc':'none' }}/>
                                  <span style={{ fontSize:9, color: coverState.decoColor===c.value ? '#1e2d7d':'#94a3b8', fontWeight: coverState.decoColor===c.value?700:400 }}>{c.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5 }}>Шрифт</div>
                            <select value={coverState.textFontFamily}
                              onChange={e => setCoverState(prev => ({...prev, textFontFamily: e.target.value}))}
                              style={{ width:'100%', padding:'7px 8px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:12, fontFamily:coverState.textFontFamily }}>
                              {['Playfair Display','Cinzel','Cormorant Garamond','Dancing Script','Great Vibes','Montserrat','Philosopher','Pinyon Script','Sacramento','Bebas Neue'].map(f=>(
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Розмір тексту</span>
                              <span style={{ fontSize:11, fontWeight:800, color:'#1e2d7d' }}>{coverState.textFontSize||32} px</span>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <button onClick={()=>setCoverState(p=>({...p,textFontSize:Math.max(10,(p.textFontSize||32)-2)}))} style={{ width:28,height:28,border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:'pointer',fontWeight:700,fontSize:15 }}>−</button>
                              <input type="range" min={10} max={80} value={coverState.textFontSize||32}
                                onChange={e=>setCoverState(p=>({...p,textFontSize:+e.target.value}))} style={{ flex:1 }}/>
                              <button onClick={()=>setCoverState(p=>({...p,textFontSize:Math.min(80,(p.textFontSize||32)+2)}))} style={{ width:28,height:28,border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:'pointer',fontWeight:700,fontSize:15 }}>+</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Engraving font + size */}
                      {coverState.decoType === 'graviruvannya' && (
                        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:10 }}>
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5 }}>Шрифт гравіювання</div>
                            <select value={coverState.textFontFamily}
                              onChange={e=>setCoverState(p=>({...p,textFontFamily:e.target.value}))}
                              style={{ width:'100%', padding:'7px 8px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:12, fontFamily:coverState.textFontFamily }}>
                              {['Playfair Display','Cinzel','Cormorant Garamond','Montserrat','Philosopher','Great Vibes','Dancing Script'].map(f=>(
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Розмір тексту</span>
                              <span style={{ fontSize:11, fontWeight:800, color:'#1e2d7d' }}>{coverState.textFontSize||32} px</span>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <button onClick={()=>setCoverState(p=>({...p,textFontSize:Math.max(10,(p.textFontSize||32)-2)}))} style={{ width:28,height:28,border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:'pointer',fontWeight:700,fontSize:15 }}>−</button>
                              <input type="range" min={10} max={80} value={coverState.textFontSize||32}
                                onChange={e=>setCoverState(p=>({...p,textFontSize:+e.target.value}))} style={{ flex:1 }}/>
                              <button onClick={()=>setCoverState(p=>({...p,textFontSize:Math.min(80,(p.textFontSize||32)+2)}))} style={{ width:28,height:28,border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:'pointer',fontWeight:700,fontSize:15 }}>+</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Metal color — gold/silver only */}
                      {coverState.decoType === 'metal' && (
                  <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Колір металу</div>
                    <div style={{ display:'flex', gap:6 }}>
                      {([['gold','linear-gradient(135deg,#B8860B,#FFD700)','Золотий'],['silver','linear-gradient(135deg,#808080,#E8E8E8)','Срібний']] as [string,string,string][]).map(([v,grad,c]) => (
                        <div key={v} onClick={() => setCoverState(s => ({...s, decoColor: v}))}
                          style={{ width:28, height:28, borderRadius:'50%', background:grad, border: coverState.decoVariant===v ? '3px solid #1e2d7d' : '2px solid #e2e8f0', cursor:'pointer' }}
                          title={c} />
                      ))}
                    </div>
                  </div>
                )}

                {config.selectedCoverColor && (
                  <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:8, fontSize:11, color:'#64748b' }}>
                    Колір: <strong>{config.selectedCoverColor}</strong>
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
              // Find which page has the selected shape
              const allPageIdxs = currentIdx===0 ? [0] : [(currentIdx-1)*2+1, (currentIdx-1)*2+2];
              let spi = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
              let selShape = null;
              for (const pi of allPageIdxs) {
                const found = getCurShapes(pi).find(s=>s.id===selectedShapeId);
                if (found) { selShape = found; spi = pi; break; }
              }
              return (
                <ShapeControls
                  selectedShape={selShape}
                  onChange={patch => {
                    if (!selShape) return;
                    setPageShapes(prev=>({...prev,[spi]:(prev[spi]||[]).map(s=>s.id===selShape!.id?{...s,...patch}:s)}));
                  }}
                  onAdd={type => { const newSpi = currentIdx===0?0:(currentIdx-1)*2+1+activeSide; addShape(type, newSpi); }}
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

            {/* STICKERS PANEL */}
            {leftTab === 'stickers' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input
                  type="text"
                  placeholder="Пошук стікерів..."
                  value={stickerSearch}
                  onChange={e=>setStickerSearch(e.target.value)}
                  style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, outline:'none' }}
                />
                {/* Category filter */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {['Всі',...[...new Set(dbStickers.map(s=>s.category))]].map(cat => (
                    <button key={cat}
                      style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:20, fontSize:11, background:'#fff', cursor:'pointer', fontWeight:600, color:'#374151' }}>
                      {cat}
                    </button>
                  ))}
                </div>
                {/* Stickers grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
                  {dbStickers
                    .filter(s => !stickerSearch || s.name.toLowerCase().includes(stickerSearch.toLowerCase()) || s.tags.some(tag=>tag.includes(stickerSearch.toLowerCase())))
                    .map(sticker => {
                      const spi = currentIdx===0 ? 0 : (currentIdx-1)*2+1+activeSide;
                      return (
                        <button key={sticker.id}
                          onClick={() => {
                            const newS = { id:'stk-'+Date.now(), url:sticker.image_url, x:30, y:30, w:60, h:60 };
                            setPageStickers(prev => ({...prev, [spi]: [...(prev[spi]||[]), newS]}));
                          }}
                          style={{ padding:6, border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}
                          title={sticker.name}>
                          <img src={sticker.image_url} style={{ width:32, height:32, objectFit:'contain' }} alt={sticker.name}/>
                          <span style={{ fontSize:9, color:'#64748b', textAlign:'center' }}>{sticker.name}</span>
                        </button>
                      );
                    })
                  }
                </div>
                {dbStickers.length === 0 && <p style={{ fontSize:11, color:'#94a3b8', textAlign:'center' }}>Стікери завантажуються...</p>}
              </div>
            )}

            {/* OPTIONS PANEL */}
            {leftTab === 'options' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {/* Book size */}
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Розмір книги</div>
                  <div style={{ padding:'10px 12px', border:'2px solid #1e2d7d', borderRadius:8, background:'#f0f3ff', fontSize:13, fontWeight:700, color:'#1e2d7d' }}>
                    {config.selectedSize || '20×20 см'}
                  </div>
                  <p style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>Розмір обрано при замовленні</p>
                </div>

                {/* Cover type */}
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Тип обкладинки</div>
                  <div style={{ padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, background:'#f8fafc', fontSize:13, fontWeight:600, color:'#374151' }}>
                    {config.selectedCoverType || 'Велюр'}
                    {config.selectedCoverColor ? <span style={{ color:'#94a3b8', marginLeft:6, fontWeight:400 }}>· {config.selectedCoverColor}</span> : null}
                  </div>
                </div>

                {/* Pages count */}
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Кількість сторінок</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, background:'#f8fafc', fontSize:14, fontWeight:700, color:'#1e2d7d', textAlign:'center' }}>
                      {pages.length - 1}
                    </div>
                    <button onClick={addSpread}
                      style={{ padding:'9px 12px', border:'1px solid #d1fae5', borderRadius:8, background:'#f0fdf4', cursor:'pointer', fontWeight:700, fontSize:12, color:'#059669' }}>
                      + 2
                    </button>
                    <button onClick={removeLastSpread}
                      style={{ padding:'9px 12px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff7f7', cursor:'pointer', fontWeight:700, fontSize:12, color:'#ef4444' }}>
                      − 2
                    </button>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>Ціна:</span>
                    <span style={{ fontSize:13, fontWeight:800, color:'#1e2d7d' }}>{dynamicPrice} ₴</span>
                  </div>
                </div>

                {/* Lamination / paper type */}
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Тип ламінації</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {['Глянцева', 'Матова'].map(lam => (
                      <button key={lam}
                        onClick={() => {/* lamination stored in config — read only for now */}}
                        style={{ flex:1, padding:'8px', border: (config.selectedLamination||'Глянцева')===lam ? '2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:(config.selectedLamination||'Глянцева')===lam?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:600, fontSize:12, color:(config.selectedLamination||'Глянцева')===lam?'#1e2d7d':'#374151' }}>
                        {lam}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cover templates */}
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Дизайн обкладинки</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[
                      { id:'blank', label:'Чистий аркуш', bg:'#f1f5f9', isBlank:true },
                      { id:'minimal', label:'Мінімалістичний', bg:'linear-gradient(135deg,#f8f9fa,#e9ecef)', isBlank:false },
                      { id:'full-photo', label:'Велике фото', bg:'linear-gradient(135deg,#1e2d7d,#3b5bdb)', isBlank:false },
                      { id:'elegant', label:'Елегантний', bg:'linear-gradient(135deg,#2d3748,#4a5568)', isBlank:false },
                    ].map(tpl => (
                      <button key={tpl.id}
                        onClick={() => {/* apply cover template */}}
                        style={{ padding:'0', border:'2px solid #e2e8f0', borderRadius:8, overflow:'hidden', cursor:'pointer', background:'none', textAlign:'center' }}>
                        <div style={{ height:60, background:tpl.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {tpl.isBlank && <span style={{ fontSize:10, color:'#94a3b8' }}>порожня</span>}
                        </div>
                        <div style={{ padding:'5px 4px', fontSize:10, fontWeight:600, color:'#374151', background:'#fff' }}>{tpl.label}</div>
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize:10, color:'#94a3b8', marginTop:6 }}>Більше шаблонів обкладинок — незабаром</p>
                </div>

                {/* Kalka option */}
                {(config.selectedCoverType?.toLowerCase().includes('велюр') || config.selectedCoverType?.toLowerCase().includes('шкір') || config.selectedCoverType?.toLowerCase().includes('тканин')) && (
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>Калька перед 1-ю стор.</div>
                    <div style={{ display:'flex', gap:6 }}>
                      {['Без кальки', 'З калькою +280₴'].map(k => (
                        <button key={k}
                          style={{ flex:1, padding:'8px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:11, color:'#374151' }}>
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TEXT */}
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
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Розмір: {tFontSize}px</div>
                  <input type="range" min={8} max={120} value={tFontSize} onChange={e => { const v = +e.target.value; setTFontSize(v); if (selectedTextId) updateTxt(selectedTextId, { fontSize: v }); }} style={{ width: '100%' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Колір</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {COLORS.map(c => <button key={c} onClick={() => { setTColor(c); if (selectedTextId) updateTxtForPage(selectedTextId, { color: c }, selectedTextPageIdx); }} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: tColor === c ? '3px solid #1e2d7d' : '2px solid #e2e8f0', cursor: 'pointer' }} />)}
                    <input type="color" value={tColor} onChange={e => { setTColor(e.target.value); if (selectedTextId) updateTxtForPage(selectedTextId, { color: e.target.value }, selectedTextPageIdx); }} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { const v = !tBold; setTBold(v); if (selectedTextId) updateTxt(selectedTextId, { bold: v }); }} style={{ flex: 1, padding: '6px', border: tBold ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: tBold ? '#f0f3ff' : '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 14, color: tBold ? '#1e2d7d' : '#374151' }}>B</button>
                    <button onClick={() => { const v = !tItalic; setTItalic(v); if (selectedTextId) updateTxt(selectedTextId, { italic: v }); }} style={{ flex: 1, padding: '6px', border: tItalic ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: tItalic ? '#f0f3ff' : '#fff', cursor: 'pointer', fontStyle: 'italic', fontSize: 14, color: tItalic ? '#1e2d7d' : '#374151' }}>I</button>
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
        </div>

        {/* CANVAS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 32, background: '#f4f6fb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} style={{ background: 'none', border: 'none', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer', opacity: currentIdx === 0 ? 0.3 : 1, color: '#1e2d7d' }}><ChevronLeft size={20} /></button>
            <span style={{ minWidth: 60, textAlign: 'center' }}>{cur?.label || 'Обкладинка'}</span>
            <button onClick={() => setCurrentIdx(i => Math.min(pages.length - 1, i + 1))} disabled={currentIdx === pages.length - 1} style={{ background: 'none', border: 'none', cursor: currentIdx === pages.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIdx === pages.length - 1 ? 0.3 : 1, color: '#1e2d7d' }}><ChevronRight size={20} /></button>
            {/* Shuffle layout button */}
            {currentIdx !== 0 && (
              <button
                onClick={shuffleLayout}
                title="Змінити розкладку сторінки (зберігає фото)"
                style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8, padding: '5px 12px', border: '1px solid #c7d2fe', borderRadius: 8, background: '#f0f3ff', cursor: 'pointer', color: '#1e2d7d', fontWeight: 700, fontSize: 12, transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e0e7ff')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f0f3ff')}
              >
                <Shuffle size={13} />
                Інший шаблон
              </button>
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
                {/* Back cover */}
                <div style={{ width: pageW, height: cH, flexShrink: 0, position: 'relative', background: (() => {
                  const mat = (config.selectedCoverType||'').toLowerCase();
                  const name = config.selectedCoverColor||'';
                  if (mat.includes('велюр')||mat.includes('velour')) return '#C4AA88';
                  if (mat.includes('тканин')||mat.includes('fabric')) return '#C4AA88';
                  if (mat.includes('шкір')||mat.includes('leather')) return '#D9C8B0';
                  return '#e8ecf4';
                })(), borderRight: '2px solid rgba(0,0,0,0.12)' }}>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'rgba(255,255,255,0.2)', fontSize:9, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', writingMode:'vertical-rl' }}>ЗАДНЯ</span>
                  </div>
                </div>
                {/* Front cover with decoration */}
                <CoverEditor
                  canvasW={pageW}
                  canvasH={cH}
                  sizeValue={(config.selectedSize || '20x20').replace(/[×х]/g,'x').replace(/\s*см/,'')}
                  config={{
                    coverMaterial: (config.selectedCoverType?.toLowerCase().includes('велюр') ? 'velour' : config.selectedCoverType?.toLowerCase().includes('шкір') ? 'leatherette' : config.selectedCoverType?.toLowerCase().includes('тканин') ? 'fabric' : 'printed') as any,
                    coverColorName: config.selectedCoverColor || '',
                    decoType: coverState.decoType as any,
                    decoVariant: coverState.decoVariant,
                    decoColor: coverState.decoColor,
                    photoId: coverState.photoId,
                    decoText: coverState.decoText,
                    textX: coverState.textX,
                    textY: coverState.textY,
                    textFontFamily: coverState.textFontFamily,
                    textFontSize: coverState.textFontSize,
                  }}
                  photos={photos}
                  onChange={(cfg) => setCoverState(prev => ({ ...prev,
                    ...(cfg.photoId !== undefined && { photoId: cfg.photoId ?? null }),
                    ...(cfg.decoText !== undefined && { decoText: cfg.decoText }),
                    ...(cfg.textX !== undefined && { textX: cfg.textX }),
                    ...(cfg.textY !== undefined && { textY: cfg.textY }),
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
                <div style={{ width: pageW, height: cH, background: (() => { const n=config.selectedCoverColor||''; const mat=config.selectedCoverType?.toLowerCase()||''; if(mat.includes('шкір')) return ({...{'Білий':'#F5F5F0','Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Рудий':'#C8844E','Бордо темний':'#7A2838','Чорний':'#1A1A1A'}})[n]||'#D9C8B0'; if(mat.includes('тканин')) return '#C4AA88'; return '#e8ecf4'; })(), borderRight: '2px solid rgba(0,0,0,0.12)', position:'relative' }}>
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
                    coverMaterial: (config.selectedCoverType?.toLowerCase().includes('шкір') ? 'leatherette' : config.selectedCoverType?.toLowerCase().includes('тканин') ? 'fabric' : 'printed') as any,
                    coverColorName: config.selectedCoverColor || '',
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
                  if (!page) return (
                    <div key={side} style={{ width: pageW, height: cH, background: '#f8fafc', borderRadius: side === 0 ? '4px 0 0 4px' : '0 4px 4px 0', boxShadow: side === 0 ? '-4px 0 16px rgba(0,0,0,0.1)' : '4px 0 16px rgba(0,0,0,0.1)' }} />
                  );
                  const pageDefs = getSlotDefs(page.layout, pageW, cH);
                  const pageKey = (si: number) => `${pageIdx}-${si}`;
                  return (
                    <div key={side}
                      onMouseDown={() => setActiveSide(side as 0|1)}
                      style={{ width: pageW, height: cH, position: 'relative', background: '#fff', overflow: 'hidden', borderRadius: side === 0 ? '4px 0 0 4px' : '0 4px 4px 0', boxShadow: side === 0 ? 'inset -1px 0 3px rgba(0,0,0,0.08)' : 'inset 1px 0 3px rgba(0,0,0,0.08)', cursor: textTool ? 'crosshair' : 'default', outline: activeSide === side && currentIdx !== 0 ? '2px solid rgba(30,45,125,0.3)' : 'none' }}
                      onClick={(e) => { setActiveSide(side as 0|1); if (textTool && page) onCanvasClickForPage(e, pageIdx); }}
                    >
                      {pageDefs.map(({ i, s }) => {
                        const slot = page?.slots[i];
                        const photo = slot ? getPhoto(slot.photoId) : null;
                        const key = pageKey(i);
                        const isOver = dropTarget === key;
                        return (
                          <div key={i}
                            onDragOver={e => { e.preventDefault(); setDropTarget(key); }}
                            onDragLeave={() => setDropTarget(null)}
                            onDrop={e => onDrop(e, pageIdx, i)} onDragOver={e => e.preventDefault()}
                            style={{ ...s, background: photo ? 'transparent' : (isOver ? '#dbeafe' : '#f1f5f9'), border: isOver ? '2px dashed #1e2d7d' : (photo ? 'none' : '1px dashed #cbd5e1'), transition: 'border-color 0.15s', cursor: dragPhotoId ? 'copy' : 'default' }}
                          >
                            {photo ? (
                              <>
                                <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: photoEditSlot === key ? 'crosshair' : 'default' }}
                                  onWheel={e => { if (photoEditSlot !== key) return; e.preventDefault(); const delta = e.deltaY > 0 ? -0.05 : 0.05; const nz = Math.max(0.5, Math.min(4, (slot!.zoom||1)+delta)); setPages(prev => prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:nz})})); }}
                                  onClick={() => setPhotoEditSlot(photoEditSlot === key ? null : key)}>
                                  <img src={photo.preview} draggable={true} onDragStart={e=>{e.dataTransfer.setData('photoId',photo.id);e.dataTransfer.setData('text/plain',photo.id);}} alt=""
                                    onMouseDown={e => { if (photoEditSlot===key) startCrop(e, key, slot!.cropX, slot!.cropY); }}
                                    style={{ width:`${(slot!.zoom||1)*100}%`, height:`${(slot!.zoom||1)*100}%`, objectFit:'cover', objectPosition:`${slot!.cropX}% ${slot!.cropY}%`, userSelect:'none', cursor:photoEditSlot===key?'grab':'default', display:'block', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }}
                                    draggable={false}/>
                                  {photoEditSlot===key && (
                                    <div onMouseDown={e=>e.stopPropagation()} style={{position:'absolute',bottom:4,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:4,background:'rgba(0,0,0,0.7)',borderRadius:20,padding:'3px 8px',zIndex:40}}>
                                      <button onClick={e=>{e.stopPropagation();setPages(prev=>prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:Math.max(0.5,(sl.zoom||1)-0.1)})}));}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:14,padding:'0 2px'}}>−</button>
                                      <span style={{color:'#fff',fontSize:9,fontWeight:700,minWidth:28,textAlign:'center'}}>{Math.round((slot!.zoom||1)*100)}%</span>
                                      <button onClick={e=>{e.stopPropagation();setPages(prev=>prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:Math.min(4,(sl.zoom||1)+0.1)})}));}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:14,padding:'0 2px'}}>+</button>
                                      <div style={{width:1,height:12,background:'rgba(255,255,255,0.3)',margin:'0 2px'}}/>
                                      <button onClick={e=>{e.stopPropagation();setPages(prev=>prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:1,cropX:50,cropY:50})}));}} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:9,fontWeight:700,padding:'0 2px'}}>↺</button>
                                    </div>
                                  )}
                                </div>
                                <button onClick={()=>clearSlot(pageIdx,i)} style={{position:'absolute',top:4,right:4,width:20,height:20,borderRadius:'50%',background:'rgba(0,0,0,0.55)',color:'#fff',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.15s'}} className="del-btn"><Trash2 size={10}/></button>
                                <style>{`.del-btn{opacity:0!important}div:hover>.del-btn{opacity:1!important}`}</style>
                              </>
                            ) : (
                              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#94a3b8',gap:4}}>
                                <ImageIcon size={16}/><span style={{fontSize:9,fontWeight:600}}>Фото</span>
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
                            onMouseDown={e=>{e.stopPropagation();setSelectedTextId(tb.id);setSelectedTextPageIdx(pageIdx);if(!isEd)startTxtDragForPage(e,tb.id,tb.x,tb.y,pageIdx);}}
                            onDoubleClick={e=>{e.stopPropagation();setEditingTextId(tb.id);setSelectedTextId(tb.id);setSelectedTextPageIdx(pageIdx);}}
                            style={{position:'absolute',left:tb.x+'%',top:tb.y+'%',transform:'translate(-50%,-50%)',zIndex:20,cursor:isEd?'text':'move',outline:isSel?'2px solid #3b82f6':'none',borderRadius:3,padding:'2px 4px',background:isSel?'rgba(255,255,255,0.1)':'transparent',minWidth:30}}>
                            {isEd?(
                              <textarea
                autoFocus
                defaultValue={tb.text}
                onBlur={e=>{updateTxtForPage(tb.id,{text:e.target.value},pageIdx);setEditingTextId(null);}}
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
                        onChange={(newSlots) => setFreeSlots(prev=>({...prev,[pageIdx]:newSlots}))}
                      />
                      {/* Background layer */}
                      <BackgroundLayer bg={getCurBg(pageIdx)} canvasW={pageW} canvasH={cH}/>
                      {/* Shapes layer */}
                      <ShapesLayer
                        shapes={getCurShapes(pageIdx)}
                        canvasW={pageW} canvasH={cH}
                        onChange={newShapes => setPageShapes(prev=>({...prev,[pageIdx]:newShapes}))}
                        selectedId={selectedShapeId}
                        onSelectId={id => { setSelectedShapeId(id); setActiveSide(side as 0|1); }}
                      />
                      {/* Frame layer */}
                      <FrameLayer frame={getCurFrame(pageIdx)} canvasW={pageW} canvasH={cH}/>
                      {/* Stickers layer */}
                      {(pageStickers[pageIdx]||[]).map(stk => (
                        <div key={stk.id} style={{ position:'absolute', left:stk.x+'%', top:stk.y+'%', width:stk.w, height:stk.h, cursor:'move', userSelect:'none', zIndex:40 }}
                          onMouseDown={e => {
                            e.stopPropagation();
                            const startX=e.clientX, startY=e.clientY, origX=stk.x, origY=stk.y;
                            const onMove=(me:MouseEvent)=>{
                              const dx=(me.clientX-startX)/pageW*100;
                              const dy=(me.clientY-startY)/cH*100;
                              setPageStickers(prev=>({...prev,[pageIdx]:(prev[pageIdx]||[]).map(s=>s.id===stk.id?{...s,x:Math.max(0,Math.min(90,origX+dx)),y:Math.max(0,Math.min(90,origY+dy))}:s)}));
                            };
                            const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};
                            window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
                          }}>
                          <img src={stk.url} style={{ width:'100%', height:'100%', objectFit:'contain', pointerEvents:'none' }} draggable={false}/>
                          <button onClick={e=>{e.stopPropagation();setPageStickers(prev=>({...prev,[pageIdx]:(prev[pageIdx]||[]).filter(s=>s.id!==stk.id)}));}}
                            style={{ position:'absolute',top:-6,right:-6,width:16,height:16,borderRadius:'50%',background:'#ef4444',color:'#fff',border:'none',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
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

        {/* RIGHT PANEL — Spread Navigator */}
        <div style={{ width: 180, borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e2d7d' }}>Розвороти</span>
            <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>{pages.length}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pages.map((pg, idx) => {
              const active = idx === currentIdx;
              const ph = getPhoto(pg.slots[0]?.photoId ?? null);
              return (
                <button key={pg.id} onClick={() => setCurrentIdx(idx)}
                  style={{ width: '100%', padding: '4px', border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: active ? '#f0f3ff' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ width: '100%', aspectRatio: `${prop.w}/${prop.h}`, background: ph ? `url(${ph.preview}) center/cover` : '#e8ecf4', borderRadius: 3, marginBottom: 3 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#1e2d7d' : '#64748b' }}>{pg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

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
                  Тут ви можете створити свою унікальну фотокнигу. Давайте розберемось як це працює.
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
                <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:8 }}>Превью та замовлення</h3>
                <p style={{ color:'#64748b', fontSize:14, lineHeight:1.6, marginBottom:8 }}>
                  Натисніть <b>Превью</b> щоб переглянути фотокнигу з перегортанням сторінок.
                </p>
                <p style={{ color:'#64748b', fontSize:13, lineHeight:1.6, marginBottom:20 }}>
                  Хочете більше сторінок? Натисніть <b>+ Розворот</b> в правій панелі. Ціна оновлюється автоматично.
                </p>
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

      {/* Preview Modal */}
      {showPreview && (
        <BookPreviewModal
          pages={pages}
          photos={photos}
          propW={prop.w}
          propH={prop.h}
          onClose={() => setShowPreview(false)}
        />
      )}

    </div>
  );
}
