'use client';

import React, { useEffect, useState } from 'react';
import styles from './GalleryClient.module.css';

interface Photo { id: string; file_name: string; size_bytes: number | null; url: string }
interface GalleryData {
  title: string;
  client_name: string | null;
  shoot_date: string | null;
  expires_at: string;
  days_left: number;
  expired: boolean;
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

export default function GalleryClient({ token }: { token: string }) {
  const [data, setData] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

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

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(i => (i === null ? null : Math.min(i + 1, (data?.photos.length || 1) - 1)));
      if (e.key === 'ArrowLeft') setLightbox(i => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, data?.photos.length]);

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

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.grid} aria-hidden>
          {SKELETON_HEIGHTS.map((h, i) => (
            <div key={i} className={styles.skeletonTile} style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }
  if (error || !data) return <Centered>{error || 'Галерею не знайдено'}</Centered>;

  const p = data.photographer;
  const contacts = [
    p.phone && { label: 'Тел.', value: p.phone, href: `tel:${p.phone.replace(/[^\d+]/g, '')}` },
    p.instagram && { label: 'Instagram', value: '@' + p.instagram.replace(/^@/, ''), href: `https://instagram.com/${p.instagram.replace(/^@/, '')}` },
    p.email && { label: 'Email', value: p.email, href: `mailto:${p.email}` },
    p.website && { label: 'Сайт', value: p.website.replace(/^https?:\/\//, ''), href: p.website.startsWith('http') ? p.website : `https://${p.website}` },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <div className={styles.page}>
      {/* Photographer business-card header */}
      <div className={styles.header}>
        {(p.logo_url || p.avatar_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo_url || p.avatar_url!} alt={p.name} className={styles.avatar} />
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          {p.slug
            ? <a href={`/uk/photographer/${p.slug}`} className={styles.brandName}>{p.name}</a>
            : <span className={styles.brandName}>{p.name}</span>}
          <div className={styles.contacts}>
            {contacts.map(c => (
              <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" className={styles.contactChip}>
                {c.label} {c.value}
              </a>
            ))}
          </div>
        </div>
      </div>

      <h1 className={styles.title}>{data.title}</h1>
      <div className={styles.meta}>
        {data.client_name && <span>{data.client_name} · </span>}
        {data.shoot_date && <span>{new Date(data.shoot_date).toLocaleDateString('uk-UA')} · </span>}
        <span>{data.photos.length} фото</span>
      </div>

      {data.expired ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: 26, textAlign: 'center', color: '#991b1b' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Термін зберігання галереї минув</div>
          <div>Фото зберігалися 30 днів і були видалені. Зверніться до фотографа{p.name ? ` — ${p.name}` : ''}.</div>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <span className={styles.countdown}>
              ⏳ Доступно ще {data.days_left} {data.days_left === 1 ? 'день' : data.days_left < 5 ? 'дні' : 'днів'}
            </span>
            {data.photos.length > 0 && (
              <button onClick={downloadAll} disabled={zipping} className={styles.downloadBtn}>
                {zipping ? `Пакуємо… ${zipProgress}%` : '⬇ Завантажити все (ZIP)'}
              </button>
            )}
          </div>

          <div className={styles.grid}>
            {data.photos.map((photo, i) => (
              <button key={photo.id} onClick={() => setLightbox(i)} className={styles.tile} aria-label={`Відкрити фото ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.file_name} loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox !== null && data.photos[lightbox] && (
        <div onClick={() => setLightbox(null)} className={styles.lb}>
          <div className={styles.lbCounter} onClick={e => e.stopPropagation()}>
            {lightbox + 1} / {data.photos.length}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.photos[lightbox].url} alt="" className={styles.lbImg} onClick={e => e.stopPropagation()} />
          <div className={styles.lbBar} onClick={e => e.stopPropagation()}>
            <button className={styles.lbBtn} onClick={() => setLightbox(Math.max(lightbox - 1, 0))} disabled={lightbox === 0}>← Попереднє</button>
            <a href={data.photos[lightbox].url} download={data.photos[lightbox].file_name} className={styles.lbDownload}>
              Завантажити
            </a>
            <button className={styles.lbBtn} onClick={() => setLightbox(Math.min(lightbox + 1, data.photos.length - 1))} disabled={lightbox === data.photos.length - 1}>Наступне →</button>
            <button className={styles.lbBtn} onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>{children}</div>;
}
