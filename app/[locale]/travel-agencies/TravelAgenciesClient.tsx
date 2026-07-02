'use client';

import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Gift, Percent, Check, Loader2, Globe } from 'lucide-react';

const MODELS = [
    {
        id: 'gift_certificates',
        icon: Gift,
        title: 'Подарункові сертифікати',
        tagline: 'Дбайливий подарунок після туру',
        description: 'Даруйте клієнтам сертифікат на тревелбук після подорожі — приємний бонус, який збереже спогади про їхню поїздку. Ви купуєте сертифікати зі знижкою 10% на тревелбуки, а клієнти повертаються до вас із теплими емоціями. Сертифікати діють 3 місяці з моменту видачі.',
        perks: ['Знижка 10% на тревелбуки', 'Сертифікати діють 3 місяці', 'Ваші клієнти отримують подарунок', 'Нічого не потрібно виробляти самим'],
    },
    {
        id: 'referral',
        icon: Percent,
        title: 'Реферальна програма',
        tagline: 'Заробляйте на рекомендаціях',
        description: 'Ваша агенція отримує персональний промокод зі знижкою для клієнтів, а ви — 10% від вартості кожного замовлення тревелбуку за цим кодом. Винагорода нараховується лише за тревелбуки — на інші товари реферальна програма не поширюється. Менеджерам вигідно рекомендувати нас — це додатковий дохід без жодних витрат.',
        perks: ['Персональний промокод агенції', '10% лише за замовлення тревелбуку', 'На інші товари не діє', 'Оплата лише за реальні продажі'],
    },
    // Co-branded travelbooks — hidden for now (terms not finalised). Restore
    // this block and the matching form <option> below to bring it back.
    // {
    //     id: 'cobranded',
    //     icon: BookHeart,
    //     title: 'Co-branded тревелбуки',
    //     tagline: 'Преміум-сервіс під вашим брендом',
    //     description: 'Тревелбуки з логотипом вашої агенції та підписом «Ваша подорож з [агенція]». Ідеальний подарунок для VIP-клієнтів після преміальних турів — ви стаєте частиною їхнього найкращого досвіду подорожі.',
    //     perks: ['Ваш логотип у книзі', 'Підкреслює преміальність турів', 'Підсилює лояльність клієнтів'],
    // },
];

export default function TravelAgenciesClient() {
    const [agencyName, setAgencyName] = useState('');
    const [contactName, setContactName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [website, setWebsite] = useState('');
    const [interestedModel, setInterestedModel] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!agencyName.trim() || !email.trim()) {
            setError('Вкажіть назву агенції та email.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/partnership/travel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agencyName, contactName, email, phone, website, interestedModel, message }),
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
                            <Globe size={15} /> Партнерська програма
                        </div>
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 44, fontWeight: 900, lineHeight: 1.05, margin: '0 0 18px' }}>
                            Співпраця для тревел-агенцій
                        </h1>
                        <p style={{ fontSize: 17, lineHeight: 1.7, opacity: 0.9, maxWidth: 620, margin: '0 auto' }}>
                            Ваші клієнти повертаються з подорожей із сотнями фото. Допоможіть їм зберегти ці спогади — і зробіть це частиною свого сервісу. Оберіть модель співпраці, яка підходить саме вашій агенції.
                        </p>
                    </div>
                </section>

                {/* Models */}
                <section style={{ padding: '64px 0' }}>
                    <div className="container" style={{ maxWidth: 1100 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                            {MODELS.map(m => {
                                const Icon = m.icon;
                                return (
                                    <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '32px 28px', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ width: 52, height: 52, borderRadius: 12, background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                            <Icon size={26} color="#3d56d6" />
                                        </div>
                                        <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d', margin: '0 0 4px' }}>{m.title}</h3>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#3d56d6', margin: '0 0 14px' }}>{m.tagline}</p>
                                        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#475569', margin: '0 0 18px', flex: 1 }}>{m.description}</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                            {m.perks.map((p, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Check size={15} color="#16a34a" style={{ flexShrink: 0 }} />
                                                    <span style={{ fontSize: 13, color: '#374151' }}>{p}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Form */}
                <section style={{ padding: '0 0 40px' }}>
                    <div className="container" style={{ maxWidth: 620 }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '40px 36px', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
                            {done ? (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                        <Check size={32} color="#16a34a" />
                                    </div>
                                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 12 }}>Дякуємо за заявку!</h2>
                                    <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, margin: 0 }}>
                                        Ми звʼяжемося з вами найближчим часом, щоб обговорити деталі співпраці.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1e2d7d', marginBottom: 6, textAlign: 'center' }}>Хочемо співпрацювати</h2>
                                    <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 28, textAlign: 'center' }}>Залиште контакти — і ми обговоримо найкращі умови для вашої агенції</p>

                                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <Field label="Назва агенції" required>
                                            <input value={agencyName} onChange={e => setAgencyName(e.target.value)} required placeholder="Назва вашої агенції" style={inputStyle} />
                                        </Field>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <Field label="Контактна особа">
                                                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Імʼя" style={inputStyle} />
                                            </Field>
                                            <Field label="Телефон">
                                                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380…" style={inputStyle} />
                                            </Field>
                                        </div>
                                        <Field label="Email" required>
                                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="агенція@пошта.com" style={inputStyle} />
                                        </Field>
                                        <Field label="Сайт або сторінка агенції">
                                            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Instagram або вебсайт" style={inputStyle} />
                                        </Field>
                                        <Field label="Яка модель вас цікавить?">
                                            <select value={interestedModel} onChange={e => setInterestedModel(e.target.value)} style={inputStyle}>
                                                <option value="">Оберіть (необовʼязково)</option>
                                                <option value="gift_certificates">Подарункові сертифікати</option>
                                                <option value="referral">Реферальна програма</option>
                                                {/* <option value="cobranded">Co-branded тревелбуки</option> — hidden for now */}
                                                <option value="not_sure">Ще не визначилися</option>
                                            </select>
                                        </Field>
                                        <Field label="Повідомлення">
                                            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Розкажіть трохи про вашу агенцію або питання…" style={{ ...inputStyle, resize: 'vertical' }} />
                                        </Field>

                                        {error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}

                                        <button type="submit" disabled={loading}
                                            style={{ width: '100%', padding: 15, background: loading ? '#9ca3af' : '#263A99', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            {loading && <Loader2 size={16} className="animate-spin" />}
                                            {loading ? 'Надсилається…' : 'Надіслати заявку'}
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
    width: '100%', padding: '11px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff',
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
