'use client';
import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            toast.success('Вітаємо! Ви успішно увійшли.');
            router.push('/account');
            router.refresh();
        } catch (error: any) {
            toast.error('Помилка входу: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '160px', paddingBottom: '80px', display: 'flex', justifyContent: 'center', paddingLeft: '20px', paddingRight: '20px' }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '24px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                    width: '100%',
                    maxWidth: '480px'
                }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '8px', textAlign: 'center' }}>
                        Увійти
                    </h1>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '32px' }}>
                        Раді бачити вас знову
                    </p>

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 700, color: '#475569' }}>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ваша@пошта.com"
                                required
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    outline: 'none',
                                    fontSize: '16px',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 700, color: '#475569' }}>Пароль</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    outline: 'none',
                                    fontSize: '16px',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '16px',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '16px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                marginTop: '8px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                            }}
                        >
                            {isLoading ? <Loader2 size={24} className="animate-spin" /> : 'Увійти'}
                        </button>
                    </form>

                    <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
                        Ще не маєте акаунту?{' '}
                        <Link href="/register" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
                            Зареєструватись
                        </Link>
                    </div>
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
