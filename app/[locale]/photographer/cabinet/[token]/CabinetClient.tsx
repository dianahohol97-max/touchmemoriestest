'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Profile {
  id: string; slug: string; name: string; bio: string | null; email: string;
  phone: string | null; instagram: string | null; website: string | null;
  logo_url: string | null; avatar_url: string | null;
  city: string | null; specialization: string | null;
  landing_enabled: boolean; pricing: PriceRow[]; portfolio: string[];
  custom_domain: string | null; custom_domain_paid: boolean;
}
interface PriceRow { title: string; price: string; description?: string }
interface Gallery {
  id: string; client_token: string; title: string; client_name: string | null;
  shoot_date: string | null; expires_at: string; files_purged_at: string | null;
  photo_count: number; days_left: number;
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 4, marginTop: 12 };
const input: React.CSSProperties = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' };
const btn: React.CSSProperties = { background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 };
const btnGhost: React.CSSProperties = { ...btn, background: '#f1f5f9', color: '#1e2d7d' };

export default function CabinetClient({ token }: { token: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 2500); };

  const loadAll = async () => {
    const [pRes, gRes] = await Promise.all([
      fetch(`/api/photographers/profile?token=${encodeURIComponent(token)}`),
      fetch(`/api/photographers/galleries?token=${encodeURIComponent(token)}`),
    ]);
    const pJson = await pRes.json();
    const gJson = await gRes.json();
    if (!pRes.ok) { setError(pJson?.error || 'Кабінет не знайдено'); return; }
    setProfile(pJson.photographer);
    setGalleries(gJson.galleries || []);
  };

  useEffect(() => { loadAll().finally(() => setLoading(false)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  if (loading) return <Centered>Завантаження…</Centered>;
  if (error || !profile) return <Centered>{error || 'Кабінет не знайдено'}</Centered>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px 80px', fontFamily: 'Arial, sans-serif', color: '#1f2937', background: '#f8fafc' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', margin: '0 0 4px' }}>Кабінет фотографа</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 20 }}>
        Ваша сторінка: <a href={`/uk/photographer/${profile.slug}`} target="_blank" style={{ color: '#1e2d7d' }}>/photographer/{profile.slug}</a>
        {profile.custom_domain_paid && profile.custom_domain && <> · домен: <b>{profile.custom_domain}</b></>}
      </p>

      {notice && <div style={{ position: 'fixed', top: 16, right: 16, background: '#065f46', color: '#fff', borderRadius: 8, padding: '10px 16px', zIndex: 100, fontSize: 14 }}>{notice}</div>}

      <GalleriesSection token={token} galleries={galleries} onChanged={loadAll} flash={flash} />
      <ProfileSection token={token} profile={profile} onChanged={loadAll} flash={flash} />
      <LandingSection token={token} profile={profile} onChanged={loadAll} flash={flash} />
    </div>
  );
}

/* ── Галереї ─────────────────────────────────────────────────────────── */

function GalleriesSection({ token, galleries, onChanged, flash }: {
  token: string; galleries: Gallery[]; onChanged: () => Promise<void>; flash: (m: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [openUpload, setOpenUpload] = useState<string | null>(null);

  const create = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/photographers/galleries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, title, client_name: clientName, shoot_date: shootDate || null }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || 'Помилка'); return; }
      setTitle(''); setClientName(''); setShootDate(''); setShowNew(false);
      await onChanged();
      flash('Галерею створено');
    } finally { setCreating(false); }
  };

  const copyLink = (g: Gallery) => {
    navigator.clipboard.writeText(`${window.location.origin}/uk/gallery/${g.client_token}`);
    flash('Посилання скопійовано');
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Галереї клієнтів</h2>
        <button style={btn} onClick={() => setShowNew(v => !v)}>{showNew ? 'Скасувати' : '+ Нова галерея'}</button>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Фото зберігаються 30 днів від створення галереї, після чого видаляються автоматично.</p>

      {showNew && (
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginTop: 8 }}>
          <label style={label}>Назва галереї *</label>
          <input style={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Весілля Олена та Максим" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Ім&apos;я клієнта</label>
              <input style={input} value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div>
              <label style={label}>Дата зйомки</label>
              <input style={input} type="date" value={shootDate} onChange={e => setShootDate(e.target.value)} />
            </div>
          </div>
          <button style={{ ...btn, marginTop: 14 }} onClick={create} disabled={creating}>{creating ? 'Створюємо…' : 'Створити'}</button>
        </div>
      )}

      {galleries.length === 0 && !showNew && <div style={{ color: '#94a3b8', marginTop: 12 }}>Поки що немає галерей.</div>}

      {galleries.map(g => (
        <div key={g.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontWeight: 800 }}>{g.title}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                {g.client_name && <span>{g.client_name} · </span>}
                {g.shoot_date && <span>{new Date(g.shoot_date).toLocaleDateString('uk-UA')} · </span>}
                <span>{g.photo_count} фото</span>
              </div>
            </div>
            {g.files_purged_at
              ? <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fef2f2', borderRadius: 999, padding: '4px 10px' }}>Термін минув</span>
              : <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fffbeb', borderRadius: 999, padding: '4px 10px' }}>⏳ ще {g.days_left} дн.</span>}
          </div>
          {!g.files_purged_at && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={btnGhost} onClick={() => copyLink(g)}>Скопіювати посилання</button>
              <a href={`/uk/gallery/${g.client_token}`} target="_blank" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Переглянути</a>
              <button style={btnGhost} onClick={() => setOpenUpload(openUpload === g.id ? null : g.id)}>
                {openUpload === g.id ? 'Згорнути' : 'Завантажити фото'}
              </button>
            </div>
          )}
          {openUpload === g.id && <UploadZone token={token} galleryId={g.id} onDone={onChanged} flash={flash} />}
        </div>
      ))}
    </div>
  );
}

function UploadZone({ token, galleryId, onDone, flash }: {
  token: string; galleryId: string; onDone: () => Promise<void>; flash: (m: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    try {
      const all = Array.from(files);
      // Один файл на запит — перевірений у проєкті патерн (/api/upload/order-file):
      // великі multipart-тіла з кількох фото ризикують упертись у ліміт функції.
      let done = 0;
      for (const f of all) {
        const fd = new FormData();
        fd.append('token', token);
        fd.append('files', f);
        const res = await fetch(`/api/photographers/galleries/${galleryId}/photos`, { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) { alert(json?.error || 'Помилка аплоаду'); break; }
        done += 1;
        setProgress(`${done}/${all.length}`);
      }
      await onDone();
      if (done > 0) flash(`Завантажено ${done} фото`);
    } finally { setBusy(false); setProgress(''); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 10, padding: 14 }}>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => upload(e.target.files)} disabled={busy} />
      {busy && <div style={{ marginTop: 8, color: '#1e2d7d', fontWeight: 700, fontSize: 14 }}>Завантажуємо… {progress}</div>}
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Лише зображення, до 25 МБ кожне, до 500 фото в галереї.</div>
    </div>
  );
}

/* ── Профіль ─────────────────────────────────────────────────────────── */

function ProfileSection({ token, profile, onChanged, flash }: {
  token: string; profile: Profile; onChanged: () => Promise<void>; flash: (m: string) => void;
}) {
  const [form, setForm] = useState({
    name: profile.name || '', bio: profile.bio || '', phone: profile.phone || '',
    instagram: profile.instagram || '', website: profile.website || '',
    city: profile.city || '', specialization: profile.specialization || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/photographers/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      });
      if (res.ok) { await onChanged(); flash('Профіль збережено'); }
      else alert((await res.json())?.error || 'Помилка');
    } finally { setSaving(false); }
  };

  return (
    <div style={card}>
      <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Профіль (візитка)</h2>
      <label style={label}>Ім&apos;я / назва студії</label>
      <input style={input} value={form.name} onChange={set('name')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label}>Спеціалізація</label>
          <input style={input} value={form.specialization} onChange={set('specialization')} placeholder="Весільний фотограф" />
        </div>
        <div>
          <label style={label}>Місто</label>
          <input style={input} value={form.city} onChange={set('city')} placeholder="Київ" />
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
        Спеціалізація і місто показуються в заголовку вашої сторінки та допомагають знаходити вас у Google (напр. «весільний фотограф Київ»).
      </div>
      <label style={label}>Про себе</label>
      <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} value={form.bio} onChange={set('bio')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={label}>Телефон</label><input style={input} value={form.phone} onChange={set('phone')} /></div>
        <div><label style={label}>Instagram</label><input style={input} value={form.instagram} onChange={set('instagram')} placeholder="@username" /></div>
      </div>
      <label style={label}>Сайт</label>
      <input style={input} value={form.website} onChange={set('website')} placeholder="https://…" />

      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <BrandUpload token={token} kind="logo" current={profile.logo_url} label="Логотип" onDone={onChanged} flash={flash} />
        <BrandUpload token={token} kind="avatar" current={profile.avatar_url} label="Фото профілю" onDone={onChanged} flash={flash} />
      </div>

      <button style={{ ...btn, marginTop: 16 }} onClick={save} disabled={saving}>{saving ? 'Зберігаємо…' : 'Зберегти профіль'}</button>
    </div>
  );
}

function BrandUpload({ token, kind, current, label: title, onDone, flash }: {
  token: string; kind: 'logo' | 'avatar' | 'portfolio'; current?: string | null; label: string;
  onDone: () => Promise<void>; flash: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('token', token); fd.append('kind', kind); fd.append('file', file);
      const res = await fetch('/api/photographers/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || 'Помилка'); return; }
      await onDone();
      flash(`${title}: завантажено`);
    } finally { setBusy(false); }
  };
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      {current && kind !== 'portfolio' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
      )}
      <span style={{ ...btnGhost, display: 'inline-block' }}>{busy ? 'Завантажуємо…' : `${title} ⬆`}</span>
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => upload(e.target.files?.[0])} disabled={busy} />
    </label>
  );
}

/* ── Лендинг: прайс + портфоліо + домен ──────────────────────────────── */

function LandingSection({ token, profile, onChanged, flash }: {
  token: string; profile: Profile; onChanged: () => Promise<void>; flash: (m: string) => void;
}) {
  const [pricing, setPricing] = useState<PriceRow[]>(Array.isArray(profile.pricing) ? profile.pricing : []);
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, k: keyof PriceRow, v: string) =>
    setPricing(rows => rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const save = async () => {
    setSaving(true);
    try {
      const clean = pricing.filter(r => (r.title || '').trim());
      const res = await fetch('/api/photographers/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pricing: clean }),
      });
      if (res.ok) { setPricing(clean); await onChanged(); flash('Прайс збережено'); }
      else alert((await res.json())?.error || 'Помилка');
    } finally { setSaving(false); }
  };

  const removePortfolio = async (url: string) => {
    const next = (profile.portfolio || []).filter(u => u !== url);
    const res = await fetch('/api/photographers/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, portfolio: next }),
    });
    if (res.ok) { await onChanged(); flash('Фото прибрано з портфоліо'); }
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Лендинг: прайс і портфоліо</h2>
        <a href={`/uk/photographer/${profile.slug}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
          Переглянути мою сторінку ↗
        </a>
      </div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
        Адреса вашого лендингу: <a href={`/uk/photographer/${profile.slug}`} target="_blank" style={{ color: '#1e2d7d', fontWeight: 700 }}>touchmemories.com.ua/uk/photographer/{profile.slug}</a>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 16 }}>Прайс</h3>
      {pricing.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <input style={input} placeholder="Послуга (напр. Фотосесія 1 год)" value={row.title || ''} onChange={e => setRow(i, 'title', e.target.value)} />
          <input style={input} placeholder="Ціна" value={row.price || ''} onChange={e => setRow(i, 'price', e.target.value)} />
          <input style={input} placeholder="Опис (необов'язково)" value={row.description || ''} onChange={e => setRow(i, 'description', e.target.value)} />
          <button style={{ ...btnGhost, padding: '9px 12px' }} onClick={() => setPricing(rows => rows.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={btnGhost} onClick={() => setPricing(r => [...r, { title: '', price: '' }])}>+ Додати позицію</button>
        <button style={btn} onClick={save} disabled={saving}>{saving ? 'Зберігаємо…' : 'Зберегти прайс'}</button>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 22 }}>Портфоліо</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginTop: 8 }}>
        {(profile.portfolio || []).map(url => (
          <div key={url} style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
            <button onClick={() => removePortfolio(url)}
              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', lineHeight: '20px' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <BrandUpload token={token} kind="portfolio" label="Додати фото в портфоліо" onDone={onChanged} flash={flash} />
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 22 }}>Власний домен</h3>
      {profile.custom_domain_paid && profile.custom_domain ? (
        <p style={{ fontSize: 14, color: '#065f46', margin: 0 }}>Підключено: <b>{profile.custom_domain}</b></p>
      ) : (
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Платна опція: ваш лендинг на власному домені (напр. <i>photo-olena.com</i>).
          Напишіть нам на <a href="mailto:hello@touchmemories.com.ua" style={{ color: '#1e2d7d' }}>hello@touchmemories.com.ua</a> — підключимо.
        </p>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>{children}</div>;
}
