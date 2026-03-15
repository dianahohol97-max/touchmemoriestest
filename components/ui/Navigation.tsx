'use client';
import { useState, useEffect } from 'react';
import styles from './Navigation.module.css';
import { Search, User, ShoppingCart, Menu, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cart-store';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function Navigation() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [otherCategories, setOtherCategories] = useState<any[]>([]);
    const { items: cartItems, openDrawer } = useCartStore();

    const supabase = createClient();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        async function fetchOtherCategories() {
            const mainCategorySlugs = ['magazines', 'photobooks', 'travelbooks', 'certificates'];
            const { data } = await supabase
                .from('categories')
                .select('*')
                .eq('is_active', true)
                .not('slug', 'in', `(${mainCategorySlugs.join(',')})`)
                .order('sort_order', { ascending: true });

            if (data) {
                setOtherCategories(data);
            }
        }
        fetchOtherCategories();
    }, []);

    const mainNavLinks = [
        { name: 'Глянцевий журнал', href: '/hliantsevyi-zhurnal' },
        { name: 'Фотокниги', href: '/photobooks' },
        { name: 'Travel book', href: '/travelbook' },
        { name: 'Сертифікати', href: '/sertyfikaty' },
    ];

    const aboutDropdownItems = [
        { name: 'Про нас', href: '/pro-nas' },
        { name: 'Наші контакти', href: '/kontakty' },
        { name: 'Оплата і доставка', href: '/oplata-i-dostavka' },
        { name: 'Блог', href: '/blog' },
    ];

    return (
        <>
            <header
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    transition: 'background-color 0.3s, box-shadow 0.3s',
                    backgroundColor: isScrolled ? 'rgba(255, 255, 255, 0.95)' : 'white',
                    boxShadow: isScrolled ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    backdropFilter: isScrolled ? 'blur(10px)' : 'none',
                    height: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: isScrolled ? 'none' : '1px solid var(--border)',
                    width: '100%',
                    padding: 0,
                    margin: 0
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 40px' }}>
                    <Link href="/" style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 800,
                        fontSize: '1.25rem',
                        letterSpacing: '0.05em',
                        color: 'var(--primary)',
                        textDecoration: 'none'
                    }}>
                        TOUCH.MEMORIES
                    </Link>

                    {/* Desktop Nav */}
                    <nav style={{ alignItems: 'center', gap: '40px' }} className={`desktop-only ${styles.navFlex}`}>
                        <div style={{
                            display: 'flex',
                            gap: '24px',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            fontWeight: 700,
                            alignItems: 'center'
                        }}>
                            {mainNavLinks.map(link => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    style={{ color: 'var(--primary)', textDecoration: 'none', opacity: 0.8, transition: 'opacity 0.2s' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                                >
                                    {link.name}
                                </Link>
                            ))}

                            {/* Інші товари Dropdown */}
                            {otherCategories.length > 0 && (
                                <div
                                    style={{ position: 'relative' }}
                                    onMouseEnter={() => setActiveDropdown('other')}
                                    onMouseLeave={() => setActiveDropdown(null)}
                                >
                                    <button
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--primary)',
                                            fontSize: '11px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            fontWeight: 700,
                                            opacity: 0.8,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            transition: 'opacity 0.2s',
                                            padding: 0
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={(e) => (e.currentTarget.style.opacity = activeDropdown === 'other' ? '1' : '0.8')}
                                    >
                                        Інші товари
                                        <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: activeDropdown === 'other' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                    </button>

                                    <AnimatePresence>
                                        {activeDropdown === 'other' && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.2 }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    marginTop: '20px',
                                                    backgroundColor: 'white',
                                                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                                    borderRadius: '8px',
                                                    minWidth: '200px',
                                                    padding: '8px 0',
                                                    zIndex: 100
                                                }}
                                            >
                                                <Link
                                                    key="inshi-tovary-main"
                                                    href="/inshi-tovary"
                                                    style={{
                                                        display: 'block',
                                                        padding: '12px 20px',
                                                        color: 'var(--primary)',
                                                        textDecoration: 'none',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        textTransform: 'none',
                                                        letterSpacing: '0.02em',
                                                        transition: 'background-color 0.2s',
                                                        borderBottom: '1px solid #f0f0f0'
                                                    }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                >
                                                    Всі інші товари
                                                </Link>
                                                {otherCategories.map(category => (
                                                    <Link
                                                        key={category.id}
                                                        href={`/catalog?category=${category.slug}`}
                                                        style={{
                                                            display: 'block',
                                                            padding: '12px 20px',
                                                            color: 'var(--primary)',
                                                            textDecoration: 'none',
                                                            fontSize: '13px',
                                                            fontWeight: 600,
                                                            textTransform: 'none',
                                                            letterSpacing: '0.02em',
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                    >
                                                        {category.name}
                                                    </Link>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Про нас Dropdown */}
                            <div
                                style={{ position: 'relative' }}
                                onMouseEnter={() => setActiveDropdown('about')}
                                onMouseLeave={() => setActiveDropdown(null)}
                            >
                                <button
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--primary)',
                                        fontSize: '11px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        fontWeight: 700,
                                        opacity: 0.8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'opacity 0.2s',
                                        padding: 0
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = activeDropdown === 'about' ? '1' : '0.8')}
                                >
                                    Про нас
                                    <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: activeDropdown === 'about' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                </button>

                                <AnimatePresence>
                                    {activeDropdown === 'about' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.2 }}
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                marginTop: '20px',
                                                backgroundColor: 'white',
                                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                                borderRadius: '8px',
                                                minWidth: '200px',
                                                padding: '8px 0',
                                                zIndex: 100
                                            }}
                                        >
                                            {aboutDropdownItems.map(item => (
                                                <Link
                                                    key={item.name}
                                                    href={item.href}
                                                    style={{
                                                        display: 'block',
                                                        padding: '12px 20px',
                                                        color: 'var(--primary)',
                                                        textDecoration: 'none',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        textTransform: 'none',
                                                        letterSpacing: '0.02em',
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                >
                                                    {item.name}
                                                </Link>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', color: 'var(--primary)' }}>
                            <button aria-label="Search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><Search size={20} /></button>
                            <UserAuthIcon />
                            <button
                                onClick={openDrawer}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                            >
                                <ShoppingCart size={20} />
                                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>({cartItems.length})</span>
                            </button>
                        </div>
                    </nav>

                    {/* Mobile Nav Toggle */}
                    <div className={`mobile-only ${styles.navFlexMobile}`} style={{ alignItems: 'center', gap: '20px', color: 'var(--primary)' }}>
                        <UserAuthIcon />
                        <button
                            onClick={openDrawer}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                        >
                            <ShoppingCart size={22} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>({cartItems.length})</span>
                        </button>
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            aria-label="Open menu"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                        >
                            <Menu size={24} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'tween', duration: 0.3 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 100,
                            backgroundColor: 'white',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div className="container" style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>
                                МЕНЮ
                            </span>
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
                                aria-label="Close menu"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <nav style={{ display: 'flex', flexDirection: 'column', padding: '30px 20px', gap: '2px', overflowY: 'auto' }}>
                            {[
                                ...mainNavLinks,
                                { name: 'Інші товари', href: '/inshi-tovary' },
                                ...aboutDropdownItems
                            ].map(link => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    style={{
                                        padding: '16px 0',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: 'var(--primary)',
                                        textDecoration: 'none',
                                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                                        display: 'block'
                                    }}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

        </>
    );
}

function UserAuthIcon() {
    const supabase = createClient();
    const [status, setStatus] = useState<any>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setStatus({
                    avatar: session.user.user_metadata.avatar_url || session.user.user_metadata.picture,
                    isLoggedIn: true
                });
            } else {
                setStatus({ isLoggedIn: false });
            }
        };
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setStatus({
                    avatar: session.user.user_metadata.avatar_url || session.user.user_metadata.picture,
                    isLoggedIn: true
                });
            } else {
                setStatus({ isLoggedIn: false });
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    if (status?.isLoggedIn) {
        return (
            <Link href="/account" style={{ display: 'flex', alignItems: 'center' }}>
                {status.avatar ? (
                    <img
                        src={status.avatar}
                        alt="User"
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #e2e8f0' }}
                    />
                ) : (
                    <User size={20} />
                )}
            </Link>
        );
    }

    return (
        <Link href="/login" aria-label="User account" style={{ color: 'inherit' }}>
            <User size={22} />
        </Link>
    );
}
