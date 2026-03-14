'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import styles from './account-layout.module.css';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import {
    User,
    ShoppingBag,
    Settings,
    LogOut,
    ChevronRight,
    Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
    const supabase = createClient();
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setIsLoading(false);
        };
        checkUser();
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navigation />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Loader2 size={48} className="animate-spin text-slate-300" />
                </div>
            </div>
        );
    }

    const menuItems = [
        { label: 'Мої замовлення', href: '/account', icon: <ShoppingBag size={20} /> },
        { label: 'Профіль', href: '/account/profile', icon: <User size={20} /> },
        { label: 'Налаштування', href: '/account/settings', icon: <Settings size={20} /> },
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
            <Navigation />

            <main style={{ flex: 1, paddingTop: '140px', paddingBottom: '80px', maxWidth: '1200px', margin: '0 auto', width: '100%', paddingLeft: '20px', paddingRight: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }} className={styles.accountGrid}>

                    {/* Sidebar */}
                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
                                    {user.email?.[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>{user.user_metadata?.full_name || 'Клієнт'}</div>
                                    <div style={{ fontSize: '13px', color: '#64748b' }}>{user.email}</div>
                                </div>
                            </div>

                            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {menuItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                backgroundColor: isActive ? '#f0f9ff' : 'transparent',
                                                color: isActive ? 'var(--primary)' : '#64748b',
                                                textDecoration: 'none',
                                                fontWeight: isActive ? 700 : 500,
                                                transition: 'all 0.2s',
                                                fontSize: '15px'
                                            }}
                                            className="hover:bg-slate-50"
                                        >
                                            <span style={{ color: isActive ? 'var(--primary)' : '#94a3b8' }}>{item.icon}</span>
                                            {item.label}
                                            {isActive && <ChevronRight size={16} style={{ marginLeft: 'auto' }} />}
                                        </Link>
                                    );
                                })}
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        backgroundColor: 'transparent',
                                        color: '#ef4444',
                                        border: 'none',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: '15px',
                                        marginTop: '16px',
                                        textAlign: 'left',
                                        width: '100%'
                                    }}
                                    className="hover:bg-red-50"
                                >
                                    <LogOut size={20} />
                                    Вийти
                                </button>
                            </nav>
                        </div>
                    </aside>

                    {/* Content */}
                    <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', minHeight: '600px' }}>
                        {children}
                    </div>
                </div>
            </main>

            <Footer categories={[]} />

        </div>
    );
}
