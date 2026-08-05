'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Photographer {
  id: string; slug: string; cabinet_token: string; name: string; email: string;
  phone: string | null; instagram: string | null; is_active: boolean;
  landing_enabled: boolean; custom_domain: string | null; custom_domain_paid: boolean;
  gallery_count: number; storage_bytes: number; created_at: string;
}

interface Gallery {
  id: string; title: string | null; client_name: string | null; client_token: string;
  shoot_date: string | null; expires_at: string | null; files_purged_at: string | null;
  created_at: string; zip_downloads: number; photo_count: number; size_bytes: number;
}

/** 0 → «порожньо», інакше МБ до 1 ГБ, далі ГБ з одним знаком. */
const fmtSize = (bytes: number) => {
  if (!bytes) return 'порожньо';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} МБ`;
  return `${(mb / 1024).toFixed(1)} ГБ`;
};

const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
const btn = 'bg-indigo-900 text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50';
const btnGhost = 'bg-slate-100 text-indigo-900 rounded-lg px-3 py-2 text-sm font-semibold';

export default function AdminPhotographersPage() {
  const [items, setItems] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', slug: '', phone: '', instagram: '' });
  const [busyId, setBusyId] = useState('');
  // id фотографа, чий список галерей зараз розгорнуто (одна за раз).
  const [openGalleries, setOpenGalleries] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/photographers');
    const json = await res.json();
    if (res.ok) setItems(json.photographers || []);
    else toast.error(json?.error || 'Не вдалося завантажити');
  };
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const create = async () => {
    if (!form.name || !form.email || !form.slug) { toast.error("Ім'я, email і slug обов'язкові"); return; }
    const res = await fetch('/api/admin/photographers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json?.error || 'Помилка'); return; }
    toast.success('Фотографа створено');
    setForm({ name: '', email: '', slug: '', phone: '', instagram: '' });
    setShowNew(false);
    await load();
  };

  const patch = async (id: string, body: Record<string, unknown>, okMsg: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/photographers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json?.error || 'Помилка'); return; }
      toast.success(okMsg);
      await load();
    } finally { setBusyId(''); }
  };

  const sendWelcome = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/photographers/${id}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { toast.error(json?.error || 'Не вдалося надіслати'); return; }
      toast.success('Лист із кабінетом надіслано');
    } finally { setBusyId(''); }
  };

  const copy = (text: string, msg: string) => { navigator.clipboard.writeText(text); toast.success(msg); };

  if (loading) return <div className="p-8 text-slate-500">Завантаження…</div>;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-2xl font-extrabold text-indigo-900">Фотографи</h1>
        <button className={btn} onClick={() => setShowNew(v => !v)}>{showNew ? 'Скасувати' : '+ Додати фотографа'}</button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Галереї клієнтів (зберігання 30 днів), сторінка-візитка з портфоліо і прайсом.</p>

      {showNew && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 grid gap-3 md:grid-cols-2">
          <input className={input} placeholder="Ім'я / студія *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className={input} placeholder="Email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <input className={input} placeholder="Slug (URL, лат.) *" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
          <input className={input} placeholder="Телефон" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <input className={input} placeholder="Instagram" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} />
          <button className={btn} onClick={create}>Створити</button>
        </div>
      )}

      {items.length === 0 && <div className="text-slate-400">Поки що немає фотографів.</div>}

      <div className="grid gap-3">
        {items.map(p => (
          <div key={p.id} className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <span className="font-extrabold">{p.name}</span>
                <span className="text-slate-500 text-sm"> · {p.email}</span>
                {!p.is_active && <span className="ml-2 text-xs font-bold text-red-700 bg-red-50 rounded-full px-2 py-0.5">вимкнено</span>}
              </div>
              <span className="text-sm text-slate-500">{p.gallery_count} галерей · {fmtSize(p.storage_bytes)}</span>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              /photographer/{p.slug}
              {p.custom_domain && <> · домен: <b>{p.custom_domain}</b> {p.custom_domain_paid ? '(оплачено)' : '(не оплачено)'}</>}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button className={btnGhost} disabled={busyId === p.id} onClick={() => sendWelcome(p.id)}>Надіслати лист</button>
              <button className={btnGhost} onClick={() => copy(`${window.location.origin}/uk/photographer/cabinet/${p.cabinet_token}`, 'Посилання на кабінет скопійовано')}>Кабінет</button>
              <a className={btnGhost} href={`/uk/photographer/${p.slug}`} target="_blank">Візитка ↗</a>
              <button className={btnGhost} disabled={busyId === p.id}
                onClick={() => patch(p.id, { is_active: !p.is_active }, p.is_active ? 'Вимкнено' : 'Увімкнено')}>
                {p.is_active ? 'Вимкнути' : 'Увімкнути'}
              </button>
              <button className={btnGhost} disabled={busyId === p.id}
                onClick={() => {
                  const domain = prompt('Домен (порожньо — прибрати):', p.custom_domain || '');
                  if (domain === null) return;
                  patch(p.id, { custom_domain: domain.trim() || null, custom_domain_paid: !!domain.trim() }, 'Домен оновлено');
                }}>
                Домен…
              </button>
              {p.gallery_count > 0 && (
                <button className={btnGhost} onClick={() => setOpenGalleries(v => v === p.id ? '' : p.id)}>
                  {openGalleries === p.id ? 'Сховати галереї' : 'Галереї…'}
                </button>
              )}
            </div>
            {openGalleries === p.id && <GalleryList photographerId={p.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Галереї фотографа з розмірами (Diana, 2026-08-06): скільки фото, скільки
 * місця, коли створена й коли згорить, і перегляд очима клієнта — за тим самим
 * client_token, який фотограф надсилає клієнту.
 */
function GalleryList({ photographerId }: { photographerId: string }) {
  const [galleries, setGalleries] = useState<Gallery[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/photographers/${photographerId}`)
      .then(async res => {
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) setGalleries(json.galleries || []);
        else setError(json?.error || 'Не вдалося завантажити галереї');
      })
      .catch(() => { if (!cancelled) setError('Не вдалося завантажити галереї'); });
    return () => { cancelled = true; };
  }, [photographerId]);

  if (error) return <div className="mt-3 text-sm text-red-600">{error}</div>;
  if (!galleries) return <div className="mt-3 text-sm text-slate-400">Завантаження галерей…</div>;
  if (galleries.length === 0) return <div className="mt-3 text-sm text-slate-400">Галерей ще немає.</div>;

  return (
    <div className="mt-3 grid gap-2">
      {galleries.map(g => (
        <div key={g.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm font-semibold">
              {g.title || 'Без назви'}
              {g.client_name && <span className="text-slate-500 font-normal"> · {g.client_name}</span>}
              {g.files_purged_at && <span className="ml-2 text-xs font-bold text-red-700 bg-red-50 rounded-full px-2 py-0.5">файли видалено</span>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {g.photo_count} фото · {fmtSize(g.size_bytes)}
              {' · створена '}{new Date(g.created_at).toLocaleDateString('uk-UA')}
              {g.expires_at && ` · діє до ${new Date(g.expires_at).toLocaleDateString('uk-UA')}`}
              {g.zip_downloads > 0 && ` · завантажень архіву: ${g.zip_downloads}`}
            </div>
          </div>
          <a className={btnGhost} href={`/uk/gallery/${g.client_token}`} target="_blank" rel="noreferrer">
            Переглянути ↗
          </a>
        </div>
      ))}
    </div>
  );
}
