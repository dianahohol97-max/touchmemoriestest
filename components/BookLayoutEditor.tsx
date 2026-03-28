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
  | 'full'        // 1 photo fills entire spread
  | 'half-half'   // 2 photos side by side
  | 'top-bottom'  // 2 photos top/bottom
  | 'left-3'      // 1 big left + 2 small right
  | 'grid4'       // 4 equal photos
  | 'text-right'  // photo left + text right
  | 'text-left';  // text left + photo right

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

const LAYOUTS: { id: LayoutType; label: string; slots: number; icon: string }[] = [
  { id: 'full',       label: '1 фото',        slots: 1, icon: '⬛' },
  { id: 'half-half',  label: '2 поруч',       slots: 2, icon: '◧◨' },
  { id: 'top-bottom', label: '2 зверху/знизу', slots: 2, icon: '⬒' },
  { id: 'left-3',     label: '1+2',           slots: 3, icon: '▣' },
  { id: 'grid4',      label: '4 фото',        slots: 4, icon: '⊞' },
  { id: 'text-right', label: 'Фото+текст',    slots: 2, icon: '▤' },
];

function makeSlots(count: number): SlotData[] {
  return Array.from({ length: count }, () => ({ photoId: null, cropX: 50, cropY: 50 }));
}

const SPREAD_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '20×20': { width: 400, height: 200 },
  '25×25': { width: 500, height: 250 },
  '20×30': { width: 420, height: 300 },
  '30×20': { width: 600, height: 200 },
  '30×30': { width: 600, height: 300 },
  'A4':    { width: 420, height: 297 },
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
  const dims = config?.selectedSize
    ? SPREAD_DIMENSIONS[config.selectedSize.replace(/[хxX]/g, '×')] || SPREAD_DIMENSIONS['A4']
    : SPREAD_DIMENSIONS['A4'];
  const scale = zoom / 100;
  const canvasW = dims.width * scale * 2;
  const canvasH = dims.height * scale;
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

    if (layout === 'full') {
      slotDefs = [{ slotIdx: 0, style: { ...baseStyle, left: 0, top: 0, width: W, height: H } }];
    } else if (layout === 'half-half') {
      const w = (W - gap) / 2;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0, width: w, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: w+gap, top: 0, width: w, height: H } },
      ];
    } else if (layout === 'top-bottom') {
      const h = (H - gap) / 2;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0, top: 0,    width: W, height: h } },
        { slotIdx: 1, style: { ...baseStyle, left: 0, top: h+gap, width: W, height: h } },
      ];
    } else if (layout === 'left-3') {
      const lw = W * 0.55; const rw = W - lw - gap;
      const rh = (H - gap) / 2;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,      top: 0,      width: lw, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: lw+gap, top: 0,      width: rw, height: rh } },
        { slotIdx: 2, style: { ...baseStyle, left: lw+gap, top: rh+gap, width: rw, height: rh } },
      ];
    } else if (layout === 'grid4') {
      const w = (W - gap) / 2; const h = (H - gap) / 2;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,    top: 0,    width: w, height: h } },
        { slotIdx: 1, style: { ...baseStyle, left: w+gap, top: 0,    width: w, height: h } },
        { slotIdx: 2, style: { ...baseStyle, left: 0,    top: h+gap, width: w, height: h } },
        { slotIdx: 3, style: { ...baseStyle, left: w+gap, top: h+gap, width: w, height: h } },
      ];
    } else if (layout === 'text-right') {
      const lw = W * 0.6;
      slotDefs = [
        { slotIdx: 0, style: { ...baseStyle, left: 0,      top: 0, width: lw, height: H } },
        { slotIdx: 1, style: { ...baseStyle, left: lw+gap, top: 0, width: W-lw-gap, height: H, background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      ];
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>ПОТОЧНИЙ РОЗВОРОТ</div>
                {LAYOUTS.map(l => {
                  const active = currentSpread?.layout === l.id;
                  return (
                    <button key={l.id} onClick={() => changeLayout(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 8, background: active ? '#f0f3ff' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: active ? '#1e2d7d' : '#374151', textAlign: 'left' }}>
                      <span style={{ fontSize: 18 }}>{l.icon}</span>
                      <span>{l.label}</span>
                      {active && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#1e2d7d' }}>✓</span>}
                    </button>
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
