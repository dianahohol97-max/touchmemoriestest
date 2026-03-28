'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function NewsletterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/') return;
    const hasSeen = localStorage.getItem('popup_shown');
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        localStorage.setItem('popup_shown', 'true');
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const handleClose = () => setIsOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/subscribers/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'popup' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(handleClose, 3000);
      } else {
        setError(data.message || data.error || 'Сталася помилка');
      }
    } catch {
      setError('Не вдалося підписатися');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(10, 18, 64, 0.55)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 999,
            }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000, width: '90%', maxWidth: '440px',
            pointerEvents: 'none',
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                width: '100%',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 32px 80px rgba(10, 18, 64, 0.28)',
                pointerEvents: 'auto',
              }}
            >
              {/* Navy header */}
              <div style={{
                background: 'linear-gradient(135deg, #1e2d7d 0%, #263A99 100%)',
                padding: '40px 36px 32px',
                textAlign: 'center',
                position: 'relative',
              }}>
                {/* Decorative glow */}
                <div style={{
                  position: 'absolute', top: '-20px', right: '-20px',
                  width: '120px', height: '120px', borderRadius: '50%',
                  background: 'rgba(61,86,196,0.4)', filter: 'blur(40px)',
                  pointerEvents: 'none',
                }} />

                {/* Close button */}
                <button
                  onClick={handleClose}
                  style={{
                    position: 'absolute', top: '14px', right: '14px',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px', padding: '6px',
                    cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                >
                  <X size={18} />
                </button>

                {/* Mail icon */}
                <div style={{
                  width: '56px', height: '56px',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: '28px', color: '#ffffff',
                    fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 28",
                  }}>mail</span>
                </div>

                <h3 style={{
                  color: '#ffffff',
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  marginBottom: '10px',
                  fontFamily: 'var(--font-montserrat, inherit)',
                }}>
                  Знижка -7%
                </h3>
                <p style={{
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '0.95rem',
                  lineHeight: 1.55,
                  maxWidth: '280px',
                  margin: '0 auto',
                }}>
                  Підпишіться на наші новини та отримайте промокод на перше замовлення
                </p>
              </div>

              {/* White body */}
              <div style={{ background: '#ffffff', padding: '28px 36px 32px' }}>
                {success ? (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{
                      width: '56px', height: '56px',
                      background: '#f0fdf4', borderRadius: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}>
                      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e2d7d', marginBottom: '6px' }}>
                      Дякуємо!
                    </h4>
                    <p style={{ color: '#585C7D', fontSize: '0.9rem' }}>
                      Промокод надіслано на вашу пошту
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      type="email"
                      required
                      placeholder="Ваш email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '13px 16px',
                        border: '1.5px solid #e0e2ea',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        color: '#181C21',
                        transition: 'border-color 0.2s',
                        fontFamily: 'inherit',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#263A99'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e0e2ea'}
                    />
                    {error && (
                      <p style={{ color: '#ef4444', fontSize: '0.83rem', margin: 0 }}>{error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={loading || !email}
                      style={{
                        width: '100%',
                        background: loading || !email ? '#a0aec0' : '#1e2d7d',
                        color: '#ffffff',
                        fontWeight: 700,
                        padding: '13px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: loading || !email ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem',
                        fontFamily: 'var(--font-montserrat, inherit)',
                        transition: 'background 0.2s, transform 0.15s',
                        boxShadow: '0 4px 16px rgba(38,58,153,0.25)',
                      }}
                      onMouseEnter={e => { if (!loading && email) e.currentTarget.style.background = '#263A99'; }}
                      onMouseLeave={e => { if (!loading && email) e.currentTarget.style.background = '#1e2d7d'; }}
                    >
                      {loading ? 'Відправка...' : 'Отримати промокод'}
                    </button>
                    <p style={{
                      fontSize: '0.78rem',
                      textAlign: 'center',
                      color: '#94a3b8',
                      margin: 0,
                    }}>
                      Ми не надсилаємо спам. Відписатися можна будь-коли.
                    </p>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
