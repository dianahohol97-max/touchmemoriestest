'use client';
import { useState } from 'react';
import styles from './admin-login.module.css';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Suspense } from 'react';

function AdminLoginContent() {
    const supabase = createClient();
    const router = useRouter();
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

            // Wait a moment for middleware to detect the session
            router.push('/admin');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Помилка входу');
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#263A99', padding: '20px' }}>
            <div }
                animate={{ opacity: 1, y: 0 }}
                style={{ width: '100%', maxWidth: '400px', backgroundColor: 'white', padding: '48px', borderRadius: "3px", boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
            >
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
