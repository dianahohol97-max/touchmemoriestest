'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LANDING_THEMES } from '@/lib/photographers/themes';

interface Profile {
  id: string; slug: string; name: string; bio: string | null; email: string;
  phone: string | null; instagram: string | null; website: string | null;
  logo_url: string | null; avatar_url: string | null;
  city: string | null; specialization: string | null;
  landing_enabled: boolean; landing_theme: string | null;
  pricing: PriceRow[]; portfolio: string[];
  custom_domain: string | null; custom_domain_paid: boolean;
  booking_enabled: boolean;
  pay_mono_enabled: boolean; pay_mono_link: string | null;
  pay_wfp_enabled: boolean; pay_wfp_link: string | null;
  pay_requisites_enabled: boolean; pay_requisites: string | null;
}
interface Slot {
  id: string; slot_date: string; slot_time: string; duration_min: number;
  price: string | null; status: string; payment_status: string;
  client_name: string | null; client_phone: string | null; client_comment: string | null;
}
interface PriceRow { title: string; price: string; description?: string }
interface Gallery {
  id: string; client_token: string; title: string; client_name: string | null;
  shoot_date: string | null; expires_at: string; files_purged_at: string | null;
  photo_count: number; favorite_count: number; days_left: number;
}
interface CabinetPhoto { id: string; file_name: string; url: string; favorite: boolean }

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 4, marginTop: 12 };
const input: React.CSSProperties = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, boxSizing: 'border-box' };
const btn: React.CSSProperties = { background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 };
const btnGhost: React.CSSProperties = { ...btn, background: '#f1f5f9', color: '#1e2d7d' };

export default function CabinetClient({ token }: { token: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [b2bStatus, setB2bStatus] = useState<string | null>(null);
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
    setB2bStatus(pJson.b2b_status ?? null);
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

      {/* Two logins are easy to confuse: this token-based cabinet manages
          galleries/landing, while BUYING with the 10% partner discount needs
          the customer account (email+password). Steer photographers there. */}
      <DiscountBanner status={b2bStatus} />

      {notice && <div style={{ position: 'fixed', top: 16, right: 16, background: '#065f46', color: '#fff', borderRadius: 8, padding: '10px 16px', zIndex: 100, fontSize: 14 }}>{notice}</div>}

      <GalleriesSection token={token} galleries={galleries} onChanged={loadAll} flash={flash} />
      <BookingCabinetSection token={token} profile={profile} onChanged={loadAll} flash={flash} />
      <ProfileSection token={token} profile={profile} onChanged={loadAll} flash={flash} />
      <LandingSection token={token} profile={profile} onChanged={loadAll} flash={flash} />
    </div>
  );
}

/* ── Плашка про купівельну знижку 10% (два різні входи) ──────────────── */

function DiscountBanner({ status }: { status: string | null }) {
  // verified — discount active; pending — applied but awaiting approval;
  // null / other — no application yet (this cabinet may be self-service only).
  if (status === 'verified') {
    return (
      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, color: '#065f46', fontSize: 15, marginBottom: 2 }}>Ваша знижка 10% активна</div>
        <div style={{ fontSize: 13, color: '#047857', marginBottom: 10 }}>
          Щоб купувати фотокниги, журнали, фотодрук і тревелбуки зі знижкою — <b>увійдіть у свій акаунт покупця</b> (той самий email і пароль, що при реєстрації). Ціна зі знижкою враховується автоматично в каталозі й кошику.
        </div>
        <a href="/uk/login" style={{ display: 'inline-block', background: '#065f46', color: '#fff', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          Увійти в акаунт, щоб купувати зі знижкою
        </a>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, color: '#92400e', fontSize: 15, marginBottom: 2 }}>⏳ Заявку на знижку 10% розглядаємо</div>
        <div style={{ fontSize: 13, color: '#b45309' }}>
          Щойно ми підтвердимо заявку, знижка на фотокниги, журнали, фотодрук і тревелбуки увімкнеться у вашому акаунті автоматично — і ви зможете купувати за спеціальною ціною.
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ fontWeight: 800, color: '#1e2d7d', fontSize: 15, marginBottom: 2 }}>Хочете знижку 10% на друк?</div>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
        Цей кабінет — для галерей і вашої сторінки. Окремо ви можете отримати <b>постійну знижку 10%</b> на фотокниги, журнали, фотодрук і тревелбуки для клієнтських проєктів — подайте коротку заявку фотографа.
      </div>
      <a href="/uk/photographers" style={{ display: 'inline-block', background: '#1e2d7d', color: '#fff', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
        Подати заявку на знижку 10%
      </a>
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
  const [openPicks, setOpenPicks] = useState<string | null>(null);

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
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
              {g.favorite_count > 0 && (
                <span style={{ fontSize: 12, fontWeight: 800, color: '#c0343a', background: '#fff1f2', borderRadius: 999, padding: '4px 10px' }}>
                  ♥ {g.favorite_count} обрано клієнтом
                </span>
              )}
              {g.files_purged_at
                ? <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fef2f2', borderRadius: 999, padding: '4px 10px' }}>Термін минув</span>
                : <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fffbeb', borderRadius: 999, padding: '4px 10px' }}>⏳ ще {g.days_left} дн.</span>}
            </div>
          </div>
          {!g.files_purged_at && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={btnGhost} onClick={() => copyLink(g)}>Скопіювати посилання</button>
              <a href={`/uk/gallery/${g.client_token}`} target="_blank" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Переглянути</a>
              {g.favorite_count > 0 && (
                <button
                  style={{ ...btnGhost, background: '#fff1f2', color: '#c0343a' }}
                  onClick={() => { setOpenPicks(openPicks === g.id ? null : g.id); setOpenUpload(null); }}
                >
                  {openPicks === g.id ? 'Згорнути' : `♥ Обрані клієнтом (${g.favorite_count})`}
                </button>
              )}
              <button style={btnGhost} onClick={() => { setOpenUpload(openUpload === g.id ? null : g.id); setOpenPicks(null); }}>
                {openUpload === g.id ? 'Згорнути' : 'Завантажити фото'}
              </button>
            </div>
          )}
          {openPicks === g.id && <ClientPicks token={token} galleryId={g.id} />}
          {openUpload === g.id && <UploadZone token={token} galleryId={g.id} onDone={onChanged} flash={flash} />}
        </div>
      ))}
    </div>
  );
}

/** Read-only grid of the photos the client hearted — what the photographer
 *  should print. Fetched on demand when the card is expanded. */
function ClientPicks({ token, galleryId }: { token: string; galleryId: string }) {
  const [photos, setPhotos] = useState<CabinetPhoto[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/photographers/galleries/${galleryId}/photos?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json?.error || 'Не вдалося завантажити'); return; }
        setPhotos((json.photos as CabinetPhoto[]).filter(p => p.favorite));
      } catch { if (!cancelled) setError('Не вдалося завантажити'); }
    })();
    return () => { cancelled = true; };
  }, [token, galleryId]);

  if (error) return <div style={{ marginTop: 10, color: '#991b1b', fontSize: 13 }}>{error}</div>;
  if (!photos) return <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>Завантаження…</div>;
  if (photos.length === 0) return <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>Клієнт ще нічого не обрав.</div>;

  return (
    <div style={{ marginTop: 10, background: '#fff8f8', border: '1px solid #fde3e4', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#c0343a', marginBottom: 8 }}>
        Клієнт обрав {photos.length} фото для друку:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
        {photos.map(p => (
          <a key={p.id} href={p.url} download={p.file_name} target="_blank" rel="noopener noreferrer"
             title={`Завантажити ${p.file_name}`} style={{ display: 'block' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.file_name} loading="lazy"
                 style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, border: '1px solid #f1d4d5' }} />
          </a>
        ))}
      </div>
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
      <span style={{ ...btnGhost, display: 'inline-block' }}>{busy ? 'Завантажуємо…' : `${title}`}</span>
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

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 16 }}>Дизайн сторінки</h3>
      <ThemePicker token={token} current={profile.landing_theme || 'classic'} onChanged={onChanged} flash={flash} slug={profile.slug} />

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 22 }}>Прайс</h3>
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

/* ── Запис на зйомку: слоти + оплата ─────────────────────────────────── */

const fmtSlotDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });

function BookingCabinetSection({ token, profile, onChanged, flash }: {
  token: string; profile: Profile; onChanged: () => Promise<void>; flash: (m: string) => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState('');
  const [adding, setAdding] = useState(false);
  const [pay, setPay] = useState({
    booking_enabled: profile.booking_enabled ?? true,
    pay_mono_enabled: !!profile.pay_mono_enabled, pay_mono_link: profile.pay_mono_link || '',
    pay_mono_token: (profile as any).pay_mono_token || '',
    pay_wfp_enabled: !!profile.pay_wfp_enabled, pay_wfp_link: profile.pay_wfp_link || '',
    pay_wfp_account: (profile as any).pay_wfp_account || '',
    pay_wfp_secret: (profile as any).pay_wfp_secret || '',
    pay_requisites_enabled: !!profile.pay_requisites_enabled, pay_requisites: profile.pay_requisites || '',
  });
  const [savingPay, setSavingPay] = useState(false);

  const loadSlots = async () => {
    const res = await fetch(`/api/photographers/slots?token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (res.ok) setSlots(json.slots || []);
  };
  useEffect(() => { loadSlots(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const addSlot = async () => {
    if (!date || !time || adding) return;
    setAdding(true);
    try {
      const res = await fetch('/api/photographers/slots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, date, time, duration_min: duration, price }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || 'Помилка'); return; }
      setTime(''); setPrice('');
      await loadSlots();
      flash('Слот додано');
    } finally { setAdding(false); }
  };

  const removeSlot = async (id: string) => {
    const res = await fetch('/api/photographers/slots', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slot_id: id }),
    });
    if (res.ok) { await loadSlots(); flash('Слот видалено'); }
    else alert((await res.json())?.error || 'Помилка');
  };

  const markPaid = async (id: string, paid: boolean) => {
    const res = await fetch('/api/photographers/slots', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slot_id: id, paid }),
    });
    if (res.ok) { await loadSlots(); flash(paid ? 'Позначено оплаченим' : 'Позначку знято'); }
    else alert((await res.json())?.error || 'Помилка');
  };

  const savePayments = async () => {
    setSavingPay(true);
    try {
      const res = await fetch('/api/photographers/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...pay }),
      });
      if (res.ok) { await onChanged(); flash('Налаштування оплати збережено'); }
      else alert((await res.json())?.error || 'Помилка');
    } finally { setSavingPay(false); }
  };

  const toggle = (k: keyof typeof pay) => setPay(p => ({ ...p, [k]: !p[k] }));

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Запис на зйомку</h2>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
          {/* Зберігається одразу — вимкнув і блок зник зі сторінки, без окремої кнопки */}
          <input type="checkbox" checked={pay.booking_enabled}
            onChange={async e => {
              const enabled = e.target.checked;
              setPay(p => ({ ...p, booking_enabled: enabled }));
              const res = await fetch('/api/photographers/profile', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, booking_enabled: enabled }),
              });
              if (res.ok) flash(enabled ? 'Запис увімкнено на сторінці' : 'Запис вимкнено — блок зник зі сторінки');
              else { setPay(p => ({ ...p, booking_enabled: !enabled })); alert('Не вдалося зберегти'); }
            }} />
          Показувати запис на сторінці
        </label>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
        Додайте вільні дати й час — клієнти бронюватимуть їх прямо на вашій сторінці, а вам прийде лист. Оплата надходить напряму вам.
      </p>

      {/* Додавання слота */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, background: '#f8fafc', borderRadius: 10, padding: 14 }}>
        <div>
          <label style={label}>Дата</label>
          <input style={input} type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={label}>Час</label>
          <input style={input} type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div>
          <label style={label}>Тривалість</label>
          <select style={input} value={duration} onChange={e => setDuration(Number(e.target.value))}>
            <option value={30}>30 хв</option><option value={60}>1 год</option>
            <option value={90}>1.5 год</option><option value={120}>2 год</option>
            <option value={180}>3 год</option><option value={240}>4 год</option>
          </select>
        </div>
        <div>
          <label style={label}>Ціна (текст)</label>
          <input style={input} value={price} onChange={e => setPrice(e.target.value)} placeholder="2500 грн" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button style={{ ...btn, width: '100%' }} onClick={addSlot} disabled={adding || !date || !time}>
            {adding ? '…' : '+ Додати'}
          </button>
        </div>
      </div>

      {/* Список слотів */}
      {slots.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          {slots.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontWeight: 800, minWidth: 130, textTransform: 'capitalize' }}>{fmtSlotDate(s.slot_date)}</div>
              <div style={{ fontWeight: 700 }}>{s.slot_time}</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>{s.duration_min} хв{s.price ? ` · ${s.price}` : ''}</div>
              <div style={{ flex: 1 }} />
              {s.status === 'booked' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46', background: '#ecfdf5', borderRadius: 999, padding: '4px 10px' }}>
                    ✓ {s.client_name} · {s.client_phone}
                  </span>
                  {/* Payment badge: platform never sees the money — the client
                      claims payment, the photographer verifies in their bank */}
                  {s.payment_status === 'paid' ? (
                    <button onClick={() => markPaid(s.id, false)} title="Зняти позначку"
                      style={{ fontSize: 12, fontWeight: 700, color: '#065f46', background: '#d1fae5', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
                       Оплачено
                    </button>
                  ) : s.payment_status === 'claimed' ? (
                    <button onClick={() => markPaid(s.id, true)} title="Клієнт повідомив про оплату — перевірте банк і підтвердіть"
                      style={{ fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px dashed #f59e0b', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
                       Клієнт повідомив про оплату — підтвердити?
                    </button>
                  ) : (
                    <button onClick={() => markPaid(s.id, true)} title="Позначити оплаченим"
                      style={{ fontSize: 12, fontWeight: 700, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
                      Не оплачено · позначити ✓
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fffbeb', borderRadius: 999, padding: '4px 10px' }}>Вільно</span>
                  <button style={{ ...btnGhost, padding: '6px 10px' }} onClick={() => removeSlot(s.id)}>✕</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Оплата */}
      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, marginTop: 22 }}>Оплата (напряму вам)</h3>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
        Клієнт побачить увімкнені способи одразу після бронювання. Увімкніть хоча б один — або жодного, якщо берете оплату при зустрічі.
      </p>
      <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={pay.pay_mono_enabled} onChange={() => toggle('pay_mono_enabled')} />
            Monobank
          </label>
          {pay.pay_mono_enabled && (
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <div>
                <label style={{ ...label, marginTop: 0 }}>Варіант 1 — просто посилання (банка/оплата)</label>
                <input style={input} placeholder="https://send.monobank.ua/jar/…"
                  value={pay.pay_mono_link} onChange={e => setPay(p => ({ ...p, pay_mono_link: e.target.value }))} />
              </div>
              <div>
                <label style={{ ...label, marginTop: 0 }}>Варіант 2 — автопідтвердження: токен еквайрингу mono (X-Token)</label>
                <input style={input} placeholder="Токен з кабінету еквайрингу monobank (для ФОП)"
                  value={pay.pay_mono_token} onChange={e => setPay(p => ({ ...p, pay_mono_token: e.target.value }))} />
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  З токеном рахунок створюється автоматично на суму слота, а статус «Оплачено» ставиться сам після оплати. Токен бачите лише ви.
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={pay.pay_wfp_enabled} onChange={() => toggle('pay_wfp_enabled')} />
            WayForPay
          </label>
          {pay.pay_wfp_enabled && (
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <div>
                <label style={{ ...label, marginTop: 0 }}>Варіант 1 — просто посилання на оплату</label>
                <input style={input} placeholder="https://secure.wayforpay.com/…"
                  value={pay.pay_wfp_link} onChange={e => setPay(p => ({ ...p, pay_wfp_link: e.target.value }))} />
              </div>
              <div>
                <label style={{ ...label, marginTop: 0 }}>Варіант 2 — автопідтвердження: merchant-дані WayForPay</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input style={input} placeholder="merchantAccount"
                    value={pay.pay_wfp_account} onChange={e => setPay(p => ({ ...p, pay_wfp_account: e.target.value }))} />
                  <input style={input} type="password" placeholder="SecretKey"
                    value={pay.pay_wfp_secret} onChange={e => setPay(p => ({ ...p, pay_wfp_secret: e.target.value }))} />
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  З merchant-даними рахунок створюється автоматично, а «Оплачено» ставиться саме після оплати. Ключі бачите лише ви.
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={pay.pay_requisites_enabled} onChange={() => toggle('pay_requisites_enabled')} />
            Реквізити для ручної оплати
          </label>
          {pay.pay_requisites_enabled && (
            <textarea style={{ ...input, marginTop: 8, minHeight: 70, resize: 'vertical' }}
              placeholder={'Картка: 5375 0000 0000 0000\nОтримувач: Олена Коваленко\nПризначення: фотозйомка'}
              value={pay.pay_requisites} onChange={e => setPay(p => ({ ...p, pay_requisites: e.target.value }))} />
          )}
        </div>
      </div>
      <button style={{ ...btn, marginTop: 12 }} onClick={savePayments} disabled={savingPay}>
        {savingPay ? 'Зберігаємо…' : 'Зберегти налаштування оплати'}
      </button>
    </div>
  );
}

/* ── Вибір теми лендингу ─────────────────────────────────────────────── */

function ThemePicker({ token, current, onChanged, flash, slug }: {
  token: string; current: string; onChanged: () => Promise<void>; flash: (m: string) => void; slug: string;
}) {
  const [saving, setSaving] = useState('');

  const pick = async (key: string) => {
    if (key === current || saving) return;
    setSaving(key);
    try {
      const res = await fetch('/api/photographers/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, landing_theme: key }),
      });
      if (res.ok) { await onChanged(); flash('Дизайн застосовано'); }
      else alert((await res.json())?.error || 'Помилка');
    } finally { setSaving(''); }
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
        Оберіть стиль — зміни видно одразу на <a href={`/uk/photographer/${slug}`} target="_blank" style={{ color: '#1e2d7d', fontWeight: 700 }}>вашій сторінці</a>.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {LANDING_THEMES.map(t => {
          const active = t.key === current;
          return (
            <button key={t.key} onClick={() => pick(t.key)} disabled={!!saving}
              style={{
                textAlign: 'left', cursor: active ? 'default' : 'pointer', padding: 0, overflow: 'hidden',
                borderRadius: 12, background: '#fff',
                border: active ? '2px solid #1e2d7d' : '1px solid #e5e7eb',
                boxShadow: active ? '0 0 0 3px rgba(30,45,125,0.12)' : 'none',
                opacity: saving && saving !== t.key ? 0.6 : 1,
              }}>
              {/* Міні-макет: смуга хіро + плитки портфоліо в кольорах теми */}
              <div style={{ background: t.bg, padding: '12px 12px 10px' }}>
                <div style={{ width: 26, height: 26, borderRadius: t.pill ? '50%' : 4, background: t.accent, margin: t.heroAlign === 'center' ? '0 auto 6px' : '0 0 6px' }} />
                <div style={{
                  height: 8, width: '65%', borderRadius: 3, background: t.ink,
                  margin: t.heroAlign === 'center' ? '0 auto 5px' : '0 0 5px',
                  fontFamily: t.headingFont,
                }} />
                <div style={{ height: 5, width: '45%', borderRadius: 3, background: t.faint, margin: t.heroAlign === 'center' ? '0 auto 8px' : '0 0 8px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ aspectRatio: t.grid === 'portrait' ? '4/5' : '1/1', borderRadius: Math.min(t.radius, 6), background: t.tileBg, border: `1px solid ${t.border}` }} />
                  ))}
                </div>
              </div>
              <div style={{ padding: '8px 12px 10px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1e2d7d' }}>
                  {saving === t.key ? 'Застосовуємо…' : t.label} {active && '✓'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{t.tagline}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>{children}</div>;
}
