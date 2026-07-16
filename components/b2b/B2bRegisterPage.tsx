'use client';

import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { Loader2, Check } from 'lucide-react';

interface B2bRegisterPageProps {
    role: 'photographer' | 'wedding_agency';
    title: string;            // e.g. "Для фотографів"
    subtitle: string;         // short pitch
    benefits: string[];       // bullet list of perks
    portfolioLabel: string;   // "Посилання на портфоліо" / "Сайт або сторінка агенції"
    portfolioPlaceholder: string;
    discountPercent: number;
    /** Optional escape hatch under the form for people who don't need the
     *  discount application (e.g. photographers who want only the free
     *  gallery cabinet + landing). */
    altLink?: { text: string; href: string };
    /** Optional "already have a cabinet? sign in" link for returning partners
     *  who lost their emailed cabinet URL (e.g. photographers). */
    cabinetLink?: { text: string; href: string };
}

export default function B2bRegisterPage({
    role, title, subtitle, benefits, portfolioLabel, portfolioPlaceholder, discountPercent, altLink, cabinetLink,
}: B2bRegisterPageProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [portfolioUrl, setPortfolioUrl] = useState('');
    const [agree, setAgree] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !email.trim() || password.length < 8 || !portfolioUrl.trim()) {
            setError('Заповніть усі обовʼязкові поля. Пароль — мінімум 8 символів.');
            return;
        }
        if (!agree) { setError('Підтвердьте згоду з умовами.'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/b2b/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, name, email, phone, password, portfolioUrl }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Сталася помилка. Спробуйте ще раз.'); setLoading(false); return; }
            setDone(true);
        } catch {
            setError('Сталася помилка. Спробуйте ще раз.');
        }
        setLoading(false);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: 120, paddingBottom: 80 }}>
                <div className="container" style={{ maxWidth: 1040 }}>
                    {done ? (
                        <div style={{ maxWidth: 520, margin: '40px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '48px 36px', textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <Check size={32} color="#16a34a" />
                            </div>
                            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 12 }}>Дякуємо! Заявку отримано</h1>
                            <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, margin: '0 0 8px' }}>
                                Ми перевіримо ваше портфоліо протягом 1–2 робочих днів і повідомимо про підтвердження на вашу пошту.
                            </p>
                            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
                                Після підтвердження знижка {discountPercent}% активується автоматично, щойно ви увійдете у свій акаунт.
                            </p>
                            <Link href="/" style={{ display: 'inline-block', marginTop: 24, color: '#1e2d7d', fontWeight: 600, fontSize: 14 }}>← На головну</Link>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 40, alignItems: 'start' }}>
                            {/* Left: pitch */}
                            <div style={{ paddingTop: 12 }}>
                                <div style={{ display: 'inline-block', background: '#eef3ff', color: '#3d56d6', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                    Партнерська програма
                                </div>
                                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 900, color: '#1e2d7d', lineHeight: 1.05, marginBottom: 16 }}>{title}</h1>
                                <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.7, marginBottom: 28 }}>{subtitle}</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {benefits.map((b, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                                <Check size={13} color="#16a34a" />
                                            </div>
                                            <span style={{ fontSize: 15, color: '#374151', lineHeight: 1.5 }}>{b}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: form */}
                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
                                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d', marginBottom: 4 }}>Подати заявку</h2>
                                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>Після перевірки портфоліо вам відкриється знижка {discountPercent}%</p>

                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <Field label="Імʼя або назва" required>
                                        <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ваше імʼя" style={inputStyle} />
                                    </Field>
                                    <Field label="Email" required>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ваша@пошта.com" style={inputStyle} />
                                    </Field>
                                    <Field label="Телефон">
                                        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380…" style={inputStyle} />
                                    </Field>
                                    <Field label={portfolioLabel} required>
                                        <input value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} required placeholder={portfolioPlaceholder} style={inputStyle} />
                                    </Field>
                                    <Field label="Пароль" required>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Мінімум 8 символів" style={inputStyle} />
                                    </Field>

                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#64748b', cursor: 'pointer', marginTop: 4 }}>
                                        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
                                        <span>Я погоджуюсь з умовами та обробкою моїх даних</span>
                                    </label>

                                    {error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}

                                    <button type="submit" disabled={loading}
                                        style={{ width: '100%', padding: 15, background: loading ? '#9ca3af' : '#263A99', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        {loading && <Loader2 size={16} className="animate-spin" />}
                                        {loading ? 'Надсилається…' : 'Подати заявку'}
                                    </button>
                                    <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                                        Вже маєте акаунт? <Link href="/login" style={{ color: '#1e2d7d', fontWeight: 600 }}>Увійти</Link>
                                    </p>
                                    {cabinetLink && (
                                        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                                            <a href={cabinetLink.href} style={{ color: '#1e2d7d', fontWeight: 600 }}>{cabinetLink.text}</a>
                                        </p>
                                    )}
                                    {altLink && (
                                        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                                            <a href={altLink.href} style={{ color: '#1e2d7d', fontWeight: 600 }}>{altLink.text}</a>
                                        </p>
                                    )}
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 15, outline: 'none', boxSizing: 'border-box',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            {children}
        </div>
    );
}
