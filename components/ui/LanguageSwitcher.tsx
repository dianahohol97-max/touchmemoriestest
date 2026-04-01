'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation, LOCALES, Locale } from '@/lib/i18n/context';

export function LanguageSwitcher() {
    const { locale, setLocale } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const current = LOCALES.find(l => l.code === locale) || LOCALES[0];

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative', zIndex: 100 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 7,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'inherit', cursor: 'pointer', fontSize: 13,
                    fontWeight: 600, transition: 'all 0.15s',
                    backdropFilter: 'blur(4px)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                title="Change language"
            >
                <span style={{ fontSize: 16 }}>{current.flag}</span>
                <span>{current.label}</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" style={{ opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M0 0l5 6 5-6z"/>
                </svg>
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: '#fff', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    border: '1px solid #e5e7eb',
                    minWidth: 130, overflow: 'hidden',
                }}>
                    {LOCALES.map(l => (
                        <button
                            key={l.code}
                            onClick={() => { setLocale(l.code as Locale); setOpen(false); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', padding: '9px 14px',
                                background: l.code === locale ? '#f0f3ff' : '#fff',
                                border: 'none', cursor: 'pointer', fontSize: 13,
                                fontWeight: l.code === locale ? 700 : 500,
                                color: l.code === locale ? '#1e2d7d' : '#374151',
                                textAlign: 'left', transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { if (l.code !== locale) e.currentTarget.style.background = '#f9fafb'; }}
                            onMouseLeave={e => { if (l.code !== locale) e.currentTarget.style.background = '#fff'; }}
                        >
                            <span style={{ fontSize: 18 }}>{l.flag}</span>
                            <span>{l.label}</span>
                            {l.code === locale && <span style={{ marginLeft: 'auto', color: '#1e2d7d' }}>✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
