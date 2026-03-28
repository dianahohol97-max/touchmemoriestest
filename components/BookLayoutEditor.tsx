'use client';

import { useState, useEffect, useRef, DragEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ShoppingCart,
  Image as ImageIcon, Type, Trash2, LayoutGrid, Wand2, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PhotoData {
  id: string;
  preview: string;
  width: number;
  height: number;
  name: string;
}

interface BookConfig {
  productSlug: string;
  productName: string;
  selectedSize?: string;
  selectedCoverType?: string;
  selectedPageCount: string;
  totalPrice: number;
}

// Layout types for each spread
type LayoutType =
  | 'full' | 'single-left' | 'single-right' | 'single-center'
  | 'half-half' | 'top-bottom' | 'big-small-r' | 'big-small-l' | 'panorama'
  | 'left-3' | 'right-3' | 'top-2-bot-1' | 'top-1-bot-2' | 'triple-row'
  | 'grid4' | 'grid4-wide' | 'l-shape-4'
  | 'grid5-hero' | 'grid5-cross'
  | 'grid6-2x3' | 'grid6-3x2'
  | 'text-right' | 'text-left' | 'text-only';

interface SlotData {
  photoId: string | null;
  // crop offset as percentage (0–100)
  cropX: number;
  cropY: number;
  text?: string;
}

interface Spread {
  id: number;
  type: 'cover' | 'content';
  label: string;
  layout: LayoutType;
  slots: SlotData[];
}

// ─── Layout Definitions ──────────────────────────────────────────────────────

const LAYOUTS: { id: LayoutType; label: string; slots: number; icon: string; group: string }[] = [
  // 1 фото
  { id: 'full',         label: 'На весь розворот', slots: 1, icon: '⬛', group: '1 фото' },
  { id: 'single-left',  label: 'Одне ліворуч',    slots: 1, icon: '◧',  group: '1 фото' },
  { id: 'single-right', label: 'Одне праворуч',   slots: 1, icon: '◨',  group: '1 фото' },
  { id: 'single-center',label: 'Одне по центру',  slots: 1, icon: '◻',  group: '1 фото' },
  // 2 фото
  { id: 'half-half',    label: '2 поруч рівно',   slots: 2, icon: '◧◨', group: '2 фото' },
  { id: 'top-bottom',   label: '2 зверху/знизу',  slots: 2, icon: '⬒',  group: '2 фото' },
  { id: 'big-small-r',  label: 'Велике + мале',   slots: 2, icon: '▬▪', group: '2 фото' },
  { id: 'big-small-l',  label: 'Мале + велике',   slots: 2, icon: '▪▬', group: '2 фото' },
  { id: 'panorama',     label: 'Панорама 2:1',     slots: 2, icon: '▭',  group: '2 фото' },
  // 3 фото
  { id: 'left-3',       label: '1 великий + 2',   slots: 3, icon: '▣',  group: '3 фото' },
  { id: 'right-3',      label: '2 + 1 великий',   slots: 3, icon: '⊟',  group: '3 фото' },
  { id: 'top-2-bot-1',  label: '2 зверху + 1',    slots: 3, icon: '⊞',  group: '3 фото' },
  { id: 'top-1-bot-2',  label: '1 зверху + 2',    slots: 3, icon: '⊟',  group: '3 фото' },
  { id: 'triple-row',   label: '3 в ряд',          slots: 3, icon: '⊟',  group: '3 фото' },
  // 4 фото
  { id: 'grid4',        label: '4 рівно',          slots: 4, icon: '⊞',  group: '4 фото' },
  { id: 'grid4-wide',   label: '1 широке + 3',    slots: 4, icon: '▤',  group: '4 фото' },
  { id: 'l-shape-4',    label: 'Г-подібний',       slots: 4, icon: '▣',  group: '4 фото' },
  // 5 фото
  { id: 'grid5-hero',   label: '1 велике + 4',    slots: 5, icon: '⊞',  group: '5 фото' },
  { id: 'grid5-cross',  label: '5 у хрест',        slots: 5, icon: '⊕',  group: '5 фото' },
  // 6 фото
  { id: 'grid6-2x3',    label: '2×3 сітка',        slots: 6, icon: '⊞',  group: '6 фото' },
  { id: 'grid6-3x2',    label: '3×2 сітка',        slots: 6, icon: '⊟',  group: '6 фото' },
  // Текст
  { id: 'text-right',   label: 'Фото + текст',     slots: 2, icon: '▤',  group: 'Текст' },
  { id: 'text-left',    label: 'Текст + фото',     slots: 2, icon: '▧',  group: 'Текст' },
  { id: 'text-only',    label: 'Тільки текст',     slots: 1, icon: '☰',  group: 'Текст' },
];

function makeSlots(count: number): SlotData[] {
  return Array.from({ length: count }, () => ({ photoId: null, cropX: 50, cropY: 50 }));
}

// Real page proportions in mm (width = single page width, height = page height)
const PAGE_PROPORTIONS: Record<string, { w: number; h: number }> = {
  '20×20': { w: 200, h: 200 },
  '25×25': { w: 250, h: 250 },
  '20×30': { w: 200, h: 300 },
  '30×20': { w: 300, h: 200 },
  '30×30': { w: 300, h: 300 },
  'A4':    { w: 210, h: 297 },
};
// Canvas fits inside 700px wide area
const MAX_CANVAS_W = 700;
const MAX_CANVAS_H = 480;
// Legacy alias kept for LayoutPreview
const SPREAD_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '20×20': { width: 200, height: 200 },
  '25×25': { width: 250, height: 250 },
  '20×30': { width: 200, height: 300 },
  '30×20': { width: 300, height: 200 },
  '30×30': { width: 300, height: 300 },
  'A4':    { width: 210, height: 297 },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookLayoutEditor() {
  const router = useRouter();
  const { addItem } = useCartStore();

  const [config, setConfig] = useState<BookConfig | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [zoom, setZoom] = useState(60);
  const [leftTab, setLeftTab] = useState<'photos' | 'layouts' | 'text'>('photos');
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // crop drag state
  const cropDragRef = useRef<{
    slotKey: string; startX: number; startY: number;
    startCropX: number; startCropY: number;
  } | null>(null);

  // ─── Init ───
  useEffect(() => {
    const configJson = sessionStorage.getItem('bookConstructorConfig');
    if (configJson) setConfig(JSON.parse(configJson));
    else { toast.error('Конфігурація не знайдена'); router.push('/order/book'); return; }

    const photosJson = sessionStorage.getItem('bookConstructorPhotos');
    if (photosJson) setPhotos(JSON.parse(photosJson));
    else { toast.error('Фото не знайдені'); router.push('/editor/book/upload'); }
  }, [router]);

  // ─── Build spreads ───
  useEffect(() => {
    if (!config) return;
    const m = config.selectedPageCount.match(/(\d+)/);
    const totalPages = m ? parseInt(m[0]) : 20;

    const newSpreads: Spread[] = [];
    newSpreads.push({ id: 0, type: 'cover', label: 'Обкладинка', layout: 'half-half', slots: makeSlots(2) });
    for (let i = 0; i < totalPages; i += 2) {
      newSpreads.push({
        id: newSpreads.length,
        type: 'content',
        label: `${i + 1}–${i + 2}`,
        layout: 'half-half',
        slots: makeSlots(2),
      });
    }
    setSpreads(newSpreads);
  }, [config]);

  // ─── Helpers ───
  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) : null;
  const usedIds = new Set(spreads.flatMap(s => s.slots.map(sl => sl.photoId).filter(Boolean)));
  const currentSpread = spreads[currentIdx];
  const sizeKey = config?.selectedSize?.replace(/[хxX]/g, '×') || 'A4';
  const dims = SPREAD_DIMENSIONS[sizeKey] || SPREAD_DIMENSIONS['A4'];
  const prop = PAGE_PROPORTIONS[sizeKey] || PAGE_PROPORTIONS['A4'];
  // Spread = 2 pages wide, so aspect = (2*w) / h
  const spreadAspect = (2 * prop.w) / prop.h;
  // Fit into MAX area respecting aspect ratio, then apply zoom
  const baseW = Math.min(MAX_CANVAS_W, MAX_CANVAS_H * spreadAspect);
  const baseH = baseW / spreadAspect;
  const scale = zoom / 100;
  const canvasW = baseW * scale;
  const canvasH = baseH * scale;
  const allFilled = spreads.every(s => s.slots.every(sl => sl.photoId !== null));

  // ─── Layout change ───
  const changeLayout = (layout: LayoutType) => {
    const def = LAYOUTS.find(l => l.id === layout)!;
    setSpreads(prev => prev.map((s, i) => {
      if (i !== currentIdx) return s;
      const newSlots = makeSlots(def.slots);
      // keep existing photos
      s.slots.forEach((sl, si) => { if (si < newSlots.length) newSlots[si].photoId = sl.photoId; });
      return { ...s, layout, slots: newSlots };
    }));
  };

  // ─── Auto-fill ───
  const autoFill = () => {
    let photoIdx = 0;
    setSpreads(prev => prev.map(s => ({
      ...s,
      slots: s.slots.map(sl => {
        if (sl.photoId) return sl;
        const photo = photos[photoIdx];
        if (!photo) return sl;
        photoIdx++;
        return { ...sl, photoId: photo.id };
      })
    })));
    toast.success('Фото розставлено автоматично');
  };

  // ─── Reset spread ───
  const resetSpread = () => {
    setSpreads(prev => prev.map((s, i) => i !== currentIdx ? s : { ...s, slots: makeSlots(s.slots.length) }));
  };

  // ─── Drag & Drop ───
  const onDragStart = (photoId: string) => setDragPhotoId(photoId);
  const onDragEnd = () => { setDragPhotoId(null); setDropTarget(null); };

  const onSlotDrop = (e: DragEvent, spreadIdx: number, slotIdx: number) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragPhotoId) return;
    setSpreads(prev => prev.map((s, i) => {
      if (i !== spreadIdx) return s;
      const newSlots = s.slots.map((sl, si) =>
        si === slotIdx ? { ...sl, photoId: dragPhotoId } : sl
      );
      return { ...s, slots: newSlots };
    }));
    setDragPhotoId(null);
  };

  const clearSlot = (spreadIdx: number, slotIdx: number) => {
    setSpreads(prev => prev.map((s, i) => {
      if (i !== spreadIdx) return s;
      const newSlots = s.slots.map((sl, si) => si === slotIdx ? { ...sl, photoId: null } : sl);
      return { ...s, slots: newSlots };
    }));
  };

  // ─── Crop drag (mouse) ───
  const onPhotoDragStart = (e: React.MouseEvent, slotKey: string, cropX: number, cropY: number) => {
    e.preventDefault();
    cropDragRef.current = { slotKey, startX: e.clientX, startY: e.clientY, startCropX: cropX, startCropY: cropY };

    const onMove = (me: MouseEvent) => {
      if (!cropDragRef.current) return;
      const dx = (me.clientX - cropDragRef.current.startX) / 3;
      const dy = (me.clientY - cropDragRef.current.startY) / 3;
      const newX = Math.max(0, Math.min(100, cropDragRef.current.startCropX - dx));
      const newY = Math.max(0, Math.min(100, cropDragRef.current.startCropY - dy));
      const [si, sli] = cropDragRef.current.slotKey.split('-').map(Number);
      setSpreads(prev => prev.map((s, i) => {
        if (i !== si) return s;
        return { ...s, slots: s.slots.map((sl, j) => j === sli ? { ...sl, cropX: newX, cropY: newY } : sl) };
      }));
    };
    const onUp = () => {
      cropDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ─── Cart ───
  const handleAddToCart = () => {
    if (!config) return;
    addItem({
      id: `photobook-${Date.now()}`,
      name: config.productName || 'Фотокнига',
      price: config.totalPrice,
      qty: 1,
      image: getPhoto(spreads[0]?.slots[0]?.photoId ?? null)?.preview || '',
      options: { 'Розмір': config.selectedSize || '', 'Сторінок': config.selectedPageCount },
      personalization_note: `Розкладка: ${spreads.length} розворотів`,
    });
    toast.success('Додано до кошика!');
    router.push('/cart');
  };

  if (!config || spreads.length === 0) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;
  }

  // ─── Photo Slot ───
  const PhotoSlot = ({ spreadIdx, slotIdx, style }: {
    spreadIdx: number; slotIdx: number; style?: React.CSSProperties
  }) => {
    const slot = spreads[spreadIdx]?.slots[slotIdx];
    if (!slot) return null;
    const photo = getPhoto(slot.photoId);
    const slotKey = `${spreadIdx}-${slotIdx}`;
    const isOver = dropTarget === slotKey;

    return (
      <div
        onDragOver={e => { e.preventDefault(); setDropTarget(slotKey); }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={e => onSlotDrop(e, spreadIdx, slotIdx)}
        style={{
          background: photo ? 'transparent' : (isOver ? '#dbeafe' : '#f1f5f9'),
          border: isOver ? '2px dashed #1e2d7d' : (photo ? 'none' : '1px dashed #cbd5e1'),
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
          cursor: dragPhotoId ? 'copy' : (photo ? 'grab' : 'default'),
          transition: 'border-color 0.15s, background 0.15s',
          ...style,
        }}
      >
        {photo ? (
          <>
            <img
              src={photo.preview}
              alt=""
              onMouseDown={e => onPhotoDragStart(e, slotKey, slot.cropX, slot.cropY)}
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                objectPosition: `${slot.cropX}% ${slot.cropY}%`,
                userSelect: 'none',
                cursor: 'grab',
                display: 'block',
              }}
              draggable={false}
            />
            <button
              onClick={() => clearSlot(spreadIdx, slotIdx)}
              style={{
                position: 'absolute', top: 6, right: 6,
                background: 'rgba(0,0,0,0.55)', color: '#fff',
                border: 'none', borderRadius: '50%',
                width: 26, height: 26, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.15s',
              }}
              className="slot-delete-btn"
            >
              <Trash2 size={12} />
            </button>
            <style>{`.slot-delete-btn:hover, div:hover > .slot-delete-btn { opacity: 1 !important; }`}</style>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 6 }}>
            <ImageIcon size={24} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Перетягніть фото</span>
          </div>
        )}
      </div>
    );
  };

  // ─── Layout Preview (mini thumbnail for picker) ───
  const LayoutPreview = ({ layout, active }: { layout: LayoutType; active: boolean }) => {
    const c = active ? '#1e2d7d' : '#cbd5e1';
    const bg = active ? '#dbeafe' : '#f1f5f9';
    const s: React.CSSProperties = { display: 'block', background: bg, borderRadius: 2 };
    const W = 44; const H = 28; const g = 1.5;
    const w2 = (W-g)/2; const h2 = (H-g)/2; const w3 = (W-2*g)/3; const h3 = (H-2*g)/3;
    const boxes: {x:number;y:number;w:number;h:number}[] = [];
    if (layout==='full') boxes.push({x:0,y:0,w:W,h:H});
    else if (layout==='single-left') boxes.push({x:0,y:0,w:W*0.6,h:H});
    else if (layout==='single-right') boxes.push({x:W*0.4,y:0,w:W*0.6,h:H});
    else if (layout==='single-center') boxes.push({x:W*0.1,y:H*0.05,w:W*0.8,h:H*0.9});
    else if (layout==='half-half') { boxes.push({x:0,y:0,w:w2,h:H}); boxes.push({x:w2+g,y:0,w:w2,h:H}); }
    else if (layout==='top-bottom') { boxes.push({x:0,y:0,w:W,h:h2}); boxes.push({x:0,y:h2+g,w:W,h:h2}); }
    else if (layout==='big-small-r') { boxes.push({x:0,y:0,w:W*0.65,h:H}); boxes.push({x:W*0.65+g,y:H*0.2,w:W*0.35-g,h:H*0.6}); }
    else if (layout==='big-small-l') { boxes.push({x:0,y:H*0.2,w:W*0.35-g,h:H*0.6}); boxes.push({x:W*0.35,y:0,w:W*0.65,h:H}); }
    else if (layout==='panorama') { boxes.push({x:0,y:H*0.1,w:w2,h:H*0.8}); boxes.push({x:w2+g,y:H*0.1,w:w2,h:H*0.8}); }
    else if (layout==='left-3') { boxes.push({x:0,y:0,w:W*0.55,h:H}); boxes.push({x:W*0.55+g,y:0,w:W*0.45-g,h:h2}); boxes.push({x:W*0.55+g,y:h2+g,w:W*0.45-g,h:h2}); }
    else if (layout==='right-3') { boxes.push({x:0,y:0,w:W*0.45-g,h:h2}); boxes.push({x:0,y:h2+g,w:W*0.45-g,h:h2}); boxes.push({x:W*0.45,y:0,w:W*0.55,h:H}); }
    else if (layout==='top-2-bot-1') { boxes.push({x:0,y:0,w:w2,h:h2}); boxes.push({x:w2+g,y:0,w:w2,h:h2}); boxes.push({x:0,y:h2+g,w:W,h:h2}); }
    else if (layout==='top-1-bot-2') { boxes.push({x:0,y:0,w:W,h:h2}); boxes.push({x:0,y:h2+g,w:w2,h:h2}); boxes.push({x:w2+g,y:h2+g,w:w2,h:h2}); }
    else if (layout==='triple-row') { [0,1,2].forEach(i => boxes.push({x:i*(w3+g),y:0,w:w3,h:H})); }
    else if (layout==='grid4') { [[0,0],[w2+g,0],[0,h2+g],[w2+g,h2+g]].forEach(([x,y])=>boxes.push({x,y,w:w2,h:h2})); }
    else if (layout==='grid4-wide') { const bh=H*0.55; boxes.push({x:0,y:0,w:W,h:bh}); [0,1,2].forEach(i=>boxes.push({x:i*(w3+g),y:bh+g,w:w3,h:H-bh-g})); }
    else if (layout==='l-shape-4') { const bw=W*0.55; const sh=(H-2*g)/3; boxes.push({x:0,y:0,w:bw,h:H}); [0,1,2].forEach(i=>boxes.push({x:bw+g,y:i*(sh+g),w:W-bw-g,h:sh})); }
    else if (layout==='grid5-hero') { const bw=W*0.55; const sh=h2; boxes.push({x:0,y:0,w:bw,h:H}); boxes.push({x:bw+g,y:0,w:W-bw-g,h:sh}); const sw=(W-bw-2*g)/2; [0,1].forEach(i=>boxes.push({x:bw+g+i*(sw+g),y:sh+g,w:sw,h:sh})); }
    else if (layout==='grid5-cross') { [[0,0],[w2+g,0],[0,h2+g],[w2+g,h2+g]].forEach(([x,y])=>boxes.push({x,y,w:w2,h:h2})); boxes.push({x:W/2-W*0.15,y:h2*0.35,w:W*0.3,h:h2*0.3}); }
    else if (layout==='grid6-2x3') { [0,1].forEach(col=>[0,1,2].forEach(row=>boxes.push({x:col*(w2+g),y:row*(h3+g),w:w2,h:h3}))); }
    else if (layout==='grid6-3x2') { [0,1,2].forEach(col=>[0,1].forEach(row=>boxes.push({x:col*(w3+g),y:row*(h2+g),w:w3,h:h2}))); }
    else if (layout==='text-right') { boxes.push({x:0,y:0,w:W*0.6,h:H}); boxes.push({x:W*0.6+g,y:0,w:W*0.4-g,h:H}); }
    else if (layout==='text-left') { boxes.push({x:0,y:0,w:W*0.4-g,h:H}); boxes.push({x:W*0.4,y:0,w:W*0.6,h:H}); }
    else if (layout==='text-only') { boxes.push({x:0,y:0,w:W,h:H}); }
    return (
      <svg width={W} height={H} style={{ display: 'block', borderRadius: 3, overflow: 'hidden', background: active ? '#e8eeff' : '#f1f5f9' }}>
        {boxes.map((b,i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={1} fill={c} opacity={0.7} />)}
        <rect x={W/2-0.5} y={0} width={1} height={H} fill={active ? '#1e2d7d' : '#d1d5db'} opacity={0.4} />
      </svg>
    );
  };

    // ─── Spread Canvas ───
  const SpreadCanvas = ({ spreadIdx }: { spreadIdx: number }) => {
    const spread = spreads[spreadIdx];
    if (!spread) return null;
    const { layout } = spread;
    const W = canvasW; const H = canvasH;
    const gap = 3;

    const baseStyle: React.CSSProperties = {
      position: 'absolute', overflow: 'hidden', borderRadius: 2,
    };

    let slotDefs: { slotIdx: number; style: React.CSSProperties }[] = [];

    const g = gap;
    const w2 = (W - g) / 2; const h2 = (H - g) / 2;
    const w3 = (W - 2*g) / 3; const h3 = (H - 2*g) / 3;

    if (layout === 'full') {
      slotDefs = [{ slotIdx: 0, style: { ...baseStyle, left: 0, top: 0, width: W, height: H } }];
    } else if (layout === 'single-left') {
      slotDefs = [{ slotIdx: 0, style: { ...baseStyle, left: 0, top: 0, width: W*0.6, height: H } }];
    } else if (layout === 'single-right') {
      slotDefs = [{ slotIdx: 0, style: { ...baseStyle, left: W*0.4, top: 0, width: W*0.6, height: H } }];
    } else if (layout === 'single-center') {
      const pad = W * 0.1;
      slotDefs = [{ slotIdx: 0, style: { ...baseStyle, left: pad, top: H*0.05, width: W - pad*2, height: H*0.9 } }];
    } else if (layout === 'half-half') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0, width: w2, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: w2+g, top: 0, width: w2, height: H } },
      ];
    } else if (layout === 'top-bottom') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0, top: 0,    width: W, height: h2 } },
        { slotIdx: 1, style: { ...baseStyle, left: 0, top: h2+g, width: W, height: h2 } },
      ];
    } else if (layout === 'big-small-r') {
      const lw = W * 0.65;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0, width: lw, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: lw+g, top: H*0.2, width: W-lw-g, height: H*0.6 } },
      ];
    } else if (layout === 'big-small-l') {
      const rw = W * 0.65;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0, top: H*0.2, width: W-rw-g, height: H*0.6 } },
        { slotIdx: 1, style: { ...baseStyle, left: W-rw, top: 0, width: rw, height: H } },
      ];
    } else if (layout === 'panorama') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0, top: H*0.1, width: W*0.5-g/2, height: H*0.8 } },
        { slotIdx: 1, style: { ...baseStyle, left: W*0.5+g/2, top: H*0.1, width: W*0.5-g/2, height: H*0.8 } },
      ];
    } else if (layout === 'left-3') {
      const lw = W * 0.55; const rw = W - lw - g; const rh = (H - g) / 2;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,      width: lw, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: lw+g, top: 0,      width: rw, height: rh } },
        { slotIdx: 2, style: { ...baseStyle, left: lw+g, top: rh+g,   width: rw, height: rh } },
      ];
    } else if (layout === 'right-3') {
      const rw = W * 0.55; const lw = W - rw - g; const lh = (H - g) / 2;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: lw, height: lh } },
        { slotIdx: 1, style: { ...baseStyle, left: 0,    top: lh+g, width: lw, height: lh } },
        { slotIdx: 2, style: { ...baseStyle, left: lw+g, top: 0,    width: rw, height: H } },
      ];
    } else if (layout === 'top-2-bot-1') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: w2, height: h2 } },
        { slotIdx: 1, style: { ...baseStyle, left: w2+g, top: 0,    width: w2, height: h2 } },
        { slotIdx: 2, style: { ...baseStyle, left: 0,    top: h2+g, width: W,  height: h2 } },
      ];
    } else if (layout === 'top-1-bot-2') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: W,  height: h2 } },
        { slotIdx: 1, style: { ...baseStyle, left: 0,    top: h2+g, width: w2, height: h2 } },
        { slotIdx: 2, style: { ...baseStyle, left: w2+g, top: h2+g, width: w2, height: h2 } },
      ];
    } else if (layout === 'triple-row') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,      top: 0, width: w3, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: w3+g,   top: 0, width: w3, height: H } },
        { slotIdx: 2, style: { ...baseStyle, left: (w3+g)*2, top: 0, width: w3, height: H } },
      ];
    } else if (layout === 'grid4') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: w2, height: h2 } },
        { slotIdx: 1, style: { ...baseStyle, left: w2+g, top: 0,    width: w2, height: h2 } },
        { slotIdx: 2, style: { ...baseStyle, left: 0,    top: h2+g, width: w2, height: h2 } },
        { slotIdx: 3, style: { ...baseStyle, left: w2+g, top: h2+g, width: w2, height: h2 } },
      ];
    } else if (layout === 'grid4-wide') {
      const bh = H * 0.55; const sh = H - bh - g;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: W,  height: bh } },
        { slotIdx: 1, style: { ...baseStyle, left: 0,    top: bh+g, width: w3, height: sh } },
        { slotIdx: 2, style: { ...baseStyle, left: w3+g, top: bh+g, width: w3, height: sh } },
        { slotIdx: 3, style: { ...baseStyle, left: (w3+g)*2, top: bh+g, width: w3, height: sh } },
      ];
    } else if (layout === 'l-shape-4') {
      const bw = W * 0.55; const sw = W - bw - g;
      const sh = (H - g) / 3;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,      width: bw, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: bw+g, top: 0,      width: sw, height: sh } },
        { slotIdx: 2, style: { ...baseStyle, left: bw+g, top: sh+g,   width: sw, height: sh } },
        { slotIdx: 3, style: { ...baseStyle, left: bw+g, top: (sh+g)*2, width: sw, height: sh } },
      ];
    } else if (layout === 'grid5-hero') {
      const sh = (H - g) / 2; const sw = (W - g) / 2; const bw = W * 0.55;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: bw, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: bw+g, top: 0,    width: W-bw-g, height: sh } },
        { slotIdx: 2, style: { ...baseStyle, left: bw+g, top: sh+g, width: (W-bw-g-g)/2, height: sh } },
        { slotIdx: 3, style: { ...baseStyle, left: bw+g+(W-bw-g-g)/2+g, top: sh+g, width: (W-bw-g-g)/2, height: sh } },
        { slotIdx: 4, style: { ...baseStyle, left: bw+g, top: H*0.75, width: W-bw-g, height: H*0.25 } },
      ];
    } else if (layout === 'grid5-cross') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: w2, height: h2 } },
        { slotIdx: 1, style: { ...baseStyle, left: w2+g, top: 0,    width: w2, height: h2 } },
        { slotIdx: 2, style: { ...baseStyle, left: W/2-W*0.2, top: h2*0.3, width: W*0.4, height: h2*0.4 } },
        { slotIdx: 3, style: { ...baseStyle, left: 0,    top: h2+g, width: w2, height: h2 } },
        { slotIdx: 4, style: { ...baseStyle, left: w2+g, top: h2+g, width: w2, height: h2 } },
      ];
    } else if (layout === 'grid6-2x3') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: w2, height: h3 } },
        { slotIdx: 1, style: { ...baseStyle, left: w2+g, top: 0,    width: w2, height: h3 } },
        { slotIdx: 2, style: { ...baseStyle, left: 0,    top: h3+g, width: w2, height: h3 } },
        { slotIdx: 3, style: { ...baseStyle, left: w2+g, top: h3+g, width: w2, height: h3 } },
        { slotIdx: 4, style: { ...baseStyle, left: 0,    top: (h3+g)*2, width: w2, height: h3 } },
        { slotIdx: 5, style: { ...baseStyle, left: w2+g, top: (h3+g)*2, width: w2, height: h3 } },
      ];
    } else if (layout === 'grid6-3x2') {
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,      top: 0,    width: w3, height: h2 } },
        { slotIdx: 1, style: { ...baseStyle, left: w3+g,   top: 0,    width: w3, height: h2 } },
        { slotIdx: 2, style: { ...baseStyle, left: (w3+g)*2, top: 0,    width: w3, height: h2 } },
        { slotIdx: 3, style: { ...baseStyle, left: 0,      top: h2+g, width: w3, height: h2 } },
        { slotIdx: 4, style: { ...baseStyle, left: w3+g,   top: h2+g, width: w3, height: h2 } },
        { slotIdx: 5, style: { ...baseStyle, left: (w3+g)*2, top: h2+g, width: w3, height: h2 } },
      ];
    } else if (layout === 'text-right') {
      const lw = W * 0.6;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0, width: lw, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: lw+g, top: 0, width: W-lw-g, height: H, background: '#f8f9ff' } },
      ];
    } else if (layout === 'text-left') {
      const rw = W * 0.6;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0, top: 0, width: W-rw-g, height: H, background: '#f8f9ff' } },
        { slotIdx: 1, style: { ...baseStyle, left: W-rw, top: 0, width: rw, height: H } },
      ];
    } else if (layout === 'text-only') {
      slotDefs = [{ slotIdx: 0, style: { ...baseStyle, left: 0, top: 0, width: W, height: H, background: '#f8f9ff' } }];
    }

    return (
      <div style={{ position: 'relative', width: W, height: H, background: '#e8ecf4', borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        {/* Centre spine line */}
        <div style={{ position: 'absolute', left: W/2 - 1, top: 0, width: 2, height: H, background: 'rgba(0,0,0,0.08)', zIndex: 10, pointerEvents: 'none' }} />
        {slotDefs.map(({ slotIdx, style }) => (
          <PhotoSlot key={slotIdx} spreadIdx={spreadIdx} slotIdx={slotIdx} style={style} />
        ))}
      </div>
    );
  };

  // ─── Thumbnail ───
  const Thumb = ({ spread, idx }: { spread: Spread; idx: number }) => {
    const active = idx === currentIdx;
    return (
      <button
        onClick={() => setCurrentIdx(idx)}
        style={{
          width: '100%', padding: 6, textAlign: 'center',
          border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
          borderRadius: 8, background: active ? '#f0f3ff' : '#fff',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', gap: 2, marginBottom: 4, background: '#e8ecf4', borderRadius: 3, overflow: 'hidden', height: 48 }}>
          {spread.slots.slice(0, 2).map((sl, i) => {
            const ph = getPhoto(sl.photoId);
            return (
              <div key={i} style={{
                flex: 1, height: '100%',
                background: ph ? `url(${ph.preview}) center/cover` : '#dde3f0',
              }} />
            );
          })}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#1e2d7d' : '#64748b' }}>{spread.label}</span>
      </button>
    );
  };

  // ─── Render ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6fb', fontFamily: 'var(--font-primary, sans-serif)' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, gap: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1e2d7d' }}>{config.productName || 'Фотокнига'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Розкладка фото • {photos.length} завантажено</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Auto fill */}
          <button onClick={autoFill} title="Заповнити автоматично" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e2d7d' }}>
            <Wand2 size={14} /> Авто
          </button>
          {/* Zoom */}
          <button onClick={() => setZoom(z => Math.max(30, z - 10))} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomOut size={14} /></button>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 36, textAlign: 'center' }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(120, z + 10))} style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}><ZoomIn size={14} /></button>
        </div>

        {/* Add to cart */}
        <button onClick={handleAddToCart} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(38,58,153,0.3)' }}>
          <ShoppingCart size={15} />
          Додати до кошика • {config.totalPrice} ₴
        </button>
      </div>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT PANEL */}
        <div style={{ width: 220, borderRight: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
            {([['photos', <ImageIcon size={13} />, 'Фото'], ['layouts', <LayoutGrid size={13} />, 'Шаблони']] as any[]).map(([id, icon, label]) => (
              <button key={id} onClick={() => setLeftTab(id)} style={{ flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, background: leftTab === id ? '#f0f3ff' : '#fff', color: leftTab === id ? '#1e2d7d' : '#64748b', borderBottom: leftTab === id ? '2px solid #1e2d7d' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {icon} {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
            {leftTab === 'photos' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {photos.map((photo, i) => {
                  const used = usedIds.has(photo.id);
                  return (
                    <div key={photo.id} draggable={!used} onDragStart={() => !used && onDragStart(photo.id)} onDragEnd={onDragEnd} style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', cursor: used ? 'default' : 'grab', opacity: used ? 0.4 : 1, border: '1px solid #e2e8f0' }}>
                      <img src={photo.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                      {used && <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</div>}
                      <span style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Layouts panel */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['1 фото','2 фото','3 фото','4 фото','5 фото','6 фото','Текст'].map(group => {
                  const groupLayouts = LAYOUTS.filter(l => l.group === group);
                  return (
                    <div key={group}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', padding: '8px 4px 4px', textTransform: 'uppercase' }}>{group}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {groupLayouts.map(l => {
                          const active = currentSpread?.layout === l.id;
                          return (
                            <button key={l.id} onClick={() => changeLayout(l.id)} title={l.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 4px', border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: active ? '#f0f3ff' : '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: active ? '#1e2d7d' : '#374151' }}>
                              <LayoutPreview layout={l.id} active={active} />
                              <span style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.2 }}>{l.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
                  <button onClick={resetSpread} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff7f7', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#ef4444', width: '100%' }}>
                    <RotateCcw size={13} /> Очистити розворот
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER CANVAS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 32, background: '#f4f6fb' }}>
          {/* Spread label */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} style={{ background: 'none', border: 'none', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer', opacity: currentIdx === 0 ? 0.3 : 1, color: '#1e2d7d' }}><ChevronLeft size={20} /></button>
            <span>{currentSpread?.label}</span>
            <button onClick={() => setCurrentIdx(i => Math.min(spreads.length - 1, i + 1))} disabled={currentIdx === spreads.length - 1} style={{ background: 'none', border: 'none', cursor: currentIdx === spreads.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIdx === spreads.length - 1 ? 0.3 : 1, color: '#1e2d7d' }}><ChevronRight size={20} /></button>
          </div>

          <SpreadCanvas spreadIdx={currentIdx} />

          <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
            Затисніть фото і перетягніть для зміни кадрування
          </div>
        </div>

        {/* RIGHT PANEL: Thumbnails */}
        <div style={{ width: 180, borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e2d7d' }}>Розвороти</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{spreads.length}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {spreads.map((spread, idx) => <Thumb key={spread.id} spread={spread} idx={idx} />)}
          </div>
        </div>

      </div>
    </div>
  );
}
