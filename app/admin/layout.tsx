'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard, ShoppingBag, List, ShoppingCart,
    User, Users, Settings, LogOut, Factory,
    MessageSquare, FileText, FolderTree, Banknote,
    Tags, Mail, Palette, DollarSign, Box, Bot,
    Package, Folder, Star, CreditCard, Activity,
    TrendingDown, Printer, Shield
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = createClient();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
        router.refresh();
    };

    return (
        <PermissionsProvider>
            <AdminLayoutContent handleLogout={handleLogout}>
                {children}
            </AdminLayoutContent>
        </PermissionsProvider>
    );
}

function AdminLayoutContent({ children, handleLogout }: { children: React.ReactNode, handleLogout: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const { hasPermission, isLoading } = usePermissions();

    const menuItems = [
        { name: 'Огляд', href: '/admin', icon: <LayoutDashboard size={20} />, section: 'analytics' },
        { name: 'Товари', href: '/admin/products', icon: <ShoppingBag size={20} />, section: 'catalog' },
        { name: 'Популярні товари', href: '/admin/catalog/featured', icon: <Star size={20} />, section: 'catalog' },
        { name: 'Категорії', href: '/admin/categories', icon: <List size={20} />, section: 'catalog' },
        { name: 'B2B Ціни', href: '/admin/role-pricing', icon: <DollarSign size={20} />, section: 'catalog' },
        { name: 'Замовлення', href: '/admin/orders', icon: <ShoppingCart size={20} />, section: 'orders' },
        { name: 'Виробництво', href: '/admin/production', icon: <Factory size={20} />, section: 'production' },
        { name: 'Склад', href: '/admin/inventory', icon: <Box size={20} />, section: 'production' },
        { name: 'Клієнти', href: '/admin/customers', icon: <User size={20} />, section: 'customers' },
        { name: 'AI Чат (Inbox)', href: '/admin/social-inbox', icon: <MessageSquare size={20} />, section: 'ai' },
        { name: 'AI Налаштування', href: '/admin/settings/chatbot', icon: <Bot size={20} />, section: 'ai' },
        { name: 'Блог', href: '/admin/blog', icon: <FileText size={20} />, section: 'content' },
        { name: 'Категорії блогу', href: '/admin/blog/categories', icon: <FolderTree size={20} />, section: 'content' },
        { name: 'Шаблони', href: '/admin/templates', icon: <MessageSquare size={20} />, section: 'content' },
        { name: 'Дизайн Сайту', href: '/admin/theme-editor', icon: <Palette size={20} />, section: 'content' },
        { name: 'Зарплати', href: '/admin/salary', icon: <Banknote size={20} />, section: 'finance' },
        { name: 'Витрати', href: '/admin/finances/expenses', icon: <TrendingDown size={20} />, section: 'finance' },
        { name: 'Оплати', href: '/admin/settings/finance/banks', icon: <CreditCard size={20} />, section: 'finance' },
        { name: 'Команда', href: '/admin/staff', icon: <Users size={20} />, section: 'settings' },
        { name: 'Ролі', href: '/admin/settings/team/roles', icon: <Shield size={20} />, section: 'settings' },
        { name: 'Фіскалізація', href: '/admin/settings/fiscalization', icon: <Printer size={20} />, section: 'settings' },
        { name: 'Промокоди', href: '/admin/marketing/promocodes', icon: <Tags size={20} />, section: 'marketing' },
        { name: 'Теги', href: '/admin/settings/tags', icon: <Tags size={20} />, section: 'settings' },
    ];

    const filteredItems = menuItems.filter(item => hasPermission(item.section, 'view'));

    // Route Protection: Check if current pathname is allowed
    // Skip protection for dashboard, login, and no-access pages themselves
    useEffect(() => {
        if (!isLoading && pathname !== '/admin' && pathname !== '/admin/login' && pathname !== '/admin/no-access') {
            const currentItem = menuItems.find(item => pathname.startsWith(item.href));
            if (currentItem && !hasPermission(currentItem.section, 'view')) {
                router.push('/admin/no-access');
            }
        }
    }, [pathname, isLoading, hasPermission, router, menuItems]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fcfcfd' }}>
                <Activity className="animate-spin" size={40} color="#3b82f6" />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fcfcfd' }}>
            {/* Sidebar */}
            <aside style={{
                width: '280px',
                backgroundColor: '#1e293b',
                color: 'white',
                padding: '32px 20px',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                height: 'calc(100vh - 40px)',
                left: '20px',
                top: '20px',
                borderRadius: '32px',
                overflowY: 'auto',
                zIndex: 50,
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}>
                <div style={{ marginBottom: '48px', padding: '0 12px', flexShrink: 0 }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.05em' }}>TM ADMIN</span>
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredItems.map((item) => {
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
                                    color: isActive ? 'white' : '#94a3b8',
                                    backgroundColor: isActive ? '#334155' : 'transparent',
                                    textDecoration: 'none',
                                    fontSize: '15px',
                                    transition: 'background-color 0.2s',
                                }}
                            >
                                {item.icon}
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #334155', paddingTop: '24px' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            color: '#94a3b8',
                            backgroundColor: 'transparent',
                            border: 'none',
                            fontSize: '15px',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left'
                        }}
                    >
                        <LogOut size={20} />
                        Вийти
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ marginLeft: '320px', flex: 1, padding: '40px 60px' }}>
                {children}
            </main>
        </div>
    );
}
