'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

/**
 * Sales manager cabinet: their own leads, the partners they closed, and what
 * those partners have earned them (Diana, 2026-08-05). Access is the private
 * link — the same pattern as the photographer and partner cabinets — and every
 * endpoint re-checks ownership server-side, so the token alone never exposes
 * anyone else's pipeline.
 */

const TYPE_LABELS: Record<string, string> = {
  photographer: 'Фотограф',
  wedding_agency: 'Весільна агенція',
  travel_agency: 'Тревел-агенція',
  corporate: 'Компанія',
  other: 'Інше',
};

const STATUSES = [
  { value: 'new', label: 'Новий', color: '#d97706' },
  { value: 'contacted', label: 'Написали', color: '#3d56d6' },
  { value: 'replied', label: 'Відповів', color: '#7c3aed' },
  { value: 'qualified', label: 'Кваліфікований', color: '#0891b2' },
  { value: 'won', label: 'Угода', color: '#16a34a' },
  { value: 'lost', label: 'Втрачено', color: '#dc2626' },
];
const statusMeta = (s: string) => STATUSES.find(o => o.value === s) || STATUSES[0];

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E8DCC8', borderRadius: 16, padding: 22, marginBottom: 18 };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#55504a', marginBottom: 4, marginTop: 12 };
const input: React.CSSProperties = { width: '100%', border: '1px solid #ddd2bd', borderRadius: 10, padding: '10px 13px', fontSize: 14, boxSizing: 'border-box', background: '#fff' };
const btn: React.CSSProperties = { background: '#263A99', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-heading), sans-serif' };
const btnGhost: React.CSSProperties = { ...btn, background: '#fff', color: '#263A99', border: '1px solid #c9d0ee' };
const sectionTitle: React.CSSProperties = { fontFamily: 'var(--font-heading), sans-serif', fontSize: 19, fontWeight: 800, color: '#1A1A1A', margin: 0 };

interface Lead {
  id: string; business_type: string; business_name: string; contact_name: string | null;
  email: string | null; phone: string | null; website: string | null; instagram: string | null;
  city: string | null; status: string; offer_sent_at: string | null; notes: string | null; created_at: string;
}
interface Commission {
  id: string; kind: string; base_amount: number; rate: number; amount: number;
  status: string; note: string | null; created_at: string; paid_at: string | null;
}

const money = (n: number) => `${Number(n || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;

export default function SalesCabinetClient({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'leads' | 'money'>('leads');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [adding, setAdding] = useState(false);

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 2500); };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/me?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) { setError(json?.error || 'Кабінет не знайдено'); return; }
      setData(json);
      setSelected(prev => prev ? (json.leads as Lead[]).find(l => l.id === prev.id) || null : null);
    } catch { setError('Не вдалося завантажити кабінет'); }
  }, [token]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const shell = (children: React.ReactNode) => (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, paddingTop: 110 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 16px 80px', fontFamily: 'var(--font-body), sans-serif', color: '#1A1A1A' }}>
          {children}
        </div>
      </main>
      <Footer categories={[]} />
    </div>
  );

  if (loading) return shell(<div style={{ color: '#8B8378', padding: '40px 0' }}>Завантаження…</div>);
  if (error || !data) return shell(<div style={{ color: '#991b1b', padding: '40px 0' }}>{error || 'Кабінет не знайдено'}</div>);

  const { manager, leads, partners, photographers, commissions, money: sums } = data as {
    manager: any; leads: Lead[]; partners: any[]; photographers: any[]; commissions: Commission[]; money: any;
  };

  const counts = STATUSES.map(s => ({ ...s, n: leads.filter(l => l.status === s.value).length }));

  return shell(
    <>
      {notice && (
        <div style={{ position: 'fixed', top: 16, right: 16, background: '#065f46', color: '#fff', borderRadius: 10, padding: '10px 16px', zIndex: 100, fontSize: 14 }}>{notice}</div>
      )}

      <h1 style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 27, fontWeight: 900, margin: '0 0 4px' }}>
        Кабінет менеджера
      </h1>
      <p style={{ color: '#8B8378', fontSize: 14, margin: '0 0 18px' }}>
        {manager.name} · {manager.rate_order}% від замовлень ваших партнерів і {manager.rate_gallery}% від оплачених галерей
      </p>

      {/* Money summary — the reason the job exists, so it sits on top */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { t: 'Зароблено всього', v: money(sums.total), c: '#263A99' },
          { t: 'Очікує виплати', v: money(sums.pending), c: '#d97706' },
          { t: 'Вже виплачено', v: money(sums.paid), c: '#16a34a' },
          { t: 'Партнерів залучено', v: String(partners.length + photographers.length), c: '#0891b2' },
        ].map(s => (
          <div key={s.t} style={{ background: '#fff', border: '1px solid #E8DCC8', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 12.5, color: '#8B8378' }}>{s.t}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, fontFamily: 'var(--font-heading), sans-serif' }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['leads', `Ліди (${leads.length})`], ['money', `Нарахування (${commissions.length})`]] as const).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ ...(tab === k ? btn : btnGhost), padding: '9px 16px' }}>{t}</button>
        ))}
      </div>

      {tab === 'leads' && (
        <>
          <div style={{ ...card, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
              {counts.map(c => (
                <div key={c.value} style={{ fontSize: 13, color: '#55504a' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: c.color, marginRight: 6 }} />
                  {c.label}: <b>{c.n}</b>
                </div>
              ))}
            </div>
            <button style={btn} onClick={() => setAdding(true)}>+ Новий лід</button>
          </div>

          {adding && <AddLead token={token} onDone={async () => { setAdding(false); await load(); flash('Ліда додано'); }} onCancel={() => setAdding(false)} />}

          {leads.length === 0 && !adding ? (
            <div style={{ ...card, color: '#8B8378' }}>
              Тут зʼявляться ваші контакти. Додайте перший — фотографа, весільну або тревел-агенцію, — і надішліть їм пропозицію просто звідси.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0, 1fr) minmax(0, 1.1fr)' : '1fr', gap: 16, alignItems: 'start' }}>
              <div style={card}>
                <h2 style={sectionTitle}>Мої ліди</h2>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leads.map(l => {
                    const sm = statusMeta(l.status);
                    const active = selected?.id === l.id;
                    return (
                      <button key={l.id} onClick={() => setSelected(active ? null : l)}
                        style={{
                          textAlign: 'left', background: active ? '#eef3ff' : '#fff', cursor: 'pointer',
                          border: `1px solid ${active ? '#263A99' : '#eee6d8'}`, borderRadius: 12, padding: '11px 13px',
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 800, fontSize: 14.5 }}>{l.business_name}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: sm.color }}>{sm.label}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#8B8378', marginTop: 3 }}>
                          {TYPE_LABELS[l.business_type] || 'Інше'}
                          {l.city && ` · ${l.city}`}
                          {l.email && ` · ${l.email}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selected && <LeadPanel token={token} lead={selected} onDone={load} flash={flash} />}
            </div>
          )}

          {(partners.length > 0 || photographers.length > 0) && (
            <div style={card}>
              <h2 style={sectionTitle}>Мої партнери</h2>
              <p style={{ color: '#8B8378', fontSize: 13, marginTop: 6 }}>
                Це закриті угоди. Кожне замовлення за їхнім кодом і кожна оплачена галерея приносять вам відсоток автоматично.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {partners.map(p => (
                  <div key={p.id} style={{ border: '1px solid #eee6d8', borderRadius: 12, padding: '10px 13px', fontSize: 13.5 }}>
                    <b>{p.agency_name}</b> · код <code>{p.referral_code}</code> · {p.status === 'active' ? 'активний' : p.status}
                  </div>
                ))}
                {photographers.map(p => (
                  <div key={p.id} style={{ border: '1px solid #eee6d8', borderRadius: 12, padding: '10px 13px', fontSize: 13.5 }}>
                    <b>{p.name}</b> · фотограф · тариф {p.plan || 'free'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'money' && (
        <div style={card}>
          <h2 style={sectionTitle}>Нарахування</h2>
          <p style={{ color: '#8B8378', fontSize: 13, marginTop: 6 }}>
            Кожен рядок зʼявляється автоматично після підтвердженої оплати. Виплати позначає адміністратор.
          </p>
          {commissions.length === 0 ? (
            <div style={{ color: '#8B8378', marginTop: 12, fontSize: 14 }}>
              Поки що порожньо. Перший рядок зʼявиться, щойно ваш партнер отримає замовлення або оплатить галерею.
            </div>
          ) : (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {commissions.map(c => (
                <div key={c.id} style={{ border: '1px solid #eee6d8', borderRadius: 12, padding: '11px 13px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {c.kind === 'gallery' ? 'Оплата галереї' : 'Замовлення партнера'}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#8B8378', marginTop: 2 }}>
                      {c.note} · база {money(c.base_amount)} · {c.rate}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: '#263A99' }}>{money(c.amount)}</div>
                    <div style={{ fontSize: 12, color: c.status === 'paid' ? '#16a34a' : '#d97706' }}>
                      {c.status === 'paid' ? 'виплачено' : 'очікує виплати'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AddLead({ token, onDone, onCancel }: { token: string; onDone: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({
    business_name: '', business_type: 'photographer', contact_name: '',
    email: '', phone: '', instagram: '', city: '', website: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.business_name.trim()) { setErr('Вкажіть назву бізнесу'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/sales/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json?.error || 'Не вдалося додати'); return; }
      await onDone();
    } finally { setSaving(false); }
  };

  return (
    <div style={card}>
      <h2 style={sectionTitle}>Новий лід</h2>
      <label style={label}>Назва бізнесу *</label>
      <input style={input} value={form.business_name} onChange={set('business_name')} placeholder="Студія «Світло»" autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={label}>Тип</label>
          <select style={input} value={form.business_type} onChange={set('business_type')}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Контактна особа</label>
          <input style={input} value={form.contact_name} onChange={set('contact_name')} placeholder="Олена" />
        </div>
        <div>
          <label style={label}>Email</label>
          <input style={input} value={form.email} onChange={set('email')} placeholder="studio@example.com" />
        </div>
        <div>
          <label style={label}>Телефон</label>
          <input style={input} value={form.phone} onChange={set('phone')} placeholder="+380…" />
        </div>
        <div>
          <label style={label}>Instagram</label>
          <input style={input} value={form.instagram} onChange={set('instagram')} placeholder="studio.svitlo" />
        </div>
        <div>
          <label style={label}>Місто</label>
          <input style={input} value={form.city} onChange={set('city')} placeholder="Львів" />
        </div>
      </div>
      <label style={label}>Нотатки</label>
      <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={set('notes')}
        placeholder="Звідки контакт, про що домовились, коли передзвонити." />
      {err && <div style={{ color: '#b91c1c', fontSize: 13.5, marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button style={btn} onClick={save} disabled={saving}>{saving ? 'Зберігаємо…' : 'Додати ліда'}</button>
        <button style={btnGhost} onClick={onCancel}>Скасувати</button>
      </div>
    </div>
  );
}

function LeadPanel({ token, lead, onDone, flash }: {
  token: string; lead: Lead; onDone: () => Promise<void>; flash: (m: string) => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [notes, setNotes] = useState(lead.notes || '');
  const [custom, setCustom] = useState({ open: false, subject: '', body: '' });
  const [busy, setBusy] = useState(false);

  const loadThread = useCallback(async () => {
    const res = await fetch(`/api/sales/leads/send?token=${encodeURIComponent(token)}&lead_id=${lead.id}`);
    if (res.ok) setMessages((await res.json()).messages || []);
  }, [token, lead.id]);

  useEffect(() => { setNotes(lead.notes || ''); loadThread(); }, [lead.id, lead.notes, loadThread]);

  const patch = async (body: any, msg: string) => {
    const res = await fetch('/api/sales/leads', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, lead_id: lead.id, ...body }),
    });
    if (res.ok) { await onDone(); flash(msg); }
    else alert((await res.json())?.error || 'Помилка');
  };

  const send = async (payload: any) => {
    setBusy(true);
    try {
      const res = await fetch('/api/sales/leads/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, lead_id: lead.id, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json?.error || 'Не вдалося надіслати'); return; }
      await loadThread(); await onDone();
      setCustom({ open: false, subject: '', body: '' });
      flash('Лист надіслано');
    } finally { setBusy(false); }
  };

  return (
    <div style={card}>
      <h2 style={sectionTitle}>{lead.business_name}</h2>
      <div style={{ fontSize: 13, color: '#8B8378', marginTop: 4 }}>
        {TYPE_LABELS[lead.business_type] || 'Інше'}
        {lead.contact_name && ` · ${lead.contact_name}`}
        {lead.city && ` · ${lead.city}`}
      </div>
      <div style={{ fontSize: 13, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {lead.email && <span>{lead.email}</span>}
        {lead.phone && <span>{lead.phone}</span>}
        {lead.instagram && <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" style={{ color: '#263A99' }}>@{lead.instagram}</a>}
        {lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" style={{ color: '#263A99' }}>{lead.website}</a>}
      </div>

      <label style={label}>Статус</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s.value} onClick={() => patch({ status: s.value }, 'Статус змінено')}
            style={{
              padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${lead.status === s.value ? s.color : '#e2e8f0'}`,
              background: lead.status === s.value ? s.color : '#fff',
              color: lead.status === s.value ? '#fff' : '#64748b',
            }}>{s.label}</button>
        ))}
      </div>

      <label style={label}>Нотатки</label>
      <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)}
        onBlur={() => notes !== (lead.notes || '') && patch({ notes }, 'Нотатки збережено')} />

      <label style={label}>Листування</label>
      {!lead.email ? (
        <div style={{ fontSize: 13, color: '#8B8378' }}>Щоб надіслати пропозицію, додайте email контакту.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btn} disabled={busy} onClick={() => send({ mode: 'offer' })}>
              {busy ? 'Надсилаємо…' : lead.offer_sent_at ? 'Надіслати пропозицію ще раз' : 'Надіслати пропозицію'}
            </button>
            <button style={btnGhost} onClick={() => setCustom(c => ({ ...c, open: !c.open }))}>Свій лист</button>
          </div>
          {custom.open && (
            <div style={{ marginTop: 10 }}>
              <input style={input} placeholder="Тема листа" value={custom.subject} onChange={e => setCustom(c => ({ ...c, subject: e.target.value }))} />
              <textarea style={{ ...input, minHeight: 110, marginTop: 8, resize: 'vertical' }} placeholder="Текст листа"
                value={custom.body} onChange={e => setCustom(c => ({ ...c, body: e.target.value }))} />
              <button style={{ ...btn, marginTop: 8 }} disabled={busy}
                onClick={() => send({ mode: 'custom', subject: custom.subject, body: custom.body })}>
                Надіслати
              </button>
            </div>
          )}
        </>
      )}

      {messages.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(m => (
            <div key={m.id} style={{
              border: '1px solid #eee6d8', borderRadius: 12, padding: '10px 12px',
              background: m.direction === 'out' ? '#f8fafc' : '#fffbe9',
            }}>
              <div style={{ fontSize: 11.5, color: '#8B8378', marginBottom: 4 }}>
                {m.direction === 'out' ? 'Ми →' : '← Відповідь'} · {new Date(m.created_at).toLocaleString('uk-UA')}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.subject}</div>
              <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', marginTop: 4 }}>{m.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
