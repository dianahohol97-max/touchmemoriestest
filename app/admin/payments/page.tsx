'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { formatDateTime, formatDateOnly, formatTimeOnly } from '@/lib/date-utils';
import {
    Download,
    DollarSign,
    TrendingUp,
    Clock,
    AlertCircle,
    CheckCircle,
    Search,
    Filter,
    X,
    Activity,
    CreditCard,
    Banknote,
    Truck,
    ExternalLink,
    Calendar
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import { startOfToday, startOfWeek, startOfMonth, endOfToday, endOfWeek, endOfMonth, format } from 'date-fns';
import Link from 'next/link';

interface Order {
    id: string;
    order_number: string;
    customer_name: string;
    customer_id?: string;
    total: number;
    payment_method: string;
    payment_status: string;
    created_at: string;
    paid_at?: string;
    assigned_manager_id?: string;
    delivery_method?: string;
}

interface PaymentStats {
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    pendingCount: number;
    pendingSum: number;
    codToCollect: number;
    codCount: number;
}

interface Filters {
    search: string;
    paymentType: string;
    paymentStatus: string;
    dateFrom: string;
    dateTo: string;
    managerId: string;
}

const PAYMENT_TYPES: Record<string, string> = {
    cash: 'Готівка',
    card: 'Картка',
    cod: 'Накладений платіж',
    prepayment: 'Передоплата',
    monobank: 'Monobank',
    transfer: 'Переказ'
};

const PAYMENT_STATUSES: Record<string, string> = {
    paid: 'Оплачено',
    pending: 'Очікує',
    partial: 'Часткова',
    overpaid: 'Переплата',
    refunded: 'Повернуто'
};

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function PaymentsPage() {
    const supabase = createClient();

    const [orders, setOrders] = useState<Order[]>([]);
    const [staff, setStaff] = useState<any[]>([]);
    const [stats, setStats] = useState<PaymentStats>({
        revenueToday: 0,
        revenueWeek: 0,
        revenueMonth: 0,
        pendingCount: 0,
        pendingSum: 0,
        codToCollect: 0,
        codCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<Filters>({
        search: '',
        paymentType: '',
        paymentStatus: '',
        dateFrom: '',
        dateTo: '',
        managerId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch orders with payment data
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;
            setOrders(ordersData || []);

            // Fetch staff for manager filter
            const { data: staffData } = await supabase
                .from('staff')
                .select('id, name')
                .eq('is_active', true);
            setStaff(staffData || []);

            // Calculate stats
            if (ordersData) {
                calculateStats(ordersData);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Помилка завантаження даних');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (ordersData: Order[]) => {
        const now = new Date();
        const todayStart = startOfToday();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const monthStart = startOfMonth(now);

        let revenueToday = 0;
        let revenueWeek = 0;
        let revenueMonth = 0;
        let pendingCount = 0;
        let pendingSum = 0;
        let codToCollect = 0;
        let codCount = 0;

        ordersData.forEach((order) => {
            const orderDate = new Date(order.created_at);
            const total = Number(order.total) || 0;

            // Revenue calculations (only for paid orders)
            if (order.payment_status === 'paid') {
                if (orderDate >= todayStart) revenueToday += total;
                if (orderDate >= weekStart) revenueWeek += total;
                if (orderDate >= monthStart) revenueMonth += total;
            }

            // Pending payments
            if (order.payment_status === 'pending') {
                pendingCount++;
                pendingSum += total;
            }

            // COD to collect
            if (order.payment_method === 'cod' && order.payment_status === 'pending') {
                codToCollect += total;
                codCount++;
            }
        });

        setStats({
            revenueToday,
            revenueWeek,
            revenueMonth,
            pendingCount,
            pendingSum,
            codToCollect,
            codCount
        });
    };

    const markAsPaid = async (orderId: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    payment_status: 'paid',
                    paid_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) throw error;

            toast.success('Платіж позначено як оплачений');
            await fetchData();
        } catch (error) {
            console.error('Error marking payment as paid:', error);
            toast.error('Помилка оновлення статусу');
        }
    };

    // Filter orders
    const filteredOrders = orders.filter((order) => {
        const searchMatch =
            !filters.search ||
            order.order_number.toLowerCase().includes(filters.search.toLowerCase()) ||
            order.customer_name.toLowerCase().includes(filters.search.toLowerCase());

        const paymentTypeMatch =
            !filters.paymentType || order.payment_method === filters.paymentType;

        const paymentStatusMatch =
            !filters.paymentStatus || order.payment_status === filters.paymentStatus;

        const dateFromMatch =
            !filters.dateFrom ||
            new Date(order.created_at) >= new Date(filters.dateFrom);

        const dateToMatch =
            !filters.dateTo || new Date(order.created_at) <= new Date(filters.dateTo);

        const managerMatch =
            !filters.managerId || order.assigned_manager_id === filters.managerId;

        return (
            searchMatch &&
            paymentTypeMatch &&
            paymentStatusMatch &&
            dateFromMatch &&
            dateToMatch &&
            managerMatch
        );
    });

    // Payment type breakdown
    const paymentTypeBreakdown = Object.entries(
        filteredOrders.reduce((acc, order) => {
            const type = order.payment_method || 'unknown';
            acc[type] = (acc[type] || 0) + Number(order.total);
            return acc;
        }, {} as Record<string, number>)
    ).map(([name, value]) => ({
        name: PAYMENT_TYPES[name] || name,
        value
    }));

    // Export to Excel
    const exportToExcel = () => {
        const dataToExport = filteredOrders.map((order) => ({
            Дата: formatDateTime(order.created_at),
            'Номер замовлення': order.order_number,
            Клієнт: order.customer_name,
            'Сума (₴)': order.total,
            'Тип оплати': PAYMENT_TYPES[order.payment_method] || order.payment_method,
            Статус: PAYMENT_STATUSES[order.payment_status] || order.payment_status,
            'Оплачено': formatDateTime(order.paid_at)
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Платежі');
        XLSX.writeFile(wb, `payments_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel файл завантажено');
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { bg: string; color: string; icon: any }> = {
            paid: { bg: '#f0fdf4', color: '#16a34a', icon: <CheckCircle size={14} /> },
            pending: { bg: '#fffbeb', color: '#f59e0b', icon: <Clock size={14} /> },
            partial: { bg: '#fef3c7', color: '#f59e0b', icon: <AlertCircle size={14} /> },
            overpaid: { bg: '#dbeafe', color: '#263A99', icon: <TrendingUp size={14} /> },
            refunded: { bg: '#fef2f2', color: '#ef4444', icon: <X size={14} /> }
        };
        const s = statusMap[status] || { bg: '#f1f5f9', color: '#64748b', icon: null };
        return (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: s.bg,
                    color: s.color,
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                }}
            >
                {s.icon}
                {PAYMENT_STATUSES[status] || status}
            </span>
        );
    };

    const getPaymentTypeIcon = (type: string) => {
        const icons: Record<string, any> = {
            cash: <Banknote size={16} />,
            card: <CreditCard size={16} />,
            cod: <Truck size={16} />,
            monobank: <CreditCard size={16} />,
            prepayment: <DollarSign size={16} />,
            transfer: <CreditCard size={16} />
        };
        return icons[type] || <DollarSign size={16} />;
    };

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#263A99', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                        Платежі та Транзакції
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Управління оплатами та фінансовими операціями
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={exportToExcel} style={exportBtn}>
                        <Download size={18} />
                        Експорт Excel
                    </button>
                    <Link href="/admin/settings/finance/banks" style={monobankBtn}>
                        <ExternalLink size={18} />
                        Monobank
                    </Link>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div style={statsGrid}>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Виручка сьогодні</div>
                        <div style={statValue}>{stats.revenueToday.toLocaleString()} ₴</div>
                        <div style={statSubtext}>
                            Тиждень: {stats.revenueWeek.toLocaleString()} ₴
                        </div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#eff6ff', color: '#263A99' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Виручка за місяць</div>
                        <div style={statValue}>{stats.revenueMonth.toLocaleString()} ₴</div>
                        <div style={statSubtext}>
                            {stats.revenueMonth > 0
                                ? Math.round(stats.revenueMonth / new Date().getDate()).toLocaleString()
                                : 0}{' '}
                            ₴/день
                        </div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#fffbeb', color: '#f59e0b' }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Очікує оплати</div>
                        <div style={statValue}>{stats.pendingCount}</div>
                        <div style={statSubtext}>{stats.pendingSum.toLocaleString()} ₴</div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#fef3c7', color: '#f59e0b' }}>
                        <Truck size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Накладений платіж</div>
                        <div style={statValue}>{stats.codCount}</div>
                        <div style={statSubtext}>{stats.codToCollect.toLocaleString()} ₴ до збору</div>
                    </div>
                </div>
            </div>

            {/* Payment Type Breakdown Chart */}
            {paymentTypeBreakdown.length > 0 && (
                <div style={chartCard}>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '24px' }}>
                        Розподіл типів оплати
                    </h2>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={paymentTypeBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) =>
                                        `${name}: ${(percent * 100).toFixed(0)}%`
                                    }
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {paymentTypeBreakdown.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                        />
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
                <div style={searchWrapper}>
                    <Search size={20} color="#94a3b8" />
                    <input
                        placeholder="Пошук за замовленням або клієнтом..."
                        style={searchInput}
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                </div>
                <select
                    style={filterSelect}
                    value={filters.paymentType}
                    onChange={(e) => setFilters({ ...filters, paymentType: e.target.value })}
                >
                    <option value="">Всі типи оплати</option>
                    {Object.entries(PAYMENT_TYPES).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <select
                    style={filterSelect}
                    value={filters.paymentStatus}
                    onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
                >
                    <option value="">Всі статуси</option>
                    {Object.entries(PAYMENT_STATUSES).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
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
                <select
                    style={filterSelect}
                    value={filters.managerId}
                    onChange={(e) => setFilters({ ...filters, managerId: e.target.value })}
                >
                    <option value="">Всі менеджери</option>
                    {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
                {(filters.search ||
                    filters.paymentType ||
                    filters.paymentStatus ||
                    filters.dateFrom ||
                    filters.dateTo ||
                    filters.managerId) && (
                    <button
                        onClick={() =>
                            setFilters({
                                search: '',
                                paymentType: '',
                                paymentStatus: '',
                                dateFrom: '',
                                dateTo: '',
                                managerId: ''
                            })
                        }
                        style={clearFiltersBtn}
                    >
                        <X size={16} />
                        Очистити
                    </button>
                )}
            </div>

            {/* Payments Table */}
            <div style={tableCard}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={thStyle}>Дата</th>
                            <th style={thStyle}>Замовлення</th>
                            <th style={thStyle}>Клієнт</th>
                            <th style={thStyle}>Сума</th>
                            <th style={thStyle}>Тип оплати</th>
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
                        ) : filteredOrders.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}
                                >
                                    Платежів не знайдено
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((order) => (
                                <motion.tr
                                    key={order.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={trStyle}
                                >
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 700, color: '#475569', fontSize: '14px' }}>
                                                {formatDateOnly(order.created_at)}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                {formatTimeOnly(order.created_at)}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <Link
                                            href={`/admin/orders/${order.id}`}
                                            style={{
                                                fontWeight: 800,
                                                color: '#263A99',
                                                textDecoration: 'none',
                                                fontSize: '15px'
                                            }}
                                        >
                                            {order.order_number}
                                        </Link>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 600, color: '#475569' }}>
                                            {order.customer_name}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 900, fontSize: '16px', color: '#6366f1' }}>
                                            {(order.total || 0).toLocaleString()} ₴
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                color: '#64748b',
                                                fontWeight: 600,
                                                fontSize: '14px'
                                            }}
                                        >
                                            {getPaymentTypeIcon(order.payment_method)}
                                            {PAYMENT_TYPES[order.payment_method] || order.payment_method}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>{getStatusBadge(order.payment_status)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        {order.payment_status === 'pending' && (
                                            <button
                                                onClick={() => markAsPaid(order.id)}
                                                style={markPaidBtn}
                                            >
                                                <CheckCircle size={16} />
                                                Позначити оплаченим
                                            </button>
                                        )}
                                        {order.payment_status === 'paid' && order.paid_at && (
                                            <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                                                ✓ {formatDateOnly(order.paid_at)}
                                            </div>
                                        )}
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Monobank Integration Notice */}
            <div style={monobankNotice}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CreditCard size={24} color="#263A99" />
                    <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#263A99', margin: 0, marginBottom: '4px' }}>
                            Інтеграція з Monobank
                        </h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                            Автоматична синхронізація платежів з Monobank. Налаштуйте інтеграцію у розділі{' '}
                            <Link href="/admin/settings/finance/banks" style={{ color: '#263A99', fontWeight: 700 }}>
                                Банківські рахунки
                            </Link>
                            .
                        </p>
                    </div>
                </div>
            </div>
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
    transition: 'all 0.2s',
    textDecoration: 'none'
};

const monobankBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: 'white',
    color: '#263A99',
    border: '1.5px solid #263A99',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textDecoration: 'none'
};

const statsGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
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
    alignItems: 'center',
    flexWrap: 'wrap' as any
};

const searchWrapper = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'white',
    border: '1.5px solid #e2e8f0',
    borderRadius: '3px',
    padding: '0 20px',
    flex: 1,
    minWidth: '300px'
};

const searchInput = {
    border: 'none',
    padding: '14px 0',
    outline: 'none',
    width: '100%',
    fontSize: '15px',
    fontWeight: 500
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
    boxShadow: '0 4px 25px rgba(0,0,0,0.02)',
    marginBottom: '32px'
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
    borderBottom: '1px solid #f8fafc',
    transition: 'background-color 0.2s'
};

const markPaidBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #86efac',
    borderRadius: '3px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const monobankNotice = {
    backgroundColor: '#eff6ff',
    border: '1.5px solid #dbeafe',
    borderRadius: '3px',
    padding: '24px',
    marginTop: '32px'
};
