'use client';

import React, { useEffect, useState } from 'react';
import styles from './PortfolioGallery.module.css';

interface Props {
  photos: string[];
  name: string;
  grid: 'feature' | 'uniform' | 'portrait';
  radius: number;
  tileBg: string;
}

/**
 * Client-side portfolio grid for a photographer's landing page.
 *
 * Replaces the previous server-rendered <img> grid, which set
 * `transition: transform .5s` inline but could never trigger it — inline
 * styles have no `:hover`, so the zoom was dead. Here the hover-zoom lives in
 * a CSS module and each tile opens a lightbox (keyboard + click navigation).
 *
 * Theme-driven geometry (grid rhythm, radius, tile background) is passed in so
 * the component stays visually in sync with the page's landing theme.
 */
export default function PortfolioGallery({ photos, name, grid, radius, tileBg }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen(i => (i === null ? null : Math.min(i + 1, photos.length - 1)));
      if (e.key === 'ArrowLeft') setOpen(i => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, photos.length]);

  const tileAspect = grid === 'portrait' ? '4 / 5' : '1 / 1';
  const gridStyle: React.CSSProperties =
    grid === 'portrait'
      ? { gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }
      : { gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 45%), 1fr))', gap: 10 };

  return (
    <>
      <div className={styles.grid} style={gridStyle}>
        {photos.map((url, i) => {
          const feature = grid === 'feature' && i === 0 && photos.length >= 3;
          return (
            <button
              key={url}
              type="button"
              onClick={() => setOpen(i)}
              className={styles.tile}
              aria-label={`Відкрити фото ${i + 1} з ${photos.length}`}
              style={{
                borderRadius: radius,
                background: tileBg,
                aspectRatio: feature ? undefined : tileAspect,
                ...(feature ? { gridColumn: 'span 2', gridRow: 'span 2' } : {}),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} — портфоліо, фото ${i + 1}`}
                loading={i < 3 ? 'eager' : 'lazy'}
                style={feature ? { aspectRatio: tileAspect } : undefined}
              />
              <span className={styles.zoomHint} aria-hidden>⤢</span>
            </button>
          );
        })}
      </div>

      {open !== null && photos[open] && (
        <div className={styles.lb} onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button className={styles.lbClose} onClick={() => setOpen(null)} aria-label="Закрити">✕</button>
          <button
            className={`${styles.lbNav} ${styles.lbNavPrev}`}
            onClick={e => { e.stopPropagation(); setOpen(Math.max(open - 1, 0)); }}
            disabled={open === 0}
            aria-label="Попереднє фото"
          >‹</button>
          <button
            className={`${styles.lbNav} ${styles.lbNavNext}`}
            onClick={e => { e.stopPropagation(); setOpen(Math.min(open + 1, photos.length - 1)); }}
            disabled={open === photos.length - 1}
            aria-label="Наступне фото"
          >›</button>

          <div className={styles.lbCounter} onClick={e => e.stopPropagation()}>
            {open + 1} / {photos.length}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open]} alt={`${name} — портфоліо, фото ${open + 1}`} className={styles.lbImg} onClick={e => e.stopPropagation()} />
          <div className={styles.lbBar} onClick={e => e.stopPropagation()}>
            <button className={styles.lbBtn} onClick={() => setOpen(Math.max(open - 1, 0))} disabled={open === 0}>← Попереднє</button>
            <button className={styles.lbBtn} onClick={() => setOpen(Math.min(open + 1, photos.length - 1))} disabled={open === photos.length - 1}>Наступне →</button>
          </div>
        </div>
      )}
    </>
  );
}
