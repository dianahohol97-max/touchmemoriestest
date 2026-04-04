'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PhotoSlot {
  x: number; y: number; w: number; h: number; // % of canvas
  photoId: string | null;
  cropX: number; cropY: number; zoom: number;
}

interface TextBlock {
  id: string;
  text: string;
  x: number; y: number; // % of canvas
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  align: 'left' | 'center' | 'right';
}

interface PosterTemplate {
  id: string;
  label: string;
  bgColor: string;
  slots: Omit<PhotoSlot, 'photoId' | 'cropX' | 'cropY' | 'zoom'>[];
  texts: Omit<TextBlock, 'id'>[];
}

interface Photo {
  id: string;
  preview: string;
  name: string;
}

// ─── Poster templates ─────────────────────────────────────────────────────────

const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    id: 'baby-newborn',
    label: 'Новонароджений',
    bgColor: '#ffffff',
    slots: [
      { x: 2,  y: 2,  w: 23, h: 37 },
      { x: 27, y: 2,  w: 23, h: 37 },
      { x: 52, y: 2,  w: 23, h: 37 },
      { x: 77, y: 2,  w: 21, h: 37 },
      { x: 2,  y: 41, w: 48, h: 32 },
      { x: 52, y: 41, w: 46, h: 32 },
    ],
    texts: [
      { text: "Ім'я малюка", x: 25, y: 83, fontSize: 42, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false, align: 'left' },
      { text: 'дд.мм.рррр   гг:хх', x: 72, y: 82, fontSize: 13, fontFamily: 'Dancing Script', color: '#555555', bold: false, align: 'left' },
      { text: '0000 г              00 см', x: 72, y: 90, fontSize: 13, fontFamily: 'Dancing Script', color: '#555555', bold: false, align: 'left' },
    ],
  },
  {
    id: 'baby-grid-9',
    label: '9 фото сітка',
    bgColor: '#ffffff',
    slots: Array.from({ length: 9 }, (_, i) => ({
      x: (i % 3) * 33.5 + 0.5,
      y: Math.floor(i / 3) * 28 + 2,
      w: 32.5,
      h: 27,
    })),
    texts: [
      { text: "Ім'я", x: 50, y: 90, fontSize: 36, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false, align: 'center' },
    ],
  },
  {
    id: 'family-portrait',
    label: 'Сімейний портрет',
    bgColor: '#faf9f6',
    slots: [
      { x: 5, y: 5, w: 90, h: 55 },
      { x: 5, y: 62, w: 29, h: 24 },
      { x: 36, y: 62, w: 29, h: 24 },
      { x: 67, y: 62, w: 28, h: 24 },
    ],
    texts: [
      { text: 'Наша сім\'я', x: 50, y: 91, fontSize: 32, fontFamily: 'Cormorant Garamond', color: '#3d3429', bold: false, align: 'center' },
      { text: '2025', x: 50, y: 97, fontSize: 16, fontFamily: 'Montserrat', color: '#8a7968', bold: false, align: 'center' },
    ],
  },
  {
    id: 'wedding-collage',
    label: 'Весільний колаж',
    bgColor: '#ffffff',
    slots: [
      { x: 2,  y: 2,  w: 60, h: 48 },
      { x: 64, y: 2,  w: 34, h: 23 },
      { x: 64, y: 27, w: 34, h: 23 },
      { x: 2,  y: 52, w: 30, h: 25 },
      { x: 34, y: 52, w: 30, h: 25 },
      { x: 66, y: 52, w: 32, h: 25 },
    ],
    texts: [
      { text: 'ІМ\'Я & ІМ\'Я', x: 50, y: 84, fontSize: 28, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true, align: 'center' },
      { text: 'дд.мм.рррр', x: 50, y: 92, fontSize: 18, fontFamily: 'Dancing Script', color: '#888888', bold: false, align: 'center' },
    ],
  },
  {
    id: 'single-photo',
    label: 'Одне фото',
    bgColor: '#ffffff',
    slots: [{ x: 5, y: 5, w: 90, h: 72 }],
    texts: [
      { text: 'Підпис', x: 50, y: 88, fontSize: 28, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false, align: 'center' },
    ],
  },
];

const SIZES = [
  { label: 'A4 (21×30 см)', value: 'A4', price: 350, ratio: 21/30 },
  { label: 'A3 (30×42 см)', value: 'A3', price: 450, ratio: 30/42 },
  { label: '30×40 см', value: '30x40', price: 420, ratio: 30/40 },
  { label: '40×60 см', value: '40x60', price: 520, ratio: 40/60 },
  { label: '50×70 см', value: '50x70', price: 620, ratio: 50/70 },
];

const FONTS = ['Dancing Script', 'Playfair Display', 'Cormorant Garamond', 'Montserrat', 'Inter', 'Georgia'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PosterEditor() {
  const router = useRouter();
  const { addItem } = useCartStore();

  // Photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Canvas state
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(400);
  const CANVAS_H = Math.round(canvasW / SIZES[0].ratio);

  // Template / design state
  const [selectedTemplate, setSelectedTemplate] = useState<PosterTemplate>(POSTER_TEMPLATES[0]);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [slots, setSlots] = useState<PhotoSlot[]>(() =>
    POSTER_TEMPLATES[0].slots.map(s => ({ ...s, photoId: null, cropX: 50, cropY: 50, zoom: 1 }))
  );
  const [texts, setTexts] = useState<TextBlock[]>(() =>
    POSTER_TEMPLATES[0].texts.map((t, i) => ({ ...t, id: 'txt-' + i }))
  );

  // UI state
  const [selectedSize, setSelectedSize] = useState('A4');
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  const [tab, setTab] = useState<'templates' | 'photos' | 'text' | 'bg'>('templates');

  // Measure canvas
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 10) setCanvasW(w);
    });
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, []);

  const cH = Math.round(canvasW / (SIZES.find(s => s.value === selectedSize)?.ratio || SIZES[0].ratio));

  // Apply template
  const applyTemplate = (tmpl: PosterTemplate) => {
    setSelectedTemplate(tmpl);
    setBgColor(tmpl.bgColor);
    setSlots(tmpl.slots.map(s => ({ ...s, photoId: null, cropX: 50, cropY: 50, zoom: 1 })));
    setTexts(tmpl.texts.map((t, i) => ({ ...t, id: 'txt-' + Date.now() + i })));
    setSelectedTextId(null);
  };

  // Photo upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const preview = ev.target?.result as string;
        setPhotos(prev => [...prev, { id: 'ph-' + Date.now() + Math.random(), preview, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Drop photo into slot
  const dropPhotoIntoSlot = (photoId: string, slotIdx: number) => {
    setSlots(prev => prev.map((s, i) => i === slotIdx ? { ...s, photoId } : s));
  };

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) || null : null;

  // Selected text
  const selText = texts.find(t => t.id === selectedTextId) || null;
  const updateText = (id: string, patch: Partial<TextBlock>) =>
    setTexts(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  const price = SIZES.find(s => s.value === selectedSize)?.price || 350;

  const handleOrder = () => {
    addItem({
      id: `poster-${Date.now()}`,
      name: `Постер "${selectedTemplate.label}"`,
      price,
      qty: 1,
      image: photos[0]?.preview || '',
      options: { 'Розмір': selectedSize, 'Шаблон': selectedTemplate.label },
      personalization_note: `Постер ${selectedSize}, шаблон: ${selectedTemplate.label}, фото: ${photos.length} шт.`,
    });
    toast.success('Постер додано до кошика!');
    router.push('/cart');
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'#f8fafc', fontFamily:'Inter,sans-serif' }}>
      {/* Top bar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'10px 16px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:100 }}>
        <button onClick={() => router.back()} style={{ padding:'6px 12px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:13, color:'#64748b' }}>← Назад</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:14, color:'#1e2d7d' }}>Редактор постерів</div>
          <div style={{ fontSize:11, color:'#94a3b8' }}>{selectedTemplate.label} · {selectedSize}</div>
        </div>
        <div style={{ fontWeight:800, fontSize:16, color:'#1e2d7d' }}>{price} ₴</div>
        <button onClick={handleOrder}
          style={{ padding:'8px 16px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13 }}>
          🛒 Замовити
        </button>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Left sidebar */}
        <div style={{ width:220, background:'#fff', borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Tab bar */}
          <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0' }}>
            {([['templates','🎨','Шаблони'],['photos','📷','Фото'],['text','T','Текст'],['bg','🎨','Фон']] as const).map(([t, icon, label]) => (
              <button key={t} onClick={() => setTab(t as any)}
                style={{ flex:1, padding:'8px 2px', border:'none', borderBottom: tab===t ? '2px solid #1e2d7d' : '2px solid transparent',
                  background:'none', cursor:'pointer', fontSize:10, color: tab===t ? '#1e2d7d' : '#94a3b8', fontWeight: tab===t ? 700 : 400 }}>
                <div style={{ fontSize:14 }}>{icon}</div>
                <div>{label}</div>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex:1, overflow:'auto', padding:10 }}>
            {tab === 'templates' && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', marginBottom:4 }}>РОЗМІР</div>
                {SIZES.map(s => (
                  <button key={s.value} onClick={() => setSelectedSize(s.value)}
                    style={{ padding:'6px 8px', border: selectedSize===s.value ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                      borderRadius:8, background: selectedSize===s.value ? '#f0f3ff' : '#fff', cursor:'pointer', textAlign:'left', fontSize:11, color: selectedSize===s.value ? '#1e2d7d' : '#374151' }}>
                    <span style={{ fontWeight:700 }}>{s.label}</span>
                    <span style={{ float:'right', color:'#94a3b8' }}>{s.price} ₴</span>
                  </button>
                ))}
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', marginTop:10, marginBottom:4 }}>ШАБЛОН</div>
                {POSTER_TEMPLATES.map(tmpl => (
                  <button key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                    style={{ padding:'8px', border: selectedTemplate.id===tmpl.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                      borderRadius:8, background: selectedTemplate.id===tmpl.id ? '#f0f3ff' : '#fff', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ fontSize:11, fontWeight:700, color: selectedTemplate.id===tmpl.id ? '#1e2d7d' : '#374151' }}>{tmpl.label}</div>
                    <div style={{ fontSize:10, color:'#94a3b8' }}>{tmpl.slots.length} фото</div>
                  </button>
                ))}
              </div>
            )}

            {tab === 'photos' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ padding:'10px', border:'2px dashed #1e2d7d', borderRadius:10, background:'#f0f3ff', cursor:'pointer', color:'#1e2d7d', fontWeight:700, fontSize:12 }}>
                  + Завантажити фото
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFileChange} />
                <div style={{ fontSize:10, color:'#94a3b8' }}>Перетягніть фото на слоти постера</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {photos.map(ph => (
                    <div key={ph.id} draggable
                      onDragStart={() => setDraggingPhotoId(ph.id)}
                      onDragEnd={() => setDraggingPhotoId(null)}
                      style={{ aspectRatio:'1', borderRadius:6, overflow:'hidden', cursor:'grab', border:'1px solid #e2e8f0', position:'relative' }}>
                      <img src={ph.preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'text' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button onClick={() => {
                  const id = 'txt-' + Date.now();
                  setTexts(prev => [...prev, { id, text: 'Новий текст', x: 50, y: 50, fontSize: 20, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false, align: 'center' }]);
                  setSelectedTextId(id);
                }} style={{ padding:'8px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, color:'#1e2d7d' }}>
                  + Додати текст
                </button>
                {selText && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                    <textarea value={selText.text} rows={2}
                      onChange={e => updateText(selText.id, { text: e.target.value })}
                      style={{ padding:6, border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, resize:'none', outline:'none' }}/>
                    <div>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Розмір шрифту</div>
                      <input type="range" min={8} max={80} value={selText.fontSize}
                        onChange={e => updateText(selText.id, { fontSize: +e.target.value })}
                        style={{ width:'100%', accentColor:'#1e2d7d' }}/>
                      <div style={{ textAlign:'center', fontSize:10, color:'#1e2d7d', fontWeight:700 }}>{selText.fontSize}px</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Шрифт</div>
                      <select value={selText.fontFamily} onChange={e => updateText(selText.id, { fontFamily: e.target.value })}
                        style={{ width:'100%', padding:'4px 6px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:11, outline:'none' }}>
                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Колір</div>
                        <input type="color" value={selText.color} onChange={e => updateText(selText.id, { color: e.target.value })}
                          style={{ width:'100%', height:28, borderRadius:4, border:'1px solid #e2e8f0', cursor:'pointer', padding:1 }}/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Вирівнювання</div>
                        <div style={{ display:'flex', gap:2 }}>
                          {(['left','center','right'] as const).map(a => (
                            <button key={a} onClick={() => updateText(selText.id, { align: a })}
                              style={{ flex:1, padding:'4px 2px', border: selText.align===a ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius:4, background: selText.align===a ? '#f0f3ff' : '#fff', cursor:'pointer', fontSize:12 }}>
                              {a==='left'?'◀':a==='center'?'≡':'▶'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => { setTexts(prev => prev.filter(t => t.id !== selText.id)); setSelectedTextId(null); }}
                      style={{ padding:'6px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff7f7', cursor:'pointer', color:'#ef4444', fontSize:11, fontWeight:600 }}>
                      🗑 Видалити текст
                    </button>
                  </div>
                )}
                {!selText && texts.length > 0 && (
                  <div style={{ fontSize:11, color:'#94a3b8', textAlign:'center', paddingTop:8 }}>Клікніть на текст для редагування</div>
                )}
              </div>
            )}

            {tab === 'bg' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontSize:11, color:'#64748b' }}>Колір фону</div>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  style={{ width:'100%', height:40, borderRadius:6, border:'1px solid #e2e8f0', cursor:'pointer', padding:2 }}/>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
                  {['#ffffff','#f5f0eb','#faf9f6','#f2d5c0','#4ec8c8','#1a1a2e','#f8f4ff','#fff5f7','#f0f4f0','#fffbf0'].map(c => (
                    <button key={c} onClick={() => setBgColor(c)}
                      style={{ aspectRatio:'1', borderRadius:6, background:c, border: bgColor===c ? '2px solid #1e2d7d' : '1px solid #e2e8f0', cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas area */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflow:'auto', background:'#f8fafc' }}>
          <div ref={canvasRef} style={{ width:'100%', maxWidth:600 }}>
            <div style={{ width:'100%', paddingBottom: `${(cH/canvasW*100).toFixed(2)}%`, position:'relative', background: bgColor, boxShadow:'0 8px 40px rgba(0,0,0,0.15)', borderRadius:4 }}>
              <div style={{ position:'absolute', inset:0 }}>
                {/* Photo slots */}
                {slots.map((slot, si) => {
                  const photo = getPhoto(slot.photoId);
                  const px = { x: slot.x/100*canvasW, y: slot.y/100*cH, w: slot.w/100*canvasW, h: slot.h/100*cH };
                  return (
                    <div key={si}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={e => { e.preventDefault(); if (draggingPhotoId) dropPhotoIntoSlot(draggingPhotoId, si); }}
                      onClick={() => { if (!photo && photos.length > 0) { const unused = photos.find(p => !slots.some(s => s.photoId === p.id)); if (unused) dropPhotoIntoSlot(unused.id, si); } }}
                      style={{ position:'absolute', left:px.x, top:px.y, width:px.w, height:px.h,
                        overflow:'hidden', cursor: photo ? 'default' : 'pointer',
                        border: photo ? 'none' : '1.5px dashed rgba(148,163,184,0.6)',
                        background: photo ? 'transparent' : '#f1f5f9' }}>
                      {photo
                        ? <img src={photo.preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} draggable={false}/>
                        : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:2 }}>
                            <span style={{ fontSize: Math.max(12, px.h * 0.2), color:'rgba(148,163,184,0.7)' }}>📷</span>
                          </div>
                      }
                      {photo && (
                        <button onClick={e => { e.stopPropagation(); setSlots(prev => prev.map((s,i) => i===si ? {...s, photoId:null} : s)); }}
                          style={{ position:'absolute', top:2, right:2, width:16, height:16, borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5 }}>×</button>
                      )}
                    </div>
                  );
                })}

                {/* Text blocks */}
                {texts.map(tb => (
                  <div key={tb.id}
                    onClick={e => { e.stopPropagation(); setSelectedTextId(tb.id); setTab('text'); }}
                    style={{ position:'absolute', left: tb.align === 'center' ? '0' : `${tb.x}%`,
                      top:`${tb.y}%`, width: tb.align === 'center' ? '100%' : 'auto',
                      transform: tb.align === 'center' ? 'none' : 'translate(-50%,-50%)',
                      textAlign: tb.align,
                      fontSize: tb.fontSize / 100 * canvasW,
                      fontFamily: tb.fontFamily,
                      color: tb.color,
                      fontWeight: tb.bold ? 700 : 400,
                      cursor:'pointer', userSelect:'none', zIndex:10,
                      outline: selectedTextId === tb.id ? '1px dashed #1e2d7d' : 'none',
                      padding: '1px 3px', borderRadius:2,
                      lineHeight: 1.2, whiteSpace:'nowrap' }}>
                    {tb.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Playfair+Display:wght@400;700&family=Cormorant+Garamond:wght@400;700&family=Montserrat:wght@400;700&display=swap" rel="stylesheet"/>
    </div>
  );
}
