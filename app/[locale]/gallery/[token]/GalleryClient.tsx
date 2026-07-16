'use client';

import React, { useEffect, useState } from 'react';

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

  if (loading) return <Centered>Завантаження…</Centered>;
  if (error || !data) return <Centered>{error || 'Галерею не знайдено'}</Centered>;

  const p = data.photographer;
  const contacts = [
    p.phone && { label: '📞', value: p.phone, href: `tel:${p.phone.replace(/[^\d+]/g, '')}` },
    p.instagram && { label: '📷', value: p.instagram.replace(/^@/, ''), href: `https://instagram.com/${p.instagram.replace(/^@/, '')}` },
    p.email && { label: '✉️', value: p.email, href: `mailto:${p.email}` },
    p.website && { label: '🌐', value: p.website.replace(/^https?:\/\//, ''), href: p.website.startsWith('http') ? p.website : `https://${p.website}` },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 16px 80px', fontFamily: 'Arial, sans-serif', color: '#1f2937' }}>
      {/* Photographer business-card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb', paddingBottom: 20, marginBottom: 20 }}>
        {(p.logo_url || p.avatar_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo_url || p.avatar_url!} alt={p.name} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d' }}>
            {p.slug ? <a href={`/uk/photographer/${p.slug}`} style={{ color: '#1e2d7d', textDecoration: 'none' }}>{p.name}</a> : p.name}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
            {contacts.map(c => (
              <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>
                {c.label} {c.value}
              </a>
            ))}
          </div>
        </div>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', color: '#1e2d7d' }}>{data.title}</h1>
      <div style={{ color: '#64748b', marginBottom: 16 }}>
        {data.client_name && <span>{data.client_name} · </span>}
        {data.shoot_date && <span>{new Date(data.shoot_date).toLocaleDateString('uk-UA')} · </span>}
        <span>{data.photos.length} фото</span>
      </div>

      {data.expired ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 24, textAlign: 'center', color: '#991b1b' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Термін зберігання галереї минув</div>
          <div>Фото зберігалися 30 днів і були видалені. Зверніться до фотографа{p.name ? ` — ${p.name}` : ''}.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600 }}>
              ⏳ Доступно ще {data.days_left} {data.days_left === 1 ? 'день' : data.days_left < 5 ? 'дні' : 'днів'}
            </span>
            {data.photos.length > 0 && (
              <button onClick={downloadAll} disabled={zipping}
                style={{ background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: zipping ? 'default' : 'pointer', opacity: zipping ? 0.7 : 1 }}>
                {zipping ? `Пакуємо… ${zipProgress}%` : 'Завантажити все (ZIP)'}
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {data.photos.map((photo, i) => (
              <button key={photo.id} onClick={() => setLightbox(i)}
                style={{ padding: 0, border: 'none', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', aspectRatio: '1' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.file_name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox !== null && data.photos[lightbox] && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.photos[lightbox].url} alt="" style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }} onClick={e => e.stopPropagation()}>
            <LbBtn onClick={() => setLightbox(Math.max(lightbox - 1, 0))} disabled={lightbox === 0}>← Попереднє</LbBtn>
            <a href={data.photos[lightbox].url} download={data.photos[lightbox].file_name}
              style={{ background: '#fff', color: '#111', borderRadius: 8, padding: '9px 16px', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
              Завантажити
            </a>
            <LbBtn onClick={() => setLightbox(Math.min(lightbox + 1, data.photos.length - 1))} disabled={lightbox === data.photos.length - 1}>Наступне →</LbBtn>
            <LbBtn onClick={() => setLightbox(null)}>✕</LbBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function LbBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, fontSize: 14 }}>
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>{children}</div>;
}
