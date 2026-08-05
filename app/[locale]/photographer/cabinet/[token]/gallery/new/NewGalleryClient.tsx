'use client';

import React, { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { card, sectionTitle, btn, btnGhost, label, input } from '../../CabinetClient';
import GalleryWorkspace from '../GalleryWorkspace';

/**
 * Creating a gallery is its own page (Diana: «кнопка нова галерея має
 * відкривати нову сторінку»), and the whole preparation happens on it: name
 * the gallery, then upload photos and video, pick the cover and tune the
 * design without leaving the screen (Diana, 2026-08-05: «де конструктор
 * галереї, і де поле для завантаження фото і відео»).
 *
 * Why two steps rather than one big form: upload, cover and design all need
 * a gallery id on the server. The first step creates the record, then the
 * page swaps in the same workspace the editor page uses and rewrites the URL
 * to that gallery, so a refresh or a shared link lands on the editor instead
 * of an empty creation form.
 */
export default function NewGalleryClient({ token }: { token: string }) {
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [termDays, setTermDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState('');

  const back = `/uk/photographer/cabinet/${token}`;

  const create = async () => {
    if (!title.trim()) { setError('Вкажіть назву галереї'); return; }
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/photographers/galleries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, title, client_name: clientName, shoot_date: shootDate || null, term_days: termDays }),
      });
      const json = await res.json();
      if (!res.ok || !json?.gallery?.id) { setError(json?.error || 'Не вдалося створити галерею'); return; }
      // Stay on the page — just become the editor for the gallery we made.
      window.history.replaceState(null, '', `${back}/gallery/${json.gallery.id}`);
      setCreatedId(json.gallery.id);
      window.scrollTo({ top: 0 });
    } catch {
      setError('Не вдалося створити галерею. Спробуйте ще раз.');
    } finally { setCreating(false); }
  };

  const stepChip = (n: number, text: string, active: boolean, done: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: active ? '#263A99' : done ? '#065f46' : '#a8a29e' }}>
      <span style={{
        width: 24, height: 24, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12.5, color: '#fff', background: active ? '#263A99' : done ? '#059669' : '#d6d3d1',
      }}>{done ? '✓' : n}</span>
      {text}
    </div>
  );

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, paddingTop: 110 }}>
        {/* Step 1 is a narrow form; step 2 is the full workspace, which puts
            the design preview beside the options on desktop. */}
        <div style={{ maxWidth: createdId ? 1180 : 720, margin: '0 auto', padding: '20px 16px 80px', fontFamily: 'var(--font-body), sans-serif', color: '#1A1A1A' }}>
          <a href={back} style={{ display: 'inline-block', fontSize: 14, fontWeight: 700, color: '#263A99', textDecoration: 'none', marginBottom: 14 }}>
            ← Усі галереї
          </a>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
            {stepChip(1, 'Назва і термін', !createdId, !!createdId)}
            {stepChip(2, 'Фото, обкладинка і дизайн', !!createdId, false)}
          </div>

          {createdId ? (
            <GalleryWorkspace token={token} galleryId={createdId} justCreated />
          ) : (
            <>
              <h1 style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>
                Нова галерея
              </h1>
              <p style={{ color: '#8B8378', fontSize: 14, margin: '0 0 18px' }}>
                Досить однієї назви. Одразу після створення на цій самій сторінці зʼявиться завантаження фото та відео, вибір обкладинки і конструктор дизайну галереї.
              </p>

              <div style={card}>
                <h2 style={sectionTitle}>Основне</h2>

                <label style={label}>Назва галереї *</label>
                <input style={input} value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Весілля Олена та Максим" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') create(); }} />
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                  Клієнт побачить цю назву великим шрифтом на обкладинці.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={label}>Ім&apos;я клієнта</label>
                    <input style={input} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Олена та Максим" />
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Показується під назвою. Можна не заповнювати.</div>
                  </div>
                  <div>
                    <label style={label}>Дата зйомки</label>
                    <input style={input} type="date" value={shootDate} onChange={e => setShootDate(e.target.value)} />
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Теж видно на обкладинці.</div>
                  </div>
                </div>

                <label style={label}>Термін зберігання</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[30, 60, 90].map(d => (
                    <button key={d} type="button" onClick={() => setTermDays(d)}
                      style={{
                        padding: '9px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'var(--font-heading), sans-serif',
                        border: termDays === d ? '2px solid #263A99' : '1px solid #e2e8f0',
                        background: termDays === d ? '#eef3ff' : '#fff', color: '#1f2937',
                      }}>
                      {d} днів
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>
                  Після завершення терміну фото видаляються автоматично, а клієнт бачить сторінку з вашими контактами. Термін можна продовжити пізніше.
                </div>

                {error && <div style={{ color: '#b91c1c', fontSize: 13.5, marginTop: 12 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                  <button style={btn} onClick={create} disabled={creating}>
                    {creating ? 'Створюємо…' : 'Створити і завантажити фото'}
                  </button>
                  <a href={back} style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Скасувати</a>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer categories={[]} />
    </div>
  );
}
