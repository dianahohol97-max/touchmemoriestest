'use client';

import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

export default function Kontakty() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !message.trim()) return;
        setStatus('sending');
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message }),
            });
            if (!res.ok) throw new Error('failed');
            setStatus('sent');
            setName(''); setEmail(''); setMessage('');
        } catch {
            setStatus('error');
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '160px', paddingBottom: '80px' }}>
                <div className="container" style={{ maxWidth: '1000px' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, marginBottom: '40px', textAlign: 'center' }}>
                        Наші контакти
                    </h1>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '40px' }}>
                        {/* Info Block */}
                        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '3px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Зв'яжіться з нами</h2>

                            <div style={{ marginBottom: '20px' }}>
                                <h3 className="text-sm font-medium text-[#6b7280]" style={{ marginBottom: '4px' }}>Email</h3>
                                <p style={{ fontSize: '18px', fontWeight: 600 }}>touch.memories3@gmail.com</p>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <h3 className="text-sm font-medium text-[#6b7280]" style={{ marginBottom: '4px' }}>Адреса</h3>
                                <p style={{ fontSize: '18px', fontWeight: 600 }}>Тернопіль, вул. Омеляна Польового, 4а</p>
                            </div>

                            <div className="flex flex-col gap-3 mt-4">
                                <a href="https://t.me/touchmemories" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-[#1e2d7d] hover:text-[#263a99] hover:underline font-medium transition-colors">
                                    Telegram: @touchmemories
                                </a>
                                <a href="https://instagram.com/touch.memories" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-[#1e2d7d] hover:text-[#263a99] hover:underline font-medium transition-colors">
                                    Instagram: @touch.memories
                                </a>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '3px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Напишіть нам</h2>

                            {status === 'sent' ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                                    <p style={{ fontSize: '18px', fontWeight: 700, color: '#1e2d7d', marginBottom: '8px' }}>Повідомлення надіслано!</p>
                                    <p style={{ fontSize: '14px', color: '#6b7280' }}>Ми відповімо вам якнайшвидше.</p>
                                    <button onClick={() => setStatus('idle')} style={{ marginTop: '24px', padding: '10px 24px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                                        Надіслати ще одне
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Ім'я</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} required
                                            placeholder="Ваше ім'я" style={{ width: '100%', padding: '12px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Email</label>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                            placeholder="ваша@пошта.com" style={{ width: '100%', padding: '12px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Повідомлення</label>
                                        <textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} required
                                            placeholder="Як ми можемо допомогти?" style={{ width: '100%', padding: '12px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px', resize: 'vertical', boxSizing: 'border-box' }} />
                                    </div>
                                    {status === 'error' && (
                                        <p style={{ fontSize: '13px', color: '#ef4444' }}>Помилка надсилання. Спробуйте ще раз або напишіть нам напряму.</p>
                                    )}
                                    <button type="submit" disabled={status === 'sending'}
                                        style={{ width: '100%', padding: '16px', backgroundColor: status === 'sending' ? '#9ca3af' : 'var(--primary)', color: 'white', borderRadius: '8px', border: 'none', fontSize: '16px', fontWeight: 600, cursor: status === 'sending' ? 'not-allowed' : 'pointer', marginTop: '8px' }}>
                                        {status === 'sending' ? 'Надсилається...' : 'Надіслати'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
