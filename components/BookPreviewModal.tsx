'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSlotDefs } from '@/lib/editor/slot-defs';
import type { LayoutType } from '@/lib/editor/types';
import { BackgroundLayer, PageBackground, DEFAULT_BG } from './BackgroundLayer';
import { FrameConfig, DEFAULT_FRAME, PNG_FRAMES, FRAMES } from './FramesLayer';

// ── Interfaces ──

interface SlotData {
  photoId: string | null;
  cropX: number; cropY: number; zoom: number;
  rotation?: number;
  shape?: 'rect' | 'rounded' | 'circle' | 'heart';
  customX?: number; customY?: number; customW?: number; customH?: number;
}

interface TextBlock {
  id: string; text: string; x: number; y: number;
  fontSize: number; fontFamily: string; color: string;
  bold: boolean; italic: boolean;
}

interface PageData {
  id: number; label: string; layout: LayoutType;
  slots: SlotData[]; textBlocks?: TextBlock[];
}

interface FreeSlot {
  id: string; x: number; y: number; w: number; h: number;
  shape: string; photoId: string | null;
  zoom: number; cropX: number; cropY: number;
  filter?: string;
}

interface Shape {
  id: string; type: string;
  x: number; y: number; w: number; h: number;
  fill: string; stroke: string; strokeW: number;
  opacity: number; rotation: number;
  text?: string; fontSize?: number; fontFamily?: string; textColor?: string;
}

interface KalkaState {
  text: string; textColor: string; fontSize: number; fontFamily: string;
  imageUrl: string | null;
  imgCropX: number; imgCropY: number; imgZoom: number;
  imgScale: number; imgX: number; imgY: number;
}

interface BookPreviewProps {
  pages: PageData[];
  photos: { id: string; preview: string; width: number; height: number }[];
  propW: number; propH: number;
  onClose: () => void;
  freeSlots?: Record<number, FreeSlot[]>;
  coverState?: any;
  isPrinted?: boolean;
  selectedCoverType?: string;
  effectiveCoverColor?: string;
  pageBgs?: Record<number, PageBackground>;
  pageFrames?: Record<number, FrameConfig>;
  pageShapes?: Record<number, Shape[]>;
  pageStickers?: Record<number, { id: string; url?: string; emoji?: string; x: number; y: number; w: number | string; h: number | string }[]>;
  slotGap?: number;
  pageGap?: number;
  pageBorder?: { width: number; color: string };
  kalkaState?: KalkaState;
  isSpreadMode?: boolean;
  hasKalka?: boolean;
}

// ── Component ──

export function BookPreviewModal({
  pages, photos, propW, propH, onClose,
  freeSlots = {},
  coverState, isPrinted, effectiveCoverColor,
  pageBgs = {}, pageFrames = {}, pageShapes = {}, pageStickers = {},
  slotGap = 4, pageGap = 0, pageBorder = { width: 0, color: '#e2e8f0' },
  kalkaState, isSpreadMode = true, hasKalka = false,
}: BookPreviewProps) {

  const [spread, setSpread] = useState(0);
  const spreadCount = Math.ceil((pages.length - 1) / 2) + 1;

  const navigate = useCallback((dir: 'next' | 'prev') => {
    const next = dir === 'next' ? spread + 1 : spread - 1;
    if (next < 0 || next >= spreadCount) return;
    setSpread(next);
  }, [spread, spreadCount]);

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
  const spreadW = pageW * 2;

  const getPhoto = (id: string | null | undefined) => id ? photos.find(p => p.id === id) ?? null : null;
  const getBg = (idx: number): PageBackground => pageBgs[idx] || DEFAULT_BG;
  const getFrame = (idx: number): FrameConfig => pageFrames[idx] || DEFAULT_FRAME;

  const kalkaForzatsIdx = hasKalka ? 1 : -1;
  const kalkaPageIdx = hasKalka ? 2 : -1;

  // ── Render shapes (non-interactive) ──
  const renderShapes = (shapes: Shape[]) => {
    if (!shapes.length) return null;
    return shapes.map(sh => {
      const style: React.CSSProperties = {
        position: 'absolute', left: sh.x, top: sh.y, width: sh.w, height: sh.h,
        opacity: sh.opacity / 100,
        transform: sh.rotation ? `rotate(${sh.rotation}deg)` : undefined,
        pointerEvents: 'none', zIndex: 3,
      };
      if (sh.type === 'rect') return <div key={sh.id} style={{ ...style, background: sh.fill, border: sh.strokeW ? `${sh.strokeW}px solid ${sh.stroke}` : 'none', borderRadius: 2 }} />;
      if (sh.type === 'circle') return <div key={sh.id} style={{ ...style, background: sh.fill, border: sh.strokeW ? `${sh.strokeW}px solid ${sh.stroke}` : 'none', borderRadius: '50%' }} />;
      if (sh.type === 'line') return <div key={sh.id} style={{ ...style, height: sh.strokeW || 2, background: sh.stroke || sh.fill }} />;
      if (sh.type === 'text' && sh.text) return (
        <div key={sh.id} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: sh.fontSize || 16, fontFamily: sh.fontFamily || 'Open Sans', color: sh.textColor || sh.fill, fontWeight: 700 }}>{sh.text}</span>
        </div>
      );
      return <div key={sh.id} style={{ ...style, background: sh.fill, border: sh.strokeW ? `${sh.strokeW}px solid ${sh.stroke}` : 'none' }} />;
    });
  };

  // ── Render stickers ──
  const renderStickers = (stickers: typeof pageStickers[0], cW: number) => {
    if (!stickers?.length) return null;
    return stickers.map(st => (
      <div key={st.id} style={{ position: 'absolute', left: st.x, top: st.y, width: st.w, height: st.h, zIndex: 12, pointerEvents: 'none' }}>
        {st.url
          ? <img src={st.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
          : st.emoji
            ? <span style={{ fontSize: typeof st.w === 'number' ? st.w * 0.7 : Math.round(cW * parseFloat(String(st.w)) / 100 * 0.7), lineHeight: 1, display: 'block', textAlign: 'center' }}>{st.emoji}</span>
            : null}
      </div>
    ));
  };

  // ── Render frame (non-interactive preview) ──
  const renderFrame = (fc: FrameConfig, cW: number, cH: number) => {
    if (!fc.frameId) return null;
    const sc = (fc.scale === 1 && fc.x === 0 && fc.y === 0) ? 0.6 : (fc.scale ?? 0.6);
    const bd = Math.min(cW, cH);
    const fw = bd * sc, fh = bd * sc;
    const fcx = (cW - fw) / 2 + (fc.x ?? 0);
    const fcy = (cH - fh) / 2 + (fc.y ?? 0);
    const pngDef = PNG_FRAMES.find(f => f.id === fc.frameId);
    const svgDef = FRAMES.find(f => f.id === fc.frameId);
    const isPng = !!pngDef;
    const framePhoto = getPhoto(fc.photoId);
    const insetPct = isPng ? 0.18 : 0.08;

    return (
      <div style={{ position: 'absolute', left: fcx, top: fcy, width: fw, height: fh, zIndex: fc.zIndex ?? 35, pointerEvents: 'none', overflow: 'visible' }}>
        {framePhoto && (
          <div style={{ position: 'absolute', left: fw * insetPct, top: fh * insetPct, width: fw * (1 - 2 * insetPct), height: fh * (1 - 2 * insetPct), overflow: 'hidden', zIndex: 1, borderRadius: 2 }}>
            <img src={framePhoto.preview} alt="" draggable={false} style={{
              width: '100%', height: '100%', objectFit: 'cover',
              objectPosition: `${fc.cropX ?? 50}% ${fc.cropY ?? 50}%`,
              transform: `scale(${fc.zoom ?? 1})`,
              transformOrigin: `${fc.cropX ?? 50}% ${fc.cropY ?? 50}%`,
            }} />
          </div>
        )}
        {pngDef ? (
          <img src={pngDef.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', zIndex: 2, opacity: fc.opacity / 100 }} />
        ) : svgDef ? (
          <svg width={fw} height={fh} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 2, opacity: fc.opacity / 100 }}
            dangerouslySetInnerHTML={{ __html: svgDef.render(fw, fh, fc.color, 100) }} />
        ) : null}
      </div>
    );
  };

  // ── Render a photo inside a layout slot ──
  const renderSlotPhoto = (slot: SlotData, slotStyle: React.CSSProperties) => {
    const photo = getPhoto(slot.photoId);
    if (!photo) return null;
    const br = slot.shape === 'circle' ? '50%' : slot.shape === 'rounded' ? 12 : 0;
    return (
      <div style={{
        ...slotStyle, overflow: 'hidden', borderRadius: br,
        border: pageBorder.width > 0 ? `${pageBorder.width}px solid ${pageBorder.color}` : 'none',
        boxSizing: 'border-box',
        padding: pageGap > 0 ? pageGap : 0,
        transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
      }}>
        <img src={photo.preview} alt="" draggable={false} style={{
          width: '100%', height: '100%', objectFit: 'cover',
          objectPosition: `${slot.cropX ?? 50}% ${slot.cropY ?? 50}%`,
          transform: `scale(${slot.zoom || 1})`,
          transformOrigin: `${slot.cropX ?? 50}% ${slot.cropY ?? 50}%`,
          display: 'block',
        }} />
      </div>
    );
  };

  // ── Render a content page ──
  const renderContentPage = (pageIdx: number, cW: number, cH: number) => {
    const page = pages[pageIdx];
    if (!page) return <div style={{ width: cW, height: cH, background: '#f8f9fa', flexShrink: 0 }} />;

    const layout = page.layout || (isSpreadMode ? 'sp-full' : 'p-full');
    const defs = getSlotDefs(layout, cW, cH);
    const bg = getBg(pageIdx);
    const fc = getFrame(pageIdx);
    const shapes = pageShapes[pageIdx] || [];
    const stickers = pageStickers[pageIdx] || [];
    const pageFs = freeSlots[pageIdx] || [];

    return (
      <div style={{ width: cW, height: cH, position: 'relative', background: '#fff', overflow: 'hidden', flexShrink: 0 }}>
        <BackgroundLayer bg={bg} canvasW={cW} canvasH={cH} />

        {/* Layout slots */}
        {defs.map(({ i, s }) => {
          const slot = page.slots[i];
          if (!slot) return null;
          const photo = getPhoto(slot.photoId);
          const ss: React.CSSProperties = slot.customX !== undefined
            ? { ...s, left: slot.customX, top: slot.customY, width: slot.customW, height: slot.customH }
            : s;
          if (!photo) return <div key={i} style={{ ...ss, background: 'rgba(241,245,249,0.6)', borderRadius: 3 }} />;
          return <React.Fragment key={i}>{renderSlotPhoto(slot, ss)}</React.Fragment>;
        })}

        {/* Free slots */}
        {pageFs.map((fs: FreeSlot) => {
          const ph = getPhoto(fs.photoId);
          const br = fs.shape === 'circle' ? '50%' : fs.shape === 'rounded' ? '12px' : fs.shape === 'square' ? '4px' : '0';
          return (
            <div key={fs.id} style={{ position: 'absolute', left: fs.x, top: fs.y, width: fs.w, height: fs.h, borderRadius: br, overflow: 'hidden', background: ph ? 'transparent' : 'rgba(99,102,241,0.08)', zIndex: 2 }}>
              {ph && <img src={ph.preview} alt="" draggable={false} style={{
                width: `${(fs.zoom || 1) * 100}%`, height: `${(fs.zoom || 1) * 100}%`,
                objectFit: 'cover', objectPosition: `${fs.cropX}% ${fs.cropY}%`,
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                filter: fs.filter || 'none',
              }} />}
            </div>
          );
        })}

        {/* Text blocks */}
        {(page.textBlocks || []).map(tb => (
          <div key={tb.id} style={{ position: 'absolute', left: `${tb.x}%`, top: `${tb.y}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 8 }}>
            <span style={{
              fontSize: tb.fontSize * 0.85, fontFamily: tb.fontFamily, color: tb.color,
              fontWeight: tb.bold ? 700 : 400, fontStyle: tb.italic ? 'italic' : 'normal', whiteSpace: 'pre',
            }}>{tb.text}</span>
          </div>
        ))}

        {renderShapes(shapes)}
        {renderFrame(fc, cW, cH)}
        {renderStickers(stickers, cW)}

        {/* Page number */}
        <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }}>{pageIdx > 0 ? pageIdx : ''}</div>
      </div>
    );
  };

  // ── Kalka page ──
  const renderKalkaPage = (cW: number, cH: number) => (
    <div style={{ width: cW, height: cH, position: 'relative', background: '#f8f9fc', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(200,210,240,0.15) 3px, rgba(200,210,240,0.15) 4px)', pointerEvents: 'none' }} />
      {kalkaState?.imageUrl && (
        <div style={{ position: 'absolute', left: `${kalkaState.imgX ?? 50}%`, top: `${kalkaState.imgY ?? 50}%`, transform: 'translate(-50%,-50%)', width: `${kalkaState.imgScale ?? 80}%`, overflow: 'hidden', pointerEvents: 'none' }}>
          <img src={kalkaState.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', transform: `scale(${kalkaState.imgZoom ?? 1})` }} draggable={false} />
        </div>
      )}
      {kalkaState?.text && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: 2, pointerEvents: 'none' }}>
          <span style={{ fontSize: (kalkaState.fontSize || 24) * 0.85, fontFamily: kalkaState.fontFamily || 'Playfair Display', color: kalkaState.textColor || '#333', whiteSpace: 'pre-wrap' }}>{kalkaState.text}</span>
        </div>
      )}
      {!kalkaState?.text && !kalkaState?.imageUrl && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#c7d2fe', fontSize: 11, fontWeight: 600 }}>КАЛЬКА</span>
        </div>
      )}
    </div>
  );

  // ── Forzats ──
  const renderForzats = (cW: number, cH: number) => (
    <div style={{ width: cW, height: cH, background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color: '#d1d5db', fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', writingMode: 'vertical-rl' }}>ФОРЗАЦ</span>
    </div>
  );

  // ── Cover back ──
  const renderCoverBack = () => {
    const backBg = isPrinted ? (coverState?.backCoverBgColor || '#f1f5f9') : (effectiveCoverColor || '#e8ecf4');
    const backPhoto = isPrinted && coverState?.backCoverPhotoId ? getPhoto(coverState.backCoverPhotoId) : null;
    const backSlot = coverState?.backCoverSlot;
    return (
      <div style={{ width: pageW, height: pageH, background: backBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {backPhoto && backSlot ? (
          <div style={{ position: 'absolute', left: `${backSlot.x / 100 * pageW}px`, top: `${backSlot.y / 100 * pageH}px`, width: `${backSlot.w / 100 * pageW}px`, height: `${backSlot.h / 100 * pageH}px`, borderRadius: backSlot.shape === 'circle' ? '50%' : backSlot.shape === 'rounded' ? 12 : 0, overflow: 'hidden' }}>
            <img src={backPhoto.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
          </div>
        ) : backPhoto ? (
          <img src={backPhoto.preview} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} draggable={false} />
        ) : null}
        <span style={{ color: 'rgba(0,0,0,0.15)', fontSize: 9, writingMode: 'vertical-rl', letterSpacing: 3, textTransform: 'uppercase', zIndex: 1 }}>ЗАДНЯ</span>
      </div>
    );
  };

  // ── Cover front ──
  const renderCoverFront = () => {
    if (!isPrinted) {
      const bg = effectiveCoverColor || '#8b7355';
      return (
        <div style={{ width: pageW, height: pageH, background: bg, flexShrink: 0, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {coverState?.decoText && (
            <div style={{ position: 'absolute', left: `${coverState.textX ?? 50}%`, top: `${coverState.textY ?? 50}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
              <span style={{ fontSize: (coverState.textFontSize || 24) * 0.85, fontFamily: coverState.textFontFamily || 'Playfair Display', color: coverState.decoColor || '#d4af37', whiteSpace: 'pre-wrap', textAlign: 'center' }}>{coverState.decoText}</span>
            </div>
          )}
          {renderFrame(getFrame(0), pageW, pageH)}
          {renderShapes(pageShapes[0] || [])}
        </div>
      );
    }

    const frontBg = coverState?.printedBgColor || '#fff';
    const overlay = coverState?.printedOverlay ?? { type: 'none', color: '#000', opacity: 40, gradient: '' };
    const slot = coverState?.printedPhotoSlot ?? { x: 0, y: 0, w: 100, h: 100, shape: 'rect' };
    const mainPhoto = coverState?.photoId ? getPhoto(coverState.photoId) : null;
    const br = slot.shape === 'circle' ? '50%' : slot.shape === 'rounded' ? '12px' : slot.shape === 'heart' ? '50%' : '0px';

    return (
      <div style={{ width: pageW, height: pageH, background: frontBg, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {/* Main photo slot */}
        <div style={{ position: 'absolute', left: `${slot.x / 100 * pageW}px`, top: `${slot.y / 100 * pageH}px`, width: `${slot.w / 100 * pageW}px`, height: `${slot.h / 100 * pageH}px`, borderRadius: br, overflow: 'hidden' }}>
          {mainPhoto && <img src={mainPhoto.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />}
        </div>

        {/* Multi-photo slots */}
        {(coverState?.printedPhotoSlots || []).map((ps: any, idx: number) => {
          const ph = ps.photoId ? getPhoto(ps.photoId) : null;
          if (!ph) return null;
          return (
            <div key={idx} style={{ position: 'absolute', left: `${ps.x / 100 * pageW}px`, top: `${ps.y / 100 * pageH}px`, width: `${ps.w / 100 * pageW}px`, height: `${ps.h / 100 * pageH}px`, borderRadius: ps.shape === 'circle' ? '50%' : ps.shape === 'rounded' ? '12px' : '0px', overflow: 'hidden' }}>
              <img src={ph.preview} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${ps.cropX ?? 50}% ${ps.cropY ?? 50}%`, transform: `scale(${ps.zoom ?? 1})`, transformOrigin: `${ps.cropX ?? 50}% ${ps.cropY ?? 50}%` }} draggable={false} />
            </div>
          );
        })}

        {overlay.type === 'color' && <div style={{ position: 'absolute', inset: 0, background: overlay.color, opacity: overlay.opacity / 100, pointerEvents: 'none' }} />}
        {overlay.type === 'gradient' && <div style={{ position: 'absolute', inset: 0, backgroundImage: overlay.gradient, pointerEvents: 'none' }} />}

        {(coverState?.printedTextBlocks || []).map((tb: any) => (
          <div key={tb.id} style={{ position: 'absolute', left: `${tb.x}%`, top: `${tb.y}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 5 }}>
            <span style={{ fontSize: `${tb.fontSize * 0.85}px`, fontFamily: tb.fontFamily, color: tb.color, fontWeight: tb.bold ? 700 : 400, whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{tb.text}</span>
          </div>
        ))}

        {renderFrame(getFrame(0), pageW, pageH)}
        {renderShapes(pageShapes[0] || [])}
      </div>
    );
  };

  // ── Render a spread ──
  const renderSpread = (spreadIdx: number) => {
    if (spreadIdx === 0) {
      return (
        <div style={{ display: 'flex', width: spreadW + spineW, height: pageH }}>
          {renderCoverBack()}
          <div style={{ width: spineW, height: pageH, flexShrink: 0, background: 'linear-gradient(to right, #a08b6e, #c4b49a, #a08b6e)', boxShadow: '0 0 6px rgba(0,0,0,0.1)' }} />
          {renderCoverFront()}
        </div>
      );
    }

    const leftPI = (spreadIdx - 1) * 2 + 1;
    const rightPI = (spreadIdx - 1) * 2 + 2;
    const leftPage = pages[leftPI];

    // Spread layout (sp-*) → render as one wide page
    const isSpread = leftPage && leftPage.layout && String(leftPage.layout).startsWith('sp-');

    if (isSpread) {
      return (
        <div style={{ display: 'flex', width: spreadW + spineW, height: pageH }}>
          <div style={{ width: spreadW, height: pageH, position: 'relative', overflow: 'hidden' }}>
            {renderContentPage(leftPI, spreadW, pageH)}
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'rgba(0,0,0,0.06)', zIndex: 50, pointerEvents: 'none' }} />
          </div>
          <div style={{ width: spineW, height: pageH, flexShrink: 0, background: 'linear-gradient(to right, #e8e4de, #f5f2ed, #e8e4de)', boxShadow: '0 0 6px rgba(0,0,0,0.1)' }} />
        </div>
      );
    }

    // Page mode → two separate pages
    return (
      <div style={{ display: 'flex', width: spreadW + spineW, height: pageH }}>
        {hasKalka && leftPI === kalkaForzatsIdx
          ? renderForzats(pageW, pageH)
          : renderContentPage(leftPI, pageW, pageH)}
        <div style={{ width: spineW, height: pageH, flexShrink: 0, background: 'linear-gradient(to right, #e8e4de, #f5f2ed, #e8e4de)', boxShadow: '0 0 6px rgba(0,0,0,0.1)' }} />
        {hasKalka && rightPI === kalkaPageIdx
          ? renderKalkaPage(pageW, pageH)
          : pages[rightPI]
            ? renderContentPage(rightPI, pageW, pageH)
            : <div style={{ width: pageW, height: pageH, background: '#f8f9fa', flexShrink: 0 }} />}
      </div>
    );
  };

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
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.94)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '8px 0' : '20px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 8 : 14, width: '100%', maxWidth: '100vw' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{spreadLabel}</span>
          {!isMobile && <span style={{ color: '#64748b', fontSize: 11 }}>стрілки ← → · свайп · Esc</span>}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#fff', padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <X size={14} /> {isMobile ? '' : 'Закрити'}
          </button>
        </div>

        <div style={{ perspective: 1200 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
            {spread === 0 && <div style={{ width: spineW, height: pageH, flexShrink: 0, background: 'linear-gradient(to right, #8b7355, #a08b6e)', borderRadius: '3px 0 0 3px', boxShadow: 'inset -1px 0 3px rgba(0,0,0,0.3)' }} />}
            <div style={{ position: 'relative', width: spreadW + spineW, height: pageH, overflow: 'visible' }}>
              {renderSpread(spread)}
              <div style={{ position: 'absolute', bottom: -5, left: '8%', right: '8%', height: 10, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2), transparent)', borderRadius: '50%', filter: 'blur(3px)', pointerEvents: 'none' }} />
            </div>
            {spread === 0 && <div style={{ width: spineW, height: pageH, flexShrink: 0, background: 'linear-gradient(to right, #a08b6e, #8b7355)', borderRadius: '0 3px 3px 0', boxShadow: 'inset 1px 0 3px rgba(0,0,0,0.3)' }} />}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('prev')} disabled={spread === 0}
            style={{ width: 40, height: 40, borderRadius: '50%', background: spread === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)', border: 'none', cursor: spread === 0 ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', maxWidth: isMobile ? 'calc(100vw - 120px)' : 500, paddingBlock: 4 }}>
            {Array.from({ length: spreadCount }).map((_, i) => (
              <button key={i} onClick={() => setSpread(i)}
                style={{ width: i === spread ? 24 : 14, height: 10, borderRadius: 3, border: 'none', cursor: 'pointer', background: i === spread ? '#fff' : 'rgba(255,255,255,0.25)', transition: 'all 0.2s', padding: 0, flexShrink: 0, outline: i === spread ? '2px solid rgba(255,255,255,0.3)' : 'none', outlineOffset: 2 }} />
            ))}
          </div>
          <button onClick={() => navigate('next')} disabled={spread === spreadCount - 1}
            style={{ width: 40, height: 40, borderRadius: '50%', background: spread === spreadCount - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)', border: 'none', cursor: spread === spreadCount - 1 ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ChevronRight size={20} />
          </button>
        </div>

        {!isMobile && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, margin: 0 }}>Клікніть поза книгою або Esc</p>}
      </div>
    </div>
  );
}
