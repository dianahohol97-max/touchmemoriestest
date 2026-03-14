export const dynamic = 'force-dynamic';
import styles from './account-layout.module.css';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
    User,
    ShoppingBag,
    Settings
} from 'lucide-react';
import { AccountNav } from '@/components/account/AccountNav';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();

    // 4. Add user check at the beginning of the component
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const menuItems = [
        { label: 'Мої замовлення', href: '/account', icon: <ShoppingBag size={20} /> },
        { label: 'Профіль', href: '/account/profile', icon: <User size={20} /> },
        { label: 'Налаштування', href: '/account/settings', icon: <Settings size={20} /> },
    ];

    // Helper for logout (since we are in a server component, we pass it to a client component logic)
    // Actually, sign out should be done on client side for cookie cleanup usually, 
    // but the AccountNav component will handle the interactive part.

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
            <Navigation />

            <main style={{ flex: 1, paddingTop: '140px', paddingBottom: '80px', maxWidth: '1200px', margin: '0 auto', width: '100%', paddingLeft: '20px', paddingRight: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }} className={styles.accountGrid}>

                    {/* Sidebar */}
                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--primary)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    fontWeight: 800,
                                    overflow: 'hidden'
                                }}>
                                    {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                                        <img
                                            src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                                            alt="Avatar"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        // 2. Fix line 70 — add optional chaining
                                        user?.email?.[0]?.toUpperCase() ?? '?'
                                    )}
                                </div>
                                <div>
                                    {/* 3. Fix ALL other user references in this file */}
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
                                        {user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? 'Клієнт'}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                                        {user?.email ?? ''}
                                    </div>
                                </div>
                            </div>

                            <AccountNav
                                items={menuItems}
                            />
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
