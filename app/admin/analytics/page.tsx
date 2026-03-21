'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    TrendingUp,
    TrendingDown,
    ShoppingCart,
    Users,
    DollarSign,
    Activity,
    Download,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Instagram,
    Globe,
    MessageCircle,
    Video
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';

const COLORS = ['#263A99', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7', '#22c55e', '#6366f1'];

const SOURCE_ICONS: Record<string, any> = {
    Instagram: <Instagram size={16} />,
    Сайт: <Globe size={16} />,
    Telegram: <MessageCircle size={16} />,
    TikTok: <Video size={16} />
};

export default function AnalyticsPage() {
    const supabase = createClient();

    const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(true);

    // KPI Metrics
    const [metrics, setMetrics] = useState({
        revenue: { value: 0, change: 0 },
        orders: { value: 0, change: 0 },
        newClients: { value: 0, change: 0 },
        avgOrderValue: { value: 0, change: 0 },
        conversionRate: { value: 0, change: 0 }
    });

    // Chart Data
    const [revenueChart, setRevenueChart] = useState<any[]>([]);
    const [statusChart, setStatusChart] = useState<any[]>([]);
    const [sourceChart, setSourceChart] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [managerChart, setManagerChart] = useState<any[]>([]);
    const [topClients, setTopClients] = useState<any[]>([]);

    useEffect(() => {
        fetchAnalytics();
    }, [period, customRange]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // Determine date range
            const now = new Date();
            let startDate: Date;
            let endDate: Date = now;

            if (period === 'today') {
                startDate = startOfDay(now);
            } else if (period === 'week') {
                startDate = startOfDay(subDays(now, 7));
            } else if (period === 'month') {
                startDate = startOfDay(subDays(now, 30));
            } else if (period === 'custom' && customRange.start && customRange.end) {
                startDate = new Date(customRange.start);
                endDate = new Date(customRange.end);
            } else {
                startDate = startOfDay(subDays(now, 30));
            }

            // Fetch orders for current period
            const { data: orders } = await supabase
                .from('orders')
                .select(`
                    *,
                    customers(*),
                    manager:staff!orders_manager_id_fkey(id, name),
                    items
                `)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());

            if (!orders) {
                setLoading(false);
                return;
            }

            // Calculate previous period for comparison
            const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const prevStartDate = subDays(startDate, periodDays);
            const prevEndDate = startDate;

            const { data: prevOrders } = await supabase
                .from('orders')
                .select('*, items')
                .gte('created_at', prevStartDate.toISOString())
                .lt('created_at', prevEndDate.toISOString());

            // KPI Calculations
            const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
            const prevRevenue = prevOrders?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0;
            const revenueChange = prevRevenue === 0 ? 100 : ((revenue - prevRevenue) / prevRevenue) * 100;

            const ordersCount = orders.length;
            const prevOrdersCount = prevOrders?.length || 0;
            const ordersChange = prevOrdersCount === 0 ? 100 : ((ordersCount - prevOrdersCount) / prevOrdersCount) * 100;

            // New clients in this period
            const { count: newClientsCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());

            const { count: prevNewClientsCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', prevStartDate.toISOString())
                .lt('created_at', prevEndDate.toISOString());

            const newClientsChange = (prevNewClientsCount || 0) === 0 ? 100 :
                ((newClientsCount || 0) - (prevNewClientsCount || 0)) / (prevNewClientsCount || 1) * 100;

            const avgOrderValue = ordersCount > 0 ? revenue / ordersCount : 0;
            const prevAvgOrderValue = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0;
            const avgOrderValueChange = prevAvgOrderValue === 0 ? 100 :
                ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100;

            // Conversion Rate (orders / site visitors - mocked for now)
            const conversionRate = 2.5; // Mock data - would need analytics integration
            const conversionRateChange = 0.3; // Mock

            setMetrics({
                revenue: { value: revenue, change: revenueChange },
                orders: { value: ordersCount, change: ordersChange },
                newClients: { value: newClientsCount || 0, change: newClientsChange },
                avgOrderValue: { value: avgOrderValue, change: avgOrderValueChange },
                conversionRate: { value: conversionRate, change: conversionRateChange }
            });

            // Revenue over time chart (daily aggregation)
            const days = periodDays > 7 ? periodDays : 7;
            const dailyData: Record<string, number> = {};

            for (let i = 0; i < days; i++) {
                const date = subDays(endDate, days - 1 - i);
                const dateStr = format(date, 'yyyy-MM-dd');
                dailyData[dateStr] = 0;
            }

            orders.forEach(order => {
                const dateStr = format(new Date(order.created_at), 'yyyy-MM-dd');
                if (dailyData.hasOwnProperty(dateStr)) {
                    dailyData[dateStr] += Number(order.total || 0);
                }
            });

            const revenueChartData = Object.entries(dailyData).map(([date, revenue]) => ({
                date: format(new Date(date), 'dd.MM'),
                revenue: Math.round(revenue)
            }));
            setRevenueChart(revenueChartData);

            // Orders by status pie chart
            const statusMap: Record<string, number> = {};
            orders.forEach(o => {
                const status = o.order_status || 'unknown';
                statusMap[status] = (statusMap[status] || 0) + 1;
            });

            const statusLabels: Record<string, string> = {
                new: 'Нові',
                confirmed: 'Підтверджені',
                in_production: 'У виробництві',
                shipped: 'Відправлені',
                delivered: 'Виконані',
                cancelled: 'Скасовані'
            };

            const statusChartData = Object.entries(statusMap).map(([name, value]) => ({
                name: statusLabels[name] || name,
                value
            }));
            setStatusChart(statusChartData);

            // Orders by source (detect from customer info)
            const sourceMap: Record<string, number> = {
                Instagram: 0,
                Сайт: 0,
                Telegram: 0,
                TikTok: 0
            };

            orders.forEach(o => {
                if (o.customers?.instagram) {
                    sourceMap.Instagram++;
                } else if (o.customers?.telegram || o.customer_telegram) {
                    sourceMap.Telegram++;
                } else if (o.customer_email) {
                    sourceMap.Сайт++;
                } else {
                    sourceMap.Сайт++;
                }
            });

            const sourceChartData = Object.entries(sourceMap)
                .map(([name, value]) => ({ name, value }))
                .filter(s => s.value > 0);
            setSourceChart(sourceChartData);

            // Top products by revenue
            const productStats: Record<string, { name: string; revenue: number }> = {};
            orders.forEach(o => {
                const items = Array.isArray(o.items) ? o.items : [];
                items.forEach((item: any) => {
                    const id = item.id || item.product_id || Math.random().toString();
                    const name = item.name || 'Unknown Product';
                    const price = Number(item.price) || 0;
                    const quantity = Number(item.quantity || item.qty) || 1;

                    if (!productStats[id]) {
                        productStats[id] = { name, revenue: 0 };
                    }
                    productStats[id].revenue += price * quantity;
                });
            });

            const topProductsData = Object.values(productStats)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)
                .map(p => ({
                    name: p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name,
                    revenue: Math.round(p.revenue)
                }));
            setTopProducts(topProductsData);

            // Orders by manager
            const managerMap: Record<string, { name: string; orders: number }> = {};
            orders.forEach(o => {
                if (o.manager?.name) {
                    const id = o.manager.id;
                    if (!managerMap[id]) {
                        managerMap[id] = { name: o.manager.name, orders: 0 };
                    }
                    managerMap[id].orders++;
                }
            });

            const managerChartData = Object.values(managerMap)
                .sort((a, b) => b.orders - a.orders)
                .slice(0, 10);
            setManagerChart(managerChartData);

            // Top 10 clients by spend
            const clientStats: Record<string, { name: string; email: string; phone: string; total: number }> = {};
            orders.forEach(o => {
                const customerId = o.customer_id;
                if (customerId) {
                    if (!clientStats[customerId]) {
                        clientStats[customerId] = {
                            name: o.customer_name || o.customers?.name || 'Без імені',
                            email: o.customer_email || o.customers?.email || '',
                            phone: o.customer_phone || o.customers?.phone || '',
                            total: 0
                        };
                    }
                    clientStats[customerId].total += Number(o.total || 0);
                }
            });

            const topClientsData = Object.values(clientStats)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);
            setTopClients(topClientsData);

        } catch (error) {
            console.error('Analytics error:', error);
            toast.error('Помилка завантаження аналітики');
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // KPIs Sheet
        const kpiData = [
            ['Метрика', 'Значення', 'Зміна (%)'],
            ['Виручка', metrics.revenue.value.toFixed(2), metrics.revenue.change.toFixed(1)],
            ['Замовлення', metrics.orders.value, metrics.orders.change.toFixed(1)],
            ['Нові клієнти', metrics.newClients.value, metrics.newClients.change.toFixed(1)],
            ['Середній чек', metrics.avgOrderValue.value.toFixed(2), metrics.avgOrderValue.change.toFixed(1)],
            ['Конверсія (%)', metrics.conversionRate.value.toFixed(2), metrics.conversionRate.change.toFixed(2)]
        ];
        const wsKPI = XLSX.utils.aoa_to_sheet(kpiData);
        XLSX.utils.book_append_sheet(wb, wsKPI, 'KPI');

        // Top Clients Sheet
        const clientsData = [
            ['Клієнт', 'Email', 'Телефон', 'Витрачено (₴)'],
            ...topClients.map(c => [c.name, c.email, c.phone, c.total.toFixed(2)])
        ];
        const wsClients = XLSX.utils.aoa_to_sheet(clientsData);
        XLSX.utils.book_append_sheet(wb, wsClients, 'Топ клієнти');

        // Top Products Sheet
        const productsData = [
            ['Продукт', 'Виручка (₴)'],
            ...topProducts.map(p => [p.name, p.revenue])
        ];
        const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
        XLSX.utils.book_append_sheet(wb, wsProducts, 'Топ продукти');

        XLSX.writeFile(wb, `analytics_${period}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast.success('Excel файл завантажено');
    };

    const renderChangeIndicator = (change: number) => {
        const isPositive = change >= 0;
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: isPositive ? '#22c55e' : '#ef4444',
                fontSize: '14px',
                fontWeight: 600
            }}>
                {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {Math.abs(change).toFixed(1)}%
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <Activity className="animate-spin" size={48} color="#263A99" />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                        Бізнес Аналітика
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Глибокий аналіз продажів та ефективності
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

            {/* Period Selector */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '32px',
                padding: '20px',
                backgroundColor: 'white',
                borderRadius: '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    {(['today', 'week', 'month', 'custom'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: period === p ? '#263A99' : 'transparent',
                                color: period === p ? 'white' : '#64748b',
                                border: period === p ? 'none' : '1px solid #e2e8f0',
                                borderRadius: '3px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {p === 'today' && 'Сьогодні'}
                            {p === 'week' && 'Тиждень'}
                            {p === 'month' && 'Місяць'}
                            {p === 'custom' && 'Період'}
                        </button>
                    ))}
                </div>

                {period === 'custom' && (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={18} color="#64748b" />
                            <input
                                type="date"
                                value={customRange.start}
                                onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                                style={{
                                    padding: '8px 12px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '3px',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                        <span style={{ color: '#64748b' }}>—</span>
                        <input
                            type="date"
                            value={customRange.end}
                            onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '3px',
                                fontSize: '14px'
                            }}
                        />
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '20px',
                marginBottom: '32px'
            }}>
                {/* Total Revenue */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '3px',
                            backgroundColor: '#eef0fb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <DollarSign size={24} color="#263A99" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
                                Виручка
                            </p>
                            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                                ₴{metrics.revenue.value.toLocaleString('uk-UA', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>
                    {renderChangeIndicator(metrics.revenue.change)}
                </div>

                {/* Orders Count */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '3px',
                            backgroundColor: '#d1fae5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <ShoppingCart size={24} color="#22c55e" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
                                Замовлень
                            </p>
                            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                                {metrics.orders.value}
                            </p>
                        </div>
                    </div>
                    {renderChangeIndicator(metrics.orders.change)}
                </div>

                {/* New Clients */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '3px',
                            backgroundColor: '#fef3c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Users size={24} color="#f59e0b" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
                                Нові клієнти
                            </p>
                            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                                {metrics.newClients.value}
                            </p>
                        </div>
                    </div>
                    {renderChangeIndicator(metrics.newClients.change)}
                </div>

                {/* Avg Order Value */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '3px',
                            backgroundColor: '#e0e7ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <TrendingUp size={24} color="#6366f1" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
                                Середній чек
                            </p>
                            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                                ₴{metrics.avgOrderValue.value.toLocaleString('uk-UA', { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>
                    {renderChangeIndicator(metrics.avgOrderValue.change)}
                </div>

                {/* Conversion Rate */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '3px',
                            backgroundColor: '#fce7f3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Activity size={24} color="#ec4899" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
                                Конверсія
                            </p>
                            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                                {metrics.conversionRate.value.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    {renderChangeIndicator(metrics.conversionRate.change)}
                </div>
            </div>

            {/* Charts Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* Revenue Over Time */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
                        Виручка за період
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={revenueChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '3px',
                                    fontSize: '14px'
                                }}
                                formatter={(value: any) => `₴${value.toLocaleString('uk-UA')}`}
                            />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                stroke="#263A99"
                                strokeWidth={3}
                                dot={{ fill: '#263A99', r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Orders by Status */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
                        Замовлення по статусах
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={statusChart}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {statusChart.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* Orders by Source */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
                        Джерела замовлень
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={sourceChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '3px',
                                    fontSize: '14px'
                                }}
                            />
                            <Bar dataKey="value" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Orders by Manager */}
                <div style={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
                        Замовлення по менеджерах
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={managerChart} layout="horizontal">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <YAxis type="category" dataKey="name" stroke="#94a3b8" style={{ fontSize: '12px' }} width={100} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '3px',
                                    fontSize: '14px'
                                }}
                            />
                            <Bar dataKey="orders" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Products Chart */}
            <div style={{
                padding: '24px',
                backgroundColor: 'white',
                borderRadius: '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '20px'
            }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
                    Топ 10 продуктів по виручці
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topProducts} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <YAxis type="category" dataKey="name" stroke="#94a3b8" style={{ fontSize: '13px' }} width={250} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '3px',
                                fontSize: '14px'
                            }}
                            formatter={(value: any) => `₴${value.toLocaleString('uk-UA')}`}
                        />
                        <Bar dataKey="revenue" fill="#263A99" radius={[0, 3, 3, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Top 10 Clients Table */}
            <div style={{
                padding: '24px',
                backgroundColor: 'white',
                borderRadius: '3px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
                    Топ 10 клієнтів по витратах
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#64748b',
                                    textTransform: 'uppercase'
                                }}>
                                    #
                                </th>
                                <th style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#64748b',
                                    textTransform: 'uppercase'
                                }}>
                                    Клієнт
                                </th>
                                <th style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#64748b',
                                    textTransform: 'uppercase'
                                }}>
                                    Email
                                </th>
                                <th style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#64748b',
                                    textTransform: 'uppercase'
                                }}>
                                    Телефон
                                </th>
                                <th style={{
                                    textAlign: 'right',
                                    padding: '12px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#64748b',
                                    textTransform: 'uppercase'
                                }}>
                                    Витрачено
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {topClients.map((client, idx) => (
                                <tr
                                    key={idx}
                                    style={{
                                        borderBottom: '1px solid #f1f5f9',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <td style={{ padding: '16px', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
                                        {idx + 1}
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '15px', color: '#0f172a', fontWeight: 600 }}>
                                        {client.name}
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                                        {client.email}
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                                        {client.phone}
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '16px', color: '#263A99', fontWeight: 700, textAlign: 'right' }}>
                                        ₴{client.total.toLocaleString('uk-UA', { maximumFractionDigits: 0 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
