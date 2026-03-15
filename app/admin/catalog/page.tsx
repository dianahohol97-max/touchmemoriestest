'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Plus, Search, Filter, Edit2, Trash2, Star, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
    id: string;
    name: string;
    slug: string;
    price: number;
    is_active: boolean;
    is_popular: boolean;
    images: string[];
    categories: {
        id: string;
        name: string;
    }[];
}

interface Category {
    id: string;
    name: string;
}

export default function AdminCatalogPage() {
    const supabase = createClient();

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, published, draft, popular
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch categories for filter dropdown
            const { data: catData } = await supabase.from('categories').select('id, name').order('name');
            if (catData) setCategories(catData);

            // Fetch products
            const { data: prodData, error } = await supabase
                .from('products')
                .select('id, name, slug, price, is_active, is_popular, images, categories(id, name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(prodData || []);
        } catch (error: any) {
            toast.error(error.message || 'Помилка завантаження даних');
        } finally {
            setIsLoading(false);
        }
    };

    const togglePopular = async (product: Product) => {
        try {
            // Only allow max 8 popular products logic will be rigidly enforced in the featured tab, 
            // but we can warn here if they try to add a 9th.
            if (!product.is_popular) {
                const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_popular', true);
                if (count && count >= 8) {
                    toast.error('Досягнуто ліміт (8 популярних товарів). Видаліть інші з розділу "Популярні".');
                    return;
                }
            }

            const newValue = !product.is_popular;

            const { error } = await supabase
                .from('products')
                .update({ is_popular: newValue })
                .eq('id', product.id);

            if (error) throw error;

            setProducts(products.map(p => p.id === product.id ? { ...p, is_popular: newValue } : p));
            toast.success(newValue ? 'Додано до популярних' : 'Видалено з популярних');
        } catch (error: any) {
            toast.error('Помилка оновлення статусу');
        }
    };

    const toggleStatus = async (product: Product) => {
        try {
            const newValue = !product.is_active;
            const { error } = await supabase
                .from('products')
                .update({ is_active: newValue })
                .eq('id', product.id);

            if (error) throw error;

            setProducts(products.map(p => p.id === product.id ? { ...p, is_active: newValue } : p));
            toast.success('Статус оновлено');
        } catch (error: any) {
            toast.error('Помилка оновлення статусу');
        }
    };

    const handleDelete = async (product: Product) => {
        if (confirm(`Ви впевнені, що хочете видалити товар "${product.name}"?`)) {
            const { error } = await supabase.from('products').delete().eq('id', product.id);
            if (error) {
                toast.error('Помилка видалення товару');
            } else {
                toast.success('Товар видалено');
                setProducts(products.filter(p => p.id !== product.id));
            }
        }
    };

    // Apply filters
    let filteredProducts = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCategory = categoryFilter === 'all' || p.categories?.some(c => c.id === categoryFilter);

        let matchStatus = true;
        if (statusFilter === 'published') matchStatus = p.is_active === true;
        if (statusFilter === 'draft') matchStatus = p.is_active === false;
        if (statusFilter === 'popular') matchStatus = p.is_popular === true;

        return matchSearch && matchCategory && matchStatus;
    });

    // Apply pagination
    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)', color: '#263A99' }}>
                        Всі товари
                    </h1>
                    <p style={{ color: '#64748b', marginTop: '8px' }}>
                        Управління асортиментом каталогу ({filteredProducts.length} товарів)
                    </p>
                </div>

                <Link
                    href="/admin/catalog/product/new"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                        backgroundColor: 'var(--primary)', color: 'white', borderRadius: '3px',
                        fontWeight: 700, textDecoration: 'none'
                    }}
                >
                    <Plus size={20} /> Додати товар
                </Link>
            </div>

            {/* Filters Bar */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 300px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Пошук за назвою..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        style={{
                            width: '100%', padding: '14px 16px 14px 44px', borderRadius: '3px',
                            border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none'
                        }}
                    />
                </div>

                <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                    style={{
                        padding: '14px 16px', borderRadius: '3px', border: '1px solid #e2e8f0',
                        fontSize: '15px', outline: 'none', backgroundColor: 'white', minWidth: '200px'
                    }}
                >
                    <option value="all">Всі категорії</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    style={{
                        padding: '14px 16px', borderRadius: '3px', border: '1px solid #e2e8f0',
                        fontSize: '15px', outline: 'none', backgroundColor: 'white', minWidth: '180px'
                    }}
                >
                    <option value="all">Всі статуси</option>
                    <option value="published">Опубліковані</option>
                    <option value="draft">Чернетки</option>
                    <option value="popular">Популярні (⭐)</option>
                </select>
            </div>

            {/* Products Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '3px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Товар</th>
                                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Категорія</th>
                                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ціна</th>
                                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Статус</th>
                                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '60px', textAlign: 'center' }}>
                                        <Loader2 size={32} className="animate-spin text-slate-400 mx-auto" />
                                    </td>
                                </tr>
                            ) : paginatedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                                        Товарів не знайдено
                                    </td>
                                </tr>
                            ) : (
                                paginatedProducts.map((product) => (
                                    <tr key={product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '3px', overflow: 'hidden', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {product.images && product.images[0] ? (
                                                        <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <ImageIcon size={20} color="#cbd5e1" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#263A99' }}>{product.name}</div>
                                                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>/{product.slug}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px', color: '#475569' }}>
                                            {product.categories && product.categories[0] ? (
                                                <span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '3px', fontSize: '13px', fontWeight: 600 }}>
                                                    {product.categories[0].name}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>Немає</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 600, color: '#263A99' }}>
                                            {product.price} ₴
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <button
                                                onClick={() => toggleStatus(product)}
                                                style={{
                                                    padding: '4px 12px', borderRadius: '3px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
                                                    backgroundColor: product.is_active ? '#dcfce7' : '#f1f5f9',
                                                    color: product.is_active ? '#166534' : '#64748b'
                                                }}
                                            >
                                                {product.is_active ? 'Опубліковано' : 'Чернетка'}
                                            </button>
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => togglePopular(product)}
                                                    style={{ padding: '8px', borderRadius: '3px', border: 'none', background: product.is_popular ? '#fef3c7' : '#f8fafc', color: product.is_popular ? '#d97706' : '#94a3b8', cursor: 'pointer' }}
                                                    title={product.is_popular ? 'Видалити з популярних' : 'Додати в популярні'}
                                                >
                                                    <Star size={18} fill={product.is_popular ? "currentColor" : "none"} />
                                                </button>
                                                <Link
                                                    href={`/admin/catalog/product/${product.id}`}
                                                    style={{ padding: '8px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}
                                                >
                                                    <Edit2 size={18} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(product)}
                                                    style={{ padding: '8px', borderRadius: '3px', border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#64748b' }}>
                            Показано {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} з {filteredProducts.length}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                style={{ padding: '8px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', background: 'white', color: currentPage === 1 ? '#cbd5e1' : '#263A99', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                            >
                                Попередня
                            </button>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                style={{ padding: '8px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', background: 'white', color: currentPage === totalPages ? '#cbd5e1' : '#263A99', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                            >
                                Наступна
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
