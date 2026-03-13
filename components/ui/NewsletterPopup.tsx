'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail } from 'lucide-react';

export function NewsletterPopup() {
    const [isOpen, setIsOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Check if already seen or subscribed in this session
        const hasSeen = sessionStorage.getItem('newsletterPopupShown');
        if (!hasSeen) {
            // Trigger popup after 2.5 seconds on site
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        sessionStorage.setItem('newsletterPopupShown', 'true');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/subscribers/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    source: 'popup'
                })
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                // Auto-close after 3 seconds
                setTimeout(() => {
                    handleClose();
                }, 3000);
            } else {
                setError(data.message || data.error || 'Сталася помилка');
            }
        } catch (err) {
            setError('Не вдалося підписатися');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Dark semi-transparent overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 999
                        }}
                    />

                    {/* Popup Modal */}
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        width: '90%',
                        maxWidth: '420px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none' // Allow clicking through the container to the overlay
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '24px',
                                width: '100%',
                                overflow: 'hidden',
                                position: 'relative',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                                pointerEvents: 'auto' // Re-enable pointer events for the modal itself
                            }}
                        >
                            <button
                                onClick={handleClose}
                                style={{
                                    position: 'absolute',
                                    right: '16px',
                                    top: '16px',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    zIndex: 10,
                                    background: 'rgba(255,255,255,0.8)',
                                    borderRadius: '50%',
                                    padding: '4px',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>

                            <div style={{
                                backgroundColor: '#fffbeb',
                                padding: '32px',
                                textAlign: 'center',
                                borderBottom: '1px solid #fef3c7',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '4px',
                                    background: 'linear-gradient(to right, #fcd34d, #f59e0b, #fcd34d)'
                                }}></div>
                                <div style={{
                                    backgroundColor: 'white',
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px',
                                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                    color: '#f59e0b'
                                }}>
                                    <Mail size={32} />
                                </div>
                                <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>Знижка -7%</h3>
                                <p style={{ color: '#475569', fontSize: '15px' }}>
                                    Підпишіться на наші новини та отримайте промокод на перше замовлення
                                </p>
                            </div>

                            <div style={{ padding: '32px' }}>
                                {success ? (
                                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                        <div style={{
                                            width: '64px',
                                            height: '64px',
                                            backgroundColor: '#dcfce7',
                                            color: '#16a34a',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 16px'
                                        }}>
                                            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h4 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Дякуємо!</h4>
                                        <p style={{ color: '#475569' }}>Промокод надіслано на вашу пошту 💛</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <input
                                                type="email"
                                                required
                                                placeholder="Ваш Email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 16px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    fontSize: '16px',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            {error && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '8px' }}>{error}</p>}
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loading || !email}
                                            style={{
                                                width: '100%',
                                                backgroundColor: '#1e293b',
                                                color: 'white',
                                                fontWeight: 700,
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                border: 'none',
                                                cursor: (loading || !email) ? 'not-allowed' : 'pointer',
                                                opacity: (loading || !email) ? 0.7 : 1,
                                                fontSize: '16px',
                                                transition: 'background-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => { if (!loading && email) e.currentTarget.style.backgroundColor = '#0f172a'; }}
                                            onMouseLeave={(e) => { if (!loading && email) e.currentTarget.style.backgroundColor = '#1e293b'; }}
                                        >
                                            {loading ? 'Відправка...' : 'Отримати промокод'}
                                        </button>
                                        <p style={{ fontSize: '12px', textAlign: 'center', color: '#94a3b8', marginTop: '8px', margin: 0 }}>
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
