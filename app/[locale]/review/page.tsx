'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Star } from 'lucide-react';

function ReviewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'sent'>('loading');
  const [orderInfo, setOrderInfo] = useState<{ orderNumber: string; productName: string; orderId: string } | null>(null);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    fetch(`/api/reviews/verify?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setOrderInfo(d); setStatus('valid'); }
        else setStatus('invalid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async () => {
    if (!rating || !text.trim() || !orderInfo) return;
    setSending(true);
    const res = await fetch('/api/reviews/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, rating, text, name, orderId: orderInfo.orderId }),
    });
    setSending(false);
    if (res.ok) setStatus('sent');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 20px 60px' }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '40px 36px', maxWidth: 500, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {status === 'loading' && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Перевіряємо посилання…</p>}

          {status === 'invalid' && (
            <div style={{ textAlign: 'center' }}>
                            <h2 style={{ color: '#1e2d7d', fontWeight: 700, marginBottom: 8 }}>Посилання недійсне або прострочене</h2>
              <p style={{ color: '#64748b', fontSize: 14 }}>Посилання для відгуку дійсне 30 днів. Якщо у вас є питання — напишіть нам.</p>
            </div>
          )}

          {status === 'sent' && (
            <div style={{ textAlign: 'center' }}>
                            <h2 style={{ color: '#1e2d7d', fontWeight: 700, marginBottom: 8 }}>Дякуємо за відгук!</h2>
              <p style={{ color: '#64748b', fontSize: 14 }}>Після перевірки він з'явиться на сторінці товару.</p>
            </div>
          )}

          {status === 'valid' && orderInfo && (
            <>
              <h2 style={{ color: '#1e2d7d', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Залишити відгук</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Замовлення {orderInfo.orderNumber} · {orderInfo.productName}</p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 10 }}>Оцінка *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={32} onClick={() => setRating(s)}
                      onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
                      style={{ cursor: 'pointer', color: s <= (hovered || rating) ? '#f0a500' : '#d1d5db',
                        fill: s <= (hovered || rating) ? '#f0a500' : 'none', transition: 'color 0.1s' }} />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 6 }}>Ваше ім'я</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ім'я (необов'язково)"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 6 }}>Враження *</label>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
                  placeholder="Поділіться враженнями про товар..."
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <button onClick={handleSubmit} disabled={!rating || !text.trim() || sending}
                style={{ width: '100%', padding: '14px', background: (!rating || !text.trim()) ? '#e2e8f0' : '#263A99',
                  color: (!rating || !text.trim()) ? '#94a3b8' : '#fff',
                  border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: (!rating || !text.trim()) ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Надсилається…' : 'Надіслати відгук'}
              </button>
            </>
          )}
        </div>
      </main>
      <Footer categories={[]} />
    </div>
  );
}

export default function ReviewPage() {
  return <Suspense fallback={null}><ReviewContent /></Suspense>;
}
