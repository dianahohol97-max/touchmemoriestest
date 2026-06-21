'use client';

import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Building2, Check, Loader2, Plus, Trash2, FileText } from 'lucide-react';

interface CorpOption { key: string; label: string; values: string[]; }
interface CorpProduct {
    id: string; name: string; slug: string;
    description: string | null; image_url: string | null;
    options: CorpOption[];
}
interface BriefLine {
    slug: string; product: string; qty: number;
    options: Record<string, string>;
    _optionDefs: CorpOption[];
}

export default function CorporateClient({ products }: { products: CorpProduct[] }) {
    const [brief, setBrief] = useState<BriefLine[]>([]);
    const [companyName, setCompanyName] = useState('');
    const [contactName, setContactName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [deadline, setDeadline] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const addProduct = (p: CorpProduct) => {
        if (brief.some(b => b.slug === p.slug)) return;
        setBrief(prev => [...prev, {
            slug: p.slug, product: p.name, qty: 100,
            options: Object.fromEntries((p.options || []).map(o => [o.label, o.values[0] || ''])),
            _optionDefs: p.options || [],
        }]);
    };
    const removeLine = (slug: string) => setBrief(prev => prev.filter(b => b.slug !== slug));
    const updateQty = (slug: string, qty: number) => setBrief(prev => prev.map(b => b.slug === slug ? { ...b, qty } : b));
    const updateOption = (slug: string, label: string, value: string) =>
        setBrief(prev => prev.map(b => b.slug === slug ? { ...b, options: { ...b.options, [label]: value } } : b));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!companyName.trim() || !email.trim()) { setError('Вкажіть назву компанії та email.'); return; }
        if (brief.length === 0) { setError('Додайте хоча б один товар до запиту.'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/corporate/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName, contactName, email, phone, deadline, message,
                    brief: brief.map(b => ({ slug: b.slug, product: b.product, qty: b.qty, options: b.options })),
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Сталася помилка.'); setLoading(false); return; }
            setDone(true);
        } catch {
            setError('Сталася помилка. Спробуйте ще раз.');
        }
        setLoading(false);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: 110, paddingBottom: 80 }}>
                {/* Hero */}
                <section style={{ background: 'linear-gradient(135deg, #263A99 0%, #1a2a73 100%)', padding: '64px 0 72px', color: '#fff' }}>
                    <div className="container" style={{ maxWidth: 880, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                            <Building2 size={15} /> Для бізнесу
                        </div>
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 44, fontWeight: 900, lineHeight: 1.05, margin: '0 0 18px' }}>
                            Корпоративні замовлення
                        </h1>
                        <p style={{ fontSize: 17, lineHeight: 1.7, opacity: 0.9, maxWidth: 620, margin: '0 auto' }}>
                            Брендований мерч і поліграфія під ваш бізнес — стаканчики, кружки, візитки, флаєри, брошури та преміальні фотоподарунки. Складіть запит, і ми надішлемо комерційну пропозицію.
                        </p>
                    </div>
                </section>

                {/* Showcase */}
                <section style={{ padding: '56px 0 32px' }}>
                    <div className="container" style={{ maxWidth: 1100 }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 900, color: '#1e2d7d', marginBottom: 8, textAlign: 'center' }}>Наша продукція</h2>
                        <p style={{ fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 36 }}>Натисніть «Додати», щоб включити товар у запит пропозиції</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                            {products.map(p => {
                                const added = brief.some(b => b.slug === p.slug);
                                return (
                                    <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ height: 140, background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {p.image_url
                                                ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <Building2 size={40} color="#c7d2fe" />}
                                        </div>
                                        <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e2d7d', margin: '0 0 6px' }}>{p.name}</h3>
                                            {p.description && <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: '0 0 16px', flex: 1 }}>{p.description}</p>}
                                            <button onClick={() => addProduct(p)} disabled={added}
                                                style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 14, cursor: added ? 'default' : 'pointer',
                                                    background: added ? '#dcfce7' : '#263A99', color: added ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                {added ? <><Check size={15} /> Додано</> : <><Plus size={15} /> Додати</>}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Brief + form */}
                <section style={{ padding: '24px 0 40px' }}>
                    <div className="container" style={{ maxWidth: 720 }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
                            {done ? (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                        <Check size={32} color="#16a34a" />
                                    </div>
                                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 12 }}>Запит надіслано!</h2>
                                    <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, margin: 0 }}>
                                        Ми надішлемо комерційну пропозицію на вашу пошту найближчим часом.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                                        <FileText size={22} color="#263A99" />
                                        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Ваш запит</h2>
                                    </div>

                                    {/* Brief lines */}
                                    {brief.length === 0 ? (
                                        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
                                            Оберіть товари вище, щоб додати їх до запиту
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
                                            {brief.map(line => (
                                                <div key={line.slug} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e2d7d' }}>{line.product}</span>
                                                        <button onClick={() => removeLine(line.slug)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                        <div>
                                                            <label style={miniLabel}>Тираж</label>
                                                            <input type="number" min={1} value={line.qty}
                                                                onChange={e => updateQty(line.slug, Math.max(1, Number(e.target.value)))}
                                                                style={{ ...inputStyle, width: 110 }} />
                                                        </div>
                                                        {line._optionDefs.map(opt => (
                                                            <div key={opt.key}>
                                                                <label style={miniLabel}>{opt.label}</label>
                                                                <select value={line.options[opt.label] || ''}
                                                                    onChange={e => updateOption(line.slug, opt.label, e.target.value)}
                                                                    style={{ ...inputStyle, width: 'auto', minWidth: 130 }}>
                                                                    {opt.values.map(v => <option key={v} value={v}>{v}</option>)}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Contact form */}
                                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Field label="Назва компанії" required>
                                                <input value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Компанія" style={inputStyle} />
                                            </Field>
                                            <Field label="Контактна особа">
                                                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Імʼя" style={inputStyle} />
                                            </Field>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Field label="Email" required>
                                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="компанія@пошта.com" style={inputStyle} />
                                            </Field>
                                            <Field label="Телефон">
                                                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380…" style={inputStyle} />
                                            </Field>
                                        </div>
                                        <Field label="Бажаний термін">
                                            <input value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="Напр.: до 15 липня" style={inputStyle} />
                                        </Field>
                                        <Field label="Додаткові побажання">
                                            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Колір, макет, особливі вимоги…" style={{ ...inputStyle, resize: 'vertical' }} />
                                        </Field>

                                        {error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}

                                        <button type="submit" disabled={loading}
                                            style={{ width: '100%', padding: 15, background: loading ? '#9ca3af' : '#263A99', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            {loading && <Loader2 size={16} className="animate-spin" />}
                                            {loading ? 'Надсилається…' : 'Отримати пропозицію'}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                </section>
            </main>
            <Footer categories={[]} />
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff',
};
const miniLabel: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4,
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
