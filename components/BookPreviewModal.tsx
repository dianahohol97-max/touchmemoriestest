'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface Page {
  id: number;
  label: string;
  slots: { photoId: string | null }[];
  textBlocks?: { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold: boolean; italic: boolean }[];
}

interface BookPreviewProps {
  pages: Page[];
  photos: { id: string; preview: string }[];
  propW: number; // page proportions width in cm
  propH: number;
  onClose: () => void;
}

export function BookPreviewModal({ pages, photos, propW, propH, onClose }: BookPreviewProps) {
  const [currentSpread, setCurrentSpread] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [flipDir, setFlipDir] = useState<'next'|'prev'>('next');

  // spreads: 0 = cover, 1 = pages[1]+[2], etc
  const totalSpreads = Math.ceil((pages.length - 1) / 2) + 1;

  const goNext = () => {
    if (flipping || currentSpread >= totalSpreads - 1) return;
    setFlipDir('next');
    setFlipping(true);
    setTimeout(() => { setCurrentSpread(s => s + 1); setFlipping(false); }, 400);
  };
  const goPrev = () => {
    if (flipping || currentSpread <= 0) return;
    setFlipDir('prev');
    setFlipping(true);
    setTimeout(() => { setCurrentSpread(s => s - 1); setFlipping(false); }, 400);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSpread, flipping]);

  const getPhoto = (id: string | null) => id ? photos.find(p => p.id === id) ?? null : null;

  // Page dimensions for preview
  const aspect = propW / propH;
  const pageH = 420;
  const pageW = pageH * aspect;

  const getPageContent = (pageIdx: number) => {
    const page = pages[pageIdx];
    if (!page) return null;
    const mainPhoto = getPhoto(page.slots[0]?.photoId ?? null);
    return (
      <div style={{ width: pageW, height: pageH, position: 'relative', background: '#fff', overflow: 'hidden' }}>
        {mainPhoto ? (
          <img src={mainPhoto.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{page.label}</span>
          </div>
        )}
        {/* Text blocks */}
        {(page.textBlocks || []).map(tb => (
          <div key={tb.id} style={{ position: 'absolute', left: tb.x + '%', top: tb.y + '%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
            <span style={{ fontSize: tb.fontSize * 0.9 + 'px', fontFamily: tb.fontFamily, color: tb.color, fontWeight: tb.bold ? 700 : 400, fontStyle: tb.italic ? 'italic' : 'normal', whiteSpace: 'pre' }}>{tb.text}</span>
          </div>
        ))}
        {/* Page number */}
        <div style={{ position: 'absolute', bottom: 8, [pageIdx % 2 === 0 ? 'left' : 'right']: 16, fontSize: 10, color: '#94a3b8' }}>{pageIdx}</div>
      </div>
    );
  };

  const leftPageIdx = currentSpread === 0 ? 0 : (currentSpread - 1) * 2 + 1;
  const rightPageIdx = currentSpread === 0 ? 0 : (currentSpread - 1) * 2 + 2;
  const isLastSpread = currentSpread >= totalSpreads - 1;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
            {currentSpread === 0 ? 'Обкладинка' : `Розворот ${currentSpread} / ${totalSpreads - 1}`}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>← → для навігації • Esc для закриття</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Book */}
        <div style={{ perspective: 1200, perspectiveOrigin: '50% 50%' }}>
          <div
            style={{
              display: 'flex',
              gap: 2,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              transform: `rotateY(${flipping ? (flipDir === 'next' ? -8 : 8) : 0}deg)`,
              transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
              transformOrigin: 'center center',
            }}
          >
            {/* Left page */}
            <div style={{ transform: `rotateY(${flipping && flipDir === 'prev' ? -15 : 0}deg)`, transition: 'transform 0.4s', transformOrigin: 'right center', boxShadow: 'inset -4px 0 8px rgba(0,0,0,0.15)' }}>
              {currentSpread === 0
                ? <div style={{ width: pageW, height: pageH, background: '#e8ecf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#94a3b8', fontSize: 11, writingMode: 'vertical-rl' }}>ЗАДНЯ</span>
                  </div>
                : getPageContent(leftPageIdx)
              }
            </div>

            {/* Spine */}
            <div style={{ width: 8, height: pageH, background: 'linear-gradient(to right, #ccc, #e8e8e8, #ccc)', flexShrink: 0 }}/>

            {/* Right page */}
            <div style={{ transform: `rotateY(${flipping && flipDir === 'next' ? 15 : 0}deg)`, transition: 'transform 0.4s', transformOrigin: 'left center', boxShadow: 'inset 4px 0 8px rgba(0,0,0,0.15)' }}>
              {getPageContent(rightPageIdx) ?? (
                <div style={{ width: pageW, height: pageH, background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={goPrev} disabled={currentSpread === 0 || flipping}
            style={{ width: 44, height: 44, borderRadius: '50%', background: currentSpread === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)', border: 'none', cursor: currentSpread === 0 ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
            <ChevronLeft size={20} />
          </button>

          {/* Spread dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: totalSpreads }).map((_, i) => (
              <button key={i} onClick={() => !flipping && setCurrentSpread(i)}
                style={{ width: i === currentSpread ? 24 : 8, height: 8, borderRadius: 4, border: 'none', cursor: 'pointer', background: i === currentSpread ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s', padding: 0 }} />
            ))}
          </div>

          <button onClick={goNext} disabled={isLastSpread || flipping}
            style={{ width: 44, height: 44, borderRadius: '50%', background: isLastSpread ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)', border: 'none', cursor: isLastSpread ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
            <ChevronRight size={20} />
          </button>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Клікніть поза книгою або натисніть Esc щоб закрити</p>
      </div>
    </div>
  );
}
