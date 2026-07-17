'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GOOGLE_FONTS_URL } from '@/lib/editor/constants';

/**
 * Static, controls-free wall-calendar renderer for the print pipeline.
 *
 * Mirrors the geometry of MonthPreview/CalendarGrid in WallCalendarConstructor,
 * but with NO interactivity (no drag, no active-slot outline) and driven purely
 * by saved config + signed photo URLs. The render service screenshots one
 * [data-print-page] at a time at print resolution, so this draws exactly what
 * the customer designed — photo crops, layout, page style, calendar grid,
 * marked dates and cover — at any target width W.
 *
 * Kept deliberately separate from the constructor so improving print output
 * can't destabilise the live editor.
 */

const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const DAYS_UK = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

const PAGE_STYLES: Record<string, { photoRatio: number; orientation: 'vertical' | 'horizontal'; hasFooterBand?: boolean; hasMiniCal?: boolean }> = {
  'classic':        { photoRatio: 0.56, orientation: 'vertical' },
  'half':           { photoRatio: 0.50, orientation: 'vertical' },
  'photo-dominant': { photoRatio: 0.75, orientation: 'vertical' },
  'footer-band':    { photoRatio: 0.70, orientation: 'vertical', hasFooterBand: true },
  'side-by-side':   { photoRatio: 0.55, orientation: 'horizontal' },
  'mini-cal':       { photoRatio: 1.0,  orientation: 'vertical', hasMiniCal: true },
};

type Slot = { photoId: string | null; cropX: number; cropY: number; zoom: number };
type MonthPage = { id: string; month: number; year: number; layout: string; slots: Slot[]; pageStyle?: string };
type PhotoMeta = { id: string; preview: string; width?: number; height?: number };
type Mark = { day: number; shape: 'circle' | 'heart'; color: string };

function slotDefsFor(layout: string, px: number, py: number, pw: number, ph: number, g: number) {
  switch (layout) {
    case '1-full':         return [{x:px,y:py,w:pw,h:ph}];
    case '1-top':          return [{x:px,y:py,w:pw,h:ph*0.9}];
    case '2-h':            return [{x:px,y:py,w:pw,h:(ph-g)/2},{x:px,y:py+(ph-g)/2+g,w:pw,h:(ph-g)/2}];
    case '2-v':            return [{x:px,y:py,w:(pw-g)/2,h:ph},{x:px+(pw-g)/2+g,y:py,w:(pw-g)/2,h:ph}];
    case '3-top1-bot2':    return [{x:px,y:py,w:pw,h:ph*0.55},{x:px,y:py+ph*0.55+g,w:(pw-g)/2,h:ph*0.45-g},{x:px+(pw-g)/2+g,y:py+ph*0.55+g,w:(pw-g)/2,h:ph*0.45-g}];
    case '3-left1-right2': return [{x:px,y:py,w:pw*0.55,h:ph},{x:px+pw*0.55+g,y:py,w:pw*0.45-g,h:(ph-g)/2},{x:px+pw*0.55+g,y:py+(ph-g)/2+g,w:pw*0.45-g,h:(ph-g)/2}];
    case '4-grid':         { const hw=(pw-g)/2,hh=(ph-g)/2; return [{x:px,y:py,w:hw,h:hh},{x:px+hw+g,y:py,w:hw,h:hh},{x:px,y:py+hh+g,w:hw,h:hh},{x:px+hw+g,y:py+hh+g,w:hw,h:hh}]; }
    case '5-2top3bot':     { const topH=Math.round(ph*0.55),botH=ph-topH-g,tw=(pw-g)/2,bw=(pw-2*g)/3; return [{x:px,y:py,w:tw,h:topH},{x:px+tw+g,y:py,w:tw,h:topH},{x:px,y:py+topH+g,w:bw,h:botH},{x:px+bw+g,y:py+topH+g,w:bw,h:botH},{x:px+2*(bw+g),y:py+topH+g,w:bw,h:botH}]; }
    case '5-cross':        { const w3=(pw-2*g)/3,h3=(ph-2*g)/3; return [{x:px+w3+g,y:py,w:w3,h:h3},{x:px,y:py+h3+g,w:w3,h:h3},{x:px+w3+g,y:py+h3+g,w:w3,h:h3},{x:px+2*(w3+g),y:py+h3+g,w:w3,h:h3},{x:px+w3+g,y:py+2*(h3+g),w:w3,h:h3}]; }
    case '6-grid':
    case '6-2rows':        { const hw=(pw-2*g)/3,hh=(ph-g)/2; return Array.from({length:6},(_,i)=>({x:px+(i%3)*(hw+g),y:py+Math.floor(i/3)*(hh+g),w:hw,h:hh})); }
    default:               return [{x:px,y:py,w:pw,h:ph}];
  }
}

function PrintCalendarGrid({ year, month, W, accent, marks }: { year: number; month: number; W: number; accent: string; marks: Mark[] }) {
  const first = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const offset = (first + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = cells.length / 7;
  const cw = W / 7;
  const hdrH = W * 0.05;
  const cellH = (W * 0.40) / rows;
  const totalH = hdrH + rows * cellH;
  return (
    <svg width={W} height={totalH} style={{ display: 'block' }}>
      {DAYS_UK.map((d, i) => (
        <text key={d} x={cw * i + cw / 2} y={hdrH - 3} textAnchor="middle"
          fontSize={cw * 0.22} fontWeight="700" fontFamily="sans-serif"
          fill={i >= 5 ? accent : '#555'}>{d}</text>
      ))}
      <line x1={0} y1={hdrH} x2={W} y2={hdrH} stroke="#ddd" strokeWidth={Math.max(0.5, W * 0.001)} />
      {cells.map((day, idx) => {
        if (!day) return null;
        const col = idx % 7, row = Math.floor(idx / 7);
        const cx = cw * col + cw / 2, cy = hdrH + row * cellH + cellH * 0.5;
        const mark = marks.find(m => m.day === day);
        const r = cellH * 0.36;
        return (
          <g key={idx}>
            {mark && mark.shape === 'circle' && <circle cx={cx} cy={cy} r={r} fill={mark.color} />}
            {mark && mark.shape === 'heart' && (
              <path d={`M ${cx} ${cy + r * 0.3} C ${cx - r} ${cy - r * 0.5}, ${cx - r * 0.5} ${cy - r}, ${cx} ${cy - r * 0.3} C ${cx + r * 0.5} ${cy - r}, ${cx + r} ${cy - r * 0.5}, ${cx} ${cy + r * 0.3} Z`} fill={mark.color} />
            )}
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
              fontSize={cw * 0.26} fontFamily="sans-serif"
              fill={mark ? '#fff' : (col >= 5 ? accent : '#333')}
              fontWeight={mark ? 700 : 400}>{day}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PrintPhotoSlot({ photo, slot, W, H }: { photo: PhotoMeta | null; slot: Slot; W: number; H: number }) {
  if (!photo?.preview) {
    return <div style={{ width: W, height: H, background: '#eef2f7' }} />;
  }
  const zoom = slot.zoom || 1;
  // Mirror the editor's PhotoSlot exactly: object-fit cover + object-position so
  // the printed crop matches what the customer saw, for any aspect ratio.
  return (
    <div style={{ width: W, height: H, overflow: 'hidden', position: 'relative' }}>
      <img src={photo.preview} alt="" crossOrigin="anonymous" draggable={false}
        style={{
          width: `${zoom * 100}%`, height: `${zoom * 100}%`,
          objectFit: 'cover',
          objectPosition: `${slot.cropX ?? 50}% ${slot.cropY ?? 50}%`,
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }} />
    </div>
  );
}

function MonthPrint({ page, photos, W, H, accent, marks }: { page: MonthPage; photos: PhotoMeta[]; W: number; H: number; accent: string; marks: Mark[] }) {
  const spiralH = Math.round(H * 0.045);
  const g = Math.max(2, Math.round(W * 0.004));
  const ps = PAGE_STYLES[page.pageStyle || 'classic'] || PAGE_STYLES['classic'];
  const availableH = H - spiralH;

  let photoX = 0, photoY = spiralH, photoW = W, photoH: number;
  let gridX = 0, gridY = 0, gridW = W, gridH = 0;
  let footerBandH = 0;
  let miniCalConfig: { x: number; y: number; w: number; h: number } | null = null;

  if (ps.orientation === 'horizontal') {
    photoW = Math.round(W * ps.photoRatio); photoH = availableH;
    gridX = photoW + g; gridY = spiralH; gridW = W - photoW - g; gridH = availableH;
  } else if (ps.hasMiniCal) {
    photoH = availableH;
    miniCalConfig = { x: W - Math.round(W * 0.35) - 8, y: H - Math.round(H * 0.18) - 8, w: Math.round(W * 0.35), h: Math.round(H * 0.18) };
    gridY = -1; gridH = 0;
  } else if (ps.hasFooterBand) {
    photoH = Math.round(availableH * ps.photoRatio);
    footerBandH = Math.round(availableH * 0.04);
    gridY = spiralH + photoH + footerBandH; gridH = availableH - photoH - footerBandH;
  } else {
    photoH = Math.round(availableH * ps.photoRatio);
    gridY = spiralH + photoH; gridH = availableH - photoH;
  }

  const defs = slotDefsFor(page.layout, photoX, photoY, photoW, photoH, g);

  return (
    <div data-print-page style={{ width: W, height: H, position: 'relative', background: '#fff', flexShrink: 0 }}>
      {/* Spiral binding band */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: spiralH, background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: Math.round(W / 14) }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{ width: Math.round(W * 0.038), height: Math.round(W * 0.038), borderRadius: '50%', border: '1.5px solid #94a3b8', background: '#fff' }} />
        ))}
      </div>
      {defs.map((def, i) => {
        const slot = page.slots[i] || { photoId: null, cropX: 50, cropY: 50, zoom: 1 };
        const photo = photos.find(p => p.id === slot.photoId) || null;
        return (
          <div key={i} style={{ position: 'absolute', left: def.x, top: def.y, width: def.w, height: def.h }}>
            <PrintPhotoSlot photo={photo} slot={slot} W={def.w} H={def.h} />
          </div>
        );
      })}
      {ps.hasFooterBand && <div style={{ position: 'absolute', top: spiralH + photoH, left: 0, width: W, height: footerBandH, background: accent }} />}
      {!ps.hasMiniCal && gridH > 0 && (
        <div style={{ position: 'absolute', top: gridY, left: gridX, width: gridW, height: gridH, background: '#fff', padding: `${Math.round(H*0.008)}px ${Math.round(W*0.02)}px` }}>
          <div style={{ fontSize: Math.round(W * 0.023), fontWeight: 900, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, textAlign: 'center' }}>
            {MONTHS_UK[page.month - 1]} {page.year}
          </div>
          <PrintCalendarGrid year={page.year} month={page.month} W={gridW - Math.round(W * 0.04)} accent={accent} marks={marks} />
        </div>
      )}
      {miniCalConfig && (
        <div style={{ position: 'absolute', left: miniCalConfig.x, top: miniCalConfig.y, width: miniCalConfig.w, height: miniCalConfig.h, background: 'rgba(255,255,255,0.95)', borderRadius: 4, padding: '3px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: Math.round(W * 0.016), fontWeight: 900, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1, textAlign: 'center' }}>
            {MONTHS_UK[page.month - 1]} {page.year}
          </div>
          <PrintCalendarGrid year={page.year} month={page.month} W={miniCalConfig.w - 12} accent={accent} marks={marks} />
        </div>
      )}
    </div>
  );
}

/**
 * Mirrors CoverEditor's FitText: measure the single-line width at the intended
 * size and shrink proportionally if it exceeds the safe box, so a long title
 * prints at the same size the customer saw in the editor. useLayoutEffect runs
 * before paint, so the render service can't screenshot the unshrunk state.
 */
function PrintFitText({ tb, maxWidthPx, fontScale }: { tb: any; maxWidthPx: number; fontScale: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const base = Math.max(4, Math.round((tb.fontSize || 22) * fontScale));
  const [size, setSize] = useState(base);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || maxWidthPx <= 0) return;
    el.style.fontSize = base + 'px';
    const natural = el.scrollWidth;
    setSize(natural > maxWidthPx && natural > 0 ? Math.max(8, Math.floor(base * (maxWidthPx / natural))) : base);
  }, [tb.text, base, tb.fontFamily, tb.bold, maxWidthPx]);
  return (
    <span ref={ref} style={{
      display: 'block', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.1,
      color: tb.color || '#fff',
      fontFamily: `${tb.fontFamily || 'Playfair Display'},serif`,
      fontWeight: tb.bold ? 700 : 400,
      fontSize: size,
      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    }}>{tb.text || ''}</span>
  );
}

/**
 * Prints the cover using the SAME schema the constructor saves: printedBgColor,
 * printedPhotoSlot (percent box + shape), photoId + photoCropX/photoCropY/
 * photoZoom/photoRotation, printedOverlay and printedTextBlocks. The previous
 * version read a different schema (bgColor/title/titleColor) that no saved
 * design ever had — so covers printed as a blank white page with just the
 * photo, dropping the chosen background, overlay and title text.
 */
function CoverPrint({ cover, photos, W, H, accent }: { cover: any; photos: PhotoMeta[]; W: number; H: number; accent: string }) {
  const spiralH = Math.round(H * 0.045);
  // CoverEditor in the wall-calendar constructor always uses a 480px-tall
  // canvas (coverH = 480); fontSize and rounded-corner radii are stored in
  // that editor space, so scale them by the print height.
  const fontScale = H / 480;
  const slot = cover?.printedPhotoSlot as { x: number; y: number; w: number; h: number; shape?: string } | null | undefined;
  const photo = cover?.photoId ? photos.find(p => p.id === cover.photoId) : null;
  const texts: any[] = Array.isArray(cover?.printedTextBlocks) ? cover.printedTextBlocks : [];
  const overlay = cover?.printedOverlay as { type?: string; color?: string; opacity?: number; gradient?: string } | undefined;

  const slotBox = slot ? { x: slot.x / 100 * W, y: slot.y / 100 * H, w: slot.w / 100 * W, h: slot.h / 100 * H } : null;
  const radiusFor = (shape?: string) =>
    shape === 'circle' ? '50%' : shape === 'rounded' ? `${Math.round(12 * fontScale)}px` : '0px';

  return (
    <div data-print-page style={{ width: W, height: H, position: 'relative', background: cover?.printedBgColor || cover?.bgColor || '#fff', flexShrink: 0, overflow: 'hidden' }}>
      {/* Main photo slot — same percent box, crop, zoom and rotation the customer set */}
      {slotBox && photo?.preview && (
        <div style={{ position: 'absolute', left: slotBox.x, top: slotBox.y, width: slotBox.w, height: slotBox.h, borderRadius: radiusFor(slot?.shape), overflow: 'hidden' }}>
          <img src={photo.preview} alt="" crossOrigin="anonymous" draggable={false}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              objectPosition: `${cover?.photoCropX ?? 50}% ${cover?.photoCropY ?? 50}%`,
              transform: `scale(${cover?.photoZoom ?? 1}) rotate(${cover?.photoRotation ?? 0}deg)`,
              transformOrigin: 'center',
            }} />
        </div>
      )}
      {/* Extra photo slots — multi-photo cover templates (printedPhotoSlots[1..]) */}
      {Array.isArray(cover?.printedPhotoSlots) && cover.printedPhotoSlots.slice(1).map((psl: any, i: number) => {
        const ph = psl?.photoId ? photos.find(p => p.id === psl.photoId) : null;
        if (!ph?.preview) return null;
        return (
          <div key={i} style={{ position: 'absolute', left: psl.x / 100 * W, top: psl.y / 100 * H, width: psl.w / 100 * W, height: psl.h / 100 * H, borderRadius: radiusFor(psl.shape), overflow: 'hidden' }}>
            <img src={ph.preview} alt="" crossOrigin="anonymous"
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                objectPosition: `${psl.cropX ?? 50}% ${psl.cropY ?? 50}%`,
                transform: `scale(${psl.zoom ?? 1})`, transformOrigin: 'center',
              }} />
          </div>
        );
      })}
      {/* Overlay — full canvas, exactly like the editor */}
      {overlay?.type === 'color' && (
        <div style={{ position: 'absolute', inset: 0, background: overlay.color || '#000', opacity: (overlay.opacity ?? 40) / 100, pointerEvents: 'none' }} />
      )}
      {overlay?.type === 'gradient' && overlay.gradient && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: overlay.gradient, pointerEvents: 'none' }} />
      )}
      {/* Text blocks — same 8..92% clamp and centering as the editor */}
      {texts.map((tb: any) => {
        const safeX = Math.max(8, Math.min(92, tb.x ?? 50));
        const safeY = Math.max(8, Math.min(92, tb.y ?? 82));
        return (
          <div key={tb.id || `${tb.x}-${tb.y}`} style={{ position: 'absolute', left: `${safeX}%`, top: `${safeY}%`, transform: 'translate(-50%, -50%)', maxWidth: W * 0.84, zIndex: 5 }}>
            <PrintFitText tb={tb} maxWidthPx={W * 0.84} fontScale={fontScale} />
          </div>
        );
      })}
      {/* Legacy shape (bgColor/title) — only if there are no printedTextBlocks */}
      {texts.length === 0 && cover?.title && (
        <div style={{ position: 'absolute', bottom: Math.round(H * 0.08), left: 0, right: 0, textAlign: 'center', color: cover?.titleColor || accent, fontWeight: 900, fontSize: Math.round(W * 0.07) }}>
          {cover.title}
        </div>
      )}
      {/* Spiral binding band on top — the physical binding strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: spiralH, background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: Math.round(W / 14), zIndex: 6 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{ width: Math.round(W * 0.038), height: Math.round(W * 0.038), borderRadius: '50%', border: '1.5px solid #94a3b8', background: '#fff' }} />
        ))}
      </div>
    </div>
  );
}

export default function CalendarPrintPage({
  config, photos, W, H, pageIndex,
}: {
  config: any;
  photos: PhotoMeta[];
  W: number;
  H: number;
  pageIndex: number; // 0 = cover, 1..N = months
}) {
  const accent = config?.accent || '#1e2d7d';
  const pages: MonthPage[] = Array.isArray(config?.pages) ? config.pages : [];
  const markedDates: Record<string, Mark[]> = config?.markedDates || {};

  // Cover text uses webfonts (Playfair Display etc.) — load the same Google
  // Fonts stylesheet the editor uses, once per document. The render service
  // waits for document fonts before screenshotting.
  useEffect(() => {
    const id = 'tm-print-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
  }, []);

  if (pageIndex === 0) {
    return <CoverPrint cover={config?.coverConfig} photos={photos} W={W} H={H} accent={accent} />;
  }
  const page = pages[pageIndex - 1];
  if (!page) return <div style={{ width: W, height: H, background: '#fff' }} />;
  // The constructor keys marks as `m${month}` (see WallCalendarConstructor's
  // toggleMark). The old `${year}-${month}` lookup never matched, so every
  // customer-marked date silently vanished from the printed calendar. Keep the
  // year-month form as a fallback in case older configs used it.
  const marks = markedDates[`m${page.month}`] || markedDates[`${page.year}-${page.month}`] || [];
  return <MonthPrint page={page} photos={photos} W={W} H={H} accent={accent} marks={marks} />;
}
