'use client';
import { useState } from 'react';
import { Wand2, X } from 'lucide-react';

interface AutoBuildModalProps {
  open: boolean;
  onClose: () => void;
  photoCount: number;
  existingPages: number; // total pages including cover
  onBuild: (options: {
    density: 'sparse' | 'balanced' | 'dense';
    variety: 'min' | 'medium' | 'max';
    coverPhoto: boolean;
  }) => void;
}

export function AutoBuildModal({ open, onClose, photoCount, existingPages, onBuild }: AutoBuildModalProps) {
  const [density, setDensity] = useState<'sparse' | 'balanced' | 'dense'>('balanced');
  const [variety, setVariety] = useState<'min' | 'medium' | 'max'>('medium');
  const [coverPhoto, setCoverPhoto] = useState(true);

  if (!open) return null;

  // Estimate: how many pages needed for these photos at this density
  const photosForPages = coverPhoto ? Math.max(0, photoCount - 1) : photoCount;
  const avgPerPage = density === 'sparse' ? 1.5 : density === 'balanced' ? 2.5 : 4;
  const estContentPages = Math.max(2, Math.ceil(photosForPages / avgPerPage));
  // Ensure even (spreads need pairs)
  const estPages = estContentPages % 2 === 0 ? estContentPages : estContentPages + 1;
  const estSpreads = estPages / 2;
  // Compare with existing
  const existingSpreads = Math.floor((existingPages - 1) / 2); // minus cover

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:400, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
        
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Wand2 size={20} color="#7c3aed"/>
            <span style={{ fontSize:18, fontWeight:800, color:'#1e2d7d' }}>Магічна збірка</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4 }}><X size={18}/></button>
        </div>

        {/* Photo count + estimate */}
        <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontSize:13, color:'#374151', fontWeight:600 }}>
            {photoCount} фото → {estSpreads} розворотів ({estPages} сторінок)
          </div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
            {estSpreads !== existingSpreads
              ? `Зараз ${existingSpreads} розворотів — буде змінено на ${estSpreads}`
              : 'Фото будуть розставлені по існуючих розворотах'}
          </div>
        </div>

        {/* Density */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Фото на сторінку</div>
          <div style={{ display:'flex', gap:6 }}>
            {([
              ['sparse', '1–2', 'Мінімалістично'],
              ['balanced', '2–3', 'Збалансовано'],
              ['dense', '3–5', 'Максимум фото'],
            ] as const).map(([val, num, label]) => (
              <button key={val} onClick={()=>setDensity(val)}
                style={{
                  flex:1, padding:'10px 8px', border: density===val ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                  borderRadius:8, background: density===val ? '#f0f3ff' : '#fff', cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                }}>
                <span style={{ fontSize:16, fontWeight:800, color: density===val ? '#1e2d7d' : '#64748b' }}>{num}</span>
                <span style={{ fontSize:9, fontWeight:600, color: density===val ? '#1e2d7d' : '#94a3b8' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Variety */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Різноманітність шаблонів</div>
          <div style={{ display:'flex', gap:6 }}>
            {([
              ['min', 'Максимальна'],
              ['medium', 'Середня'],
              ['max', 'Однорідна'],
            ] as const).map(([val, label]) => (
              <button key={val} onClick={()=>setVariety(val)}
                style={{
                  flex:1, padding:'8px', border: variety===val ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                  borderRadius:8, background: variety===val ? '#f0f3ff' : '#fff', cursor:'pointer',
                  fontSize:11, fontWeight:600, color: variety===val ? '#1e2d7d' : '#64748b',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cover photo checkbox */}
        <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24, cursor:'pointer' }}>
          <input type="checkbox" checked={coverPhoto} onChange={e=>setCoverPhoto(e.target.checked)}
            style={{ width:16, height:16, accentColor:'#1e2d7d' }}/>
          <span style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Найкраще фото на обкладинку</span>
        </label>

        {/* Actions */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'12px', border:'1px solid #e2e8f0', borderRadius:10, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color:'#64748b' }}>
            Скасувати
          </button>
          <button onClick={()=>{ onBuild({ density, variety, coverPhoto }); onClose(); }}
            disabled={photoCount === 0}
            style={{ flex:2, padding:'12px', border:'none', borderRadius:10, background: photoCount > 0 ? '#1e2d7d' : '#cbd5e1', cursor: photoCount > 0 ? 'pointer' : 'not-allowed', fontSize:13, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <Wand2 size={14}/> Зібрати книгу
          </button>
        </div>
      </div>
    </div>
  );
}
