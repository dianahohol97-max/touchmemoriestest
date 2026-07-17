'use client';

import React, { useState } from 'react';

const input: React.CSSProperties = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '11px 14px', fontSize: 15, boxSizing: 'border-box' };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 4, marginTop: 14, textAlign: 'left' };

/** Standalone cabinet signup — no application, no moderation. The 10% discount
 *  has its own flow at /photographers; this creates only galleries + landing. */
export default function SignupForm({ locale }: { locale: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ cabinet_token: string; slug: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError('Заповніть імʼя, email і пароль (мінімум 8 символів).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/photographers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.error || 'Сталася помилка. Спробуйте ще раз.'); return; }
      setResult(json.photographer);
    } catch {
      setError('Сталася помилка. Спробуйте ще раз.');
    } finally { setLoading(false); }
  };

  if (result) {
    return (
      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14, padding: 24, textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#065f46', marginBottom: 6 }}>Кабінет створено!</div>
        <p style={{ color: '#047857', fontSize: 14, marginTop: 0 }}>Посилання також надіслано на вашу пошту.</p>
        <a href={`/${locale}/photographer/cabinet/${result.cabinet_token}`}
          style={{ display: 'inline-block', background: '#1e2d7d', color: '#fff', borderRadius: 10, padding: '12px 24px', fontWeight: 800, textDecoration: 'none', marginTop: 6 }}>
          Відкрити кабінет →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '24px 22px', maxWidth: 460, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
      <div style={{ fontWeight: 800, fontSize: 18, color: '#1e2d7d' }}>Створити кабінет</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Без заявок і модерації — одразу. Знижка 10% оформлюється окремо.</div>

      <label style={label}>Ім&apos;я або назва студії *</label>
      <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="Олена Коваленко" />
      <label style={label}>Email *</label>
      <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
      <label style={label}>Пароль * <span style={{ fontWeight: 400, color: '#94a3b8' }}>(мін. 8 символів)</span></label>
      <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} />

      {error && <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 10 }}>{error}</div>}

      <button type="submit" disabled={loading}
        style={{ width: '100%', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 800, fontSize: 15, marginTop: 16, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
        {loading ? 'Створюємо…' : 'Створити кабінет безкоштовно'}
      </button>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, textAlign: 'center' }}>
        Хочете ще й знижку 10% на товари? <a href={`/${locale}/photographers`} style={{ color: '#1e2d7d' }}>Подайте заявку фотографа</a>
      </div>
    </form>
  );
}
