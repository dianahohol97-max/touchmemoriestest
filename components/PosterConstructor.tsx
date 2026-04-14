'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, Plus, Trash2, Type, ChevronLeft, ChevronRight, ShoppingCart, RotateCcw, Move, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { FONT_GROUPS, GOOGLE_FONTS_URL } from '@/lib/editor/constants';
import { exportCanvasAt300DPI, uploadOrderFile } from '@/lib/export-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhotoSlot {
  id: string;
  photoUrl: string;
  cropX: number;
  cropY: number;
  zoom: number;
  rotation: number;
}

interface TextBlock {
  id: string;
  text: string;
  x: number; // % of poster width
  y: number; // % of poster height
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  letterSpacing: number;
}

interface PosterConfig {
  // Photos
  photos: PhotoSlot[];
  // Layout
  layoutId: string;
  // Design
  bgColor: string;
  frameStyle: 'none' | 'thin' | 'thick' | 'double' | 'rounded';
  frameColor: string;
  padding: number; // px
  // Text
  textBlocks: TextBlock[];
  // Size
  size: 'a4' | 'a3' | '30x40' | '40x50' | '50x70';
}

interface Layout {
  id: string;
  name: string;
  slots: number;
  preview: React.ReactNode;
  getSlots: (W: number, H: number, pad: number) => { x: number; y: number; w: number; h: number }[];
}

// ── Layouts ───────────────────────────────────────────────────────────────────

const LAYOUTS: Layout[] = [
  {
    id: 'single',
    name: '1 фото',
    slots: 1,
    preview: <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:2, width:'100%', height:'100%' }}><div style={{ background:'#c7d2fe', borderRadius:2 }}/></div>,
    getSlots: (W, H, p) => [{ x:p, y:p, w:W-2*p, h:H-2*p }],
  },
  {
    id: 'two-h',
    name: '2 горизонт.',
    slots: 2,
    preview: <div style={{ display:'grid', gridTemplateRows:'1fr 1fr', gap:2, width:'100%', height:'100%' }}>{[0,1].map(i=><div key={i} style={{ background:'#c7d2fe', borderRadius:2 }}/>)}</div>,
    getSlots: (W, H, p) => { const g=4; const h=(H-2*p-g)/2; return [{x:p,y:p,w:W-2*p,h},{x:p,y:p+h+g,w:W-2*p,h}]; },
  },
  {
    id: 'two-v',
    name: '2 вертик.',
    slots: 2,
    preview: <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, width:'100%', height:'100%' }}>{[0,1].map(i=><div key={i} style={{ background:'#c7d2fe', borderRadius:2 }}/>)}</div>,
    getSlots: (W, H, p) => { const g=4; const w=(W-2*p-g)/2; return [{x:p,y:p,w,h:H-2*p},{x:p+w+g,y:p,w,h:H-2*p}]; },
  },
  {
    id: 'three-top',
    name: '3 (1+2)',
    slots: 3,
    preview: <div style={{ display:'grid', gridTemplateRows:'1.2fr 1fr', gap:2, width:'100%', height:'100%' }}><div style={{ background:'#c7d2fe', borderRadius:2 }}/><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2 }}>{[0,1].map(i=><div key={i} style={{ background:'#a5b4fc', borderRadius:2 }}/>)}</div></div>,
    getSlots: (W, H, p) => { const g=4; const topH=Math.round((H-2*p-g)*0.55); const botH=H-2*p-g-topH; const w=(W-2*p-g)/2; return [{x:p,y:p,w:W-2*p,h:topH},{x:p,y:p+topH+g,w,h:botH},{x:p+w+g,y:p+topH+g,w,h:botH}]; },
  },
  {
    id: 'three-bot',
    name: '3 (2+1)',
    slots: 3,
    preview: <div style={{ display:'grid', gridTemplateRows:'1fr 1.2fr', gap:2, width:'100%', height:'100%' }}><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2 }}>{[0,1].map(i=><div key={i} style={{ background:'#a5b4fc', borderRadius:2 }}/>)}</div><div style={{ background:'#c7d2fe', borderRadius:2 }}/></div>,
    getSlots: (W, H, p) => { const g=4; const botH=Math.round((H-2*p-g)*0.55); const topH=H-2*p-g-botH; const w=(W-2*p-g)/2; return [{x:p,y:p,w,h:topH},{x:p+w+g,y:p,w,h:topH},{x:p,y:p+topH+g,w:W-2*p,h:botH}]; },
  },
  {
    id: 'four-grid',
    name: '4 сітка',
    slots: 4,
    preview: <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:2, width:'100%', height:'100%' }}>{[0,1,2,3].map(i=><div key={i} style={{ background:'#c7d2fe', borderRadius:2 }}/>)}</div>,
    getSlots: (W, H, p) => { const g=4; const w=(W-2*p-g)/2; const h=(H-2*p-g)/2; return [{x:p,y:p,w,h},{x:p+w+g,y:p,w,h},{x:p,y:p+h+g,w,h},{x:p+w+g,y:p+h+g,w,h}]; },
  },
  {
    id: 'four-left',
    name: '4 (1+3)',
    slots: 4,
    preview: <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:2, width:'100%', height:'100%' }}><div style={{ background:'#c7d2fe', borderRadius:2 }}/><div style={{ display:'grid', gridTemplateRows:'1fr 1fr 1fr', gap:2 }}>{[0,1,2].map(i=><div key={i} style={{ background:'#a5b4fc', borderRadius:2 }}/>)}</div></div>,
    getSlots: (W, H, p) => { const g=4; const leftW=Math.round((W-2*p-g)*0.6); const rightW=W-2*p-g-leftW; const rh=(H-2*p-2*g)/3; return [{x:p,y:p,w:leftW,h:H-2*p},{x:p+leftW+g,y:p,w:rightW,h:rh},{x:p+leftW+g,y:p+rh+g,w:rightW,h:rh},{x:p+leftW+g,y:p+2*(rh+g),w:rightW,h:rh}]; },
  },
  {
    id: 'six-grid',
    name: '6 сітка',
    slots: 6,
    preview: <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'1fr 1fr', gap:2, width:'100%', height:'100%' }}>{[0,1,2,3,4,5].map(i=><div key={i} style={{ background:'#c7d2fe', borderRadius:2 }}/>)}</div>,
    getSlots: (W, H, p) => { const g=4; const w=(W-2*p-2*g)/3; const h=(H-2*p-g)/2; return Array.from({length:6},(_,i)=>({x:p+(i%3)*(w+g),y:p+Math.floor(i/3)*(h+g),w,h})); },
  },
  {
    id: 'panorama',
    name: 'Панорама',
    slots: 1,
    preview: <div style={{ display:'grid', gridTemplateRows:'1fr', gap:2, width:'100%', height:'100%' }}><div style={{ background:'#c7d2fe', borderRadius:2 }}/></div>,
    getSlots: (W, H, p) => [{ x:p, y:p, w:W-2*p, h:H-2*p }],
  },
  {
    id: 'triptych',
    name: 'Триптих',
    slots: 3,
    preview: <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 1fr', gap:2, width:'100%', height:'100%' }}>{[0,1,2].map(i=><div key={i} style={{ background: i===1?'#818cf8':'#c7d2fe', borderRadius:2 }}/>)}</div>,
    getSlots: (W, H, p) => { const g=4; const side=Math.round((W-2*p-2*g)*0.28); const mid=W-2*p-2*g-2*side; return [{x:p,y:p,w:side,h:H-2*p},{x:p+side+g,y:p,w:mid,h:H-2*p},{x:p+side+g+mid+g,y:p,w:side,h:H-2*p}]; },
  },
];

// ── Size definitions ──────────────────────────────────────────────────────────

const SIZES = [
  { id: 'a4',    label: 'A4 (21×30)',  price: 350, ratio: 21/30  },
  { id: 'a3',    label: 'A3 (30×42)',  price: 450, ratio: 30/42  },
  { id: '30x40', label: '30×40 см',   price: 500, ratio: 30/40  },
  { id: '40x50', label: '40×50 см',   price: 650, ratio: 40/50  },
  { id: '50x70', label: '50×70 см',   price: 850, ratio: 50/70  },
];

const FRAME_STYLES = [
  { id: 'none',    label: 'Без рамки' },
  { id: 'thin',    label: 'Тонка' },
  { id: 'thick',   label: 'Товста' },
  { id: 'double',  label: 'Подвійна' },
  { id: 'rounded', label: 'Округла' },
];

const BG_PRESETS = ['#ffffff','#f8f4f0','#f0f3ff','#0a0e1a','#1e2d7d','#111111','#fef3c7','#fce7f3','#f0fdf4','#f5f0e8','#1a1a2e','#e8e0d8'];

// ── Helper: Poster Canvas ────────────────────────────────────────────────────

function PosterPreview({ config, canvasRef, W }: { config: PosterConfig; canvasRef: React.RefObject<HTMLCanvasElement | null>; W: number }) {
  const sizeObj = SIZES.find(s => s.id === config.size) || SIZES[0];
  const H = Math.round(W / sizeObj.ratio);
  const layout = LAYOUTS.find(l => l.id === config.layoutId) || LAYOUTS[0];
  const slots = layout.getSlots(W, H, config.padding);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, W, H);

    // Frame
    if (config.frameStyle !== 'none') {
      ctx.save();
      const fw = config.frameStyle === 'thick' ? 8 : config.frameStyle === 'double' ? 3 : 4;
      ctx.strokeStyle = config.frameColor;
      ctx.lineWidth = fw;
      if (config.frameStyle === 'rounded') {
        const r = 12;
        ctx.beginPath(); ctx.roundRect(fw/2, fw/2, W-fw, H-fw, r); ctx.stroke();
      } else {
        ctx.strokeRect(fw/2, fw/2, W-fw, H-fw);
      }
      if (config.frameStyle === 'double') {
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, 10, W-20, H-20);
      }
      ctx.restore();
    }

    // Draw photo slots
    const drawPromises = slots.map((slot, i) => {
      const photo = config.photos[i];
      if (!photo?.photoUrl) {
        // Empty slot placeholder
        ctx.save();
        ctx.fillStyle = 'rgba(200,210,255,0.25)';
        ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
        ctx.strokeStyle = 'rgba(100,130,220,0.4)';
        ctx.setLineDash([6,4]);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
        ctx.setLineDash([]);
        // Icon
        ctx.fillStyle = 'rgba(100,130,220,0.5)';
        ctx.font = `${Math.round(slot.w*0.15)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', slot.x + slot.w/2, slot.y + slot.h/2);
        ctx.restore();
        return Promise.resolve();
      }
      return new Promise<void>(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.rect(slot.x, slot.y, slot.w, slot.h);
          ctx.clip();
          // Calculate zoom and crop
          const zoom = photo.zoom || 1;
          const imgAspect = img.width / img.height;
          const slotAspect = slot.w / slot.h;
          let dw, dh;
          if (imgAspect > slotAspect) {
            dh = slot.h * zoom;
            dw = dh * imgAspect;
          } else {
            dw = slot.w * zoom;
            dh = dw / imgAspect;
          }
          const dx = slot.x + (slot.w - dw) * (photo.cropX / 100);
          const dy = slot.y + (slot.h - dh) * (photo.cropY / 100);
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = photo.photoUrl;
      });
    });

    Promise.all(drawPromises).then(() => {
      // Draw text blocks
      config.textBlocks.forEach(tb => {
        ctx.save();
        const fs = Math.round(tb.fontSize * (W / 600));
        ctx.font = `${tb.italic ? 'italic ' : ''}${tb.bold ? 'bold ' : ''}${fs}px '${tb.fontFamily}', sans-serif`;
        ctx.fillStyle = tb.color;
        ctx.textAlign = tb.align;
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = `${tb.letterSpacing}px`;
        const tx = (tb.x / 100) * W;
        const ty = (tb.y / 100) * H;
        ctx.fillText(tb.text, tx, ty);
        ctx.restore();
      });
    });
  }, [config, W, H]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
    />
  );
}

// ── Slot Photo Editor (crop/zoom) ─────────────────────────────────────────────

function PhotoSlotEditor({
  slot, index, onUpdate, onDelete,
  slotRect, // normalized slot rect (% of poster)
}: {
  slot: PhotoSlot; index: number;
  onUpdate: (id: string, updates: Partial<PhotoSlot>) => void;
  onDelete: (id: string) => void;
  slotRect: { x: number; y: number; w: number; h: number };
}) {
  return (
    <div style={{ padding:'10px 12px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>Фото {index+1}</span>
        <button onClick={() => onDelete(slot.id)} style={{ background:'#fee2e2', border:'none', borderRadius:6, padding:'3px 7px', cursor:'pointer', color:'#ef4444', fontSize:11, fontWeight:700 }}>✕ Видалити</button>
      </div>
      <img src={slot.photoUrl} style={{ width:'100%', height:80, objectFit:'cover', borderRadius:6, marginBottom:8 }} />
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'#64748b', width:32 }}>Zoom</span>
          <input type="range" min={100} max={300} value={Math.round((slot.zoom||1)*100)}
            onChange={e => onUpdate(slot.id, { zoom: +e.target.value/100 })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
          <span style={{ fontSize:10, color:'#475569', width:30 }}>{Math.round((slot.zoom||1)*100)}%</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'#64748b', width:32 }}>← →</span>
          <input type="range" min={0} max={100} value={slot.cropX||50}
            onChange={e => onUpdate(slot.id, { cropX: +e.target.value })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'#64748b', width:32 }}>↑ ↓</span>
          <input type="range" min={0} max={100} value={slot.cropY||50}
            onChange={e => onUpdate(slot.id, { cropY: +e.target.value })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
        </div>
      </div>
    </div>
  );
}

// ── Text Block Editor ─────────────────────────────────────────────────────────

function TextBlockEditor({ block, onUpdate, onDelete }: {
  block: TextBlock;
  onUpdate: (id: string, updates: Partial<TextBlock>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ padding:'10px 12px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:11, color:'#94a3b8', fontFamily: block.fontFamily }}>{block.text.slice(0,20) || 'Новий текст'}</span>
        <button onClick={() => onDelete(block.id)} style={{ background:'#fee2e2', border:'none', borderRadius:6, padding:'3px 7px', cursor:'pointer', color:'#ef4444', fontSize:11, fontWeight:700 }}>✕</button>
      </div>
      <input type="text" value={block.text}
        onChange={e => onUpdate(block.id, { text: e.target.value })}
        style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:13, marginBottom:8, boxSizing:'border-box' }}
        placeholder="Текст напису..." />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
        {/* Font */}
        <select value={block.fontFamily} onChange={e => onUpdate(block.id, { fontFamily: e.target.value })}
          style={{ padding:'5px 8px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:11, fontFamily: block.fontFamily }}>
          {FONT_GROUPS.map(g => (
            <optgroup key={g.group} label={g.group}>
              {g.fonts.map(f => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          ))}
        </select>
        {/* Color */}
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <input type="color" value={block.color} onChange={e => onUpdate(block.id, { color: e.target.value })}
            style={{ width:32, height:32, border:'1px solid #e2e8f0', borderRadius:6, cursor:'pointer', padding:2 }}/>
          <input type="number" min={8} max={120} value={block.fontSize}
            onChange={e => onUpdate(block.id, { fontSize: +e.target.value })}
            style={{ flex:1, padding:'5px 8px', border:'1px solid #e2e8f0', borderRadius:7, fontSize:11, textAlign:'center' }}/>
          <span style={{ fontSize:10, color:'#94a3b8' }}>px</span>
        </div>
      </div>
      {/* Position */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ fontSize:9, color:'#94a3b8', width:12 }}>X</span>
          <input type="range" min={5} max={95} value={block.x} onChange={e => onUpdate(block.id, { x: +e.target.value })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
          <span style={{ fontSize:9, color:'#475569', width:20 }}>{block.x}%</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ fontSize:9, color:'#94a3b8', width:12 }}>Y</span>
          <input type="range" min={2} max={98} value={block.y} onChange={e => onUpdate(block.id, { y: +e.target.value })}
            style={{ flex:1, accentColor:'#1e2d7d' }}/>
          <span style={{ fontSize:9, color:'#475569', width:20 }}>{block.y}%</span>
        </div>
      </div>
      {/* Alignment + style */}
      <div style={{ display:'flex', gap:4 }}>
        {(['left','center','right'] as const).map(a => (
          <button key={a} onClick={() => onUpdate(block.id, { align: a })}
            style={{ flex:1, padding:'4px', border: block.align===a ? '2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background: block.align===a?'#f0f3ff':'#fff', cursor:'pointer', fontSize:14 }}>
            {a==='left'?'⬅':a==='center'?'⬆':'➡'}
          </button>
        ))}
        <button onClick={() => onUpdate(block.id, { bold: !block.bold })}
          style={{ flex:1, padding:'4px', border: block.bold?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background: block.bold?'#f0f3ff':'#fff', cursor:'pointer', fontWeight:900, fontSize:12 }}>B</button>
        <button onClick={() => onUpdate(block.id, { italic: !block.italic })}
          style={{ flex:1, padding:'4px', border: block.italic?'2px solid #1e2d7d':'1px solid #e2e8f0', borderRadius:6, background: block.italic?'#f0f3ff':'#fff', cursor:'pointer', fontStyle:'italic', fontSize:12 }}>I</button>
      </div>
    </div>
  );
}

// ── Main Constructor ──────────────────────────────────────────────────────────

export default function PosterConstructor() {
  const router = useRouter();
  const { addItem } = useCartStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSlotUpload, setActiveSlotUpload] = useState<number | null>(null);
  const [step, setStep] = useState<'layout' | 'photos' | 'design' | 'text' | 'size'>('layout');
  const [isOrdering, setIsOrdering] = useState(false);

  const [config, setConfig] = useState<PosterConfig>({
    photos: [],
    layoutId: 'single',
    bgColor: '#ffffff',
    frameStyle: 'thin',
    frameColor: '#1a1a1a',
    padding: 20,
    textBlocks: [],
    size: 'a4',
  });

  const layout = LAYOUTS.find(l => l.id === config.layoutId) || LAYOUTS[0];
  const sizeObj = SIZES.find(s => s.id === config.size) || SIZES[0];

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  // ── Photo management ──────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPhotos: PhotoSlot[] = [];
    let loaded = 0;
    files.slice(0, layout.slots - config.photos.length).forEach(file => {
      const url = URL.createObjectURL(file);
      newPhotos.push({ id: `photo-${Date.now()}-${Math.random()}`, photoUrl: url, cropX: 50, cropY: 50, zoom: 1, rotation: 0 });
      loaded++;
      if (loaded === files.length || loaded === layout.slots - config.photos.length) {
        setConfig(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updatePhoto = (id: string, updates: Partial<PhotoSlot>) => {
    setConfig(prev => ({ ...prev, photos: prev.photos.map(p => p.id === id ? { ...p, ...updates } : p) }));
  };

  const deletePhoto = (id: string) => {
    setConfig(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  };

  // ── Text management ───────────────────────────────────────────────────────
  const addTextBlock = () => {
    setConfig(prev => ({ ...prev, textBlocks: [...prev.textBlocks, {
      id: `txt-${Date.now()}`, text: 'Ваш текст', x: 50, y: 90,
      fontSize: 24, fontFamily: 'Playfair Display', color: '#1a1a1a',
      align: 'center', bold: false, italic: false, letterSpacing: 1,
    }]}));
  };

  const updateTextBlock = (id: string, updates: Partial<TextBlock>) => {
    setConfig(prev => ({ ...prev, textBlocks: prev.textBlocks.map(t => t.id === id ? { ...t, ...updates } : t) }));
  };

  const deleteTextBlock = (id: string) => {
    setConfig(prev => ({ ...prev, textBlocks: prev.textBlocks.filter(t => t.id !== id) }));
  };

  // ── Layout change ─────────────────────────────────────────────────────────
  const changeLayout = (layoutId: string) => {
    const newLayout = LAYOUTS.find(l => l.id === layoutId)!;
    setConfig(prev => ({
      ...prev,
      layoutId,
      photos: prev.photos.slice(0, newLayout.slots),
    }));
  };

  // ── Order ────────────────────────────────────────────────────────────────
  const handleOrder = async () => {
    if (config.photos.length === 0) { toast.error('Додайте хоча б одне фото'); return; }
    setIsOrdering(true);
    try {
      let fileUrl = '';
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          const blob = await exportCanvasAt300DPI(canvas);
          const filePath = `poster-${Date.now()}.png`;
          const uploadResult = await uploadOrderFile('poster-exports', filePath, blob); fileUrl = uploadResult.url;
        } catch {}
      }

      addItem({
        id: `poster-${Date.now()}`,
        name: `Постер ${sizeObj.label}`,
        price: sizeObj.price,
        qty: 1,
        image: config.photos[0]?.photoUrl || '',
        options: {
          'Розмір': sizeObj.label,
          'Макет': layout.name,
          'Рамка': config.frameStyle,
        },
        personalization_note: fileUrl ? `Файл: ${fileUrl}` : `Макет: ${layout.name}`,
      });
      toast.success('✅ Постер додано до кошика!');
      router.push('/cart');
    } catch (err) {
      toast.error('Помилка при оформленні');
    } finally {
      setIsOrdering(false);
    }
  };

  // ── Preview width ─────────────────────────────────────────────────────────
  const PREVIEW_W = 480;

  // ── Render ────────────────────────────────────────────────────────────────
  const steps = [
    { id: 'layout', label: '1. Макет' },
    { id: 'photos', label: '2. Фото' },
    { id: 'design', label: '3. Дизайн' },
    { id: 'text',   label: '4. Текст' },
    { id: 'size',   label: '5. Розмір' },
  ];

  return (
    <div style={{ display:'flex', gap:0, minHeight:'80vh', fontFamily:'var(--font-primary, sans-serif)' }}>
      {/* ── LEFT: Steps + Controls ── */}
      <div style={{ width:360, flexShrink:0, background:'#fff', borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column' }}>
        {/* Step tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', overflowX:'auto' }}>
          {steps.map(s => (
            <button key={s.id} onClick={() => setStep(s.id as any)}
              style={{ flex:1, padding:'12px 4px', border:'none', background: step===s.id ? '#f0f3ff' : 'transparent',
                color: step===s.id ? '#1e2d7d' : '#64748b', fontWeight: step===s.id ? 800 : 500,
                fontSize:11, cursor:'pointer', borderBottom: step===s.id ? '3px solid #1e2d7d' : '3px solid transparent',
                transition:'all 0.15s', whiteSpace:'nowrap' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>

          {/* ── STEP 1: Layout ── */}
          {step === 'layout' && (
            <div>
              <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:4 }}>Оберіть макет</h3>
              <p style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Як розміщувати фотографії на постері</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {LAYOUTS.map(l => {
                  const isActive = config.layoutId === l.id;
                  return (
                    <button key={l.id} onClick={() => changeLayout(l.id)}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'10px 8px',
                        border: isActive ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius:10, background: isActive ? '#f0f3ff' : '#fff',
                        cursor:'pointer', transition:'all 0.15s' }}>
                      <div style={{ width:'100%', height:60, padding:4 }}>{l.preview}</div>
                      <span style={{ fontSize:11, fontWeight:700, color: isActive ? '#1e2d7d' : '#374151' }}>{l.name}</span>
                      <span style={{ fontSize:9, color:'#94a3b8' }}>{l.slots} {l.slots===1?'фото':'фото'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 2: Photos ── */}
          {step === 'photos' && (
            <div>
              <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:4 }}>Додати фото</h3>
              <p style={{ fontSize:12, color:'#94a3b8', marginBottom:12 }}>Макет "{layout.name}" — {layout.slots} фото</p>

              {config.photos.length < layout.slots && (
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ width:'100%', padding:'14px', border:'2px dashed #c7d2fe', borderRadius:10,
                    background:'#f8faff', color:'#1e2d7d', fontWeight:700, fontSize:13,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12 }}>
                  <Upload size={16}/> Завантажити фото ({config.photos.length}/{layout.slots})
                </button>
              )}
              <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display:'none' }} onChange={handleFileSelect} />

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {config.photos.map((photo, i) => {
                  const sizeObj2 = SIZES.find(s => s.id === config.size) || SIZES[0];
                  const posterH = PREVIEW_W / sizeObj2.ratio;
                  const slots = layout.getSlots(PREVIEW_W, posterH, config.padding);
                  const sl = slots[i] || slots[0];
                  return (
                    <PhotoSlotEditor key={photo.id} slot={photo} index={i}
                      onUpdate={updatePhoto} onDelete={deletePhoto}
                      slotRect={{ x: sl.x/PREVIEW_W*100, y: sl.y/posterH*100, w: sl.w/PREVIEW_W*100, h: sl.h/posterH*100 }}
                    />
                  );
                })}
              </div>

              {config.photos.length === 0 && (
                <div style={{ textAlign:'center', padding:'32px 16px', color:'#94a3b8' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📷</div>
                  <div style={{ fontSize:13 }}>Натисніть кнопку вище щоб додати фото</div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Design ── */}
          {step === 'design' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', margin:0 }}>Дизайн</h3>

              {/* Background */}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Фон постера</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                  {BG_PRESETS.map(c => (
                    <button key={c} onClick={() => setConfig(p => ({ ...p, bgColor: c }))}
                      style={{ width:28, height:28, borderRadius:6, background:c, border: config.bgColor===c ? '3px solid #1e2d7d' : '1.5px solid #e2e8f0', cursor:'pointer', flexShrink:0 }}/>
                  ))}
                </div>
                <input type="color" value={config.bgColor} onChange={e => setConfig(p => ({ ...p, bgColor: e.target.value }))}
                  style={{ width:'100%', height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', padding:2 }}/>
              </div>

              {/* Frame style */}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Рамка</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                  {FRAME_STYLES.map(f => (
                    <button key={f.id} onClick={() => setConfig(p => ({ ...p, frameStyle: f.id as any }))}
                      style={{ padding:'7px 4px', border: config.frameStyle===f.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                        borderRadius:8, background: config.frameStyle===f.id ? '#f0f3ff' : '#fff',
                        cursor:'pointer', fontSize:10, fontWeight:700, color: config.frameStyle===f.id ? '#1e2d7d' : '#374151' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame color */}
              {config.frameStyle !== 'none' && (
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Колір рамки</label>
                  <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                    {['#1a1a1a','#ffffff','#1e2d7d','#b8860b','#8b0000','#2d5a27'].map(c => (
                      <button key={c} onClick={() => setConfig(p => ({ ...p, frameColor: c }))}
                        style={{ width:28, height:28, borderRadius:6, background:c, border: config.frameColor===c ? '3px solid #1e2d7d' : '1.5px solid #e2e8f0', cursor:'pointer' }}/>
                    ))}
                  </div>
                  <input type="color" value={config.frameColor} onChange={e => setConfig(p => ({ ...p, frameColor: e.target.value }))}
                    style={{ width:'100%', height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', padding:2 }}/>
                </div>
              )}

              {/* Padding */}
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>
                  Відступ від краю: {config.padding}px
                </label>
                <input type="range" min={0} max={60} value={config.padding}
                  onChange={e => setConfig(p => ({ ...p, padding: +e.target.value }))}
                  style={{ width:'100%', accentColor:'#1e2d7d' }}/>
              </div>
            </div>
          )}

          {/* ── STEP 4: Text ── */}
          {step === 'text' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', margin:0 }}>Написи</h3>
                <button onClick={addTextBlock}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                  <Plus size={14}/> Додати
                </button>
              </div>

              {config.textBlocks.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 16px', color:'#94a3b8' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✍️</div>
                  <div style={{ fontSize:13 }}>Натисніть "Додати" щоб додати напис</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {config.textBlocks.map(tb => (
                    <TextBlockEditor key={tb.id} block={tb} onUpdate={updateTextBlock} onDelete={deleteTextBlock} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 5: Size ── */}
          {step === 'size' && (
            <div>
              <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:4 }}>Розмір постера</h3>
              <p style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Вибір впливає на ціну</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:24 }}>
                {SIZES.map(s => (
                  <button key={s.id} onClick={() => setConfig(p => ({ ...p, size: s.id as any }))}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px',
                      border: config.size===s.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                      borderRadius:10, background: config.size===s.id ? '#f0f3ff' : '#fff', cursor:'pointer' }}>
                    <span style={{ fontWeight:700, fontSize:14, color: config.size===s.id ? '#1e2d7d' : '#374151' }}>{s.label}</span>
                    <span style={{ fontWeight:800, fontSize:16, color: config.size===s.id ? '#1e2d7d' : '#374151' }}>{s.price} ₴</span>
                  </button>
                ))}
              </div>

              {/* Order summary */}
              <div style={{ background:'#f0f3ff', borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>Ваше замовлення:</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, color:'#374151' }}>Постер {sizeObj.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1e2d7d' }}>{sizeObj.price} ₴</span>
                </div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Макет: {layout.name} · {config.photos.length} фото</div>
              </div>

              <button onClick={handleOrder} disabled={isOrdering || config.photos.length === 0}
                style={{ width:'100%', padding:'14px', background: config.photos.length === 0 ? '#e2e8f0' : '#1e2d7d',
                  color: config.photos.length === 0 ? '#94a3b8' : '#fff',
                  border:'none', borderRadius:12, fontWeight:800, fontSize:15, cursor: config.photos.length === 0 ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow: config.photos.length > 0 ? '0 4px 20px rgba(30,45,125,0.3)' : 'none' }}>
                <ShoppingCart size={18}/>
                {isOrdering ? 'Оформлюємо...' : config.photos.length === 0 ? 'Спочатку додайте фото' : `Замовити за ${sizeObj.price} ₴`}
              </button>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between' }}>
          <button onClick={() => { const idx = steps.findIndex(s => s.id === step); if (idx > 0) setStep(steps[idx-1].id as any); }}
            disabled={step === 'layout'}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor: step==='layout'?'not-allowed':'pointer', color: step==='layout'?'#cbd5e1':'#374151', fontWeight:600, fontSize:13 }}>
            <ChevronLeft size={14}/> Назад
          </button>
          {step !== 'size' && (
            <button onClick={() => { const idx = steps.findIndex(s => s.id === step); if (idx < steps.length-1) setStep(steps[idx+1].id as any); }}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 14px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
              Далі <ChevronRight size={14}/>
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT: Live Preview ── */}
      <div style={{ flex:1, background:'#f4f6fb', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'32px 24px', gap:16, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase' }}>
          Попередній перегляд — {sizeObj.label}
        </div>
        <div style={{ width:'100%', maxWidth:PREVIEW_W }}>
          <PosterPreview config={config} canvasRef={canvasRef} W={PREVIEW_W} />
        </div>
        <div style={{ fontSize:11, color:'#94a3b8', textAlign:'center' }}>
          Друк на щільному папері 200г/м² · Формат {sizeObj.label} · {sizeObj.price} ₴
        </div>
      </div>
    </div>
  );
}
