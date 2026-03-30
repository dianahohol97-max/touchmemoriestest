'use client';
import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PageSlot { photoId: string | null }
interface TextBlock { id:string; text:string; x:number; y:number; fontSize:number; fontFamily:string; color:string; bold:boolean; italic:boolean }
interface Page { id:number; label:string; slots:PageSlot[]; textBlocks?:TextBlock[] }

interface FreeSlot { id:string; x:number; y:number; w:number; h:number; shape:string; photoId:string|null; zoom:number; cropX:number; cropY:number }
interface BookPreviewProps {
  pages: Page[];
  photos: { id:string; preview:string }[];
  propW: number; propH: number;
  onClose: () => void;
  freeSlots?: Record<number, FreeSlot[]>;
  coverState?: any;
  isPrinted?: boolean;
  selectedCoverType?: string;
  effectiveCoverColor?: string;
}

export function BookPreviewModal({ pages, photos, propW, propH, onClose, freeSlots={}, coverState, isPrinted, selectedCoverType='', effectiveCoverColor='' }: BookPreviewProps) {
  const [spread, setSpread] = useState(0);
  const [animDir, setAnimDir] = useState<'none'|'next'|'prev'>('none');
  const [isAnimating, setIsAnimating] = useState(false);

  // spreads: 0 = cover, 1..N = content spreads
  // cover: left=back, right=front (pages[0])
  // spread 1: pages[1] + pages[2], spread 2: pages[3]+pages[4] ...
  const spreadCount = Math.ceil((pages.length - 1) / 2) + 1;

  const navigate = (dir: 'next' | 'prev') => {
    if (isAnimating) return;
    const next = dir === 'next' ? spread + 1 : spread - 1;
    if (next < 0 || next >= spreadCount) return;
    setAnimDir(dir);
    setIsAnimating(true);
    setTimeout(() => {
      setSpread(next);
      setAnimDir('none');
      setIsAnimating(false);
    }, 450);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigate('next');
      if (e.key === 'ArrowLeft') navigate('prev');
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [spread, isAnimating]);

  const aspect = propH > 0 ? propW / propH : 1;
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  // On mobile: fit two pages side-by-side within 96vw minus spine
  const maxSpreadW = typeof window !== 'undefined' ? window.innerWidth * 0.96 - 6 : 800;
  const maxSpreadH = typeof window !== 'undefined' ? window.innerHeight * 0.55 : 400;
  const pageWFromW = Math.floor((maxSpreadW) / 2);
  const pageWFromH = Math.round(maxSpreadH * aspect);
  const pageW = Math.min(pageWFromW, pageWFromH, isMobileView ? 999 : 400);
  const pageH = Math.round(pageW / aspect);

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) : null;

  const renderPage = (pageIdx: number, side: 'left'|'right') => {
    if (pageIdx === 0 && side === 'left') {
      // Back cover
      const backBg = isPrinted ? (coverState?.backCoverBgColor || '#f1f5f9') : '#e8ecf4';
      const backPhoto = isPrinted && coverState?.backCoverPhotoId ? photos.find(p=>p.id===coverState.backCoverPhotoId) : null;
      return (
        <div style={{ width:pageW, height:pageH, background:backBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', overflow:'hidden' }}>
          {backPhoto && <img src={backPhoto.preview} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} draggable={false}/>}
          <span style={{ color:'rgba(0,0,0,0.15)', fontSize:9, writingMode:'vertical-rl', letterSpacing:3, textTransform:'uppercase' }}>ЗАДНЯ</span>
        </div>
      );
    }
    if (pageIdx === 0 && side === 'right' && isPrinted) {
      // Printed front cover
      const frontBg = coverState?.printedBgColor || '#fff';
      const slot = coverState?.printedPhotoSlot ?? { x:0,y:0,w:100,h:100,shape:'rect' };
      const overlay = coverState?.printedOverlay ?? { type:'none', color:'#000',opacity:40,gradient:'' };
      const photo = coverState?.photoId ? photos.find(p=>p.id===coverState.photoId) : null;
      const br = slot.shape==='circle'?'50%':slot.shape==='rounded'?'12px':'0px';
      return (
        <div style={{ width:pageW, height:pageH, background:frontBg, position:'relative', overflow:'hidden', flexShrink:0 }}>
          <div style={{ position:'absolute', left:`${slot.x/100*pageW}px`, top:`${slot.y/100*pageH}px`, width:`${slot.w/100*pageW}px`, height:`${slot.h/100*pageH}px`, borderRadius:br, overflow:'hidden' }}>
            {photo && <img src={photo.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>}
          </div>
          {overlay.type==='color' && <div style={{ position:'absolute',inset:0, background:overlay.color, opacity:overlay.opacity/100, pointerEvents:'none' }}/>}
          {overlay.type==='gradient' && <div style={{ position:'absolute',inset:0, backgroundImage:overlay.gradient, pointerEvents:'none' }}/>}
          {(coverState?.printedTextBlocks||[]).map((tb:any) => (
            <div key={tb.id} style={{ position:'absolute', left:`${tb.x}%`, top:`${tb.y}%`, transform:'translate(-50%,-50%)', pointerEvents:'none' }}>
              <span style={{ fontSize:`${tb.fontSize*0.85}px`, fontFamily:tb.fontFamily, color:tb.color, fontWeight:tb.bold?700:400, whiteSpace:'nowrap', textShadow:'0 1px 3px rgba(0,0,0,0.5)' }}>{tb.text}</span>
            </div>
          ))}
        </div>
      );
    }
    const page = pages[pageIdx];
    if (!page) {
      return <div style={{ width:pageW, height:pageH, background:'#f8f9fa', flexShrink:0 }}/>;
    }
    const mainPhoto = getPhoto(page.slots[0]?.photoId ?? null);
    const pageFs = freeSlots[pageIdx] || [];
    return (
      <div style={{ width:pageW, height:pageH, position:'relative', background:'#fff', overflow:'hidden', flexShrink:0 }}>
        {mainPhoto && <img src={mainPhoto.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>}
        {!mainPhoto && pageFs.length === 0 && <div style={{ width:'100%', height:'100%', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#94a3b8', fontSize:11 }}>{page.label}</span></div>}
        {pageFs.map((fs:FreeSlot) => {
          const ph = fs.photoId ? photos.find(p=>p.id===fs.photoId) : null;
          const br = fs.shape==='circle'?'50%':fs.shape==='rounded'?'12px':fs.shape==='square'?'4px':'0';
          return (
            <div key={fs.id} style={{ position:'absolute', left:fs.x, top:fs.y, width:fs.w, height:fs.h, borderRadius:br, overflow:'hidden', background:ph?'transparent':'rgba(99,102,241,0.08)', border:ph?'none':'1px dashed #818cf8' }}>
              {ph && <img src={ph.preview} style={{ width:`${(fs.zoom||1)*100}%`, height:`${(fs.zoom||1)*100}%`, objectFit:'cover', objectPosition:`${fs.cropX}% ${fs.cropY}%`, position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} draggable={false}/>}
            </div>
          );
        })}
        {(page.textBlocks||[]).map(tb => (
          <div key={tb.id} style={{ position:'absolute', left:tb.x+'%', top:tb.y+'%', transform:'translate(-50%,-50%)', pointerEvents:'none' }}>
            <span style={{ fontSize:(tb.fontSize*0.85)+'px', fontFamily:tb.fontFamily, color:tb.color, fontWeight:tb.bold?700:400, fontStyle:tb.italic?'italic':'normal', whiteSpace:'pre' }}>{tb.text}</span>
          </div>
        ))}
        <div style={{ position:'absolute', bottom:6, [side==='left'?'left':'right']:10, fontSize:9, color:'rgba(0,0,0,0.25)' }}>{pageIdx > 0 ? pageIdx : ''}</div>
      </div>
    );
  };

  // Which pages to show this spread
  const leftPageIdx = spread === 0 ? 0 : (spread - 1) * 2 + 1;
  const rightPageIdx = spread === 0 ? 0 : (spread - 1) * 2 + 2;

  // Flip animation transforms
  const flipTransform = animDir === 'next'
    ? 'rotateY(-12deg) scale(0.97)'
    : animDir === 'prev'
    ? 'rotateY(12deg) scale(0.97)'
    : 'rotateY(0deg) scale(1)';

  const spreadLabel = spread === 0 ? 'Обкладинка' : (() => {
    const l = leftPageIdx, r = rightPageIdx <= pages.length - 1 ? rightPageIdx : null;
    return `Розворот ${spread} / ${spreadCount - 1} (стор. ${l}${r ? `–${r}` : ''})`;
  })();

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(15,15,20,0.92)', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: isMobileView ? '8px 0' : '20px' }}
    >
      <div onClick={e=>e.stopPropagation()} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: isMobileView ? 10 : 16, width:'100%', maxWidth:'100vw' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingInline: isMobileView ? 12 : 0 }}>
          <span style={{ color:'#e2e8f0', fontSize: isMobileView ? 13 : 14, fontWeight:700 }}>{spreadLabel}</span>
          {!isMobileView && <span style={{ color:'#64748b', fontSize:11 }}>← → для навігації · Esc для закриття</span>}
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', cursor:'pointer', color:'#fff', padding:'6px 8px', borderRadius:8, display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
            <X size={16}/> {isMobileView ? '' : 'Закрити'}
          </button>
        </div>

        {/* Book spread */}
        <div style={{ perspective:1000, overflow:'hidden', maxWidth:'100vw' }}>
          <div style={{
            display:'flex',
            transition:'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
            transform: flipTransform,
            transformOrigin:'center center',
            boxShadow:'0 12px 48px rgba(0,0,0,0.6)',
          }}>
            <div style={{ transform: animDir==='prev' ? 'rotateY(-18deg)' : 'rotateY(0deg)', transition:'transform 0.45s', transformOrigin:'right center', boxShadow:'inset -4px 0 12px rgba(0,0,0,0.15)' }}>
              {renderPage(leftPageIdx, 'left')}
            </div>
            <div style={{ width:6, height:pageH, background:'linear-gradient(to right,#b0b8c8,#d8dde8,#b0b8c8)', flexShrink:0 }}/>
            <div style={{ transform: animDir==='next' ? 'rotateY(18deg)' : 'rotateY(0deg)', transition:'transform 0.45s', transformOrigin:'left center', boxShadow:'inset 4px 0 12px rgba(0,0,0,0.15)' }}>
              {renderPage(rightPageIdx, 'right')}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingInline: isMobileView ? 8 : 0 }}>
          <button onClick={()=>navigate('prev')} disabled={spread===0||isAnimating}
            style={{ width:38, height:38, borderRadius:'50%', background:spread===0?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.2)', border:'none', cursor:spread===0?'not-allowed':'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ChevronLeft size={18}/>
          </button>

          {/* Dots — scrollable on mobile if many spreads */}
          <div style={{ display:'flex', gap:5, overflowX:'auto', maxWidth: isMobileView ? 'calc(100vw - 120px)' : 'none', paddingBlock:4, scrollbarWidth:'none' }}>
            {Array.from({length:spreadCount}).map((_,i) => (
              <button key={i} onClick={()=>!isAnimating&&setSpread(i)}
                style={{ width:i===spread?20:7, height:7, borderRadius:4, border:'none', cursor:'pointer', background:i===spread?'#fff':'rgba(255,255,255,0.3)', transition:'all 0.2s', padding:0, flexShrink:0 }}/>
            ))}
          </div>

          <button onClick={()=>navigate('next')} disabled={spread===spreadCount-1||isAnimating}
            style={{ width:38, height:38, borderRadius:'50%', background:spread===spreadCount-1?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.2)', border:'none', cursor:spread===spreadCount-1?'not-allowed':'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ChevronRight size={18}/>
          </button>
        </div>

        {!isMobileView && <p style={{ color:'rgba(255,255,255,0.3)', fontSize:10 }}>Клікніть поза книгою або натисніть Esc щоб закрити</p>}
      </div>
    </div>
  );
}
