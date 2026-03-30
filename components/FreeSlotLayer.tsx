'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ImageIcon, Trash2, Square, Circle } from 'lucide-react';

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
  onChange: (slots: FreeSlot[]) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

const MIN_SIZE = 40;

const HANDLES = ['nw','n','ne','e','se','s','sw','w'] as const;
type Handle = typeof HANDLES[number];

function handleCursor(h: Handle): string {
  const map: Record<Handle,string> = { nw:'nw-resize', n:'n-resize', ne:'ne-resize', e:'e-resize', se:'se-resize', s:'s-resize', sw:'sw-resize', w:'w-resize' };
  return map[h];
}

function getHandlePos(h: Handle, x: number, y: number, w: number, h2: number): { left: number; top: number } {
  const cx = x + w/2, cy = y + h2/2;
  const map: Record<Handle,{left:number;top:number}> = {
    nw: { left: x, top: y },
    n:  { left: cx, top: y },
    ne: { left: x+w, top: y },
    e:  { left: x+w, top: cy },
    se: { left: x+w, top: y+h2 },
    s:  { left: cx, top: y+h2 },
    sw: { left: x, top: y+h2 },
    w:  { left: x, top: cy },
  };
  return map[h];
}

export function FreeSlotLayer({ slots, photos, canvasW, canvasH, dragPhotoId, onChange, selectedId: externalSelectedId, onSelect }: FreeSlotLayerProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const setSelectedId = (id: string | null) => {
    setInternalSelectedId(id);
    onSelect?.(id);
  };
  const dragRef = useRef<{ type: 'move' | Handle; id: string; startX: number; startY: number; origSlot: FreeSlot } | null>(null);

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) ?? null : null;

  const update = (id: string, patch: Partial<FreeSlot>) => {
    onChange(slots.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const deleteSlot = (id: string) => {
    onChange(slots.filter(s => s.id !== id));
    setSelectedId(null);
  };

  const startDrag = (e: React.MouseEvent, id: string, type: 'move' | Handle) => {
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
      } else {
        // Resize
        if (type.includes('e')) w = Math.max(MIN_SIZE, origSlot.w + dx);
        if (type.includes('s')) h = Math.max(MIN_SIZE, origSlot.h + dy);
        if (type.includes('w')) { w = Math.max(MIN_SIZE, origSlot.w - dx); x = origSlot.x + (origSlot.w - w); }
        if (type.includes('n')) { h = Math.max(MIN_SIZE, origSlot.h - dy); y = origSlot.y + (origSlot.h - h); }
        // Keep square if shape is square/circle
        if (origSlot.shape === 'square' || origSlot.shape === 'circle') {
          const size = Math.max(w, h);
          w = size; h = size;
        }
        x = Math.max(0, x);
        y = Math.max(0, y);
      }
      update(id, { x, y, w, h });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startCropDrag = (e: React.MouseEvent, id: string, cropX: number, cropY: number) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const onMove = (me: MouseEvent) => {
      const nx = Math.max(0, Math.min(100, cropX - (me.clientX - startX) / 3));
      const ny = Math.max(0, Math.min(100, cropY - (me.clientY - startY) / 3));
      update(id, { cropX: nx, cropY: ny });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const borderRadius = (shape: SlotShape, w: number, h: number) => {
    if (shape === 'circle' || shape === 'square') return '50%';
    if (shape === 'rounded') return Math.min(w, h) * 0.12 + 'px';
    return '3px';
  };

  return (
    <>
      {slots.map(slot => {
        const photo = getPhoto(slot.photoId);
        const sel = selectedId === slot.id;
        const br = borderRadius(slot.shape, slot.w, slot.h);

        return (
          <div key={slot.id}
            onMouseDown={e => {
              // Move slot only when clicking on the border area (not directly on photo)
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const border = 12; // px from edge = drag to move
              const onEdge = x < border || y < border || x > rect.width - border || y > rect.height - border;
              if (onEdge || !photo) {
                setSelectedId(slot.id); onSelect?.(slot.id);
                startDrag(e, slot.id, 'move');
              } else {
                setSelectedId(slot.id); onSelect?.(slot.id);
              }
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { update(slot.id, { photoId: id }); setSelectedId(slot.id); onSelect?.(slot.id); } }}
            style={{
              position: 'absolute',
              left: slot.x, top: slot.y,
              width: slot.w, height: slot.h,
              borderRadius: br,
              overflow: 'visible',
              border: sel ? '2px solid #3b82f6' : (photo ? '1px solid rgba(99,102,241,0.3)' : '2px dashed #818cf8'),
              background: 'transparent',
              cursor: photo ? 'default' : 'move',
              zIndex: sel ? 50 : 30,
              boxShadow: sel ? '0 0 0 2px rgba(59,130,246,0.4)' : 'none',
            }}
          >
            {/* Clip container for photo/bg — separate from outer so overflow:hidden doesn't hide resize handles */}
            <div style={{ position:'absolute', inset:0, borderRadius: br, overflow:'hidden', background: photo ? 'transparent' : 'rgba(99,102,241,0.06)' }}>
            {photo && (() => {
              // Non-passive wheel ref for zoom
              const photoRef = (el: HTMLDivElement | null) => {
                if (!el) return;
                const handler = (e: WheelEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const delta = e.deltaY > 0 ? -0.05 : 0.05;
                  update(slot.id, { zoom: Math.max(0.5, Math.min(4, (slot.zoom||1) + delta)) });
                };
                el.addEventListener('wheel', handler, { passive: false });
              };
              return (
              <div
                ref={photoRef}
                style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
              >
                <img
                  src={photo.preview}
                  onMouseDown={e => {
                    e.stopPropagation(); // prevent outer div from also handling
                    if (!sel) {
                      setSelectedId(slot.id);
                      onSelect?.(slot.id);
                    } else {
                      setSelectedId(slot.id);
                      startCropDrag(e, slot.id, slot.cropX, slot.cropY);
                    }
                  }}
                  style={{
                    width: `${(slot.zoom||1)*100}%`,
                    height: `${(slot.zoom||1)*100}%`,
                    objectFit: 'cover',
                    objectPosition: `${slot.cropX}% ${slot.cropY}%`,
                    display: 'block', userSelect: 'none', cursor: 'grab',
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%)',
                  }}
                  draggable={false}
                />
                {/* Zoom controls */}
                {sel && (
                  <div onMouseDown={e=>e.stopPropagation()} style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:4, background:'rgba(0,0,0,0.65)', borderRadius:16, padding:'3px 8px', zIndex:40 }}>
                    <button onClick={e=>{e.stopPropagation();update(slot.id,{zoom:Math.max(0.5,(slot.zoom||1)-0.1)});}} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:16, padding:'0 2px', lineHeight:1 }}>−</button>
                    <span style={{ color:'#fff', fontSize:9, fontWeight:700, minWidth:28, textAlign:'center' }}>{Math.round((slot.zoom||1)*100)}%</span>
                    <button onClick={e=>{e.stopPropagation();update(slot.id,{zoom:Math.min(4,(slot.zoom||1)+0.1)});}} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:16, padding:'0 2px', lineHeight:1 }}>+</button>
                    <div style={{ width:1, height:12, background:'rgba(255,255,255,0.3)', margin:'0 2px' }}/>
                    <button onClick={e=>{e.stopPropagation();update(slot.id,{zoom:1,cropX:50,cropY:50});}} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:9, fontWeight:700, padding:'0 2px' }}>↺</button>
                  </div>
                )}
                {/* Zoom indicator when not selected */}
                {!sel && (slot.zoom||1) !== 1 && (
                  <div style={{ position:'absolute', bottom:4, right:4, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 5px', borderRadius:8, pointerEvents:'none' }}>
                    {Math.round((slot.zoom||1)*100)}%
                  </div>
                )}
              </div>
              );
            })()}
            {!photo && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#818cf8', pointerEvents: 'none' }}>
                <ImageIcon size={20} />
                <span style={{ fontSize: 9, fontWeight: 700 }}>Перетягніть фото</span>
              </div>
            )}
            </div>{/* end clip div */}

            {/* Move handle — drag to move the slot */}
            {sel && (
              <div
                onMouseDown={e => { e.stopPropagation(); setSelectedId(slot.id); startDrag(e, slot.id, 'move'); }}
                style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', width:28, height:18, borderRadius:6, background:'#1e2d7d', color:'#fff', border:'2px solid #fff', cursor:'move', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, userSelect:'none' }}
                title="Перемістити слот"
              >✥</div>
            )}

            {/* Delete button */}
            {sel && (
              <button
                onMouseDown={e => { e.stopPropagation(); deleteSlot(slot.id); }}
                style={{ position: 'absolute', top: -10, right: -10, width: 22, height: 22, borderRadius: '50%', background: '#ef4444', color: '#fff', border: '2px solid #fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
              >×</button>
            )}

            {/* Clear photo */}
            {sel && photo && (
              <button
                onMouseDown={e => { e.stopPropagation(); update(slot.id, { photoId: null }); }}
                style={{ position: 'absolute', top: -10, left: -10, width: 22, height: 22, borderRadius: '50%', background: '#64748b', color: '#fff', border: '2px solid #fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
              >✕</button>
            )}
          </div>
        );
      })}

      {/* Resize handles — outside overflow:hidden div */}
      {slots.filter(s => s.id === selectedId).map(slot => (
        HANDLES.map(h => {
          const pos = getHandlePos(h, slot.x, slot.y, slot.w, slot.h);
          return (
            <div key={h}
              onMouseDown={e => { e.stopPropagation(); startDrag(e, slot.id, h); }}
              style={{
                position: 'absolute',
                left: pos.left - 8,
                top: pos.top - 8,
                width: 16, height: 16,
                borderRadius: '50%',
                background: '#3b82f6',
                border: '2.5px solid #fff',
                cursor: handleCursor(h),
                zIndex: 60,
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            />
          );
        })
      ))}
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
  if (!selectedSlot) return null;
  return (
    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Форма слоту</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {([
          ['rect',    '▭', 'Прямокутник'],
          ['square',  '■', 'Квадрат'],
          ['circle',  '●', 'Коло'],
          ['rounded', '▢', 'Заокруглений'],
        ] as [SlotShape, string, string][]).map(([s, icon, label]) => (
          <button key={s} onClick={() => onChangeShape(s)} title={label}
            style={{ flex: 1, padding: '6px 2px', border: selectedSlot.shape === s ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius: 6, background: selectedSlot.shape === s ? '#f0f3ff' : '#fff', cursor: 'pointer', fontSize: 14, color: selectedSlot.shape === s ? '#1e2d7d' : '#374151' }}>
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
