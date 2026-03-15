'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
    Plus,
    Search,
    Filter,
    Edit,
    Trash2,
    CheckCircle2,
    XCircle,
    Package,
    X,
    AlertTriangle,
    ChevronDown,
    RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductsPage() {
    const supabase = createClient();

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<any[]>([]);

    // Simple Search Filter
    const [searchQuery, setSearchQuery] = useState('');

    // Advanced Filters State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState({
        category: 'all',
        status: 'all', // all, published, draft
        popular: 'all', // all, yes, no
        minPrice: '',
        maxPrice: ''
    });

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, productId: string | null, productName: string }>({
        isOpen: false,
        productId: null,
        productName: ''
    });

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    async function fetchCategories() {
        const { data } = await supabase.from('categories').select('*').order('name');
        if (data) setCategories(data);
    }

    async function fetchProducts() {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('*, categories(name)')
            .order('created_at', { ascending: false });
        if (data) setProducts(data);
        setLoading(false);
    }

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('products')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (!error) {
            setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
            toast.success('Статус оновлено');
        }
    };

    const confirmDelete = async () => {
        if (!deleteModal.productId) return;

        const tid = toast.loading('Видалення...');
        const { error } = await supabase.from('products').delete().eq('id', deleteModal.productId);

        if (!error) {
            setProducts(products.filter(p => p.id !== deleteModal.productId));
            toast.success('Товар видалено', { id: tid });
            setDeleteModal({ isOpen: false, productId: null, productName: '' });
        } else {
            toast.error('Помилка видалення', { id: tid });
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filters.category === 'all' || p.category_id === filters.category;
        const matchesStatus = filters.status === 'all'
            || (filters.status === 'published' && p.is_active)
            || (filters.status === 'draft' && !p.is_active);
        const matchesPopular = filters.popular === 'all'
            || (filters.popular === 'yes' && p.is_popular)
            || (filters.popular === 'no' && !p.is_popular);

        const price = Number(p.price);
        const minP = filters.minPrice ? Number(filters.minPrice) : 0;
        const maxP = filters.maxPrice ? Number(filters.maxPrice) : Infinity;
        const matchesPrice = price >= minP && price <= maxP;

        return matchesSearch && matchesCategory && matchesStatus && matchesPopular && matchesPrice;
    });

    const resetFilters = () => {
        setFilters({
            category: 'all',
            status: 'all',
            popular: 'all',
            minPrice: '',
            maxPrice: ''
        });
    };

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '100px' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 950, color: '#263A99', marginBottom: '8px', letterSpacing: '-0.02em' }}>Товари 📦</h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>Керуйте вашим асортиментом та залишками.</p>
                </div>
                <Link href="/admin/products/new" style={addBtnStyle}>
                    <Plus size={20} />
                    Додати товар
                </Link>
            </div>

            {/* Top Toolbar */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', alignItems: 'center' }}>
                <div style={searchWrapperStyle}>
                    <Search size={18} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Пошук за назвою..."
                        style={searchInputStyle}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    style={{
                        ...filterBtnStyle,
                        backgroundColor: isFilterOpen ? '#f1f5f9' : 'white',
                        borderColor: isFilterOpen ? '#cbd5e1' : '#e2e8f0'
                    }}
                >
                    <Filter size={18} />
                    Фільтри
                    <ChevronDown size={14} style={{ transform: isFilterOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </button>
            </div>

            {/* Advanced Filters Panel */}
            <AnimatePresence>
                {isFilterOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                        animate={{ height: 'auto', opacity: 1, marginBottom: 32 }}
                        exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={filterPanelCard}>
                            <div style={filterGrid}>
                                <div style={filterItem}>
                                    <label style={filterLabel}>Категорія</label>
                                    <select
                                        style={filterInput}
                                        value={filters.category}
                                        onChange={e => setFilters({ ...filters, category: e.target.value })}
                                    >
                                        <option value="all">Усі категорії</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div style={filterItem}>
                                    <label style={filterLabel}>Статус</label>
                                    <select
                                        style={filterInput}
                                        value={filters.status}
                                        onChange={e => setFilters({ ...filters, status: e.target.value })}
                                    >
                                        <option value="all">Усі статуси</option>
                                        <option value="published">Опубліковані</option>
                                        <option value="draft">Чернетки</option>
                                    </select>
                                </div>
                                <div style={filterItem}>
                                    <label style={filterLabel}>Популярні</label>
                                    <select
                                        style={filterInput}
                                        value={filters.popular}
                                        onChange={e => setFilters({ ...filters, popular: e.target.value })}
                                    >
                                        <option value="all">Усі</option>
                                        <option value="yes">Так (⭐)</option>
                                        <option value="no">Ні</option>
                                    </select>
                                </div>
                                <div style={filterItem}>
                                    <label style={filterLabel}>Ціна (від - до)</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="number"
                                            placeholder="Мін"
                                            style={filterInput}
                                            value={filters.minPrice}
                                            onChange={e => setFilters({ ...filters, minPrice: e.target.value })}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Макс"
                                            style={filterInput}
                                            value={filters.maxPrice}
                                            onChange={e => setFilters({ ...filters, maxPrice: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                                <button onClick={resetFilters} style={resetBtn}>
                                    <RotateCcw size={16} /> Скинути
                                </button>
                                <button onClick={() => setIsFilterOpen(false)} style={applyBtn}>
                                    Застосувати
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Products Table */}
            <div style={tableCardStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1.5px solid #f1f5f9', backgroundColor: '#fcfcfd' }}>
                            <th style={thStyle}>Товар</th>
                            <th style={thStyle}>Категорія</th>
                            <th style={thStyle}>Ціна</th>
                            <th style={thStyle}>Склад</th>
                            <th style={thStyle}>Статус</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '100px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><RotateCcw size={32} color="#6366f1" /></motion.div>
                                    <span style={{ fontWeight: 700, color: '#64748b' }}>Завантаження...</span>
                                </div>
                            </td></tr>
                        ) : filteredProducts.length > 0 ? filteredProducts.map(product => (
                            <motion.tr
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                key={product.id}
                                style={{ borderBottom: '1px solid #f8fafc' }}
                            >
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={thumbnailWrapperStyle}>
                                            {product.images?.[0] ? <img src={product.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={20} color="#cbd5e1" />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#263A99' }}>{product.name} {product.is_popular && '⭐'}</div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{product.slug}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <span style={catBadge}>{product.categories?.name || 'Без категорії'}</span>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: 800, color: '#263A99' }}>{Number(product.price).toLocaleString()} ₴</div>
                                </td>
                                <td style={tdStyle}>
                                    <span style={{
                                        fontWeight: 800,
                                        color: product.stock < 10 ? '#ef4444' : '#64748b',
                                        backgroundColor: product.stock < 10 ? '#fef2f2' : '#f8fafc',
                                        padding: '4px 10px',
                                        borderRadius: "3px",
                                        fontSize: '13px'
                                    }}>
                                        {product.stock} шт.
                                    </span>
                                </td>
                                <td style={tdStyle}>
                                    <button
                                        onClick={() => toggleStatus(product.id, product.is_active)}
                                        style={{ ...statusBadgeStyle, backgroundColor: product.is_active ? '#dcfce7' : '#f1f5f9', color: product.is_active ? '#15803d' : '#64748b' }}
                                    >
                                        {product.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        {product.is_active ? 'Активний' : 'Чернетка'}
                                    </button>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <Link href={`/admin/catalog/product/edit/${product.id}`} style={actionIconStyle}><Edit size={18} /></Link>
                                        <button
                                            onClick={() => setDeleteModal({ isOpen: true, productId: product.id, productName: product.name })}
                                            style={{ ...actionIconStyle, color: '#ef4444', backgroundColor: '#fef2f2' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </motion.tr>
                        )) : (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '100px', color: '#94a3b8', fontWeight: 700 }}>Товарів не знайдено</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Custom Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModal.isOpen && (
                    <div style={modalOverlay}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={modalContent}
                        >
                            <div style={modalHeader}>
                                <div style={alertIconWrapper}>
                                    <AlertTriangle size={24} color="#ef4444" />
                                </div>
                                <h2 style={modalTitle}>Видалення товару</h2>
                            </div>
                            <p style={modalText}>
                                Ви впевнені, що хочете видалити товар <strong>"{deleteModal.productName}"</strong>?
                                <br />Цю дію неможливо буде скасувати.
                            </p>
                            <div style={modalFooter}>
                                <button onClick={() => setDeleteModal({ isOpen: false, productId: null, productName: '' })} style={cancelBtn}>Скасувати</button>
                                <button onClick={confirmDelete} style={deleteBtn}>Видалити</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Styles
const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28px', backgroundColor: '#263A99', color: 'white', borderRadius: "3px", textDecoration: 'none', fontWeight: 800, fontSize: '15px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };
const searchWrapperStyle = { position: 'relative' as any, display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '0 20px', borderRadius: "3px", border: '1.5px solid #e2e8f0', flex: 1, boxShadow: '0 4px 10px rgba(0,0,0,0.01)' };
const searchInputStyle = { border: 'none', padding: '14px 0', outline: 'none', width: '100%', fontSize: '15px', marginLeft: '12px', fontWeight: 600, color: '#263A99' };
const filterBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 24px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', borderRadius: "3px", color: '#475569', fontWeight: 700, fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s' };
const tableCardStyle = { backgroundColor: 'white', borderRadius: "3px", boxShadow: '0 10px 40px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', overflow: 'hidden' };
const thStyle = { textAlign: 'left' as any, padding: '24px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.1em', fontWeight: 900 };
const tdStyle = { padding: '24px', fontSize: '15px', color: '#263A99' };
const thumbnailWrapperStyle = { width: '56px', height: '56px', borderRadius: "3px", backgroundColor: '#f8fafc', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f1f5f9' };
const catBadge = { backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: "3px", fontSize: '13px', fontWeight: 700, color: '#444' };
const statusBadgeStyle = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: "3px", fontSize: '12px', fontWeight: 900, border: 'none', cursor: 'pointer', textTransform: 'uppercase' as any };
const actionIconStyle = { width: '40px', height: '40px', borderRadius: "3px", backgroundColor: '#f8fafc', color: '#64748b', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' };

const filterPanelCard = { backgroundColor: 'white', padding: '32px', borderRadius: "3px", border: '1.5px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' };
const filterGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' };
const filterItem = { display: 'flex', flexDirection: 'column' as any, gap: '8px' };
const filterLabel = { fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
const filterInput = { padding: '14px 16px', borderRadius: "3px", border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', fontWeight: 700, color: '#263A99', width: '100%', backgroundColor: '#fcfcfd' };
const applyBtn = { backgroundColor: '#263A99', color: 'white', border: 'none', padding: '12px 32px', borderRadius: "3px", fontWeight: 800, fontSize: '14px', cursor: 'pointer' };
const resetBtn = { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '12px 24px', borderRadius: "3px", fontWeight: 800, fontSize: '14px', cursor: 'pointer' };

const modalOverlay = { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(38, 58, 153, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: 'white', borderRadius: "3px", padding: '40px', maxWidth: '440px', width: '90%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' };
const modalHeader = { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' };
const alertIconWrapper = { width: '56px', height: '56px', borderRadius: "3px", backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalTitle = { fontSize: '22px', fontWeight: 950, color: '#263A99', margin: 0 };
const modalText = { fontSize: '16px', color: '#64748b', lineHeight: '1.6', marginBottom: '32px' };
const modalFooter = { display: 'flex', gap: '16px' };
const deleteBtn = { flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '16px', borderRadius: "3px", fontWeight: 800, fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.2)' };
const cancelBtn = { flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '16px', borderRadius: "3px", fontWeight: 800, fontSize: '15px', cursor: 'pointer' };
