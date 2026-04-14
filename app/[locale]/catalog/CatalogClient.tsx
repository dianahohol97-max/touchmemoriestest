'use client';
import { useT } from '@/lib/i18n/context';
import { useLocale } from '@/lib/i18n/context';
import { getLocalized } from '@/lib/i18n/localize';
import { useState, useEffect, Suspense } from 'react';
import styles from './catalog.module.css';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { ProductCard } from '@/components/ui/ProductCard';
import { ChevronDown, Loader2 } from 'lucide-react';

const getUkrainianPlural = (count: number, one: string, few: string, many: string) => {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
};

interface Category {
    id: string;
    name: string;
    slug: string;
    cover_image?: string;
    display_style?: 'thumbnail' | 'banner';
}

interface Product {
    id: string;
    name: string;
    slug: string;
    price: number;
    price_from: boolean;
    short_description: string;
    images: string[];
    is_popular: boolean;
    popular_order: number;
    created_at: string;
    categories?: {
        name: string;
        slug: string;
    };
}

function CatalogContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const t = useT();
    const locale = useLocale();
    const queryCategory = searchParams.get('category') || 'all';
    const queryCollection = searchParams.get('collection');

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [collectionProducts, setCollectionProducts] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState(queryCategory);
    const [sortBy, setSortBy] = useState('popular');
    const [hasPendingOrder, setHasPendingOrder] = useState(false);

    useEffect(() => {
        // Check for pending order
        const pendingOrder = sessionStorage.getItem('pendingOrder');
        setHasPendingOrder(!!pendingOrder);
    }, []);

    useEffect(() => {
        // Sync state with URL if it changes externally
        if (queryCategory !== selectedCategory) {
            setSelectedCategory(queryCategory);
        }
    }, [queryCategory]);

    useEffect(() => {
        const fetchCatalogData = async () => {
            setIsLoading(true);

            // Fetch categories
            const { data: catData } = await supabase
                .from('categories')
                .select('id, name, slug, cover_image, display_style, translations')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (catData) setCategories([{ id: 'all', name: t('catalog.all'), slug: 'all' }, ...catData]);

            // Fetch products
            const { data: prodData } = await supabase
                .from('products')
                .select('id, name, slug, price, price_from, short_description, images, is_popular, popular_order, created_at, is_personalized, is_partially_personalized, translations, categories(name, slug)')
                .eq('is_active', true);

            if (prodData) {
                // Supabase returns generic object array, so we map it to our type
                setProducts(prodData as any);
            }

            // If there's a collection parameter, fetch products for that collection
            if (queryCollection) {
                const { data: collectionData } = await supabase
                    .from('gift_collections')
                    .select('id')
                    .eq('slug', queryCollection)
                    .eq('is_active', true)
                    .single();

                if (collectionData) {
                    const { data: itemsData } = await supabase
                        .from('gift_collection_items')
                        .select('product_id')
                        .eq('collection_id', collectionData.id)
                        .order('sort_order');

                    if (itemsData) {
                        setCollectionProducts(itemsData.map(item => item.product_id));
                    }
                }
            } else {
                setCollectionProducts([]);
            }

            setIsLoading(false);
        };

        fetchCatalogData();
    }, [supabase, queryCollection]);

    // Filter products
    const filteredProducts = products.filter(p => {
        // If viewing a gift collection, only show products in that collection
        if (queryCollection && collectionProducts.length > 0) {
            return collectionProducts.includes(p.id);
        }
        // Otherwise filter by category as usual
        return selectedCategory === 'all' ? true : p.categories?.slug === selectedCategory;
    });

    // Sort products
    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        // Default: Popularity
        // 1. Popular products first, sorted by popular_order
        // 2. Then the rest, perhaps sorted by newest
        if (sortBy === 'popular') {
            if (a.is_popular && !b.is_popular) return -1;
            if (!a.is_popular && b.is_popular) return 1;
            if (a.is_popular && b.is_popular) {
                return (a.popular_order || 0) - (b.popular_order || 0);
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
    });

    return (
        <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {/* Pending Order Banner */}
            {hasPendingOrder && (
                <div style={{
                    backgroundColor: '#2563eb',
                    color: 'white',
                    textAlign: 'center',
                    padding: '12px 16px',
                    marginBottom: '24px',
                    borderRadius: '8px',
                    fontSize: '15px'
                }}>
                    <span>У вас є незавершене замовлення. </span>
                    <button
                        onClick={() => router.push('/order/designer-upload')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            textDecoration: 'underline',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '15px',
                            marginLeft: '4px'
                        }}
                        className="hover:opacity-80"
                    >
                        ← Повернутись до оформлення
                    </button>
                </div>
            )}

            {/* Breadcrumbs */}
            <div style={{ fontSize: '14px', color: '#888', marginBottom: '24px' }}>
                {t('footer.about') ? t('nav.catalog') || 'Каталог' : 'Каталог'} <span style={{ margin: '0 8px' }}>→</span> {t('catalog.title')}
            </div>

            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, marginBottom: '16px' }}>
                    {t('catalog.title')}
                </h1>
            </header>

            <div className={styles.catalogLayout}>
                {/* Main Content */}
                <div className={styles.catalogMain}>
                    {/* Category Banner */}
                    {selectedCategory !== 'all' && (() => {
                        const currentCat = categories.find(c => c.slug === selectedCategory);
                        if (currentCat?.display_style === 'banner' && currentCat.cover_image) {
                            return (
                                <div className={styles.categoryBanner}>
                                    <img
                                        src={currentCat.cover_image}
                                        alt={currentCat.name}
                                    />
                                    <div className={styles.bannerOverlay}>
                                        <h2>{currentCat.name}</h2>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Controls Bar & Category Chips */}
                    <div className={styles.controlsBarWrapper} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>

                        {/* Category Chips Bar */}
                        <div className={styles.categoryChipsBar} style={{
                            display: 'flex',
                            gap: '8px',
                            overflowX: 'auto',
                            paddingBottom: '8px',
                            msOverflowStyle: 'none',  /* IE and Edge */
                            scrollbarWidth: 'none'    /* Firefox */
                        }}>
                            {/* Hide scrollbar for webkit browsers as well in global CSS if needed, or via inline styles if supported, but usually better in CSS. For inline scrolling: */}
                            <style jsx>{`
                                .${styles.categoryChipsBar}::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>

                            {categories.map((cat) => {
                                const isActive = selectedCategory === cat.slug;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            router.push(`/catalog?category=${cat.slug}`);
                                            setSelectedCategory(cat.slug);
                                        }}
                                        style={{
                                            padding: '8px 20px',
                                            border: isActive ? '1px solid #263A99' : '1px solid #e2e8f0',
                                            backgroundColor: isActive ? '#263A99' : 'white',
                                            color: isActive ? 'white' : '#263A99',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s ease',
                                          borderRadius: '10px',
                                        }}
                                        className="hover:opacity-90"
                                    >
                                        {getLocalized(cat, locale, 'name')}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Results Count & Sort */}
                        <div className={styles.controlsBar} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div className={styles.leftControls}>
                                <div className={styles.resultsCount} style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>
                                    Знайдено: <span style={{ color: '#263A99', fontWeight: 700 }}>
                                        {isLoading ? '...' : `${sortedProducts.length} ${getUkrainianPlural(sortedProducts.length, 'товар', 'товари', 'товарів')}`}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.sortControls} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={styles.sortLabel} style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>{t('catalog.sort')}:</span>
                                <div className={styles.selectWrapper} style={{ position: 'relative' }}>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        style={{
                                            padding: '8px 32px 8px 16px',
                                            borderRadius: "3px",
                                            border: '1px solid #e2e8f0',
                                            backgroundColor: 'white',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: '#263A99',
                                            appearance: 'none',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="popular">{t('catalog.sort_popular')}</option>
                                        <option value="price_asc">{t('catalog.sort_price_asc')}</option>
                                        <option value="price_desc">{t('catalog.sort_price_desc')}</option>
                                        <option value="new">Новинками</option>
                                    </select>
                                    <ChevronDown className={styles.selectIcon} size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Product Grid */}
                    {isLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 size={40} className="animate-spin text-slate-300" />
                        </div>
                    ) : (
                        <div className={styles.productGrid}>
                            {sortedProducts.map((product) => (
                                <div key={product.id} className="relative">
                                    {product.is_popular && (
                                        <div className="absolute top-4 left-4 z-20 flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-md text-xs font-bold shadow-sm">
                                            {t('catalog.popular_badge')}
                                        </div>
                                    )}
                                    <ProductCard product={product} />
                                </div>
                            ))}
                            {sortedProducts.length === 0 && (
                                <div className={styles.noProducts}>
                                    У цій категорії поки немає товарів.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

export default function CatalogPage() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fcfcfc', display: 'flex', flexDirection: 'column' }}>
            <Navigation />
            <Suspense fallback={<div className="flex-1 flex justify-center items-center"><Loader2 size={40} className="animate-spin text-slate-300" /></div>}>
                <CatalogContent />
            </Suspense>
            <Footer categories={[]} />
        </div>
    );
}
