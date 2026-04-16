'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Plus, Minus, Edit2, X, Save, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface StockItem {
    id: string;
    product_id: string;
    name: string;
    slug: string;
    category: string;
    quantity_in_stock: number;
    quantity_reserved: number;
    quantity_available: number;
    min_level: number;
}

const supabase = createClient();

export default function StockPage() {
    const [items, setItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterLow, setFilterLow] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState(0);
    const [editMin, setEditMin] = useState(0);
    const [adjustModal, setAdjustModal] = useState<StockItem | null>(null);
    const [adjustDelta, setAdjustDelta] = useState(0);
    const [adjustNote, setAdjustNote] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const { data: products } = await supabase
            .from('products')
            .select('id, name, slug, stock_quantity, stock_reserved, low_stock_threshold, categories(name)')
            .eq('is_active', true)
            .order('name');

        if (!products) { setLoading(false); return; }

        const { data: stockRows } = await supabase.from('product_stock').select('*');
        const stockMap: Record<string, any> = {};
        (stockRows || []).forEach((r: any) => { stockMap[r.product_id] = r; });

        const mapped: StockItem[] = products.map((p: any) => {
            const ps = stockMap[p.id];
            const qty = ps?.quantity_in_stock ?? p.stock_quantity ?? 0;
            const reserved = ps?.quantity_reserved ?? p.stock_reserved ?? 0;
            return {
                id: ps?.id || p.id,
                product_id: p.id,
                name: p.name,
                slug: p.slug,
                category: (p.categories as any)?.name || '—',
                quantity_in_stock: qty,
                quantity_reserved: reserved,
                quantity_available: qty - reserved,
                min_level: ps?.min_level ?? p.low_stock_threshold ?? 0,
            };
        });
        setItems(mapped);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = items.filter(i => {
        const q = search.toLowerCase();
        const matchSearch = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
        const matchLow = !filterLow || i.quantity_available <= i.min_level;
        return matchSearch && matchLow;
    });

    const startEdit = (item: StockItem) => { setEditId(item.product_id); setEditQty(item.quantity_in_stock); setEditMin(item.min_level); };

    const saveEdit = async (item: StockItem) => {
        setSaving(true);
        await supabase.from('product_stock').upsert({ product_id: item.product_id, quantity_in_stock: editQty, quantity_reserved: item.quantity_reserved, min_level: editMin, updated_at: new Date().toISOString() }, { onConflict: 'product_id' });
        await supabase.from('products').update({ stock_quantity: editQty, low_stock_threshold: editMin, track_inventory: true }).eq('id', item.product_id);
        toast.success('Збережено'); setEditId(null); load(); setSaving(false);
    };

    const saveAdjust = async () => {
        if (!adjustModal || adjustDelta === 0) return;
        setSaving(true);
        const newQty = Math.max(0, adjustModal.quantity_in_stock + adjustDelta);
        await supabase.from('product_stock').upsert({ product_id: adjustModal.product_id, quantity_in_stock: newQty, quantity_reserved: adjustModal.quantity_reserved, min_level: adjustModal.min_level, updated_at: new Date().toISOString() }, { onConflict: 'product_id' });
        await supabase.from('products').update({ stock_quantity: newQty, track_inventory: true }).eq('id', adjustModal.product_id);
        await supabase.from('inventory_movements').insert({ product_id: adjustModal.product_id, type: adjustDelta > 0 ? 'in' : 'out', quantity: Math.abs(adjustDelta), quantity_before: adjustModal.quantity_in_stock, quantity_after: newQty, notes: adjustNote || null, action_type: 'manual_adjust', created_at: new Date().toISOString() });
        toast.success(`Залишок: ${newQty}`); setAdjustModal(null); setAdjustDelta(0); setAdjustNote(''); load(); setSaving(false);
    };

    const exportXlsx = () => {
        const rows = filtered.map(i => ({ 'Назва': i.name, 'Категорія': i.category, 'Всього': i.quantity_in_stock, 'Резерв': i.quantity_reserved, 'Доступно': i.quantity_available, 'Мін. рівень': i.min_level }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Залишки');
        XLSX.writeFile(wb, 'stock.xlsx');
    };

    const lowCount = items.filter(i => i.quantity_available <= i.min_level && i.min_level > 0).length;

    const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px' };

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1e2d7d', margin: 0 }}>Залишки</h1>
                    <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Управління складськими залишками</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><RefreshCw size={14} /> Оновити</button>
                    <button onClick={exportXlsx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Download size={14} /> Excel</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Всього товарів', value: items.length, color: '#1e2d7d' },
                    { label: 'В наявності', value: items.filter(i => i.quantity_available > 0).length, color: '#16a34a' },
                    { label: 'Немає', value: items.filter(i => i.quantity_available <= 0).length, color: '#6b7280' },
                    { label: '⚠ Низький залишок', value: lowCount, color: '#d97706' },
                ].map(s => (
                    <div key={s.label} style={card}>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук за назвою або категорією..."
                        style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
                </div>
                <button onClick={() => setFilterLow(!filterLow)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: `1px solid ${filterLow ? '#d97706' : '#e5e7eb'}`, borderRadius: 8, background: filterLow ? '#fffbeb' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: filterLow ? '#d97706' : '#374151' }}>
                    <AlertTriangle size={14} /> Низький залишок {lowCount > 0 && `(${lowCount})`}
                </button>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                            {['Назва', 'Категорія', 'Всього', 'Резерв', 'Доступно', 'Мін. рівень', 'Дії'].map(h => (
                                <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', textAlign: 'left' as const, whiteSpace: 'nowrap' as const }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center' as const, color: '#9ca3af' }}>Завантаження...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center' as const, color: '#9ca3af' }}>Нічого не знайдено</td></tr>
                        ) : filtered.map((item, idx) => {
                            const isLow = item.quantity_available <= item.min_level && item.min_level > 0;
                            const isEditing = editId === item.product_id;
                            return (
                                <tr key={item.product_id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9', background: isLow ? '#fffbeb' : 'white' }}>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {isLow && <AlertTriangle size={14} color="#d97706" />}
                                            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{item.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280' }}>{item.category}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {isEditing ? <input type="number" min="0" value={editQty} onChange={e => setEditQty(Number(e.target.value))} style={{ width: 70, padding: '4px 8px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 14, textAlign: 'center' as const }} />
                                            : <span style={{ fontSize: 14, fontWeight: 700 }}>{item.quantity_in_stock}</span>}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontSize: 14, color: '#6b7280' }}>{item.quantity_reserved}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: item.quantity_available > 0 ? '#16a34a' : '#ef4444' }}>{item.quantity_available}</span>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {isEditing ? <input type="number" min="0" value={editMin} onChange={e => setEditMin(Number(e.target.value))} style={{ width: 70, padding: '4px 8px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 14, textAlign: 'center' as const }} />
                                            : <span style={{ fontSize: 13, color: '#6b7280' }}>{item.min_level}</span>}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            {isEditing ? (
                                                <>
                                                    <button onClick={() => saveEdit(item)} disabled={saving} style={{ padding: '5px 10px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Зберегти</button>
                                                    <button onClick={() => setEditId(null)} style={{ padding: '5px 8px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}><X size={14} color="#6b7280" /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => { setAdjustModal(item); setAdjustDelta(0); setAdjustNote(''); }} title="Коригування" style={{ padding: '5px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer' }}><Plus size={14} color="#16a34a" /></button>
                                                    <button onClick={() => startEdit(item)} title="Редагувати" style={{ padding: '5px 8px', background: '#f0f3ff', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer' }}><Edit2 size={14} color="#1e2d7d" /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {adjustModal && (
                <>
                    <div onClick={() => setAdjustModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 14, padding: 32, width: 400, zIndex: 101, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Коригування залишку</h3>
                            <button onClick={() => setAdjustModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}><b>{adjustModal.name}</b></p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', textAlign: 'center' as const }}>
                                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>ЗАРАЗ</div>
                                <div style={{ fontSize: 24, fontWeight: 900 }}>{adjustModal.quantity_in_stock}</div>
                            </div>
                            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', textAlign: 'center' as const }}>
                                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>ПІСЛЯ</div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: '#16a34a' }}>{Math.max(0, adjustModal.quantity_in_stock + adjustDelta)}</div>
                            </div>
                        </div>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Зміна кількості</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <button onClick={() => setAdjustDelta(d => d - 1)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={16} /></button>
                            <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(Number(e.target.value))} style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 16, fontWeight: 700, textAlign: 'center' as const, outline: 'none' }} />
                            <button onClick={() => setAdjustDelta(d => d + 1)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
                        </div>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Причина (опціонально)</label>
                        <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="Наприклад: надходження від постачальника"
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, marginBottom: 20, boxSizing: 'border-box' as const, outline: 'none' }} />
                        <button onClick={saveAdjust} disabled={saving || adjustDelta === 0}
                            style={{ width: '100%', padding: '12px', background: adjustDelta === 0 ? '#e5e7eb' : '#1e2d7d', color: adjustDelta === 0 ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: adjustDelta === 0 ? 'not-allowed' : 'pointer' }}>
                            {saving ? 'Збереження...' : `${adjustDelta > 0 ? '+' : ''}${adjustDelta} → Зберегти`}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
