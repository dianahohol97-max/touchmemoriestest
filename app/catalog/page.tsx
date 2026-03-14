'use client';
import { useState, useEffect, Suspense } from 'react';
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

            <div className="catalog-layout">
                {/* Sidebar (Desktop) */}
                <aside className="sidebar desktop-only">
                    <div className="sticky-sidebar">
                        <h2 className="sidebar-title">Категорії</h2>
                        {isLoading ? (
                            <div className="animate-pulse flex flex-col gap-4">
                                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-6 bg-slate-200 rounded w-full"></div>)}
                            </div>
                        ) : (
                            <nav className="category-list">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategoryChange(cat.slug)}
                                        className={`category-item ${selectedCategory === cat.slug ? 'active' : ''}`}
                                    >
                                        {cat.display_style === 'thumbnail' && cat.cover_image && (
                                            <div className="category-thumbnail">
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
                <div className="catalog-main">
                    {/* Category Banner */}
                    {selectedCategory !== 'all' && (() => {
                        const currentCat = categories.find(c => c.slug === selectedCategory);
                        if (currentCat?.display_style === 'banner' && currentCat.cover_image) {
                            return (
                                <div className="category-banner">
                                    <img
                                        src={currentCat.cover_image}
                                        alt={currentCat.name}
                                    />
                                    <div className="banner-overlay">
                                        <h2>{currentCat.name}</h2>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Controls Bar */}
                    <div className="controls-bar">
                        <div className="left-controls">
                            <button
                                className="filter-toggle-btn"
                                onClick={() => setIsMobileFilterOpen(true)}
                            >
                                <Filter size={18} />
                                <span>Фільтри</span>
                            </button>
                            <div className="results-count">
                                Знайдено: <span>{isLoading ? '...' : sortedProducts.length} товарів</span>
                            </div>
                        </div>

                        <div className="sort-controls">
                            <span className="sort-label">Сортувати:</span>
                            <div className="select-wrapper">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="popular">Популярністю</option>
                                    <option value="price_asc">Ціною (зростання)</option>
                                    <option value="price_desc">Ціною (спадання)</option>
                                    <option value="new">Новинками</option>
                                </select>
                                <ChevronDown className="select-icon" size={16} />
                            </div>
                        </div>
                    </div>

                    {/* Product Grid */}
                    {isLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 size={40} className="animate-spin text-slate-300" />
                        </div>
                    ) : (
                        <div className="product-grid">
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
                                <div className="no-products">
                                    У цій категорії поки немає товарів.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Filter Drawer */}
            {isMobileFilterOpen && (
                <div className="mobile-drawer-overlay" onClick={() => setIsMobileFilterOpen(false)}>
                    <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header">
                            <h3>Фільтри</h3>
                            <button className="close-btn" onClick={() => setIsMobileFilterOpen(false)}>✕</button>
                        </div>
                        <div className="drawer-content">
                            <h4 className="drawer-section-title">Категорії</h4>
                            <nav className="drawer-category-list">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategoryChange(cat.slug)}
                                        className={`drawer-category-item ${selectedCategory === cat.slug ? 'active' : ''}`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .catalog-layout {
                    display: flex;
                    gap: 40px;
                    align-items: flex-start;
                }

                .sidebar {
                    width: 240px;
                    flex-shrink: 0;
                }

                .sticky-sidebar {
                    position: sticky;
                    top: 120px;
                    max-height: calc(100vh - 160px);
                    overflow-y: auto;
                    padding-right: 10px;
                }

                .sticky-sidebar::-webkit-scrollbar {
                    width: 4px;
                }
                .sticky-sidebar::-webkit-scrollbar-thumb {
                    background: #eee;
                    border-radius: 10px;
                }

                .sidebar-title {
                    font-size: 14px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 24px;
                    color: #888;
                }

                .category-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .category-item {
                    text-align: left;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 10px 12px;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 500;
                    color: #444;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.2s;
                }

                .category-item:hover {
                    background-color: #f1f5f9;
                    color: var(--primary);
                }

                .category-item.active {
                    background-color: #f1f5f9;
                    font-weight: 800;
                    color: var(--primary);
                }

                .category-thumbnail {
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    overflow: hidden;
                    flex-shrink: 0;
                }

                .category-thumbnail img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .catalog-main {
                    flex: 1;
                    min-width: 0;
                }

                .category-banner {
                    width: 100%;
                    height: 200px;
                    border-radius: 20px;
                    overflow: hidden;
                    margin-bottom: 32px;
                    position: relative;
                }

                .category-banner img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .banner-overlay {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(transparent, rgba(0,0,0,0.4));
                    padding: 24px;
                    color: white;
                }

                .banner-overlay h2 {
                    font-size: 24px;
                    font-weight: 900;
                }

                .controls-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #f1f1f1;
                    gap: 16px;
                    flex-wrap: wrap;
                }

                .left-controls {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .filter-toggle-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    height: 40px;
                    padding: 0 16px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background-color: white;
                    font-size: 14px;
                    font-weight: 600;
                    color: #1e293b;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                /* Show on mobile, keep desktop functional for drawer too or hide if not needed */
                .desktop-only { display: block; }
                
                .filter-toggle-btn:hover {
                    border-color: #cbd5e1;
                    background-color: #f8fafc;
                }

                .results-count {
                    font-size: 14px;
                    color: #666;
                    font-weight: 500;
                }

                .results-count span {
                    font-weight: 800;
                    color: #1e293b;
                }

                .sort-controls {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .sort-label {
                    font-size: 14px;
                    color: #666;
                }

                .select-wrapper {
                    position: relative;
                }

                .select-wrapper select {
                    appearance: none;
                    padding: 8px 36px 8px 16px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background-color: white;
                    font-size: 14px;
                    font-weight: 600;
                    color: #1e293b;
                    cursor: pointer;
                    outline: none;
                }

                .select-icon {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    color: #666;
                }

                .product-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                }

                .no-products {
                    grid-column: 1 / -1;
                    padding: 80px 0;
                    text-align: center;
                    color: #888;
                    font-size: 16px;
                }

                /* Mobile Drawer Styles */
                .mobile-drawer-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.4);
                    z-index: 1000;
                    display: flex;
                    align-items: flex-end;
                }

                .mobile-drawer {
                    width: 100%;
                    background-color: white;
                    border-radius: 24px 24px 0 0;
                    padding: 24px;
                    max-height: 80vh;
                    overflow-y: auto;
                    animation: slideUp 0.3s ease-out;
                }

                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .drawer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .drawer-header h3 {
                    font-size: 20px;
                    font-weight: 800;
                }

                .close-btn {
                    background: #f1f5f9;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 18px;
                }

                .drawer-section-title {
                    font-size: 14px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #888;
                    margin-bottom: 16px;
                }

                .drawer-category-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .drawer-category-item {
                    text-align: left;
                    padding: 14px 16px;
                    border-radius: 12px;
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    font-size: 16px;
                    font-weight: 500;
                    color: #1e293b;
                    cursor: pointer;
                }

                .drawer-category-item.active {
                    background-color: #f1f5f9;
                    border-color: var(--primary);
                    color: var(--primary);
                    font-weight: 800;
                }

                @media (max-width: 1024px) {
                    .product-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 768px) {
                    .desktop-only {
                        display: none;
                    }
                    .catalog-layout {
                        flex-direction: column;
                        gap: 0;
                    }
                    .product-grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                    .controls-bar {
                        margin-bottom: 24px;
                    }
                    .left-controls {
                        width: 100%;
                        justify-content: space-between;
                    }
                }
            `}</style>
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
