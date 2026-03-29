'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Package,
    AlertTriangle,
    Plus,
    Minus,
    Download,
    Save,
    Edit,
    X,
    TrendingUp,
    TrendingDown,
    Box,
    Layers,
    Activity,
    Trash2,
    Clock,
    ChevronLeft,
    ChevronRight,
    Filter
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface Product {
    id: string;
    name: string;
    stock_quantity: number;
    stock_reserved: number;
    low_stock_threshold: number;
    stock_available?: number;
}

interface Material {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    min_quantity: number;
    supplier: string;
    cost_per_unit: number;
}

interface HistoryEntry {
    id: string;
    product_id: string;
    type?: string;
    action_type: string;
    quantity: number;
    quantity_before: number;
    quantity_after: number;
    reason?: string;
    admin_comment: string;
    admin_name: string;
    created_at: string;
    products?: { name: string };
}

export default function StockPage() {
    const supabase = createClient();

    const [products, setProducts] = useState<Product[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);

    // Low stock alerts
    const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
    const [lowStockMaterials, setLowStockMaterials] = useState<Material[]>([]);

    // Modals
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [movementType, setMovementType] = useState<'product' | 'material'>('product');
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [movementData, setMovementData] = useState({
        type: 'in',
        quantity: 0,
        reason: ''
    });

    // Edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editModalProduct, setEditModalProduct] = useState<Product | null>(null);
    const [editModalData, setEditModalData] = useState({ quantity: 0, minLevel: 0, comment: '' });

    // Delete modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
    const [deleteReason, setDeleteReason] = useState('');

    // History
    const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(0);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyFilterProduct, setHistoryFilterProduct] = useState('');
    const [historyFilterAction, setHistoryFilterAction] = useState('');
    const [historyFilterDateFrom, setHistoryFilterDateFrom] = useState('');
    const [historyFilterDateTo, setHistoryFilterDateTo] = useState('');
    const HISTORY_PAGE_SIZE = 20;

    // Inline editing
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState(0);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchProducts(), fetchMaterials()]);
        setLoading(false);
    };

    const fetchProducts = async () => {
        const { data } = await supabase
            .from('products')
            .select('id, name, stock_quantity, stock_reserved, low_stock_threshold')
            .order('name');

        if (data) {
            const productsWithAvailable = data.map(p => ({
                ...p,
                stock_available: (p.stock_quantity || 0) - (p.stock_reserved || 0)
            }));
            setProducts(productsWithAvailable);

            // Find low stock products
            const lowStock = productsWithAvailable.filter(
                p => (p.stock_quantity || 0) <= (p.low_stock_threshold || 0)
            );
            setLowStockProducts(lowStock);
        }
    };

    const fetchMaterials = async () => {
        const { data } = await supabase
            .from('materials')
            .select('*')
            .order('name');

        if (data) {
            setMaterials(data);

            // Find low stock materials
            const lowStock = data.filter(m => (m.quantity || 0) <= (m.min_quantity || 0));
            setLowStockMaterials(lowStock);
        }
    };

    const updateProductStock = async (productId: string, newQuantity: number) => {
        try {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            const { error } = await supabase
                .from('products')
                .update({ stock_quantity: newQuantity })
                .eq('id', productId);

            if (error) throw error;

            toast.success('Запас оновлено');
            setEditingProductId(null);
            await fetchProducts();
        } catch (error) {
            console.error('Error updating stock:', error);
            toast.error('Помилка оновлення запасу');
        }
    };

    const updateMaterialQuantity = async (materialId: string, newQuantity: number) => {
        try {
            const { error } = await supabase
                .from('materials')
                .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
                .eq('id', materialId);

            if (error) throw error;

            toast.success('Кількість матеріалу оновлено');
            setEditingMaterialId(null);
            await fetchMaterials();
        } catch (error) {
            console.error('Error updating material:', error);
            toast.error('Помилка оновлення матеріалу');
        }
    };

    const openMovementModal = (item: any, type: 'product' | 'material', direction: 'in' | 'out') => {
        setSelectedItem(item);
        setMovementType(type);
        setMovementData({ type: direction, quantity: 0, reason: '' });
        setShowMovementModal(true);
    };

    const handleMovementSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || movementData.quantity <= 0) {
            toast.error('Введіть коректну кількість');
            return;
        }
        if (!movementData.reason.trim()) {
            toast.error(movementData.type === 'in' ? 'Вкажіть причину поповнення' : 'Вкажіть причину списання');
            return;
        }

        try {
            const qty = movementData.type === 'out' ? -movementData.quantity : movementData.quantity;

            if (movementType === 'product') {
                const currentQty = selectedItem.stock_quantity || 0;
                const newQty = currentQty + qty;

                if (newQty < 0) {
                    toast.error('Недостатньо запасу');
                    return;
                }

                // Log movement in inventory_movements
                await supabase.from('inventory_movements').insert({
                    product_id: selectedItem.id,
                    type: movementData.type,
                    action_type: movementData.type === 'in' ? 'add' : 'subtract',
                    quantity: Math.abs(qty),
                    quantity_before: currentQty,
                    quantity_after: newQty,
                    reason: movementData.reason,
                    admin_comment: movementData.reason,
                    notes: movementData.reason
                });

                // Update product stock
                await supabase
                    .from('products')
                    .update({ stock_quantity: newQty })
                    .eq('id', selectedItem.id);

                toast.success(`Запас ${movementData.type === 'in' ? 'збільшено' : 'зменшено'}`);
                await fetchProducts();
            } else {
                const currentQty = selectedItem.quantity || 0;
                const newQty = currentQty + qty;

                if (newQty < 0) {
                    toast.error('Недостатньо матеріалу');
                    return;
                }

                // Log movement in materials_movements
                await supabase.from('materials_movements').insert({
                    material_id: selectedItem.id,
                    type: movementData.type,
                    quantity: Math.abs(qty),
                    quantity_before: currentQty,
                    quantity_after: newQty,
                    reason: movementData.reason,
                    notes: movementData.reason
                });

                // Update material quantity
                await supabase
                    .from('materials')
                    .update({ quantity: newQty, updated_at: new Date().toISOString() })
                    .eq('id', selectedItem.id);

                toast.success(`Матеріал ${movementData.type === 'in' ? 'додано' : 'списано'}`);
                await fetchMaterials();
            }

            setShowMovementModal(false);
            setMovementData({ type: 'in', quantity: 0, reason: '' });
        } catch (error) {
            console.error('Movement error:', error);
            toast.error('Помилка руху запасів');
        }
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Products sheet
        const productsData = [
            ['Продукт', 'На складі', 'Зарезервовано', 'Доступно', 'Мін. рівень', 'Статус'],
            ...products.map(p => [
                p.name,
                p.stock_quantity || 0,
                p.stock_reserved || 0,
                p.stock_available || 0,
                p.low_stock_threshold || 0,
                (p.stock_quantity || 0) <= (p.low_stock_threshold || 0) ? 'НИЗЬКИЙ ЗАПАС' : 'OK'
            ])
        ];
        const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
        XLSX.utils.book_append_sheet(wb, wsProducts, 'Продукти');

        // Materials sheet
        const materialsData = [
            ['Матеріал', 'Одиниця', 'Кількість', 'Мін. кількість', 'Постачальник', 'Ціна/од', 'Статус'],
            ...materials.map(m => [
                m.name,
                m.unit,
                m.quantity || 0,
                m.min_quantity || 0,
                m.supplier || '',
                m.cost_per_unit || 0,
                (m.quantity || 0) <= (m.min_quantity || 0) ? 'НИЗЬКИЙ ЗАПАС' : 'OK'
            ])
        ];
        const wsMaterials = XLSX.utils.aoa_to_sheet(materialsData);
        XLSX.utils.book_append_sheet(wb, wsMaterials, 'Матеріали');

        XLSX.writeFile(wb, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel файл завантажено');
    };

    // ── Edit modal handlers ──
    const openEditModal = (product: Product) => {
        setEditModalProduct(product);
        setEditModalData({
            quantity: product.stock_quantity || 0,
            minLevel: product.low_stock_threshold || 0,
            comment: ''
        });
        setShowEditModal(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editModalProduct || !editModalData.comment.trim()) {
            toast.error('Коментар обов\'язковий');
            return;
        }
        try {
            const oldQty = editModalProduct.stock_quantity || 0;
            const newQty = editModalData.quantity;
            await supabase.from('products')
                .update({ stock_quantity: newQty, low_stock_threshold: editModalData.minLevel })
                .eq('id', editModalProduct.id);
            await supabase.from('product_stock')
                .upsert({ product_id: editModalProduct.id, quantity_in_stock: newQty, min_level: editModalData.minLevel, updated_at: new Date().toISOString() }, { onConflict: 'product_id' });
            await supabase.from('inventory_movements').insert({
                product_id: editModalProduct.id,
                type: 'adjustment',
                action_type: 'edit',
                quantity: newQty,
                quantity_before: oldQty,
                quantity_after: newQty,
                reason: editModalData.comment,
                admin_comment: editModalData.comment,
                notes: editModalData.comment
            });
            toast.success('Продукт оновлено');
            setShowEditModal(false);
            await fetchProducts();
        } catch (error) {
            console.error('Edit error:', error);
            toast.error('Помилка оновлення');
        }
    };

    // ── Delete modal handlers ──
    const openDeleteModal = (product: Product) => {
        setDeleteProduct(product);
        setDeleteReason('');
        setShowDeleteModal(true);
    };

    const handleDeleteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deleteProduct || !deleteReason.trim()) {
            toast.error('Причина обов\'язкова');
            return;
        }
        try {
            await supabase.from('inventory_movements').insert({
                product_id: deleteProduct.id,
                type: 'out',
                action_type: 'delete',
                quantity: deleteProduct.stock_quantity || 0,
                quantity_before: deleteProduct.stock_quantity || 0,
                quantity_after: 0,
                reason: deleteReason,
                admin_comment: deleteReason,
                notes: deleteReason
            });
            await supabase.from('product_stock').delete().eq('product_id', deleteProduct.id);
            await supabase.from('products').update({ stock_quantity: 0, stock_reserved: 0 }).eq('id', deleteProduct.id);
            toast.success('Запис видалено');
            setShowDeleteModal(false);
            await fetchProducts();
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Помилка видалення');
        }
    };

    // ── History fetch ──
    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            let query = supabase.from('inventory_movements')
                .select('*, products(name)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE - 1);

            if (historyFilterProduct) {
                query = query.eq('product_id', historyFilterProduct);
            }
            if (historyFilterAction) {
                query = query.eq('action_type', historyFilterAction);
            }
            if (historyFilterDateFrom) {
                query = query.gte('created_at', historyFilterDateFrom + 'T00:00:00');
            }
            if (historyFilterDateTo) {
                query = query.lte('created_at', historyFilterDateTo + 'T23:59:59');
            }

            const { data, count, error } = await query;
            if (error) throw error;
            setHistory((data || []) as HistoryEntry[]);
            setHistoryTotal(count || 0);
        } catch (error) {
            console.error('History error:', error);
            toast.error('Помилка завантаження історії');
        } finally {
            setHistoryLoading(false);
        }
    }, [historyPage, historyFilterProduct, historyFilterAction, historyFilterDateFrom, historyFilterDateTo]);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, fetchHistory]);

    const actionTypeLabel = (t: string) => {
        const map: Record<string, string> = { add: 'Додано', subtract: 'Списано', edit: 'Редагування', delete: 'Видалено', reserve: 'Резерв', unreserve: 'Знято резерв', in: 'Надходження', out: 'Списання', adjustment: 'Коригування' };
        return map[t] || t;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <Activity className="animate-spin" size={48} color="#263A99" />
            </div>
        );
    }

    const totalLowStock = lowStockProducts.length + lowStockMaterials.length;

    return (
        <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                        Складський облік
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Управління запасами продуктів і матеріалів
                    </p>
                </div>

                <button
                    onClick={exportToExcel}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        backgroundColor: '#263A99',
                        color: 'white',
                        borderRadius: '3px',
                        border: 'none',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <Download size={18} />
                    Експорт Excel
                </button>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '32px', borderBottom: '2px solid #e2e8f0' }}>
                <button
                    onClick={() => setActiveTab('stock')}
                    style={{
                        padding: '12px 24px', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
                        color: activeTab === 'stock' ? '#263A99' : '#64748b',
                        borderBottom: activeTab === 'stock' ? '3px solid #263A99' : '3px solid transparent',
                        marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Package size={18} /> Складський облік
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    style={{
                        padding: '12px 24px', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
                        color: activeTab === 'history' ? '#263A99' : '#64748b',
                        borderBottom: activeTab === 'history' ? '3px solid #263A99' : '3px solid transparent',
                        marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                >
                    <Clock size={18} /> Історія змін
                </button>
            </div>

            {activeTab === 'stock' && (<>

            {/* Low Stock Alert Banner */}
            {totalLowStock > 0 && (
                <div style={{
                    padding: '20px 24px',
                    backgroundColor: '#fef3c7',
                    border: '2px solid #f59e0b',
                    borderRadius: '3px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <AlertTriangle size={24} color="#f59e0b" />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '16px', fontWeight: 700, color: '#78350f', marginBottom: '4px' }}>
                            Попередження про низький запас
                        </p>
                        <p style={{ fontSize: '14px', color: '#92400e' }}>
                            {lowStockProducts.length > 0 && `${lowStockProducts.length} продуктів`}
                            {lowStockProducts.length > 0 && lowStockMaterials.length > 0 && ' та '}
                            {lowStockMaterials.length > 0 && `${lowStockMaterials.length} матеріалів`}
                            {' '}нижче мінімального рівня. Необхідне поповнення.
                        </p>
                    </div>
                </div>
            )}

            {/* Products Inventory Section */}
            <div style={{
                padding: '24px',
                backgroundColor: 'white',
                borderRadius: '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '32px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Package size={24} color="#263A99" />
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                        Запаси продуктів
                    </h2>
                    <span style={{
                        marginLeft: 'auto',
                        padding: '4px 12px',
                        backgroundColor: '#eef0fb',
                        color: '#263A99',
                        borderRadius: '3px',
                        fontSize: '14px',
                        fontWeight: 600
                    }}>
                        {products.length} позицій
                    </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <th style={thStyle}>Продукт</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>На складі</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Зарезервовано</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Доступно</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Мін. рівень</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(product => {
                                const isLowStock = (product.stock_quantity || 0) <= (product.low_stock_threshold || 0);
                                const isEditing = editingProductId === product.id;

                                return (
                                    <tr
                                        key={product.id}
                                        style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            backgroundColor: isLowStock ? '#fef3c7' : 'transparent'
                                        }}
                                    >
                                        <td style={{ padding: '16px', fontSize: '15px', color: '#0f172a', fontWeight: 600 }}>
                                            {isLowStock && <AlertTriangle size={16} color="#f59e0b" style={{ marginRight: '8px', display: 'inline' }} />}
                                            {product.name}
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={e => setEditValue(Number(e.target.value))}
                                                        style={{
                                                            width: '80px',
                                                            padding: '6px 10px',
                                                            border: '1px solid #263A99',
                                                            borderRadius: '3px',
                                                            fontSize: '14px',
                                                            textAlign: 'right'
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => updateProductStock(product.id, editValue)}
                                                        style={{
                                                            padding: '6px 10px',
                                                            backgroundColor: '#22c55e',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Save size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingProductId(null)}
                                                        style={{
                                                            padding: '6px 10px',
                                                            backgroundColor: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                                        {product.stock_quantity || 0}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            setEditingProductId(product.id);
                                                            setEditValue(product.stock_quantity || 0);
                                                        }}
                                                        style={{
                                                            padding: '4px',
                                                            backgroundColor: 'transparent',
                                                            color: '#64748b',
                                                            border: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '15px', color: '#64748b', textAlign: 'right' }}>
                                            {product.stock_reserved || 0}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '16px', fontWeight: 700, color: '#263A99', textAlign: 'right' }}>
                                            {product.stock_available || 0}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#94a3b8', textAlign: 'right' }}>
                                            {product.low_stock_threshold || 0}
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => openMovementModal(product, 'product', 'in')}
                                                    style={{ padding: '6px 10px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '3px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                >
                                                    <Plus size={13} /> Додати
                                                </button>
                                                <button
                                                    onClick={() => openMovementModal(product, 'product', 'out')}
                                                    style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '3px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                >
                                                    <Minus size={13} /> Списати
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(product)}
                                                    title="Редагувати"
                                                    style={{ padding: '6px 8px', backgroundColor: '#263A99', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => openDeleteModal(product)}
                                                    title="Видалити"
                                                    style={{ padding: '6px 8px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Materials Inventory Section */}
            <div style={{
                padding: '24px',
                backgroundColor: 'white',
                borderRadius: '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Layers size={24} color="#14b8a6" />
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                        Запаси матеріалів
                    </h2>
                    <span style={{
                        marginLeft: 'auto',
                        padding: '4px 12px',
                        backgroundColor: '#ccfbf1',
                        color: '#0f766e',
                        borderRadius: '3px',
                        fontSize: '14px',
                        fontWeight: 600
                    }}>
                        {materials.length} позицій
                    </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <th style={thStyle}>Матеріал</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Одиниця</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Кількість</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Мін. рівень</th>
                                <th style={thStyle}>Постачальник</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Ціна/од</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {materials.map(material => {
                                const isLowStock = (material.quantity || 0) <= (material.min_quantity || 0);
                                const isEditing = editingMaterialId === material.id;

                                return (
                                    <tr
                                        key={material.id}
                                        style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            backgroundColor: isLowStock ? '#fef3c7' : 'transparent'
                                        }}
                                    >
                                        <td style={{ padding: '16px', fontSize: '15px', color: '#0f172a', fontWeight: 600 }}>
                                            {isLowStock && <AlertTriangle size={16} color="#f59e0b" style={{ marginRight: '8px', display: 'inline' }} />}
                                            {material.name}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'center' }}>
                                            {material.unit}
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={e => setEditValue(Number(e.target.value))}
                                                        style={{
                                                            width: '80px',
                                                            padding: '6px 10px',
                                                            border: '1px solid #14b8a6',
                                                            borderRadius: '3px',
                                                            fontSize: '14px',
                                                            textAlign: 'right'
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => updateMaterialQuantity(material.id, editValue)}
                                                        style={{
                                                            padding: '6px 10px',
                                                            backgroundColor: '#22c55e',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Save size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingMaterialId(null)}
                                                        style={{
                                                            padding: '6px 10px',
                                                            backgroundColor: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                                        {material.quantity || 0}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            setEditingMaterialId(material.id);
                                                            setEditValue(material.quantity || 0);
                                                        }}
                                                        style={{
                                                            padding: '4px',
                                                            backgroundColor: 'transparent',
                                                            color: '#64748b',
                                                            border: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#94a3b8', textAlign: 'right' }}>
                                            {material.min_quantity || 0}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                                            {material.supplier || '—'}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '15px', fontWeight: 600, color: '#0f766e', textAlign: 'right' }}>
                                            ₴{(material.cost_per_unit || 0).toFixed(2)}
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => openMovementModal(material, 'material', 'in')}
                                                    style={{
                                                        padding: '8px 12px',
                                                        backgroundColor: '#22c55e',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '3px',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Plus size={14} /> Додати
                                                </button>
                                                <button
                                                    onClick={() => openMovementModal(material, 'material', 'out')}
                                                    style={{
                                                        padding: '8px 12px',
                                                        backgroundColor: '#ef4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '3px',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Minus size={14} /> Списати
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            </>)}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div style={{ padding: '24px', backgroundColor: 'white', borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <Clock size={24} color="#263A99" />
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Історія змін</h2>
                        <span style={{ marginLeft: 'auto', padding: '4px 12px', backgroundColor: '#eef0fb', color: '#263A99', borderRadius: '3px', fontSize: '14px', fontWeight: 600 }}>
                            {historyTotal} записів
                        </span>
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Продукт</label>
                            <select
                                value={historyFilterProduct}
                                onChange={e => { setHistoryFilterProduct(e.target.value); setHistoryPage(0); }}
                                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '14px', minWidth: '200px' }}
                            >
                                <option value="">Усі продукти</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Дія</label>
                            <select
                                value={historyFilterAction}
                                onChange={e => { setHistoryFilterAction(e.target.value); setHistoryPage(0); }}
                                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '14px' }}
                            >
                                <option value="">Усі дії</option>
                                <option value="add">Додано</option>
                                <option value="subtract">Списано</option>
                                <option value="edit">Редагування</option>
                                <option value="delete">Видалено</option>
                                <option value="reserve">Резерв</option>
                                <option value="unreserve">Знято резерв</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Від</label>
                            <input type="date" value={historyFilterDateFrom} onChange={e => { setHistoryFilterDateFrom(e.target.value); setHistoryPage(0); }}
                                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '14px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>До</label>
                            <input type="date" value={historyFilterDateTo} onChange={e => { setHistoryFilterDateTo(e.target.value); setHistoryPage(0); }}
                                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '14px' }} />
                        </div>
                        <button onClick={() => { setHistoryFilterProduct(''); setHistoryFilterAction(''); setHistoryFilterDateFrom(''); setHistoryFilterDateTo(''); setHistoryPage(0); }}
                            style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', backgroundColor: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={14} /> Скинути
                        </button>
                    </div>

                    {/* History Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={thStyle}>Дата</th>
                                    <th style={thStyle}>Продукт</th>
                                    <th style={thStyle}>Дія</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Кількість (до→після)</th>
                                    <th style={thStyle}>Коментар</th>
                                    <th style={thStyle}>Хто</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyLoading ? (
                                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Завантаження...</td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Записів не знайдено</td></tr>
                                ) : history.map(entry => (
                                    <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#475569', whiteSpace: 'nowrap' }}>
                                            {new Date(entry.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                            {entry.products?.name || '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '3px', fontSize: '12px', fontWeight: 600,
                                                backgroundColor: entry.action_type === 'add' ? '#dcfce7' : entry.action_type === 'subtract' ? '#fef2f2' : entry.action_type === 'edit' ? '#dbeafe' : entry.action_type === 'delete' ? '#fef2f2' : '#f1f5f9',
                                                color: entry.action_type === 'add' ? '#166534' : entry.action_type === 'subtract' ? '#991b1b' : entry.action_type === 'edit' ? '#1e40af' : entry.action_type === 'delete' ? '#991b1b' : '#475569'
                                            }}>
                                                {actionTypeLabel(entry.action_type || entry.type || '')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#475569', textAlign: 'center' }}>
                                            {entry.quantity_before} → {entry.quantity_after}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {entry.admin_comment || entry.reason || '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                                            {entry.admin_name || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {historyTotal > HISTORY_PAGE_SIZE && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
                            <button
                                onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                                disabled={historyPage === 0}
                                style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '3px', cursor: historyPage === 0 ? 'not-allowed' : 'pointer', opacity: historyPage === 0 ? 0.5 : 1, backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: 600 }}
                            >
                                <ChevronLeft size={16} /> Назад
                            </button>
                            <span style={{ fontSize: '14px', color: '#64748b' }}>
                                {historyPage + 1} / {Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
                            </span>
                            <button
                                onClick={() => setHistoryPage(historyPage + 1)}
                                disabled={(historyPage + 1) * HISTORY_PAGE_SIZE >= historyTotal}
                                style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '3px', cursor: (historyPage + 1) * HISTORY_PAGE_SIZE >= historyTotal ? 'not-allowed' : 'pointer', opacity: (historyPage + 1) * HISTORY_PAGE_SIZE >= historyTotal ? 0.5 : 1, backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: 600 }}
                            >
                                Далі <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editModalProduct && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '3px', padding: '32px', width: '500px', maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <Edit size={24} color="#263A99" />
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Редагувати запас</h3>
                            <button onClick={() => setShowEditModal(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '20px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '3px' }}>{editModalProduct.name}</p>
                        <form onSubmit={handleEditSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Кількість на складі</label>
                                    <input type="number" value={editModalData.quantity} onChange={e => setEditModalData({ ...editModalData, quantity: Number(e.target.value) })}
                                        style={{ width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '15px' }} required autoFocus />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Мін. рівень</label>
                                    <input type="number" value={editModalData.minLevel} onChange={e => setEditModalData({ ...editModalData, minLevel: Number(e.target.value) })}
                                        style={{ width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '15px' }} required />
                                </div>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Коментар до зміни *</label>
                                <textarea value={editModalData.comment} onChange={e => setEditModalData({ ...editModalData, comment: e.target.value })}
                                    placeholder="Вкажіть причину зміни..." style={{ width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '15px', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} required />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" style={{ flex: 1, padding: '12px 24px', backgroundColor: '#263A99', color: 'white', border: 'none', borderRadius: '3px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>Зберегти</button>
                                <button type="button" onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: '12px 24px', backgroundColor: '#94a3b8', color: 'white', border: 'none', borderRadius: '3px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>Скасувати</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deleteProduct && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '3px', padding: '32px', width: '500px', maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <Trash2 size={24} color="#dc2626" />
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>Видалити запис</h3>
                            <button onClick={() => setShowDeleteModal(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>Ви впевнені?</p>
                        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Запас для «{deleteProduct.name}» буде обнулено та видалено з обліку.</p>
                        <form onSubmit={handleDeleteSubmit}>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Введіть причину видалення *</label>
                                <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                                    placeholder="Причина видалення..." style={{ width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '15px', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} required />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" style={{ flex: 1, padding: '12px 24px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '3px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>Видалити</button>
                                <button type="button" onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: '12px 24px', backgroundColor: '#94a3b8', color: 'white', border: 'none', borderRadius: '3px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>Скасувати</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Movement Modal */}
            {showMovementModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '3px',
                        padding: '32px',
                        width: '500px',
                        maxWidth: '90vw'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            {movementData.type === 'in' ? (
                                <TrendingUp size={24} color="#22c55e" />
                            ) : (
                                <TrendingDown size={24} color="#ef4444" />
                            )}
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                                {movementData.type === 'in' ? 'Додати запас' : 'Списати запас'}
                            </h3>
                        </div>

                        <form onSubmit={handleMovementSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                    {movementType === 'product' ? 'Продукт' : 'Матеріал'}
                                </label>
                                <div style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '3px',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    color: '#0f172a'
                                }}>
                                    {selectedItem?.name}
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                    Кількість
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={movementData.quantity}
                                    onChange={e => setMovementData({ ...movementData, quantity: Number(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '3px',
                                        fontSize: '15px'
                                    }}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                    {movementData.type === 'in' ? 'Причина поповнення *' : 'Причина списання *'}
                                </label>
                                <textarea
                                    value={movementData.reason}
                                    onChange={e => setMovementData({ ...movementData, reason: e.target.value })}
                                    placeholder={movementData.type === 'in' ? 'Наприклад: Нова поставка від постачальника' : 'Наприклад: Використано у виробництві'}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '3px',
                                        fontSize: '15px',
                                        minHeight: '80px',
                                        resize: 'vertical',
                                        fontFamily: 'inherit'
                                    }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        padding: '12px 24px',
                                        backgroundColor: movementData.type === 'in' ? '#22c55e' : '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {movementData.type === 'in' ? 'Додати' : 'Списати'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowMovementModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '12px 24px',
                                        backgroundColor: '#94a3b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Скасувати
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase'
};
