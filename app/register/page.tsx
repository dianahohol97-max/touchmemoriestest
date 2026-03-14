'use client';
import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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

    const router = useRouter();
    const supabase = createClient();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

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

            toast.success('Реєстрація успішна! Будь ласка, перевірте пошту.');
            router.push('/login');
        } catch (error: any) {
            toast.error('Помилка реєстрації: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`
            }
        });
        if (error) toast.error('Помилка Google: ' + error.message);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '140px', paddingBottom: '80px', display: 'flex', justifyContent: 'center', paddingLeft: '20px', paddingRight: '20px' }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '24px',
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
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Підтвердити пароль *</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    style={inputStyle}
                                />
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
                                    Я погоджуюсь з <Link href="/privacy-policy" target="_blank" style={{ color: 'var(--primary)', fontWeight: 600 }}>Політикою конфіденційності</Link> та <Link href="/public-offer" target="_blank" style={{ color: 'var(--primary)', fontWeight: 600 }}>Публічною офертою</Link>
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
                                borderRadius: '12px',
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
                            color: '#1e293b',
                            borderRadius: '12px',
                            border: '1.5px solid #e2e8f0',
                            fontSize: '16px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '12px'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                        </svg>
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
    borderRadius: '12px',
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
