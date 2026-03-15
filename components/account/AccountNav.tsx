'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MenuItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

export function AccountNav({ items }: { items: MenuItem[] }) {
    const pathname = usePathname();
    const supabase = createClient();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    return (
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item) => {
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
                            borderRadius: '3px',
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
                type="button"
                onClick={handleLogout}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '3px',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '15px',
                    marginTop: '16px',
                    textAlign: 'left',
                    width: '100%',
                    fontFamily: 'inherit'
                }}
                className="hover:bg-red-50"
            >
                <LogOut size={20} />
                Вийти
            </button>
        </nav>
    );
}
