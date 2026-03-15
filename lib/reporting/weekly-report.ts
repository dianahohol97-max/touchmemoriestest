import { createClient } from '@/lib/supabase/server';

export interface WeeklyReportData {
  period: {
    start: string;
    end: string;
  };
  sales: {
    revenue: number;
    revenueChange: number; // percentage
    ordersCount: number;
    ordersChange: number;
    averageOrderValue: number;
    newCustomers: number;
  };
  topProducts: {
    productTitle: string;
    ordersCount: number;
    revenue: number;
  }[];
  marketplaces: {
    name: string;
    ordersCount: number;
    revenue: number;
  }[];
  production: {
    averageCompletionDays: number;
    overdueOrders: number;
    onTimePercentage: number;
  };
  email: {
    newSubscribers: number;
    campaignsSent: number;
    averageOpenRate: number;
  };
}

/**
 * Generate weekly report data
 */
export async function generateWeeklyReport(
  startDate: Date,
  endDate: Date
): Promise<WeeklyReportData> {
  const supabase = await createClient();

  // Calculate previous week dates for comparison
  const prevWeekStart = new Date(startDate);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(endDate);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  const prevStartStr = prevWeekStart.toISOString().split('T')[0];
  const prevEndStr = prevWeekEnd.toISOString().split('T')[0];

  // SALES DATA
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_price, paid_at, customer_id')
    .gte('paid_at', startDateStr)
    .lte('paid_at', endDateStr)
    .not('paid_at', 'is', null);

  const { data: prevOrders } = await supabase
    .from('orders')
    .select('id, total_price')
    .gte('paid_at', prevStartStr)
    .lte('paid_at', prevEndStr)
    .not('paid_at', 'is', null);

  const revenue = orders?.reduce((sum, o) => sum + Number(o.total_price), 0) || 0;
  const prevRevenue = prevOrders?.reduce((sum, o) => sum + Number(o.total_price), 0) || 0;
  const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

  const ordersCount = orders?.length || 0;
  const prevOrdersCount = prevOrders?.length || 0;
  const ordersChange = ordersCount - prevOrdersCount;

  const averageOrderValue = ordersCount > 0 ? revenue / ordersCount : 0;

  // New customers (first order in this period)
  const customerIds = [...new Set(orders?.map((o) => o.customer_id) || [])];
  let newCustomers = 0;

  for (const customerId of customerIds) {
    const { data: customerOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .lt('paid_at', startDateStr)
      .not('paid_at', 'is', null);

    if (!customerOrders || customerOrders.length === 0) {
      newCustomers++;
    }
  }

  // TOP PRODUCTS
  const { data: orderItems } = await supabase
    .from('order_items')
    .select(`
      product_id,
      quantity,
      price,
      product:products(title)
    `)
    .in('order_id', orders?.map((o) => o.id) || []);

  const productMap = new Map<string, { title: string; count: number; revenue: number }>();

  orderItems?.forEach((item: any) => {
    const productId = item.product_id;
    const title = item.product?.title || 'Unknown Product';
    const count = Number(item.quantity);
    const itemRevenue = Number(item.quantity) * Number(item.price);

    if (productMap.has(productId)) {
      const existing = productMap.get(productId)!;
      existing.count += count;
      existing.revenue += itemRevenue;
    } else {
      productMap.set(productId, { title, count, revenue: itemRevenue });
    }
  });

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((p) => ({
      productTitle: p.title,
      ordersCount: p.count,
      revenue: p.revenue,
    }));

  // MARKETPLACES
  const { data: ordersWithMarketplace } = await supabase
    .from('orders')
    .select('id, total_price, source')
    .gte('paid_at', startDateStr)
    .lte('paid_at', endDateStr)
    .not('paid_at', 'is', null);

  const marketplaceMap = new Map<string, { count: number; revenue: number }>();

  ordersWithMarketplace?.forEach((order: any) => {
    const source = order.source || 'Власний сайт';
    const revenue = Number(order.total_price);

    if (marketplaceMap.has(source)) {
      const existing = marketplaceMap.get(source)!;
      existing.count += 1;
      existing.revenue += revenue;
    } else {
      marketplaceMap.set(source, { count: 1, revenue });
    }
  });

  const marketplaces = Array.from(marketplaceMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, data]) => ({
      name,
      ordersCount: data.count,
      revenue: data.revenue,
    }));

  // PRODUCTION METRICS
  const { data: completedOrders } = await supabase
    .from('orders')
    .select('id, confirmed_at, shipped_at, production_deadline')
    .gte('shipped_at', startDateStr)
    .lte('shipped_at', endDateStr)
    .not('shipped_at', 'is', null)
    .not('confirmed_at', 'is', null);

  let totalDays = 0;
  let onTimeCount = 0;

  completedOrders?.forEach((order: any) => {
    const confirmedDate = new Date(order.confirmed_at);
    const shippedDate = new Date(order.shipped_at);
    const days = Math.ceil((shippedDate.getTime() - confirmedDate.getTime()) / (1000 * 60 * 60 * 24));
    totalDays += days;

    if (order.production_deadline) {
      const deadline = new Date(order.production_deadline);
      if (shippedDate <= deadline) {
        onTimeCount++;
      }
    }
  });

  const averageCompletionDays = completedOrders && completedOrders.length > 0
    ? totalDays / completedOrders.length
    : 0;

  const onTimePercentage = completedOrders && completedOrders.length > 0
    ? (onTimeCount / completedOrders.length) * 100
    : 0;

  // Overdue orders (current)
  const now = new Date();
  const { data: overdueOrdersData } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('status', ['confirmed', 'in_production', 'quality_check'])
    .lt('production_deadline', now.toISOString());

  const overdueOrders = overdueOrdersData?.length || 0;

  // EMAIL METRICS
  const { data: newSubscribers } = await supabase
    .from('subscribers')
    .select('id', { count: 'exact', head: true })
    .gte('subscribed_at', startDateStr)
    .lte('subscribed_at', endDateStr);

  const { data: emailCampaigns } = await supabase
    .from('email_campaigns')
    .select('id, open_rate, sent_at')
    .gte('sent_at', startDateStr)
    .lte('sent_at', endDateStr);

  const campaignsSent = emailCampaigns?.length || 0;
  const averageOpenRate = emailCampaigns && emailCampaigns.length > 0
    ? emailCampaigns.reduce((sum, c) => sum + (c.open_rate || 0), 0) / emailCampaigns.length
    : 0;

  return {
    period: {
      start: startDateStr,
      end: endDateStr,
    },
    sales: {
      revenue,
      revenueChange,
      ordersCount,
      ordersChange,
      averageOrderValue,
      newCustomers,
    },
    topProducts,
    marketplaces,
    production: {
      averageCompletionDays,
      overdueOrders,
      onTimePercentage,
    },
    email: {
      newSubscribers: newSubscribers?.length || 0,
      campaignsSent,
      averageOpenRate,
    },
  };
}

/**
 * Format weekly report as HTML email
 */
export function formatWeeklyReportHTML(data: WeeklyReportData): string {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const startDate = new Date(data.period.start).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
  });
  const endDate = new Date(data.period.end).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 5px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 15px; border-bottom: 2px solid #263A99; padding-bottom: 5px; }
    .metric { margin-bottom: 10px; }
    .metric-label { color: #666; font-size: 14px; }
    .metric-value { font-size: 18px; font-weight: 600; color: #1a1a1a; }
    .metric-change { font-size: 14px; margin-left: 10px; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .neutral { color: #6b7280; }
    .list-item { padding: 8px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .list-item:last-child { border-bottom: none; }
    .item-name { font-weight: 500; }
    .item-value { color: #666; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <h1>📊 Підсумок тижня</h1>
  <div class="subtitle">${startDate} – ${endDate}</div>

  <div class="section">
    <div class="section-title">ПРОДАЖІ</div>
    <div class="metric">
      <div class="metric-label">• Виручка</div>
      <div class="metric-value">
        ${formatCurrency(data.sales.revenue)}
        <span class="metric-change ${data.sales.revenueChange >= 0 ? 'positive' : 'negative'}">
          ${formatPercent(data.sales.revenueChange)} vs минулий тиждень
        </span>
      </div>
    </div>
    <div class="metric">
      <div class="metric-label">• Замовлень</div>
      <div class="metric-value">
        ${data.sales.ordersCount}
        <span class="metric-change ${data.sales.ordersChange >= 0 ? 'positive' : 'negative'}">
          ${data.sales.ordersChange >= 0 ? '+' : ''}${data.sales.ordersChange}
        </span>
      </div>
    </div>
    <div class="metric">
      <div class="metric-label">• Середній чек</div>
      <div class="metric-value">${formatCurrency(data.sales.averageOrderValue)}</div>
    </div>
    <div class="metric">
      <div class="metric-label">• Нових клієнтів</div>
      <div class="metric-value">${data.sales.newCustomers}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">ТОП ТОВАРИ</div>
    ${data.topProducts.map((product, index) => `
      <div class="list-item">
        <span class="item-name">${index + 1}. ${product.productTitle}</span>
        <span class="item-value">${product.ordersCount} замовлень</span>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">МАРКЕТПЛЕЙСИ</div>
    ${data.marketplaces.map((marketplace) => `
      <div class="list-item">
        <span class="item-name">• ${marketplace.name}</span>
        <span class="item-value">${marketplace.ordersCount} замовлень</span>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">ВИРОБНИЦТВО</div>
    <div class="metric">
      <div class="metric-label">• Середній час виконання</div>
      <div class="metric-value">${data.production.averageCompletionDays.toFixed(1)} дні</div>
    </div>
    <div class="metric">
      <div class="metric-label">• Прострочених</div>
      <div class="metric-value ${data.production.overdueOrders > 0 ? 'negative' : 'positive'}">
        ${data.production.overdueOrders}
      </div>
    </div>
    <div class="metric">
      <div class="metric-label">• Виконано вчасно</div>
      <div class="metric-value">${data.production.onTimePercentage.toFixed(0)}%</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">EMAIL</div>
    <div class="metric">
      <div class="metric-label">• Нових підписників</div>
      <div class="metric-value">${data.email.newSubscribers}</div>
    </div>
    <div class="metric">
      <div class="metric-label">• Надіслано кампаній</div>
      <div class="metric-value">${data.email.campaignsSent}</div>
    </div>
    <div class="metric">
      <div class="metric-label">• Open rate</div>
      <div class="metric-value">${data.email.averageOpenRate.toFixed(0)}%</div>
    </div>
  </div>

  <div class="footer">
    <p>🤖 Цей звіт згенеровано автоматично системою TouchMemories</p>
    <p>Згенеровано: ${new Date().toLocaleString('uk-UA')}</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Format weekly report as plain text (for Telegram)
 */
export function formatWeeklyReportText(data: WeeklyReportData): string {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const startDate = new Date(data.period.start).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
  });
  const endDate = new Date(data.period.end).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `
📊 *Підсумок тижня*
${startDate} – ${endDate}

*ПРОДАЖІ:*
• Виручка: ${formatCurrency(data.sales.revenue)} (${formatPercent(data.sales.revenueChange)} vs минулий тиждень)
• Замовлень: ${data.sales.ordersCount} (${data.sales.ordersChange >= 0 ? '+' : ''}${data.sales.ordersChange})
• Середній чек: ${formatCurrency(data.sales.averageOrderValue)}
• Нових клієнтів: ${data.sales.newCustomers}

*ТОП ТОВАРИ:*
${data.topProducts.map((p, i) => `${i + 1}. ${p.productTitle} — ${p.ordersCount} замовлень`).join('\n')}

*МАРКЕТПЛЕЙСИ:*
${data.marketplaces.map((m) => `• ${m.name}: ${m.ordersCount} замовлень`).join('\n')}

*ВИРОБНИЦТВО:*
• Середній час виконання: ${data.production.averageCompletionDays.toFixed(1)} дні
• Прострочених: ${data.production.overdueOrders}
• Виконано вчасно: ${data.production.onTimePercentage.toFixed(0)}%

*EMAIL:*
• Нових підписників: ${data.email.newSubscribers}
• Надіслано кампаній: ${data.email.campaignsSent}
• Open rate: ${data.email.averageOpenRate.toFixed(0)}%
  `.trim();
}
