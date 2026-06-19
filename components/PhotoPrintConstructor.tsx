'use client';
import { useT, useLocale } from '@/lib/i18n/context';
import { getLocalized } from '@/lib/i18n/localize';
import { haptic, startPointerDrag } from '@/lib/hooks/useMobileInteractions';
import { useState, useEffect, useRef } from 'react';
import { Upload, ShoppingCart } from 'lucide-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { setJpegDpi300, embedSRGBProfile } from '@/lib/jpeg-print-utils';

// ─── Size definitions ─────────────────────────────────────────────────────────

const STANDARD_SIZES: Record<string, { w: number; h: number; label: string }> = {
  '9x13':  { w: 9,  h: 13, label: '9×13 см'  },
  '10x15': { w: 10, h: 15, label: '10×15 см' },
  '13x18': { w: 13, h: 18, label: '13×18 см' },
  '15x21': { w: 15, h: 21, label: '15×21 см' },
  '20x25': { w: 20, h: 25, label: '20×25 см' },
  '20x30': { w: 20, h: 30, label: '20×30 см' },
  '30x40': { w: 30, h: 40, label: '30×40 см' },
};

const POLAROID_SIZES: Record<string, {
  totalW: number; totalH: number;
  borderSide: number; borderTop: number; borderBottom: number; label: string;
}> = {
  '7.6x10.1': { totalW: 7.6, totalH: 10.1, borderSide: 0.57, borderTop: 0.54, borderBottom: 2.29, label: '7.6×10.1 см' },
  '8.6x5.4':  { totalW: 5.4, totalH: 8.6,  borderSide: 0.40, borderTop: 0.46, borderBottom: 1.95, label: '8.6×5.4 см' },
};

// Nonstandard sizes: multiple = кратність замовлення.
// Правило бізнесу: кількість має бути кратна `multiple`, але не менше 20 шт.
// Тому фактичний мінімум — найменше кратне `multiple`, що >= 20. Обчислюємо
// з `multiple`, щоб мінімум і кратність ніколи не розсинхронізувались.
const NONSTANDARD_MIN_BASE = 20;
const NONSTANDARD_CONFIG: Record<string, { multiple: number }> = {
  '5x7.5':  { multiple: 12 },
  '5×7.5':  { multiple: 12 },
  '6x9':    { multiple: 10 },
  '6×9':    { multiple: 10 },
  '7.5x10': { multiple: 8  },
  '7.5×10': { multiple: 8  },
  '9x9':    { multiple: 6  },
  '9×9':    { multiple: 6  },
  '10x10':  { multiple: 6  },
  '10×10':  { multiple: 6  },
};
// Smallest multiple of `m` that is >= NONSTANDARD_MIN_BASE (>= 20).
const nonstandardMinQty = (m: number) =>
  m > 0 ? Math.ceil(NONSTANDARD_MIN_BASE / m) * m : NONSTANDARD_MIN_BASE;

const POLAROID_MULTIPLE: Record<string, number> = {
  '7.6x10.1': 8, '7.6×10.1': 8,
  '8.6x5.4':  10,'8.6×5.4':  10,
};

const POLAROID_FONTS = [
  { label: 'Dancing Script',   value: 'Dancing Script, cursive'   },
  { label: 'Caveat',           value: 'Caveat, cursive'           },
  { label: 'Pacifico',         value: 'Pacifico, cursive'         },
  { label: 'Lobster',          value: 'Lobster, cursive'          },
  { label: 'Playfair Display', value: 'Playfair Display, serif'   },
  { label: 'Montserrat',       value: 'Montserrat, sans-serif'    },
];
const POLAROID_COLORS = [
  { label: 'Темний',  value: '#222222' },
  { label: 'Сірий',   value: '#888888' },
  { label: 'Синій',   value: '#1e2d7d' },
  { label: 'Бордо',   value: '#8B2635' },
  { label: 'Зелений', value: '#2d6a4f' },
  { label: 'Рожевий', value: '#d4607a' },
];

const POLAROID_TEXT_PRICE = 5;

// ─── Photo magnets ──────────────────────────────────────────────────────────
// Magnets reuse this whole constructor (sizes, crop, polaroid render, captions).
// Differences vs photo prints: one SET costs MAGNET_SET_PRICE regardless of
// size (the set quantity is the size's `multiple`), and the two Polaroid sizes
// render as polaroids with the optional caption (+POLAROID_TEXT_PRICE each).
const MAGNET_SET_PRICE = 235;
const isPolaroidSizeLabel = (s: string) => /polaroid|поларо/i.test(s || '');
// Set quantity for a magnet size: rectangular sizes come from NONSTANDARD_CONFIG,
// the two polaroid sizes from POLAROID_MULTIPLE.
const getMagnetMultiple = (size: string): number =>
  getNonstandardConfig(size)?.multiple ?? getPolaroidMultiple(size);

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface PhotoFile {
  id: string; file: File; preview: string; width: number; height: number;
  cropX: number; cropY: number; zoom: number;
  polaroidText?: string;
  rotation: number;
  orientation: 'portrait' | 'landscape';
  border: boolean;
  qty: number;
  sizeOverride?: string;
  showCaption?: boolean;
}

interface ProductOption {
  name: string;
  values?: Array<{ name: string; price?: number; priceModifier?: number }>;
  options?: Array<{ label: string; value: string; price?: number }>;
}

interface PhotoPrintConstructorProps {
  productSlug: string;
  initialSize?: string;
  initialFinish?: string;
  initialBorder?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normKey(s: string) {
  // The point of this helper is to turn a human-readable size label like
  //   "5×7.5 см — 7.5 грн (мін. 24 шт, кратно 12)"
  // into the bare size key "5×7.5" that NONSTANDARD_CONFIG / POLAROID_MULTIPLE
  // are indexed by. After dropping the parenthesised note and anything
  // after a dash, every non-digit/dot/x/× character is junk for matching
  // purposes — Cyrillic "см" included. We were using \b previously, but
  // \b in JavaScript only treats ASCII letters as word characters, so
  // \b after Cyrillic "м" never matched and "см" survived in the key,
  // breaking the lookup entirely.
  return s
    .replace(/\s*\(.*?\)/g, '')   // drop parenthesised notes
    .split(/[—–-]/)[0]            // drop everything after an em-/en-/hyphen-dash
    .replace(/[xх]/gi, '×')       // unify Latin/Cyrillic x → ×
    .replace(/[^\d.×]/g, '');     // keep only digits, dots, and ×
}

function getNonstandardConfig(sizeLabel: string) {
  const k = normKey(sizeLabel);
  return NONSTANDARD_CONFIG[k] || NONSTANDARD_CONFIG[k.replace('×','x')] || null;
}

function getPolaroidMultiple(sizeLabel: string): number {
  const k = normKey(sizeLabel);
  return POLAROID_MULTIPLE[k] || POLAROID_MULTIPLE[k.replace('×','x')] || 8;
}

function getSizeKey(label: string): string {
  const m = label.match(/([\d.]+)[×x]([\d.]+)/);
  return m ? `${m[1]}x${m[2]}` : '';
}

// ─── PhotoPreview ─────────────────────────────────────────────────────────────

function PhotoPreview({
  photo, sizeKey, showBorder, isPolaroid, isNonstandard,
  onCropChange, onTextChange, polaroidFont, polaroidColor,
}: {
  photo: PhotoFile; sizeKey: string; showBorder: boolean;
  isPolaroid: boolean; isNonstandard: boolean;
  onCropChange: (id: string, cropX: number, cropY: number, zoom: number) => void;
  onTextChange?: (id: string, text: string) => void;
  polaroidFont?: string; polaroidColor?: string;
}) {
  const t = useT();
  const MAX_W = typeof window !== 'undefined' && window.innerWidth < 500
    ? Math.min(window.innerWidth - 48, 320) : 320;

  // The photo grid and initial bind use the 400px perf thumbnail
  // (photo.preview, added in the editor perf pass) so 250+ uploads don't keep
  // hundreds of MB of decoded originals alive. But the LARGE active-photo
  // viewer renders that 320px-wide canvas with zoom up to 3×, where a 400px
  // thumbnail looks blurry. Only one photo is active at a time, so binding the
  // viewer to a single full-resolution objectURL is cheap. Revoked when the
  // active photo changes. Falls back to the thumbnail until ready, or when no
  // File is present (e.g. a session restored from storage).
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!photo.file) { setFullSrc(null); return; }
    const url = URL.createObjectURL(photo.file);
    setFullSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [photo.file]);
  const displaySrc = fullSrc || photo.preview;

  const handleMouseDown = (e: React.PointerEvent) => {
    e.preventDefault();
    haptic.light();
    const sensitivity = 0.12 / Math.max(1, photo.zoom || 1);
    const startCropX = photo.cropX ?? 50;
    const startCropY = photo.cropY ?? 50;
    startPointerDrag(e, (dx, dy) => {
      onCropChange(photo.id,
        Math.max(0, Math.min(100, startCropX - dx * sensitivity)),
        Math.max(0, Math.min(100, startCropY - dy * sensitivity)),
        photo.zoom);
    });
  };

  // React attaches onWheel as a PASSIVE listener (React 17+), so
  // e.preventDefault() inside it is ignored and the wheel still scrolls/zooms
  // the whole page while the user is only trying to zoom the photo. We attach
  // our own NON-passive native wheel listener via a ref callback, where
  // preventDefault() actually works. Latest photo state is read from a ref to
  // avoid a stale closure.
  const wheelStateRef = useRef({ zoom: photo.zoom || 1, cropX: photo.cropX ?? 50, cropY: photo.cropY ?? 50 });
  wheelStateRef.current = { zoom: photo.zoom || 1, cropX: photo.cropX ?? 50, cropY: photo.cropY ?? 50 };
  const wheelElRef = useRef<HTMLDivElement | null>(null);
  const wheelZoom = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const st = wheelStateRef.current;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    onCropChange(photo.id, st.cropX, st.cropY,
      Math.max(0.1, Math.min(3, st.zoom + delta)));
  };
  const setWheelRef = (el: HTMLDivElement | null) => {
    if (wheelElRef.current) {
      wheelElRef.current.removeEventListener('wheel', wheelZoom);
    }
    wheelElRef.current = el;
    if (el) {
      el.addEventListener('wheel', wheelZoom, { passive: false });
    }
  };
  useEffect(() => {
    return () => {
      if (wheelElRef.current) wheelElRef.current.removeEventListener('wheel', wheelZoom);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    // Kept as a no-op safety net; real handling is the non-passive listener
    // attached via setWheelRef. Calling preventDefault here is harmless.
    e.preventDefault();
  };

  // ── POLAROID ──
  if (isPolaroid) {
    const pKey = sizeKey.replace(/[^\d.x×]/g,'').replace('×','x').replace(/x+/,'x');
    const pSize = POLAROID_SIZES[pKey] || POLAROID_SIZES['7.6x10.1'];
    const isLandscape = photo.orientation === 'landscape';
    // Portrait = native polaroid (tall, thin border on top/sides, thick "lip"
    // on the bottom). Landscape = wide polaroid: the outer frame becomes wide
    // (W/H swap) but the thick lip STAYS on the bottom edge — that's the
    // defining polaroid look and where captions sit. So only totalW/totalH
    // swap; the per-edge borders keep their roles (thin top/sides, thick
    // bottom).
    const totalW = isLandscape ? pSize.totalH : pSize.totalW;
    const totalH = isLandscape ? pSize.totalW : pSize.totalH;
    const borderSide = pSize.borderSide;
    const borderTop = pSize.borderTop;
    const borderBottom = pSize.borderBottom;
    const photoW = totalW - borderSide * 2;
    const photoH = totalH - borderTop - borderBottom;
    const sc = MAX_W / totalW;
    const canvasW = MAX_W;
    const canvasH = Math.round(totalH * sc);
    const bS = borderSide * sc; const bT = borderTop * sc; const bB = borderBottom * sc;
    const aW = photoW * sc; const aH = photoH * sc;

    // Same cover-fit approach as the standard print editor: objectFit:contain
    // scales the image to fit the frame, then scale(effScale) zooms it up to
    // cover. transformOrigin at cropX/cropY lets the user pan in BOTH axes.
    // The old approach (width/height % + objectPosition + translate(-50%,-50%))
    // only moved the image horizontally because objectPosition has no effect
    // when the element is already positioned via CSS transform.
    const frameAR = aW / aH;
    const imgAR = (photo.width && photo.height) ? (photo.width / photo.height) : frameAR;
    const coverFactor = imgAR > frameAR ? (imgAR / frameAR) : (frameAR / imgAR);
    const effScale = Math.max(1, (photo.zoom || 1)) * coverFactor;

    return (
      <div style={{ display:'inline-block' }}>
        <div style={{ width:canvasW, height:canvasH, position:'relative', background:'#fff',
          boxShadow:'0 4px 20px rgba(0,0,0,0.15)', userSelect:'none', touchAction:'none' }}
          onWheel={e=>{e.preventDefault(); const d=e.deltaY>0?-0.05:0.05; onCropChange(photo.id,photo.cropX,photo.cropY,Math.max(0.5,Math.min(3,(photo.zoom||1)+d)));}}>
          <div style={{ position:'absolute', left:bS, top:bT, width:aW, height:aH,
            overflow:'hidden', cursor:'grab', background:'#f0f0f0' }} onPointerDown={handleMouseDown}>
            <img src={displaySrc} draggable={false} decoding="async" style={{
              position:'absolute', width:'100%', height:'100%', objectFit:'contain',
              objectPosition:`${photo.cropX ?? 50}% ${photo.cropY ?? 50}%`, top:0, left:0,
              transform:`scale(${effScale}) rotate(${photo.rotation||0}deg)`,
              transformOrigin:`${photo.cropX ?? 50}% ${photo.cropY ?? 50}%`,
              userSelect:'none', pointerEvents:'none' }}/>
          </div>
          <div style={{ position:'absolute', left:0, top:0, width:canvasW, height:bT, background:'#fff', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', left:0, bottom:0, width:canvasW, height:bB, background:'#fff', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', left:0, top:0, width:bS, height:canvasH, background:'#fff', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', right:0, top:0, width:bS, height:canvasH, background:'#fff', pointerEvents:'none' }}/>
          {[{x:bS-14,y:bT,w:10,h:1},{x:bS,y:bT-14,w:1,h:10},{x:bS+aW+4,y:bT,w:10,h:1},{x:bS+aW,y:bT-14,w:1,h:10},
            {x:bS-14,y:bT+aH,w:10,h:1},{x:bS,y:bT+aH+4,w:1,h:10},{x:bS+aW+4,y:bT+aH,w:10,h:1},{x:bS+aW,y:bT+aH+4,w:1,h:10}
          ].map((l,i)=><div key={i} style={{position:'absolute',left:l.x,top:l.y,width:l.w,height:l.h,background:'#aaa',pointerEvents:'none'}}/>)}
          {photo.showCaption && (
            <div style={{ position:'absolute', left:bS, bottom:Math.round(bB*0.2), width:aW,
              display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>
              <input type="text" placeholder={t('photo_print.caption_placeholder')}
                value={photo.polaroidText||''} onChange={e=>onTextChange?.(photo.id,e.target.value)}
                onClick={e=>e.stopPropagation()} maxLength={40}
                style={{ width:'90%', border:'none', outline:'none', background:'transparent', textAlign:'center',
                  fontSize:Math.max(10,bB*0.28)+'px', fontFamily:polaroidFont||'Dancing Script, cursive',
                  color:polaroidColor||'#222', padding:'2px 4px' }}/>
            </div>
          )}
          {(photo.zoom||1)!==1 && <div style={{ position:'absolute', bottom:bB+4, right:bS+4,
            background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:9, fontWeight:700,
            padding:'2px 6px', borderRadius:8, pointerEvents:'none' }}>{Math.round((photo.zoom||1)*100)}%</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:6 }}>
          <button onClick={()=>onCropChange(photo.id,photo.cropX,photo.cropY,Math.max(0.5,(photo.zoom||1)-0.1))}
            style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14 }}>−</button>
          <span style={{ fontSize:11, fontWeight:700, color:'#475569', minWidth:40, textAlign:'center' }}>{Math.round((photo.zoom||1)*100)}%</span>
          <button onClick={()=>onCropChange(photo.id,photo.cropX,photo.cropY,Math.min(3,(photo.zoom||1)+0.1))}
            style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14 }}>+</button>
          <button onClick={()=>onCropChange(photo.id,50,50,1)}
            style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:10, color:'#64748b' }}>↺</button>
        </div>
        <p style={{ fontSize:10, color:'#94a3b8', textAlign:'center', marginTop:4 }}>{t('photo_print.crop_hint')}</p>
      </div>
    );
  }

  // ── STANDARD / NONSTANDARD ──
  let photoW: number, photoH: number;
  if (isNonstandard) {
    const m = sizeKey.match(/([\d.]+)x([\d.]+)/);
    photoW = m ? parseFloat(m[1]) : 10;
    photoH = m ? parseFloat(m[2]) : 7.5;
  } else {
    const norm = sizeKey.replace(/\s*\(.*\)/g,'').trim().replace(/([0-9])х([0-9])/g,'$1×$2').replace(/([0-9])x([0-9])/g,'$1×$2');
    const size = STANDARD_SIZES[norm] || STANDARD_SIZES[sizeKey];
    photoW = size ? size.w : 10; photoH = size ? size.h : 15;
  }

  // Apply orientation by swapping dims when needed
  const needsSwap = (photo.orientation==='landscape' && photoW < photoH) || (photo.orientation==='portrait' && photoW > photoH);
  if (needsSwap) { const tmp=photoW; photoW=photoH; photoH=tmp; }

  const sc = MAX_W / photoW;
  const canvasW = MAX_W; const canvasH = Math.round(photoH * sc);
  // Border is 3 mm physical. sc scales cm→px based on the canvas width.
  // For landscape photos sc is smaller (more cm fit in MAX_W) so bPx would be
  // fewer pixels than portrait — the white frame looks thinner on horizontal
  // prints even though it's the same physical size. Fix: derive bPx from the
  // shorter physical dimension so the border looks visually consistent.
  const scMin = MAX_W / Math.min(photoW, photoH);
  const bPx = Math.round(((showBorder||isNonstandard)?3:0) * scMin / 10);
  const cmL = 10; const cmG = 4;

  // Cover-fit baseline. The img is rendered object-fit:contain (whole photo
  // fits inside the frame, letterboxed), then scaled by coverFactor so that
  // zoom===1 still exactly COVERS the frame — i.e. default behaviour is
  // unchanged (full-bleed, no margins). Zooming below 1 shrinks the photo
  // visible and nothing force-cropped, so the customer can finally reframe.
  const frameAR = canvasW / canvasH;
  const imgAR = (photo.width && photo.height) ? (photo.width / photo.height) : frameAR;
  const coverFactor = imgAR > frameAR ? (imgAR / frameAR) : (frameAR / imgAR);
  const effScale = (photo.zoom || 1) * coverFactor;
  const belowCover = (photo.zoom || 1) < 0.999;

  return (
    <div style={{ display:'inline-block' }}>
      <div ref={setWheelRef} style={{ width:canvasW, height:canvasH, position:'relative', background:'#fff',
        boxShadow:'0 4px 20px rgba(0,0,0,0.15)', userSelect:'none', overflow:'hidden', touchAction:'none' }} onWheel={handleWheel}>
        <div style={{ position:'absolute', left:0, top:0, width:canvasW, height:canvasH,
          overflow:'hidden', cursor:'grab', touchAction:'none' }} onPointerDown={handleMouseDown}>
          <img src={displaySrc} draggable={false} decoding="async" style={{
            position:'absolute', width:'100%', height:'100%', objectFit:'contain',
            objectPosition:`${photo.cropX||50}% ${photo.cropY||50}%`, top:0, left:0,
            transform:`scale(${effScale}) rotate(${photo.rotation||0}deg)`,
            transformOrigin:`${photo.cropX||50}% ${photo.cropY||50}%`,
            userSelect:'none', pointerEvents:'none' }}/>
        </div>
        {bPx>=1 && (<>
          <div style={{ position:'absolute', left:0, top:0, width:canvasW, height:bPx, background:'#fff', pointerEvents:'none', zIndex:5 }}/>
          <div style={{ position:'absolute', left:0, bottom:0, width:canvasW, height:bPx, background:'#fff', pointerEvents:'none', zIndex:5 }}/>
          <div style={{ position:'absolute', left:0, top:0, width:bPx, height:canvasH, background:'#fff', pointerEvents:'none', zIndex:5 }}/>
          <div style={{ position:'absolute', right:0, top:0, width:bPx, height:canvasH, background:'#fff', pointerEvents:'none', zIndex:5 }}/>
        </>)}
        {showBorder && bPx>0 && <div style={{ position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)',
          fontSize:8, color:'#999', pointerEvents:'none', zIndex:5, background:'rgba(255,255,255,0.8)',
          padding:'1px 4px', borderRadius:3, whiteSpace:'nowrap' }}>рамка 3 мм</div>}
        {bPx>=1 && [
          {x:bPx-cmG-cmL,y:bPx,w:cmL,h:1},{x:bPx,y:bPx-cmG-cmL,w:1,h:cmL},
          {x:bPx+canvasW-2*bPx+cmG,y:bPx,w:cmL,h:1},{x:bPx+canvasW-2*bPx,y:bPx-cmG-cmL,w:1,h:cmL},
          {x:bPx-cmG-cmL,y:canvasH-bPx,w:cmL,h:1},{x:bPx,y:canvasH-bPx+cmG,w:1,h:cmL},
          {x:bPx+canvasW-2*bPx+cmG,y:canvasH-bPx,w:cmL,h:1},{x:bPx+canvasW-2*bPx,y:canvasH-bPx+cmG,w:1,h:cmL},
        ].map((l,i)=><div key={i} style={{position:'absolute',left:l.x,top:l.y,width:l.w,height:l.h,background:'#999',pointerEvents:'none',zIndex:6}}/>)}
        {(photo.zoom||1)!==1 && <div style={{ position:'absolute', bottom:bPx+4, right:bPx+4,
          background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:9, fontWeight:700,
          padding:'2px 6px', borderRadius:8, pointerEvents:'none', zIndex:10 }}>{Math.round((photo.zoom||1)*100)}%</div>}
        {belowCover && <div style={{ position:'absolute', top:bPx+4, left:'50%', transform:'translateX(-50%)',
          background:'rgba(217,119,6,0.92)', color:'#fff', fontSize:9, fontWeight:700,
          padding:'2px 8px', borderRadius:8, pointerEvents:'none', zIndex:10, whiteSpace:'nowrap' }}>
          фото не заповнює рамку — будуть білі поля</div>}
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:6 }}>
        <button onClick={()=>onCropChange(photo.id,photo.cropX??50,photo.cropY??50,Math.max(0.1,(photo.zoom||1)-0.1))}
          style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14, lineHeight:1 }}>−</button>
        <input type="number" min={10} max={300} step={5} value={Math.round((photo.zoom||1)*100)}
          onChange={e=>{const v=Math.max(10,Math.min(300,parseInt(e.target.value)||100));onCropChange(photo.id,photo.cropX??50,photo.cropY??50,v/100);}}
          style={{ width:58, padding:'4px 6px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, fontWeight:700, color:'#475569', textAlign:'center', MozAppearance:'textfield' }}/>
        <span style={{ fontSize:11, color:'#94a3b8' }}>%</span>
        <button onClick={()=>onCropChange(photo.id,photo.cropX??50,photo.cropY??50,Math.min(3,(photo.zoom||1)+0.1))}
          style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:14, lineHeight:1 }}>+</button>
        <button onClick={()=>onCropChange(photo.id,50,50,1)}
          style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:10, color:'#64748b' }}>↺</button>
      </div>
      <p style={{ fontSize:10, color:'#94a3b8', textAlign:'center', marginTop:4 }}>Тягніть фото для кадрування · коліщатко для масштабу</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PhotoPrintConstructor({ productSlug, initialSize, initialFinish, initialBorder }: PhotoPrintConstructorProps) {
  const t = useT();
  const locale = useLocale();
  const { addItem } = useCartStore();
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);

  const _saved = typeof window !== 'undefined' ? (() => {
    try { return JSON.parse(sessionStorage.getItem('photoPrintSettings') || 'null'); } catch { return null; }
  })() : null;

  const [selectedSize,    setSelectedSize]   = useState(initialSize   || _saved?.size   || '');
  const [selectedFinish,  setSelectedFinish] = useState(initialFinish || _saved?.finish || '');
  const [selectedBorder,  setSelectedBorder] = useState(initialBorder || _saved?.border || 'none');
  const [activePhotoIdx,  setActivePhotoIdx] = useState(0);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [polaroidFont,  setPolaroidFont]  = useState(POLAROID_FONTS[0].value);
  const [polaroidColor, setPolaroidColor] = useState(POLAROID_COLORS[0].value);
  const [showCartModal, setShowCartModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const isPolaroid    = productSlug === 'polaroid-print';
  const isNonstandard = productSlug === 'photoprint-nonstandard';
  const isMagnet      = productSlug === 'photomagnets';
  // For magnets, "polaroid behaviour" (render + caption) follows the SELECTED
  // size, not the product. For photo prints it follows the product as before.
  const polaroidActive = isPolaroid || (isMagnet && isPolaroidSizeLabel(selectedSize));

  useEffect(() => {
    if (selectedSize || selectedFinish) {
      try { sessionStorage.setItem('photoPrintSettings', JSON.stringify({ size: selectedSize, finish: selectedFinish, border: selectedBorder })); } catch {}
    }
  }, [selectedSize, selectedFinish, selectedBorder]);

  useEffect(() => {
    if (!isPolaroid && !isMagnet) return;
    const families = POLAROID_FONTS.map(f => f.label.replace(/ /g,'+')).join('&family=');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    async function fetchProduct() {
      const { data } = await supabase.from('products').select('*, translations').eq('slug', productSlug).eq('is_active', true).single();
      if (data) {
        setProduct(data);
        const opts = (data.options as ProductOption[]) || [];
        const sizeOpt = opts.find(o => o.name === t('constructor.size')) || opts.find(o => o.name === t('constructor.format'));
        const allSizes = sizeOpt?.values || sizeOpt?.options?.map(o=>({name:o.label})) || [];
        const filteredSizes = isNonstandard ? allSizes.filter(s => !!getNonstandardConfig(s.name)) : allSizes;
        if (filteredSizes.length > 0) {
          // Respect a size handed in from the catalog page (?size=) or a size
          // restored from a previous session, matching it back to a real option
          // by its normalised key. Only fall back to the first size when there
          // is no match — previously this effect always clobbered the choice.
          const desired = initialSize || _saved?.size;
          const matched = desired
            ? filteredSizes.find(s => getSizeKey(s.name) === getSizeKey(desired) || normKey(s.name) === normKey(desired))
            : null;
          setSelectedSize((matched || filteredSizes[0]).name || '');
        }
        const fOpt = opts.find(o => o.name === t('constructor.coating'));
        const finishes = fOpt?.values || fOpt?.options?.map(o=>({name:o.label})) || [];
        if (finishes.length > 0) setSelectedFinish(finishes[0].name || '');
      }
      setLoading(false);
    }
    fetchProduct();
  }, [productSlug]);

  // ── Selection ──────────────────────────────────────────────────────────────
  const allSelected    = photos.length > 0 && selectedPhotoIds.size === photos.length;
  const toggleSelect   = (id: string) => setSelectedPhotoIds(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const selectAll      = () => setSelectedPhotoIds(new Set(photos.map(p=>p.id)));
  const clearSelection = () => setSelectedPhotoIds(new Set());

  // The edit panel acts on the current selection; when nothing is selected it
  // falls back to the single active photo (the one shown in the big preview),
  // so the panel stays usable as long as there is at least one photo.
  const effectiveIds: Set<string> = selectedPhotoIds.size > 0
    ? selectedPhotoIds
    : (photos[activePhotoIdx] ? new Set([photos[activePhotoIdx].id]) : new Set<string>());
  const effectivePhotos = photos.filter(p => effectiveIds.has(p.id));

  // ── Bulk ops ───────────────────────────────────────────────────────────────
  const rotateSelected = (dir: 'cw'|'ccw') => setPhotos(prev => prev.map(p => {
    if (!effectiveIds.has(p.id)) return p;
    return { ...p, rotation: ((p.rotation||0)+(dir==='cw'?90:-90)+360)%360 };
  }));

  const setOrientationSelected = (o: 'portrait'|'landscape') => setPhotos(prev => prev.map(p => {
    if (!effectiveIds.has(p.id)) return p;
    // Orientation controls the PRINT (frame) shape only. The photo is fitted
    // into that frame via objectFit:cover in the renderer, so we must NOT
    // force-rotate it — doing so laid a normal photo on its side. The user's
    // own rotation (rotateSelected) is preserved untouched.
    return { ...p, orientation: o };
  }));

  // setBorderSelected was the per-photo override; removed together with
  // the per-photo "Рамочка" block — the global setting now controls all.
  const setQtySelected     = (d: number)  => setPhotos(prev => prev.map(p => effectiveIds.has(p.id) ? {...p,qty:Math.max(1,(p.qty||1)+d)} : p));
  const setQtyExact        = (qty: number)=> setPhotos(prev => prev.map(p => effectiveIds.has(p.id) ? {...p,qty:Math.max(1,qty)} : p));

  const toggleCaptionSelected = () => setPhotos(prev => prev.map(p => {
    if (!effectiveIds.has(p.id)) return p;
    const next = !p.showCaption;
    return { ...p, showCaption: next, polaroidText: next ? (p.polaroidText||'') : '' };
  }));

  const duplicateSelected = () => {
    const dupes = photos.filter(p=>effectiveIds.has(p.id)).map(p=>({...p,id:Math.random().toString(36).slice(7)+Date.now()}));
    setPhotos(prev=>[...prev,...dupes]);
    toast.success(t('photo_print.duplicated').replace('{n}',String(dupes.length)));
  };

  const deleteSelected = () => {
    const count = effectiveIds.size;
    setPhotos(prev=>prev.filter(p=>!effectiveIds.has(p.id)));
    clearSelection(); setActivePhotoIdx(0);
    toast.success(t('photo_print.deleted').replace('{n}',String(count)));
  };

  const removePhoto = (id: string) => setPhotos(prev => {
    const u = prev.filter(p=>p.id!==id);
    if (activePhotoIdx >= u.length) setActivePhotoIdx(Math.max(0,u.length-1));
    return u;
  });

  const updateCrop = (id: string, cropX: number, cropY: number, zoom: number) =>
    setPhotos(prev=>prev.map(p=>p.id===id?{...p,cropX,cropY,zoom}:p));

  const updateText = (id: string, text: string) =>
    setPhotos(prev=>prev.map(p=>p.id===id?{...p,polaroidText:text}:p));

  // ── File select ────────────────────────────────────────────────────────────
  // Generate a tiny JPEG thumbnail (max 400px on the long side) from the
  // uploaded file. The thumbnail's objectURL is what the editor binds to
  // <img src="..."> in the grid and the active-photo viewer. Without
  // this, every preview <img> decodes the full 5-15 MB source file —
  // with 26 professional photos that ate hundreds of MB of GPU memory
  // and stalled the UI for seconds whenever React re-rendered the grid.
  //
  // The original file stays attached to the PhotoFile (photo.file) and is
  // re-decoded only when the order is finalised in renderStandard /
  // renderPolaroid, where full resolution actually matters. Returns the
  // thumbnail URL plus the natural dimensions of the source.
  const makeThumbnail = async (file: File): Promise<{ url: string; w: number; h: number } | null> => {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const ow = bmp.width, oh = bmp.height;
      const max = 400;
      const scale = Math.min(1, max / Math.max(ow, oh));
      const tw = Math.max(1, Math.round(ow * scale));
      const th = Math.max(1, Math.round(oh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) { bmp.close?.(); return null; }
      ctx.drawImage(bmp, 0, 0, tw, th);
      bmp.close?.();
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.78));
      if (!blob) return null;
      return { url: URL.createObjectURL(blob), w: ow, h: oh };
    } catch {
      return null;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files||files.length===0) return;
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    const room = Math.max(0, 500 - photos.length);
    if (room === 0) { toast.error(t('photo_print.max_photos')); return; }
    const queue = list.slice(0, room);
    if (queue.length < list.length) toast.error(t('photo_print.max_photos'));

    // Parallel processing in small batches. Doing 26 files serially blocks
    // the main thread for ~5s; batching by 4 keeps each chunk fast enough
    // that paint can interleave, and the user sees photos appear in waves
    // instead of one frozen wait. setPhotos is called after every batch
    // so React renders the growing grid incrementally.
    const BATCH = 4;
    let added = 0;
    for (let start = 0; start < queue.length; start += BATCH) {
      const slice = queue.slice(start, start + BATCH);
      const built = await Promise.all(slice.map(async (file) => {
        const thumb = await makeThumbnail(file);
        if (!thumb) return null;
        return {
          id: Math.random().toString(36).slice(7),
          file,
          preview: thumb.url,
          width: thumb.w,
          height: thumb.h,
          cropX: 50, cropY: 50, zoom: 1, rotation: 0,
          // Default to portrait for every photo type (standard / nonstandard /
          // polaroid). Previously the orientation was auto-derived from the
          // source aspect ratio, so wide photos defaulted to landscape; the
          // customer can still flip it per photo with the orientation toggle.
          orientation: 'portrait',
          border: selectedBorder === 'with',
          qty: 1,
          showCaption: false,
        } as PhotoFile;
      }));
      const ok = built.filter(Boolean) as PhotoFile[];
      if (ok.length) {
        setPhotos(prev => [...prev, ...ok]);
        added += ok.length;
      }
    }
    if (added) {
      toast.success(t('photo_print.uploaded').replace('{n}', String(added)));
      setActivePhotoIdx(photos.length);
    }
  };

  // ── Options ────────────────────────────────────────────────────────────────
  const getSizeOptions = () => {
    if (!product) return [];
    const opts = (product.options as ProductOption[])||[];
    // Polaroid stores its size option under t('constructor.format') in the DB; standard /
    // nonstandard use t('constructor.size'). Without checking t('constructor.format') the polaroid size
    // boxes were greyed-out and unclickable (no options resolved).
    const sizeOpt = opts.find(o=>o.name===t('constructor.size')) || opts.find(o=>o.name===t('constructor.format'));
    const all = sizeOpt?.values||sizeOpt?.options?.map(o=>({name:o.label,price:o.price}))||[];
    if (isNonstandard) return all.filter(o=>!!getNonstandardConfig(o.name));
    return all;
  };

  const getFinishOptions = () => {
    if (!product) return [];
    const opts = (product.options as ProductOption[])||[];
    const fOpt = opts.find(o=>o.name===t('constructor.coating'));
    return fOpt?.values||fOpt?.options?.map(o=>({name:o.label}))||[];
  };

  // ── Price ──────────────────────────────────────────────────────────────────
  const totalQty = photos.reduce((s,p)=>s+(p.qty||1),0);

  const calculatePrice = () => {
    if (!product||photos.length===0) return 0;
    // Magnets: price by whole sets (one set = MAGNET_SET_PRICE regardless of
    // size), plus +POLAROID_TEXT_PRICE per polaroid magnet that has a caption.
    if (isMagnet) {
      const m = getMagnetMultiple(selectedSize);
      const sets = m>0 ? Math.ceil(totalQty/m) : 0;
      let total = sets * MAGNET_SET_PRICE;
      if (polaroidActive) total += photos.filter(p=>p.showCaption&&p.polaroidText?.trim()).length * POLAROID_TEXT_PRICE;
      return total;
    }
    const sizeOpts = getSizeOptions();
    const base = product.price||0;
    const getU = (lbl: string) => {
      if (!lbl) return base;
      const sel = sizeOpts.find(o=>o.name===lbl);
      if (!sel) return base;
      // Polaroid's Формат options carry price:0 in the DB — the real flat
      // per-photo price (7.5) is product.price. A 0/absent option price means
      // "use base", not "free". Only a positive option price overrides base.
      if (sel.price!=null && sel.price>0) return sel.price;
      if ((sel as any).priceModifier!=null) return base+((sel as any).priceModifier||0);
      return base;
    };
    let total=0;
    for (const p of photos) total += getU(p.sizeOverride||selectedSize)*(p.qty||1);
    if (polaroidActive) total += photos.filter(p=>p.showCaption&&p.polaroidText?.trim()).length * POLAROID_TEXT_PRICE;
    return total;
  };

  // ── Qty validation ─────────────────────────────────────────────────────────
  const nsConfig  = isNonstandard && selectedSize ? getNonstandardConfig(selectedSize) : null;
  const multiple  = isMagnet ? getMagnetMultiple(selectedSize)
    : isNonstandard ? (nsConfig?.multiple ?? 1)
    : (isPolaroid ? getPolaroidMultiple(selectedSize) : 1);
  // Magnets: minimum is exactly one full set. Photo prints keep the >=20 rule
  // (smallest multiple of `multiple` that is >= 20, so both rules hold at once).
  const minQty    = isMagnet ? multiple
    : isNonstandard && nsConfig
    ? nonstandardMinQty(nsConfig.multiple)
    : (isPolaroid && multiple > 1 ? nonstandardMinQty(multiple) : 20);
  const qtyOk     = photos.length>0 && totalQty>=minQty && (multiple<=1 || totalQty%multiple===0);

  // ── Add to cart ────────────────────────────────────────────────────────────
  const handleAddToCart = async () => {
    if (photos.length===0) { toast.error(t('photo_print.add_photo_first')); return; }
    if (totalQty<minQty) { toast.error(`Мінімальне замовлення: ${minQty} шт. Зараз: ${totalQty}.`); return; }
    if (multiple>1&&totalQty%multiple!==0) { toast.error(`Кількість має бути кратною ${multiple}. Зараз: ${totalQty}.`); return; }

    const cartItemId = `${product.id}_${Date.now()}`;
    const magnetSets = isMagnet && multiple>0 ? Math.ceil(totalQty/multiple) : 0;
    const cartPayload = {
      id: cartItemId, product_id:product.id, name:product.name,
      price:calculatePrice(), image:product.images?.[0]||'', slug:product.slug,
      options:{ 'Кількість фото':totalQty.toString(),
        ...(selectedSize&&{'Розмір':selectedSize}), ...(selectedFinish&&{'Покриття':selectedFinish}),
        ...(isMagnet
          ? {'Наборів':magnetSets.toString()}
          : (isNonstandard?{'Біла рамочка':'Так'}:(!isPolaroid?{'Біла рамочка':selectedBorder==='with'?'Так':'Ні'}:{}))) },
      qty:1,
      personalization_note: isMagnet
        ? `${magnetSets} набір(ів) · ${totalQty} магнітів${polaroidActive ? `. Написи: ${photos.filter(p=>p.showCaption&&p.polaroidText?.trim()).map((p)=>`магніт ${photos.indexOf(p)+1}: "${p.polaroidText}"`).join(', ')||'немає'}` : ''}`
        : polaroidActive
        ? `${totalQty} фото. Написи: ${photos.filter(p=>p.showCaption&&p.polaroidText?.trim()).map((p,i)=>`фото ${photos.indexOf(p)+1}: "${p.polaroidText}"`).join(', ')||'немає'}`
        : `${totalQty} фото для друку`,
    };

    addItem(cartPayload);

    // Render and upload the customer's adjusted print, NOT the original
    // file. Diana wants the manager to receive "ready-to-print" images
    // that look pixel-for-pixel like what the customer saw on screen:
    //
    //   • Standard prints — apply crop / zoom / rotation onto a canvas at
    //     the chosen physical size × 300 DPI (e.g. 10×15 cm → 1181×1772),
    //     export JPEG q=0.95. This is a pure canvas draw, no DOM walk.
    //
    //   • Polaroid prints — build a hidden, full-resolution copy of the
    //     same DOM the customer sees (image + white frame + caption with
    //     their chosen font and colour), then html2canvas it. The hidden
    //     copy lives at totalW×totalH × 300 DPI cm so the resulting JPEG
    //     is print-ready. Fonts are awaited before the snapshot so the
    //     caption isn't a fallback.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userKey = user?.id || 'anon';
      const exportedFiles: any[] = [];

      // Wait once for any web fonts to be ready so polaroid captions
      // don't render in a fallback. document.fonts.ready resolves
      // immediately once all currently-loading fonts are settled.
      try { await (document as any).fonts?.ready; } catch {}

      // Lazy-load html2canvas only on checkout so the page itself stays
      // fast. The package is already in the bundle so this is just a
      // dynamic import resolution.
      let html2canvas: any = null;
      try {
        const mod: any = await import('html2canvas');
        html2canvas = mod.default || mod;
      } catch (e) {
        console.warn('html2canvas import failed:', e);
      }

      // Resolve the physical print size in centimetres for this order so
      // the canvas can be sized at 300 DPI.
      const dpi = 300;
      const cmToPx = (cm: number) => Math.round((cm / 2.54) * dpi);

      const stdKey = (selectedSize || '').replace(/\s*\(.*\)/g, '').trim()
        .replace(/([0-9])х([0-9])/g, '$1×$2').replace(/([0-9])×([0-9])/g, '$1x$2');
      const stdSize = STANDARD_SIZES[stdKey];
      const polKey = (selectedSize || '').replace(/[^\d.x×]/g, '').replace('×', 'x').replace(/x+/, 'x');
      const polSize = POLAROID_SIZES[polKey];

      // Render one standard print (crop + zoom + rotation, no frame)
      const renderStandard = async (photo: any): Promise<Blob | null> => {
        return await new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              // Decide the print size in pixels at 300 DPI. Take the
              // per-photo sizeOverride if the customer set one (used by
              // nonstandard); otherwise use the cart-level size.
              const sizeKey = (photo.sizeOverride || selectedSize || '10x15')
                .replace(/\s*\(.*\)/g, '').trim()
                .replace(/([0-9])х([0-9])/g, '$1×$2').replace(/([0-9])×([0-9])/g, '$1x$2');
              const sized = STANDARD_SIZES[sizeKey];
              // Default to 10×15 cm if the size string is unrecognised.
              const baseW = sized ? sized.w : 10;
              const baseH = sized ? sized.h : 15;
              // Honour landscape orientation by swapping dimensions.
              const isLandscape = photo.orientation === 'landscape';
              const targetW = cmToPx(isLandscape ? baseH : baseW);
              const targetH = cmToPx(isLandscape ? baseW : baseH);

              const z = photo.zoom || 1;
              const naturalW = img.naturalWidth;
              const naturalH = img.naturalHeight;
              // Aspect-fit the source into the target while zooming.
              // The CSS `objectFit:cover` semantics: scale image so its
              // shorter side fills the box, longer side overflows, then
              // position by cropX/cropY.
              const sourceRatio = naturalW / naturalH;
              const targetRatio = targetW / targetH;
              // Visible source rectangle inside the natural image
              let srcW: number, srcH: number;
              if (sourceRatio > targetRatio) {
                // Source is wider than target — crop horizontally
                srcH = naturalH / z;
                srcW = srcH * targetRatio;
              } else {
                srcW = naturalW / z;
                srcH = srcW / targetRatio;
              }
              // cropX/Y are 0–100 % positions inside the natural image.
              const cx = ((photo.cropX ?? 50) / 100) * (naturalW - srcW);
              const cy = ((photo.cropY ?? 50) / 100) * (naturalH - srcH);

              const canvas = document.createElement('canvas');
              canvas.width = targetW;
              canvas.height = targetH;
              const ctx = canvas.getContext('2d');
              if (!ctx) { resolve(null); return; }
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              const rot = photo.rotation || 0;
              if (rot !== 0) {
                ctx.translate(targetW / 2, targetH / 2);
                ctx.rotate((rot * Math.PI) / 180);
                ctx.drawImage(img, cx, cy, srcW, srcH,
                              -targetW / 2, -targetH / 2, targetW, targetH);
              } else {
                ctx.drawImage(img, cx, cy, srcW, srcH, 0, 0, targetW, targetH);
              }
              // 3 mm white border, drawn as four rectangles on top of the
              // photo. Triggered by photo.border (per-photo) or by the
              // nonstandard product which always carries a white border.
              // 3 mm at 300 DPI = (3 / 25.4) * 300 ≈ 35 px.
              const drawBorder = photo.border === true || isNonstandard;
              if (drawBorder) {
                // Reset any transform left over from rotation
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                const bw = Math.round((3 / 25.4) * dpi);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, targetW, bw);                    // top
                ctx.fillRect(0, targetH - bw, targetW, bw);          // bottom
                ctx.fillRect(0, 0, bw, targetH);                     // left
                ctx.fillRect(targetW - bw, 0, bw, targetH);          // right
              }
              canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
            } catch (e) {
              console.warn('renderStandard failed:', e);
              resolve(null);
            }
          };
          img.onerror = () => { try { URL.revokeObjectURL(srcUrl); } catch {}; resolve(null); };
          // Load the FULL-resolution source for printing — photo.preview now
          // points at the 400px display thumbnail (added for editor perf),
          // which would print as a blurry mess at 300 DPI. The original
          // file is still kept on photo.file. Create a one-shot objectURL
          // from it, draw, then revoke once decoded.
          const srcUrl = URL.createObjectURL(photo.file);
          const origOnload = img.onload;
          img.onload = function() {
            try { (origOnload as any).call(img); } finally { try { URL.revokeObjectURL(srcUrl); } catch {} }
          };
          img.src = srcUrl;
        });
      };

      // Render one polaroid: build the same DOM the user saw, scaled up
      // to 300 DPI, then snapshot it with html2canvas.
      const renderPolaroid = async (photo: any): Promise<Blob | null> => {
        if (!polSize || !html2canvas) return null;
        const isLandscape = photo.orientation === 'landscape';
        const totalW = isLandscape ? polSize.totalH : polSize.totalW;
        const totalH = isLandscape ? polSize.totalW : polSize.totalH;
        const canvasW = cmToPx(totalW);
        const canvasH = cmToPx(totalH);
        const bS = cmToPx(polSize.borderSide);
        const bT = cmToPx(polSize.borderTop);
        const bB = cmToPx(polSize.borderBottom);
        const aW = canvasW - bS * 2;
        const aH = canvasH - bT - bB;

        // Build the hidden DOM. It mirrors the preview component above,
        // just sized at print resolution and parked off-screen.
        const root = document.createElement('div');
        root.style.cssText = `position:fixed;left:-99999px;top:0;width:${canvasW}px;height:${canvasH}px;background:#fff;`;
        const photoBox = document.createElement('div');
        photoBox.style.cssText = `position:absolute;left:${bS}px;top:${bT}px;width:${aW}px;height:${aH}px;overflow:hidden;background:#f0f0f0;`;
        const im = document.createElement('img');
        im.crossOrigin = 'anonymous';
        // Load the FULL-resolution source — photo.preview is now the 400px
        // editor thumbnail and would print blurry. Revoke after the
        // snapshot to free the blob.
        const polSrc = URL.createObjectURL(photo.file);
        im.src = polSrc;
        im.style.cssText = `width:${(photo.zoom || 1) * 100}%;height:${(photo.zoom || 1) * 100}%;object-fit:cover;object-position:${photo.cropX}% ${photo.cropY}%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(${photo.rotation || 0}deg);`;
        photoBox.appendChild(im);
        root.appendChild(photoBox);

        if (photo.showCaption && photo.polaroidText) {
          const caption = document.createElement('div');
          // Caption position mirrors the preview: sat inside the thick
          // bottom border, vertically centred on the lower 20 % of it.
          const captionBottom = Math.round(bB * 0.2);
          const fontPx = Math.max(20, Math.round(bB * 0.28));
          caption.style.cssText = `position:absolute;left:${bS}px;bottom:${captionBottom}px;width:${aW}px;display:flex;align-items:center;justify-content:center;font-family:${polaroidFont || 'Dancing Script, cursive'};color:${polaroidColor || '#222'};font-size:${fontPx}px;text-align:center;line-height:1;`;
          caption.textContent = photo.polaroidText;
          root.appendChild(caption);
        }

        document.body.appendChild(root);
        try {
          // Wait one paint frame so the image is decoded and laid out.
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          // And give the <img> a moment to actually load if it isn't ready
          if (!im.complete) {
            await new Promise<void>((r) => { im.onload = () => r(); im.onerror = () => r(); });
          }
          const snap: HTMLCanvasElement = await html2canvas(root, {
            backgroundColor: '#ffffff',
            useCORS: true,
            scale: 1, // root is already at full print size
            logging: false,
            width: canvasW,
            height: canvasH,
          });
          return await new Promise<Blob | null>((resolve) => {
            snap.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
          });
        } catch (e) {
          console.warn('renderPolaroid failed:', e);
          return null;
        } finally {
          try { document.body.removeChild(root); } catch {}
          try { URL.revokeObjectURL(polSrc); } catch {}
        }
      };

      // Now render and upload each photo at print resolution
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        let blob = polaroidActive ? await renderPolaroid(photo) : await renderStandard(photo);
        if (!blob) continue;
        // Patch JPEG metadata for the print shop:
        //   • DPI tag 300×300 (was 96×96 from the browser default)
        //   • Embed standard sRGB ICC v2 profile
        // Both are byte-level edits — pixel data is untouched.
        blob = await setJpegDpi300(blob);
        blob = await embedSRGBProfile(blob);
        const baseRaw = (photo.file?.name || `photo_${i + 1}.jpg`)
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/\.(jpe?g|png|webp|heic|heif|tiff?)$/i, '');
        const fileName = `${String(i + 1).padStart(3, '0')}_${baseRaw}_print.jpg`;
        const path = `${userKey}/${cartItemId}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('order-files')
          .upload(path, blob, {
            cacheControl: '31536000', upsert: true, contentType: 'image/jpeg',
          });
        if (uploadError) { console.warn('photo-print render upload failed:', uploadError); continue; }
        exportedFiles.push({
          path, fileName, bucket: 'order-files',
          fileCategory: isMagnet ? 'photomagnets' : (polaroidActive ? 'polaroid-print' : 'photo-print'),
          productType: isMagnet ? 'photomagnets' : 'photoprint',
          fileType: 'export', size: blob.size, mimeType: 'image/jpeg',
          pageNumber: i + 1,
        });
      }
      if (exportedFiles.length > 0) {
        sessionStorage.setItem(`export_${cartItemId}`, JSON.stringify(exportedFiles));
      }
    } catch (e) {
      console.warn('photo-print storage step skipped:', e);
    }

    try {
      const { data:{user} } = await supabase.auth.getUser();
      if (user) await supabase.from('projects').insert({
        user_id:user.id, product_type:isMagnet?'photomagnets':'photo-print', format:selectedSize||'', status:'draft',
        pages_data:photos.map(p=>({id:p.id,cropX:p.cropX,cropY:p.cropY,zoom:p.zoom,
          rotation:p.rotation,orientation:p.orientation,qty:p.qty,sizeOverride:p.sizeOverride,
          polaroidText:p.polaroidText,showCaption:p.showCaption})),
        cart_payload:cartPayload,
        uploaded_photos:photos.map(p=>p.preview), updated_at:new Date().toISOString(),
      });
    } catch(e) { console.warn('Design save skipped:',e); }

    setPhotos([]);
    setShowCartModal(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">{t('photo_print.loading')}</div>;
  if (!product) return <div className="flex items-center justify-center py-12 text-red-500">{t('photo_print.not_found')}</div>;

  const activePhoto   = photos[activePhotoIdx];
  const sizeOptions   = getSizeOptions();
  const finishOptions = getFinishOptions();
  const sizeKey       = getSizeKey(selectedSize);
  const showBorder    = isNonstandard || (!isPolaroid && selectedBorder === 'with');
  const hasBorderOpt  = !isNonstandard && !isPolaroid && (product.options as ProductOption[])?.some(o=>o.name===t('constructor.white_border_3mm'));
  const captionPhotos = photos.filter(p=>p.showCaption&&p.polaroidText?.trim());

  const BTN = (active: boolean) => ({
    padding:'6px 14px', borderRadius:8, fontWeight:600 as const, fontSize:12, cursor:'pointer' as const,
    border: active?'2px solid #1e2d7d':'1px solid #e2e8f0',
    background: active?'#f0f3ff':'#fff', color: active?'#1e2d7d':'#374151',
  });

  return (
  <>
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 16px', fontFamily:'var(--font-primary, sans-serif)' }}>
      <h1 style={{ fontSize:28, fontWeight:800, color:'#1e2d7d', marginBottom:8 }}>{getLocalized(product,locale,'name')}</h1>
      {(() => {
        // For nonstandard, once a size is picked, replace the generic "Будь-який
        // нестандартний розмір ..." subtitle with one that names the actual
        // size + its per-unit price + the size's required multiple. Helps the
        // customer keep track of what they chose when scrolling.
        const baseSub = getLocalized(product,locale,'short_description') as string;
        if (isNonstandard && selectedSize) {
          const cfg = getNonstandardConfig(selectedSize);
          const sizeOpt = sizeOptions.find(o => o.name === selectedSize);
          const unitPrice = (sizeOpt as any)?.price ?? product.price ?? 0;
          const cleanSize = normKey(selectedSize).replace('×', '×');
          const parts: string[] = [`Розмір ${cleanSize} см`];
          if (unitPrice) parts.push(`${unitPrice} ₴/шт`);
          if (cfg) parts.push(`кратно ${cfg.multiple}`);
          parts.push('Fujicolor Crystal Archive', 'з білою рамкою 3мм');
          return <p style={{ color:'#64748b', marginBottom:24 }}>{parts.join(' · ')}</p>;
        }
        return <p style={{ color:'#64748b', marginBottom:24 }}>{baseSub}</p>;
      })()}

      <div style={{ display:'flex', gap:32, flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* ── LEFT ── */}
        <div style={{ flex:'0 0 auto', width:'100%', maxWidth:340 }}>

          {/* Polaroid size visualizer */}
          {isPolaroid && (
            <div style={{ display:'flex', gap:16, marginBottom:16, alignItems:'flex-end', justifyContent:'center' }}>
              {Object.entries(POLAROID_SIZES).map(([key,s]) => {
                const viz = 55 / s.totalW;
                const wV = Math.round(s.totalW*viz); const hV = Math.round(s.totalH*viz);
                const active = getSizeKey(selectedSize)===key;
                const opt = sizeOptions.find(o=>getSizeKey(o.name)===key);
                return (
                  <div key={key} onClick={()=>opt&&setSelectedSize(opt.name)}
                    style={{ cursor:opt?'pointer':'default', textAlign:'center', opacity:opt?1:0.4 }}>
                    <div style={{ width:wV, height:hV, background:active?'#e8ecff':'#f1f5f9',
                      border:`2px solid ${active?'#1e2d7d':'#cbd5e1'}`, borderRadius:3, position:'relative',
                      boxShadow:active?'0 2px 8px rgba(30,45,125,0.2)':'none', transition:'all 0.15s' }}>
                      <div style={{ position:'absolute', bottom:Math.round(s.borderBottom*viz), left:0, right:0,
                        height:1, background:active?'rgba(30,45,125,0.4)':'rgba(0,0,0,0.1)' }}/>
                    </div>
                    <div style={{ fontSize:9, marginTop:3, fontWeight:active?700:400,
                      color:active?'#1e2d7d':'#64748b' }}>{s.label}</div>
                    {opt && <div style={{ fontSize:8, color:'#94a3b8' }}>{(opt.price && opt.price>0) ? opt.price : (product.price ?? 0)} ₴</div>}
                  </div>
                );
              })}
            </div>
          )}

          {activePhoto ? (
            <div>
              <PhotoPreview photo={activePhoto} sizeKey={sizeKey||'10x15'} showBorder={!isMagnet && (isNonstandard || (!isPolaroid && activePhoto.border))}
                isPolaroid={polaroidActive} isNonstandard={isNonstandard}
                onCropChange={updateCrop} onTextChange={polaroidActive?updateText:undefined}
                polaroidFont={polaroidFont} polaroidColor={polaroidColor}/>
              {photos.length>1 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:12 }}>
                  <button onClick={()=>setActivePhotoIdx(i=>Math.max(0,i-1))} disabled={activePhotoIdx===0}
                    style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', opacity:activePhotoIdx===0?0.3:1 }}>←</button>
                  <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>{activePhotoIdx+1} / {photos.length}</span>
                  <button onClick={()=>setActivePhotoIdx(i=>Math.min(photos.length-1,i+1))} disabled={activePhotoIdx===photos.length-1}
                    style={{ padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer', opacity:activePhotoIdx===photos.length-1?0.3:1 }}>→</button>
                </div>
              )}
            </div>
          ) : (
            <div onDrop={async e=>{e.preventDefault();setDragging(false);await handleFileSelect(e.dataTransfer.files);}}
              onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
              onClick={()=>fileInputRef.current?.click()}
              style={{ width:320, height:280, border:`2px dashed ${dragging?'#1e2d7d':'#cbd5e1'}`, borderRadius:12,
                background:dragging?'#dbeafe':'#f8fafc', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:12, cursor:'pointer', transition:'all 0.2s' }}>
              <Upload size={40} color="#1e2d7d"/>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontWeight:700, color:'#1e2d7d', fontSize:15 }}>{t('photo_print.upload_photos')}</div>
                <div style={{ color:'#94a3b8', fontSize:12, marginTop:4 }}>{t('photo_print.or_drag')}</div>
              </div>
              <button style={{ padding:'8px 20px', background:'#1e2d7d', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {t('photo_print.select_photos_btn')}
              </button>
            </div>
          )}

          {photos.length>0 && (
            <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap', maxWidth:320 }}>
              {photos.map((ph,idx)=>(
                <div key={ph.id} onClick={()=>setActivePhotoIdx(idx)}
                  style={{ position:'relative', width:52, height:52, borderRadius:6, overflow:'hidden',
                    border:idx===activePhotoIdx?'2px solid #1e2d7d':'2px solid transparent', cursor:'pointer', flexShrink:0 }}>
                  <img src={ph.preview} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover',
                    transform:`rotate(${ph.rotation||0}deg)`, transition:'transform 0.2s' }}/>
                  <div onMouseDown={e=>{e.stopPropagation();toggleSelect(ph.id);}}
                    style={{ position:'absolute', top:2, left:2, width:16, height:16, borderRadius:3,
                      background:selectedPhotoIds.has(ph.id)?'#e05a2b':'rgba(255,255,255,0.8)',
                      border:selectedPhotoIds.has(ph.id)?'2px solid #e05a2b':'2px solid rgba(0,0,0,0.2)',
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:900 }}>
                    {selectedPhotoIds.has(ph.id)?'✓':''}
                  </div>
                  {(ph.qty||1)>1 && <div style={{ position:'absolute', bottom:1, right:1, background:'#1e2d7d', color:'#fff', fontSize:9, fontWeight:800, padding:'1px 4px', borderRadius:4 }}>×{ph.qty}</div>}
                  {ph.showCaption && <div style={{ position:'absolute', bottom:1, left:1, fontSize:8, background:'rgba(30,45,125,0.85)', color:'#fff', borderRadius:3, padding:'1px 3px' }}>T</div>}
                  <button onClick={e=>{e.stopPropagation();removePhoto(ph.id);}}
                    style={{ position:'absolute',top:1,right:1,width:16,height:16,borderRadius:'50%',
                      background:'rgba(239,68,68,0.85)',color:'#fff',border:'none',cursor:'pointer',
                      fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',opacity:0 }} className="thumb-del">×</button>
                </div>
              ))}
              <style>{`.thumb-del{opacity:0!important} div:hover>.thumb-del{opacity:1!important}`}</style>
              <div onClick={()=>fileInputRef.current?.click()}
                style={{ width:52, height:52, borderRadius:6, border:'2px dashed #cbd5e1',
                  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#94a3b8', fontSize:20, flexShrink:0 }}>+</div>
            </div>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div style={{ flex:1, minWidth:0, width:'100%' }}>

          {/* Selection panel */}
          {photos.length>0 && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:16, marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:700, fontSize:14, color:'#1e2d7d' }}>
                  <input type="checkbox" checked={allSelected} onChange={e=>e.target.checked?selectAll():clearSelection()}
                    style={{ width:16, height:16, accentColor:'#e05a2b', cursor:'pointer' }}/>
                  Вибрати всі
                </label>
                {selectedPhotoIds.size>0 && (
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:12, color:'#64748b' }}>{t('photo_print.selected_photos')} <b>{selectedPhotoIds.size}</b></span>
                    <button onClick={clearSelection} style={{ fontSize:12, color:'#e05a2b', fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>{t('photo_print.clear_selection')}</button>
                  </div>
                )}
              </div>

              {photos.length>0 && (
                <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:12 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:10 }}>
                    {selectedPhotoIds.size>0
                      ? t('photo_print.edit_selected')
                      : `Редагувати активне фото (${activePhotoIdx+1} / ${photos.length})`}
                  </div>

                  {/* Rotate + Orientation */}
                  <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>Обернути</div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={()=>rotateSelected('ccw')} style={{ width:38, height:38, border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>↺</button>
                        <button onClick={()=>rotateSelected('cw')}  style={{ width:38, height:38, border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>Орієнтація</div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={()=>setOrientationSelected('portrait')} title="Вертикально"
                          style={{ width:38, height:38, border:effectivePhotos.every(p=>p.orientation==='portrait')?'2px solid #1e2d7d':'1px solid #e2e8f0',
                            borderRadius:8, background:effectivePhotos.every(p=>p.orientation==='portrait')?'#f0f3ff':'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <div style={{ width:13, height:18, border:'2px solid currentColor', borderRadius:2, color:effectivePhotos.every(p=>p.orientation==='portrait')?'#1e2d7d':'#374151' }}/>
                        </button>
                        <button onClick={()=>setOrientationSelected('landscape')} title="Горизонтально"
                          style={{ width:38, height:38, border:effectivePhotos.every(p=>p.orientation==='landscape')?'2px solid #1e2d7d':'1px solid #e2e8f0',
                            borderRadius:8, background:effectivePhotos.every(p=>p.orientation==='landscape')?'#f0f3ff':'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <div style={{ width:18, height:13, border:'2px solid currentColor', borderRadius:2, color:effectivePhotos.every(p=>p.orientation==='landscape')?'#1e2d7d':'#374151' }}/>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Per-photo "Рамочка" block removed — the global
                      "Біла рамочка 3мм" in Налаштування now controls
                      every photo at once, so a per-photo override would
                      just duplicate the same choice in two places. */}

                  {/* Quantity */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>Кількість</div>
                    <div style={{ display:'flex', alignItems:'center', gap:0, border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden', width:'fit-content' }}>
                      <button onClick={()=>setQtySelected(-1)} style={{ width:40, height:38, border:'none', background:'#f8fafc', cursor:'pointer', fontSize:18, color:'#374151', fontWeight:700 }}>−</button>
                      <input type="number" min={1} max={999}
                        value={effectivePhotos.length===1?(effectivePhotos[0].qty||1):''}
                        placeholder={effectivePhotos.length>1?'—':'1'}
                        onChange={e=>setQtyExact(parseInt(e.target.value)||1)}
                        style={{ width:60, height:38, border:'none', borderLeft:'1px solid #e2e8f0', borderRight:'1px solid #e2e8f0',
                          textAlign:'center', fontSize:14, fontWeight:700, color:'#1e2d7d', outline:'none', MozAppearance:'textfield' }}/>
                      <button onClick={()=>setQtySelected(1)} style={{ width:40, height:38, border:'none', background:'#f8fafc', cursor:'pointer', fontSize:18, color:'#374151', fontWeight:700 }}>+</button>
                    </div>
                  </div>

                  {/* Polaroid caption toggle */}
                  {polaroidActive && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>Підпис</div>
                      <button onClick={toggleCaptionSelected}
                        style={{ ...BTN(effectivePhotos.some(p=>p.showCaption)), display:'flex', alignItems:'center', gap:6, padding:'8px 14px' }}>
                        <span>✏️</span>
                        {effectivePhotos.some(p=>p.showCaption) ? 'Підпис увімкнено (+5 ₴)' : 'Додати підпис (+5 ₴)'}
                      </button>
                      {effectivePhotos.some(p=>p.showCaption) && effectivePhotos.length===1 && (
                        <input type="text" placeholder="Введіть підпис…" maxLength={40}
                          value={effectivePhotos[0].polaroidText||''}
                          onChange={e=>updateText(effectivePhotos[0].id,e.target.value)}
                          style={{ marginTop:8, width:'100%', padding:'8px 12px', border:'1px solid #e2e8f0',
                            borderRadius:8, fontSize:13, outline:'none', fontFamily:polaroidFont, color:polaroidColor }}/>
                      )}
                    </div>
                  )}

                  {/* Per-photo size override — standard photoprint only.
                      Nonstandard and polaroid orders are keyed to ONE size
                      (per-size minimum + sheet multiple), so a per-photo size
                      would make that math incoherent and just duplicates the
                      order-level "Розмір" selector below. */}
                  {sizeOptions.length>1 && !isNonstandard && !isPolaroid && !isMagnet && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5 }}>Розмір для цих фото</div>
                      <select value={effectivePhotos.length===1?(effectivePhotos[0].sizeOverride||''):''}
                        onChange={e=>{const v=e.target.value;setPhotos(prev=>prev.map(p=>effectiveIds.has(p.id)?{...p,sizeOverride:v||undefined}:p));}}
                        style={{ width:'100%', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer' }}>
                        <option value="">— як у замовленні ({selectedSize})</option>
                        {sizeOptions.map(o=><option key={o.name} value={o.name}>{o.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <button onClick={duplicateSelected} style={{ flex:1, padding:'9px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', cursor:'pointer', fontWeight:700, fontSize:13, color:'#374151' }}>{t('photo_print.duplicate')}</button>
                    <button onClick={deleteSelected}    style={{ flex:1, padding:'9px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff7f7', cursor:'pointer', fontWeight:700, fontSize:13, color:'#ef4444' }}>{t('photo_print.delete')}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:20, marginBottom:16 }}>
            <h3 style={{ fontWeight:800, fontSize:16, color:'#1e2d7d', marginBottom:16 }}>{t('photo_print.settings')}</h3>

            {/* Counter — only the multiple/example hint is shown (the
                "N фото → N шт. мінімум N шт." summary line was removed at
                Diana's request; the same info already appears per-size and
                via the add-to-cart validation). */}
            {(isNonstandard||isPolaroid||isMagnet) && selectedSize && multiple>1 && (
              <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16,
                background: photos.length>0&&!qtyOk ? '#fff7ed':'#eff6ff',
                border:`1px solid ${photos.length>0&&!qtyOk?'#fed7aa':'#bfdbfe'}` }}>
                <div style={{ fontSize:11, color:'#64748b' }}>
                  Мінімум <b>{minQty} шт.</b>, кратно <b>{multiple}</b> — наприклад: {Array.from({length:3},(_,i)=>(Math.ceil(minQty/multiple)+i)*multiple).join(', ')} і т.д.
                </div>
              </div>
            )}

            {/* Size — для полароїд вже є візуалізатор вгорі, тому показуємо кнопки тільки якщо не полароїд */}
            {!isPolaroid && sizeOptions.length>0 && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontWeight:700, fontSize:13, color:'#374151', marginBottom:6 }}>{t('photo_print.size_label')}</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {sizeOptions.map(opt=>(
                    <button key={opt.name} onClick={()=>setSelectedSize(opt.name)} style={BTN(selectedSize===opt.name)}>
                      {opt.name.replace(/\s*см\s*/g,'').trim()}
                    </button>
                  ))}
                </div>
                {isNonstandard && nsConfig && selectedSize && (
                  <div style={{ marginTop:6, fontSize:11, color:'#64748b' }}>
                    ℹ Для розміру <b>{normKey(selectedSize)}</b> — мінімум <b>{minQty} шт.</b>, кратно <b>{nsConfig.multiple}</b>
                  </div>
                )}
              </div>
            )}

            {/* For polaroid: show size as buttons (for when user wants to switch without the visualizer) */}
            {isPolaroid && sizeOptions.length>0 && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontWeight:700, fontSize:13, color:'#374151', marginBottom:6 }}>Розмір</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {sizeOptions.map(opt=>(
                    <button key={opt.name} onClick={()=>setSelectedSize(opt.name)} style={BTN(selectedSize===opt.name)}>
                      {opt.name.replace(/\s*см\s*/g,'').trim()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Finish — hidden for magnets (always matte) */}
            {finishOptions.length>0 && !isMagnet && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontWeight:700, fontSize:13, color:'#374151', marginBottom:6 }}>{t('photo_print.finish_label')}</label>
                <div style={{ display:'flex', gap:6 }}>
                  {finishOptions.map(opt=>{
                    const lbl=(opt.name==='Глянцеве'||opt.name==='Glossy')?t('photo_print.glossy'):(opt.name==='Матове'||opt.name==='Matte')?t('photo_print.matte'):opt.name;
                    return <button key={opt.name} onClick={()=>setSelectedFinish(opt.name)} style={BTN(selectedFinish===opt.name)}>{lbl}</button>;
                  })}
                </div>
              </div>
            )}

            {/* Border */}
            {hasBorderOpt && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontWeight:700, fontSize:13, color:'#374151', marginBottom:6 }}>{t('photo_print.white_border')}</label>
                <div style={{ display:'flex', gap:6 }}>
                  {[{v:'none',l:t('photo_print.no_border_opt')},{v:'with',l:t('photo_print.with_border_opt')}].map(({v,l})=>(
                    <button key={v} onClick={()=>{
                      // The global "Біла рамочка 3мм" controls every uploaded
                      // photo — change the default AND bulk-update each
                      // already-uploaded photo so the choice is actually
                      // global (it used to only affect newly added files,
                      // which made the per-photo control redundant from the
                      // customer's POV — they expected one source of truth).
                      setSelectedBorder(v);
                      setPhotos(prev => prev.map(p => ({...p, border: v === 'with'})));
                    }} style={BTN(selectedBorder===v)}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {isNonstandard && (
              <div style={{ padding:'10px 14px', borderRadius:8, background:'#f0fdf4', border:'1px solid #bbf7d0', marginBottom:16 }}>
                <p style={{ fontSize:12, color:'#15803d', fontWeight:600, margin:0 }}>{t('photo_print.auto_border')}</p>
              </div>
            )}

            {/* Polaroid caption style */}
            {polaroidActive && photos.some(p=>p.showCaption) && (
              <div style={{ marginBottom:16, padding:'12px 14px', borderRadius:10, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:10 }}>Стиль підпису</div>
                <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Шрифт</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                  {POLAROID_FONTS.map(f=>(
                    <button key={f.value} onClick={()=>setPolaroidFont(f.value)}
                      style={{ padding:'5px 12px', borderRadius:8, cursor:'pointer', fontSize:13,
                        border:polaroidFont===f.value?'2px solid #1e2d7d':'1px solid #e2e8f0',
                        background:polaroidFont===f.value?'#f0f3ff':'#fff',
                        color:polaroidFont===f.value?'#1e2d7d':'#374151',
                        fontFamily:f.value, fontWeight:polaroidFont===f.value?700:400, transition:'all 0.15s' }}>{f.label}</button>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Колір</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                  {POLAROID_COLORS.map(c=>(
                    <button key={c.value} onClick={()=>setPolaroidColor(c.value)} title={c.label}
                      style={{ width:28, height:28, borderRadius:'50%', background:c.value, cursor:'pointer', outline:'none',
                        border:polaroidColor===c.value?'3px solid #1e2d7d':'2px solid #e2e8f0',
                        boxShadow:polaroidColor===c.value?'0 0 0 2px #fff, 0 0 0 4px #1e2d7d':'none', transition:'all 0.15s' }}/>
                  ))}
                </div>
                <p style={{ margin:0, fontSize:13, fontFamily:polaroidFont, color:polaroidColor, textAlign:'center',
                  background:'#fff', borderRadius:8, padding:'6px 12px', border:'1px solid #f1f5f9' }}>
                  {t('photo_print.caption_preview')}
                </p>
              </div>
            )}

            {/* Price */}
            <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
              {selectedSize && photos.length>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, color:'#64748b' }}>
                    {isMagnet
                      ? `${multiple>0?Math.ceil(totalQty/multiple):0} набір(ів) × ${MAGNET_SET_PRICE} ₴`
                      : `${totalQty} шт. × ${(()=>{const s=sizeOptions.find(o=>o.name===selectedSize);return s?.price??product.price??0;})()} ₴`}
                  </span>
                </div>
              )}
              {polaroidActive && captionPhotos.length>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#64748b' }}>Підпис ({captionPhotos.length} {isMagnet?'магн.':'фото'}) × {POLAROID_TEXT_PRICE} ₴</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#64748b' }}>{captionPhotos.length*POLAROID_TEXT_PRICE} ₴</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:800, fontSize:16, color:'#1e2d7d' }}>{t('photo_print.total')}</span>
                <span style={{ fontWeight:900, fontSize:26, color:'#1e2d7d' }}>{calculatePrice()} ₴</span>
              </div>
            </div>
          </div>

          <button onClick={handleAddToCart} disabled={!qtyOk}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              padding:'14px', borderRadius:10, border:'none', fontWeight:800, fontSize:16,
              background:qtyOk?'#1e2d7d':'#94a3b8', color:'#fff',
              cursor:qtyOk?'pointer':'not-allowed', transition:'all 0.2s' }}>
            <ShoppingCart size={18}/> {t('photo_print.add_to_cart')}
          </button>

          {/* Explain exactly WHY "Додати до кошика" is greyed out — used
              to be invisible reasoning, customers couldn't tell whether
              they needed more photos, the wrong multiple, or something
              else. Mirrors the bri ef's red checklist pattern. */}
          {!qtyOk && (() => {
            let msg: string | null = null;
            if (photos.length === 0) {
              msg = t('constructor.upload_photo_required');
            } else if (totalQty < minQty) {
              const need = minQty - totalQty;
              msg = isMagnet
                ? `Мінімум — один набір (${minQty} шт.). Зараз ${totalQty}. Додайте ще ${need} фото.`
                : `Мінімальне замовлення — ${minQty} шт. Зараз ${totalQty}. Додайте ще ${need} ${need === 1 ? 'фото' : 'фото'} (можна збільшити кількість одного фото або додати нові).`;
            } else if (multiple > 1 && totalQty % multiple !== 0) {
              const up = Math.ceil(totalQty / multiple) * multiple;
              const dn = Math.floor(totalQty / multiple) * multiple;
              msg = isMagnet
                ? `Кількість фото має бути кратною ${multiple} (розмір набору). Зараз ${totalQty}. Найближчі допустимі — ${dn} або ${up}.`
                : `Кількість має бути кратною ${multiple} (на одному листі друкується ${multiple} фото). Зараз ${totalQty}. Найближчі допустимі — ${dn} або ${up}.`;
            }
            if (!msg) return null;
            return (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 16px', marginTop:12 }}>
                <p style={{ margin:0, fontSize:13, color:'#b91c1c', fontWeight:600 }}>{msg}</p>
              </div>
            );
          })()}

          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e=>handleFileSelect(e.target.files)} style={{ display:'none' }}/>
        </div>
      </div>
    </div>

    {showCartModal && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999,
        display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={()=>setShowCartModal(false)}>
        <div style={{ background:'#fff', borderRadius:16, padding:32, maxWidth:380, width:'100%',
          textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e=>e.stopPropagation()}>
          <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
          <h2 style={{ fontWeight:800, fontSize:20, color:'#1e2d7d', marginBottom:8 }}>Фото додано до кошика!</h2>
          <p style={{ color:'#64748b', fontSize:14, marginBottom:24 }}>Оформити замовлення або продовжити вибирати товари?</p>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <a href={`/${locale}/cart`} style={{ display:'block', padding:'13px', background:'#1e2d7d', color:'#fff', borderRadius:10, fontWeight:800, fontSize:15, textDecoration:'none' }}>Оформити замовлення →</a>
            <a href={`/${locale}/catalog`} style={{ display:'block', padding:'13px', background:'#f1f5f9', color:'#374151', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}>Продовжити покупки</a>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
