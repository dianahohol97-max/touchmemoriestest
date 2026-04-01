'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Gift, X, Mail, MessageSquare, Send, Check } from 'lucide-react';

interface Props {
    productId: string;
    productSlug: string;
    productName: string;
    productImage?: string;
    productPrice: number;
}

export default function GiftHintButton({ productId, productSlug, productName, productImage, productPrice }: Props) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'choose' | 'form' | 'sent'>('choose');
    const [channel, setChannel] = useState<'email' | 'sms'>('email');
    const [form, setForm] = useState({ sender_name: '', recipient_email: '', recipient_phone: '', message: '' });
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        setLoading(true);
        await fetch('/api/gift-hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, product_slug: productSlug, product_name: productName, product_image: productImage, product_price: productPrice, channel, ...form })
        });
        setLoading(false);
        setStep('sent');
    };

    const modal = open && typeof window !== 'undefined' ? createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={e => e.target === e.currentTarget && (setOpen(false), setStep('choose'))}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Gift size={20} color="#263A99" />
                        <span style={{ fontWeight: 800, fontSize: '16px', color: '#263A99' }}>Натякнути на подарунок</span>
                    </div>
                    <button onClick={() => { setOpen(false); setStep('choose'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                </div>

                {/* Product preview */}
                <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {productImage && <img src={productImage} style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover' }} />}
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#374151' }}>{productName}</div>
                        <div style={{ fontWeight: 800, color: '#263A99', fontSize: '16px' }}>{productPrice} грн</div>
                    </div>
                </div>

                <div style={{ padding: '24px' }}>
                    {step === 'choose' && (
                        <>
                            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>Оберіть спосіб відправки натяку:</p>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                                {(['email', 'sms'] as const).map(ch => (
                                    <button key={ch} onClick={() => setChannel(ch)}
                                        style={{ flex: 1, padding: '14px', borderRadius: '10px', border: channel === ch ? '2px solid #263A99' : '2px solid #e2e8f0', backgroundColor: channel === ch ? '#eff6ff' : 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                        {ch === 'email' ? <Mail size={20} color={channel === ch ? '#263A99' : '#94a3b8'} /> : <MessageSquare size={20} color={channel === ch ? '#263A99' : '#94a3b8'} />}
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: channel === ch ? '#263A99' : '#64748b' }}>{ch === 'email' ? 'Email' : 'SMS'}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setStep('form')} style={{ width: '100%', padding: '14px', backgroundColor: '#263A99', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
                                Далі →
                            </button>
                        </>
                    )}

                    {step === 'form' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {[
                                { key: 'sender_name', label: "Ваше ім'я", placeholder: "Ваше ім'я" },
                                channel === 'email'
                                    ? { key: 'recipient_email', label: 'Email отримувача', placeholder: 'email@example.com' }
                                    : { key: 'recipient_phone', label: 'Телефон отримувача', placeholder: '+380...' },
                                { key: 'message', label: 'Повідомлення (необов\'язково)', placeholder: 'Напишіть щось тепле...' }
                            ].map((f: any) => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>{f.label}</label>
                                    {f.key === 'message'
                                        ? <textarea rows={3} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', resize: 'none', boxSizing: 'border-box' }} />
                                        : <input type={f.key === 'recipient_email' ? 'email' : 'text'} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                                    }
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                <button onClick={() => setStep('choose')} style={{ flex: 1, padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>← Назад</button>
                                <button onClick={handleSend} disabled={loading || !form.sender_name || (!form.recipient_email && !form.recipient_phone)}
                                    style={{ flex: 2, padding: '12px', backgroundColor: '#263A99', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <Send size={16} />{loading ? 'Відправляємо...' : 'Відправити'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'sent' && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ width: '56px', height: '56px', backgroundColor: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Check size={28} color="#16a34a" />
                            </div>
                            <h3 style={{ margin: '0 0 8px', color: '#263A99' }}>Натяк відправлено! 🎁</h3>
                            <p style={{ color: '#64748b', margin: '0 0 20px', fontSize: '14px' }}>Ваш натяк успішно надіслано</p>
                            <button onClick={() => { setOpen(false); setStep('choose'); setForm({ sender_name: '', recipient_email: '', recipient_phone: '', message: '' }); }}
                                style={{ padding: '12px 28px', backgroundColor: '#263A99', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                Закрити
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button onClick={() => setOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: '#fff7ed', color: '#ea580c', border: '1.5px solid #fed7aa', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '14px', width: '100%', justifyContent: 'center' }}>
                <Gift size={16} /> Натякнути на подарунок
            </button>
            {modal}
        </>
    );
}
