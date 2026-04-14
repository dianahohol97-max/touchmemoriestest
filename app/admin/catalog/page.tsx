'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Plus, Search, Edit2, Trash2, Star, Eye, EyeOff, ChevronDown, ChevronRight, Package, Grid3X3, List } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
    id: string;
    name: string;
    slug: string;
    price: number;
    is_active: boolean;
    is_popular: boolean;
    images: string[] | null;
    category: { id: string; name: string; slug: string } | null;
    short_description?: string;
}

interface Category {
    id: string;
    name: string;
    slug: string;
    sort_order: number;
}

const S = {
    page: { maxWidth: 1280, margin: '0 auto', padding: '0 0 60px' } as React.CSSProperties,
    // Sticky top bar
    topBar: {
        position: 'sticky' as const, top: 0, zIndex: 30,
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '14px 28px', display: 'flex', alignItems: 'center',
        gap: 12, flexWrap: 'wrap' as const,
    },
    title: { fontSize: 22, fontWeight: 900, color: '#1e2d7d', margin: 0, flex: 1 } as React.CSSProperties,
    addBtn: {
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '10px 20px', background: '#1e2d7d', color: '#fff',
        borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(30,45,125,0.2)',
        whiteSpace: 'nowrap' as const,
    },
    searchWrap: { position: 'relative' as const, flex: '1 1 220px', minWidth: 180, maxWidth: 340 },
    searchInput: {
        width: '100%', padding: '9px 12px 9px 36px',
        border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13,
        outline: 'none', boxSizing: 'border-box' as const, background: '#f8fafc',
    },
    // Category section
    catSection: { marginBottom: 8 } as React.CSSProperties,
    catHeader: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', background: '#f8fafc',
        borderTop: '1px solid #e2e8f0', cursor: 'pointer',
        userSelect: 'none' as const,
        position: 'sticky' as const, top: 65, zIndex: 20,
    },
    catTitle: { fontSize: 14, fontWeight: 800, color: '#374151', flex: 1 } as React.CSSProperties,
    catCount: {
        fontSize: 12, fontWeight: 700, color: '#94a3b8',
        background: '#f1f5f9', padding: '2px 8px', borderRadius: 10,
    } as React.CSSProperties,
    // Product row (list view)
    prodRow: {
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 20px', borderBottom: '1px solid #f1f5f9',
        background: '#fff', transition: 'background 0.12s',
    },
    prodThumb: {
        width: 44, height: 44, borderRadius: 6, objectFit: 'cover' as const,
        border: '1px solid #e2e8f0', flexShrink: 0, background: '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    prodName: { fontWeight: 700, color: '#1e3a8a', fontSize: 14, lineHeight: 1.3 } as React.CSSProperties,
    prodSlug: { fontSize: 11, color: '#94a3b8', marginTop: 1 } as React.CSSProperties,
    price: { fontSize: 15, fontWeight: 800, color: '#1e2d7d', minWidth: 70, textAlign: 'right' as const } as React.CSSProperties,
    actions: { display: 'flex', gap: 5, flexShrink: 0 } as React.CSSProperties,
    iconBtn: (active?: boolean, danger?: boolean) => ({
        width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: danger ? '#fef2f2' : active ? '#fef3c7' : '#f8fafc',
        color: danger ? '#ef4444' : active ? '#d97706' : '#94a3b8',
        transition: 'background 0.12s',
    } as React.CSSProperties),
    // Grid card
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, padding: '12px 20px' } as React.CSSProperties,
    card: {
        borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden',
        background: '#fff', transition: 'box-shadow 0.15s', cursor: 'pointer',
    } as React.CSSProperties,
    cardImg: { width: '100%', height: 130, objectFit: 'cover' as const, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
    cardBody: { padding: '10px 12px' } as React.CSSProperties,
};

export default function AdminCatalogPage() {
    const supabase = createClient();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [{ data: cats }, { data: prods, error }] = await Promise.all([
                supabase.from('categories').select('id,name,slug,sort_order').order('sort_order'),
                supabase.from('products').select('id,name,slug,price,is_active,is_popular,images,short_description,category:categories!products_category_id_fkey(id,name,slug)').order('name'),
            ]);
            if (error) throw error;
            setCategories(cats || []);
            setProducts((prods || []) as any);
        } catch (e: any) {
            toast.error('Помилка: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleStatus = async (p: Product) => {
        const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
        if (error) { toast.error('Помилка'); return; }
        setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
        toast.success(p.is_active ? 'Прихований' : 'Опубліковано');
    };

    const togglePopular = async (p: Product) => {
        if (!p.is_popular) {
            const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_popular', true);
            if (count && count >= 8) { toast.error('Ліміт 8 популярних товарів'); return; }
        }
        const { error } = await supabase.from('products').update({ is_popular: !p.is_popular }).eq('id', p.id);
        if (error) { toast.error('Помилка'); return; }
        setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_popular: !x.is_popular } : x));
    };

    const handleDelete = async (p: Product) => {
        if (!confirm(`Видалити "${p.name}"?`)) return;
        const { error } = await supabase.from('products').delete().eq('id', p.id);
        if (error) { toast.error('Помилка видалення'); return; }
        setProducts(prev => prev.filter(x => x.id !== p.id));
        toast.success('Товар видалено');
    };

    const toggleCollapse = (catId: string) =>
        setCollapsed(prev => ({ ...prev, [catId]: !prev[catId] }));

    // Filter
    const filtered = products.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !q || p.name.toLowerCase().includes(q) || p.slug.includes(q);
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? p.is_active : !p.is_active);
        return matchSearch && matchStatus;
    });

    // Group by category
    const groups: { cat: Category | null; products: Product[] }[] = [];
    const catMap = new Map<string, Product[]>();
    const noCat: Product[] = [];

    filtered.forEach(p => {
        if (!p.category) { noCat.push(p); return; }
        if (!catMap.has(p.category.id)) catMap.set(p.category.id, []);
        catMap.get(p.category.id)!.push(p);
    });

    // Sort by category sort_order
    categories.forEach(cat => {
        const prods = catMap.get(cat.id);
        if (prods?.length) groups.push({ cat, products: prods });
    });
    if (noCat.length) groups.push({ cat: null, products: noCat });

    const totalActive = products.filter(p => p.is_active).length;

    const ProductRow = ({ p }: { p: Product }) => (
        <div style={S.prodRow}>
            <div style={S.prodThumb}>
                {p.images?.[0]
                    ? <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}/>
                    : <Package size={18} color="#cbd5e1"/>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.prodName} className="truncate">{p.name}</div>
                <div style={S.prodSlug}>/{p.slug}</div>
            </div>
            {p.is_popular && <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 7px', borderRadius: 10 }}>⭐ топ</span>}
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 8,
                background: p.is_active ? '#dcfce7' : '#f1f5f9',
                color: p.is_active ? '#15803d' : '#94a3b8' }}>
                {p.is_active ? 'Активний' : 'Чернетка'}
            </span>
            <div style={S.price}>{p.price} ₴</div>
            <div style={S.actions}>
                <button onClick={() => togglePopular(p)} style={S.iconBtn(p.is_popular)} title={p.is_popular ? 'Прибрати з топу' : 'Додати в топ'}>
                    <Star size={15} fill={p.is_popular ? 'currentColor' : 'none'}/>
                </button>
                <button onClick={() => toggleStatus(p)} style={S.iconBtn()} title={p.is_active ? 'Приховати' : 'Опублікувати'}>
                    {p.is_active ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
                <Link href={`/admin/catalog/product/edit/${p.id}`} style={{ ...S.iconBtn(), textDecoration: 'none', color: '#3b82f6' }}>
                    <Edit2 size={15}/>
                </Link>
                <button onClick={() => handleDelete(p)} style={S.iconBtn(false, true)} title="Видалити">
                    <Trash2 size={15}/>
                </button>
            </div>
        </div>
    );

    const ProductCard = ({ p }: { p: Product }) => (
        <div style={S.card}>
            <div style={S.cardImg}>
                {p.images?.[0]
                    ? <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: 130, objectFit: 'cover' }}/>
                    : <Package size={28} color="#e2e8f0"/>}
            </div>
            <div style={S.cardBody}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e2d7d', marginBottom: 3, lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>/{p.slug}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: '#1e2d7d', fontSize: 14 }}>{p.price} ₴</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                        background: p.is_active ? '#dcfce7' : '#f1f5f9',
                        color: p.is_active ? '#15803d' : '#94a3b8' }}>
                        {p.is_active ? '●' : '○'} {p.is_active ? 'ON' : 'OFF'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button onClick={() => toggleStatus(p)} style={{ ...S.iconBtn(), flex: 1 }}>
                        {p.is_active ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                    <Link href={`/admin/catalog/product/edit/${p.id}`} style={{ ...S.iconBtn(), flex: 1, textDecoration: 'none', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit2 size={13}/>
                    </Link>
                    <button onClick={() => handleDelete(p)} style={{ ...S.iconBtn(false, true), flex: 1 }}>
                        <Trash2 size={13}/>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div style={S.page}>
            {/* Sticky top bar */}
            <div style={S.topBar}>
                <h1 style={S.title}>
                    Товари
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', marginLeft: 8 }}>
                        {totalActive}/{products.length} активних
                    </span>
                </h1>

                {/* Search */}
                <div style={S.searchWrap}>
                    <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}/>
                    <input type="text" placeholder="Пошук..." value={search}
                        onChange={e => setSearch(e.target.value)} style={S.searchInput}/>
                </div>

                {/* Status filter */}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                    style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#374151', background: '#f8fafc', cursor: 'pointer' }}>
                    <option value="all">Всі статуси</option>
                    <option value="active">Активні</option>
                    <option value="draft">Чернетки</option>
                </select>

                {/* View toggle */}
                <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <button onClick={() => setViewMode('list')}
                        style={{ padding: '8px 12px', border: 'none', cursor: 'pointer', background: viewMode === 'list' ? '#1e2d7d' : '#fff', color: viewMode === 'list' ? '#fff' : '#64748b' }}>
                        <List size={15}/>
                    </button>
                    <button onClick={() => setViewMode('grid')}
                        style={{ padding: '8px 12px', border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? '#1e2d7d' : '#fff', color: viewMode === 'grid' ? '#fff' : '#64748b' }}>
                        <Grid3X3 size={15}/>
                    </button>
                </div>

                {/* Add button */}
                <Link href="/admin/catalog/product/new" style={S.addBtn}>
                    <Plus size={18}/> Додати товар
                </Link>
            </div>

            {/* Loading */}
            {isLoading && (
                <div style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    Завантаження…
                </div>
            )}

            {/* Empty */}
            {!isLoading && filtered.length === 0 && (
                <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                    <Package size={48} color="#e2e8f0" style={{ margin: '0 auto 16px' }}/>
                    <div style={{ color: '#94a3b8', fontSize: 15 }}>Товарів не знайдено</div>
                    <Link href="/admin/catalog/product/new" style={{ ...S.addBtn, display: 'inline-flex', marginTop: 20 }}>
                        <Plus size={16}/> Додати перший товар
                    </Link>
                </div>
            )}

            {/* Groups */}
            {!isLoading && groups.map(({ cat, products: catProds }) => {
                const key = cat?.id || '__none__';
                const isOpen = collapsed[key] !== true;
                return (
                    <div key={key} style={S.catSection}>
                        {/* Category header */}
                        <div style={S.catHeader} onClick={() => toggleCollapse(key)}>
                            {isOpen
                                ? <ChevronDown size={16} color="#64748b"/>
                                : <ChevronRight size={16} color="#64748b"/>}
                            <span style={S.catTitle}>
                                {cat ? cat.name : '📂 Без категорії'}
                            </span>
                            <span style={S.catCount}>{catProds.length} товарів</span>
                            {cat && (
                                <span style={{ fontSize: 11, color: '#cbd5e1', marginLeft: 4 }}>/{cat.slug}</span>
                            )}
                        </div>

                        {/* Products */}
                        {isOpen && (
                            viewMode === 'grid'
                                ? <div style={S.grid}>{catProds.map(p => <ProductCard key={p.id} p={p}/>)}</div>
                                : <div>{catProds.map(p => <ProductRow key={p.id} p={p}/>)}</div>
                        )}
                    </div>
                );
            })}

            {/* Footer summary */}
            {!isLoading && filtered.length > 0 && (
                <div style={{ padding: '16px 20px', color: '#94a3b8', fontSize: 12, borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
                    Показано {filtered.length} з {products.length} товарів · {groups.length} категорій
                </div>
            )}
        </div>
    );
}
