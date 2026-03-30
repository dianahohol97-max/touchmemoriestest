'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard, ShoppingBag, List, ShoppingCart,
    User, Users, Settings, LogOut, Factory,
    MessageSquare, FileText, FolderTree, Banknote,
    Tags, Mail, Palette, DollarSign, Bot,
    Package, Folder, Star, CreditCard, Activity,
    TrendingDown, Printer, Shield, Image, Gift, BarChart2, Zap
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

// Define menuItems outside component to avoid recreation on every render
const menuItems = [
    { name: 'Огляд', href: '/admin', icon: <LayoutDashboard size={20} />, section: 'analytics' },
    { name: 'Аналітика', href: '/admin/analytics', icon: <BarChart2 size={20} />, section: 'analytics' },
    { name: 'Товари', href: '/admin/products', icon: <ShoppingBag size={20} />, section: 'catalog' },
    { name: 'Популярні товари', href: '/admin/popular-products', icon: <Star size={20} />, section: 'catalog' },
    { name: 'Категорії', href: '/admin/categories', icon: <List size={20} />, section: 'catalog' },
    { name: 'Подарункові колекції', href: '/admin/gift-collections', icon: <Gift size={20} />, section: 'catalog' },
    { name: 'B2B Ціни', href: '/admin/role-pricing', icon: <DollarSign size={20} />, section: 'catalog' },
    { name: 'Замовлення', href: '/admin/orders', icon: <ShoppingCart size={20} />, section: 'orders' },
    { name: 'Макети клієнтів', href: '/admin/projects', icon: <Folder size={20} />, section: 'orders' },
    { name: 'Сертифікати', href: '/admin/certificates', icon: <Gift size={20} />, section: 'orders' },
    { name: 'Виробництво', href: '/admin/production', icon: <Factory size={20} />, section: 'production' },
    { name: 'Складський облік', href: '/admin/stock', icon: <Package size={20} />, section: 'production' },
    { name: 'Клієнти (CRM)', href: '/admin/clients', icon: <User size={20} />, section: 'customers' },
    { name: 'AI Чат (Inbox)', href: '/admin/social-inbox', icon: <MessageSquare size={20} />, section: 'ai' },
    { name: 'AI Налаштування', href: '/admin/settings/chatbot', icon: <Bot size={20} />, section: 'ai' },
    { name: 'Блог', href: '/admin/blog', icon: <FileText size={20} />, section: 'content' },
    { name: 'Категорії блогу', href: '/admin/blog/categories', icon: <FolderTree size={20} />, section: 'content' },
    { name: 'Відгуки (Stories)', href: '/admin/reviews', icon: <Image size={20} />, section: 'content' },
    { name: 'Шаблони', href: '/admin/templates', icon: <MessageSquare size={20} />, section: 'content' },
    { name: 'Дизайн Сайту', href: '/admin/theme-editor', icon: <Palette size={20} />, section: 'content' },
    { name: 'Платежі', href: '/admin/payments', icon: <CreditCard size={20} />, section: 'finance' },
    { name: 'Витрати', href: '/admin/expenses', icon: <TrendingDown size={20} />, section: 'finance' },
    { name: 'Зарплати', href: '/admin/salary', icon: <Banknote size={20} />, section: 'finance' },
    { name: 'Оплати', href: '/admin/settings/finance/banks', icon: <CreditCard size={20} />, section: 'finance' },
    { name: 'Команда', href: '/admin/team', icon: <Users size={20} />, section: 'settings' },
    { name: 'Ролі та права', href: '/admin/roles', icon: <Shield size={20} />, section: 'settings' },
    { name: 'Фіскалізація', href: '/admin/settings/fiscalization', icon: <Printer size={20} />, section: 'settings' },
    { name: 'Промокоди', href: '/admin/promo', icon: <Tags size={20} />, section: 'marketing' },
    { name: 'Підписники', href: '/admin/subscribers', icon: <Mail size={20} />, section: 'marketing' },
    { name: 'Автоматизації', href: '/admin/automations', icon: <Zap size={20} />, section: 'marketing' },
    { name: 'Теги', href: '/admin/settings/tags', icon: <Tags size={20} />, section: 'settings' },
];

function AdminLayoutContent({ children, handleLogout }: { children: React.ReactNode, handleLogout: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const { hasPermission, isLoading, isAdmin } = usePermissions();
    const filteredItems = isAdmin ? menuItems : menuItems.filter(item => hasPermission(item.section, 'view'));

    // Route Protection: Check if current pathname is allowed
    // Skip protection for dashboard, login, and no-access pages themselves
    useEffect(() => {
        if (!isLoading && pathname !== '/admin' && pathname !== '/admin/login' && pathname !== '/admin/no-access') {
            const currentItem = menuItems.find(item => pathname.startsWith(item.href));
            if (currentItem && !hasPermission(currentItem.section, 'view')) {
                router.push('/admin/no-access');
            }
        }
    }, [pathname, isLoading, hasPermission, router]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fcfcfd' }}>
                <Activity className="animate-spin" size={40} color="#263A99" />
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
                borderRadius: "3px",
                overflowY: 'auto',
                zIndex: 50,
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}>
                <div style={{ marginBottom: '48px', padding: '0 12px', flexShrink: 0 }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.05em' }}>TM ADMIN</span>
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {(() => {
                        const SECTION_LABELS: Record<string, string> = {
                            analytics: 'Аналітика',
                            catalog: 'Каталог',
                            orders: 'Замовлення',
                            production: 'Виробництво',
                            customers: 'Клієнти',
                            ai: 'AI',
                            content: 'Контент',
                            finance: 'Фінанси',
                            marketing: 'Маркетинг',
                            settings: 'Налаштування',
                        };
                        let lastSection = '';
                        return filteredItems.map((item) => {
                            const isActive = pathname === item.href;
                            const showHeader = item.section !== lastSection;
                            if (showHeader) lastSection = item.section;
                            return (
                                <div key={item.href}>
                                    {showHeader && (
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '16px 16px 6px' }}>
                                            {SECTION_LABELS[item.section] || item.section}
                                        </div>
                                    )}
                                    <Link
                                        href={item.href}
                                        className={`admin-nav-item ${isActive ? 'active' : ''}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '9px 16px',
                                            borderRadius: "3px",
                                            color: isActive ? 'white' : '#94a3b8',
                                            backgroundColor: isActive ? '#263A99' : 'transparent',
                                            textDecoration: 'none',
                                            fontSize: '14px',
                                        }}
                                    >
                                        {item.icon}
                                        {item.name}
                                    </Link>
                                </div>
                            );
                        });
                    })()}
                </nav>

                <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderRadius: "3px",
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
            <main style={{ marginLeft: '320px', flex: 1, padding: '40px 60px', overflowY: 'auto', height: '100vh' }}>
                {children}
            </main>
        </div>
    );
}
