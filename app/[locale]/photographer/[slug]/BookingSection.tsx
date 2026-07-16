'use client';

import React, { useMemo, useState } from 'react';
import type { LandingTheme } from '@/lib/photographers/themes';

export interface PublicSlot {
  id: string;
  slot_date: string;
  slot_time: string;
  duration_min: number;
  price: string | null;
}

interface BookingResult {
  slot: { date: string; time: string; duration_min: number; price: string | null };
  photographer_name: string;
  payment: { mono_link: string | null; wfp_link: string | null; requisites: string | null };
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });

/** Theme-aware booking widget on the photographer landing: pick a slot →
 *  leave contacts → see the photographer's payment options right away. */
export default function BookingSection({ slots, theme: t, kicker }: {
  slots: PublicSlot[];
  theme: LandingTheme;
  kicker: React.CSSProperties;
}) {
  const [taken, setTaken] = useState<string[]>([]);
  const [selected, setSelected] = useState<PublicSlot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<BookingResult | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, PublicSlot[]>();
    for (const s of slots) {
      if (taken.includes(s.id)) continue;
      if (!map.has(s.slot_date)) map.set(s.slot_date, []);
      map.get(s.slot_date)!.push(s);
    }
    return Array.from(map.entries());
  }, [slots, taken]);

  const btnRadius = t.pill ? 999 : Math.max(t.radius, 2);
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 14px', fontSize: 14,
    borderRadius: Math.max(t.radius, 4), border: `1px solid ${t.border}`,
    background: t.card, color: t.ink, outline: 'none',
  };

  const submit = async () => {
    if (!selected || loading) return;
    if (!name.trim() || phone.replace(/\D/g, '').length < 9) {
      setError("Вкажіть ім'я та коректний телефон");
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/photographers/booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: selected.id, name, phone, comment }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Сталася помилка');
        if (res.status === 409) { setTaken(prev => [...prev, selected.id]); setSelected(null); }
        return;
      }
      setDone(json);
    } catch { setError('Сталася помилка. Спробуйте ще раз.'); }
    finally { setLoading(false); }
  };

  if (byDate.length === 0 && !done) return null;

  const hasPayment = done && (done.payment.mono_link || done.payment.wfp_link || done.payment.requisites);

  return (
    <section style={{ maxWidth: 660, margin: '0 auto', padding: '48px 20px 8px' }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={kicker}>Запис</div>
        <h2 style={{ fontFamily: t.headingFont, fontWeight: t.headingWeight, textTransform: t.headingTransform, letterSpacing: t.headingSpacing, color: t.ink, fontSize: 28, margin: '4px 0 0' }}>
          Вільні дати
        </h2>
      </div>

      {done ? (
        /* ── Success + payment ─────────────────────────────── */
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: Math.max(t.radius, 6), padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>✅</div>
          <div style={{ fontFamily: t.headingFont, fontWeight: 800, fontSize: 20, marginTop: 8 }}>
            Вас записано!
          </div>
          <p style={{ color: t.muted, fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>
            {fmtDate(done.slot.date)}, {done.slot.time} · {done.slot.duration_min} хв
            {done.slot.price ? ` · ${done.slot.price}` : ''}<br />
            {done.photographer_name} звʼяжеться з вами для підтвердження.
          </p>

          {hasPayment && (
            <div style={{ marginTop: 18, textAlign: 'left', background: t.bg, borderRadius: Math.max(t.radius, 6), padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, textAlign: 'center' }}>Оплата</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {done.payment.mono_link && (
                  <a href={done.payment.mono_link} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textAlign: 'center', background: '#000', color: '#fff', borderRadius: btnRadius, padding: '11px 16px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    Оплатити через Monobank
                  </a>
                )}
                {done.payment.wfp_link && (
                  <a href={done.payment.wfp_link} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textAlign: 'center', background: '#1e2d7d', color: '#fff', borderRadius: btnRadius, padding: '11px 16px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    Оплатити карткою (WayForPay)
                  </a>
                )}
                {done.payment.requisites && (
                  <div style={{ border: `1px dashed ${t.border}`, borderRadius: Math.max(t.radius, 6), padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Реквізити для оплати</div>
                    <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: t.ink }}>{done.payment.requisites}</div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: t.faint, marginTop: 10, textAlign: 'center' }}>
                Оплата надходить безпосередньо фотографу.
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Slot picker ───────────────────────────────────── */}
          <div style={{ display: 'grid', gap: 16 }}>
            {byDate.map(([date, daySlots]) => (
              <div key={date}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.muted, marginBottom: 8, textTransform: 'capitalize' }}>
                  {fmtDate(date)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {daySlots.map(s => {
                    const active = selected?.id === s.id;
                    return (
                      <button key={s.id} onClick={() => { setSelected(active ? null : s); setError(''); }}
                        style={{
                          borderRadius: btnRadius, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                          border: active ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
                          background: active ? t.accent : t.card,
                          color: active ? t.accentInk : t.ink,
                        }}>
                        {s.slot_time}{s.price ? <span style={{ fontWeight: 500, opacity: 0.75 }}> · {s.price}</span> : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── Booking form ──────────────────────────────────── */}
          {selected && (
            <div style={{ marginTop: 22, background: t.card, border: `1px solid ${t.border}`, borderRadius: Math.max(t.radius, 6), padding: 22 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>
                {fmtDate(selected.slot_date)}, {selected.slot_time} · {selected.duration_min} хв
                {selected.price ? ` · ${selected.price}` : ''}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <input style={inputStyle} placeholder="Ваше ім'я *" value={name} onChange={e => setName(e.target.value)} />
                <input style={inputStyle} placeholder="Телефон *" value={phone} onChange={e => setPhone(e.target.value)} />
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} placeholder="Коментар (тип зйомки, локація — необовʼязково)" value={comment} onChange={e => setComment(e.target.value)} />
              </div>
              {error && <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 10 }}>{error}</div>}
              <button onClick={submit} disabled={loading}
                style={{ marginTop: 14, width: '100%', background: t.accent, color: t.accentInk, border: 'none', borderRadius: btnRadius, padding: '13px 0', fontSize: 15, fontWeight: 800, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Бронюємо…' : 'Забронювати'}
              </button>
            </div>
          )}
          {error && !selected && <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</div>}
        </>
      )}
    </section>
  );
}
