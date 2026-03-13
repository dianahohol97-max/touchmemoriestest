'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
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

export default function AdminDashboard() {
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
        setLoading(true);
        const res = await fetch(`/api/admin/analytics?period=${period}`);
        const json = await res.json();
        setData(json);
        setLoading(false);
    };

    const fetchRecentOrders = async () => {
        const { data } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        if (data) setRecentOrders(data);
    };

    const fetchAlerts = async () => {
        // 1. Low stock
        const { data: stockAlerts } = await supabase
            .from('products')
            .select('name, stock')
            .lt('stock', 5);

        // 2. Stale orders (> 24h)
        const dayAgo = new Date(Date.now() - 86400000).toISOString();
        const { data: staleOrders } = await supabase
            .from('orders')
            .select('order_number')
            .eq('order_status', 'new')
            .lt('created_at', dayAgo);

        // 3. Pending reviews (> 3 days)
        const threeDaysAgo = new Date(Date.now() - 259200000).toISOString();
        const { data: oldReviews } = await supabase
            .from('reviews')
            .select('id')
            .eq('status', 'pending')
            .lt('created_at', threeDaysAgo);

        const newAlerts = [];
        if (stockAlerts?.length) newAlerts.push({ title: 'Критичний залишок', message: `${stockAlerts.length} товарів мають запас < 5 шт.`, type: 'error' });
        if (staleOrders?.length) newAlerts.push({ title: 'Завислі замовлення', message: `${staleOrders.length} нових замовлень без реакції > 24 год.`, type: 'warning' });
        if (oldReviews?.length) newAlerts.push({ title: 'Черга відгуків', message: `${oldReviews.length} відгуків чекають модерації > 3 днів.`, type: 'info' });

        setAlerts(newAlerts);
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

    if (loading || !data) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Activity size={40} color="var(--primary)" /></motion.div>
        </div>
    );

    const { metrics, charts } = data;

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
                                color: period === p ? '#1e293b' : '#64748b',
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
                    value={`${metrics.revenue.value.toLocaleString()} ₴`}
                    change={metrics.revenue.change}
                    icon={<CreditCard />}
                    color="#6366f1"
                />
                <MetricCard
                    title="Прибуток"
                    value={`${metrics.profit.value.toLocaleString()} ₴`}
                    change={metrics.profit.change}
                    icon={<TrendingUp />}
                    color="#10b981"
                />
                <MetricCard
                    title="Маржа (Середня)"
                    value={`${metrics.margin.value.toFixed(1)}%`}
                    change={metrics.margin.change}
                    icon={<Activity />}
                    color="#f59e0b"
                />
                <MetricCard
                    title="Собівартість"
                    value={`${metrics.cogs.value.toLocaleString()} ₴`}
                    icon={<Package />}
                    color="#64748b"
                />
                <MetricCard
                    title="Замовлення"
                    value={metrics.orders.value}
                    change={metrics.orders.change}
                    icon={<ShoppingBag />}
                    color="#8b5cf6"
                />
                <MetricCard
                    title="Нові клієнти"
                    value={metrics.customers.value}
                    icon={<Users2 />}
                    color="#ec4899"
                />
                <MetricCard
                    title="Відгуки"
                    value={metrics.reviews.value}
                    badge={metrics.reviews.value > 0 ? metrics.reviews.value : null}
                    icon={<Star />}
                    color="#ef4444"
                />
                <MetricCard
                    title="Підписники"
                    value={metrics.subscribers.value}
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
                            <AreaChart data={charts.revenue}>
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
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
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
                        {charts.funnel.map((step: any, i: number) => (
                            <div key={step.name} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{
                                    ...funnelStep,
                                    width: `${100 - (i * 15)}%`,
                                    backgroundColor: step.color,
                                    opacity: 1 - (i * 0.1)
                                }}>
                                    <span style={{ fontWeight: 800 }}>{step.value}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                                    <span>{step.name}</span>
                                    {i > 0 && <span style={{ color: '#10b981' }}>{Math.round((step.value / charts.funnel[i - 1].value) * 100)}%</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Products */}
                <div style={chartCardSmall}>
                    <h2 style={cardTitle}>Топ-5 товарів</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                        {charts.topProducts.map((p: any, i: number) => (
                            <div key={p.name} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                                    <span style={{ color: '#1e293b' }}>{p.name}</span>
                                    <span style={{ color: '#6366f1' }}>{p.revenue.toLocaleString()} ₴</span>
                                </div>
                                <div style={{ height: '8px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(p.revenue / charts.topProducts[0].revenue) * 100}%` }}
                                        style={{ height: '100%', backgroundColor: COLORS[i % COLORS.length], borderRadius: '4px' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order Status & Customers */}
                <div style={chartCardSmall}>
                    <h2 style={cardTitle}>Статуси замовлень</h2>
                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={charts.status}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {charts.status.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px' }} />
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
                    {alerts.map((alert, i) => (
                        <motion.div
                            key={i}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            style={{
                                ...alertCard,
                                borderLeft: `6px solid ${alert.type === 'error' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#3b82f6'}`
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <AlertTriangle size={18} color={alert.type === 'error' ? '#ef4444' : '#f59e0b'} />
                                <h3 style={{ fontSize: '15px', fontWeight: 800 }}>{alert.title}</h3>
                            </div>
                            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 500 }}>{alert.message}</p>
                        </motion.div>
                    ))}
                    {alerts.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#ecfdf5', borderRadius: '24px', border: '1px solid #d1fae5' }}>
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
                                    {recentOrders.map((order) => (
                                        <motion.tr
                                            key={order.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            style={orderRow}
                                        >
                                            <td style={tdStyle}><span style={{ fontWeight: 800 }}>#{order.order_number}</span></td>
                                            <td style={tdStyle}>{order.customer_name}</td>
                                            <td style={tdStyle}>{(order.items as any[]).length} шт.</td>
                                            <td style={tdStyle}><span style={{ fontWeight: 900 }}>{order.total} ₴</span></td>
                                            <td style={tdStyle}>
                                                <StatusBadge status={order.order_status} />
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, change, icon, color, badge }: any) {
    return (
        <motion.div
            whileHover={{ y: -4 }}
            style={metricCardStyle}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ backgroundColor: `${color}15`, color: color, padding: '12px', borderRadius: '16px' }}>
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
                        borderRadius: '100px'
                    }}>
                        {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(Math.round(change))}%
                    </div>
                )}
                {badge && <span style={redBadge}>{badge}</span>}
            </div>
            <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#1e293b' }}>{value}</div>
        </motion.div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, any> = {
        'new': { label: 'Нове', bg: '#eff6ff', color: '#2563eb' },
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
            borderRadius: '100px',
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
const metricCardStyle = { backgroundColor: 'white', padding: '28px', borderRadius: '32px', border: '1.5px solid #f1f5f9', position: 'relative' as any };
const redBadge = { position: 'absolute' as any, top: '24px', right: '24px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 900, padding: '2px 8px', borderRadius: '100px', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' };

const chartsLayout = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' };
const chartCardLarge = { gridColumn: 'span 2', backgroundColor: 'white', padding: '32px', borderRadius: '32px', border: '1.5px solid #f1f5f9' };
const chartCardSmall = { backgroundColor: 'white', padding: '32px', borderRadius: '32px', border: '1.5px solid #f1f5f9' };

const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' };
const cardTitle = { fontSize: '18px', fontWeight: 900, color: '#1e293b', margin: 0 };
const dotStyle = { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' };

const funnelContainer = { marginTop: '24px', display: 'flex', flexDirection: 'column' as any, gap: '20px' };
const funnelStep = { padding: '12px 16px', borderRadius: '12px', color: 'white', fontSize: '14px', transition: 'all 0.3s' };

const bottomGrid = { display: 'grid', gridTemplateColumns: '380px 1fr', gap: '48px' };
const alertCard = { padding: '20px 24px', backgroundColor: 'white', borderRadius: '24px', border: '1.5px solid #f1f5f9' };
const ordersSection = { backgroundColor: 'white', padding: '40px', borderRadius: '40px', border: '1.5px solid #f1f5f9' };
const orderRow = { backgroundColor: '#fcfcfc', borderBottom: '1.5px solid #f8fafc' };

const periodSwitcher = { display: 'flex', padding: '6px', backgroundColor: '#f1f5f9', borderRadius: '16px', gap: '4px' };
const periodBtn = { padding: '8px 20px', borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' };
const viewAllBtn = { fontSize: '14px', fontWeight: 800, color: '#6366f1', textDecoration: 'none' };

const thStyle = { textAlign: 'left' as any, padding: '16px' };
const tdStyle = { padding: '16px', fontSize: '14px', color: '#4d5562' };
