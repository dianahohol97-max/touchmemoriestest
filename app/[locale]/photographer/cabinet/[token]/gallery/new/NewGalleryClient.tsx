'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { card, sectionTitle, btn, btnGhost, label, input } from '../../CabinetClient';

/**
 * Creating a gallery is its own page (Diana: «кнопка нова галерея має
 * відкривати нову сторінку»). Previously the cabinet expanded an inline form,
 * which read as "nothing happened". On success it goes straight to that
 * gallery's editor, where photos, cover and design live.
 */
export default function NewGalleryClient({ token }: { token: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [termDays, setTermDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

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
      router.push(`/uk/photographer/cabinet/${token}/gallery/${json.gallery.id}`);
    } catch {
      setError('Не вдалося створити галерею. Спробуйте ще раз.');
    } finally { setCreating(false); }
  };

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, paddingTop: 110 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 80px', fontFamily: 'var(--font-body), sans-serif', color: '#1A1A1A' }}>
          <a href={back} style={{ display: 'inline-block', fontSize: 14, fontWeight: 700, color: '#263A99', textDecoration: 'none', marginBottom: 14 }}>
            ← Усі галереї
          </a>

          <h1 style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>
            Нова галерея
          </h1>
          <p style={{ color: '#8B8378', fontSize: 14, margin: '0 0 18px' }}>
            Заповніть назву — решту можна змінити будь-коли. Після створення відкриється сторінка галереї, де ви завантажите фото і налаштуєте дизайн.
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
                {creating ? 'Створюємо…' : 'Створити галерею'}
              </button>
              <a href={back} style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Скасувати</a>
            </div>
          </div>
        </div>
      </main>
      <Footer categories={[]} />
    </div>
  );
}
