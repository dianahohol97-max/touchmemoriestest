'use client';
import { useState, useEffect } from 'react';
import styles from './Navigation.module.css';
import { usePathname } from 'next/navigation';
import { Search, User, ShoppingCart, Menu, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cart-store';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function Navigation() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [otherCategories, setOtherCategories] = useState<any[]>([]);
    const { items: cartItems, openDrawer } = useCartStore();
    const pathname = usePathname();

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
            const mainCategorySlugs = ['photobooks', 'hlyantsevi-zhurnaly', 'travelbooks', 'prints', 'certificates'];
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
        { name: 'Фотокниги', href: '/catalog?category=photobooks' },
        { name: 'Глянцеві журнали', href: '/catalog?category=hlyantsevi-zhurnaly' },
        { name: 'Travelbook', href: '/catalog?category=travelbooks' },
        { name: 'Фотодрук', href: '/catalog?category=prints' },
        { name: 'Сертифікати', href: '/catalog?category=certificates' },
    ];

    const aboutDropdownItems = [
        { name: 'Про нас', href: '/pro-nas' },
        { name: 'Наші контакти', href: '/kontakty' },
        { name: 'Оплата і доставка', href: '/oplata-i-dostavka' },
        { name: 'Блог', href: '/blog' },
    ];

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-20 flex items-center w-full",
                isScrolled ? "bg-white/95 shadow-sm backdrop-blur-md" : "bg-white border-b border-border"
            )}
        >
            <div className="flex justify-between items-center w-full px-10 gap-8">
                <Link href="/" className="font-heading font-extrabold text-xl tracking-[0.15em] text-primary no-underline transition-opacity hover:opacity-90 shrink-0 whitespace-nowrap min-w-fit">
                    TOUCH.MEMORIES
                </Link>

                {/* Desktop Nav */}
                <nav className={cn("desktop-only items-center gap-12 shrink", styles.navFlex)}>
                    <div className="flex gap-10 text-[12px] uppercase tracking-[0.1em] font-bold items-center font-heading">
                        {mainNavLinks.map(link => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={cn(
                                    "text-primary no-underline transition-opacity relative",
                                    pathname === link.href ? "opacity-100" : "opacity-80 hover:opacity-100"
                                )}
                            >
                                {link.name}
                                {pathname === link.href && (
                                    <motion.div
                                        layoutId="nav-underline"
                                        className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-brand"
                                    />
                                )}
                            </Link>
                        ))}

                        {/* Інші товари Dropdown */}
                        {otherCategories.length > 0 && (
                            <div
                                className="relative group h-full flex items-center"
                                onMouseEnter={() => setActiveDropdown('other')}
                                onMouseLeave={() => setActiveDropdown(null)}
                            >
                                <button
                                    className={cn(
                                        "bg-transparent border-none cursor-pointer text-primary text-[12px] uppercase tracking-[0.1em] font-bold flex items-center gap-1.5 transition-opacity font-heading",
                                        activeDropdown === 'other' ? "opacity-100" : "opacity-80"
                                    )}
                                >
                                    Інші товари
                                    <ChevronDown size={14} className={cn("transition-transform duration-200", activeDropdown === 'other' && "rotate-180")} />
                                </button>

                                <AnimatePresence>
                                    {activeDropdown === 'other' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute top-full left-0 mt-6 w-56 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-primary/5 rounded-brand py-3 z-100"
                                        >
                                            <Link
                                                href="/inshi-tovary"
                                                className="block px-6 py-3 text-primary no-underline text-[13px] font-bold tracking-tight transition-colors border-b border-primary/5 hover:bg-primary/5"
                                            >
                                                Всі інші товари
                                            </Link>
                                            {otherCategories.map(category => (
                                                <Link
                                                    key={category.id}
                                                    href={`/catalog?category=${category.slug}`}
                                                    className="block px-6 py-3 text-primary no-underline text-[13px] font-bold tracking-tight transition-colors hover:bg-primary/5"
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
                            className="relative group h-full flex items-center"
                            onMouseEnter={() => setActiveDropdown('about')}
                            onMouseLeave={() => setActiveDropdown(null)}
                        >
                            <button
                                className={cn(
                                    "bg-transparent border-none cursor-pointer text-primary text-[12px] uppercase tracking-[0.1em] font-bold flex items-center gap-1.5 transition-opacity font-heading",
                                    activeDropdown === 'about' ? "opacity-100" : "opacity-80"
                                )}
                            >
                                Про нас
                                <ChevronDown size={14} className={cn("transition-transform duration-200", activeDropdown === 'about' && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                                {activeDropdown === 'about' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute top-full left-0 mt-6 w-56 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-primary/5 rounded-brand py-3 z-100"
                                    >
                                        {aboutDropdownItems.map(item => (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                className="block px-6 py-3 text-primary no-underline text-[13px] font-bold tracking-tight transition-colors hover:bg-primary/5"
                                            >
                                                {item.name}
                                            </Link>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="flex items-center gap-5 text-primary">
                        <button aria-label="Search" className="bg-transparent border-none cursor-pointer text-inherit hover:opacity-70 transition-opacity"><Search size={20} /></button>
                        <UserAuthIcon />
                        <button
                            onClick={openDrawer}
                            className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-inherit hover:opacity-70 transition-opacity p-0"
                        >
                            <ShoppingCart size={20} />
                            <span className="text-[14px] font-bold">({cartItems.length})</span>
                        </button>
                    </div>
                </nav>

                {/* Mobile Nav Toggle */}
                <div className={cn("mobile-only flex items-center gap-5 text-primary", styles.navFlexMobile)}>
                    <UserAuthIcon />
                    <button
                        onClick={openDrawer}
                        className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-inherit p-0"
                    >
                        <ShoppingCart size={22} />
                        <span className="text-[14px] font-bold">({cartItems.length})</span>
                    </button>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        aria-label="Open menu"
                        className="bg-transparent border-none cursor-pointer text-inherit"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'tween', duration: 0.3 }}
                        className="fixed inset-0 z-[100] bg-white flex flex-col"
                    >
                        <div className="container h-20 flex items-center justify-between border-b border-primary/5 px-8">
                            <span className="font-heading font-extrabold text-xl tracking-widest text-primary">
                                МЕНЮ
                            </span>
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="bg-transparent border-none cursor-pointer p-3 text-primary flex items-center"
                                aria-label="Close menu"
                            >
                                <X size={24} strokeWidth={2.5} />
                            </button>
                        </div>
                        <nav className="flex flex-col p-8 gap-1 overflow-y-auto">
                            {[
                                ...mainNavLinks,
                                { name: 'Інші товари', href: '/inshi-tovary' },
                                ...aboutDropdownItems
                            ].map(link => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="py-4 text-base font-bold text-primary no-underline border-b border-primary/5 block"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
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
            <Link href="/account" className="flex items-center">
                {status.avatar ? (
                    <img
                        src={status.avatar}
                        alt="User"
                        className="w-7 h-7 rounded-[3px] object-cover border-1.5 border-border"
                    />
                ) : (
                    <User size={20} />
                )}
            </Link>
        );
    }

    return (
        <Link href="/login" aria-label="User account" className="text-inherit hover:opacity-70 transition-opacity">
            <User size={22} />
        </Link>
    );
}
