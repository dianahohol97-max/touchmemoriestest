'use client';
import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Register() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [birthday, setBirthday] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [subscribe, setSubscribe] = useState(false);
    const [agreePrivacy, setAgreePrivacy] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const supabase = (supabaseUrl && supabaseKey)
        ? createClient()
        : null;

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!supabase) {
            toast.error('Supabase connection not initialized');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Паролі не співпадають');
            return;
        }

        setIsLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`,
                        birthday: birthday,
                        email_subscribed: subscribe
                    }
                }
            });

            if (error) throw error;

            if (data.user?.id) {
                fetch('/api/consent/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'terms_accepted',
                        categories: { terms_version: 1, email },
                    }),
                }).catch(() => {});

                if (subscribe) {
                    fetch('/api/consent/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'marketing_accepted',
                            categories: { email, source: 'registration' },
                        }),
                    }).catch(() => {});
                }
            }

            toast.success('Реєстрація успішна! Будь ласка, перевірте пошту.');
            router.push('/login');
        } catch (error: any) {
            toast.error('Помилка реєстрації: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            toast.error('Supabase connection not initialized');
            return;
        }

        const supabase = createBrowserClient(supabaseUrl, supabaseKey)
        // Canonical domain + current localized page (see login page note); the
        // global OAuthCallbackHandler exchanges the ?code= and routes to /account.
        const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${canonicalOrigin}${window.location.pathname}`
            }
        });
        if (error) {
            toast.error('Помилка Google: ' + error.message);
            return;
        }
        if (data?.url) {
            window.location.href = data.url;
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '140px', paddingBottom: '80px', display: 'flex', justifyContent: 'center', paddingLeft: '20px', paddingRight: '20px' }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: "3px",
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                    width: '100%',
                    maxWidth: '520px'
                }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '8px', textAlign: 'center' }}>
                        Реєстрація
                    </h1>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '32px' }}>
                        Станьте частиною Touch Memories
                    </p>

                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Ім'я *</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Іван"
                                    required
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Прізвище *</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Іванов"
                                    required
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Email *</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ваша@пошта.com"
                                required
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Дата народження</label>
                            <input
                                type="date"
                                value={birthday}
                                onChange={(e) => setBirthday(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Пароль *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        style={{ ...inputStyle, paddingRight: 40 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, lineHeight: 1 }}
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                                    >
                                        {showPassword
                                            ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        }
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Підтвердити пароль *</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        style={{ ...inputStyle, paddingRight: 40 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, lineHeight: 1 }}
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                                    >
                                        {showPassword
                                            ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                            <label style={{ display: 'flex', gap: '12px', fontSize: '14px', cursor: 'pointer', lineHeight: '1.4' }}>
                                <input
                                    type="checkbox"
                                    checked={subscribe}
                                    onChange={(e) => setSubscribe(e.target.checked)}
                                    style={{ marginTop: '3px' }}
                                />
                                <span>Підписатись на email розсилку та отримувати новини, акції та спеціальні пропозиції</span>
                            </label>

                            <label style={{ display: 'flex', gap: '12px', fontSize: '14px', cursor: 'pointer', lineHeight: '1.4' }}>
                                <input
                                    type="checkbox"
                                    required
                                    checked={agreePrivacy}
                                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                                    style={{ marginTop: '3px' }}
                                />
                                <span>
                                    Я погоджуюсь з <Link href="/privacy" target="_blank" style={{ color: 'var(--primary)', fontWeight: 600 }}>Політикою конфіденційності</Link> та <Link href="/terms" target="_blank" style={{ color: 'var(--primary)', fontWeight: 600 }}>Умовами використання</Link>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !agreePrivacy}
                            style={{
                                width: '100%',
                                padding: '16px',
                                backgroundColor: agreePrivacy ? 'var(--primary)' : '#cbd5e1',
                                color: 'white',
                                borderRadius: "3px",
                                border: 'none',
                                fontSize: '16px',
                                fontWeight: 800,
                                cursor: agreePrivacy ? 'pointer' : 'not-allowed',
                                marginTop: '12px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                boxShadow: agreePrivacy ? '0 10px 20px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            {isLoading ? <Loader2 size={24} className="animate-spin" /> : 'Зареєструватись'}
                        </button>
                    </form>

                    <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
                        <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>або</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
                    </div>

                    <button
                        onClick={handleGoogleSignUp}
                        style={{
                            width: '100%',
                            padding: '14px',
                            backgroundColor: 'white',
                            color: '#263A99',
                            border: '1px solid #e2e8f0',
                            borderRadius: "3px",
                            fontSize: '15px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            marginBottom: '24px'
                        }}
                    >
                        <img
                            src="https://www.google.com/favicon.ico"
                            width="20"
                            height="20"
                            alt="Google"
                        />
                        Зареєструватись через Google
                    </button>

                    <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
                        Вже маєте акаунт?{' '}
                        <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
                            Увійти
                        </Link>
                    </div>
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}

const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: "3px",
    border: '1px solid #e2e8f0',
    outline: 'none',
    fontSize: '16px',
    transition: 'border-color 0.2s',
    marginTop: '6px'
};

const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#475569'
};
