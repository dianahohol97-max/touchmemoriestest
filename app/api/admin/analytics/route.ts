import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { startOfDay, endOfDay, subDays, format, isAfter, isBefore } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || 'month'; // today, week, month

        const now = new Date();
        let startDate: Date;
        let prevStartDate: Date;

        if (period === 'today') {
            startDate = startOfDay(now);
            prevStartDate = startOfDay(subDays(now, 1));
        } else if (period === 'week') {
            startDate = startOfDay(subDays(now, 7));
            prevStartDate = startOfDay(subDays(now, 14));
        } else {
            startDate = startOfDay(subDays(now, 30));
            prevStartDate = startOfDay(subDays(now, 60));
        }

        // 1. Fetch Orders for Current and Previous Period
        const { data: currentOrders } = await supabase
            .from('orders')
            .select('total, created_at, order_status, items')
            .gte('created_at', startDate.toISOString());

        const { data: prevOrders } = await supabase
            .from('orders')
            .select('total, items')
            .gte('created_at', prevStartDate.toISOString())
            .lt('created_at', startDate.toISOString());

        const currentRevenue = currentOrders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0;
        const prevRevenue = prevOrders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0;
        const revenueChange = prevRevenue === 0 ? 100 : ((currentRevenue - prevRevenue) / prevRevenue) * 100;

        const currentOrderCount = currentOrders?.length || 0;
        const prevOrderCount = prevOrders?.length || 0;
        const orderChange = prevOrderCount === 0 ? 100 : ((currentOrderCount - prevOrderCount) / prevOrderCount) * 100;

        const currentAvgCheck = currentOrderCount === 0 ? 0 : currentRevenue / currentOrderCount;
        const prevAvgCheck = prevOrderCount === 0 ? 0 : prevRevenue / prevOrderCount;
        const avgCheckChange = prevAvgCheck === 0 ? 100 : ((currentAvgCheck - prevAvgCheck) / prevAvgCheck) * 100;

        // 1.5 Cost of Goods Sold (COGS) & Profit
        // We calculate COGS directly from order items to match revenue 1:1
        const calculateCOGS = (orders: any[]) => {
            return orders.reduce((totalSum: number, order: any) => {
                const items = (order.items || []) as any[];
                const orderCost = items.reduce((itemSum: number, item: any) => {
                    return itemSum + ((item.cost_price || 0) * (item.qty || item.quantity || 1));
                }, 0);
                return totalSum + orderCost;
            }, 0);
        };

        const currentCOGS = calculateCOGS(currentOrders || []);
        const prevCOGS = calculateCOGS(prevOrders || []);

        const currentProfit = currentRevenue - currentCOGS;
        const prevProfit = prevRevenue - prevCOGS;
        const profitChange = prevProfit === 0 ? 100 : ((currentProfit - prevProfit) / Math.abs(prevProfit)) * 100;

        const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;
        const prevMargin = prevRevenue > 0 ? ((prevProfit) / prevRevenue) * 100 : 0;
        const marginChange = prevMargin === 0 ? 100 : currentMargin - prevMargin;

        // 2. New Customers
        const { count: newCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startDate.toISOString());

        // 3. Pending Reviews
        const { count: pendingReviews } = await supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        // 4. New Subscribers
        const { count: newSubscribers } = await supabase
            .from('subscribers')
            .select('*', { count: 'exact', head: true })
            .gte('subscribed_at', startDate.toISOString());

        // 5. Chart Data: Revenue over 30 days
        const { data: dailyRevenue } = await supabase.rpc('get_daily_revenue', { days_count: 30 });
        // NOTE: If RPC doesn't exist, we'll process it manually from orders

        // Manual aggregation for now if RPC is not there
        const last30Days = Array.from({ length: 30 }, (_, i) => {
            const date = subDays(now, 29 - i);
            return format(date, 'yyyy-MM-dd');
        });

        const revenueChartData = last30Days.map(dateStr => {
            const dayOrders = currentOrders?.filter((o: any) => o.created_at.startsWith(dateStr)) || [];
            return {
                date: format(new Date(dateStr), 'dd.MM'),
                revenue: dayOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0)
            };
        });

        // 6. Status distribution
        const statusMap: Record<string, number> = {};
        currentOrders?.forEach((o: any) => {
            statusMap[o.order_status] = (statusMap[o.order_status] || 0) + 1;
        });
        const statusChartData = Object.entries(statusMap).map(([name, value]: [string, number]) => ({ name, value }));

        // 7. Top 5 Products by Revenue
        const productStats: Record<string, { name: string, revenue: number }> = {};
        currentOrders?.forEach((o: any) => {
            const items = o.items as any[];
            items.forEach((item: any) => {
                const id = item.id || item.product_id;
                if (!productStats[id]) productStats[id] = { name: item.name, revenue: 0 };
                productStats[id].revenue += (item.price * item.quantity);
            });
        });
        const topProducts = Object.values(productStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // 8. New vs Returning Customers
        const { data: customerOrders } = await supabase
            .from('orders')
            .select('customer_id');

        const customerCounts: Record<string, number> = {};
        customerOrders?.forEach((o: any) => {
            if (o.customer_id) customerCounts[o.customer_id] = (customerCounts[o.customer_id] || 0) + 1;
        });

        const returningCount = Object.values(customerCounts).filter((count: number) => count > 1).length;
        const totalWithOrders = Object.keys(customerCounts).length;
        const newCount = Math.max(0, totalWithOrders - returningCount);

        const customerSegments = [
            { name: 'Постійні', value: returningCount },
            { name: 'Нові', value: newCount }
        ];

        // 9. Funnel Data
        const { count: addToCartCount } = await supabase
            .from('cart_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'add_to_cart')
            .gte('created_at', startDate.toISOString());

        const { count: beginCheckoutCount } = await supabase
            .from('cart_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'begin_checkout')
            .gte('created_at', startDate.toISOString());

        const funnelData = [
            { name: 'Відвідали сайт', value: Math.max(currentOrderCount * 20, 100), color: '#94a3b8' }, // Mocked
            { name: 'Додали до кошика', value: addToCartCount || 0, color: '#6366f1' },
            { name: 'Почали оформлення', value: beginCheckoutCount || 0, color: '#f59e0b' },
            { name: 'Оплатили', value: currentOrderCount, color: '#10b981' },
        ];

        return NextResponse.json({
            metrics: {
                revenue: { value: currentRevenue, change: revenueChange },
                profit: { value: currentProfit, change: profitChange },
                cogs: { value: currentCOGS },
                margin: { value: currentMargin, change: marginChange }, // New
                orders: { value: currentOrderCount, change: orderChange },
                customers: { value: newCustomers || 0 },
                avgCheck: { value: currentAvgCheck, change: avgCheckChange },
                reviews: { value: pendingReviews || 0 },
                subscribers: { value: newSubscribers || 0 }
            },
            charts: {
                revenue: revenueChartData,
                status: statusChartData,
                funnel: funnelData,
                topProducts: topProducts,
                customers: customerSegments
            }
        });

    } catch (error: any) {
        console.error('Analytics Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
