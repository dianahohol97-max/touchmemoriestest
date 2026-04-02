'use client';
import { haptic, startPointerDrag } from '@/lib/hooks/useMobileInteractions';

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
  photos: { id: string; preview: string; width?: number; height?: number }[];
  canvasW: number;
  canvasH: number;
  pageSizeMm?: { w: number; h: number }; // physical page size in mm for DPI calculation
  dragPhotoId: string | null;
  tapPhotoId?: string | null;
  onChange: (slots: FreeSlot[]) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  isMobile?: boolean;
}

const MIN_SIZE = 40;

// DPI check: calculates print DPI for a photo in a slot
// Returns: 'ok' (>=200), 'warn' (100-199), 'bad' (<100), or null if can't calculate
function checkPhotoDpi(
  photoW: number | undefined, photoH: number | undefined,
  slotW: number, slotH: number, canvasW: number, canvasH: number,
  pageMmW?: number, pageMmH?: number
): { level: 'ok' | 'warn' | 'bad'; dpi: number } | null {
  if (!photoW || !photoH || !pageMmW || !pageMmH) return null;
  if (slotW <= 0 || slotH <= 0 || canvasW <= 0) return null;
  // Slot physical size in mm
  const slotMmW = (slotW / canvasW) * pageMmW;
  const slotMmH = (slotH / canvasH) * pageMmH;
  // DPI = pixels / inches, where inches = mm / 25.4
  const dpiW = photoW / (slotMmW / 25.4);
  const dpiH = photoH / (slotMmH / 25.4);
  const dpi = Math.min(dpiW, dpiH); // worst axis
  if (dpi >= 200) return { level: 'ok', dpi: Math.round(dpi) };
  if (dpi >= 100) return { level: 'warn', dpi: Math.round(dpi) };
  return { level: 'bad', dpi: Math.round(dpi) };
}

export { checkPhotoDpi };
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

export function FreeSlotLayer({ slots, photos, canvasW, canvasH, pageSizeMm, dragPhotoId, tapPhotoId, onChange, selectedId: externalSelectedId, onSelect, isMobile }: FreeSlotLayerProps) {
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
      if (!dragRef.current) return; // no active drag — don't interfere
      const { type, id, startX, startY, origSlot } = dragRef.current;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      let { x, y, w, h } = origSlot;
      e.preventDefault(); // only prevent default when actively dragging a slot

      if (type === 'move') {
        x = Math.max(0, Math.min(canvasW - w, origSlot.x + dx));
        y = Math.max(0, Math.min(canvasH - h, origSlot.y + dy));
        onChange(slots.map(s => s.id === id ? { ...s, x, y } : s));
      } else if (type === 'crop') {
        const nx = Math.max(0, Math.min(100, origSlot.cropX - dx / 3));
        const ny = Math.max(0, Math.min(100, origSlot.cropY - dy / 3));
        onChange(slots.map(s => s.id === id ? { ...s, cropX: nx, cropY: ny } : s));
      } else {
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
    const onTouchCancel = () => { dragRef.current = null; }; // also clear on cancel
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchCancel);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      dragRef.current = null; // clear on unmount
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

  const startDrag = (e: React.PointerEvent, id: string, type: 'move' | Handle | 'crop') => {
    e.stopPropagation();
    e.preventDefault();
    haptic.light();
    const slot = slots.find(s => s.id === id)!;
    const origSlot = { ...slot };
    startPointerDrag(e, (dx, dy) => {
      let { x, y, w, h } = origSlot;
      if (type === 'move') {
        update(id, { x: Math.max(0,Math.min(canvasW-w, origSlot.x+dx)), y: Math.max(0,Math.min(canvasH-h, origSlot.y+dy)) });
      } else if (type === 'crop') {
        update(id, { cropX: Math.max(0,Math.min(100, origSlot.cropX-dx/3)), cropY: Math.max(0,Math.min(100, origSlot.cropY-dy/3)) });
      } else {
        if (type.includes('e')) w = Math.max(MIN_SIZE, origSlot.w+dx);
        if (type.includes('s')) h = Math.max(MIN_SIZE, origSlot.h+dy);
        if (type.includes('w')) { w = Math.max(MIN_SIZE, origSlot.w-dx); x = origSlot.x+(origSlot.w-w); }
        if (type.includes('n')) { h = Math.max(MIN_SIZE, origSlot.h-dy); y = origSlot.y+(origSlot.h-h); }
        if (origSlot.shape==='square'||origSlot.shape==='circle') { const sz=Math.max(w,h); w=sz; h=sz; }
        update(id, { x:Math.max(0,x), y:Math.max(0,y), w, h });
      }
    }, () => { dragRef.current = null; });
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
            onPointerDown={e => {
              if (inCrop) return;
              // Don't start drag if tap-to-place is active — let onClick handle it
              if (tapPhotoId && !slot.photoId) return;
              setSelectedId(slot.id);
              startDrag(e, slot.id, 'move');
            }}
            onClick={e => {
              e.stopPropagation();
              if (tapPhotoId) {
                update(slot.id, { photoId: tapPhotoId });
                setSelectedId(slot.id);
              } else if (!slot.photoId) {
                setSelectedId(slot.id);
              }
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { update(slot.id, { photoId: id }); setSelectedId(slot.id); } }}

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
                    onPointerDown={e => {
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
                  {/* DPI warning badge */}
                  {(() => {
                    const dpiCheck = checkPhotoDpi(photo?.width, photo?.height, slot.w, slot.h, canvasW, canvasH, pageSizeMm?.w, pageSizeMm?.h);
                    if (!dpiCheck || dpiCheck.level === 'ok') return null;
                    const isBad = dpiCheck.level === 'bad';
                    return (
                      <div title={`${dpiCheck.dpi} DPI — ${isBad ? 'якість буде погана' : 'якість може бути недостатня'} для друку`}
                        style={{ position:'absolute', top:4, left:4, display:'flex', alignItems:'center', gap:3, padding:'2px 6px',
                          background: isBad ? 'rgba(220,38,38,0.9)' : 'rgba(217,119,6,0.9)',
                          borderRadius:10, zIndex:35, pointerEvents:'auto', cursor:'help',
                          fontSize:9, fontWeight:700, color:'#fff', lineHeight:1 }}>
                        <span style={{fontSize:11}}>⚠</span>{dpiCheck.dpi} DPI
                      </div>
                    );
                  })()}
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
                onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); fn(); },
                
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
                {/* Done button — deselect slot */}
                <button {...tb(() => setSelectedId(null))}
                  title="Готово"
                  style={{ display:'flex', alignItems:'center', gap:3, padding:'6px 10px', border:'none', borderRadius:5, background:'#16a34a', cursor:'pointer', fontSize:12, fontWeight:700, color:'#fff', minHeight:32, touchAction:'manipulation' }}>
                  ✓ Готово
                </button>
                <div style={{ width:1, height:20, background:'#e2e8f0', margin:'0 2px' }}/>
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
                    title="Прибрати фото зі слоту (слот залишається)"
                    style={{ padding:'6px 10px', border:'1px solid #fbbf24', borderRadius:5, background:'#fffbeb', cursor:'pointer', fontSize:11, color:'#92400e', fontWeight:700, minHeight:32, touchAction:'manipulation' }}>
                    🗑 фото
                  </button>
                )}
                <div style={{ width:1, height:20, background:'#e2e8f0', margin:'0 2px' }}/>
                <button {...tb(() => deleteSlot(slot.id))}
                  title="Видалити слот повністю"
                  style={{ padding:'6px 8px', border:'1px solid #fee2e2', borderRadius:5, background:'#fef2f2', cursor:'pointer', fontSize:11, color:'#ef4444', fontWeight:700, minHeight:32, touchAction:'manipulation' }}>
                  🗑 слот
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

      {/* Resize handles */}
      {slots.filter(s => s.id === selectedId && s.id !== cropModeId).map(slot => {
        const handlesToShow = isMobile
          ? (['se', 'sw', 'ne', 'nw'] as Handle[])  // only 4 corner handles on mobile, bigger
          : HANDLES;

        return handlesToShow.map(h => {
          const pos = getHandlePos(h, slot.x, slot.y, slot.w, slot.h);
          const sz = isMobile ? 28 : (h.length === 2 ? 18 : 16);

          const startTouchResize = (e: React.TouchEvent) => {
            e.stopPropagation(); e.preventDefault();
            const t = e.touches[0];
            dragRef.current = { type: h, id: slot.id, startX: t.clientX, startY: t.clientY, origSlot: { ...slot } };
          };

          return (
            <div key={h}
              onPointerDown={e => { e.stopPropagation(); startDrag(e, slot.id, h); }}
              style={{
                position: 'absolute',
                left: pos.left - sz / 2,
                top: pos.top - sz / 2,
                width: sz, height: sz,
                borderRadius: isMobile ? 6 : (h.length === 2 ? 4 : '50%'),
                background: '#fff',
                border: isMobile ? '2.5px solid #3b82f6' : '2px solid #3b82f6',
                cursor: handleCursor(h),
                zIndex: 65,
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                touchAction: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isMobile && (
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6', opacity: 0.6 }} />
              )}
            </div>
          );
        });
      })}

      {/* Mobile slot controls — floating panel above bottom nav */}
      {isMobile && selectedId && !cropModeId && (() => {
        const slot = slots.find(s => s.id === selectedId);
        if (!slot) return null;
        const STEP = Math.round(Math.min(canvasW, canvasH) * 0.05); // 5% step

        const btn = (label: string, fn: () => void, accent?: boolean) => (
          <button
            key={label}
            onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); fn(); }}
            onClick={fn}
            style={{
              padding: '8px 12px', border: accent ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: 8, background: accent ? '#eff6ff' : '#fff',
              color: accent ? '#1e2d7d' : '#374151',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              minHeight: 36, minWidth: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              touchAction: 'manipulation',
            }}
          >{label}</button>
        );

        return (
          <div
            onTouchStart={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 64, left: 8, right: 8,
              background: '#fff', borderRadius: 14,
              boxShadow: '0 -2px 20px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
              padding: '10px 12px',
              zIndex: 200,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            {/* Size controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', width: 48, flexShrink: 0 }}>Ширина</span>
              {btn('−', () => update(slot.id, { w: Math.max(MIN_SIZE, slot.w - STEP) }))}
              <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{Math.round(slot.w)} px</span>
              {btn('+', () => update(slot.id, { w: Math.min(canvasW - slot.x, slot.w + STEP) }))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', width: 48, flexShrink: 0 }}>Висота</span>
              {btn('−', () => update(slot.id, { h: Math.max(MIN_SIZE, slot.h - STEP) }))}
              <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{Math.round(slot.h)} px</span>
              {btn('+', () => update(slot.id, { h: Math.min(canvasH - slot.y, slot.h + STEP) }))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />

            {/* Shape + actions */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginRight: 2 }}>Форма:</span>
              {(['rect', 'rounded', 'circle'] as SlotShape[]).map(s => (
                <button key={s}
                  onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); update(slot.id, { shape: s }); }}
                  onClick={() => update(slot.id, { shape: s })}
                  style={{
                    padding: '8px 12px', borderRadius: 8, fontSize: 14,
                    border: slot.shape === s ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    background: slot.shape === s ? '#eff6ff' : '#fff',
                    cursor: 'pointer', minHeight: 36, touchAction: 'manipulation',
                  }}
                >
                  {s === 'rect' ? '▭' : s === 'rounded' ? '▢' : '●'}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {btn('✕ слот', () => { onChange(slots.filter(s => s.id !== slot.id)); setInternalSelectedId(null); onSelect?.(null); }, false)}
            </div>
          </div>
        );
      })()}
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
