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
    TrendingDown, Printer, Shield, Image, Gift, BarChart2, Zap,
    Menu, X, LayoutTemplate, UserPlus, Eye, Globe, Truck, Building2, Target,
    Home, MoreHorizontal, ChevronDown, Handshake, CalendarDays, Recycle
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

/**
 * The sidebar has two independent groupings, and mixing them up is what made
 * this menu unreadable.
 *
 *   section — the PERMISSION key. Roles are granted rights per section, so
 *             these values must never be renamed or reassigned to "tidy up":
 *             moving «Фотографи» out of 'catalog' would silently revoke it for
 *             everyone whose role allows catalog.
 *   group   — what the person actually looks for. Purely visual, safe to
 *             rearrange, and grouped by the job to be done rather than by the
 *             permission that happens to guard it.
 *
 * That is why «Фотографи» sits visually under «Клієнти та партнери» while
 * keeping section 'catalog'.
 */
const GROUPS: { key: string; label: string }[] = [
    { key: 'daily', label: 'Щодня' },
    { key: 'catalog', label: 'Каталог' },
    { key: 'partners', label: 'Клієнти та партнери' },
    { key: 'sales', label: 'Продажі' },
    { key: 'marketing', label: 'Маркетинг і листи' },
    { key: 'content', label: 'Контент сайту' },
    { key: 'finance', label: 'Фінанси' },
    { key: 'settings', label: 'Налаштування' },
];

// Define menuItems outside component to avoid recreation on every render
const menuItems = [
    // Щодня — те, що відкривають щоранку
    { name: 'Огляд', href: '/admin', icon: <LayoutDashboard size={20} />, section: 'analytics', group: 'daily' },
    { name: 'Замовлення', href: '/admin/orders', icon: <ShoppingCart size={20} />, section: 'orders', group: 'daily' },
    { name: 'Виробництво', href: '/admin/production', icon: <Factory size={20} />, section: 'production', group: 'daily' },
    { name: 'Кабінет дизайнера', href: '/admin/designer', icon: <Palette size={20} />, section: 'designer', group: 'daily' },
    // «Макети клієнтів» прихована з меню (Діана, 2026-08-06): дані в
    // photobook_projects не оновлюються з березня — макети клієнтів давно
    // течуть через чернетки замовлень, і сторінка показує лише старе.
    // /admin/projects працює за прямим посиланням; повернути — розкоментувати.
    // { name: 'Макети клієнтів', href: '/admin/projects', icon: <Folder size={20} />, section: 'orders', group: 'daily' },
    { name: 'Кадрування (друк)', href: '/admin/kadruvannya', icon: <LayoutTemplate size={20} />, section: 'production', group: 'daily' },
    { name: 'Аналітика', href: '/admin/analytics', icon: <BarChart2 size={20} />, section: 'analytics', group: 'daily' },

    // Каталог — усе, що продаємо
    { name: 'Товари', href: '/admin/products', icon: <ShoppingBag size={20} />, section: 'catalog', group: 'catalog' },
    { name: 'Категорії', href: '/admin/categories', icon: <List size={20} />, section: 'catalog', group: 'catalog' },
    { name: 'Популярні товари', href: '/admin/popular-products', icon: <Star size={20} />, section: 'catalog', group: 'catalog' },
    { name: 'Подарункові колекції', href: '/admin/gift-collections', icon: <Gift size={20} />, section: 'catalog', group: 'catalog' },
    { name: 'Сертифікати', href: '/admin/certificates', icon: <CreditCard size={20} />, section: 'orders', group: 'catalog' },
    { name: 'Кольори велюру', href: '/admin/velour-colors', icon: <Palette size={20} />, section: 'catalog', group: 'catalog' },
    { name: 'Складський облік', href: '/admin/stock', icon: <Package size={20} />, section: 'production', group: 'catalog' },
    { name: 'Календар виробництва', href: '/admin/production-calendar', icon: <CalendarDays size={20} />, section: 'production', group: 'catalog' },
    { name: 'Важливо', href: '/admin/reprints', icon: <Recycle size={20} />, section: 'production', group: 'catalog' },
    { name: 'Звірка з KeyCRM', href: '/admin/keycrm-catalogue', icon: <Handshake size={20} />, section: 'catalog', group: 'catalog' },

    // Клієнти та партнери — люди, а не товари
    { name: 'Клієнти (CRM)', href: '/admin/clients', icon: <User size={20} />, section: 'customers', group: 'partners' },
    { name: 'Фотографи', href: '/admin/photographers', icon: <Image size={20} />, section: 'catalog', group: 'partners' },
    { name: 'Тревел-партнери', href: '/admin/agency-partners', icon: <Globe size={20} />, section: 'catalog', group: 'partners' },
    { name: 'Заявки B2B', href: '/admin/b2b-applications', icon: <UserPlus size={20} />, section: 'catalog', group: 'partners' },
    { name: 'Корпоративні запити', href: '/admin/corporate-requests', icon: <Building2 size={20} />, section: 'catalog', group: 'partners' },
    // «B2B Ціни» (role-pricing) прихована з меню на прохання Діани (2026-08-06).
    // Сторінка /admin/role-pricing лишається робочою за прямим посиланням —
    // повернути пункт можна, розкоментувавши рядок нижче.
    // { name: 'B2B Ціни', href: '/admin/role-pricing', icon: <DollarSign size={20} />, section: 'catalog', group: 'partners' },

    // Продажі — пошук нових партнерів і люди, які цим займаються
    { name: 'Продажі: дашборд', href: '/admin/sales-dashboard', icon: <BarChart2 size={20} />, section: 'marketing', group: 'sales' },
    { name: 'Мій кабінет продажів', href: '/admin/my-sales', icon: <Banknote size={20} />, section: 'marketing', group: 'sales' },
    { name: 'Ліди (B2B)', href: '/admin/leads', icon: <Target size={20} />, section: 'marketing', group: 'sales' },
    { name: 'Менеджери з продажів', href: '/admin/sales-managers', icon: <Users size={20} />, section: 'marketing', group: 'sales' },
    { name: 'Оформлення партнерів', href: '/admin/partner-requests', icon: <Handshake size={20} />, section: 'marketing', group: 'sales' },
    { name: 'Промокоди', href: '/admin/promo', icon: <Tags size={20} />, section: 'marketing', group: 'sales' },
    { name: 'Імпорт клієнтів', href: '/admin/marketing/crm-import', icon: <UserPlus size={20} />, section: 'marketing', group: 'sales' },
    { name: 'Контакти зі старої CRM', href: '/admin/marketing/crm-contacts', icon: <Users size={20} />, section: 'marketing', group: 'sales' },

    // Маркетинг і листи
    { name: 'Підписники', href: '/admin/subscribers', icon: <Mail size={20} />, section: 'marketing', group: 'marketing' },
    { name: 'Автоматизації', href: '/admin/automations', icon: <Zap size={20} />, section: 'marketing', group: 'marketing' },
    { name: 'Листи: редагувати', href: '/admin/email-automations', icon: <FileText size={20} />, section: 'marketing', group: 'marketing' },
    { name: 'Листи: перегляд', href: '/admin/email-previews', icon: <Eye size={20} />, section: 'marketing', group: 'marketing' },
    { name: 'AI Чат (Inbox)', href: '/admin/social-inbox', icon: <MessageSquare size={20} />, section: 'ai', group: 'marketing' },
    { name: 'AI Налаштування', href: '/admin/settings/chatbot', icon: <Bot size={20} />, section: 'ai', group: 'marketing' },

    // Контент сайту
    { name: 'Управління контентом', href: '/admin/content', icon: <LayoutTemplate size={20} />, section: 'content', group: 'content' },
    { name: 'Дизайн сайту', href: '/admin/theme-editor', icon: <Palette size={20} />, section: 'content', group: 'content' },
    { name: 'Блог', href: '/admin/blog', icon: <FileText size={20} />, section: 'content', group: 'content' },
    { name: 'Категорії блогу', href: '/admin/blog/categories', icon: <FolderTree size={20} />, section: 'content', group: 'content' },
    { name: 'SEO-лендінги', href: '/admin/landing-pages', icon: <Globe size={20} />, section: 'content', group: 'content' },
    { name: 'Відгуки (Stories)', href: '/admin/reviews', icon: <Star size={20} />, section: 'content', group: 'content' },
    { name: 'Шаблони', href: '/admin/templates', icon: <MessageSquare size={20} />, section: 'content', group: 'content' },

    // Фінанси
    { name: 'Платежі', href: '/admin/payments', icon: <CreditCard size={20} />, section: 'finance', group: 'finance' },
    { name: 'Витрати', href: '/admin/expenses', icon: <TrendingDown size={20} />, section: 'finance', group: 'finance' },
    { name: 'Зарплати', href: '/admin/salary', icon: <Banknote size={20} />, section: 'finance', group: 'finance' },
    { name: 'Рахунки для оплат', href: '/admin/settings/finance/banks', icon: <Banknote size={20} />, section: 'finance', group: 'finance' },

    // Налаштування
    { name: 'Команда', href: '/admin/team', icon: <Users size={20} />, section: 'settings', group: 'settings' },
    { name: 'Ролі та права', href: '/admin/roles', icon: <Shield size={20} />, section: 'settings', group: 'settings' },
    { name: 'Фіскалізація', href: '/admin/settings/fiscalization', icon: <Printer size={20} />, section: 'settings', group: 'settings' },
    { name: 'Нова Пошта', href: '/admin/settings/delivery/nova-poshta', icon: <Truck size={20} />, section: 'settings', group: 'settings' },
    { name: 'Міжнародна доставка', href: '/admin/settings/delivery/international', icon: <Globe size={20} />, section: 'settings', group: 'settings' },
    { name: 'Теги', href: '/admin/settings/tags', icon: <Tags size={20} />, section: 'settings', group: 'settings' },
];

function AdminLayoutContent({ children, handleLogout }: { children: React.ReactNode, handleLogout: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const { hasPermission, isLoading, isAdmin } = usePermissions();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    // Show all items while loading or when admin — never show empty menu
    const permitted = (isLoading || isAdmin) ? menuItems : menuItems.filter(item => hasPermission(item.section, 'view'));
    const q = query.trim().toLowerCase();
    const filteredItems = q ? permitted.filter(i => i.name.toLowerCase().includes(q)) : permitted;

    // Remember which groups are folded away between visits.
    useEffect(() => {
        try {
            const saved = localStorage.getItem('tm-admin-nav-collapsed');
            if (saved) setCollapsed(JSON.parse(saved));
        } catch { /* private mode, or a corrupted value — start expanded */ }
    }, []);
    const toggleGroup = (key: string) => {
        setCollapsed(prev => {
            const next = { ...prev, [key]: !prev[key] };
            try { localStorage.setItem('tm-admin-nav-collapsed', JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };

    // Close mobile menu on route change
    useEffect(() => { setMobileOpen(false); }, [pathname]);

    // Route Protection.
    //
    // The match must be the LONGEST matching href, not the first: every admin
    // path starts with '/admin', so a plain .find() always returned the «Огляд»
    // row and every page was guarded by the analytics permission instead of its
    // own.
    useEffect(() => {
        if (!isLoading && pathname !== '/admin' && pathname !== '/admin/login' && pathname !== '/admin/no-access') {
            const currentItem = menuItems
                .filter(item => pathname === item.href || pathname.startsWith(`${item.href}/`))
                .sort((a, b) => b.href.length - a.href.length)[0];
            if (currentItem && !hasPermission(currentItem.section, 'view')) {
                router.push('/admin/no-access');
            }
        }
    }, [pathname, isLoading, hasPermission, router]);

    if (isLoading && false) { // disabled — never block rendering
        return (
            <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fcfcfd' }}>
                <Activity className="animate-spin" size={40} color="#263A99" />
            </div>
        );
    }

    // A plain JSX value, NOT a component: declaring a component inside the
    // render remounts it on every keystroke, which would blur the search box
    // after each character.
    const sidebarContent = (
            <>
                {/* Forty-plus destinations are faster to type than to scan. */}
                <div style={{ marginBottom: 10, flexShrink: 0 }}>
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Пошук у меню…"
                        style={{
                            width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                            borderRadius: 6, border: '1px solid rgba(255,255,255,0.14)',
                            background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: 13.5,
                            outline: 'none',
                        }}
                    />
                </div>
                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {GROUPS.map(group => {
                        const items = filteredItems.filter(i => i.group === group.key);
                        if (items.length === 0) return null;
                        // A search shows everything it found; the group a person
                        // is currently working in never hides itself either.
                        const hasActive = items.some(i => pathname === i.href || pathname.startsWith(`${i.href}/`));
                        const open = Boolean(q) || hasActive || !collapsed[group.key];
                        return (
                            <div key={group.key}>
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: '10px', fontWeight: 700, color: '#64748b',
                                        textTransform: 'uppercase', letterSpacing: '0.08em',
                                        padding: '16px 16px 6px', textAlign: 'left',
                                    }}
                                >
                                    <ChevronDown
                                        size={12}
                                        style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }}
                                    />
                                    {group.label}
                                    {!open && <span style={{ marginLeft: 'auto', opacity: .7 }}>{items.length}</span>}
                                </button>
                                {open && items.map(item => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`admin-nav-item ${isActive ? 'active' : ''}`}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '9px 16px', borderRadius: '3px',
                                                color: isActive ? 'white' : '#94a3b8',
                                                backgroundColor: isActive ? '#263A99' : 'transparent',
                                                textDecoration: 'none', fontSize: '14px',
                                            }}
                                        >
                                            {item.icon}
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div style={{ padding: '16px', color: '#64748b', fontSize: 13 }}>Нічого не знайшлося</div>
                    )}
                </nav>
                <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
                    <button onClick={handleLogout} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', borderRadius: '3px', color: '#94a3b8',
                        backgroundColor: 'transparent', border: 'none', fontSize: '15px',
                        cursor: 'pointer', width: '100%', textAlign: 'left'
                    }}>
                        <LogOut size={20} />
                        Вийти
                    </button>
                </div>
            </>
    );

    return (
        <>
            {/*  Mobile top bar  */}
            <div style={{
                display: 'none',
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                backgroundColor: '#1e293b', height: '56px',
                alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }} className="tm-admin-topbar">
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '0.06em' }}>TM ADMIN</span>
                <button
                    onClick={() => setMobileOpen(v => !v)}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', display: 'flex' }}
                >
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/*  Mobile overlay  */}
            {mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    style={{
                        display: 'none', position: 'fixed', inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 101,
                    }}
                    className="tm-admin-overlay"
                />
            )}

            {/*  Desktop + Mobile sidebar  */}
            <aside
                className={`tm-admin-sidebar${mobileOpen ? ' tm-admin-sidebar--open' : ''}`}
                style={{
                    width: '280px', backgroundColor: '#1e293b', color: 'white',
                    padding: '32px 20px', display: 'flex', flexDirection: 'column',
                    position: 'fixed', height: 'calc(100vh - 40px)',
                    left: '20px', top: '20px', borderRadius: '3px',
                    overflowY: 'auto', zIndex: 102,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                }}
            >
                {/* Desktop title */}
                <div style={{ marginBottom: '48px', padding: '0 12px', flexShrink: 0 }} className="tm-admin-sidebar-title">
                    <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.05em' }}>TM ADMIN</span>
                </div>

                {sidebarContent}
            </aside>

            {/*  Main content  */}
            <main className="tm-admin-main tm-admin-content" style={{
                marginLeft: '320px', flex: 1,
                padding: '40px 60px', overflowY: 'auto', height: '100vh',
            }}>
                {children}
            </main>

            {/*  Mobile bottom tab bar — the 5 most-used destinations, one tap
                 each. This is the main mobile-usability win: the most common
                 work (orders, dashboard, production, designer) no longer
                 requires opening the burger menu and scrolling a 45-item list.
                 Gated by permission so each role only sees what they can use;
                 the last tab opens the full menu. Hidden on desktop. */}
            {(() => {
                const tabs = [
                    { name: 'Огляд', href: '/admin', icon: <Home size={22} />, section: 'analytics' },
                    { name: 'Замовлення', href: '/admin/orders', icon: <ShoppingCart size={22} />, section: 'orders' },
                    { name: 'Виробництво', href: '/admin/production', icon: <Factory size={22} />, section: 'production' },
                    { name: 'Дизайн', href: '/admin/designer', icon: <Palette size={22} />, section: 'designer' },
                ].filter(t => (isLoading || isAdmin) ? true : hasPermission(t.section, 'view'));
                return (
                    <nav className="tm-admin-bottomnav" style={{
                        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
                        zIndex: 100, backgroundColor: '#fff', borderTop: '1px solid #e2e8f0',
                        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
                        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    }}>
                        {tabs.map(tab => {
                            const isActive = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
                            return (
                                <Link key={tab.href} href={tab.href} style={{
                                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', gap: '3px', textDecoration: 'none',
                                    color: isActive ? '#263A99' : '#94a3b8', fontSize: '10px', fontWeight: 700,
                                    paddingTop: '8px',
                                }}>
                                    {tab.icon}
                                    <span>{tab.name}</span>
                                </Link>
                            );
                        })}
                        <button onClick={() => setMobileOpen(true)} style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', gap: '3px', background: 'none', border: 'none',
                            color: '#94a3b8', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                            paddingTop: '8px',
                        }}>
                            <MoreHorizontal size={22} />
                            <span>Меню</span>
                        </button>
                    </nav>
                );
            })()}

            {/*  Responsive styles  */}
            <style>{`
                @media (max-width: 768px) {
                    /* Any wide table scrolls inside its card instead of
                       stretching the whole page sideways. */
                    .tm-admin-content table {
                        display: block;
                        overflow-x: auto;
                        -webkit-overflow-scrolling: touch;
                        max-width: 100%;
                    }
                    /* Nothing inside the admin can widen the page. */
                    .tm-admin-content {
                        overflow-x: clip;
                    }
                }
                @media (max-width: 768px) {
                    .tm-admin-topbar { display: flex !important; }
                    .tm-admin-overlay { display: block !important; }
                    .tm-admin-bottomnav { display: flex !important; }

                    .tm-admin-sidebar {
                        left: 0 !important;
                        top: 0 !important;
                        height: 100vh !important;
                        border-radius: 0 !important;
                        transform: translateX(-100%);
                        transition: transform 0.25s ease;
                        padding-top: 72px !important;
                        z-index: 102;
                    }
                    .tm-admin-sidebar--open {
                        transform: translateX(0) !important;
                    }
                    .tm-admin-sidebar-title { display: none !important; }

                    .tm-admin-main {
                        margin-left: 0 !important;
                        padding: 72px 16px calc(76px + env(safe-area-inset-bottom, 0px)) !important;
                        height: auto !important;
                        min-height: 100vh;
                    }
                }

                @media (min-width: 769px) and (max-width: 1024px) {
                    .tm-admin-sidebar {
                        width: 240px !important;
                    }
                    .tm-admin-main {
                        margin-left: 280px !important;
                        padding: 32px 32px !important;
                    }
                }
            `}</style>
        </>
    );
}
