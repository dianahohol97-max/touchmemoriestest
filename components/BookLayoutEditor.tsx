'use client';

import { useState, useEffect, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ShoppingCart, Image as ImageIcon, Type, Trash2, LayoutGrid, Wand2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';
import { CoverEditor } from './CoverEditor';

interface PhotoData { id: string; preview: string; width: number; height: number; name: string; }
interface BookConfig { productSlug: string; productName: string; selectedSize?: string; selectedCoverType?: string; selectedCoverColor?: string; selectedDecoration?: string; selectedDecorationSize?: string; selectedDecorationColor?: string; selectedPageCount: string; totalPrice: number; }

type CoverDecoType = 'none'|'acrylic'|'photo_insert'|'flex'|'metal'|'engraving';
interface CoverState {
  decoType: CoverDecoType;
  decoVariant: string;
  photoId: string | null;
  decoText: string;
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

const FONTS = ['Montserrat', 'Georgia', 'Playfair Display', 'Dancing Script', 'Arial', 'Times New Roman'];
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
  const [leftTab, setLeftTab] = useState<'photos'|'layouts'|'text'|'cover'>('photos');
  const [coverState, setCoverState] = useState<CoverState>({ decoType: 'none', decoVariant: '', photoId: null, decoText: '' });
  const [freeSlots, setFreeSlots] = useState<Record<number, FreeSlot[]>>({});
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [textTool, setTextTool] = useState(false);
  const [photoEditSlot, setPhotoEditSlot] = useState<string | null>(null); // "pageIdx-slotIdx"
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
    if (deco.includes('акрил')) decoType = 'acrylic';
    else if (deco.includes('фотовставка') || deco.includes('photo')) decoType = 'photo_insert';
    else if (deco.includes('флекс') || deco.includes('flex')) decoType = 'flex';
    else if (deco.includes('метал')) decoType = 'metal';
    else if (deco.includes('гравір')) decoType = 'engraving';
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
    const def = LAYOUTS.find(l => l.id === layout)!;
    const targetIdx = getActivePageIdx();
    setPages(prev => prev.map((p, i) => {
      if (i !== targetIdx) return p;
      const ns = makeSlots(def.slots);
      p.slots.forEach((sl, si) => { if (si < ns.length) ns[si].photoId = sl.photoId; });
      return { ...p, layout, slots: ns };
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

  const onDrop = (e: DragEvent, pi: number, si: number) => {
    e.preventDefault(); setDropTarget(null);
    if (!dragPhotoId) return;
    setPages(prev => prev.map((p, i) => i !== pi ? p : { ...p, slots: p.slots.map((sl, j) => j !== si ? sl : { ...sl, photoId: dragPhotoId }) }));
    setDragPhotoId(null);
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
    addItem({ id: `pb-${Date.now()}`, name: config.productName || 'Фотокнига', price: config.totalPrice, qty: 1, image: getPhoto(pages[0]?.slots[0]?.photoId ?? null)?.preview || '', options: { 'Розмір': config.selectedSize || '', 'Сторінок': config.selectedPageCount }, personalization_note: `${pages.length} сторінок` });
    toast.success('Додано до кошика!');
    router.push('/cart');
  };

  if (!config || pages.length === 0) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;

  const slotDefs = cur ? getSlotDefs(cur.layout, cW, cH) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6fb' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, gap: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1e2d7d' }}>{config.productName || 'Фотокнига'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Редактор • {photos.length} фото • {pages.length} сторінок</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={autoFill} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e2d7d' }}><Wand2 size={14} /> Авто</button>
          <button onClick={() => setZoom(z => Math.max(30, z - 10))} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomOut size={14} /></button>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(130, z + 10))} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomIn size={14} /></button>
        </div>
        <button onClick={addToCart} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(38,58,153,0.3)' }}>
          <ShoppingCart size={15} /> Додати до кошика • {config.totalPrice} ₴
        </button>
      </div>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ICON SIDEBAR */}
        <div style={{ width: 72, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, borderRight: '1px solid #f1f5f9', flexShrink: 0 }}>
          {([['photos', <ImageIcon key="p" size={22} />, 'Зображення'], ['layouts', <LayoutGrid key="l" size={22} />, 'Шаблон'], ['text', <Type key="t" size={22} />, 'Текст'], ...(currentIdx===0?[['cover', <span key="c" style={{fontSize:20}}>🎨</span>, 'Обкладинка']]:[])] as [string, React.ReactNode, string][]).map(([id, icon, label]) => (
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
                {(config.selectedCoverType?.toLowerCase().includes('шкір') ? [
                  { id:'none', label:'Без оздоблення' },
                  { id:'acryl', label:'Акрил' },
                  { id:'photovstavka', label:'Фотовставка' },
                  { id:'metal', label:'Металева вставка' },
                  { id:'flex', label:'Флекс' },
                ] : [
                  { id:'none', label:'Без оздоблення' },
                  { id:'acryl', label:'Акрил' },
                  { id:'photovstavka', label:'Фотовставка' },
                  { id:'metal', label:'Металева вставка' },
                  { id:'flex', label:'Флекс' },
                  { id:'graviruvannya', label:'Гравірування' },
                ]).map(opt => (
                  <button key={opt.id}
                    onClick={() => setCoverState(prev => ({ ...prev, decoType: opt.id as CoverDecoType, decoVariant: '' }))}
                    style={{ padding:'8px 12px', border: coverState.decoType===opt.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius:8, background: coverState.decoType===opt.id ? '#f0f3ff' : '#fff', cursor:'pointer', fontWeight:600, fontSize:12, color: coverState.decoType===opt.id ? '#1e2d7d' : '#374151', textAlign:'left' }}>
                    {opt.label}
                  </button>
                ))}

                {coverState.decoType === 'flex' && (
                  <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Колір флексу</div>
                    <div style={{ display:'flex', gap:6 }}>
                      {([['gold','#D4AF37','Gold'],['silver','#C0C0C0','Silver'],['white','#F0F0F0','White'],['black','#1A1A1A','Black']] as [string,string,string][]).map(([v,hex,c]) => (
                        <div key={v} onClick={() => setCoverState(s => ({...s, decoVariant: v}))}
                          style={{ width:28, height:28, borderRadius:'50%', background:hex, border: coverState.decoVariant===v ? '3px solid #1e2d7d' : '2px solid #e2e8f0', cursor:'pointer' }}
                          title={c} />
                      ))}
                    </div>
                  </div>
                )}

                {coverState.decoType === 'metal' && (
                  <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Колір металу</div>
                    <div style={{ display:'flex', gap:6 }}>
                      {([['gold','linear-gradient(135deg,#B8860B,#FFD700)','Gold'],['silver','linear-gradient(135deg,#808080,#E8E8E8)','Silver'],['black','linear-gradient(135deg,#1A1A1A,#444)','Black']] as [string,string,string][]).map(([v,grad,c]) => (
                        <div key={v} onClick={() => setCoverState(s => ({...s, decoVariant: v}))}
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

            {/* TEXT */}
            {leftTab === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setTextTool(t => !t)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: textTool ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: textTool ? '#f0f3ff' : '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: textTool ? '#1e2d7d' : '#374151' }}>
                  <Type size={15} /> {textTool ? '↖ Клікніть на сторінку' : 'Додати текст'}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Шрифт</div>
                  <select value={tFontFamily} onChange={e => { setTFontFamily(e.target.value); if (selectedTextId) updateTxt(selectedTextId, { fontFamily: e.target.value }); }}
                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, width: '100%' }}>
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Розмір: {tFontSize}px</div>
                  <input type="range" min={8} max={120} value={tFontSize} onChange={e => { const v = +e.target.value; setTFontSize(v); if (selectedTextId) updateTxt(selectedTextId, { fontSize: v }); }} style={{ width: '100%' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Колір</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {COLORS.map(c => <button key={c} onClick={() => { setTColor(c); if (selectedTextId) updateTxt(selectedTextId, { color: c }); }} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: tColor === c ? '3px solid #1e2d7d' : '2px solid #e2e8f0', cursor: 'pointer' }} />)}
                    <input type="color" value={tColor} onChange={e => { setTColor(e.target.value); if (selectedTextId) updateTxt(selectedTextId, { color: e.target.value }); }} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { const v = !tBold; setTBold(v); if (selectedTextId) updateTxt(selectedTextId, { bold: v }); }} style={{ flex: 1, padding: '6px', border: tBold ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: tBold ? '#f0f3ff' : '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 14, color: tBold ? '#1e2d7d' : '#374151' }}>B</button>
                    <button onClick={() => { const v = !tItalic; setTItalic(v); if (selectedTextId) updateTxt(selectedTextId, { italic: v }); }} style={{ flex: 1, padding: '6px', border: tItalic ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: tItalic ? '#f0f3ff' : '#fff', cursor: 'pointer', fontStyle: 'italic', fontSize: 14, color: tItalic ? '#1e2d7d' : '#374151' }}>I</button>
                  </div>
                </div>
                {selectedTextId && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>Двічі клікніть для редагування</p>
                    <button onClick={() => deleteTxt(selectedTextId!)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff7f7', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#ef4444', width: '100%' }}>
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
            <span>{cur?.label || 'Обкладинка'}</span>
            <button onClick={() => setCurrentIdx(i => Math.min(pages.length - 1, i + 1))} disabled={currentIdx === pages.length - 1} style={{ background: 'none', border: 'none', cursor: currentIdx === pages.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIdx === pages.length - 1 ? 0.3 : 1, color: '#1e2d7d' }}><ChevronRight size={20} /></button>
          </div>

          {currentIdx === 0 ? (
            <CoverEditor
              canvasW={cW}
              canvasH={cH}
              sizeValue={(config.selectedSize || '20x20').replace(/[×х]/g,'x').replace(/\s*см/,'')}
              config={{
                coverMaterial: (config.selectedCoverType?.toLowerCase().includes('велюр') ? 'velour' : config.selectedCoverType?.toLowerCase().includes('шкір') ? 'leatherette' : config.selectedCoverType?.toLowerCase().includes('тканин') ? 'fabric' : 'printed') as any,
                coverColorName: config.selectedCoverColor || '',
                decoType: coverState.decoType as any,
                decoVariant: coverState.decoVariant,
                photoId: coverState.photoId,
                decoText: coverState.decoText,
              }}
              photos={photos}
              onChange={(cfg: any) => setCoverState(prev => ({ ...prev, ...(cfg.photoId !== undefined && { photoId: cfg.photoId ?? null }), ...(cfg.decoText !== undefined && { decoText: cfg.decoText }) }))}
            />
          ) : (
          <div
            style={{ position: 'relative', width: cW, height: cH, display: 'flex', flexShrink: 0 }}
            onClick={currentIdx === 0 ? undefined : onCanvasClick}
          >
            {currentIdx === 0 ? (
              /* Cover page — full width */
              <div style={{ width: cW, height: cH, position: 'relative', borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', cursor: textTool ? 'crosshair' : 'default' }}>
                <CoverEditor
                  canvasW={cW}
                  canvasH={cH}
                  sizeValue={(config.selectedSize || '20x20').replace(/[×х]/g,'x').replace(/\s*см/,'')}
                  config={{
                    coverMaterial: (config.selectedCoverType?.toLowerCase().includes('шкір') ? 'leatherette' : config.selectedCoverType?.toLowerCase().includes('тканин') ? 'fabric' : 'printed') as any,
                    coverColorName: config.selectedCoverColor || '',
                    decoType: coverState.decoType as any,
                    decoVariant: coverState.decoVariant,
                    photoId: coverState.photoId,
                    decoText: coverState.decoText,
                  }}
                  photos={photos}
                  onChange={(cfg) => setCoverState(prev => ({ ...prev, ...(cfg.photoId !== undefined && { photoId: cfg.photoId ?? null }), ...(cfg.decoText !== undefined && { decoText: cfg.decoText }) }))}
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
                      style={{ width: pageW, height: cH, position: 'relative', background: '#fff', overflow: 'hidden', borderRadius: side === 0 ? '4px 0 0 4px' : '0 4px 4px 0', boxShadow: side === 0 ? 'inset -1px 0 3px rgba(0,0,0,0.08)' : 'inset 1px 0 3px rgba(0,0,0,0.08)', cursor: textTool ? 'crosshair' : 'default' }}
                      onClick={(e) => { if (textTool && page) onCanvasClickForPage(e, pageIdx); }}
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
                            onDrop={e => onDrop(e, pageIdx, i)}
                            style={{ ...s, background: photo ? 'transparent' : (isOver ? '#dbeafe' : '#f1f5f9'), border: isOver ? '2px dashed #1e2d7d' : (photo ? 'none' : '1px dashed #cbd5e1'), transition: 'border-color 0.15s', cursor: dragPhotoId ? 'copy' : 'default' }}
                          >
                            {photo ? (
                              <>
                                <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: photoEditSlot === key ? 'crosshair' : 'default' }}
                                  onWheel={e => { if (photoEditSlot !== key) return; e.preventDefault(); const delta = e.deltaY > 0 ? -0.05 : 0.05; const nz = Math.max(0.5, Math.min(4, (slot!.zoom||1)+delta)); setPages(prev => prev.map((p,pi)=>pi!==pageIdx?p:{...p,slots:p.slots.map((sl,si)=>si!==i?sl:{...sl,zoom:nz})})); }}
                                  onClick={() => setPhotoEditSlot(photoEditSlot === key ? null : key)}>
                                  <img src={photo.preview} alt=""
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
                            onMouseDown={e=>{e.stopPropagation();setSelectedTextId(tb.id);if(!isEd)startTxtDragForPage(e,tb.id,tb.x,tb.y,pageIdx);}}
                            onDoubleClick={e=>{e.stopPropagation();setEditingTextId(tb.id);setSelectedTextId(tb.id);}}
                            style={{position:'absolute',left:tb.x+'%',top:tb.y+'%',transform:'translate(-50%,-50%)',zIndex:20,cursor:isEd?'text':'move',outline:isSel?'2px solid #3b82f6':'none',borderRadius:3,padding:'2px 4px',background:isSel?'rgba(255,255,255,0.1)':'transparent',minWidth:30}}>
                            {isEd?(
                              <textarea autoFocus defaultValue={tb.text} onBlur={e=>{updateTxtForPage(tb.id,{text:e.target.value},pageIdx);setEditingTextId(null);}} onClick={e=>e.stopPropagation()} style={{background:'transparent',border:'none',outline:'none',fontSize:(tb.fontSize*(zoom/100))+'px',fontFamily:tb.fontFamily,color:tb.color,fontWeight:tb.bold?700:400,fontStyle:tb.italic?'italic':'normal',resize:'none',overflow:'hidden',minWidth:60,display:'block'}} rows={2}/>
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
