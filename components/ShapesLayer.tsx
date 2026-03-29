'use client';

import { useState, useRef } from 'react';

export type ShapeType = 'rect' | 'circle' | 'line' | 'line-v' | 'line-diagonal' | 'triangle' | 'star' | 'arrow' | 'rounded-rect';

export interface Shape {
  id: string;
  type: ShapeType;
  x: number; y: number;
  w: number; h: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
}

const SHAPE_PRESETS: { type: ShapeType; icon: string; label: string }[] = [
  { type:'rect',         icon:'▭', label:'Прямокутник' },
  { type:'rounded-rect', icon:'▢', label:'Заокруглений' },
  { type:'circle',       icon:'○', label:'Коло' },
  { type:'triangle',     icon:'△', label:'Трикутник' },
  { type:'line',         icon:'─', label:'Лінія горизонт.' },
  { type:'line-v',        icon:'│', label:'Лінія вертик.' },
  { type:'line-diagonal', icon:'╱', label:'По діагоналі' },
  { type:'star',         icon:'☆', label:'Зірка' },
  { type:'arrow',        icon:'→', label:'Стрілка' },
];

function renderShapeSVG(shape: Shape): React.ReactNode {
  const { type, w, h, fill, stroke, strokeWidth, opacity } = shape;
  const sw = strokeWidth;
  switch (type) {
    case 'rect':
      return <rect x={sw/2} y={sw/2} width={w-sw} height={h-sw} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity/100} />;
    case 'rounded-rect':
      return <rect x={sw/2} y={sw/2} width={w-sw} height={h-sw} rx={Math.min(w,h)*0.12} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity/100} />;
    case 'circle':
      return <ellipse cx={w/2} cy={h/2} rx={w/2-sw/2} ry={h/2-sw/2} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity/100} />;
    case 'triangle':
      return <polygon points={`${w/2},${sw} ${w-sw},${h-sw} ${sw},${h-sw}`} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity/100} />;
    case 'line':
      return <line x1={sw} y1={h/2} x2={w-sw} y2={h/2} stroke={stroke||fill} strokeWidth={Math.max(sw,2)} opacity={opacity/100} strokeLinecap="round" />;
    case 'star': {
      const cx=w/2, cy=h/2, r1=Math.min(w,h)/2-sw, r2=r1*0.4;
      const pts = Array.from({length:10},(_,i)=>{
        const a = (i*Math.PI/5) - Math.PI/2;
        const r = i%2===0 ? r1 : r2;
        return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;
      }).join(' ');
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity/100} />;
    }
    case 'line-v':
      return <line x1={w/2} y1={sw} x2={w/2} y2={h-sw} stroke={stroke||fill} strokeWidth={Math.max(sw,2)} opacity={opacity/100} strokeLinecap="round" />;
    case 'line-diagonal':
      return <line x1={sw} y1={sw} x2={w-sw} y2={h-sw} stroke={stroke||fill} strokeWidth={Math.max(sw,2)} opacity={opacity/100} strokeLinecap="round" />;
    case 'arrow': {
      const ah = h*0.4, aw = w*0.3;
      const pts = `${w*0.1},${h*0.3} ${w*0.1},${h*0.7} ${w*0.65},${h*0.7} ${w*0.65},${h*0.9} ${w*0.95},${h*0.5} ${w*0.65},${h*0.1} ${w*0.65},${h*0.3}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity/100} />;
    }
    default: return null;
  }
}

interface ShapesLayerProps {
  shapes: Shape[];
  canvasW: number;
  canvasH: number;
  onChange: (shapes: Shape[]) => void;
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
}

const HANDLE_SIZE = 8;

export function ShapesLayer({ shapes, canvasW, canvasH, onChange, selectedId: externalSelectedId, onSelectId }: ShapesLayerProps) {
  const [localSelectedId, setLocalSelectedId] = useState<string|null>(null);
  const selectedId = props.selectedId !== undefined ? props.selectedId : localSelectedId;
  const setSelectedId = (id: string|null) => { setLocalSelectedId(id); props.onSelectId?.(id); };
  const dragRef = useRef<{type:'move'|'se'|'rotate'; id:string; sx:number; sy:number; orig:Shape}|null>(null);

  const update = (id:string, patch:Partial<Shape>) => onChange(shapes.map(s=>s.id===id?{...s,...patch}:s));
  const del = (id:string) => { onChange(shapes.filter(s=>s.id!==id)); setSelectedId(null); };

  const startDrag = (e:React.MouseEvent, id:string, type:'move'|'se'|'rotate') => {
    e.stopPropagation(); e.preventDefault();
    const orig = shapes.find(s=>s.id===id)!;
    dragRef.current = { type, id, sx:e.clientX, sy:e.clientY, orig:{...orig} };
    const onMove = (me:MouseEvent) => {
      if (!dragRef.current) return;
      const { type, id, sx, sy, orig } = dragRef.current;
      const dx = me.clientX-sx, dy = me.clientY-sy;
      if (type==='move') update(id, { x:Math.max(0,Math.min(canvasW-orig.w,orig.x+dx)), y:Math.max(0,Math.min(canvasH-orig.h,orig.y+dy)) });
      else if (type==='se') update(id, { w:Math.max(20,orig.w+dx), h:Math.max(20,orig.h+dy) });
      else if (type==='rotate') {
        const cx=orig.x+orig.w/2, cy=orig.y+orig.h/2;
        const angle = Math.atan2(me.clientY-cy, me.clientX-cx) * 180/Math.PI + 90;
        update(id, { rotation: Math.round(angle) });
      }
    };
    const onUp = () => { dragRef.current=null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
  };

  return (
    <>
      {shapes.map(shape => {
        const sel = selectedId===shape.id;
        return (
          <div key={shape.id}
            onMouseDown={e=>{setSelectedId(shape.id);props.onSelectId?.(shape.id);startDrag(e,shape.id,'move');}}
            style={{ position:'absolute', left:shape.x, top:shape.y, width:shape.w, height:shape.h, cursor:'move', zIndex:sel?45:25, outline:sel?'2px solid #3b82f6':'none', transform:`rotate(${shape.rotation}deg)`, transformOrigin:'center' }}>
            <svg width={shape.w} height={shape.h} style={{ display:'block', overflow:'visible' }}>
              {renderShapeSVG(shape)}
            </svg>
            {sel && (
              <>
                {/* Delete */}
                <button onMouseDown={e=>{e.stopPropagation();del(shape.id);}} style={{ position:'absolute',top:-10,right:-10,width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',border:'2px solid #fff',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',zIndex:60 }}>×</button>
                {/* Resize SE */}
                <div onMouseDown={e=>{e.stopPropagation();startDrag(e,shape.id,'se');}} style={{ position:'absolute',bottom:-5,right:-5,width:HANDLE_SIZE+2,height:HANDLE_SIZE+2,borderRadius:2,background:'#fff',border:'2px solid #3b82f6',cursor:'se-resize',zIndex:60 }}/>
                {/* Rotate */}
                <div onMouseDown={e=>{e.stopPropagation();startDrag(e,shape.id,'rotate');}} style={{ position:'absolute',top:-24,left:'50%',transform:'translateX(-50%)',width:14,height:14,borderRadius:'50%',background:'#8b5cf6',border:'2px solid #fff',cursor:'grab',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff' }}>↻</div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

interface ShapeControlsProps {
  selectedShape: Shape | null;
  onChange: (patch: Partial<Shape>) => void;
  onAdd: (type: ShapeType) => void;
}

export function ShapeControls({ selectedShape, onChange, onAdd }: ShapeControlsProps) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:2 }}>Додати фігуру</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
        {SHAPE_PRESETS.map(({type,icon,label}) => (
          <button key={type} onClick={()=>onAdd(type)}
            style={{ padding:'8px 4px', border:'1px solid #e2e8f0', borderRadius:7, background:'#fff', cursor:'pointer', fontWeight:600, fontSize:11, color:'#374151', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <span style={{ fontSize:18 }}>{icon}</span>
            <span style={{ fontSize:9 }}>{label}</span>
          </button>
        ))}
      </div>

      {selectedShape && (
        <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Стиль фігури</div>

          <div style={{ display:'flex', gap:8, marginBottom:6 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'#94a3b8', marginBottom:3 }}>Заливка</div>
              <input type="color" value={selectedShape.fill} onChange={e=>onChange({fill:e.target.value})}
                style={{ width:'100%', height:28, borderRadius:4, border:'1px solid #e2e8f0', cursor:'pointer', padding:2 }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'#94a3b8', marginBottom:3 }}>Обводка</div>
              <input type="color" value={selectedShape.stroke} onChange={e=>onChange({stroke:e.target.value})}
                style={{ width:'100%', height:28, borderRadius:4, border:'1px solid #e2e8f0', cursor:'pointer', padding:2 }}/>
            </div>
          </div>

          <div style={{ marginBottom:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, color:'#94a3b8' }}>Товщина обводки</span>
              <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{selectedShape.strokeWidth}px</span>
            </div>
            <input type="range" min={0} max={20} value={selectedShape.strokeWidth}
              onChange={e=>onChange({strokeWidth:+e.target.value})} style={{ width:'100%' }}/>
          </div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, color:'#94a3b8' }}>Прозорість</span>
              <span style={{ fontSize:10, fontWeight:700, color:'#1e2d7d' }}>{selectedShape.opacity}%</span>
            </div>
            <input type="range" min={10} max={100} value={selectedShape.opacity}
              onChange={e=>onChange({opacity:+e.target.value})} style={{ width:'100%' }}/>
          </div>
        </div>
      )}
    </div>
  );
}
