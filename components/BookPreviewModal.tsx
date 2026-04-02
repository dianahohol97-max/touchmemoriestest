'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
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

export function BookPreviewModal({ pages, photos, propW, propH, onClose, freeSlots={}, coverState, isPrinted }: BookPreviewProps) {
  const [spread, setSpread] = useState(0);
  const [flipState, setFlipState] = useState<'idle'|'flipping-next'|'flipping-prev'>('idle');
  const [flipProgress, setFlipProgress] = useState(0);

  const spreadCount = Math.ceil((pages.length - 1) / 2) + 1;

  const navigate = useCallback((dir: 'next' | 'prev') => {
    if (flipState !== 'idle') return;
    const next = dir === 'next' ? spread + 1 : spread - 1;
    if (next < 0 || next >= spreadCount) return;
    setFlipState(dir === 'next' ? 'flipping-next' : 'flipping-prev');
    let start: number | null = null;
    const duration = 500;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;
      setFlipProgress(eased);
      if (p < 1) { requestAnimationFrame(animate); }
      else { setSpread(next); setFlipState('idle'); setFlipProgress(0); }
    };
    requestAnimationFrame(animate);
  }, [spread, flipState, spreadCount]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigate('next');
      if (e.key === 'ArrowLeft') navigate('prev');
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate, onClose]);

  const touchRef = useRef<{ startX: number } | null>(null);
  const aspect = propH > 0 ? propW / propH : 1;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const maxW = typeof window !== 'undefined' ? window.innerWidth * 0.92 - 8 : 800;
  const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 400;
  const pageW = Math.min(Math.floor(maxW / 2), Math.round(maxH * aspect), isMobile ? 999 : 380);
  const pageH = Math.round(pageW / aspect);
  const spineW = Math.max(4, Math.min(12, Math.round(pages.length * 0.4)));

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) : null;

  const renderPage = (pageIdx: number, side: 'left'|'right') => {
    // Back cover
    if (pageIdx === 0 && side === 'left') {
      const backBg = isPrinted ? (coverState?.backCoverBgColor || '#f1f5f9') : '#e8ecf4';
      const backPhoto = isPrinted && coverState?.backCoverPhotoId ? photos.find(p=>p.id===coverState.backCoverPhotoId) : null;
      return (
        <div style={{ width:pageW, height:pageH, background:backBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', overflow:'hidden' }}>
          {backPhoto && <img src={backPhoto.preview} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} draggable={false}/>}
          <span style={{ color:'rgba(0,0,0,0.15)', fontSize:9, writingMode:'vertical-rl', letterSpacing:3, textTransform:'uppercase' }}>ЗАДНЯ</span>
        </div>
      );
    }
    // Printed front cover
    if (pageIdx === 0 && side === 'right' && isPrinted) {
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
    // Inner page
    const page = pages[pageIdx];
    if (!page) return <div style={{ width:pageW, height:pageH, background:'#f8f9fa', flexShrink:0 }}/>;
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

  const leftPageIdx = spread === 0 ? 0 : (spread - 1) * 2 + 1;
  const rightPageIdx = spread === 0 ? 0 : (spread - 1) * 2 + 2;
  const isFlipping = flipState !== 'idle';
  const flipAngle = flipProgress * 180;

  const spreadLabel = spread === 0 ? 'Обкладинка' : `Розворот ${spread} / ${spreadCount - 1}`;

  return (
    <div
      onClick={onClose}
      onTouchStart={e => { touchRef.current = { startX: e.touches[0].clientX }; }}
      onTouchEnd={e => {
        if (!touchRef.current) return;
        const dx = e.changedTouches[0].clientX - touchRef.current.startX;
        touchRef.current = null;
        if (Math.abs(dx) > 50) { dx < 0 ? navigate('next') : navigate('prev'); }
      }}
      style={{ position:'fixed', inset:0, background:'rgba(10,10,15,0.94)', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: isMobile ? '8px 0' : '20px' }}
    >
      <div onClick={e=>e.stopPropagation()} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: isMobile ? 8 : 14, width:'100%', maxWidth:'100vw' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'#e2e8f0', fontSize:14, fontWeight:700 }}>{spreadLabel}</span>
          {!isMobile && <span style={{ color:'#64748b', fontSize:11 }}>стрілки ← → · свайп · Esc</span>}
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', cursor:'pointer', color:'#fff', padding:'6px 10px', borderRadius:8, display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
            <X size={14}/> {isMobile ? '' : 'Закрити'}
          </button>
        </div>

        {/* Book with cover wrap + page flip */}
        <div style={{ perspective: 1200 }}>
          <div style={{ position:'relative', display:'flex', alignItems:'stretch' }}>
            {/* Cover wrap — left edge */}
            {spread === 0 && <div style={{ width:spineW, height:pageH, flexShrink:0, background:'linear-gradient(to right, #8b7355, #a08b6e)', borderRadius:'3px 0 0 3px', boxShadow:'inset -1px 0 3px rgba(0,0,0,0.3)' }}/>}

            <div style={{ position:'relative', width: pageW * 2 + spineW, height: pageH, overflow:'visible' }}>
              {/* Current spread */}
              <div style={{ display:'flex', width: pageW * 2 + spineW, height: pageH, position:'absolute', inset:0 }}>
                {renderPage(leftPageIdx, 'left')}
                <div style={{ width:spineW, height:pageH, flexShrink:0, background: spread===0 ? 'linear-gradient(to right, #a08b6e, #c4b49a, #a08b6e)' : 'linear-gradient(to right, #e8e4de, #f5f2ed, #e8e4de)', boxShadow:'0 0 6px rgba(0,0,0,0.1)' }}/>
                {renderPage(rightPageIdx, 'right')}
              </div>

              {/* Flipping right page (next) */}
              {flipState === 'flipping-next' && (
                <div style={{
                  position:'absolute', top:0, right:0, width: pageW, height: pageH,
                  transformOrigin: 'left center', transform: `rotateY(${-flipAngle}deg)`,
                  zIndex: 10, backfaceVisibility:'hidden', overflow:'hidden',
                }}>
                  <div style={{ width:pageW, height:pageH, background:'#fff', boxShadow:`-4px 0 16px rgba(0,0,0,${0.08 + flipProgress * 0.15})` }}>
                    {flipProgress < 0.5 ? renderPage(rightPageIdx, 'right') : (
                      <div style={{ width:'100%', height:'100%', background:'linear-gradient(to left, #f8f6f2, #eae7e0)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ color:'rgba(0,0,0,0.06)', fontSize:11 }}>●</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Flipping left page (prev) */}
              {flipState === 'flipping-prev' && (
                <div style={{
                  position:'absolute', top:0, left:0, width: pageW, height: pageH,
                  transformOrigin: 'right center', transform: `rotateY(${flipAngle}deg)`,
                  zIndex: 10, backfaceVisibility:'hidden', overflow:'hidden',
                }}>
                  <div style={{ width:pageW, height:pageH, background:'#fff', boxShadow:`4px 0 16px rgba(0,0,0,${0.08 + flipProgress * 0.15})` }}>
                    {flipProgress < 0.5 ? renderPage(leftPageIdx, 'left') : (
                      <div style={{ width:'100%', height:'100%', background:'linear-gradient(to right, #f8f6f2, #eae7e0)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ color:'rgba(0,0,0,0.06)', fontSize:11 }}>●</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Book shadow */}
              <div style={{ position:'absolute', bottom:-5, left:'8%', right:'8%', height:10, background:'radial-gradient(ellipse at center, rgba(0,0,0,0.2), transparent)', borderRadius:'50%', filter:'blur(3px)', pointerEvents:'none' }}/>
            </div>

            {/* Cover wrap — right edge */}
            {spread === 0 && <div style={{ width:spineW, height:pageH, flexShrink:0, background:'linear-gradient(to right, #a08b6e, #8b7355)', borderRadius:'0 3px 3px 0', boxShadow:'inset 1px 0 3px rgba(0,0,0,0.3)' }}/>}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={()=>navigate('prev')} disabled={spread===0||isFlipping}
            style={{ width:36, height:36, borderRadius:'50%', background:spread===0?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.15)', border:'none', cursor:spread===0?'not-allowed':'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ChevronLeft size={18}/>
          </button>
          <div style={{ display:'flex', gap:4, overflowX:'auto', maxWidth: isMobile ? 'calc(100vw - 120px)' : 500, paddingBlock:4 }}>
            {Array.from({length:spreadCount}).map((_,i) => (
              <button key={i} onClick={()=>!isFlipping&&setSpread(i)}
                style={{ width: i===spread ? 24 : 14, height: 10, borderRadius:3, border:'none', cursor:'pointer', background: i===spread ? '#fff' : 'rgba(255,255,255,0.25)', transition:'all 0.2s', padding:0, flexShrink:0, outline: i===spread ? '2px solid rgba(255,255,255,0.3)' : 'none', outlineOffset:2 }}/>
            ))}
          </div>
          <button onClick={()=>navigate('next')} disabled={spread===spreadCount-1||isFlipping}
            style={{ width:36, height:36, borderRadius:'50%', background:spread===spreadCount-1?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.15)', border:'none', cursor:spread===spreadCount-1?'not-allowed':'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <ChevronRight size={18}/>
          </button>
        </div>

        {!isMobile && <p style={{ color:'rgba(255,255,255,0.2)', fontSize:10, margin:0 }}>Клікніть поза книгою або Esc</p>}
      </div>
    </div>
  );
}
