'use client';

import { useRef } from 'react';
import { ImageIcon } from 'lucide-react';

export interface PageBackground {
  type: 'color' | 'image';
  color: string;
  imageUrl: string | null;
  opacity: number;   // 0-100
  blur: number;      // 0-20px
}

export const DEFAULT_BG: PageBackground = {
  type: 'color', color: '#ffffff', imageUrl: null, opacity: 100, blur: 0
};

const PRESET_COLORS = [
  '#ffffff','#f8f9fa','#f1f5f9','#fef3c7','#fce7f3',
  '#ede9fe','#dbeafe','#dcfce7','#ffedd5','#fef2f2',
  '#1e2d7d','#1a1a1a','#374151','#6b7280','#d1d5db',
];

interface BgLayerProps {
  bg: PageBackground;
  canvasW: number;
  canvasH: number;
}

export function BackgroundLayer({ bg, canvasW, canvasH }: BgLayerProps) {
  return (
    <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden', borderRadius:'inherit' }}>
      <div style={{ position:'absolute', inset:0, background:'#fff' }} />
      {/* Image layer */}
      {bg.type==='image' && bg.imageUrl && (
        <img
          src={bg.imageUrl}
          style={{
            position:'absolute', inset:0, width:'100%', height:'100%',
            objectFit:'cover',
            opacity: bg.opacity / 100,
            filter: bg.blur > 0 ? `blur(${bg.blur}px)` : 'none',
          }}
          draggable={false}
        />
      )}
      {/* Color with opacity */}
      {bg.type==='color' && (
        <div style={{ position:'absolute', inset:0, background: bg.color, opacity: bg.opacity/100 }} />
      )}
    </div>
  );
}

interface BgControlsProps {
  bg: PageBackground;
  onChange: (bg: PageBackground) => void;
}

export function BackgroundControls({ bg, onChange }: BgControlsProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      onChange({ ...bg, type:'image', imageUrl: ev.target!.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Type toggle */}
      <div style={{ display:'flex', gap:4 }}>
        {(['color','image'] as const).map(type => (
          <button key={type} onClick={() => onChange({ ...bg, type })}
            style={{ flex:1, padding:'7px', border: bg.type===type ? '2px solid #1e2d7d' : '1px solid #e2e8f0', borderRadius:7, background: bg.type===type ? '#f0f3ff' : '#fff', cursor:'pointer', fontWeight:700, fontSize:11, color: bg.type===type ? '#1e2d7d' : '#374151' }}>
            {type==='color' ? 'Колір' : 'Фото'}
          </button>
        ))}
      </div>

      {/* Color picker */}
      {bg.type==='color' && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>Колір фону</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => onChange({ ...bg, color: c })}
                style={{ width:22, height:22, borderRadius:'50%', background:c, border: bg.color===c ? '3px solid #1e2d7d' : '2px solid #e2e8f0', cursor:'pointer', boxShadow: c==='#ffffff'?'inset 0 0 0 1px #d1d5db':'none' }} />
            ))}
            <input type="color" value={bg.color} onChange={e => onChange({ ...bg, color: e.target.value })}
              style={{ width:22, height:22, borderRadius:'50%', border:'none', cursor:'pointer', padding:0 }} />
          </div>
        </div>
      )}

      {/* Image upload */}
      {bg.type==='image' && (
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display:'none' }} />
          <button onClick={() => fileRef.current?.click()}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', border:'2px dashed #1e2d7d', borderRadius:8, background:'#f0f3ff', cursor:'pointer', fontWeight:700, fontSize:11, color:'#1e2d7d', width:'100%' }}>
            <ImageIcon size={14} /> {bg.imageUrl ? 'Змінити фото' : 'Завантажити фото'}
          </button>
          {bg.imageUrl && (
            <div style={{ marginTop:6, borderRadius:6, overflow:'hidden', height:60 }}>
              <img src={bg.imageUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
          )}
        </div>
      )}

      {/* Opacity */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Прозорість</span>
          <span style={{ fontSize:11, fontWeight:700, color:'#1e2d7d' }}>{bg.opacity}%</span>
        </div>
        <input type="range" min={10} max={100} value={bg.opacity}
          onChange={e => onChange({ ...bg, opacity: +e.target.value })}
          style={{ width:'100%' }} />
      </div>

      {/* Blur — only for image */}
      {bg.type==='image' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>Розмиття</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#1e2d7d' }}>{bg.blur}px</span>
          </div>
          <input type="range" min={0} max={20} value={bg.blur}
            onChange={e => onChange({ ...bg, blur: +e.target.value })}
            style={{ width:'100%' }} />
        </div>
      )}

      {/* Reset */}
      <button onClick={() => onChange(DEFAULT_BG)}
        style={{ padding:'6px', border:'1px solid #fee2e2', borderRadius:7, background:'#fff7f7', cursor:'pointer', fontWeight:600, fontSize:11, color:'#ef4444' }}>
        ↺ Скинути фон
      </button>
    </div>
  );
}
