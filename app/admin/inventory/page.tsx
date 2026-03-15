'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Box,
    RefreshCw,
    AlertTriangle,
    Plus,
    PenLine,
    ArrowUpRight,
    ArrowDownRight,
    History,
    Search,
    Filter,
    X,
    ShoppingCart,
    Package,
    TrendingUp,
    CheckCircle2,
    Loader2,
    Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

export default function InventoryAdminPage() {
    const supabase = createClient();

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');

    const [showSupplyModal, setShowSupplyModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);

    // Modal forms
    const [supplyData, setSupplyData] = useState({ quantity: 0, supplier: '', invoice_number: '', cost_per_unit: 0, date: new Date().toISOString().slice(0, 10), notes: '' });
    const [adjustData, setAdjustData] = useState({ new_quantity: 0, reason: 'Інвентаризація', notes: '' });
    const [movements, setMovements] = useState<any[]>([]);

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select(`id, name, stock, stock_reserved, low_stock_threshold, cost_price, cost_price_currency, track_inventory, images`)
            .eq('track_inventory', true)
            .order('stock', { ascending: true }); // Lowest first

        if (!error && data) {
            setProducts(data);
        }
        setLoading(false);
    };

    const fetchHistory = async (productId: string) => {
        const { data } = await supabase
            .from('inventory_movements')
            .select(`*, staff:added_by(name)`)
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (data) setMovements(data);
    };

    const handleSupplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || supplyData.quantity <= 0) return;
        const loadingToast = toast.loading('Збереження поставки...');

        const qty = parseInt(supplyData.quantity.toString());
        const cost = parseFloat(supplyData.cost_per_unit.toString());

        try {
            // 1. Log movement
            const { error: moveError } = await supabase.from('inventory_movements').insert({
                product_id: selectedProduct.id,
                type: 'in',
                quantity: qty,
                quantity_before: selectedProduct.stock,
                quantity_after: selectedProduct.stock + qty,
                reason: 'Нова поставка',
                cost_per_unit: cost,
                supplier: supplyData.supplier,
                invoice_number: supplyData.invoice_number,
                notes: supplyData.notes,
                created_at: new Date(supplyData.date).toISOString()
            });

            if (moveError) throw moveError;

            // 2. Update Product
            await supabase.from('products').update({
                stock: selectedProduct.stock + qty,
                cost_price: cost
            }).eq('id', selectedProduct.id);

            toast.dismiss(loadingToast);
            toast.success('Поставка успішно прийнята');
            setShowSupplyModal(false);
            fetchInventory();
        } catch (e: any) {
            toast.dismiss(loadingToast);
            toast.error(e.message || 'Помилка при збереженні');
        }
    };

    const handleAdjustSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;
        const loadingToast = toast.loading('Коригування залишків...');

        const newQty = parseInt(adjustData.new_quantity.toString());
        const diff = newQty - selectedProduct.stock;

        try {
            // 1. Log movement
            const { error: moveError } = await supabase.from('inventory_movements').insert({
                product_id: selectedProduct.id,
                type: 'adjustment',
                quantity: diff,
                quantity_before: selectedProduct.stock,
                quantity_after: newQty,
                reason: adjustData.reason,
                notes: adjustData.notes
            });

            if (moveError) throw moveError;

            // 2. Update Product
            await supabase.from('products').update({
                stock: newQty
            }).eq('id', selectedProduct.id);

            toast.dismiss(loadingToast);
            toast.success('Залишок успішно скориговано');
            setShowAdjustModal(false);
            fetchInventory();
        } catch (e: any) {
            toast.dismiss(loadingToast);
            toast.error(e.message || 'Помилка');
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const available = p.stock - (p.stock_reserved || 0);

        let matchesStatus = true;
        if (filterStatus === 'low') matchesStatus = available > 0 && available <= (p.low_stock_threshold || 5);
        if (filterStatus === 'out') matchesStatus = available <= 0;

        return matchesSearch && matchesStatus;
    });

    const getStatusInfo = (p: any) => {
        const available = p.stock - (p.stock_reserved || 0);
        if (available <= 0) return { label: 'Немає в наявності', color: '#ef4444', bg: '#fef2f2' };
        if (available <= (p.low_stock_threshold || 5)) return { label: 'Мало залишків', color: '#f59e0b', bg: '#fffbeb' };
        return { label: 'В наявності', color: '#10b981', bg: '#f0fdf4' };
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#263A99' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        Склад <Box style={{ color: '#94a3b8' }} size={28} />
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Управління залишками та контроль запасів.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={fetchInventory} style={refreshBtnStyle}>
                        <RefreshCw size={18} /> Оновити
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div style={statsGridStyle}>
                <div style={statCardStyle}>
                    <div style={{ ...statIconStyle, backgroundColor: '#eff6ff', color: '#263A99' }}><Package size={20} /></div>
                    <div>
                        <div style={statLabelStyle}>Всього SKU</div>
                        <div style={statValueStyle}>{products.length}</div>
                    </div>
                </div>
                <div style={statCardStyle}>
                    <div style={{ ...statIconStyle, backgroundColor: '#fffbeb', color: '#f59e0b' }}><AlertTriangle size={20} /></div>
                    <div>
                        <div style={statLabelStyle}>Низький запас</div>
                        <div style={statValueStyle}>{products.filter(p => (p.stock - p.stock_reserved) > 0 && (p.stock - p.stock_reserved) <= (p.low_stock_threshold || 5)).length}</div>
                    </div>
                </div>
                <div style={statCardStyle}>
                    <div style={{ ...statIconStyle, backgroundColor: '#fef2f2', color: '#ef4444' }}><X size={20} /></div>
                    <div>
                        <div style={statLabelStyle}>Відсутні</div>
                        <div style={statValueStyle}>{products.filter(p => (p.stock - p.stock_reserved) <= 0).length}</div>
                    </div>
                </div>
                <div style={statCardStyle}>
                    <div style={{ ...statIconStyle, backgroundColor: '#f0fdf4', color: '#10b981' }}><TrendingUp size={20} /></div>
                    <div>
                        <div style={statLabelStyle}>Вартість складу</div>
                        <div style={statValueStyle}>
                            {products.reduce((acc, p) => acc + (p.stock * (p.cost_price || 0)), 0).toLocaleString()} ₴
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div style={filterBarStyle}>
                <div style={searchWrapperStyle}>
                    <Search size={18} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Пошук товаров..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setFilterStatus('all')}
                        style={{ ...filterTabStyle, ...(filterStatus === 'all' ? activeFilterTabStyle : {}) }}
                    >Всі</button>
                    <button
                        onClick={() => setFilterStatus('low')}
                        style={{ ...filterTabStyle, ...(filterStatus === 'low' ? activeFilterTabStyle : {}) }}
                    >Мало залишків</button>
                    <button
                        onClick={() => setFilterStatus('out')}
                        style={{ ...filterTabStyle, ...(filterStatus === 'out' ? activeFilterTabStyle : {}) }}
                    >Відсутні</button>
                </div>
            </div>

            {/* Table */}
            <div style={tableContainerStyle}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
                        <Loader2 size={40} className="animate-spin" color="#cbd5e1" />
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <th style={thStyle}>Товар</th>
                                <th style={thStyle}>Ціна / Собівартість</th>
                                <th style={thStyle}>Залишки</th>
                                <th style={thStyle}>Зарезервовано</th>
                                <th style={thStyle}>Статус</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(p => {
                                const status = getStatusInfo(p);
                                return (
                                    <tr key={p.id} style={trStyle}>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={thumbStyle}>
                                                    {p.images?.[0] ? <img src={p.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={18} color="#cbd5e1" />}
                                                </div>
                                                <div style={{ fontWeight: 800 }}>{p.name}</div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.cost_price ? `${p.cost_price} ₴` : '—'}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>собівартість</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: '16px', fontWeight: 900 }}>{p.stock} <span style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8' }}>шт</span></div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ color: p.stock_reserved > 0 ? '#f59e0b' : '#cbd5e1', fontWeight: p.stock_reserved > 0 ? 800 : 500 }}>{p.stock_reserved || 0} шт</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ ...statusBadgeStyle, color: status.color, backgroundColor: status.bg }}>{status.label}</span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => { setSelectedProduct(p); setShowSupplyModal(true); setSupplyData({ ...supplyData, cost_per_unit: p.cost_price || 0 }); }} style={iconActionBtnStyle} title="Поставка">
                                                    <Plus size={18} />
                                                </button>
                                                <button onClick={() => { setSelectedProduct(p); setShowAdjustModal(true); setAdjustData({ ...adjustData, new_quantity: p.stock }); }} style={iconActionBtnStyle} title="Коригування">
                                                    <PenLine size={18} />
                                                </button>
                                                <button onClick={() => { setSelectedProduct(p); setShowHistoryModal(true); fetchHistory(p.id); }} style={iconActionBtnStyle} title="Історія">
                                                    <History size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals Implemented Here (Supply, Adjust, History) - using standard premium styling */}
            {showSupplyModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <div style={modalHeaderStyle}>
                            <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Прийом поставки</h2>
                            <button onClick={() => setShowSupplyModal(false)} style={closeBtnStyle}><X size={24} /></button>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>{selectedProduct?.name}</p>

                        <form onSubmit={handleSupplySubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                                <div>
                                    <label style={modalLabelStyle}>Кількість (шт)</label>
                                    <input type="number" required value={supplyData.quantity} onChange={e => setSupplyData({ ...supplyData, quantity: parseInt(e.target.value) })} style={modalInputStyle} />
                                </div>
                                <div>
                                    <label style={modalLabelStyle}>Собівартість за шт (₴)</label>
                                    <input type="number" required step="0.01" value={supplyData.cost_per_unit} onChange={e => setSupplyData({ ...supplyData, cost_per_unit: parseFloat(e.target.value) })} style={modalInputStyle} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={modalLabelStyle}>Постачальник</label>
                                <input type="text" value={supplyData.supplier} onChange={e => setSupplyData({ ...supplyData, supplier: e.target.value })} style={modalInputStyle} placeholder="Назва постачальника" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                                <div>
                                    <label style={modalLabelStyle}>Номер накладної</label>
                                    <input type="text" value={supplyData.invoice_number} onChange={e => setSupplyData({ ...supplyData, invoice_number: e.target.value })} style={modalInputStyle} />
                                </div>
                                <div>
                                    <label style={modalLabelStyle}>Дата</label>
                                    <input type="date" required value={supplyData.date} onChange={e => setSupplyData({ ...supplyData, date: e.target.value })} style={modalInputStyle} />
                                </div>
                            </div>
                            <button type="submit" style={modalSubmitBtnStyle}>Підтвердити поставку</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Adjustment Modal */}
            {showAdjustModal && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, maxWidth: '450px' }}>
                        <div style={modalHeaderStyle}>
                            <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Коригування</h2>
                            <button onClick={() => setShowAdjustModal(false)} style={closeBtnStyle}><X size={24} /></button>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>{selectedProduct?.name}</p>

                        <form onSubmit={handleAdjustSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={modalLabelStyle}>Новий залишок (фактично)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <input type="number" required value={adjustData.new_quantity} onChange={e => setAdjustData({ ...adjustData, new_quantity: parseInt(e.target.value) })} style={{ ...modalInputStyle, fontSize: '24px', fontWeight: 900, textAlign: 'center' }} />
                                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#94a3b8' }}>шт</span>
                                </div>
                                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>Поточний залишок у системі: {selectedProduct?.stock} шт.</p>
                            </div>
                            <div style={{ marginBottom: '32px' }}>
                                <label style={modalLabelStyle}>Причина зміни</label>
                                <select value={adjustData.reason} onChange={e => setAdjustData({ ...adjustData, reason: e.target.value })} style={modalInputStyle}>
                                    <option>Інвентаризація</option>
                                    <option>Брак / Пошкодження</option>
                                    <option>Знаходження надлишків</option>
                                    <option>Списання</option>
                                </select>
                            </div>
                            <button type="submit" style={{ ...modalSubmitBtnStyle, backgroundColor: '#263A99' }}>Оновити залишок</button>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, maxWidth: '800px', padding: '0' }}>
                        <div style={{ padding: '32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Історія руху товару</h2>
                                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>{selectedProduct?.name}</p>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} style={closeBtnStyle}><X size={24} /></button>
                        </div>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0 32px 32px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, fontSize: '12px', padding: '12px 8px' }}>Дата</th>
                                        <th style={{ ...thStyle, fontSize: '12px', padding: '12px 8px' }}>Зміна</th>
                                        <th style={{ ...thStyle, fontSize: '12px', padding: '12px 8px' }}>Тип</th>
                                        <th style={{ ...thStyle, fontSize: '12px', padding: '12px 8px' }}>Коментар</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map(m => {
                                        const isPos = m.quantity > 0;
                                        return (
                                            <tr key={m.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                <td style={{ ...tdStyle, fontSize: '13px' }}>{new Date(m.created_at).toLocaleDateString('uk-UA')}</td>
                                                <td style={{ ...tdStyle, fontWeight: 900, color: isPos ? '#10b981' : '#ef4444' }}>
                                                    {isPos ? <ArrowUpRight size={14} style={{ display: 'inline', marginRight: '4px' }} /> : <ArrowDownRight size={14} style={{ display: 'inline', marginRight: '4px' }} />}
                                                    {isPos ? '+' : ''}{m.quantity}
                                                </td>
                                                <td style={{ ...tdStyle, fontSize: '13px' }}>{m.reason}</td>
                                                <td style={{ ...tdStyle, fontSize: '13px', color: '#94a3b8' }}>{m.notes || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {movements.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Записів не знайдено</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Styles
const refreshBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'white', borderRadius: "3px", border: '1.5px solid #e2e8f0', color: '#64748b', fontWeight: 800, fontSize: '14px', cursor: 'pointer' };
const statsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' };
const statCardStyle = { display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', backgroundColor: 'white', borderRadius: "3px", border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' };
const statIconStyle = { width: '48px', height: '48px', borderRadius: "3px", display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statLabelStyle = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.05em', marginBottom: '4px' };
const statValueStyle = { fontSize: '20px', fontWeight: 900, color: '#263A99' };
const filterBarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px' };
const searchWrapperStyle = { flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', backgroundColor: 'white', borderRadius: "3px", border: '1.5px solid #e2e8f0' };
const searchInputStyle = { border: 'none', outline: 'none', fontSize: '15px', fontWeight: 600, width: '100%', color: '#263A99' };
const filterTabStyle = { padding: '10px 20px', border: '1.5px solid transparent', borderRadius: "3px", backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 800, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' };
const activeFilterTabStyle = { backgroundColor: '#263A99', color: 'white' };
const tableContainerStyle = { backgroundColor: 'white', borderRadius: "3px", border: '1px solid #f1f5f9', overflow: 'hidden' };
const thStyle = { textAlign: 'left' as any, padding: '20px 24px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.1em' };
const trStyle = { borderBottom: '1px solid #f8fafc', transition: 'background 0.2s' };
const tdStyle = { padding: '20px 24px' };
const thumbStyle = { width: '44px', height: '44px', borderRadius: "3px", backgroundColor: '#f8fafc', overflow: 'hidden', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statusBadgeStyle = { padding: '6px 12px', borderRadius: "3px", fontSize: '12px', fontWeight: 800 };
const iconActionBtnStyle = { width: '38px', height: '38px', borderRadius: "3px", backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' };
const modalOverlayStyle = { position: 'fixed' as any, inset: 0, backgroundColor: 'rgba(38, 58, 153, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: 'white', borderRadius: "3px", width: '100%', maxWidth: '550px', padding: '40px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)', position: 'relative' as any };
const modalHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' };
const modalLabelStyle = { display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
const modalInputStyle = { width: '100%', padding: '14px 20px', borderRadius: "3px", border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#263A99' };
const modalSubmitBtnStyle = { width: '100%', padding: '16px', borderRadius: "3px", backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: 800, fontSize: '16px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)' };
