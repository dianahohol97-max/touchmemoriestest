'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import {
    Save,
    X,
    ArrowLeft,
    Calendar,
    Percent,
    Hash,
    Info,
    CheckCircle2,
    Loader2,
    ShoppingBag,
    Tag,
    Edit
} from 'lucide-react';
import { toast } from 'sonner';

interface PromoCodeFormProps {
    id?: string;
    initialData?: any;
}

export default function PromoCodeForm({ id, initialData }: PromoCodeFormProps) {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        code: initialData?.code || '',
        type: initialData?.type || 'percent',
        value: initialData?.value || 0,
        min_order_amount: initialData?.min_order_amount || 0,
        applies_to: initialData?.applies_to || 'all',
        max_uses: initialData?.max_uses || null,
        is_single_use_per_customer: initialData?.is_single_use_per_customer ?? true,
        valid_from: initialData?.valid_from ? new Date(initialData.valid_from).toISOString().split('T')[0] : '',
        valid_until: initialData?.valid_until ? new Date(initialData.valid_until).toISOString().split('T')[0] : '',
        is_active: initialData?.is_active ?? true,
        notes: initialData?.notes || '',
        applicable_product_ids: initialData?.applicable_product_ids || [],
        applicable_category_ids: initialData?.applicable_category_ids || []
    });

    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        setFetching(true);
        const [prodRes, catRes] = await Promise.all([
            supabase.from('products').select('id, name').order('name'),
            supabase.from('categories').select('id, name').order('name')
        ]);
        if (prodRes.data) setProducts(prodRes.data);
        if (catRes.data) setCategories(catRes.data);
        setFetching(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code) return toast.error('Введіть код');
        if (formData.value <= 0) return toast.error('Введіть коректне значення знижки');

        setLoading(true);
        try {
            const method = id ? 'PUT' : 'POST';
            const body = id ? { ...formData, id } : formData;

            const res = await fetch('/api/admin/promocodes', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                toast.success(id ? 'Промокод оновлено' : 'Промокод створено');
                router.push('/admin/marketing/promocodes');
                router.refresh();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Помилка збереження');
            }
        } catch (error) {
            toast.error('Помилка мережі');
        }
        setLoading(false);
    };

    const toggleItem = (list: 'products' | 'categories', itemId: string) => {
        const field = list === 'products' ? 'applicable_product_ids' : 'applicable_category_ids';
        const current = [...formData[field]];
        if (current.includes(itemId)) {
            setFormData({ ...formData, [field]: current.filter(i => i !== itemId) });
        } else {
            setFormData({ ...formData, [field]: [...current, itemId] });
        }
    };

    return (
        <form onSubmit={handleSave} style={{ maxWidth: '1000px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button type="button" onClick={() => router.back()} style={backBtnStyle}><ArrowLeft size={20} /></button>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#1e293b' }}>
                        {id ? 'Редагувати промокод' : 'Новий промокод'}
                    </h1>
                </div>
                <button type="submit" disabled={loading} style={saveBtnStyle}>
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    Зберегти
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '32px' }}>

                    {/* Basic Info */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><Info size={18} /> Основна інформація</h2>
                        <div style={{ display: 'grid', gap: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                <label style={labelStyle}>Промокод (Код)</label>
                                <input
                                    required
                                    placeholder="Наприклад: SPRING20"
                                    style={inputStyle}
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                />
                                <p style={hintStyle}>Клієнт вводитиме цей код на чекауті.</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                    <label style={labelStyle}>Тип знижки</label>
                                    <select
                                        style={inputStyle}
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                    >
                                        <option value="percent">Відсоток (%)</option>
                                        <option value="fixed">Фіксована сума (₴)</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                    <label style={labelStyle}>Значення знижки</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="number"
                                            required
                                            style={{ ...inputStyle, paddingLeft: '40px' }}
                                            value={formData.value}
                                            onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                                        />
                                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                            {formData.type === 'percent' ? <Percent size={16} /> : <Hash size={16} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Constraints */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><ArrowLeft size={18} style={{ transform: 'rotate(270deg)' }} /> Обмеження</h2>
                        <div style={{ display: 'grid', gap: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                    <label style={labelStyle}>Мін. сума замовлення (₴)</label>
                                    <input
                                        type="number"
                                        style={inputStyle}
                                        value={formData.min_order_amount}
                                        onChange={e => setFormData({ ...formData, min_order_amount: Number(e.target.value) })}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                    <label style={labelStyle}>Макс. кількість використань</label>
                                    <input
                                        type="number"
                                        placeholder="Безлімітно"
                                        style={inputStyle}
                                        value={formData.max_uses || ''}
                                        onChange={e => setFormData({ ...formData, max_uses: e.target.value ? Number(e.target.value) : null })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="checkbox"
                                    id="single_use"
                                    checked={formData.is_single_use_per_customer}
                                    onChange={e => setFormData({ ...formData, is_single_use_per_customer: e.target.checked })}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                <label htmlFor="single_use" style={{ fontSize: '14px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                    Лише один раз для кожного клієнта
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Applicability */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><ShoppingBag size={18} /> Де діє промокод?</h2>
                        <div style={{ display: 'grid', gap: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                <label style={labelStyle}>Застосовувати до</label>
                                <select
                                    style={inputStyle}
                                    value={formData.applies_to}
                                    onChange={e => setFormData({ ...formData, applies_to: e.target.value as any })}
                                >
                                    <option value="all">Усі товари</option>
                                    <option value="specific_products">Обрані товари</option>
                                    <option value="specific_categories">Обрані категорії</option>
                                </select>
                            </div>

                            {formData.applies_to === 'specific_products' && (
                                <div style={itemSelectorGrid}>
                                    {fetching ? <Loader2 className="animate-spin" /> : products.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => toggleItem('products', p.id)}
                                            style={{
                                                ...selectorItemStyle,
                                                borderColor: formData.applicable_product_ids.includes(p.id) ? 'var(--primary)' : '#e2e8f0',
                                                backgroundColor: formData.applicable_product_ids.includes(p.id) ? '#f0f9ff' : 'white'
                                            }}
                                        >
                                            <ShoppingBag size={14} /> {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {formData.applies_to === 'specific_categories' && (
                                <div style={itemSelectorGrid}>
                                    {fetching ? <Loader2 className="animate-spin" /> : categories.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => toggleItem('categories', c.id)}
                                            style={{
                                                ...selectorItemStyle,
                                                borderColor: formData.applicable_category_ids.includes(c.id) ? 'var(--primary)' : '#e2e8f0',
                                                backgroundColor: formData.applicable_category_ids.includes(c.id) ? '#f0f9ff' : 'white'
                                            }}
                                        >
                                            <Tag size={14} /> {c.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '32px' }}>
                    {/* Validity */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><Calendar size={18} /> Термін дії</h2>
                        <div style={{ display: 'grid', gap: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                <label style={labelStyle}>Діє з (включно)</label>
                                <input
                                    type="date"
                                    style={inputStyle}
                                    value={formData.valid_from}
                                    onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                <label style={labelStyle}>Діє до (включно)</label>
                                <input
                                    type="date"
                                    style={inputStyle}
                                    value={formData.valid_until}
                                    onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><CheckCircle2 size={18} /> Статус</h2>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>Активувати промокод</span>
                            <div
                                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                style={{
                                    width: '50px',
                                    height: '26px',
                                    borderRadius: '13px',
                                    backgroundColor: formData.is_active ? '#22c55e' : '#cbd5e1',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: 'white',
                                    position: 'absolute',
                                    top: '3px',
                                    left: formData.is_active ? '27px' : '3px',
                                    transition: 'left 0.2s'
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* Internal Notes */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><Edit size={18} /> Нотатки (внутрішні)</h2>
                        <textarea
                            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                            placeholder="Опишіть для чого цей промокод..."
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <style jsx>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </form>
    );
}

const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer' };
const saveBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', borderRadius: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '15px' };
const cardStyle = { backgroundColor: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #f1f5f9', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' };
const cardTitleStyle = { fontSize: '16px', fontWeight: 800, color: '#1e293b', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 };
const labelStyle = { fontSize: '14px', fontWeight: 700, color: '#475569' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '15px', color: '#1e293b', transition: 'border-color 0.2s' };
const hintStyle = { fontSize: '12px', color: '#94a3b8', marginTop: '4px' };
const itemSelectorGrid = { display: 'flex', flexWrap: 'wrap' as any, gap: '8px', maxHeight: '300px', overflowY: 'auto' as any, padding: '4px' };
const selectorItemStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer', transition: 'all 0.2s' };
