'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, User, MessageCircle, Send, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/context';

interface GiftHintModalProps {
    product: {
        id: string;
        name: string;
        price: number;
        image: string;
    };
    isOpen: boolean;
    onClose: () => void;
}

export default function GiftHintModal({ product, isOpen, onClose }: GiftHintModalProps) {
    const t = useT();
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [formData, setFormData] = useState({
        recipient_email: '',
        recipient_name: '',
        sender_name: '',
        message: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);

        try {
            const res = await fetch('/api/gift-hint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: product.id,
                    ...formData
                })
            });

            const data = await res.json();

            if (res.ok) {
                setSent(true);
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ef4444', '#263A99', '#f43f5e']
                });
            } else {
                toast.error(data.error || t('gift_hint.error_generic'));
            }
        } catch (e) {
            toast.error(t('gift_hint.error_connection'));
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="modal-container"
                    style={containerStyle}
                    onClick={e => e.stopPropagation()}
                >
                    <button onClick={onClose} style={closeBtnStyle}><X size={24} /></button>

                    {!sent ? (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                <div style={iconBadgeStyle}></div>
                                <h2 style={titleStyle}>{t('gift_hint.title')}</h2>
                                <p style={subtitleStyle}>{t('gift_hint.subtitle')}</p>
                            </div>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={labelStyle}>{t('gift_hint.recipient_email')}</label>
                                    <div style={inputWrapperStyle}>
                                        <Mail size={18} color="#94a3b8" />
                                        <input
                                            required
                                            type="email"
                                            placeholder="friends@gmail.com"
                                            style={inputStyle}
                                            value={formData.recipient_email}
                                            onChange={e => setFormData({ ...formData, recipient_email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>{t('gift_hint.recipient_name')}</label>
                                        <div style={inputWrapperStyle}>
                                            <User size={18} color="#94a3b8" />
                                            <input
                                                required
                                                placeholder={t("gift_hint.recipient_placeholder")}
                                                style={inputStyle}
                                                value={formData.recipient_name}
                                                onChange={e => setFormData({ ...formData, recipient_name: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>{t('gift_hint.from_label')}</label>
                                        <div style={inputWrapperStyle}>
                                            <SparkleIcon size={18} color="#94a3b8" />
                                            <input
                                                placeholder={t("gift_hint.from_placeholder")}
                                                style={inputStyle}
                                                value={formData.sender_name}
                                                onChange={e => setFormData({ ...formData, sender_name: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>{t('gift_hint.message_label')}</label>
                                    <div style={{ ...inputWrapperStyle, alignItems: 'flex-start', padding: '16px' }}>
                                        <MessageCircle size={18} color="#94a3b8" style={{ marginTop: '4px' }} />
                                        <textarea
                                            placeholder={t("gift_hint.message_placeholder")}
                                            style={{ ...inputStyle, height: '80px', padding: 0 }}
                                            value={formData.message}
                                            onChange={e => setFormData({ ...formData, message: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <button
                                    disabled={sending}
                                    style={{
                                        ...submitBtnStyle,
                                        backgroundColor: sending ? '#94a3b8' : '#ef4444'
                                    }}
                                >
                                    {sending ? t('gift_hint.sending') : t('gift_hint.send_btn')}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                style={successIconStyle}
                            >
                                <CheckCircle2 size={64} color="#22c55e" />
                            </motion.div>
                            <h2 style={{ ...titleStyle, marginTop: '24px' }}>{t('gift_hint.sent_title')}</h2>
                            <p style={subtitleStyle}>{t('gift_hint.sent_subtitle')}</p>
                            <button onClick={onClose} style={doneBtnStyle}>{t('gift_hint.done')}</button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

const SparkleIcon = ({ size, color }: { size: number, color: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.912 4.912L18.824 9.824 13.912 11.736l-1.912 4.912-1.912-4.912-4.912-1.912 4.912-1.912L12 3z" />
    </svg>
);

const overlayStyle = { position: 'fixed' as any, inset: 0, backgroundColor: 'rgb(38, 58, 153)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' };
const containerStyle = { backgroundColor: 'white', width: '100%', maxWidth: '540px', borderRadius: "3px", padding: '56px', position: 'relative' as any, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' };
const closeBtnStyle = { position: 'absolute' as any, top: '32px', right: '32px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const iconBadgeStyle = { width: '64px', height: '64px', borderRadius: "3px", backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 24px' };
const titleStyle = { fontSize: '24px', fontWeight: 900, color: '#263A99', marginBottom: '12px' };
const subtitleStyle = { color: '#64748b', fontSize: '15px', lineHeight: 1.6 };
const labelStyle = { fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em', marginBottom: '8px', display: 'block' };
const inputWrapperStyle = { display: 'flex', alignItems: 'center', gap: '12px', border: '2px solid #f1f5f9', borderRadius: "3px", padding: '0 16px', transition: 'border-color 0.2s' };
const inputStyle = { border: 'none', padding: '16px 0', width: '100%', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#263A99', backgroundColor: 'transparent' };
const submitBtnStyle = { padding: '20px', borderRadius: "3px", color: 'white', border: 'none', fontWeight: 900, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)' };
const successIconStyle = { width: '80px', height: '80px', borderRadius: "3px", backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' };
const doneBtnStyle = { marginTop: '32px', padding: '16px 40px', borderRadius: "3px", backgroundColor: '#263A99', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer' };
