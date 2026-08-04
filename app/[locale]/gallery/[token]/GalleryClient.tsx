'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './GalleryClient.module.css';
import type { GalleryDesign } from '@/lib/photographers/gallery-design';
import { GALLERY_I18N } from '@/lib/photographers/gallery-i18n';

interface Photo { id: string; file_name: string; size_bytes: number | null; url: string; favorite: boolean; media_type: 'photo' | 'video' }
interface GalleryData {
  title: string;
  client_name: string | null;
  shoot_date: string | null;
  expires_at: string;
  days_left: number;
  expired: boolean;
  cover_url: string | null;
  cover_type: 'photo' | 'video';
  design: GalleryDesign;
  photos: Photo[];
  photographer: {
    name: string; bio: string | null; phone: string | null; instagram: string | null;
    website: string | null; email: string | null; logo_url: string | null; avatar_url: string | null;
    slug: string | null;
  };
}

// Fixed skeleton heights so the loading grid has a natural masonry rhythm
// without needing Math.random (which would differ per render).
const SKELETON_HEIGHTS = [220, 300, 180, 260, 340, 200, 280, 240, 320, 190, 300, 230];

// Design constructor → CSS. Montserrat comes from the root layout var.
const FONT_VARS: Record<GalleryDesign['font'], string> = {
  playfair: 'var(--font-gallery-serif), Georgia, serif',
  cormorant: 'var(--font-gallery-cormorant), Georgia, serif',
  montserrat: 'var(--font-heading), system-ui, sans-serif',
  caveat: 'var(--font-gallery-caveat), cursive',
};
const FONT_SCALES: Record<GalleryDesign['font_scale'], number> = { s: 0.82, m: 1, l: 1.22 };

export default function GalleryClient({ token }: { token: string }) {
  const [data, setData] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/gallery/${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) { setError(json?.error || 'Помилка'); return; }
        setData(json.gallery);
      } catch { setError('Не вдалося завантажити галерею'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  // Photos currently on screen (all, or the client's selection when filtering).
  const visible = useMemo(
    () => (data ? (onlyFavorites ? data.photos.filter(p => p.favorite) : data.photos) : []),
    [data, onlyFavorites],
  );

  // If the client clears their last pick while filtering, drop back to all
  // photos so they aren't stranded on an empty view (the filter toggle hides
  // itself once the count reaches 0).
  useEffect(() => {
    if (onlyFavorites && data && !data.photos.some(p => p.favorite)) setOnlyFavorites(false);
  }, [onlyFavorites, data]);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(i => (i === null ? null : Math.min(i + 1, visible.length - 1)));
      if (e.key === 'ArrowLeft') setLightbox(i => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, visible.length]);

  // The lightbox is a fullscreen overlay — freeze page scroll behind it.
  useEffect(() => {
    document.body.style.overflow = lightbox !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  const toggleFavorite = async (photoId: string, next: boolean) => {
    // Optimistic: flip locally first, revert if the request fails.
    setData(d => d ? { ...d, photos: d.photos.map(p => p.id === photoId ? { ...p, favorite: next } : p) } : d);
    try {
      const res = await fetch(`/api/gallery/${encodeURIComponent(token)}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, favorite: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setData(d => d ? { ...d, photos: d.photos.map(p => p.id === photoId ? { ...p, favorite: !next } : p) } : d);
    }
  };

  // Supabase serves public files inline; the ?download= param flips
  // Content-Disposition to attachment so single photos actually download
  // (the <a download> attribute is ignored cross-origin).
  const dlHref = (url: string, name: string) => `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(name || 'photo.jpg')}`;
  // Fire-and-forget download telemetry for the photographer's stats.
  const track = (payload: { type: 'zip' } | { type: 'photo'; photoId: string }) => {
    fetch(`/api/gallery/${encodeURIComponent(token)}/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).catch(() => {});
  };

  const downloadAll = async () => {
    if (!data || zipping) return;
    setZipping(true); setZipProgress(0);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (let i = 0; i < data.photos.length; i++) {
        const p = data.photos[i];
        const blob = await (await fetch(p.url)).blob();
        zip.file(p.file_name || `photo_${i + 1}.jpg`, blob);
        setZipProgress(Math.round(((i + 1) / data.photos.length) * 100));
      }
      const out = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = `${data.title.replace(/[^\wа-яіїєґА-ЯІЇЄҐ -]+/g, '').trim() || 'gallery'}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      track({ type: 'zip' });
    } catch {
      alert((GALLERY_I18N[data.design?.lang] || GALLERY_I18N.uk).zipError);
    } finally { setZipping(false); }
  };

  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (loading) {
    return (
      <div className={`${styles.page} ${styles.themeLight}`}>
        <div className={styles.heroSkeleton} aria-hidden />
        <div className={styles.container}>
          <div className={styles.grid} aria-hidden>
            {SKELETON_HEIGHTS.map((h, i) => (
              <div key={i} className={styles.skeletonTile} style={{ height: h }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error || !data) return <Centered>{error || 'Галерею не знайдено'}</Centered>;

  const design = data.design;
  const t = GALLERY_I18N[design.lang] || GALLERY_I18N.uk;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });
  const themeClass = design.bg === 'dark' ? styles.themeDark : design.bg === 'cream' ? styles.themeCream : styles.themeLight;
  const designStyle = {
    '--g-display': FONT_VARS[design.font] || FONT_VARS.playfair,
    '--g-scale': FONT_SCALES[design.font_scale] ?? 1,
  } as React.CSSProperties;

  const p = data.photographer;
  const contacts = [
    p.phone && { label: t.phone, value: p.phone, href: `tel:${p.phone.replace(/[^\d+]/g, '')}` },
    p.instagram && { label: 'Instagram', value: '@' + p.instagram.replace(/^@/, ''), href: `https://instagram.com/${p.instagram.replace(/^@/, '')}` },
    p.email && { label: 'Email', value: p.email, href: `mailto:${p.email}` },
    p.website && { label: t.website, value: p.website.replace(/^https?:\/\//, ''), href: p.website.startsWith('http') ? p.website : `https://${p.website}` },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  const favCount = data.photos.filter(ph => ph.favorite).length;
  const current = lightbox !== null ? visible[lightbox] : null;
  const meta = [
    data.client_name,
    data.shoot_date ? formatDate(data.shoot_date) : null,
    t.photosCount(data.photos.length),
  ].filter(Boolean).join('  ·  ');

  if (data.expired) {
    return (
      <div className={`${styles.page} ${themeClass}`} style={designStyle}>
        <div className={styles.expiredWrap}>
          <div className={styles.expiredCard}>
            <div className={`${styles.heroKicker} ${styles.onPanel}`}>{p.name}</div>
            <h1 className={styles.expiredTitle}>{data.title}</h1>
            <div className={`${styles.heroDivider} ${styles.dividerPanel}`} />
            <p className={styles.expiredText}>{t.expiredText}</p>
            <div className={styles.contactRow}>
              {contacts.map(c => (
                <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" className={styles.contactChip}>{c.value}</a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const coverMedia = data.cover_url
    ? (data.cover_type === 'video'
      ? <video src={data.cover_url} className={styles.heroImg} autoPlay muted loop playsInline />
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={data.cover_url} alt="" className={styles.heroImg} />)
    : <div className={styles.heroFallback} />;

  const heroText = (onMedia: boolean) => (
    <>
      <div className={`${styles.heroKicker} ${onMedia ? '' : styles.onPanel}`}>{p.name}</div>
      <h1 className={styles.heroTitle}>{data.title}</h1>
      <div className={`${styles.heroDivider} ${onMedia ? '' : styles.dividerPanel}`} />
      {meta && <div className={`${styles.heroMeta} ${onMedia ? '' : styles.onPanel}`}>{meta}</div>}
      <button
        type="button"
        className={`${styles.heroScroll} ${onMedia ? '' : styles.heroScrollPanel}`}
        onClick={scrollToGrid}
        aria-label={t.view}
      >
        <span className={styles.heroScrollText}>{t.view}</span>
        <span className={styles.heroChevron} aria-hidden>⌄</span>
      </button>
    </>
  );

  return (
    <div className={`${styles.page} ${themeClass}`} style={designStyle}>
      {/* ── Cover hero: the layout the photographer picked ── */}
      {design.cover === 'split' ? (
        <section className={styles.heroSplit}>
          <div className={styles.splitPanel}>
            <div className={`${styles.heroContent} ${styles.heroContentPanel}`}>{heroText(false)}</div>
          </div>
          <div className={styles.splitMedia}>{coverMedia}</div>
        </section>
      ) : design.cover === 'minimal' ? (
        <section className={styles.heroMinimal}>
          <div className={`${styles.heroContent} ${styles.heroContentPanel}`}>{heroText(false)}</div>
        </section>
      ) : (
        <section className={`${styles.hero} ${design.cover === 'bottom' ? styles.heroBottom : ''}`}>
          {coverMedia}
          <div className={styles.heroShade} />
          <div className={styles.heroContent}>{heroText(true)}</div>
        </section>
      )}

      {/* ── Sticky toolbar ── */}
      <div className={styles.bar}>
        <div className={styles.barInner}>
          <div className={styles.barBrand}>
            {(p.logo_url || p.avatar_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo_url || p.avatar_url!} alt="" className={styles.barAvatar} />
            )}
            <span className={styles.barName}>{p.name}</span>
          </div>
          <div className={styles.barActions}>
            <span className={styles.countdown}>{t.daysLeft(data.days_left)}</span>
            {favCount > 0 && (
              <button
                type="button"
                onClick={() => { setOnlyFavorites(v => !v); setLightbox(null); }}
                className={`${styles.favFilter} ${onlyFavorites ? styles.favFilterOn : ''}`}
                aria-pressed={onlyFavorites}
              >
                ♥ {favCount}
              </button>
            )}
            {data.photos.length > 0 && (
              <button onClick={downloadAll} disabled={zipping} className={styles.downloadBtn}>
                {zipping ? `${zipProgress}%` : t.downloadAll}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Photo grid ── */}
      <div className={styles.container} ref={gridRef}>
        {data.photos.length > 0 && (
          <div className={styles.selectHint}>
            {t.hintBefore} <span className={styles.heartInline}>♡</span> {t.hintAfter}
          </div>
        )}

        {visible.length === 0 ? (
          <div className={styles.emptyFav}>
            {data.photos.length === 0 ? t.emptyUploading : t.emptyFav}
          </div>
        ) : (
          <div className={`${styles.grid} ${design.layout === 'grid' ? styles.gridUniform : design.layout === 'large' ? styles.gridLarge : ''}`}>
            {visible.map((photo, i) => (
              <div key={photo.id} className={styles.tile}>
                <button onClick={() => setLightbox(i)} className={styles.tileOpen} aria-label={`${t.view} ${i + 1}`}>
                  {photo.media_type === 'video' ? (
                    <>
                      <video src={photo.url} className={styles.tileVideo} preload="metadata" muted playsInline />
                      <span className={styles.playBadge} aria-hidden>▶</span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt={photo.file_name} loading="lazy" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(photo.id, !photo.favorite)}
                  className={`${styles.heart} ${photo.favorite ? styles.heartOn : ''}`}
                  aria-label={photo.favorite ? t.favRemove : t.favAdd}
                  aria-pressed={photo.favorite}
                >
                  {photo.favorite ? '♥' : '♡'}
                </button>
                <a
                  href={dlHref(photo.url, photo.file_name)}
                  className={styles.tileDl}
                  onClick={() => track({ type: 'photo', photoId: photo.id })}
                  aria-label={t.ariaDownload}
                  title={t.ariaDownload}
                >⬇</a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Photographer footer card ── */}
      <div className={styles.photographerBlock}>
        {(p.logo_url || p.avatar_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo_url || p.avatar_url!} alt={p.name} className={styles.footerAvatar} />
        )}
        <div className={styles.footerName}>{p.name}</div>
        {p.bio && <p className={styles.footerBio}>{p.bio}</p>}
        {/* The public photographer page is feature-flagged off for now
            (Diana) — the gallery offers direct contacts instead. */}
        {contacts.length > 0 && (
          <>
            <div className={styles.contactsTitle}>{t.contactsTitle}</div>
            <div className={styles.contactRow}>
              {contacts.map(c => (
                <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" className={styles.contactChip}>{c.value}</a>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.poweredBy}>
        {t.createdOn} <a href="/uk/gallery-for-photographers">Touch.Memories</a>
      </div>

      {/* ── Lightbox ── */}
      {current && (
        <div
          className={styles.lb}
          onClick={() => setLightbox(null)}
          onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) < 45) return;
            setLightbox(i => i === null ? null : dx < 0 ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0));
          }}
        >
          <div className={styles.lbTop} onClick={e => e.stopPropagation()}>
            <span className={styles.lbCounter}>{(lightbox ?? 0) + 1} / {visible.length}</span>
            <div className={styles.lbTopActions}>
              <button
                type="button"
                className={`${styles.lbIconBtn} ${current.favorite ? styles.lbHeartOn : ''}`}
                onClick={() => toggleFavorite(current.id, !current.favorite)}
                aria-label={current.favorite ? t.favRemove : t.favAdd}
              >
                {current.favorite ? '♥' : '♡'}
              </button>
              <a href={dlHref(current.url, current.file_name)} className={styles.lbIconBtn}
                 onClick={() => track({ type: 'photo', photoId: current.id })} aria-label={t.ariaDownload}>⬇</a>
              <button type="button" className={styles.lbIconBtn} onClick={() => setLightbox(null)} aria-label={t.ariaClose}>✕</button>
            </div>
          </div>

          {lightbox !== null && lightbox > 0 && (
            <button
              type="button"
              className={`${styles.lbNav} ${styles.lbNavLeft}`}
              onClick={e => { e.stopPropagation(); setLightbox(Math.max((lightbox ?? 0) - 1, 0)); }}
              aria-label={t.ariaPrev}
            >‹</button>
          )}
          {lightbox !== null && lightbox < visible.length - 1 && (
            <button
              type="button"
              className={`${styles.lbNav} ${styles.lbNavRight}`}
              onClick={e => { e.stopPropagation(); setLightbox(Math.min((lightbox ?? 0) + 1, visible.length - 1)); }}
              aria-label={t.ariaNext}
            >›</button>
          )}

          {current.media_type === 'video' ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={current.url} className={styles.lbImg} controls autoPlay playsInline onClick={e => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt="" className={styles.lbImg} onClick={e => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>{children}</div>;
}
