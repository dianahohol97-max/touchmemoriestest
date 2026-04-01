'use client';

import { useState, useRef, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';

export type SlotShape = 'rect' | 'square' | 'circle' | 'rounded';

export interface FreeSlot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: SlotShape;
  photoId: string | null;
  cropX: number;
  cropY: number;
  zoom: number;
}

interface FreeSlotLayerProps {
  slots: FreeSlot[];
  photos: { id: string; preview: string }[];
  canvasW: number;
  canvasH: number;
  dragPhotoId: string | null;
  tapPhotoId?: string | null;
  onChange: (slots: FreeSlot[]) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

const MIN_SIZE = 40;
const HANDLES = ['nw','n','ne','e','se','s','sw','w'] as const;
type Handle = typeof HANDLES[number];

function handleCursor(h: Handle) {
  return { nw:'nw-resize', n:'n-resize', ne:'ne-resize', e:'e-resize', se:'se-resize', s:'s-resize', sw:'sw-resize', w:'w-resize' }[h];
}

function getHandlePos(h: Handle, x: number, y: number, w: number, h2: number) {
  const cx = x + w/2, cy = y + h2/2;
  return { nw:{left:x,top:y}, n:{left:cx,top:y}, ne:{left:x+w,top:y}, e:{left:x+w,top:cy},
           se:{left:x+w,top:y+h2}, s:{left:cx,top:y+h2}, sw:{left:x,top:y+h2}, w:{left:x,top:cy} }[h];
}

function borderRadius(shape: SlotShape, w: number, h: number) {
  if (shape === 'circle' || shape === 'square') return '50%';
  if (shape === 'rounded') return Math.min(w, h) * 0.12 + 'px';
  return '3px';
}

export function FreeSlotLayer({ slots, photos, canvasW, canvasH, dragPhotoId, tapPhotoId, onChange, selectedId: externalSelectedId, onSelect }: FreeSlotLayerProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [cropModeId, setCropModeId] = useState<string | null>(null);
  const selectedId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;

  const setSelectedId = (id: string | null) => {
    setInternalSelectedId(id);
    onSelect?.(id);
    if (!id) setCropModeId(null);
  };

  const dragRef = useRef<{ type: 'move' | Handle | 'crop'; id: string; startX: number; startY: number; origSlot: FreeSlot } | null>(null);

  // Global touch handlers for move + resize (mirrors mouse global handlers)
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      const { type, id, startX, startY, origSlot } = dragRef.current;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      let { x, y, w, h } = origSlot;
      e.preventDefault();

      if (type === 'move') {
        x = Math.max(0, Math.min(canvasW - w, origSlot.x + dx));
        y = Math.max(0, Math.min(canvasH - h, origSlot.y + dy));
        onChange(slots.map(s => s.id === id ? { ...s, x, y } : s));
      } else if (type === 'crop') {
        const nx = Math.max(0, Math.min(100, origSlot.cropX - dx / 3));
        const ny = Math.max(0, Math.min(100, origSlot.cropY - dy / 3));
        onChange(slots.map(s => s.id === id ? { ...s, cropX: nx, cropY: ny } : s));
      } else {
        // resize handle
        const hStr = type as string;
        if (hStr.includes('e')) w = Math.max(MIN_SIZE, origSlot.w + dx);
        if (hStr.includes('s')) h = Math.max(MIN_SIZE, origSlot.h + dy);
        if (hStr.includes('w')) { w = Math.max(MIN_SIZE, origSlot.w - dx); x = origSlot.x + (origSlot.w - w); }
        if (hStr.includes('n')) { h = Math.max(MIN_SIZE, origSlot.h - dy); y = origSlot.y + (origSlot.h - h); }
        if (origSlot.shape === 'square' || origSlot.shape === 'circle') { const sz = Math.max(w, h); w = sz; h = sz; }
        onChange(slots.map(s => s.id === id ? { ...s, x: Math.max(0,x), y: Math.max(0,y), w, h } : s));
      }
    };
    const onTouchEnd = () => { dragRef.current = null; };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [slots, canvasW, canvasH, onChange]);

  // Touch state for pinch-zoom and double-tap
  const touchRef = useRef<{ lastTap: number; lastTapId: string; pinchDist: number | null; slotId: string | null; startX: number; startY: number; origCropX: number; origCropY: number } >({ lastTap: 0, lastTapId: '', pinchDist: null, slotId: null, startX: 0, startY: 0, origCropX: 50, origCropY: 50 });

  const getTouchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) ?? null : null;
  const update = (id: string, patch: Partial<FreeSlot>) => onChange(slots.map(s => s.id === id ? { ...s, ...patch } : s));
  const deleteSlot = (id: string) => { onChange(slots.filter(s => s.id !== id)); setSelectedId(null); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setCropModeId(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const startDrag = (e: React.MouseEvent, id: string, type: 'move' | Handle | 'crop') => {
    e.stopPropagation();
    e.preventDefault();
    const slot = slots.find(s => s.id === id)!;
    dragRef.current = { type, id, startX: e.clientX, startY: e.clientY, origSlot: { ...slot } };

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const { type, id, startX, startY, origSlot } = dragRef.current;
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      let { x, y, w, h } = origSlot;

      if (type === 'move') {
        x = Math.max(0, Math.min(canvasW - w, origSlot.x + dx));
        y = Math.max(0, Math.min(canvasH - h, origSlot.y + dy));
        update(id, { x, y });
      } else if (type === 'crop') {
        const nx = Math.max(0, Math.min(100, origSlot.cropX - dx / 3));
        const ny = Math.max(0, Math.min(100, origSlot.cropY - dy / 3));
        update(id, { cropX: nx, cropY: ny });
      } else {
        if (type.includes('e')) w = Math.max(MIN_SIZE, origSlot.w + dx);
        if (type.includes('s')) h = Math.max(MIN_SIZE, origSlot.h + dy);
        if (type.includes('w')) { w = Math.max(MIN_SIZE, origSlot.w - dx); x = origSlot.x + (origSlot.w - w); }
        if (type.includes('n')) { h = Math.max(MIN_SIZE, origSlot.h - dy); y = origSlot.y + (origSlot.h - h); }
        if (origSlot.shape === 'square' || origSlot.shape === 'circle') { const sz = Math.max(w, h); w = sz; h = sz; }
        update(id, { x: Math.max(0,x), y: Math.max(0,y), w, h });
      }
    };

    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Non-passive wheel for zoom — attach once per slot
  const wheelAttached = useRef<Set<string>>(new Set());
  const photoContainerRef = (el: HTMLDivElement | null, slotId: string) => {
    if (!el || wheelAttached.current.has(slotId)) return;
    wheelAttached.current.add(slotId);
    el.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const slot = slots.find(s => s.id === slotId);
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      update(slotId, { zoom: Math.max(0.5, Math.min(4, ((slot?.zoom)||1) + delta)) });
    }, { passive: false });
  };

  return (
    <>
      {slots.map(slot => {
        const photo = getPhoto(slot.photoId);
        const sel = selectedId === slot.id;
        const inCrop = cropModeId === slot.id;
        const br = borderRadius(slot.shape, slot.w, slot.h);

        return (
          <div key={slot.id}
            onMouseDown={e => {
              if (inCrop) return;
              setSelectedId(slot.id);
              startDrag(e, slot.id, 'move');
            }}
            onClick={e => {
              if (tapPhotoId) { e.stopPropagation(); update(slot.id, { photoId: tapPhotoId }); setSelectedId(slot.id); }
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { update(slot.id, { photoId: id }); setSelectedId(slot.id); } }}
            onTouchStart={e => {
              if (inCrop) return; // img handles it
              setSelectedId(slot.id);
              const t = e.touches[0];
              touchRef.current.slotId = slot.id;
              touchRef.current.startX = t.clientX; touchRef.current.startY = t.clientY;
              const s = slots.find(s => s.id === slot.id)!;
              dragRef.current = { type:'move', id:slot.id, startX:t.clientX, startY:t.clientY, origSlot:{...s} };
            }}
            onTouchMove={e => {
              if (inCrop || !dragRef.current || dragRef.current.id !== slot.id || dragRef.current.type !== 'move') return;
              e.preventDefault();
              const t = e.touches[0];
              const dx = t.clientX - dragRef.current.startX;
              const dy = t.clientY - dragRef.current.startY;
              const { origSlot } = dragRef.current;
              update(slot.id, {
                x: Math.max(0, Math.min(canvasW - origSlot.w, origSlot.x + dx)),
                y: Math.max(0, Math.min(canvasH - origSlot.h, origSlot.y + dy)),
              });
            }}
            onTouchEnd={() => { if (!inCrop) dragRef.current = null; }}
            style={{
              position: 'absolute', left: slot.x, top: slot.y, width: slot.w, height: slot.h,
              borderRadius: br, overflow: 'visible',
              border: inCrop ? '2px solid rgba(255,255,255,0.8)' : (sel ? '2px solid #3b82f6' : (photo ? '1px solid rgba(99,102,241,0.25)' : '2px dashed #818cf8')),
              background: 'transparent',
              cursor: inCrop ? 'default' : (sel ? 'move' : 'pointer'),
              zIndex: inCrop ? 55 : (sel ? 50 : 30),
              boxShadow: inCrop ? '0 0 0 9999px rgba(0,0,0,0.45)' : (sel ? '0 0 0 2px rgba(59,130,246,0.25)' : 'none'),
              touchAction: 'none',
            }}
          >
            {/* Clip container */}
            <div style={{ position:'absolute', inset:0, borderRadius: br, overflow:'hidden', background: photo ? 'transparent' : 'rgba(99,102,241,0.06)' }}>
              {photo ? (
                <div ref={el => photoContainerRef(el, slot.id)}
                  style={{ width:'100%', height:'100%', overflow:'hidden', position:'relative' }}>
                  <img
                    src={photo.preview}
                    onMouseDown={e => {
                      if (inCrop) { e.stopPropagation(); startDrag(e, slot.id, 'crop'); return; }
                      if (!sel) { e.stopPropagation(); setSelectedId(slot.id); }
                    }}
                    onDoubleClick={e => { e.stopPropagation(); if (sel) setCropModeId(slot.id); }}
                    onTouchStart={e => {
                      e.stopPropagation();
                      const now = Date.now();
                      const tr = touchRef.current;
                      if (now - tr.lastTap < 350 && tr.lastTapId === slot.id) {
                        e.preventDefault();
                        setCropModeId(slot.id); setSelectedId(slot.id);
                        tr.lastTap = 0; return;
                      }
                      tr.lastTap = now; tr.lastTapId = slot.id;
                      if (!sel) setSelectedId(slot.id);
                      if (e.touches.length === 2) {
                        e.preventDefault();
                        tr.pinchDist = getTouchDist(e.touches); tr.slotId = slot.id;
                      } else if (e.touches.length === 1 && inCrop) {
                        tr.slotId = slot.id;
                        tr.startX = e.touches[0].clientX; tr.startY = e.touches[0].clientY;
                        tr.origCropX = slot.cropX; tr.origCropY = slot.cropY;
                      }
                    }}
                    onTouchMove={e => {
                      e.stopPropagation();
                      const tr = touchRef.current;
                      if (e.touches.length === 2 && tr.pinchDist !== null && tr.slotId === slot.id) {
                        e.preventDefault();
                        const nd = getTouchDist(e.touches);
                        update(slot.id, { zoom: Math.max(0.5, Math.min(4, (slot.zoom||1) * (nd / tr.pinchDist))) });
                        tr.pinchDist = nd;
                      } else if (e.touches.length === 1 && inCrop && tr.slotId === slot.id) {
                        e.preventDefault();
                        update(slot.id, {
                          cropX: Math.max(0, Math.min(100, tr.origCropX - (e.touches[0].clientX - tr.startX) / 3)),
                          cropY: Math.max(0, Math.min(100, tr.origCropY - (e.touches[0].clientY - tr.startY) / 3)),
                        });
                      }
                    }}
                    onTouchEnd={e => { e.stopPropagation(); touchRef.current.pinchDist = null; }}
                    style={{
                      width: `${(slot.zoom||1)*100}%`, height: `${(slot.zoom||1)*100}%`,
                      objectFit: 'cover', objectPosition: `${slot.cropX}% ${slot.cropY}%`,
                      display: 'block', userSelect: 'none',
                      cursor: inCrop ? 'move' : (sel ? 'move' : 'pointer'),
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%,-50%)',
                    }}
                    draggable={false}
                  />
                  {/* Rule-of-thirds grid in crop mode */}
                  {inCrop && (
                    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
                      <line x1="33%" y1="0" x2="33%" y2="100%" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
                      <line x1="67%" y1="0" x2="67%" y2="100%" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
                      <line x1="0" y1="33%" x2="100%" y2="33%" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
                      <line x1="0" y1="67%" x2="100%" y2="67%" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
                    </svg>
                  )}
                  {/* Zoom bar */}
                  {sel && !inCrop && (
                    <div onMouseDown={e => e.stopPropagation()}
                      style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:4, background:'rgba(0,0,0,0.7)', borderRadius:20, padding:'3px 10px', zIndex:40, whiteSpace:'nowrap' }}>
                      <button onClick={e=>{e.stopPropagation();update(slot.id,{zoom:Math.max(0.5,(slot.zoom||1)-0.1)});}} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>−</button>
                      <span style={{ color:'#fff', fontSize:9, fontWeight:700, minWidth:30, textAlign:'center' }}>{Math.round((slot.zoom||1)*100)}%</span>
                      <button onClick={e=>{e.stopPropagation();update(slot.id,{zoom:Math.min(4,(slot.zoom||1)+0.1)});}} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>+</button>
                      <div style={{ width:1, height:12, background:'rgba(255,255,255,0.3)', margin:'0 2px' }}/>
                      <button onClick={e=>{e.stopPropagation();update(slot.id,{zoom:1,cropX:50,cropY:50});}} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:9, fontWeight:700, padding:'0 2px' }}>↺</button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
                  color: tapPhotoId ? '#3b82f6' : '#818cf8', background: tapPhotoId ? 'rgba(59,130,246,0.06)' : undefined, pointerEvents:'none' }}>
                  <ImageIcon size={20} />
                  <span style={{ fontSize:9, fontWeight:700 }}>{tapPhotoId ? 'Тапніть для розміщення' : 'Перетягніть фото'}</span>
                </div>
              )}
            </div>

            {/* TOOLBAR — works on both mouse and touch */}
            {sel && !inCrop && (() => {
              const nearTop = slot.y < 48;
              const nearBottom = slot.h > canvasH - 60;
              const insideMode = nearTop && nearBottom;
              const tb = (fn: () => void) => ({
                onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); fn(); },
                onTouchEnd: (e: React.TouchEvent) => { e.stopPropagation(); e.preventDefault(); fn(); },
              });
              return (
              <div onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                style={{ position:'absolute',
                  ...(insideMode ? { top:8, left:'50%', transform:'translateX(-50%)' }
                    : nearTop ? { bottom:-46, top:'auto', left:'50%', transform:'translateX(-50%)' }
                    : { top:-46, left:'50%', transform:'translateX(-50%)' }),
                  display:'flex', alignItems:'center', gap:2, background:'#fff',
                  border:'0.5px solid #e2e8f0', borderRadius:8, padding:'4px 6px',
                  boxShadow:'0 2px 10px rgba(0,0,0,0.15)', zIndex:70, whiteSpace:'nowrap', touchAction:'none' }}>
                {photo && (
                  <button {...tb(() => setCropModeId(slot.id))}
                    title="Кадрувати фото"
                    style={{ display:'flex', alignItems:'center', gap:3, padding:'6px 10px', border:'none', borderRadius:5, background:'#f0f3ff', cursor:'pointer', fontSize:12, fontWeight:600, color:'#1e2d7d', minHeight:32, touchAction:'manipulation' }}>
                    ⊡ Кадр
                  </button>
                )}
                <div style={{ width:1, height:20, background:'#e2e8f0', margin:'0 2px' }}/>
                {(['rect','rounded','circle'] as SlotShape[]).map(s => (
                  <button key={s} {...tb(() => update(slot.id, { shape: s }))}
                    title={s==='rect' ? 'Прямокутник' : s==='rounded' ? 'Заокруглений' : 'Коло'}
                    style={{ padding:'6px 8px', border:slot.shape===s?'1.5px solid #3b82f6':'1px solid #e2e8f0', borderRadius:5, background:slot.shape===s?'#eff6ff':'transparent', cursor:'pointer', fontSize:14, minHeight:32, touchAction:'manipulation' }}>
                    {s==='rect'?'▭':s==='rounded'?'▢':'●'}
                  </button>
                ))}
                <div style={{ width:1, height:20, background:'#e2e8f0', margin:'0 2px' }}/>
                {photo && (
                  <button {...tb(() => update(slot.id, { photoId: null }))}
                    title="Прибрати фото"
                    style={{ padding:'6px 8px', border:'1px solid #e2e8f0', borderRadius:5, background:'transparent', cursor:'pointer', fontSize:11, color:'#64748b', fontWeight:600, minHeight:32, touchAction:'manipulation' }}>
                    ✕ фото
                  </button>
                )}
                <button {...tb(() => deleteSlot(slot.id))}
                  title="Видалити слот"
                  style={{ padding:'6px 8px', border:'1px solid #fee2e2', borderRadius:5, background:'transparent', cursor:'pointer', fontSize:12, color:'#ef4444', minHeight:32, touchAction:'manipulation' }}>
                  ✕
                </button>
              </div>
              );
            })()}

            {/* Crop mode toolbar */}
            {inCrop && (
              <div onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
                style={{ position:'absolute', ...(slot.y < 48 ? { bottom:-42, top:'auto' } : { top:-42 }), left:'50%', transform:'translateX(-50%)',
                  display:'flex', alignItems:'center', gap:8, background:'#1e2d7d',
                  borderRadius:8, padding:'6px 14px', zIndex:70, whiteSpace:'nowrap' }}>
                <span style={{ color:'rgba(255,255,255,0.7)', fontSize:10 }}>Тягни фото щоб перемістити</span>
                <button
                  onMouseDown={e => { e.stopPropagation(); setCropModeId(null); }}
                  onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setCropModeId(null); }}
                  style={{ padding:'4px 12px', background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.35)', borderRadius:5, color:'#fff', cursor:'pointer', fontSize:11, fontWeight:600, minHeight:30, touchAction:'manipulation' }}>
                  Готово
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Resize handles — 8 handles, with touch support */}
      {slots.filter(s => s.id === selectedId && s.id !== cropModeId).map(slot =>
        HANDLES.map(h => {
          const pos = getHandlePos(h, slot.x, slot.y, slot.w, slot.h);
          const isCorner = h.length === 2;

          const startTouchResize = (e: React.TouchEvent) => {
            e.stopPropagation(); e.preventDefault();
            const t = e.touches[0];
            const origSlot = { ...slot };
            dragRef.current = { type: h, id: slot.id, startX: t.clientX, startY: t.clientY, origSlot };
          };

          return (
            <div key={h}
              onMouseDown={e => { e.stopPropagation(); startDrag(e, slot.id, h); }}
              onTouchStart={startTouchResize}
              style={{
                position: 'absolute',
                left: pos.left - (isCorner ? 7 : 6),
                top: pos.top - (isCorner ? 7 : 6),
                width: isCorner ? 18 : 16,
                height: isCorner ? 18 : 16,
                borderRadius: isCorner ? 4 : '50%',
                background: '#fff',
                border: '2px solid #3b82f6',
                cursor: handleCursor(h),
                zIndex: 65,
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                touchAction: 'none',
              }}
            />
          );
        })
      )}
    </>
  );
}

export function FreeSlotControls({
  selectedSlot,
  onChangeShape,
}: {
  selectedSlot: FreeSlot | null;
  onChangeShape: (shape: SlotShape) => void;
}) {
  return null; // shape controls moved to inline toolbar
}
