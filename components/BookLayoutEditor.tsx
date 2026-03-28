'use client';

import { useState, useEffect, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ShoppingCart, Image as ImageIcon, Type, Trash2, LayoutGrid, Wand2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PhotoData { id: string; preview: string; width: number; height: number; name: string; }
interface BookConfig { productSlug: string; productName: string; selectedSize?: string; selectedCoverType?: string; selectedPageCount: string; totalPrice: number; }

type LayoutType = 'full'|'single-left'|'single-right'|'single-center'|'half-half'|'top-bottom'|'big-small-r'|'big-small-l'|'panorama'|'left-3'|'right-3'|'top-2-bot-1'|'top-1-bot-2'|'triple-row'|'grid4'|'grid4-wide'|'l-shape-4'|'grid5-hero'|'grid5-cross'|'grid6-2x3'|'grid6-3x2'|'text-right'|'text-left'|'text-only';

interface SlotData { photoId: string | null; cropX: number; cropY: number; }
interface TextBlock { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold: boolean; italic: boolean; }
interface Spread { id: number; type: 'cover'|'content'; label: string; layout: LayoutType; slots: SlotData[]; textBlocks: TextBlock[]; }

// ─── Layouts ─────────────────────────────────────────────────────────────────

const LAYOUTS: { id: LayoutType; label: string; slots: number; group: string }[] = [
  { id: 'full',          label: 'На весь розворот',  slots: 1, group: '1 фото' },
  { id: 'single-left',   label: 'Одне ліворуч',      slots: 1, group: '1 фото' },
  { id: 'single-right',  label: 'Одне праворуч',     slots: 1, group: '1 фото' },
  { id: 'single-center', label: 'Одне по центру',    slots: 1, group: '1 фото' },
  { id: 'half-half',     label: '2 поруч рівно',     slots: 2, group: '2 фото' },
  { id: 'top-bottom',    label: '2 зверху/знизу',    slots: 2, group: '2 фото' },
  { id: 'big-small-r',   label: 'Велике + мале',     slots: 2, group: '2 фото' },
  { id: 'big-small-l',   label: 'Мале + велике',     slots: 2, group: '2 фото' },
  { id: 'panorama',      label: 'Панорама',           slots: 2, group: '2 фото' },
  { id: 'left-3',        label: '1 великий + 2',     slots: 3, group: '3 фото' },
  { id: 'right-3',       label: '2 + 1 великий',     slots: 3, group: '3 фото' },
  { id: 'top-2-bot-1',   label: '2 зверху + 1',      slots: 3, group: '3 фото' },
  { id: 'top-1-bot-2',   label: '1 зверху + 2',      slots: 3, group: '3 фото' },
  { id: 'triple-row',    label: '3 в ряд',            slots: 3, group: '3 фото' },
  { id: 'grid4',         label: '4 рівно',            slots: 4, group: '4 фото' },
  { id: 'grid4-wide',    label: '1 широке + 3',       slots: 4, group: '4 фото' },
  { id: 'l-shape-4',     label: 'Г-подібний',         slots: 4, group: '4 фото' },
  { id: 'grid5-hero',    label: '1 велике + 4',       slots: 5, group: '5 фото' },
  { id: 'grid5-cross',   label: '5 у хрест',          slots: 5, group: '5 фото' },
  { id: 'grid6-2x3',     label: '2×3 сітка',          slots: 6, group: '6 фото' },
  { id: 'grid6-3x2',     label: '3×2 сітка',          slots: 6, group: '6 фото' },
  { id: 'text-right',    label: 'Фото + текст',       slots: 2, group: 'Текст' },
  { id: 'text-left',     label: 'Текст + фото',       slots: 2, group: 'Текст' },
  { id: 'text-only',     label: 'Тільки текст',       slots: 1, group: 'Текст' },
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
  return Array.from({ length: n }, () => ({ photoId: null, cropX: 50, cropY: 50 }));
}

const FONTS = ['Montserrat', 'Georgia', 'Playfair Display', 'Dancing Script', 'Arial', 'Times New Roman'];
const COLORS = ['#1e2d7d', '#ffffff', '#000000', '#e63946', '#2a9d8f', '#f4a261', '#264653', '#e9c46a'];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BookLayoutEditor() {
  const router = useRouter();
  const { addItem } = useCartStore();

  const [config, setConfig] = useState<BookConfig | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [zoom, setZoom] = useState(60);
  const [leftTab, setLeftTab] = useState<'photos'|'layouts'|'text'>('photos');
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [textTool, setTextTool] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tFontSize, setTFontSize] = useState(28);
  const [tFontFamily, setTFontFamily] = useState('Montserrat');
  const [tColor, setTColor] = useState('#1e2d7d');
  const [tBold, setTBold] = useState(false);
  const [tItalic, setTItalic] = useState(false);
  const cropRef = useRef<{ slotKey: string; sx: number; sy: number; cx: number; cy: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const txtDragRef = useRef<{ id: string; sx: number; sy: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    const cfg = sessionStorage.getItem('bookConstructorConfig');
    if (cfg) setConfig(JSON.parse(cfg));
    else { toast.error('Конфігурація не знайдена'); router.push('/order/book'); }
    const ph = sessionStorage.getItem('bookConstructorPhotos');
    if (ph) setPhotos(JSON.parse(ph));
  }, [router]);

  useEffect(() => {
    if (!config) return;
    const m = config.selectedPageCount.match(/(\d+)/);
    const total = m ? parseInt(m[0]) : 20;
    const s: Spread[] = [{ id: 0, type: 'cover', label: 'Обкладинка', layout: 'half-half', slots: makeSlots(2), textBlocks: [] }];
    for (let i = 0; i < total; i += 2) {
      s.push({ id: s.length, type: 'content', label: `${i+1}–${i+2}`, layout: 'half-half', slots: makeSlots(2), textBlocks: [] });
    }
    setSpreads(s);
  }, [config]);

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) ?? null : null;
  const usedIds = new Set(spreads.flatMap(s => s.slots.map(sl => sl.photoId).filter(Boolean)));
  const cur = spreads[currentIdx];

  const sizeKey = config?.selectedSize ?? 'A4';
  const prop = PAGE_PROPORTIONS[sizeKey] ?? PAGE_PROPORTIONS['A4'];
  const aspect = (2 * prop.w) / prop.h;
  const baseW = Math.min(700, 480 * aspect);
  const baseH = baseW / aspect;
  const cW = baseW * zoom / 100;
  const cH = baseH * zoom / 100;

  // Layout
  const changeLayout = (layout: LayoutType) => {
    const def = LAYOUTS.find(l => l.id === layout)!;
    setSpreads(prev => prev.map((s, i) => {
      if (i !== currentIdx) return s;
      const ns = makeSlots(def.slots);
      s.slots.forEach((sl, si) => { if (si < ns.length) ns[si].photoId = sl.photoId; });
      return { ...s, layout, slots: ns };
    }));
  };

  const autoFill = () => {
    let pi = 0;
    setSpreads(prev => prev.map(s => ({ ...s, slots: s.slots.map(sl => { if (sl.photoId) return sl; const p = photos[pi]; if (!p) return sl; pi++; return { ...sl, photoId: p.id }; }) })));
    toast.success('Фото розставлено');
  };

  const resetSpread = () => setSpreads(prev => prev.map((s, i) => i !== currentIdx ? s : { ...s, slots: makeSlots(s.slots.length) }));

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPhotos: PhotoData[] = [];
    let done = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new window.Image();
        img.onload = () => {
          newPhotos.push({ id: 'up-' + Date.now() + '-' + Math.random(), preview: ev.target!.result as string, width: img.width, height: img.height, name: file.name });
          done++;
          if (done === files.length) {
            setPhotos(prev => [...prev, ...newPhotos]);
            toast.success(`Завантажено ${files.length} фото`);
          }
        };
        img.src = ev.target!.result as string;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Photo drag
  const onDragStart = (id: string) => setDragPhotoId(id);
  const onDragEnd = () => { setDragPhotoId(null); setDropTarget(null); };
  const onDrop = (e: DragEvent, si: number, sli: number) => {
    e.preventDefault(); setDropTarget(null);
    if (!dragPhotoId) return;
    setSpreads(prev => prev.map((s, i) => i !== si ? s : { ...s, slots: s.slots.map((sl, j) => j === sli ? { ...sl, photoId: dragPhotoId } : sl) }));
    setDragPhotoId(null);
  };
  const clearSlot = (si: number, sli: number) => setSpreads(prev => prev.map((s, i) => i !== si ? s : { ...s, slots: s.slots.map((sl, j) => j === sli ? { ...sl, photoId: null } : sl) }));

  // Crop drag
  const startCropDrag = (e: React.MouseEvent, slotKey: string, cx: number, cy: number) => {
    e.preventDefault();
    cropRef.current = { slotKey, sx: e.clientX, sy: e.clientY, cx, cy };
    const onMove = (me: MouseEvent) => {
      if (!cropRef.current) return;
      const dx = (me.clientX - cropRef.current.sx) / 3;
      const dy = (me.clientY - cropRef.current.sy) / 3;
      const [si, sli] = cropRef.current.slotKey.split('-').map(Number);
      const nx = Math.max(0, Math.min(100, cropRef.current.cx - dx));
      const ny = Math.max(0, Math.min(100, cropRef.current.cy - dy));
      setSpreads(prev => prev.map((s, i) => i !== si ? s : { ...s, slots: s.slots.map((sl, j) => j !== sli ? sl : { ...sl, cropX: nx, cropY: ny }) }));
    };
    const onUp = () => { cropRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Text
  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!textTool) { setSelectedTextId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / cW) * 100;
    const y = ((e.clientY - rect.top) / cH) * 100;
    const id = 'txt-' + Date.now();
    setSpreads(prev => prev.map((s, i) => i !== currentIdx ? s : {
      ...s, textBlocks: [...s.textBlocks, { id, text: 'Введіть текст', x, y, fontSize: tFontSize, fontFamily: tFontFamily, color: tColor, bold: tBold, italic: tItalic }]
    }));
    setSelectedTextId(id);
    setEditingTextId(id);
    setTextTool(false);
  };

  const updateTxt = (id: string, changes: Partial<TextBlock>) => setSpreads(prev => prev.map((s, i) => i !== currentIdx ? s : { ...s, textBlocks: s.textBlocks.map(t => t.id === id ? { ...t, ...changes } : t) }));
  const deleteTxt = (id: string) => { setSpreads(prev => prev.map((s, i) => i !== currentIdx ? s : { ...s, textBlocks: s.textBlocks.filter(t => t.id !== id) })); setSelectedTextId(null); setEditingTextId(null); };

  const startTxtDrag = (e: React.MouseEvent, id: string, tx: number, ty: number) => {
    e.stopPropagation(); e.preventDefault();
    txtDragRef.current = { id, sx: e.clientX, sy: e.clientY, tx, ty };
    const onMove = (me: MouseEvent) => {
      if (!txtDragRef.current) return;
      const dx = ((me.clientX - txtDragRef.current.sx) / cW) * 100;
      const dy = ((me.clientY - txtDragRef.current.sy) / cH) * 100;
      updateTxt(txtDragRef.current.id, { x: Math.max(0, Math.min(95, txtDragRef.current.tx + dx)), y: Math.max(0, Math.min(95, txtDragRef.current.ty + dy)) });
    };
    const onUp = () => { txtDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Cart
  const addToCart = () => {
    if (!config) return;
    addItem({ id: `pb-${Date.now()}`, name: config.productName || 'Фотокнига', price: config.totalPrice, qty: 1, image: getPhoto(spreads[0]?.slots[0]?.photoId ?? null)?.preview || '', options: { 'Розмір': config.selectedSize || '', 'Сторінок': config.selectedPageCount }, personalization_note: `${spreads.length} розворотів` });
    toast.success('Додано до кошика!');
    router.push('/cart');
  };

  if (!config || spreads.length === 0) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;

  // ─── Slot positions ───────────────────────────────────────────────────────
  function getSlotDefs(layout: LayoutType, W: number, H: number) {
    const g = 3, w2 = (W-g)/2, h2 = (H-g)/2, w3 = (W-2*g)/3, h3 = (H-2*g)/3;
    const b: React.CSSProperties = { position: 'absolute', overflow: 'hidden', borderRadius: 2 };
    if (layout==='full') return [{ i:0, s:{ ...b, left:0, top:0, width:W, height:H } }];
    if (layout==='single-left') return [{ i:0, s:{ ...b, left:0, top:0, width:W*0.6, height:H } }];
    if (layout==='single-right') return [{ i:0, s:{ ...b, left:W*0.4, top:0, width:W*0.6, height:H } }];
    if (layout==='single-center') return [{ i:0, s:{ ...b, left:W*0.1, top:H*0.05, width:W*0.8, height:H*0.9 } }];
    if (layout==='half-half') return [{ i:0, s:{ ...b, left:0, top:0, width:w2, height:H } }, { i:1, s:{ ...b, left:w2+g, top:0, width:w2, height:H } }];
    if (layout==='top-bottom') return [{ i:0, s:{ ...b, left:0, top:0, width:W, height:h2 } }, { i:1, s:{ ...b, left:0, top:h2+g, width:W, height:h2 } }];
    if (layout==='big-small-r') return [{ i:0, s:{ ...b, left:0, top:0, width:W*0.65, height:H } }, { i:1, s:{ ...b, left:W*0.65+g, top:H*0.2, width:W*0.35-g, height:H*0.6 } }];
    if (layout==='big-small-l') return [{ i:0, s:{ ...b, left:0, top:H*0.2, width:W*0.35-g, height:H*0.6 } }, { i:1, s:{ ...b, left:W*0.35, top:0, width:W*0.65, height:H } }];
    if (layout==='panorama') return [{ i:0, s:{ ...b, left:0, top:H*0.1, width:w2, height:H*0.8 } }, { i:1, s:{ ...b, left:w2+g, top:H*0.1, width:w2, height:H*0.8 } }];
    if (layout==='left-3') { const lw=W*0.55, rw=W-lw-g, rh=(H-g)/2; return [{ i:0, s:{ ...b, left:0, top:0, width:lw, height:H } }, { i:1, s:{ ...b, left:lw+g, top:0, width:rw, height:rh } }, { i:2, s:{ ...b, left:lw+g, top:rh+g, width:rw, height:rh } }]; }
    if (layout==='right-3') { const rw=W*0.55, lw=W-rw-g, lh=(H-g)/2; return [{ i:0, s:{ ...b, left:0, top:0, width:lw, height:lh } }, { i:1, s:{ ...b, left:0, top:lh+g, width:lw, height:lh } }, { i:2, s:{ ...b, left:lw+g, top:0, width:rw, height:H } }]; }
    if (layout==='top-2-bot-1') return [{ i:0, s:{ ...b, left:0, top:0, width:w2, height:h2 } }, { i:1, s:{ ...b, left:w2+g, top:0, width:w2, height:h2 } }, { i:2, s:{ ...b, left:0, top:h2+g, width:W, height:h2 } }];
    if (layout==='top-1-bot-2') return [{ i:0, s:{ ...b, left:0, top:0, width:W, height:h2 } }, { i:1, s:{ ...b, left:0, top:h2+g, width:w2, height:h2 } }, { i:2, s:{ ...b, left:w2+g, top:h2+g, width:w2, height:h2 } }];
    if (layout==='triple-row') return [{ i:0, s:{ ...b, left:0, top:0, width:w3, height:H } }, { i:1, s:{ ...b, left:w3+g, top:0, width:w3, height:H } }, { i:2, s:{ ...b, left:(w3+g)*2, top:0, width:w3, height:H } }];
    if (layout==='grid4') return [{ i:0, s:{ ...b, left:0, top:0, width:w2, height:h2 } }, { i:1, s:{ ...b, left:w2+g, top:0, width:w2, height:h2 } }, { i:2, s:{ ...b, left:0, top:h2+g, width:w2, height:h2 } }, { i:3, s:{ ...b, left:w2+g, top:h2+g, width:w2, height:h2 } }];
    if (layout==='grid4-wide') { const bh=H*0.55, sh=H-bh-g; return [{ i:0, s:{ ...b, left:0, top:0, width:W, height:bh } }, { i:1, s:{ ...b, left:0, top:bh+g, width:w3, height:sh } }, { i:2, s:{ ...b, left:w3+g, top:bh+g, width:w3, height:sh } }, { i:3, s:{ ...b, left:(w3+g)*2, top:bh+g, width:w3, height:sh } }]; }
    if (layout==='l-shape-4') { const bw=W*0.55, sw=W-bw-g, sh=(H-2*g)/3; return [{ i:0, s:{ ...b, left:0, top:0, width:bw, height:H } }, { i:1, s:{ ...b, left:bw+g, top:0, width:sw, height:sh } }, { i:2, s:{ ...b, left:bw+g, top:sh+g, width:sw, height:sh } }, { i:3, s:{ ...b, left:bw+g, top:(sh+g)*2, width:sw, height:sh } }]; }
    if (layout==='grid5-hero') { const bw=W*0.55, sh=h2, sw=(W-bw-2*g)/2; return [{ i:0, s:{ ...b, left:0, top:0, width:bw, height:H } }, { i:1, s:{ ...b, left:bw+g, top:0, width:W-bw-g, height:sh } }, { i:2, s:{ ...b, left:bw+g, top:sh+g, width:sw, height:sh } }, { i:3, s:{ ...b, left:bw+g+sw+g, top:sh+g, width:sw, height:sh } }]; }
    if (layout==='grid5-cross') return [{ i:0, s:{ ...b, left:0, top:0, width:w2, height:h2 } }, { i:1, s:{ ...b, left:w2+g, top:0, width:w2, height:h2 } }, { i:2, s:{ ...b, left:W/2-W*0.2, top:h2*0.3, width:W*0.4, height:h2*0.4 } }, { i:3, s:{ ...b, left:0, top:h2+g, width:w2, height:h2 } }, { i:4, s:{ ...b, left:w2+g, top:h2+g, width:w2, height:h2 } }];
    if (layout==='grid6-2x3') return [0,1].flatMap(col => [0,1,2].map(row => ({ i:col*3+row, s:{ ...b, left:col*(w2+g), top:row*(h3+g), width:w2, height:h3 } })));
    if (layout==='grid6-3x2') return [0,1,2].flatMap(col => [0,1].map(row => ({ i:col*2+row, s:{ ...b, left:col*(w3+g), top:row*(h2+g), width:w3, height:h2 } })));
    if (layout==='text-right') { const lw=W*0.6; return [{ i:0, s:{ ...b, left:0, top:0, width:lw, height:H } }, { i:1, s:{ ...b, left:lw+g, top:0, width:W-lw-g, height:H, background:'#f8f9ff' } }]; }
    if (layout==='text-left') { const rw=W*0.6; return [{ i:0, s:{ ...b, left:0, top:0, width:W-rw-g, height:H, background:'#f8f9ff' } }, { i:1, s:{ ...b, left:W-rw, top:0, width:rw, height:H } }]; }
    if (layout==='text-only') return [{ i:0, s:{ ...b, left:0, top:0, width:W, height:H, background:'#f8f9ff' } }];
    return [];
  }

  // ─── Layout Preview SVG ───────────────────────────────────────────────────
  function LayoutSVG({ layout, active }: { layout: LayoutType; active: boolean }) {
    const W=44, H=28, g=1.5, w2=(W-g)/2, h2=(H-g)/2, w3=(W-2*g)/3, h3=(H-2*g)/3;
    const c = active ? '#1e2d7d' : '#cbd5e1';
    let boxes: { x:number; y:number; w:number; h:number }[] = [];
    if (layout==='full') boxes=[{x:0,y:0,w:W,h:H}];
    else if (layout==='single-left') boxes=[{x:0,y:0,w:W*0.6,h:H}];
    else if (layout==='single-right') boxes=[{x:W*0.4,y:0,w:W*0.6,h:H}];
    else if (layout==='single-center') boxes=[{x:W*0.1,y:H*0.05,w:W*0.8,h:H*0.9}];
    else if (layout==='half-half') boxes=[{x:0,y:0,w:w2,h:H},{x:w2+g,y:0,w:w2,h:H}];
    else if (layout==='top-bottom') boxes=[{x:0,y:0,w:W,h:h2},{x:0,y:h2+g,w:W,h:h2}];
    else if (layout==='big-small-r') boxes=[{x:0,y:0,w:W*0.65,h:H},{x:W*0.65+g,y:H*0.2,w:W*0.35-g,h:H*0.6}];
    else if (layout==='big-small-l') boxes=[{x:0,y:H*0.2,w:W*0.35-g,h:H*0.6},{x:W*0.35,y:0,w:W*0.65,h:H}];
    else if (layout==='panorama') boxes=[{x:0,y:H*0.1,w:w2,h:H*0.8},{x:w2+g,y:H*0.1,w:w2,h:H*0.8}];
    else if (layout==='left-3') { const lw=W*0.55, rw=W-lw-g, rh=(H-g)/2; boxes=[{x:0,y:0,w:lw,h:H},{x:lw+g,y:0,w:rw,h:rh},{x:lw+g,y:rh+g,w:rw,h:rh}]; }
    else if (layout==='right-3') { const rw=W*0.55, lw=W-rw-g, lh=(H-g)/2; boxes=[{x:0,y:0,w:lw,h:lh},{x:0,y:lh+g,w:lw,h:lh},{x:lw+g,y:0,w:rw,h:H}]; }
    else if (layout==='top-2-bot-1') boxes=[{x:0,y:0,w:w2,h:h2},{x:w2+g,y:0,w:w2,h:h2},{x:0,y:h2+g,w:W,h:h2}];
    else if (layout==='top-1-bot-2') boxes=[{x:0,y:0,w:W,h:h2},{x:0,y:h2+g,w:w2,h:h2},{x:w2+g,y:h2+g,w:w2,h:h2}];
    else if (layout==='triple-row') boxes=[{x:0,y:0,w:w3,h:H},{x:w3+g,y:0,w:w3,h:H},{x:(w3+g)*2,y:0,w:w3,h:H}];
    else if (layout==='grid4') boxes=[{x:0,y:0,w:w2,h:h2},{x:w2+g,y:0,w:w2,h:h2},{x:0,y:h2+g,w:w2,h:h2},{x:w2+g,y:h2+g,w:w2,h:h2}];
    else if (layout==='grid4-wide') { const bh=H*0.55; boxes=[{x:0,y:0,w:W,h:bh},{x:0,y:bh+g,w:w3,h:H-bh-g},{x:w3+g,y:bh+g,w:w3,h:H-bh-g},{x:(w3+g)*2,y:bh+g,w:w3,h:H-bh-g}]; }
    else if (layout==='l-shape-4') { const bw=W*0.55, sw=W-bw-g, sh=(H-2*g)/3; boxes=[{x:0,y:0,w:bw,h:H},{x:bw+g,y:0,w:sw,h:sh},{x:bw+g,y:sh+g,w:sw,h:sh},{x:bw+g,y:(sh+g)*2,w:sw,h:sh}]; }
    else if (layout==='grid5-hero') { const bw=W*0.55, sh=h2, sw=(W-bw-2*g)/2; boxes=[{x:0,y:0,w:bw,h:H},{x:bw+g,y:0,w:W-bw-g,h:sh},{x:bw+g,y:sh+g,w:sw,h:sh},{x:bw+g+sw+g,y:sh+g,w:sw,h:sh}]; }
    else if (layout==='grid5-cross') boxes=[{x:0,y:0,w:w2,h:h2},{x:w2+g,y:0,w:w2,h:h2},{x:W/2-W*0.15,y:h2*0.35,w:W*0.3,h:h2*0.3},{x:0,y:h2+g,w:w2,h:h2},{x:w2+g,y:h2+g,w:w2,h:h2}];
    else if (layout==='grid6-2x3') { [0,1].forEach(col=>[0,1,2].forEach(row=>boxes.push({x:col*(w2+g),y:row*(h3+g),w:w2,h:h3}))); }
    else if (layout==='grid6-3x2') { [0,1,2].forEach(col=>[0,1].forEach(row=>boxes.push({x:col*(w3+g),y:row*(h2+g),w:w3,h:h2}))); }
    else if (layout==='text-right') boxes=[{x:0,y:0,w:W*0.6,h:H},{x:W*0.6+g,y:0,w:W*0.4-g,h:H}];
    else if (layout==='text-left') boxes=[{x:0,y:0,w:W*0.4-g,h:H},{x:W*0.4,y:0,w:W*0.6,h:H}];
    else if (layout==='text-only') boxes=[{x:0,y:0,w:W,h:H}];
    return (
      <svg width={W} height={H} style={{ display:'block', borderRadius:3, overflow:'hidden', background: active ? '#e8eeff' : '#f1f5f9' }}>
        {boxes.map((bx,i) => <rect key={i} x={bx.x} y={bx.y} width={bx.w} height={bx.h} rx={1} fill={c} opacity={0.75} />)}
        <rect x={W/2-0.5} y={0} width={1} height={H} fill={active ? '#1e2d7d' : '#d1d5db'} opacity={0.35} />
      </svg>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const slotDefs = cur ? getSlotDefs(cur.layout, cW, cH) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#f4f6fb' }}>

      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', background:'#fff', borderBottom:'1px solid #e2e8f0', flexShrink:0, gap:16 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, color:'#1e2d7d' }}>{config.productName || 'Фотокнига'}</div>
          <div style={{ fontSize:11, color:'#64748b' }}>Розкладка • {photos.length} фото</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={autoFill} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#1e2d7d' }}><Wand2 size={14}/> Авто</button>
          <button onClick={() => setZoom(z => Math.max(30,z-10))} style={{ padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:6, background:'#fff', cursor:'pointer' }}><ZoomOut size={14}/></button>
          <span style={{ fontSize:12, fontWeight:700, color:'#475569', minWidth:36, textAlign:'center' }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(130,z+10))} style={{ padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:6, background:'#fff', cursor:'pointer' }}><ZoomIn size={14}/></button>
        </div>
        <button onClick={addToCart} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 22px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 16px rgba(38,58,153,0.3)' }}>
          <ShoppingCart size={15}/> Додати до кошика • {config.totalPrice} ₴
        </button>
      </div>

      {/* BODY */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* LEFT PANEL — vertical icon nav + content */}
        <div style={{ display:'flex', flexShrink:0, borderRight:'1px solid #e2e8f0' }}>
          {/* Icon sidebar */}
          <div style={{ width:72, background:'#fff', display:'flex', flexDirection:'column', alignItems:'center', paddingTop:8, borderRight:'1px solid #f1f5f9', flexShrink:0 }}>
            {([
              ['photos',   <ImageIcon key="ph" size={22}/>,    'Зображення'],
              ['layouts',  <LayoutGrid key="la" size={22}/>,   'Шаблон'],
              ['text',     <Type key="tx" size={22}/>,         'Текст'],
            ] as [string, React.ReactNode, string][]).map(([id, icon, label]) => (
              <button key={id} onClick={() => setLeftTab(id as any)}
                style={{ width:'100%', padding:'10px 4px', border:'none', cursor:'pointer', background:leftTab===id?'#1e2d7d':'transparent', color:leftTab===id?'#fff':'#64748b', display:'flex', flexDirection:'column', alignItems:'center', gap:5, borderRadius:0, transition:'background 0.15s', marginBottom:2 }}>
                {icon}
                <span style={{ fontSize:10, fontWeight:700, lineHeight:1.2, textAlign:'center' }}>{label}</span>
              </button>
            ))}
          </div>
          {/* Content panel */}
          <div style={{ width:200, background:'#fff', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'10px 12px', borderBottom:'1px solid #f1f5f9', fontWeight:800, fontSize:12, color:'#1e2d7d' }}>
              {leftTab==='photos'?'Зображення':leftTab==='layouts'?'Шаблон':'Текст'}
            </div>

          <div style={{ flex:1, overflow:'auto', padding:10 }}>

            {/* PHOTOS TAB */}
            {leftTab === 'photos' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {/* Hidden file input */}
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display:'none' }}/>
                {/* Upload button */}
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 8px', border:'2px dashed #263a99', borderRadius:10, background:'#f0f3ff', cursor:'pointer', fontWeight:700, fontSize:12, color:'#1e2d7d', width:'100%', transition:'background 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background='#dbeafe')}
                  onMouseLeave={e => (e.currentTarget.style.background='#f0f3ff')}>
                  <ImageIcon size={16}/> Завантажити фото
                </button>
                {photos.length === 0 && (
                  <p style={{ fontSize:11, color:'#94a3b8', textAlign:'center', margin:0 }}>Додайте фото щоб почати</p>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {photos.map((ph,i) => {
                  const used = usedIds.has(ph.id);
                  return (
                    <div key={ph.id} draggable={!used} onDragStart={() => !used && onDragStart(ph.id)} onDragEnd={onDragEnd}
                      style={{ position:'relative', aspectRatio:'1', borderRadius:6, overflow:'hidden', cursor:used?'default':'grab', opacity:used?0.4:1, border:'1px solid #e2e8f0' }}>
                      <img src={ph.preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>
                      {used && <div style={{ position:'absolute', inset:0, background:'rgba(16,185,129,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✓</div>}
                      <span style={{ position:'absolute', bottom:2, left:2, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:3 }}>{i+1}</span>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* LAYOUTS TAB */}
            {leftTab === 'layouts' && (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {['1 фото','2 фото','3 фото','4 фото','5 фото','6 фото','Текст'].map(group => {
                  const gl = LAYOUTS.filter(l => l.group === group);
                  return (
                    <div key={group}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:'0.08em', padding:'8px 4px 4px', textTransform:'uppercase' }}>{group}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                        {gl.map(l => {
                          const active = cur?.layout === l.id;
                          return (
                            <button key={l.id} onClick={() => changeLayout(l.id)} title={l.label}
                              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'7px 4px', border:active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:active?'#f0f3ff':'#fff', cursor:'pointer' }}>
                              <LayoutSVG layout={l.id} active={active}/>
                              <span style={{ fontSize:9, fontWeight:600, color:active?'#1e2d7d':'#374151', textAlign:'center', lineHeight:1.2 }}>{l.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:10, marginTop:4 }}>
                  <button onClick={resetSpread} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff7f7', cursor:'pointer', fontWeight:600, fontSize:12, color:'#ef4444', width:'100%' }}>
                    <RotateCcw size={13}/> Очистити розворот
                  </button>
                </div>
              </div>
            )}

            {/* TEXT TAB */}
            {leftTab === 'text' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button onClick={() => setTextTool(t => !t)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px', border:textTool?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:textTool?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:700, fontSize:13, color:textTool?'#1e2d7d':'#374151' }}>
                  <Type size={15}/> {textTool ? '↖ Клікніть на розворот' : 'Додати текст'}
                </button>

                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Шрифт</div>
                  <select value={tFontFamily} onChange={e => { setTFontFamily(e.target.value); if (selectedTextId) updateTxt(selectedTextId, { fontFamily: e.target.value }); }}
                    style={{ padding:'6px 8px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, width:'100%' }}>
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>

                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Розмір: {tFontSize}px</div>
                  <input type="range" min={8} max={120} value={tFontSize}
                    onChange={e => { const v=+e.target.value; setTFontSize(v); if (selectedTextId) updateTxt(selectedTextId, { fontSize: v }); }}
                    style={{ width:'100%' }}/>

                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Колір</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center' }}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => { setTColor(c); if (selectedTextId) updateTxt(selectedTextId, { color: c }); }}
                        style={{ width:22, height:22, borderRadius:'50%', background:c, border:tColor===c?'3px solid #1e2d7d':'2px solid #e2e8f0', cursor:'pointer', flexShrink:0 }}/>
                    ))}
                    <input type="color" value={tColor} onChange={e => { setTColor(e.target.value); if (selectedTextId) updateTxt(selectedTextId, { color: e.target.value }); }}
                      style={{ width:22, height:22, borderRadius:'50%', border:'none', cursor:'pointer', padding:0 }}/>
                  </div>

                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => { const v=!tBold; setTBold(v); if (selectedTextId) updateTxt(selectedTextId, { bold: v }); }}
                      style={{ flex:1, padding:'6px', border:tBold?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background:tBold?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:900, fontSize:14, color:tBold?'#1e2d7d':'#374151' }}>B</button>
                    <button onClick={() => { const v=!tItalic; setTItalic(v); if (selectedTextId) updateTxt(selectedTextId, { italic: v }); }}
                      style={{ flex:1, padding:'6px', border:tItalic?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background:tItalic?'#f0f3ff':'#fff', cursor:'pointer', fontStyle:'italic', fontSize:14, color:tItalic?'#1e2d7d':'#374151' }}>I</button>
                  </div>
                </div>

                {selectedTextId && (
                  <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:8 }}>
                    <p style={{ fontSize:11, color:'#94a3b8', margin:'0 0 6px' }}>Двічі клікніть для редагування</p>
                    <button onClick={() => deleteTxt(selectedTextId!)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff7f7', cursor:'pointer', fontWeight:600, fontSize:12, color:'#ef4444', width:'100%' }}>
                      <Trash2 size={13}/> Видалити
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
          </div>
        </div>

        {/* CENTER CANVAS */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'auto', padding:32, background:'#f4f6fb' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1e2d7d', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => setCurrentIdx(i => Math.max(0,i-1))} disabled={currentIdx===0} style={{ background:'none', border:'none', cursor:currentIdx===0?'not-allowed':'pointer', opacity:currentIdx===0?0.3:1, color:'#1e2d7d' }}><ChevronLeft size={20}/></button>
            <span>{cur?.label}</span>
            <button onClick={() => setCurrentIdx(i => Math.min(spreads.length-1,i+1))} disabled={currentIdx===spreads.length-1} style={{ background:'none', border:'none', cursor:currentIdx===spreads.length-1?'not-allowed':'pointer', opacity:currentIdx===spreads.length-1?0.3:1, color:'#1e2d7d' }}><ChevronRight size={20}/></button>
          </div>

          {/* Canvas */}
          <div onClick={onCanvasClick}
            style={{ position:'relative', width:cW, height:cH, background:'#e8ecf4', borderRadius:4, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.12)', cursor:textTool?'crosshair':'default', flexShrink:0 }}>
            <div style={{ position:'absolute', left:cW/2-1, top:0, width:2, height:cH, background:'rgba(0,0,0,0.08)', zIndex:10, pointerEvents:'none' }}/>

            {/* Photo slots */}
            {cur && slotDefs.map(({ i, s }) => {
              const slot = cur.slots[i];
              const photo = slot ? getPhoto(slot.photoId) : null;
              const sk = `${currentIdx}-${i}`;
              const isOver = dropTarget === sk;
              return (
                <div key={i} onDragOver={e => { e.preventDefault(); setDropTarget(sk); }} onDragLeave={() => setDropTarget(null)} onDrop={e => onDrop(e, currentIdx, i)}
                  style={{ ...s, background: photo?'transparent':(isOver?'#dbeafe':'#f1f5f9'), border:isOver?'2px dashed #1e2d7d':(photo?'none':'1px dashed #cbd5e1'), transition:'border-color 0.15s', cursor:dragPhotoId?'copy':'default' }}>
                  {photo ? (
                    <>
                      <img src={photo.preview} alt="" onMouseDown={e => startCropDrag(e, sk, slot!.cropX, slot!.cropY)}
                        style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:`${slot!.cropX}% ${slot!.cropY}%`, userSelect:'none', cursor:'grab', display:'block' }} draggable={false}/>
                      <button onClick={() => clearSlot(currentIdx, i)}
                        style={{ position:'absolute', top:5, right:5, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.15s' }}
                        className="del-slot-btn"><Trash2 size={10}/></button>
                      <style>{`.del-slot-btn:hover, div:hover > .del-slot-btn { opacity:1 !important; }`}</style>
                    </>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8', gap:4 }}>
                      <ImageIcon size={20}/><span style={{ fontSize:10, fontWeight:600 }}>Перетягніть фото</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Text blocks */}
            {cur?.textBlocks.map(tb => {
              const isSel = selectedTextId === tb.id;
              const isEd = editingTextId === tb.id;
              return (
                <div key={tb.id}
                  onMouseDown={e => { e.stopPropagation(); setSelectedTextId(tb.id); if (!isEd) startTxtDrag(e, tb.id, tb.x, tb.y); }}
                  onDoubleClick={e => { e.stopPropagation(); setEditingTextId(tb.id); setSelectedTextId(tb.id); }}
                  style={{ position:'absolute', left:tb.x+'%', top:tb.y+'%', transform:'translate(-50%,-50%)', zIndex:20, cursor:isEd?'text':'move', outline:isSel?'2px solid #3b82f6':'none', borderRadius:3, padding:'2px 4px', background:isSel?'rgba(255,255,255,0.1)':'transparent', minWidth:40 }}>
                  {isEd ? (
                    <textarea autoFocus defaultValue={tb.text}
                      onBlur={e => { updateTxt(tb.id, { text: e.target.value }); setEditingTextId(null); }}
                      onClick={e => e.stopPropagation()}
                      style={{ background:'transparent', border:'none', outline:'none', fontSize:(tb.fontSize*(zoom/100))+'px', fontFamily:tb.fontFamily, color:tb.color, fontWeight:tb.bold?700:400, fontStyle:tb.italic?'italic':'normal', resize:'none', overflow:'hidden', minWidth:80, display:'block' }}
                      rows={2}/>
                  ) : (
                    <span style={{ fontSize:(tb.fontSize*(zoom/100))+'px', fontFamily:tb.fontFamily, color:tb.color, fontWeight:tb.bold?700:400, fontStyle:tb.italic?'italic':'normal', display:'block', whiteSpace:'pre', userSelect:'none', textShadow:'0 1px 3px rgba(0,0,0,0.25)' }}>{tb.text}</span>
                  )}
                  {isSel && !isEd && (
                    <button onMouseDown={e => { e.stopPropagation(); deleteTxt(tb.id); }}
                      style={{ position:'absolute', top:-8, right:-8, width:18, height:18, borderRadius:'50%', background:'#ef4444', color:'#fff', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', zIndex:30 }}>×</button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:10, fontSize:11, color:'#94a3b8' }}>
            {textTool ? '↖ Клікніть де додати текст' : 'Затисніть фото для зміни кадрування'}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ width:180, borderLeft:'1px solid #e2e8f0', background:'#fff', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'10px 12px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#1e2d7d' }}>Розвороти</span>
            <span style={{ fontSize:11, color:'#94a3b8' }}>{spreads.length}</span>
          </div>
          <div style={{ flex:1, overflow:'auto', padding:8, display:'flex', flexDirection:'column', gap:6 }}>
            {spreads.map((sp, idx) => {
              const active = idx === currentIdx;
              return (
                <button key={sp.id} onClick={() => setCurrentIdx(idx)}
                  style={{ width:'100%', padding:6, border:active?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:8, background:active?'#f0f3ff':'#fff', cursor:'pointer', textAlign:'center' }}>
                  <div style={{ display:'flex', gap:2, marginBottom:4, background:'#e8ecf4', borderRadius:3, overflow:'hidden', height:44 }}>
                    {sp.slots.slice(0,2).map((sl,i) => {
                      const ph = getPhoto(sl.photoId);
                      return <div key={i} style={{ flex:1, height:'100%', background:ph?`url(${ph.preview}) center/cover`:'#dde3f0' }}/>;
                    })}
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, color:active?'#1e2d7d':'#64748b' }}>{sp.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
