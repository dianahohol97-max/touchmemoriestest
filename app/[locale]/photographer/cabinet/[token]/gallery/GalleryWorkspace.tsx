'use client';

import React, { useEffect, useState } from 'react';
import {
  card, sectionTitle, btn, btnGhost,
  ClientPicks, DesignPanel, EditGalleryPanel, PhotoManager, UploadZone,
  type Gallery,
} from '../CabinetClient';

/**
 * Everything a photographer does with one gallery: upload photos and video,
 * pick the cover, tune the design, change the settings, share the link.
 *
 * Lives in its own component because two pages show it — the gallery editor
 * (`/gallery/[id]`) and the creation page (`/gallery/new`), which reveals it
 * in place the moment the gallery exists instead of bouncing to another
 * screen (Diana, 2026-08-05: «відкрилася нова сторінка, але де конструктор
 * галереї, і де поле для завантаження фото і відео»).
 */
export default function GalleryWorkspace({ token, galleryId, justCreated = false }: {
  token: string; galleryId: string; justCreated?: boolean;
}) {
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 2500); };

  // The galleries endpoint returns the whole (small) list for this cabinet;
  // picking one out of it avoids a second single-gallery endpoint.
  const load = async () => {
    try {
      const res = await fetch(`/api/photographers/galleries?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) { setError(json?.error || 'Кабінет не знайдено'); return; }
      const found = (json.galleries as Gallery[]).find(g => g.id === galleryId);
      if (!found) { setError('Галерею не знайдено'); return; }
      setGallery(found);
    } catch { setError('Не вдалося завантажити галерею'); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, galleryId]);

  if (loading) return <div style={{ color: '#8B8378', padding: '40px 0' }}>Завантаження…</div>;
  if (error || !gallery) return <div style={{ color: '#991b1b', padding: '40px 0' }}>{error || 'Галерею не знайдено'}</div>;

  const g = gallery;
  const clientUrl = typeof window !== 'undefined' ? `${window.location.origin}/uk/gallery/${g.client_token}` : '';

  return (
    <>
      {notice && (
        <div style={{ position: 'fixed', top: 16, right: 16, background: '#065f46', color: '#fff', borderRadius: 10, padding: '10px 16px', zIndex: 100, fontSize: 14 }}>
          {notice}
        </div>
      )}

      {justCreated && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
          Галерею створено. Тепер завантажте фото та відео, оберіть обкладинку і налаштуйте дизайн — усе зберігається автоматично.
        </div>
      )}

      {/* Header: what this gallery is + how to share it */}
      <div style={{ ...card, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {g.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.cover_url} alt="" style={{ width: 84, height: 84, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 84, height: 84, borderRadius: 12, background: '#F5EFE6', color: '#c9bda6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>▦</div>
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 24, fontWeight: 900, margin: 0 }}>{g.title}</h1>
          <div style={{ fontSize: 13.5, color: '#8B8378', marginTop: 4 }}>
            {g.client_name && <span>{g.client_name} · </span>}
            {g.shoot_date && <span>{new Date(g.shoot_date).toLocaleDateString('uk-UA')} · </span>}
            <span>{g.photo_count} фото</span>
            {g.favorite_count > 0 && <span> · ♥ {g.favorite_count} обрано клієнтом</span>}
            {(g.zip_downloads > 0 || g.photo_downloads > 0) && <span> · ↓ {g.zip_downloads + g.photo_downloads} завантажень</span>}
          </div>
          <div style={{ fontSize: 12.5, color: '#8B8378', marginTop: 2 }}>
            {g.files_purged_at
              ? 'Термін зберігання минув — файли видалено'
              : `Клієнт може завантажити фото до ${new Date(g.expires_at).toLocaleDateString('uk-UA')} — це ще ${g.days_left} дн.`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => { navigator.clipboard.writeText(clientUrl); flash('Посилання скопійовано'); }}>
            Скопіювати посилання
          </button>
          <a style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }} href={`/uk/gallery/${g.client_token}`} target="_blank" rel="noreferrer">
            Переглянути
          </a>
        </div>
      </div>

      {/* 1. Photos */}
      <div style={card}>
        <h2 style={sectionTitle}>Фото та відео</h2>
        <p style={{ color: '#8B8378', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
          Завантажте файли зйомки, оберіть обкладинку і приберіть зайве. Фото до 25 МБ, відео до 200 МБ, разом до 500 файлів.
        </p>
        {!g.files_purged_at && <UploadZone token={token} galleryId={g.id} onDone={load} flash={flash} />}
        {g.photo_count > 0 && (
          <PhotoManager token={token} galleryId={g.id} coverPhotoId={g.cover_photo_id} onDone={load} flash={flash} />
        )}
      </div>

      {/* 2. What the client picked for print */}
      {g.favorite_count > 0 && (
        <div style={card}>
          <h2 style={sectionTitle}>Обрані клієнтом ({g.favorite_count})</h2>
          <p style={{ color: '#8B8378', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
            Ці фото клієнт позначив серцем — саме з них він хоче фотокнигу або друк.
          </p>
          <ClientPicks token={token} galleryId={g.id} />
        </div>
      )}

      {/* 3. Design */}
      <div style={card}>
        <h2 style={sectionTitle}>Дизайн галереї</h2>
        <p style={{ color: '#8B8378', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
          Оберіть, як галерея виглядатиме для клієнта. Кожна зміна зберігається одразу, а превʼю нижче показує справжню сторінку.
        </p>
        <DesignPanel token={token} galleryId={g.id} design={g.design} clientToken={g.client_token}
          photoCount={g.photo_count} coverUrl={g.cover_url} onDone={load} flash={flash} />
      </div>

      {/* 4. Settings */}
      <div style={card}>
        <h2 style={sectionTitle}>Налаштування</h2>
        <p style={{ color: '#8B8378', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
          Назва і дата показуються клієнту на обкладинці, термін зберігання визначає, скільки часу галерея буде доступна.
        </p>
        <EditGalleryPanel token={token} gallery={g} onDone={load} flash={flash} />
      </div>
    </>
  );
}
