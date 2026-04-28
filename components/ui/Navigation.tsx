'use client';
import { useState, useEffect, useRef } from 'react';
import styles from './Navigation.module.css';
import { usePathname } from 'next/navigation';
import { Search, User, ShoppingCart, Menu, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cart-store';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useT, useTranslation } from '@/lib/i18n/context';
import { LanguageSwitcher } from './LanguageSwitcher';

// ─── Module-level cache so re-renders don't re-fetch ──────────────────────────
let _navCache: { links: any[]; categories: any[] } | null = null;
let _navCacheAt = 0;
const NAV_TTL = 5 * 60 * 1000; // 5 min

async function fetchNavData() {
  if (_navCache && Date.now() - _navCacheAt < NAV_TTL) return _navCache;
  try {
    const res = await fetch('/api/navigation', { cache: 'force-cache' });
    if (!res.ok) throw new Error('nav fetch failed');
    _navCache = await res.json();
    _navCacheAt = Date.now();
    return _navCache!;
  } catch {
    return { links: [], categories: [] };
  }
}

// Slugs already in the main nav — exclude from "Інші товари"
const MAIN_CAT_SLUGS = new Set([
  'photomagnets','certificates','posters','calendars',
  'guestbooks','puzzles','graduation-books',
]);

export function Navigation() {
  const t = useT();
  const { locale } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [navLinks, setNavLinks] = useState<any[]>([]);
  const [otherCategories, setOtherCategories] = useState<any[]>([]);
  const { items: cartItems, openDrawer } = useCartStore();
  const pathname = usePathname();
  const supabase = createClient();

  // Scroll listener
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Single cached fetch for all nav data
  useEffect(() => {
    fetchNavData().then(({ links, categories }) => {
      const fallback = [
        { id: '1', link_text: t('nav.photobooks'), link_url: '/catalog?category=photobooks', translations: {}, children: [] },
        { id: '2', link_text: t('nav.magazines'),  link_url: '/catalog?category=hlyantsevi-zhurnaly', translations: {}, children: [] },
        { id: '3', link_text: 'Travelbook',        link_url: '/catalog?category=travelbooks', translations: {}, children: [] },
        { id: '4', link_text: t('nav.prints'),     link_url: '/catalog?category=prints', translations: {}, children: [] },
      ];

      const localize = (item: any) =>
        item.translations?.[locale]?.text || item.link_text;

      setNavLinks(
        (links.length > 0 ? links : fallback).map((l: any) => ({
          id: l.id, name: localize(l), href: l.link_url,
          children: (l.children || []).map((c: any) => ({ name: localize(c), href: c.link_url })),
        }))
      );

      setOtherCategories(
        categories
          .filter((c: any) => !MAIN_CAT_SLUGS.has(c.slug))
          .map((c: any) => ({ ...c, localName: (c.translations?.[locale]?.name) || c.name }))
      );
    });
  }, [locale]);

  // Debounced search — only fires when search is open
  useEffect(() => {
    if (!searchOpen || searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from('products')
        .select('id, name, slug, price, price_from, short_description, images')
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,short_description.ilike.%${searchQuery}%`)
        .limit(8);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen]);

  // Escape to close search
  useEffect(() => {
    if (!searchOpen) { document.body.style.overflow = ''; return; }
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [searchOpen]);

  const aboutItems = [
    { name: t('footer.about'), href: '/pro-nas' },
    { name: t('nav.contacts'),  href: '/kontakty' },
    { name: t('footer.delivery'), href: '/oplata-i-dostavka' },
    { name: t('nav.blog'),     href: '/blog' },
  ];

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-20 flex items-center w-full',
      isScrolled ? 'bg-white/95 shadow-sm backdrop-blur-md' : 'bg-white border-b border-border'
    )}>
      <div className="flex justify-between items-center w-full px-4 gap-4">
        <Link href="/" className="font-heading font-extrabold text-[17px] tracking-[0.08em] text-primary no-underline transition-opacity hover:opacity-90 shrink-0 whitespace-nowrap min-w-fit">
          TOUCH.MEMORIES
        </Link>

        {/* Desktop Nav */}
        <nav className={cn('desktop-only items-center gap-12 shrink', styles.navFlex)}>
          <div className="flex gap-3 text-[11px] uppercase tracking-[0.06em] font-bold items-center font-heading">
            {navLinks.map(link => {
              if (link.children?.length > 0) {
                return (
                  <div key={link.id} className="relative group h-full flex items-center"
                    onMouseEnter={() => setActiveDropdown(link.id)}
                    onMouseLeave={() => setActiveDropdown(null)}>
                    <button className={cn(
                      'bg-transparent border-none cursor-pointer text-primary text-[12px] uppercase tracking-[0.1em] font-bold flex items-center gap-1.5 transition-opacity font-heading whitespace-nowrap',
                      activeDropdown === link.id ? 'opacity-100' : 'opacity-80'
                    )}>
                      {link.name}
                      <ChevronDown size={14} className={cn('transition-transform duration-200', activeDropdown === link.id && 'rotate-180')} />
                    </button>
                    <AnimatePresence>
                      {activeDropdown === link.id && (
                        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:0.2 }}
                          className="absolute top-full left-0 mt-6 w-56 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-primary/5 rounded-brand py-3 z-100">
                          {link.children.map((child: any) => (
                            <Link key={child.href} href={child.href}
                              className="block px-6 py-3 text-primary no-underline text-[13px] font-bold tracking-tight transition-colors hover:bg-primary/5">
                              {child.name}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }
              return (
                <Link key={link.id} href={link.href}
                  className={cn('text-primary no-underline transition-opacity relative whitespace-nowrap',
                    pathname === link.href ? 'opacity-100' : 'opacity-80 hover:opacity-100')}>
                  {link.name}
                  {pathname === link.href && (
                    <motion.div layoutId="nav-underline"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-brand" />
                  )}
                </Link>
              );
            })}

            {/* Інші товари */}
            {otherCategories.length > 0 && (
              <div className="relative group h-full flex items-center"
                onMouseEnter={() => setActiveDropdown('other')}
                onMouseLeave={() => setActiveDropdown(null)}>
                <button className={cn(
                  'bg-transparent border-none cursor-pointer text-primary text-[12px] uppercase tracking-[0.1em] font-bold flex items-center gap-1.5 transition-opacity font-heading whitespace-nowrap',
                  activeDropdown === 'other' ? 'opacity-100' : 'opacity-80'
                )}>
                  {t('nav.other')}
                  <ChevronDown size={14} className={cn('transition-transform duration-200', activeDropdown === 'other' && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {activeDropdown === 'other' && (
                    <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:0.2 }}
                      className="absolute top-full left-0 mt-6 w-56 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-primary/5 rounded-brand py-3 z-100">
                      {otherCategories.map((cat: any) => (
                        <Link key={cat.id} href={`/catalog?category=${cat.slug}`}
                          className="block px-6 py-3 text-primary no-underline text-[13px] font-bold tracking-tight transition-colors hover:bg-primary/5">
                          {cat.localName}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Про нас */}
            <div className="relative group h-full flex items-center"
              onMouseEnter={() => setActiveDropdown('about')}
              onMouseLeave={() => setActiveDropdown(null)}>
              <button className={cn(
                'bg-transparent border-none cursor-pointer text-primary text-[12px] uppercase tracking-[0.1em] font-bold flex items-center gap-1.5 transition-opacity font-heading whitespace-nowrap',
                activeDropdown === 'about' ? 'opacity-100' : 'opacity-80'
              )}>
                {t('footer.about')}
                <ChevronDown size={14} className={cn('transition-transform duration-200', activeDropdown === 'about' && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {activeDropdown === 'about' && (
                  <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:0.2 }}
                    className="absolute top-full left-0 mt-6 w-56 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-primary/5 rounded-brand py-3 z-100">
                    {aboutItems.map(item => (
                      <Link key={item.href} href={item.href}
                        className="block px-6 py-3 text-primary no-underline text-[13px] font-bold tracking-tight transition-colors hover:bg-primary/5">
                        {item.name}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-3 text-primary">
            <button onClick={() => setSearchOpen(true)} aria-label="Search"
              className="bg-transparent border-none cursor-pointer text-inherit hover:opacity-70 transition-opacity">
              <Search size={20} />
            </button>
            <UserAuthIcon />
            <LanguageSwitcher />
            <button onClick={openDrawer}
              className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-inherit hover:opacity-70 transition-opacity p-0">
              <ShoppingCart size={20} />
              <span className="text-[14px] font-bold">({cartItems.length})</span>
            </button>
          </div>
        </nav>

        {/* Mobile */}
        <div className={cn('mobile-only flex items-center gap-5 text-primary', styles.navFlexMobile)}>
          <UserAuthIcon />
          <button onClick={openDrawer} className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-inherit p-0">
            <ShoppingCart size={22} />
            <span className="text-[14px] font-bold">({cartItems.length})</span>
          </button>
          <button onClick={() => setIsMobileMenuOpen(true)} aria-label="Open menu"
            className="bg-transparent border-none cursor-pointer text-inherit">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity:0, x:'100%' }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:'100%' }}
            transition={{ type:'tween', duration:0.3 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col">
            <div className="container h-20 flex items-center justify-between border-b border-primary/5 px-8">
              <span className="font-heading font-extrabold text-xl tracking-widest text-primary">{t('ui.mobile_menu')}</span>
              <button onClick={() => setIsMobileMenuOpen(false)}
                className="bg-transparent border-none cursor-pointer p-3 text-primary flex items-center" aria-label="Close menu">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>
            <nav className="flex flex-col p-8 gap-1 overflow-y-auto">
              {[...navLinks, { id:'other', name:t('nav.other'), href:'/catalog' }, ...aboutItems].map(link => (
                <Link key={link.id || link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}
                  className="py-4 text-base font-bold text-primary no-underline border-b border-primary/5 block">
                  {link.name}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search modal */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ opacity:0, scale:0.95, y:-20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.95, y:-20 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-white rounded-lg shadow-2xl z-[101] overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input type="text" autoFocus placeholder={t('ui.search_placeholder')}
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-base outline-none focus:border-blue-500 focus:bg-white transition-all" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-6">
                {searchLoading && <div className="text-center py-8 text-gray-500">{t('ui.search_loading')}</div>}
                {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-8 text-gray-500">{t('ui.search_no_results')}</div>
                )}
                {!searchLoading && searchQuery.length < 2 && (
                  <div className="text-center py-8 text-gray-400 text-sm">{t('ui.search_min_chars')}</div>
                )}
                {!searchLoading && searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map(product => (
                      <Link key={product.id} href={`/catalog/${product.slug}`}
                        onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                        className="flex gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name}
                            className="w-16 h-16 object-cover rounded-md flex-shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-md flex-shrink-0 flex items-center justify-center">
                            <Search size={24} className="text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 mb-1 truncate">{product.name}</h3>
                          {product.short_description && (
                            <p className="text-sm text-gray-500 line-clamp-2">{product.short_description}</p>
                          )}
                          <p className="text-sm font-bold text-blue-600 mt-2">
                            {product.price_from ? `від ${product.price_from}` : product.price} ₴
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
                {t('ui.search_esc')}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function UserAuthIcon() {
  const supabase = createClient();
  const [status, setStatus] = useState<{ isLoggedIn: boolean; avatar?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session
        ? { isLoggedIn: true, avatar: session.user.user_metadata.avatar_url || session.user.user_metadata.picture }
        : { isLoggedIn: false });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session
        ? { isLoggedIn: true, avatar: session.user.user_metadata.avatar_url || session.user.user_metadata.picture }
        : { isLoggedIn: false });
    });
    return () => subscription.unsubscribe();
  }, []);

  if (status?.isLoggedIn) {
    return (
      <Link href="/account" className="flex items-center">
        {status.avatar
          ? <img src={status.avatar} alt="User" className="w-7 h-7 rounded-[3px] object-cover border-1.5 border-border" />
          : <User size={20} />}
      </Link>
    );
  }
  return (
    <Link href="/login" aria-label="User account" className="text-inherit hover:opacity-70 transition-opacity">
      <User size={22} />
    </Link>
  );
}
