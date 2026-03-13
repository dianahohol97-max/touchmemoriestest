import { createClient } from '@/lib/supabase/server';
import type {
  ExpenseCategory,
  Expense,
  ExpenseWithCategory,
  ExpenseFormData,
  ExpenseMetrics,
  PLReportData,
  Currency
} from '@/lib/types/expenses';

// Expense Categories
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return data;
}

export async function createExpenseCategory(category: Omit<ExpenseCategory, 'id' | 'created_at' | 'updated_at'>): Promise<ExpenseCategory> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('expense_categories')
    .insert(category)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateExpenseCategory(id: string, category: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('expense_categories')
    .update(category)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Expenses
export async function getExpenses(filters?: {
  category_id?: string;
  start_date?: string;
  end_date?: string;
  is_recurring?: boolean;
}): Promise<ExpenseWithCategory[]> {
  const supabase = await createClient();

  let query = supabase
    .from('expenses')
    .select(`
      *,
      category:expense_categories(*)
    `)
    .order('date', { ascending: false });

  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id);
  }

  if (filters?.start_date) {
    query = query.gte('date', filters.start_date);
  }

  if (filters?.end_date) {
    query = query.lte('date', filters.end_date);
  }

  if (filters?.is_recurring !== undefined) {
    query = query.eq('is_recurring', filters.is_recurring);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as ExpenseWithCategory[];
}

export async function getExpenseById(id: string): Promise<ExpenseWithCategory> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      category:expense_categories(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as ExpenseWithCategory;
}

export async function createExpense(expense: ExpenseFormData, userId: string): Promise<Expense> {
  const supabase = await createClient();

  // Calculate amount_uah based on currency and exchange_rate
  const amount_uah = expense.currency === 'UAH'
    ? expense.amount
    : expense.amount * (expense.exchange_rate || 1);

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      ...expense,
      amount_uah,
      exchange_rate: expense.exchange_rate || 1,
      added_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateExpense(id: string, expense: Partial<ExpenseFormData>): Promise<Expense> {
  const supabase = await createClient();

  // Recalculate amount_uah if amount, currency, or exchange_rate changed
  let amount_uah: number | undefined;
  if (expense.amount !== undefined || expense.currency !== undefined || expense.exchange_rate !== undefined) {
    const current = await getExpenseById(id);
    const amount = expense.amount ?? current.amount;
    const currency = expense.currency ?? current.currency;
    const exchange_rate = expense.exchange_rate ?? current.exchange_rate;

    amount_uah = currency === 'UAH' ? amount : amount * exchange_rate;
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      ...expense,
      ...(amount_uah !== undefined && { amount_uah }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Recurring Expenses
export async function getRecurringExpenses(): Promise<ExpenseWithCategory[]> {
  return getExpenses({ is_recurring: true });
}

export async function toggleRecurringExpense(id: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('expenses')
    .update({ is_recurring: enabled })
    .eq('id', id);

  if (error) throw error;
}

// Metrics
export async function getExpenseMetrics(): Promise<ExpenseMetrics> {
  const supabase = await createClient();

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

  const currentQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().split('T')[0];
  const currentYearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

  // Current month total
  const { data: currentMonthData } = await supabase
    .from('expenses')
    .select('amount_uah')
    .gte('date', currentMonthStart)
    .lte('date', currentMonthEnd);

  const currentMonth = currentMonthData?.reduce((sum, e) => sum + Number(e.amount_uah), 0) || 0;

  // Previous month total
  const { data: previousMonthData } = await supabase
    .from('expenses')
    .select('amount_uah')
    .gte('date', previousMonthStart)
    .lte('date', previousMonthEnd);

  const previousMonth = previousMonthData?.reduce((sum, e) => sum + Number(e.amount_uah), 0) || 0;

  // Current quarter total
  const { data: currentQuarterData } = await supabase
    .from('expenses')
    .select('amount_uah')
    .gte('date', currentQuarterStart);

  const currentQuarter = currentQuarterData?.reduce((sum, e) => sum + Number(e.amount_uah), 0) || 0;

  // Current year total
  const { data: currentYearData } = await supabase
    .from('expenses')
    .select('amount_uah')
    .gte('date', currentYearStart);

  const currentYear = currentYearData?.reduce((sum, e) => sum + Number(e.amount_uah), 0) || 0;

  // Category breakdown
  const { data: categoryData } = await supabase
    .from('expenses')
    .select(`
      amount_uah,
      category:expense_categories(id, name, icon, color)
    `)
    .gte('date', currentMonthStart)
    .lte('date', currentMonthEnd);

  const categoryMap = new Map<string, { category: any; total: number }>();

  categoryData?.forEach((expense: any) => {
    const categoryId = expense.category.id;
    const existing = categoryMap.get(categoryId);

    if (existing) {
      existing.total += Number(expense.amount_uah);
    } else {
      categoryMap.set(categoryId, {
        category: expense.category,
        total: Number(expense.amount_uah),
      });
    }
  });

  const categoryBreakdown = Array.from(categoryMap.values()).map(({ category, total }) => ({
    category_id: category.id,
    category_name: category.name,
    category_icon: category.icon,
    category_color: category.color,
    total,
    percentage: currentMonth > 0 ? (total / currentMonth) * 100 : 0,
  }));

  const percentageChange = previousMonth > 0
    ? ((currentMonth - previousMonth) / previousMonth) * 100
    : 0;

  return {
    currentMonth,
    previousMonth,
    percentageChange,
    currentQuarter,
    currentYear,
    categoryBreakdown,
  };
}

// P&L Report
export async function getPLReport(startDate: string, endDate: string): Promise<PLReportData> {
  const supabase = await createClient();

  // Get revenue from orders
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      total_price,
      items:order_items(
        quantity,
        price,
        product:products(category)
      )
    `)
    .gte('paid_at', startDate)
    .lte('paid_at', endDate)
    .not('paid_at', 'is', null);

  const revenue = orders?.reduce((sum, order) => sum + Number(order.total_price), 0) || 0;

  // Revenue by category
  const categoryRevenue = new Map<string, number>();
  orders?.forEach((order: any) => {
    order.items?.forEach((item: any) => {
      const category = item.product?.category || 'Інше';
      const itemRevenue = Number(item.quantity) * Number(item.price);
      categoryRevenue.set(category, (categoryRevenue.get(category) || 0) + itemRevenue);
    });
  });

  const revenueByCategory = Array.from(categoryRevenue.entries()).map(([category, amount]) => ({
    category,
    amount,
  }));

  // COGS (Cost of Goods Sold)
  const { data: soldItems } = await supabase
    .from('order_items')
    .select(`
      quantity,
      product:products(cost_price),
      order:orders!inner(paid_at)
    `)
    .gte('order.paid_at', startDate)
    .lte('order.paid_at', endDate)
    .not('order.paid_at', 'is', null);

  const cogs = soldItems?.reduce((sum, item: any) => {
    return sum + (Number(item.quantity) * Number(item.product?.cost_price || 0));
  }, 0) || 0;

  // Operational expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select(`
      amount_uah,
      category:expense_categories(id, name, icon)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('category.name', 'Зарплати');

  const operationalMap = new Map<string, { category: any; amount: number }>();

  expenses?.forEach((expense: any) => {
    const categoryId = expense.category.id;
    const existing = operationalMap.get(categoryId);

    if (existing) {
      existing.amount += Number(expense.amount_uah);
    } else {
      operationalMap.set(categoryId, {
        category: expense.category,
        amount: Number(expense.amount_uah),
      });
    }
  });

  const operational = Array.from(operationalMap.values()).map(({ category, amount }) => ({
    category_id: category.id,
    category_name: category.name,
    category_icon: category.icon,
    amount,
  }));

  // Salaries
  const { data: salaryData } = await supabase
    .from('salary_periods')
    .select('base_salary, bonus, deductions')
    .gte('period_start', startDate)
    .lte('period_end', endDate);

  const salaries = salaryData?.reduce((sum, period: any) => {
    return sum + Number(period.base_salary) + Number(period.bonus || 0) - Number(period.deductions || 0);
  }, 0) || 0;

  const totalExpenses = cogs + operational.reduce((sum, o) => sum + o.amount, 0) + salaries;

  // Calculate profits
  const grossProfit = revenue - cogs;
  const operationalProfit = grossProfit - operational.reduce((sum, o) => sum + o.amount, 0) - salaries;
  const margin = revenue > 0 ? (operationalProfit / revenue) * 100 : 0;

  // Monthly trend (last 12 months)
  const monthlyTrend = [];
  const now = new Date(endDate);

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthEndStr = monthEnd.toISOString().split('T')[0];

    // Month revenue
    const { data: monthOrders } = await supabase
      .from('orders')
      .select('total_price')
      .gte('paid_at', monthStartStr)
      .lte('paid_at', monthEndStr)
      .not('paid_at', 'is', null);

    const monthRevenue = monthOrders?.reduce((sum, order) => sum + Number(order.total_price), 0) || 0;

    // Month expenses (including salaries)
    const { data: monthExpenses } = await supabase
      .from('expenses')
      .select('amount_uah')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr);

    const monthExpenseTotal = monthExpenses?.reduce((sum, e) => sum + Number(e.amount_uah), 0) || 0;

    const { data: monthSalaries } = await supabase
      .from('salary_periods')
      .select('base_salary, bonus, deductions')
      .gte('period_start', monthStartStr)
      .lte('period_end', monthEndStr);

    const monthSalaryTotal = monthSalaries?.reduce((sum, period: any) => {
      return sum + Number(period.base_salary) + Number(period.bonus || 0) - Number(period.deductions || 0);
    }, 0) || 0;

    monthlyTrend.push({
      month: monthStart.toLocaleDateString('uk-UA', { month: 'short', year: 'numeric' }),
      revenue: monthRevenue,
      expenses: monthExpenseTotal + monthSalaryTotal,
      profit: monthRevenue - monthExpenseTotal - monthSalaryTotal,
    });
  }

  return {
    period: {
      start: startDate,
      end: endDate,
    },
    revenue: {
      total: revenue,
      byCategory: revenueByCategory,
    },
    expenses: {
      cogs,
      operational,
      salaries,
      total: totalExpenses,
    },
    profit: {
      gross: grossProfit,
      operational: operationalProfit,
      margin,
    },
    monthlyTrend,
  };
}

// Exchange rates (NBU API)
export async function getExchangeRate(currency: Currency, date?: string): Promise<number> {
  if (currency === 'UAH') return 1;

  const targetDate = date || new Date().toISOString().split('T')[0];
  const [year, month, day] = targetDate.split('-');
  const formattedDate = `${year}${month}${day}`;

  const currencyCode = currency === 'USD' ? 840 : 978; // USD: 840, EUR: 978

  try {
    const response = await fetch(
      `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${currencyCode}&date=${formattedDate}&json`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate');
    }

    const data = await response.json();
    return data[0]?.rate || 1;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    // Return default rates if API fails
    return currency === 'USD' ? 40 : 42;
  }
}
