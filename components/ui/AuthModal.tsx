'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Mail, Lock, Eye, EyeOff, Loader2, User, ArrowRight } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    /** Context message shown above the form, e.g. "Щоб відкрити конструктор, увійдіть в акаунт" */
    message?: string;
}

type Mode = 'login' | 'register' | 'forgot';

export function AuthModal({ isOpen, onClose, onSuccess, message }: AuthModalProps) {
    const supabase = createClient();
    const [mode, setMode] = useState<Mode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!isOpen) return null;

    const resetForm = () => { setError(''); setSuccess(''); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) { setError(translateError(error.message)); return; }
                onSuccess();
                onClose();

            } else if (mode === 'register') {
                const { error } = await supabase.auth.signUp({
                    email, password,
                    options: { data: { first_name: firstName } }
                });
                if (error) { setError(translateError(error.message)); return; }
                setSuccess('Лист підтвердження надіслано на вашу пошту. Перевірте вхідні та spam.');

            } else if (mode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/reset`,
                });
                if (error) { setError(translateError(error.message)); return; }
                setSuccess('Лист для скидання паролю надіслано!');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setGoogleLoading(true);
        // Store a flag so after OAuth redirect we call the callback
        sessionStorage.setItem('authModalPendingCallback', '1');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href },
        });
        if (error) { setError(translateError(error.message)); setGoogleLoading(false); }
    };

    const titleMap: Record<Mode, string> = {
        login:    'Увійдіть в акаунт',
        register: 'Створіть акаунт',
        forgot:   'Відновити пароль',
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
                    backdropFilter: 'blur(4px)', zIndex: 9998, animation: 'fadeIn 0.2s ease',
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                zIndex: 9999, width: '100%', maxWidth: 420, background: 'white',
                borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
                padding: '36px 36px 32px', animation: 'slideUp 0.25s ease',
                maxHeight: '90vh', overflowY: 'auto',
            }}>
                {/* Close */}
                <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} color="#64748b"/>
                </button>

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #1e2d7d, #263a99)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={18} color="white"/>
                    </div>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 16, color: '#263a99' }}>Touch.Memories</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>Особистий кабінет</div>
                    </div>
                </div>

                {/* Context message */}
                {message && (
                    <div style={{ background: '#eff3ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#263a99', fontWeight: 600, lineHeight: 1.5 }}>
                        🔒 {message}
                    </div>
                )}

                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 20px' }}>{titleMap[mode]}</h2>

                {/* Google */}
                {mode !== 'forgot' && (
                    <button onClick={handleGoogle} disabled={googleLoading}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 20px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: 'white', fontSize: 14, fontWeight: 700, color: '#0f172a', cursor: 'pointer', marginBottom: 20, transition: 'border-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#263a99')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}>
                        {googleLoading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }}/> : (
                            <svg width="18" height="18" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                            </svg>
                        )}
                        Продовжити з Google
                    </button>
                )}

                {mode !== 'forgot' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>або</span>
                        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {mode === 'register' && (
                        <InputField
                            label="Ім'я" type="text" value={firstName}
                            onChange={setFirstName} placeholder="Ваше ім'я" icon={<User size={15} color="#94a3b8"/>}
                        />
                    )}

                    <InputField
                        label="Email" type="email" value={email}
                        onChange={setEmail} placeholder="your@email.com" icon={<Mail size={15} color="#94a3b8"/>}
                        required
                    />

                    {mode !== 'forgot' && (
                        <InputField
                            label="Пароль" type={showPass ? 'text' : 'password'} value={password}
                            onChange={setPassword} placeholder="Мінімум 6 символів" icon={<Lock size={15} color="#94a3b8"/>}
                            required
                            suffix={
                                <button type="button" onClick={() => setShowPass(!showPass)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    {showPass ? <EyeOff size={15} color="#94a3b8"/> : <Eye size={15} color="#94a3b8"/>}
                                </button>
                            }
                        />
                    )}

                    {/* Error / Success */}
                    {error && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                            {success}
                        </div>
                    )}

                    <button type="submit" disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 24px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1e2d7d, #263a99)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.15s', marginTop: 2 }}>
                        {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }}/> : <ArrowRight size={18}/>}
                        {mode === 'login' ? 'Увійти' : mode === 'register' ? 'Створити акаунт' : 'Надіслати лист'}
                    </button>
                </form>

                {/* Mode switchers */}
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                    {mode === 'login' && (<>
                        <button onClick={() => { setMode('register'); resetForm(); }} style={linkBtn}>
                            Немає акаунту? <strong>Зареєструватись</strong>
                        </button>
                        <button onClick={() => { setMode('forgot'); resetForm(); }} style={{ ...linkBtn, color: '#94a3b8', fontSize: 12 }}>
                            Забули пароль?
                        </button>
                    </>)}
                    {mode === 'register' && (
                        <button onClick={() => { setMode('login'); resetForm(); }} style={linkBtn}>
                            Вже є акаунт? <strong>Увійти</strong>
                        </button>
                    )}
                    {mode === 'forgot' && (
                        <button onClick={() => { setMode('login'); resetForm(); }} style={linkBtn}>
                            ← Назад до входу
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { opacity: 0; transform: translate(-50%,-48%) } to { opacity: 1; transform: translate(-50%,-50%) } }
                @keyframes spin { to { transform: rotate(360deg) } }
            `}</style>
        </>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InputField({ label, type, value, onChange, placeholder, icon, suffix, required }: {
    label: string; type: string; value: string; onChange: (v: string) => void;
    placeholder?: string; icon?: React.ReactNode; suffix?: React.ReactNode; required?: boolean;
}) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', background: 'white', transition: 'border-color 0.15s' }}
                onFocus={() => {}} onBlur={() => {}}>
                {icon}
                <input
                    type={type} value={value} onChange={e => onChange(e.target.value)}
                    placeholder={placeholder} required={required}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: '#0f172a' }}
                />
                {suffix}
            </div>
        </div>
    );
}

const linkBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
    color: '#263a99', fontWeight: 500,
};

function translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Невірний email або пароль';
    if (msg.includes('Email not confirmed')) return 'Підтвердіть email — перевірте пошту';
    if (msg.includes('User already registered')) return 'Цей email вже зареєстровано';
    if (msg.includes('Password should be at least')) return 'Пароль має бути мінімум 6 символів';
    if (msg.includes('rate limit')) return 'Забагато спроб. Зачекайте хвилину';
    return msg;
}
