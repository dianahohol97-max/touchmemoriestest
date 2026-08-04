'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './GalleryClient.module.css';

interface Photo { id: string; file_name: string; size_bytes: number | null; url: string; favorite: boolean }
interface GalleryData {
  title: string;
  client_name: string | null;
  shoot_date: string | null;
  expires_at: string;
  days_left: number;
  expired: boolean;
  cover_url: string | null;
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

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

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
    } catch {
      alert('Не вдалося сформувати архів. Спробуйте ще раз.');
    } finally { setZipping(false); }
  };

  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (loading) {
    return (
      <div className={styles.page}>
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

  const p = data.photographer;
  const contacts = [
    p.phone && { label: 'Телефон', value: p.phone, href: `tel:${p.phone.replace(/[^\d+]/g, '')}` },
    p.instagram && { label: 'Instagram', value: '@' + p.instagram.replace(/^@/, ''), href: `https://instagram.com/${p.instagram.replace(/^@/, '')}` },
    p.email && { label: 'Email', value: p.email, href: `mailto:${p.email}` },
    p.website && { label: 'Сайт', value: p.website.replace(/^https?:\/\//, ''), href: p.website.startsWith('http') ? p.website : `https://${p.website}` },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  const favCount = data.photos.filter(ph => ph.favorite).length;
  const current = lightbox !== null ? visible[lightbox] : null;
  const meta = [
    data.client_name,
    data.shoot_date ? formatDate(data.shoot_date) : null,
    `${data.photos.length} фото`,
  ].filter(Boolean).join('  ·  ');

  if (data.expired) {
    return (
      <div className={styles.page}>
        <div className={styles.expiredWrap}>
          <div className={styles.expiredCard}>
            <div className={styles.heroKicker}>{p.name}</div>
            <h1 className={styles.expiredTitle}>{data.title}</h1>
            <div className={styles.heroDivider} style={{ background: '#d8cdbb' }} />
            <p className={styles.expiredText}>
              Термін зберігання галереї минув. Фото зберігалися 30 днів і були видалені автоматично.
              Якщо вони вам потрібні — зверніться до фотографа.
            </p>
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

  return (
    <div className={styles.page}>
      {/* ── Fullscreen cover hero ── */}
      <section className={styles.hero}>
        {data.cover_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={data.cover_url} alt="" className={styles.heroImg} />
          : <div className={styles.heroFallback} />}
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <div className={styles.heroKicker}>{p.name}</div>
          <h1 className={styles.heroTitle}>{data.title}</h1>
          <div className={styles.heroDivider} />
          {meta && <div className={styles.heroMeta}>{meta}</div>}
        </div>
        <button type="button" className={styles.heroScroll} onClick={scrollToGrid} aria-label="Перейти до фото">
          <span className={styles.heroScrollText}>Переглянути</span>
          <span className={styles.heroChevron} aria-hidden>⌄</span>
        </button>
      </section>

      {/* ── Sticky toolbar ── */}
      <div className={styles.bar}>
        <div className={styles.barInner}>
          <div className={styles.barBrand}>
            {(p.logo_url || p.avatar_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo_url || p.avatar_url!} alt="" className={styles.barAvatar} />
            )}
            {p.slug
              ? <a href={`/uk/photographer/${p.slug}`} className={styles.barName}>{p.name}</a>
              : <span className={styles.barName}>{p.name}</span>}
          </div>
          <div className={styles.barActions}>
            <span className={styles.countdown} title={`Галерея доступна ще ${data.days_left} дн.`}>
              ще {data.days_left} {data.days_left === 1 ? 'день' : data.days_left < 5 ? 'дні' : 'днів'}
            </span>
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
                {zipping ? `${zipProgress}%` : 'Завантажити все'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Photo grid ── */}
      <div className={styles.container} ref={gridRef}>
        {data.photos.length > 0 && (
          <div className={styles.selectHint}>
            Позначайте серцем <span className={styles.heartInline}>♡</span> фото, які хочете надрукувати — фотограф побачить ваш вибір.
          </div>
        )}

        {visible.length === 0 ? (
          <div className={styles.emptyFav}>
            {data.photos.length === 0 ? 'Фотограф ще завантажує фото — загляньте трохи згодом.' : 'Ви ще не обрали жодного фото.'}
          </div>
        ) : (
          <div className={styles.grid}>
            {visible.map((photo, i) => (
              <div key={photo.id} className={styles.tile}>
                <button onClick={() => setLightbox(i)} className={styles.tileOpen} aria-label={`Відкрити фото ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.file_name} loading="lazy" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(photo.id, !photo.favorite)}
                  className={`${styles.heart} ${photo.favorite ? styles.heartOn : ''}`}
                  aria-label={photo.favorite ? 'Прибрати з обраних' : 'Додати в обрані'}
                  aria-pressed={photo.favorite}
                >
                  {photo.favorite ? '♥' : '♡'}
                </button>
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
        <div className={styles.contactRow}>
          {contacts.map(c => (
            <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" className={styles.contactChip}>{c.value}</a>
          ))}
        </div>
        {p.slug && (
          <a href={`/uk/photographer/${p.slug}`} className={styles.footerCta}>Сторінка фотографа</a>
        )}
      </div>

      <div className={styles.poweredBy}>
        Галерею створено на <a href="/uk/gallery-for-photographers">Touch.Memories</a>
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
                aria-label={current.favorite ? 'Прибрати з обраних' : 'Додати в обрані'}
              >
                {current.favorite ? '♥' : '♡'}
              </button>
              <a href={current.url} download={current.file_name} className={styles.lbIconBtn} aria-label="Завантажити фото">⬇</a>
              <button type="button" className={styles.lbIconBtn} onClick={() => setLightbox(null)} aria-label="Закрити">✕</button>
            </div>
          </div>

          {lightbox !== null && lightbox > 0 && (
            <button
              type="button"
              className={`${styles.lbNav} ${styles.lbNavLeft}`}
              onClick={e => { e.stopPropagation(); setLightbox(Math.max((lightbox ?? 0) - 1, 0)); }}
              aria-label="Попереднє фото"
            >‹</button>
          )}
          {lightbox !== null && lightbox < visible.length - 1 && (
            <button
              type="button"
              className={`${styles.lbNav} ${styles.lbNavRight}`}
              onClick={e => { e.stopPropagation(); setLightbox(Math.min((lightbox ?? 0) + 1, visible.length - 1)); }}
              aria-label="Наступне фото"
            >›</button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt="" className={styles.lbImg} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>{children}</div>;
}
