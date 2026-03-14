'use client';
import { useState, useEffect, Suspense } from 'react';
import styles from './catalog.module.css';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { ProductCard } from '@/components/ui/ProductCard';
import { Filter, ChevronDown, Loader2 } from 'lucide-react';

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
    const queryCategory = searchParams.get('category') || 'all';

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState(queryCategory);
    const [sortBy, setSortBy] = useState('popular');
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

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
                .select('id, name, slug, cover_image, display_style')
                .eq('is_active', true)
                .order('sort_order', { ascending: true });

            if (catData) setCategories([{ id: 'all', name: 'Всі товари', slug: 'all' }, ...catData]);

            // Fetch products
            const { data: prodData } = await supabase
                .from('products')
                .select('id, name, slug, price, price_from, short_description, images, is_popular, popular_order, created_at, categories(name, slug)')
                .eq('is_active', true);

            if (prodData) {
                // Supabase returns generic object array, so we map it to our type
                setProducts(prodData as any);
            }

            setIsLoading(false);
        };

        fetchCatalogData();
    }, [supabase]);

    const handleCategoryChange = (slug: string) => {
        setSelectedCategory(slug);
        setIsMobileFilterOpen(false);
        router.push(slug === 'all' ? '/catalog' : `/catalog?category=${slug}`, { scroll: false });
    };

    // Filter products
    const filteredProducts = products.filter(p =>
        selectedCategory === 'all' ? true : p.categories?.slug === selectedCategory
    );

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
        <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            {/* Breadcrumbs */}
            <div style={{ fontSize: '14px', color: '#888', marginBottom: '24px' }}>
                Головна <span style={{ margin: '0 8px' }}>→</span> Каталог
            </div>

            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, marginBottom: '16px' }}>
                    Каталог товарів
                </h1>
            </header>

            <div className={styles.catalogLayout}>
                {/* Sidebar (Desktop) */}
                <aside className={`${styles.sidebar} ${styles.desktopOnly}`}>
                    <div className={styles.stickySidebar}>
                        <h2 className={styles.sidebarTitle}>Категорії</h2>
                        {isLoading ? (
                            <div className="animate-pulse flex flex-col gap-4">
                                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-6 bg-slate-200 rounded w-full"></div>)}
                            </div>
                        ) : (
                            <nav className={styles.categoryList}>
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategoryChange(cat.slug)}
                                        className={`${styles.categoryItem} ${selectedCategory === cat.slug ? styles.active : ''}`}
                                    >
                                        {cat.display_style === 'thumbnail' && cat.cover_image && (
                                            <div className={styles.categoryThumbnail}>
                                                <img src={cat.cover_image} alt={cat.name} />
                                            </div>
                                        )}
                                        {cat.name}
                                    </button>
                                ))}
                            </nav>
                        )}
                    </div>
                </aside>

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

                    {/* Controls Bar */}
                    <div className={styles.controlsBar}>
                        <div className={styles.leftControls}>
                            <button
                                className={styles.filterToggleBtn}
                                onClick={() => setIsMobileFilterOpen(true)}
                            >
                                <Filter size={18} />
                                <span>Фільтри</span>
                            </button>
                            <div className={styles.resultsCount}>
                                Знайдено: <span>{isLoading ? '...' : sortedProducts.length} товарів</span>
                            </div>
                        </div>

                        <div className={styles.sortControls}>
                            <span className={styles.sortLabel}>Сортувати:</span>
                            <div className={styles.selectWrapper}>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="popular">Популярністю</option>
                                    <option value="price_asc">Ціною (зростання)</option>
                                    <option value="price_desc">Ціною (спадання)</option>
                                    <option value="new">Новинками</option>
                                </select>
                                <ChevronDown className={styles.selectIcon} size={16} />
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
                                        <div className="absolute top-4 left-4 z-20 flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                            ⭐ Популярне
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

            {/* Mobile Filter Drawer */}
            {isMobileFilterOpen && (
                <div className={styles.mobileDrawerOverlay} onClick={() => setIsMobileFilterOpen(false)}>
                    <div className={styles.mobileDrawer} onClick={e => e.stopPropagation()}>
                        <div className={styles.drawerHeader}>
                            <h3>Фільтри</h3>
                            <button className={styles.closeBtn} onClick={() => setIsMobileFilterOpen(false)}>✕</button>
                        </div>
                        <div className={styles.drawerContent}>
                            <h4 className={styles.drawerSectionTitle}>Категорії</h4>
                            <nav className={styles.drawerCategoryList}>
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategoryChange(cat.slug)}
                                        className={`${styles.drawerCategoryItem} ${selectedCategory === cat.slug ? styles.active : ''}`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>
                </div>
            )}

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
