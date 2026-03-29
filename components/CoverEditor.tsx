'use client';
import { useState, useRef, useEffect } from 'react';
import { ImageIcon, Move } from 'lucide-react';

export type CoverMaterial = 'velour' | 'leatherette' | 'fabric' | 'printed';
export type DecoType = 'none' | 'acryl' | 'photovstavka' | 'metal' | 'flex' | 'graviruvannya';

export const LEATHERETTE_COLORS: Record<string, string> = {
  'Білий':'#F5F5F0','Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Рудий':'#C8844E',
  'Бордо темний':'#7A2838','Золотистий':'#C4A83A','Теракотовий':'#C25A3C','Жовтий':'#F0B820',
  'Рожевий ніжний':'#E8B4B8','Фуксія':'#D84080','Червоний насичений':'#A01030',
  'Коричневий':'#8E5038','Вишневий':'#7A2020','Марсала':'#6E2840','Графітовий темний':'#3A3038',
  'Фіолетовий яскравий':'#8030A0','Фіолетовий темний':'#502060','Бірюзовий':'#4E9090',
  'Оливковий':'#A0A030','Темно-зелений':'#1E3028','Бірюзовий яскравий':'#00B0B0',
  'Блакитний яскравий':'#0088D0','Темно-синій':'#1A2040','Чорний':'#1A1A1A','Персиковий':'#E8A8A0',
};
export const FABRIC_COLORS: Record<string, string> = {
  'Бежевий/пісочний':'#C4AA88','Теракотовий/цегляний':'#A04838','Фуксія/пурпурний':'#B838A0',
  'Фіолетовий темний':'#582050','Марсала/бордо':'#602838','Коричневий':'#6E4830',
  'Сірий/графітовий':'#586058','Червоний яскравий':'#C02030','Оливковий/зелений':'#A0A020',
};

// Decoration variants per size
export const VELOUR_COLORS: Record<string, string> = {
  'Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Молочний':'#F0EAD6','Лаванда':'#B8A8C8',
  'Рожевий':'#E8B4B8','Бордо':'#7A2838','Чорний':'#1A1A1A','Графітовий':'#3A3038',
  'Синій':'#1A2040','Темно-зелений':'#1E3028','Коричневий':'#8E5038','Марсала':'#6E2840',
};

export const ACRYLIC_VARIANTS: Record<string, string[]> = {
  '20x20':['100×100 мм','Ø145 мм'],
  '25x25':['100×100 мм','Ø145 мм'],
  '20x30':['100×100 мм','Ø145 мм'],
  '30x20':['100×100 мм','Ø145 мм'],
  '30x30':['100×100 мм','Ø145 мм','290×100 мм','215×290 мм'],
};
export const PHOTO_INSERT_VARIANTS: Record<string, string[]> = {
  '20x20':['100×100 мм'],'25x25':['100×100 мм'],
  '20x30':['100×100 мм'],'30x20':['100×100 мм'],
  '30x30':['197×197 мм','100×100 мм'],
};
export const METAL_VARIANTS: Record<string, string[]> = {
  '20x20':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '25x25':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '20x30':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '30x20':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний','250×70 золотий','250×70 срібний'],
  '30x30':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний','250×70 золотий','250×70 срібний'],
};
// Flex colors
export const FLEX_COLORS = [
  { label:'Золотий', value:'gold', color:'#D4AF37' },
  { label:'Срібний', value:'silver', color:'#C0C0C0' },
  { label:'Білий',   value:'white', color:'#FFFFFF' },
  { label:'Чорний',  value:'black', color:'#1A1A1A' },
];
// Metal only gold+silver
export const METAL_COLORS = [
  { label:'Золотий', value:'gold',   color:'#D4AF37' },
  { label:'Срібний', value:'silver', color:'#C0C0C0' },
]; // Note: no black metal

function parseVariantDims(variant: string): { w: number; h: number; round: boolean } {
  if (variant.startsWith('Ø')) {
    const d = parseFloat(variant.replace('Ø','').replace(/\s*мм.*/,''));
    return { w: d, h: d, round: true };
  }
  const m = variant.match(/(\d+)[×x](\d+)/);
  if (m) return { w: parseInt(m[1]), h: parseInt(m[2]), round: false };
  return { w: 100, h: 100, round: false };
}

function darkenHex(hex: string, amount=45): string {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0,(n>>16)-amount), g = Math.max(0,((n>>8)&0xFF)-amount), b = Math.max(0,(n&0xFF)-amount);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

export interface ExtraTextBlock {
  id: string; text: string; x: number; y: number;
  fontFamily: string; fontSize: number; color: string;
}
export interface CoverConfig {
  coverMaterial: CoverMaterial;
  coverColorName: string;
  decoType: DecoType;
  decoVariant: string;
  decoColor: string;
  photoId: string | null;
  decoText: string;
  textX: number; textY: number;
  textFontFamily: string;
  textFontSize: number;
  extraTexts?: ExtraTextBlock[];
}

interface CoverEditorProps {
  canvasW: number; canvasH: number;
  sizeValue: string;
  config: CoverConfig;
  photos: { id: string; preview: string }[];
  onChange: (patch: Partial<CoverConfig>) => void;
}

export function CoverEditor({ canvasW, canvasH, sizeValue, config, photos, onChange }: CoverEditorProps) {
  const [dragOver, setDragOver] = useState(false);
  // Load Cyrillic calligraphic fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Marck+Script&family=Caveat&family=Philosopher&family=Comfortaa&family=Lobster&family=Dancing+Script&family=Great+Vibes&family=Pinyon+Script&family=Sacramento&family=Alex+Brush&family=Italianno&family=Pacifico&family=Playfair+Display&family=Cormorant+Garamond&family=Cinzel&family=EB+Garamond&family=Raleway&family=Josefin+Sans&family=Bebas+Neue&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);
  const dragRef = useRef<{startX:number;startY:number;startTX:number;startTY:number}|null>(null);

  const isSoft = config.coverMaterial !== 'printed';

  const bgColor = (() => {
    if (!isSoft) return '#fff';
    const name = config.coverColorName;
    if (config.coverMaterial === 'leatherette') return LEATHERETTE_COLORS[name] ?? '#D9C8B0';
    if (config.coverMaterial === 'fabric') return FABRIC_COLORS[name] ?? '#C4AA88';
    // velour
    return VELOUR_COLORS[name] ?? LEATHERETTE_COLORS[name] ?? '#D9C8B0';
  })();

  const texture = config.coverMaterial === 'leatherette'
    ? 'repeating-linear-gradient(45deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 7px),repeating-linear-gradient(-45deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 7px)'
    : config.coverMaterial === 'fabric'
    ? 'repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0px,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 4px),repeating-linear-gradient(0deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 1px,transparent 1px,transparent 4px)'
    : 'none';

  const pageWidthMM = parseInt(sizeValue.split('x')[0]) * 10;
  const scale = canvasW / pageWidthMM;

  const dims = parseVariantDims(config.decoVariant || '100×100 мм');
  const boxW = dims.w * scale;
  const boxH = dims.h * scale;
  const boxL = (canvasW - boxW) / 2;
  const boxT = (canvasH - boxH) / 2;

  const photo = photos.find(p => p.id === config.photoId) ?? null;

  // Flex/metal color resolving
  const flexColorVal = config.decoColor || 'gold';
  const flexHex = FLEX_COLORS.find(c=>c.value===flexColorVal)?.color || '#D4AF37';
  const metalGrad = flexColorVal === 'silver'
    ? 'linear-gradient(135deg,#5A5A5A 0%,#E8E8E8 40%,#C8C8C8 55%,#4A4A4A 100%)'
    : 'linear-gradient(135deg,#9A7000 0%,#FFD700 40%,#D4AF37 55%,#8B6000 100%)';
  const metalHex = metalGrad;

  // Text drag
  const handleTextMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTX: config.textX, startTY: config.textY };
    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (me.clientX - dragRef.current.startX) / canvasW * 100;
      const dy = (me.clientY - dragRef.current.startY) / canvasH * 100;
      onChange({ textX: Math.max(5, Math.min(95, dragRef.current.startTX + dx)), textY: Math.max(5, Math.min(95, dragRef.current.startTY + dy)) });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onChange({ photoId: id });
  };

  const textX = config.textX ?? 50;
  const textY = config.textY ?? 50;
  const fontFamily = config.textFontFamily || 'Playfair Display';
  const fontSize = config.textFontSize || Math.max(16, canvasW / 9);

  return (
    <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}
      style={{ position:'relative', width:canvasW, height:canvasH, borderRadius:4, overflow:'hidden',
        boxShadow:'0 8px 32px rgba(0,0,0,0.18)', flexShrink:0, background:bgColor }}>
      {isSoft && <div style={{ position:'absolute', inset:0, backgroundImage:texture, pointerEvents:'none', zIndex:1 }}/>}

      {/* Printed cover — photo + draggable text overlay */}
      {!isSoft && (
        <div style={{ position:'absolute', inset:0, zIndex:2 }}>
          <div style={{ position:'absolute', inset:0, background: photo?'transparent':(dragOver?'#dbeafe':'#f1f5f9'), display:'flex', alignItems:'center', justifyContent:'center', border:dragOver?'2px dashed #1e2d7d':'none' }}>
            {photo ? <img src={photo.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>
              : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, color:'#94a3b8' }}><ImageIcon size={32}/><span style={{ fontSize:12, fontWeight:600 }}>Перетягніть фото на обкладинку</span></div>}
          </div>
          {config.decoText && (
            <div onMouseDown={handleTextMouseDown}
              style={{ position:'absolute', left:`${textX}%`, top:`${textY}%`, transform:'translate(-50%,-50%)', cursor:'move', zIndex:10, padding:'4px 8px', border:'1px dashed rgba(0,0,0,0.3)', borderRadius:4 }}>
              <span contentEditable suppressContentEditableWarning
                onBlur={e=>onChange({decoText:e.currentTarget.textContent||''})}
                onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
                style={{ color:config.decoColor||'#1e2d7d', fontSize:(config.textFontSize||24)+'px', fontFamily:(config.textFontFamily||'Playfair Display')+',serif', fontWeight:700, outline:'none', cursor:'text', display:'block', whiteSpace:'nowrap' }}>
                {config.decoText}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Soft cover decorations */}
      {isSoft && (
        <div style={{ position:'absolute', inset:0, zIndex:2 }}>

          {/* NONE */}
          {config.decoType === 'none' && (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'rgba(255,255,255,0.15)', fontSize:11, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase' }}>{config.coverColorName}</span>
            </div>
          )}

          {/* ACRYL */}
          {config.decoType === 'acryl' && (
            <div style={{ position:'absolute', left:boxL, top:boxT, width:boxW, height:boxH, borderRadius:dims.round?'50%':5,
              overflow:'hidden', border:'2px solid rgba(255,255,255,0.5)', boxShadow:'0 2px 16px rgba(0,0,0,0.25)',
              background:photo?'transparent':'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              {photo ? <><img src={photo.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 50%)', pointerEvents:'none' }}/>
                <button onClick={()=>onChange({photoId:null})} style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button></>
              : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, color:'rgba(255,255,255,0.7)' }}><ImageIcon size={22}/><span style={{ fontSize:10, fontWeight:700, textAlign:'center' }}>Акрил<br/>{config.decoVariant}</span></div>}
            </div>
          )}

          {/* PHOTO INSERT */}
          {config.decoType === 'photovstavka' && (
            <div style={{ position:'absolute', left:boxL, top:boxT, width:boxW, height:boxH, borderRadius:3,
              overflow:'hidden', border:'2px dashed rgba(255,255,255,0.5)', background:photo?'transparent':'rgba(255,255,255,0.1)',
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              {photo ? <><img src={photo.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>
                <button onClick={()=>onChange({photoId:null})} style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button></>
              : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, color:'rgba(255,255,255,0.7)' }}><ImageIcon size={22}/><span style={{ fontSize:10, fontWeight:700, textAlign:'center' }}>Фотовставка<br/>{config.decoVariant}</span></div>}
            </div>
          )}

          {/* METAL */}
          {config.decoType === 'metal' && (
            <div style={{ position:'absolute', left:boxL, top:boxT, width:boxW, height:boxH,
              borderRadius:dims.round?'50%':3, background:metalHex,
              boxShadow:'0 3px 14px rgba(0,0,0,0.4),inset 0 1px 1px rgba(255,255,255,0.4)',
              display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
              <span contentEditable suppressContentEditableWarning
                onBlur={e=>onChange({decoText:e.currentTarget.textContent||''})}
                style={{ color:flexColorVal==='gold'?'#3D2800':'#1A1A1A', fontSize:Math.max(10,Math.min(boxW/8,22))+'px',
                  fontFamily:'Montserrat,sans-serif', fontWeight:700, letterSpacing:'0.05em',
                  outline:'none', cursor:'text', textAlign:'center', padding:'0 6px', maxWidth:'90%', wordBreak:'break-word' }}>
                {config.decoText||'Ваш текст'}
              </span>
            </div>
          )}

          {/* FLEX — draggable text */}
          {config.decoType === 'flex' && (
            <div onMouseDown={handleTextMouseDown}
              style={{ position:'absolute', left:`${textX}%`, top:`${textY}%`, transform:'translate(-50%,-50%)',
                cursor:'move', userSelect:'none', zIndex:10, padding:'4px 8px',
                border:'1px dashed rgba(255,255,255,0.3)', borderRadius:4 }}>
              <span contentEditable suppressContentEditableWarning
                onBlur={e=>onChange({decoText:e.currentTarget.textContent||''})}
                onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
                style={{ color:flexHex, textShadow:'0 0 8px rgba(0,0,0,0.3)', fontSize:fontSize+'px',
                  fontFamily:fontFamily+',Playfair Display,Georgia,serif', fontWeight:700,
                  letterSpacing:'0.04em', outline:'none', cursor:'text', display:'block', textAlign:'center',
                  whiteSpace:'nowrap' }}>
                {config.decoText||'Ваш текст'}
              </span>
              <div style={{ position:'absolute', top:-8, right:-8, background:'rgba(0,0,0,0.4)', borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <Move size={8} color="#fff"/>
              </div>
            </div>
          )}

          {/* ENGRAVING — draggable text */}
          {config.decoType === 'graviruvannya' && (
            <div onMouseDown={handleTextMouseDown}
              style={{ position:'absolute', left:`${textX}%`, top:`${textY}%`, transform:'translate(-50%,-50%)',
                cursor:'move', userSelect:'none', zIndex:10, padding:'4px 8px',
                border:'1px dashed rgba(255,255,255,0.2)', borderRadius:4 }}>
              <span contentEditable suppressContentEditableWarning
                onBlur={e=>onChange({decoText:e.currentTarget.textContent||''})}
                onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
                style={{ color:darkenHex(bgColor, 50), textShadow:`0 1px 0 ${darkenHex(bgColor,80)},0 -1px 0 rgba(255,255,255,0.1)`,
                  fontSize:fontSize+'px', fontFamily:fontFamily+',Playfair Display,Georgia,serif',
                  fontWeight:600, letterSpacing:'0.06em', outline:'none', cursor:'text', display:'block',
                  textAlign:'center', whiteSpace:'nowrap' }}>
                {config.decoText||'Ваш текст'}
              </span>
              <div style={{ position:'absolute', top:-8, right:-8, background:'rgba(0,0,0,0.3)', borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <Move size={8} color="#fff"/>
              </div>
            </div>
          )}
        </div>
      )}

      {isSoft && config.decoType!=='none' && config.decoVariant && (
        <div style={{ position:'absolute', bottom:5, right:7, fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:600, zIndex:3, letterSpacing:'0.05em' }}>{config.decoVariant}</div>
      )}

      {/* Extra text blocks — draggable on any cover type */}
      {(config.extraTexts||[]).map(et => {
        const etDragRef = { current: null as {sx:number;sy:number;stx:number;sty:number}|null };
        return (
          <div key={et.id}
            onMouseDown={e => {
              e.stopPropagation();
              etDragRef.current = { sx:e.clientX, sy:e.clientY, stx:et.x, sty:et.y };
              const onMove = (me:MouseEvent) => {
                if (!etDragRef.current) return;
                const dx=(me.clientX-etDragRef.current.sx)/canvasW*100;
                const dy=(me.clientY-etDragRef.current.sy)/canvasH*100;
                const updated = (config.extraTexts||[]).map(t=>t.id===et.id?{...t,x:Math.max(2,Math.min(95,etDragRef.current!.stx+dx)),y:Math.max(2,Math.min(95,etDragRef.current!.sty+dy))}:t);
                onChange({extraTexts:updated});
              };
              const onUp = () => { etDragRef.current=null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
              window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
            }}
            style={{ position:'absolute', left:`${et.x}%`, top:`${et.y}%`, transform:'translate(-50%,-50%)', cursor:'move', zIndex:20, padding:'3px 6px', border:'1px dashed rgba(255,255,255,0.25)', borderRadius:3 }}>
            <span
              contentEditable suppressContentEditableWarning
              onBlur={e => {
                const updated=(config.extraTexts||[]).map(t=>t.id===et.id?{...t,text:e.currentTarget.textContent||''}:t);
                onChange({extraTexts:updated});
              }}
              onClick={e=>e.stopPropagation()}
              onMouseDown={e=>e.stopPropagation()}
              style={{ display:'block', fontSize:(et.fontSize||20)+'px', fontFamily:(et.fontFamily||'Playfair Display')+',serif', color:et.color||'#fff', fontWeight:600, outline:'none', cursor:'text', whiteSpace:'nowrap', textShadow:isSoft?'none':'0 1px 3px rgba(0,0,0,0.4)' }}>
              {et.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
