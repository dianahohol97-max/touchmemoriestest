'use client';
import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PageSlot { photoId: string | null }
interface TextBlock { id:string; text:string; x:number; y:number; fontSize:number; fontFamily:string; color:string; bold:boolean; italic:boolean }
interface Page { id:number; label:string; slots:PageSlot[]; textBlocks?:TextBlock[] }

interface BookPreviewProps {
  pages: Page[];
  photos: { id:string; preview:string }[];
  propW: number; propH: number;
  onClose: () => void;
}

export function BookPreviewModal({ pages, photos, propW, propH, onClose }: BookPreviewProps) {
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
  const pageH = Math.min(480, window.innerHeight * 0.6);
  const pageW = Math.round(pageH * aspect);

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) : null;

  const renderPage = (pageIdx: number, side: 'left'|'right') => {
    if (pageIdx === 0 && side === 'left') {
      // Back cover
      return (
        <div style={{ width:pageW, height:pageH, background:'#e8ecf4', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ color:'rgba(0,0,0,0.2)', fontSize:10, writingMode:'vertical-rl', letterSpacing:3, textTransform:'uppercase' }}>ЗАДНЯ</span>
        </div>
      );
    }
    const page = pages[pageIdx];
    if (!page) {
      return <div style={{ width:pageW, height:pageH, background:'#f8f9fa', flexShrink:0 }}/>;
    }
    const mainPhoto = getPhoto(page.slots[0]?.photoId ?? null);
    return (
      <div style={{ width:pageW, height:pageH, position:'relative', background:'#fff', overflow:'hidden', flexShrink:0 }}>
        {mainPhoto && <img src={mainPhoto.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} draggable={false}/>}
        {!mainPhoto && <div style={{ width:'100%', height:'100%', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#94a3b8', fontSize:11 }}>{page.label}</span></div>}
        {(page.textBlocks||[]).map(tb => (
          <div key={tb.id} style={{ position:'absolute', left:tb.x+'%', top:tb.y+'%', transform:'translate(-50%,-50%)', pointerEvents:'none' }}>
            <span style={{ fontSize:(tb.fontSize*0.85)+'px', fontFamily:tb.fontFamily, color:tb.color, fontWeight:tb.bold?700:400, fontStyle:tb.italic?'italic':'normal', whiteSpace:'pre' }}>{tb.text}</span>
          </div>
        ))}
        <div style={{ position:'absolute', bottom:6, [side==='left'?'left':'right']:10, fontSize:9, color:'rgba(0,0,0,0.25)' }}>{pageIdx}</div>
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

  const spreadLabel = spread === 0 ? 'Обкладинка' : `Розворот ${spread} / ${spreadCount - 1}`;

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(15,15,20,0.9)', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}
    >
      <div onClick={e=>e.stopPropagation()} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ color:'#e2e8f0', fontSize:14, fontWeight:700 }}>{spreadLabel}</span>
          <span style={{ color:'#64748b', fontSize:11 }}>← → для навігації · Esc для закриття</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4, display:'flex' }}>
            <X size={18}/>
          </button>
        </div>

        {/* Book spread */}
        <div style={{ perspective:1000 }}>
          <div style={{
            display:'flex',
            transition:'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
            transform: flipTransform,
            transformOrigin:'center center',
            boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
          }}>
            {/* Left page */}
            <div style={{
              transform: animDir==='prev' ? 'rotateY(-18deg)' : 'rotateY(0deg)',
              transition:'transform 0.45s',
              transformOrigin:'right center',
              boxShadow:'inset -4px 0 12px rgba(0,0,0,0.15)',
            }}>
              {renderPage(leftPageIdx, 'left')}
            </div>

            {/* Spine */}
            <div style={{ width:6, height:pageH, background:'linear-gradient(to right,#b0b8c8,#d8dde8,#b0b8c8)', flexShrink:0 }}/>

            {/* Right page */}
            <div style={{
              transform: animDir==='next' ? 'rotateY(18deg)' : 'rotateY(0deg)',
              transition:'transform 0.45s',
              transformOrigin:'left center',
              boxShadow:'inset 4px 0 12px rgba(0,0,0,0.15)',
            }}>
              {renderPage(rightPageIdx, 'right')}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>navigate('prev')} disabled={spread===0||isAnimating}
            style={{ width:40, height:40, borderRadius:'50%', background:spread===0?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.18)', border:'none', cursor:spread===0?'not-allowed':'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
            <ChevronLeft size={18}/>
          </button>

          {/* Dots */}
          <div style={{ display:'flex', gap:5 }}>
            {Array.from({length:spreadCount}).map((_,i) => (
              <button key={i} onClick={()=>!isAnimating&&setSpread(i)}
                style={{ width:i===spread?20:7, height:7, borderRadius:4, border:'none', cursor:'pointer', background:i===spread?'#fff':'rgba(255,255,255,0.3)', transition:'all 0.2s', padding:0 }}/>
            ))}
          </div>

          <button onClick={()=>navigate('next')} disabled={spread===spreadCount-1||isAnimating}
            style={{ width:40, height:40, borderRadius:'50%', background:spread===spreadCount-1?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.18)', border:'none', cursor:spread===spreadCount-1?'not-allowed':'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
            <ChevronRight size={18}/>
          </button>
        </div>

        <p style={{ color:'rgba(255,255,255,0.3)', fontSize:10 }}>Клікніть поза книгою або натисніть Esc щоб закрити</p>
      </div>
    </div>
  );
}
