'use client';
import { useState, useEffect } from 'react';
import styles from './admin-login.module.css';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Suspense } from 'react';

function AdminLoginContent() {
    const supabase = createClient();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(searchParams.get('error') === 'unauthorized' ? 'Ви не маєте прав доступу до панелі адміністратора.' : '');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Hard navigation guarantees the freshly-set auth cookie reaches the
            // proxy middleware on the /admin request. router.push() raced the
            // cookie write and left the button spinning without entering.
            window.location.assign('/admin');
            return;
        } catch (err: any) {
            setError(err.message || 'Помилка входу');
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true);
        setError('');
        const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const { data, error: authError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${origin}/admin/login` },
        });
        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }
        if (data?.url) window.location.href = data.url;
    };

    // When Google redirects back to /admin/login?code=..., exchange the code for
    // a session here (the global OAuth handler skips /admin) and go to /admin.
    // The proxy gate then decides access: staff get in, clients are bounced back
    // here with ?error=unauthorized.
    useEffect(() => {
        const code = searchParams.get('code');
        if (!code) return;
        setLoading(true);
        supabase.auth.exchangeCodeForSession(code).then(({ error: exErr }) => {
            if (exErr) {
                setError(exErr.message);
                setLoading(false);
                return;
            }
            window.location.assign('/admin');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#263A99', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'white', padding: '48px', borderRadius: "3px", boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 900, color: '#263A99', marginBottom: '8px' }}>TM ADMIN</h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Вхід до панелі управління</p>
                </div>

                {error && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: "3px", color: '#dc2626', fontSize: '14px', marginBottom: '24px' }}>
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={labelStyle}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={inputStyle}
                                className={styles.adminInput}
                                placeholder="name@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Пароль</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={inputStyle}
                                className={styles.adminInput}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ ...submitBtnStyle, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}
                    >
                        {loading ? <Loader2 size={20} className={styles.spin} /> : 'Увійти'}
                    </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>або</span>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>

                <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '13px', borderRadius: '3px', backgroundColor: 'white', color: '#1e293b', border: '1.5px solid #e2e8f0', fontWeight: 600, fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                    <GoogleIcon />
                    Увійти через Google
                </button>

                <div style={{ marginTop: '32px', textAlign: 'center' }}>
                    <a href="/" style={{ fontSize: '14px', color: '#64748b', textDecoration: 'none' }}>← На сайт</a>
                </div>
            </div>

        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#263A99' }}><Loader2 className={styles.spin} color="white" size={32} /></div>}>
            <AdminLoginContent />
        </Suspense>
    );
}

const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
const inputStyle = { width: '100%', padding: '14px 14px 14px 48px', borderRadius: "3px", border: '1.5px solid #e2e8f0', outline: 'none', transition: 'all 0.2s', fontSize: '15px' };
const submitBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', borderRadius: "3px", backgroundColor: '#263A99', color: 'white', border: 'none', fontWeight: 700, fontSize: '16px', marginTop: '12px' };

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
        </svg>
    );
}
