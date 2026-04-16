'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Plus,
    Download,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Calendar,
    Activity,
    X,
    Save,
    Loader2,
    Package,
    Truck,
    Users,
    Megaphone,
    Wrench,
    Home,
    MoreHorizontal
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import { startOfMonth, endOfMonth, format as formatDate } from 'date-fns';

interface Expense {
    id: string;
    date: string;
    category_id: string;
    description: string;
    amount: number;
    currency: string;
    amount_uah: number;
    added_by: string;
    order_id?: string;
    created_at: string;
}

interface ExpenseCategory {
    id: string;
    name: string;
    icon?: string;
    color: string;
}

interface Staff {
    id: string;
    name: string;
}

interface PLSummary {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
}

const CATEGORY_ICONS: Record<string, any> = {
    'Матеріали': <Package size={16} />,
    'Доставка': <Truck size={16} />,
    'Зарплата': <Users size={16} />,
    'Маркетинг': <Megaphone size={16} />,
    'Обладнання': <Wrench size={16} />,
    'Оренда': <Home size={16} />,
    'Інше': <MoreHorizontal size={16} />
};

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function ExpensesPage() {
    const supabase = createClient();

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [plSummary, setPLSummary] = useState<PLSummary>({
        revenue: 0,
        expenses: 0,
        profit: 0,
        margin: 0
    });
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [filters, setFilters] = useState({
        category_id: '',
        dateFrom: '',
        dateTo: ''
    });

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        category_id: '',
        description: '',
        amount: 0,
        currency: 'UAH'
    });

    useEffect(() => {
        fetchData();
    }, [filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch categories first
            const { data: categoriesData, error: catError } = await supabase
                .from('expense_categories')
                .select('*')
                .order('sort_order');

            if (catError) throw catError;
            setCategories(categoriesData || []);

            // Build query for expenses
            let query = supabase
                .from('expenses')
                .select('*')
                .order('date', { ascending: false });

            if (filters.category_id) {
                query = query.eq('category_id', filters.category_id);
            }
            if (filters.dateFrom) {
                query = query.gte('date', filters.dateFrom);
            }
            if (filters.dateTo) {
                query = query.lte('date', filters.dateTo);
            }

            const { data: expensesData, error: expError } = await query;
            if (expError) throw expError;
            setExpenses(expensesData || []);

            // Fetch staff for display
            const { data: staffData } = await supabase
                .from('staff')
                .select('id, name');
            setStaff(staffData || []);

            // Calculate P&L summary
            await calculatePL();
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Помилка завантаження даних');
        } finally {
            setLoading(false);
        }
    };

    const calculatePL = async () => {
        const now = new Date();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();

        try {
            // Revenue from paid orders
            const { data: orders } = await supabase
                .from('orders')
                .select('total')
                .eq('payment_status', 'paid')
                .gte('created_at', monthStart)
                .lte('created_at', monthEnd);

            const revenue = orders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

            // Expenses this month
            const { data: expensesData } = await supabase
                .from('expenses')
                .select('amount_uah')
                .gte('date', monthStart.split('T')[0])
                .lte('date', monthEnd.split('T')[0]);

            const expenses = expensesData?.reduce((sum, e) => sum + (Number(e.amount_uah) || 0), 0) || 0;

            const profit = revenue - expenses;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

            setPLSummary({ revenue, expenses, profit, margin });
        } catch (error) {
            console.error('Error calculating P&L:', error);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Користувач не авторизований');

            const { error } = await supabase.from('expenses').insert({
                ...formData,
                amount_uah: formData.currency === 'UAH' ? formData.amount : formData.amount * 40, // Simplified conversion
                exchange_rate: formData.currency === 'UAH' ? 1 : 40,
                added_by: user.id
            });

            if (error) throw error;

            toast.success('Витрату додано');
            setIsFormOpen(false);
            resetForm();
            await fetchData();
        } catch (error: any) {
            console.error('Error saving expense:', error);
            toast.error(error.message || 'Помилка збереження');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteExpense = async (id: string) => {
        if (!confirm('Видалити цю витрату?')) return;

        try {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (error) throw error;

            toast.success('Витрату видалено');
            await fetchData();
        } catch (error) {
            console.error('Error deleting expense:', error);
            toast.error('Помилка видалення');
        }
    };

    const resetForm = () => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            category_id: categories[0]?.id || '',
            description: '',
            amount: 0,
            currency: 'UAH'
        });
    };

    const exportToExcel = () => {
        const dataToExport = expenses.map((expense) => {
            const category = categories.find((c) => c.id === expense.category_id);
            const addedBy = staff.find((s) => s.id === expense.added_by);
            return {
                Дата: new Date(expense.date).toLocaleDateString('uk-UA'),
                Категорія: category?.name || '—',
                Опис: expense.description,
                'Сума (₴)': expense.amount_uah,
                'Додав': addedBy?.name || '—'
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Витрати');
        XLSX.writeFile(wb, `expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel файл завантажено');
    };

    // Category breakdown for this month
    const categoryBreakdown = categories.map((category) => {
        const total = expenses
            .filter((e) => e.category_id === category.id)
            .reduce((sum, e) => sum + Number(e.amount_uah), 0);
        return {
            name: category.name,
            value: total,
            color: category.color
        };
    }).filter((c) => c.value > 0);

    // Total expenses this month
    const totalExpensesMonth = expenses.reduce((sum, e) => sum + Number(e.amount_uah), 0);

    const getStaffName = (id: string) => {
        return staff.find((s) => s.id === id)?.name || '—';
    };

    const getCategoryBadge = (categoryId: string) => {
        const category = categories.find((c) => c.id === categoryId);
        if (!category) return null;

        return (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: category.color + '20',
                    color: category.color,
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 800
                }}
            >
                {CATEGORY_ICONS[category.name] || <Package size={16} />}
                {category.name}
            </span>
        );
    };

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#263A99', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                        Витрати Бізнесу
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Облік операційних витрат та P&L аналіз
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={exportToExcel} style={exportBtn}>
                        <Download size={18} />
                        Експорт Excel
                    </button>
                    <button onClick={() => { resetForm(); setIsFormOpen(true); }} style={addBtn}>
                        <Plus size={18} />
                        Додати витрату
                    </button>
                </div>
            </div>

            {/* P&L Summary */}
            <div style={plCard}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '24px' }}>
                    P&L Summary цього місяця
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '24px' }}>
                    <div>
                        <div style={plLabel}>Виручка</div>
                        <div style={{ ...plValue, color: '#6366f1' }}>
                            {plSummary.revenue.toLocaleString()} ₴
                        </div>
                    </div>
                    <div>
                        <div style={plLabel}>Витрати</div>
                        <div style={{ ...plValue, color: '#ef4444' }}>
                            {plSummary.expenses.toLocaleString()} ₴
                        </div>
                    </div>
                    <div>
                        <div style={plLabel}>Прибуток</div>
                        <div style={{ ...plValue, color: plSummary.profit >= 0 ? '#10b981' : '#ef4444' }}>
                            {plSummary.profit.toLocaleString()} ₴
                        </div>
                    </div>
                    <div>
                        <div style={plLabel}>Маржа</div>
                        <div style={{ ...plValue, color: plSummary.margin >= 0 ? '#10b981' : '#ef4444' }}>
                            {plSummary.margin.toFixed(1)}%
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '3px' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Формула: Виручка - Витрати = Прибуток</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>
                        {plSummary.revenue.toLocaleString()} ₴ - {plSummary.expenses.toLocaleString()} ₴ = {plSummary.profit.toLocaleString()} ₴
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={statsGrid}>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#fef2f2', color: '#ef4444' }}>
                        <TrendingDown size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Всього витрат цього місяця</div>
                        <div style={statValue}>{totalExpensesMonth.toLocaleString()} ₴</div>
                        <div style={statSubtext}>{expenses.length} записів</div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Середня витрата</div>
                        <div style={statValue}>
                            {expenses.length > 0
                                ? Math.round(totalExpensesMonth / expenses.length).toLocaleString()
                                : 0}{' '}
                            ₴
                        </div>
                        <div style={statSubtext}>На один запис</div>
                    </div>
                </div>
            </div>

            {/* Category Breakdown Chart */}
            {categoryBreakdown.length > 0 && (
                <div style={chartCard}>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '24px' }}>
                        Розподіл за категоріями
                    </h2>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) =>
                                        `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                                    }
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {categoryBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => `${Number(value).toLocaleString()} ₴`}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={filtersWrapper}>
                <select
                    style={filterSelect}
                    value={filters.category_id}
                    onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
                >
                    <option value="">Всі категорії</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>
                <input
                    type="date"
                    style={filterSelect}
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    placeholder="Від дати"
                />
                <input
                    type="date"
                    style={filterSelect}
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    placeholder="До дати"
                />
                {(filters.category_id || filters.dateFrom || filters.dateTo) && (
                    <button
                        onClick={() => setFilters({ category_id: '', dateFrom: '', dateTo: '' })}
                        style={clearFiltersBtn}
                    >
                        <X size={16} />
                        Очистити
                    </button>
                )}
            </div>

            {/* Expenses Table */}
            <div style={tableCard}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={thStyle}>Дата</th>
                            <th style={thStyle}>Категорія</th>
                            <th style={thStyle}>Опис</th>
                            <th style={thStyle}>Сума</th>
                            <th style={thStyle}>Додав</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '100px' }}>
                                    <Activity
                                        className="animate-spin"
                                        size={32}
                                        color="#94a3b8"
                                        style={{ margin: '0 auto' }}
                                    />
                                </td>
                            </tr>
                        ) : expenses.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}
                                >
                                    Витрат не знайдено
                                </td>
                            </tr>
                        ) : (
                            expenses.map((expense) => (
                                <tr
                                    key={expense.id}
                                    style={trStyle}
                                >
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 700, color: '#475569', fontSize: '14px' }}>
                                            {new Date(expense.date).toLocaleDateString('uk-UA')}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>{getCategoryBadge(expense.category_id)}</td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 600, color: '#475569' }}>
                                            {expense.description}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 900, fontSize: '16px', color: '#ef4444' }}>
                                            {(expense.amount_uah || 0).toLocaleString()} ₴
                                        </div>
                                        {expense.currency !== 'UAH' && (
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                {expense.amount} {expense.currency}
                                            </div>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
                                            {getStaffName(expense.added_by)}
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        <button
                                            onClick={() => deleteExpense(expense.id)}
                                            style={deleteBtn}
                                        >
                                            <X size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Expense Modal */}
            {isFormOpen && (
                <>
                        <div style={overlay} onClick={() => setIsFormOpen(false)} />
                        <div style={modal} onClick={(e) => e.stopPropagation()}>
                            <div style={modalHeader}>
                                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#263A99', margin: 0 }}>
                                    Додати витрату
                                </h2>
                                <button onClick={() => setIsFormOpen(false)} style={closeBtn}>
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSave}>
                                <div style={{ padding: '28px 32px', display: 'grid', gap: '20px', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div>
                                            <label style={labelStyle}>Дата *</label>
                                            <input
                                                type="date"
                                                value={formData.date}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, date: e.target.value })
                                                }
                                                required
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Категорія *</label>
                                            <select
                                                value={formData.category_id}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, category_id: e.target.value })
                                                }
                                                required
                                                style={inputStyle}
                                            >
                                                <option value="">Виберіть категорію</option>
                                                {categories.map((cat) => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Опис *</label>
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={(e) =>
                                                setFormData({ ...formData, description: e.target.value })
                                            }
                                            placeholder="Наприклад: Папір А4, 500 аркушів"
                                            required
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                                        <div>
                                            <label style={labelStyle}>Сума *</label>
                                            <input
                                                type="number"
                                                value={formData.amount}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, amount: Number(e.target.value) })
                                                }
                                                placeholder="0"
                                                required
                                                min="0"
                                                step="0.01"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Валюта</label>
                                            <select
                                                value={formData.currency}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, currency: e.target.value })
                                                }
                                                style={inputStyle}
                                            >
                                                <option value="UAH">UAH</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px 32px', borderTop: '1px solid #f1f5f9' }}>
                                    <button type="button" onClick={() => setIsFormOpen(false)} style={cancelBtn}>
                                        Скасувати
                                    </button>
                                    <button type="submit" disabled={isSaving} style={saveBtn}>
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="animate-spin" size={18} />
                                                Збереження...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={18} />
                                                Зберегти
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
            )}
        </div>
    );
}

// Styles
const exportBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
    transition: 'all 0.2s'
};

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

const plCard = {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    marginBottom: '32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
};

const plLabel = {
    fontSize: '12px',
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
    marginBottom: '8px'
};

const plValue = {
    fontSize: '28px',
    fontWeight: 900
};

const statsGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px',
    marginBottom: '48px'
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

const chartCard = {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    marginBottom: '32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
};

const filtersWrapper = {
    display: 'flex',
    gap: '16px',
    marginBottom: '32px',
    alignItems: 'center'
};

const filterSelect = {
    padding: '14px 16px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '3px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569',
    backgroundColor: 'white',
    cursor: 'pointer',
    outline: 'none'
};

const clearFiltersBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    color: '#ef4444',
    border: 'none',
    borderRadius: '3px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
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

const deleteBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: '#fef2f2',
    color: '#ef4444',
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
    maxWidth: '600px',
    maxHeight: 'calc(100vh - 40px)',
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
