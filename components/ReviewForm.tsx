'use client';
import { useState } from 'react';

export default function ReviewForm({ productId }: { productId?: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — keep empty
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (author.trim().length < 2) return setErr("Вкажіть ім'я");
    if (rating < 1) return setErr('Поставте оцінку');
    if (text.trim().length < 10) return setErr('Напишіть трохи більше (мінімум 10 символів)');
    setState('sending');
    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, text, rating, product_id: productId, website }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Не вдалося надіслати');
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setErr('Помилка мережі, спробуйте ще раз');
      setState('idle');
    }
  }

  const box: React.CSSProperties = {
    maxWidth: 520,
    margin: '0 auto',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 24,
    background: '#fff',
  };
  const field: React.CSSProperties = {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 15,
    boxSizing: 'border-box',
  };

  if (state === 'done') {
    return (
      <div style={{ ...box, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>★</div>
        <p style={{ color: '#1e2d7d', fontWeight: 700, margin: '0 0 6px' }}>Дякуємо за відгук!</p>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Він зʼявиться на сайті після перевірки модератором.
        </p>
      </div>
    );
  }

  return (
    <div style={box}>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: '0 0 16px' }}>Залишити відгук</h3>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 4, fontSize: 30, lineHeight: 1 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              role="button"
              aria-label={`${n} зірок`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{ cursor: 'pointer', color: (hover || rating) >= n ? '#f0a500' : '#d4d8e4' }}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          style={field}
          placeholder="Ваше ім'я"
          value={author}
          maxLength={80}
          onChange={(e) => setAuthor(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <textarea
          style={{ ...field, resize: 'vertical', minHeight: 90 }}
          placeholder="Поділіться враженнями про товар…"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {/* Honeypot: hidden from users */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />

      {err && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{err}</p>}

      <button
        onClick={submit}
        disabled={state === 'sending'}
        style={{
          background: '#263A99',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '11px 22px',
          fontSize: 15,
          fontWeight: 700,
          cursor: state === 'sending' ? 'default' : 'pointer',
          opacity: state === 'sending' ? 0.6 : 1,
        }}
      >
        {state === 'sending' ? 'Надсилання…' : 'Надіслати відгук'}
      </button>
    </div>
  );
}
