'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Plus,
    Copy,
    Trash2,
    Power,
    Activity,
    Tag,
    TrendingUp,
    Calendar,
    Percent,
    DollarSign,
    Users,
    Check,
    X,
    Save,
    Loader2,
    Sparkles
} from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';

interface PromoCode {
    id: string;
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    min_order_amount?: number;
    max_uses?: number;
    uses_count: number;
    valid_from?: string;
    valid_until?: string;
    is_active: boolean;
    created_by?: string;
    created_at: string;
}

const PREBUILT_CODES = [
    { code: 'BIRTHDAY', type: 'percent' as const, value: 10, description: 'День народження' },
    { code: 'FRIEND', type: 'percent' as const, value: 7, description: 'Знижка для друга' },
    { code: 'VIP', type: 'percent' as const, value: 15, description: 'VIP клієнт' }
];

export default function PromoPage() {
    const supabase = createClient();

    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const [isSaving, setIsSaving] = useState(false);

    const [stats, setStats] = useState({
        activeCount: 0,
        totalUsesMonth: 0,
        revenueFromPromo: 0
    });

    const [formData, setFormData] = useState({
        code: '',
        type: 'percent' as 'percent' | 'fixed',
        value: 0,
        min_order_amount: 0,
        max_uses: null as number | null,
        valid_from: '',
        valid_until: '',
        is_active: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('promo_codes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPromoCodes(data || []);

            // Calculate stats
            calculateStats(data || []);
        } catch (error) {
            console.error('Error fetching promo codes:', error);
            toast.error('Помилка завантаження промокодів');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = async (codes: PromoCode[]) => {
        const activeCount = codes.filter((c) => c.is_active).length;

        // Total uses this month
        const now = new Date();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();

        const totalUsesMonth = codes.reduce((sum, code) => {
            // This is simplified - in real app, would query promo_code_usages table
            return sum + code.uses_count;
        }, 0);

        // Revenue from promo orders (simplified calculation)
        const revenueFromPromo = 0; // Would need to query orders with promo_code_id

        setStats({ activeCount, totalUsesMonth, revenueFromPromo });
    };

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData({ ...formData, code });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const payload = {
                ...formData,
                uses_count: 0,
                created_by: user?.id || null,
                min_order_amount: formData.min_order_amount || null,
                max_uses: formData.max_uses || null,
                valid_from: formData.valid_from || null,
                valid_until: formData.valid_until || null
            };

            const res = await fetch('/api/admin/promocodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Помилка створення промокоду');

            toast.success('Промокод створено');
            setIsFormOpen(false);
            resetForm();
            await fetchData();
        } catch (error: any) {
            console.error('Error saving promo code:', error);
            toast.error(error.message || 'Помилка збереження');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (id: string, isActive: boolean) => {
        try {
            const res = await fetch('/api/admin/promocodes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !isActive })
            });

            if (!res.ok) throw new Error('Помилка оновлення');

            toast.success(isActive ? 'Промокод деактивовано' : 'Промокод активовано');
            await fetchData();
        } catch (error) {
            console.error('Error toggling promo:', error);
            toast.error('Помилка оновлення статусу');
        }
    };

    const deletePromo = async (id: string) => {
        if (!confirm('Видалити цей промокод?')) return;

        try {
            const res = await fetch(`/api/admin/promocodes?id=${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Помилка видалення');

            toast.success('Промокод видалено');
            await fetchData();
        } catch (error) {
            console.error('Error deleting promo:', error);
            toast.error('Помилка видалення');
        }
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success(`Скопійовано: ${code}`);
    };

    const createPrebuiltCode = async (preset: typeof PREBUILT_CODES[0]) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const payload = {
                code: preset.code,
                type: preset.type,
                value: preset.value,
                min_order_amount: null,
                max_uses: null,
                uses_count: 0,
                valid_from: null,
                valid_until: null,
                is_active: true,
                created_by: user?.id || null
            };

            const res = await fetch('/api/admin/promocodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Помилка створення');

            toast.success(`Промокод ${preset.code} створено`);
            await fetchData();
        } catch (error) {
            console.error('Error creating preset:', error);
            toast.error('Помилка створення промокоду');
        }
    };

    const resetForm = () => {
        setFormData({
            code: '',
            type: 'percent',
            value: 0,
            min_order_amount: 0,
            max_uses: null,
            valid_from: '',
            valid_until: '',
            is_active: true
        });
    };

    const getTypeBadge = (type: string, value: number) => {
        if (type === 'percent') {
            return (
                <span style={{ ...typeBadge, backgroundColor: '#eff6ff', color: '#263A99' }}>
                    <Percent size={14} />
                    {value}%
                </span>
            );
        }
        return (
            <span style={{ ...typeBadge, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                <DollarSign size={14} />
                {value} ₴
            </span>
        );
    };

    const getStatusBadge = (isActive: boolean) => {
        return (
            <span
                style={{
                    ...statusBadge,
                    backgroundColor: isActive ? '#f0fdf4' : '#fef2f2',
                    color: isActive ? '#16a34a' : '#ef4444'
                }}
            >
                {isActive ? <Check size={14} /> : <X size={14} />}
                {isActive ? 'Активний' : 'Неактивний'}
            </span>
        );
    };

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#263A99', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                        Промокоди
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Управління знижками та акційними кодами
                    </p>
                </div>
                <button onClick={() => { resetForm(); setIsFormOpen(true); }} style={addBtn}>
                    <Plus size={18} />
                    Створити промокод
                </button>
            </div>

            {/* Stats */}
            <div style={statsGrid}>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                        <Tag size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Активні промокоди</div>
                        <div style={statValue}>{stats.activeCount}</div>
                        <div style={statSubtext}>З {promoCodes.length} загалом</div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#eff6ff', color: '#263A99' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Використань цього місяця</div>
                        <div style={statValue}>{stats.totalUsesMonth}</div>
                        <div style={statSubtext}>Активні кампанії</div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#fef3c7', color: '#f59e0b' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Виручка з промо</div>
                        <div style={statValue}>{stats.revenueFromPromo.toLocaleString()} ₴</div>
                        <div style={statSubtext}>Замовлення зі знижкою</div>
                    </div>
                </div>
            </div>

            {/* Prebuilt Codes */}
            <div style={prebuiltCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Sparkles size={24} color="#263A99" />
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#263A99', margin: 0 }}>
                        Готові промокоди
                    </h2>
                </div>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                    Швидко створіть популярні промокоди одним кліком
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {PREBUILT_CODES.map((preset) => {
                        const exists = promoCodes.some((p) => p.code === preset.code);
                        return (
                            <button
                                key={preset.code}
                                onClick={() => !exists && createPrebuiltCode(preset)}
                                disabled={exists}
                                style={{
                                    ...prebuiltBtn,
                                    opacity: exists ? 0.5 : 1,
                                    cursor: exists ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <div style={{ fontWeight: 800, fontSize: '15px' }}>{preset.code}</div>
                                <div style={{ fontSize: '12px', opacity: 0.8 }}>{preset.description}</div>
                                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px' }}>
                                    {preset.value}% знижка
                                </div>
                                {exists && (
                                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                                         Вже створено
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Promo Codes Table */}
            <div style={tableCard}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={thStyle}>Код</th>
                            <th style={thStyle}>Тип</th>
                            <th style={thStyle}>Знижка</th>
                            <th style={thStyle}>Використано</th>
                            <th style={thStyle}>Дійсний до</th>
                            <th style={thStyle}>Статус</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '100px' }}>
                                    <Activity
                                        className="animate-spin"
                                        size={32}
                                        color="#94a3b8"
                                        style={{ margin: '0 auto' }}
                                    />
                                </td>
                            </tr>
                        ) : promoCodes.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}
                                >
                                    Промокодів не знайдено
                                </td>
                            </tr>
                        ) : (
                            promoCodes.map((promo) => (
                                <motion.tr
                                    key={promo.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={trStyle}
                                >
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ fontWeight: 900, fontSize: '16px', color: '#263A99', fontFamily: 'monospace' }}>
                                                {promo.code}
                                            </div>
                                            <button
                                                onClick={() => copyCode(promo.code)}
                                                style={copyBtn}
                                                title="Копіювати код"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>{getTypeBadge(promo.type, promo.value)}</td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 800, color: '#475569', fontSize: '15px' }}>
                                            {promo.type === 'percent' ? `${promo.value}%` : `${promo.value} ₴`}
                                        </div>
                                        {promo.min_order_amount && (
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                від {promo.min_order_amount} ₴
                                            </div>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#475569' }}>
                                            {promo.uses_count}
                                            {promo.max_uses && ` / ${promo.max_uses}`}
                                        </div>
                                        {promo.max_uses && (
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                {Math.round((promo.uses_count / promo.max_uses) * 100)}% використано
                                            </div>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        {promo.valid_until ? (
                                            <div>
                                                <Calendar size={14} style={{ display: 'inline', marginRight: '6px' }} />
                                                {new Date(promo.valid_until).toLocaleDateString('uk-UA')}
                                            </div>
                                        ) : (
                                            <div style={{ color: '#94a3b8' }}>Без обмеження</div>
                                        )}
                                    </td>
                                    <td style={tdStyle}>{getStatusBadge(promo.is_active)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button
                                                onClick={() => toggleActive(promo.id, promo.is_active)}
                                                style={{
                                                    ...actionBtn,
                                                    backgroundColor: promo.is_active ? '#fef2f2' : '#f0fdf4',
                                                    color: promo.is_active ? '#ef4444' : '#16a34a'
                                                }}
                                                title={promo.is_active ? 'Деактивувати' : 'Активувати'}
                                            >
                                                <Power size={16} />
                                            </button>
                                            <button
                                                onClick={() => deletePromo(promo.id)}
                                                style={{ ...actionBtn, backgroundColor: '#fef2f2', color: '#ef4444' }}
                                                title="Видалити"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Promo Modal — rendered in portal to escape overflow:auto main */}
            {mounted && createPortal(
            <AnimatePresence>
                {isFormOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={overlay}
                            onClick={() => setIsFormOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            style={modal}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={modalHeader}>
                                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#263A99', margin: 0 }}>
                                    Створити промокод
                                </h2>
                                <button onClick={() => setIsFormOpen(false)} style={closeBtn}>
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} style={{ padding: '32px' }}>
                                <div style={{ display: 'grid', gap: '20px' }}>
                                    <div>
                                        <label style={labelStyle}>Код *</label>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <input
                                                type="text"
                                                value={formData.code}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                                                }
                                                placeholder="SUMMER2024"
                                                required
                                                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontWeight: 700 }}
                                            />
                                            <button type="button" onClick={generateCode} style={generateBtn}>
                                                <Sparkles size={18} />
                                                Згенерувати
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div>
                                            <label style={labelStyle}>Тип знижки *</label>
                                            <select
                                                value={formData.type}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, type: e.target.value as 'percent' | 'fixed' })
                                                }
                                                style={inputStyle}
                                            >
                                                <option value="percent">Відсоток (%)</option>
                                                <option value="fixed">Фіксована сума (₴)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Значення *</label>
                                            <input
                                                type="number"
                                                value={formData.value}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, value: Number(e.target.value) })
                                                }
                                                placeholder="10"
                                                required
                                                min="0"
                                                max={formData.type === 'percent' ? 100 : undefined}
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div>
                                            <label style={labelStyle}>Мінімальна сума замовлення (₴)</label>
                                            <input
                                                type="number"
                                                value={formData.min_order_amount}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, min_order_amount: Number(e.target.value) })
                                                }
                                                placeholder="0"
                                                min="0"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Максимум використань</label>
                                            <input
                                                type="number"
                                                value={formData.max_uses || ''}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        max_uses: e.target.value ? Number(e.target.value) : null
                                                    })
                                                }
                                                placeholder="Без обмежень"
                                                min="1"
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div>
                                            <label style={labelStyle}>Дійсний від</label>
                                            <input
                                                type="date"
                                                value={formData.valid_from}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, valid_from: e.target.value })
                                                }
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Дійсний до</label>
                                            <input
                                                type="date"
                                                value={formData.valid_until}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, valid_until: e.target.value })
                                                }
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '3px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) =>
                                                setFormData({ ...formData, is_active: e.target.checked })
                                            }
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                        <label style={{ fontSize: '14px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                            Активувати одразу після створення
                                        </label>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                                    <button type="button" onClick={() => setIsFormOpen(false)} style={cancelBtn}>
                                        Скасувати
                                    </button>
                                    <button type="submit" disabled={isSaving} style={saveBtn}>
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                Створення...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={18} />
                                                Створити промокод
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            , document.body)}
        </div>
    );
}

// Styles
const addBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#263A99',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(38, 58, 153, 0.35)',
    transition: 'all 0.2s'
};

const statsGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    marginBottom: '32px'
};

const statCard = {
    backgroundColor: 'white',
    padding: '28px',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
};

const iconWrapper = {
    width: '56px',
    height: '56px',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const statLabel = {
    fontSize: '12px',
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
    marginBottom: '6px'
};

const statValue = {
    fontSize: '28px',
    fontWeight: 900,
    color: '#263A99',
    marginBottom: '4px'
};

const statSubtext = {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: 600
};

const prebuiltCard = {
    backgroundColor: '#eff6ff',
    padding: '28px',
    borderRadius: '3px',
    border: '1.5px solid #dbeafe',
    marginBottom: '32px'
};

const prebuiltBtn = {
    padding: '16px 20px',
    backgroundColor: 'white',
    border: '1.5px solid #e2e8f0',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left' as any,
    minWidth: '160px'
};

const tableCard = {
    backgroundColor: 'white',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    overflow: 'hidden',
    boxShadow: '0 4px 25px rgba(0,0,0,0.02)'
};

const thStyle = {
    textAlign: 'left' as any,
    padding: '20px 24px',
    fontSize: '11px',
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
    fontWeight: 800,
    backgroundColor: '#f8fafc'
};

const tdStyle = {
    padding: '20px 24px',
    verticalAlign: 'middle' as any
};

const trStyle = {
    borderBottom: '1px solid #f8fafc'
};

const typeBadge = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '3px',
    fontSize: '12px',
    fontWeight: 800
};

const statusBadge = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '3px',
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase' as any
};

const copyBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const actionBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const overlay = {
    position: 'fixed' as any,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 998
};

const modal = {
    position: 'fixed' as any,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    borderRadius: '3px',
    width: '90%',
    maxWidth: '700px',
    maxHeight: '90vh',
    overflowY: 'auto' as any,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    zIndex: 999
};

const modalHeader = {
    padding: '24px 32px',
    borderBottom: '1.5px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};

const closeBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '3px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer'
};

const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#475569',
    marginBottom: '8px'
};

const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '3px',
    border: '1.5px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#263A99',
    outline: 'none',
    fontWeight: 600
};

const generateBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#eff6ff',
    color: '#263A99',
    border: '1.5px solid #dbeafe',
    borderRadius: '3px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as any
};

const cancelBtn = {
    padding: '12px 24px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '3px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
};

const saveBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#263A99',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(38, 58, 153, 0.35)'
};
