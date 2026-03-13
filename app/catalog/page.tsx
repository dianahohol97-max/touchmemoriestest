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

            <div className="catalog-layout" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '40px' }}>
                {/* Mobile Filter Button */}
                <button
                    className="mobile-filter-btn hidden"
                    onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                    style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '16px',
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 600,
                        marginBottom: '24px',
                        cursor: 'pointer'
                    }}
                >
                    <Filter size={20} /> Фільтр
                </button>

                {/* Sidebar */}
                <aside className={`sidebar ${isMobileFilterOpen ? 'block' : 'hidden md:block'}`} style={{ position: 'sticky', top: '120px', height: 'fit-content' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px', color: '#888' }}>
                        Категорії
                    </h2>
                    {isLoading ? (
                        <div className="animate-pulse flex flex-col gap-4">
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-6 bg-slate-200 rounded w-full"></div>)}
                        </div>
                    ) : (
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategoryChange(cat.slug)}
                                    style={{
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        fontWeight: selectedCategory === cat.slug ? 800 : 500,
                                        color: selectedCategory === cat.slug ? 'var(--primary)' : '#444',
                                        padding: '8px 0',
                                        transition: 'color 0.2s',
                                        outline: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    {cat.display_style === 'thumbnail' && cat.cover_image && (
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                            <img src={cat.cover_image} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    )}
                                    {cat.name}
                                </button>
                            ))}
                        </nav>
                    )}
                </aside>

                {/* Main Content */}
                <div>
                    {/* Category Banner */}
                    {selectedCategory !== 'all' && (() => {
                        const currentCat = categories.find(c => c.slug === selectedCategory);
                        if (currentCat?.display_style === 'banner' && currentCat.cover_image) {
                            return (
                                <div style={{
                                    width: '100%',
                                    height: '200px',
                                    borderRadius: '24px',
                                    overflow: 'hidden',
                                    marginBottom: '32px',
                                    position: 'relative'
                                }}>
                                    <img
                                        src={currentCat.cover_image}
                                        alt={currentCat.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.4))',
                                        padding: '24px',
                                        color: 'white'
                                    }}>
                                        <h2 style={{ fontSize: '24px', fontWeight: 900 }}>{currentCat.name}</h2>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Sorting Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontSize: '14px', color: '#666', fontWeight: 500 }}>
                            Знайдено: <span style={{ fontWeight: 800, color: '#1e293b' }}>{isLoading ? '...' : sortedProducts.length} товарів</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '14px', color: '#666' }}>Сортувати за:</span>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{
                                        appearance: 'none',
                                        padding: '8px 40px 8px 16px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        backgroundColor: 'white',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: '#1e293b',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    <option value="popular">Популярністю</option>
                                    <option value="price_asc">Ціною (зростання)</option>
                                    <option value="price_desc">Ціною (спадання)</option>
                                    <option value="new">Новинками</option>
                                </select>
                                <ChevronDown size={16} color="#666" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
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
                                <div style={{ gridColumn: '1 / -1', padding: '100px 0', textAlign: 'center', color: '#888' }}>
                                    У цій категорії поки немає товарів.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .product-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 32px;
                }
                
                @media (max-width: 1024px) {
                    .product-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                
                @media (max-width: 768px) {
                    .catalog-layout {
                        grid-template-columns: 1fr !important;
                    }
                    .mobile-filter-btn {
                        display: flex !important;
                    }
                    .sidebar {
                        background: #f8f9fa;
                        padding: 24px;
                        border-radius: 12px;
                        margin-bottom: 24px;
                    }
                    .product-grid {
                        grid-template-columns: 1fr;
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
