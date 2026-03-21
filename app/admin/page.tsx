'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
    ShoppingBag,
    ShoppingCart,
    Users,
    TrendingUp,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    Package,
    Calendar,
    Users2,
    MessageSquare,
    Mail,
    ChevronDown,
    Activity,
    CreditCard,
    Star,
    Bell
} from 'lucide-react';
import Link from 'next/link';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function AdminDashboardContent() {
    const supabase = createClient();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [period, setPeriod] = useState('month');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);

    useEffect(() => {
        fetchAnalytics();
        fetchRecentOrders();
        fetchAlerts();

        // Realtime orders
        const channel = supabase
            .channel('admin_dashboard')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders' },
                (payload) => {
                    handleNewOrder(payload.new);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [period]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/analytics?period=${period}`);
            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }
            const json = await res.json();

            // Validate response structure
            if (!json || !json.metrics || !json.charts) {
                throw new Error('Invalid response structure from analytics API');
            }

            setData(json);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
            toast.error('Не вдалося завантажити аналітику');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecentOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            if (data) setRecentOrders(data);
        } catch (error) {
            console.error('Failed to fetch recent orders:', error);
            setRecentOrders([]);
        }
    };

    const fetchAlerts = async () => {
        try {
            // 1. Low stock
            const { data: stockAlerts, error: stockError } = await supabase
                .from('products')
                .select('name, stock')
                .lt('stock', 5);

            if (stockError) console.error('Stock alerts error:', stockError);

            // 2. Stale orders (> 24h)
            const dayAgo = new Date(Date.now() - 86400000).toISOString();
            const { data: staleOrders, error: ordersError } = await supabase
                .from('orders')
                .select('order_number')
                .eq('order_status', 'new')
                .lt('created_at', dayAgo);

            if (ordersError) console.error('Stale orders error:', ordersError);

            // 3. Pending reviews (> 3 days)
            const threeDaysAgo = new Date(Date.now() - 259200000).toISOString();
            const { data: oldReviews, error: reviewsError } = await supabase
                .from('reviews')
                .select('id')
                .eq('status', 'pending')
                .lt('created_at', threeDaysAgo);

            if (reviewsError) console.error('Old reviews error:', reviewsError);

            const newAlerts = [];
            if (stockAlerts?.length) newAlerts.push({ title: 'Критичний залишок', message: `${stockAlerts.length} товарів мають запас < 5 шт.`, type: 'error' });
            if (staleOrders?.length) newAlerts.push({ title: 'Завислі замовлення', message: `${staleOrders.length} нових замовлень без реакції > 24 год.`, type: 'warning' });
            if (oldReviews?.length) newAlerts.push({ title: 'Черга відгуків', message: `${oldReviews.length} відгуків чекають модерації > 3 днів.`, type: 'info' });

            setAlerts(newAlerts);
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
            setAlerts([]);
        }
    };

    const handleNewOrder = (order: any) => {
        setRecentOrders(prev => [order, ...prev.slice(0, 9)]);
        toast.success(`Нове замовлення! #${order.order_number}`, {
            icon: <Bell className="animate-bounce" />
        });
        // Play sound
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.log('Audio play failed', e));
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Activity size={40} color="var(--primary)" /></motion.div>
        </div>
    );

    // Validate data structure with safe defaults
    if (!data || !data.metrics || !data.charts) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', flexDirection: 'column', gap: '16px' }}>
                <AlertTriangle size={48} color="#ef4444" />
                <p style={{ fontSize: '18px', color: '#64748b' }}>Помилка завантаження даних аналітики</p>
                <button
                    onClick={() => fetchAnalytics()}
                    style={{
                        marginTop: '20px',
                        padding: '12px 24px',
                        backgroundColor: '#263A99',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(38, 58, 153, 0.35)'
                    }}
                >
                    Спробувати ще раз
                </button>
            </div>
        );
    }

    const { metrics, charts } = data;

    // Ensure all required chart data exists with safe defaults
    const safeCharts = {
        revenue: Array.isArray(charts?.revenue) ? charts.revenue : [],
        funnel: Array.isArray(charts?.funnel) ? charts.funnel : [],
        topProducts: Array.isArray(charts?.topProducts) ? charts.topProducts : [],
        status: Array.isArray(charts?.status) ? charts.status : []
    };

    // Ensure metrics has safe defaults
    const safeMetrics = {
        revenue: metrics?.revenue || { value: 0, change: 0 },
        profit: metrics?.profit || { value: 0, change: 0 },
        margin: metrics?.margin || { value: 0, change: 0 },
        cogs: metrics?.cogs || { value: 0 },
        orders: metrics?.orders || { value: 0, change: 0 },
        customers: metrics?.customers || { value: 0 },
        reviews: metrics?.reviews || { value: 0 },
        subscribers: metrics?.subscribers || { value: 0 }
    };

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '100px' }}>
            {/* Hidden audio for notifications */}
            <audio ref={audioRef} src="/sounds/notification.mp3" preload="auto" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
                <div>
                    <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.02em' }}>Аналітика Бізнесу 📈</h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>Повний огляд вашої діяльності за обраний період.</p>
                </div>
                <div style={periodSwitcher}>
                    {['today', 'week', 'month'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                ...periodBtn,
                                backgroundColor: period === p ? 'white' : 'transparent',
                                color: period === p ? '#263A99' : '#64748b',
                                boxShadow: period === p ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            {p === 'today' ? 'Сьогодні' : p === 'week' ? 'Тиждень' : 'Місяць'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metric Cards */}
            <div style={statsGrid}>
                <MetricCard
                    title="Виручка"
                    value={`${(safeMetrics.revenue.value || 0).toLocaleString()} ₴`}
                    change={safeMetrics.revenue.change}
                    icon={<CreditCard />}
                    color="#6366f1"
                />
                <MetricCard
                    title="Прибуток"
                    value={`${(safeMetrics.profit.value || 0).toLocaleString()} ₴`}
                    change={safeMetrics.profit.change}
                    icon={<TrendingUp />}
                    color="#10b981"
                />
                <MetricCard
                    title="Маржа (Середня)"
                    value={`${(safeMetrics.margin.value || 0).toFixed(1)}%`}
                    change={safeMetrics.margin.change}
                    icon={<Activity />}
                    color="#f59e0b"
                />
                <MetricCard
                    title="Собівартість"
                    value={`${(safeMetrics.cogs.value || 0).toLocaleString()} ₴`}
                    icon={<Package />}
                    color="#64748b"
                />
                <MetricCard
                    title="Замовлення"
                    value={safeMetrics.orders.value || 0}
                    change={safeMetrics.orders.change}
                    icon={<ShoppingBag />}
                    color="#8b5cf6"
                />
                <MetricCard
                    title="Нові клієнти"
                    value={safeMetrics.customers.value || 0}
                    icon={<Users2 />}
                    color="#ec4899"
                />
                <MetricCard
                    title="Відгуки"
                    value={safeMetrics.reviews.value || 0}
                    badge={(safeMetrics.reviews.value || 0) > 0 ? safeMetrics.reviews.value : null}
                    icon={<Star />}
                    color="#ef4444"
                />
                <MetricCard
                    title="Підписники"
                    value={safeMetrics.subscribers.value || 0}
                    icon={<Mail />}
                    color="#8b5cf6"
                />
            </div>

            <div style={chartsLayout}>
                {/* Main Revenue Chart */}
                <div style={chartCardLarge}>
                    <div style={cardHeader}>
                        <h2 style={cardTitle}>Динаміка виручки (30 днів)</h2>
                        <div style={dotStyle} />
                    </div>
                    <div style={{ height: '350px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={safeCharts.revenue}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={15} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: "3px", border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                                    formatter={(v: any) => [`${v.toLocaleString()} ₴`, 'Виручка']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Conversion Funnel */}
                <div style={chartCardSmall}>
                    <h2 style={cardTitle}>Воронка продажів</h2>
                    <div style={funnelContainer}>
                        {safeCharts.funnel.length > 0 ? (
                            safeCharts.funnel.map((step: any, i: number) => (
                                <div key={step.name || i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{
                                        ...funnelStep,
                                        width: `${100 - (i * 15)}%`,
                                        backgroundColor: step.color || '#94a3b8',
                                        opacity: 1 - (i * 0.1)
                                    }}>
                                        <span style={{ fontWeight: 800 }}>{step.value || 0}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                                        <span>{step.name || 'N/A'}</span>
                                        {i > 0 && safeCharts.funnel[i - 1]?.value > 0 && (
                                            <span style={{ color: '#10b981' }}>
                                                {Math.round(((step.value || 0) / safeCharts.funnel[i - 1].value) * 100)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                Немає даних
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div style={chartCardSmall}>
                    <h2 style={cardTitle}>Топ-5 товарів</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                        {safeCharts.topProducts.length > 0 ? (
                            safeCharts.topProducts.map((p: any, i: number) => (
                                <div key={p.name || i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                                        <span style={{ color: '#263A99' }}>{p.name || 'Невідомий товар'}</span>
                                        <span style={{ color: '#6366f1' }}>{(p.revenue || 0).toLocaleString()} ₴</span>
                                    </div>
                                    <div style={{ height: '8px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: "3px", overflow: 'hidden' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${((p.revenue || 0) / (safeCharts.topProducts[0]?.revenue || 1)) * 100}%` }}
                                            style={{ height: '100%', backgroundColor: COLORS[i % COLORS.length], borderRadius: "3px" }}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                Немає даних
                            </div>
                        )}
                    </div>
                </div>

                {/* Order Status & Customers */}
                <div style={chartCardSmall}>
                    <h2 style={cardTitle}>Статуси замовлень</h2>
                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={safeCharts.status}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {safeCharts.status.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: "3px" }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div style={bottomGrid}>
                {/* Alerts Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Автоматичні Попередження ⚠️</h2>
                    {Array.isArray(alerts) && alerts.length > 0 ? (
                        alerts.map((alert, i) => (
                            <motion.div
                                key={i}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    ...alertCard,
                                    borderLeft: `6px solid ${alert.type === 'error' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#263A99'}`
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <AlertTriangle size={18} color={alert.type === 'error' ? '#ef4444' : '#f59e0b'} />
                                    <h3 style={{ fontSize: '15px', fontWeight: 800 }}>{alert.title || 'Попередження'}</h3>
                                </div>
                                <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 500 }}>{alert.message || ''}</p>
                            </motion.div>
                        ))
                    ) : (
                        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#ecfdf5', borderRadius: "3px", border: '1px solid #d1fae5' }}>
                            <p style={{ color: '#065f46', fontWeight: 700, margin: 0 }}>Всі показники в нормі ✅</p>
                        </div>
                    )}
                </div>

                {/* Real-time Orders Table */}
                <div style={ordersSection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Останні Замовлення 📦</h2>
                        <Link href="/admin/orders" style={viewAllBtn}>Дивитись всі</Link>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px' }}>
                            <thead>
                                <tr style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <th style={thStyle}>ID</th>
                                    <th style={thStyle}>Клієнт</th>
                                    <th style={thStyle}>Товари</th>
                                    <th style={thStyle}>Сума</th>
                                    <th style={thStyle}>Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {Array.isArray(recentOrders) && recentOrders.length > 0 ? (
                                        recentOrders.map((order) => (
                                            <motion.tr
                                                key={order.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                style={orderRow}
                                            >
                                                <td style={tdStyle}><span style={{ fontWeight: 800 }}>#{order.order_number || 'N/A'}</span></td>
                                                <td style={tdStyle}>{order.customer_name || 'N/A'}</td>
                                                <td style={tdStyle}>{Array.isArray(order.items) ? order.items.length : 0} шт.</td>
                                                <td style={tdStyle}><span style={{ fontWeight: 900 }}>{order.total || 0} ₴</span></td>
                                                <td style={tdStyle}>
                                                    <StatusBadge status={order.order_status || 'new'} />
                                                </td>
                                            </motion.tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                                Немає замовлень
                                            </td>
                                        </tr>
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    return (
        <ErrorBoundary>
            <AdminDashboardContent />
        </ErrorBoundary>
    );
}

function MetricCard({ title, value, change, icon, color, badge }: any) {
    return (
        <motion.div
            whileHover={{ y: -4 }}
            style={metricCardStyle}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ backgroundColor: `${color}15`, color: color, padding: '12px', borderRadius: "3px" }}>
                    {icon}
                </div>
                {change !== undefined && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: change >= 0 ? '#10b981' : '#ef4444',
                        backgroundColor: change >= 0 ? '#ecfdf5' : '#fef2f2',
                        padding: '4px 10px',
                        borderRadius: "3px"
                    }}>
                        {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(Math.round(change))}%
                    </div>
                )}
                {badge && <span style={redBadge}>{badge}</span>}
            </div>
            <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#263A99' }}>{value}</div>
        </motion.div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, any> = {
        'new': { label: 'Нове', bg: '#eff6ff', color: '#263A99' },
        'confirmed': { label: 'Підтверджено', bg: '#f0fdf4', color: '#16a34a' },
        'in_production': { label: 'Виробництво', bg: '#fff7ed', color: '#ea580c' },
        'shipped': { label: 'Відправлено', bg: '#faf5ff', color: '#9333ea' },
        'delivered': { label: 'Доставлено', bg: '#ecfdf5', color: '#059669' },
        'cancelled': { label: 'Скасовано', bg: '#fef2f2', color: '#dc2626' }
    };
    const s = config[status] || config.new;
    return (
        <span style={{
            padding: '6px 14px',
            borderRadius: "3px",
            fontSize: '12px',
            fontWeight: 800,
            backgroundColor: s.bg,
            color: s.color
        }}>
            {s.label}
        </span>
    );
}

// Styles
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '48px' };
const metricCardStyle = { backgroundColor: 'white', padding: '28px', borderRadius: "3px", border: '1.5px solid #f1f5f9', position: 'relative' as any };
const redBadge = { position: 'absolute' as any, top: '24px', right: '24px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 900, padding: '2px 8px', borderRadius: "3px", boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' };

const chartsLayout = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' };
const chartCardLarge = { gridColumn: 'span 2', backgroundColor: 'white', padding: '32px', borderRadius: "3px", border: '1.5px solid #f1f5f9' };
const chartCardSmall = { backgroundColor: 'white', padding: '32px', borderRadius: "3px", border: '1.5px solid #f1f5f9' };

const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' };
const cardTitle = { fontSize: '18px', fontWeight: 900, color: '#263A99', margin: 0 };
const dotStyle = { width: '8px', height: '8px', borderRadius: "3px", backgroundColor: '#6366f1' };

const funnelContainer = { marginTop: '24px', display: 'flex', flexDirection: 'column' as any, gap: '20px' };
const funnelStep = { padding: '12px 16px', borderRadius: "3px", color: 'white', fontSize: '14px', transition: 'all 0.3s' };

const bottomGrid = { display: 'grid', gridTemplateColumns: '380px 1fr', gap: '48px' };
const alertCard = { padding: '20px 24px', backgroundColor: 'white', borderRadius: "3px", border: '1.5px solid #f1f5f9' };
const ordersSection = { backgroundColor: 'white', padding: '40px', borderRadius: "3px", border: '1.5px solid #f1f5f9' };
const orderRow = { backgroundColor: '#fcfcfc', borderBottom: '1.5px solid #f8fafc' };

const periodSwitcher = { display: 'flex', padding: '6px', backgroundColor: '#f1f5f9', borderRadius: "3px", gap: '4px' };
const periodBtn = { padding: '8px 20px', borderRadius: "3px", border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' };
const viewAllBtn = { fontSize: '14px', fontWeight: 800, color: '#6366f1', textDecoration: 'none' };

const thStyle = { textAlign: 'left' as any, padding: '16px' };
const tdStyle = { padding: '16px', fontSize: '14px', color: '#4d5562' };
