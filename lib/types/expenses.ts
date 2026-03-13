export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type RecurringInterval = 'monthly' | 'weekly' | 'yearly';
export type Currency = 'UAH' | 'USD' | 'EUR';

export interface Expense {
  id: string;
  category_id: string;
  name: string;
  amount: number;
  currency: Currency;
  amount_uah: number;
  exchange_rate: number;
  date: string;
  period_start?: string;
  period_end?: string;
  is_recurring: boolean;
  recurring_interval?: RecurringInterval;
  supplier?: string;
  invoice_number?: string;
  receipt_url?: string;
  notes?: string;
  added_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithCategory extends Expense {
  category: ExpenseCategory;
}

export interface ExpenseFormData {
  category_id: string;
  name: string;
  amount: number;
  currency: Currency;
  exchange_rate?: number;
  date: string;
  period_start?: string;
  period_end?: string;
  is_recurring?: boolean;
  recurring_interval?: RecurringInterval;
  supplier?: string;
  invoice_number?: string;
  receipt_url?: string;
  notes?: string;
}

export interface ExpenseMetrics {
  currentMonth: number;
  previousMonth: number;
  percentageChange: number;
  currentQuarter: number;
  currentYear: number;
  categoryBreakdown: {
    category_id: string;
    category_name: string;
    category_icon: string;
    category_color: string;
    total: number;
    percentage: number;
  }[];
}

export interface PLReportData {
  period: {
    start: string;
    end: string;
  };
  revenue: {
    total: number;
    byCategory: {
      category: string;
      amount: number;
    }[];
  };
  expenses: {
    cogs: number; // Cost of Goods Sold
    operational: {
      category_id: string;
      category_name: string;
      category_icon: string;
      amount: number;
    }[];
    salaries: number;
    total: number;
  };
  profit: {
    gross: number; // Revenue - COGS
    operational: number; // Gross - Operational - Salaries
    margin: number; // percentage
  };
  monthlyTrend: {
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
}

export interface ExchangeRate {
  currency: Currency;
  rate: number;
  date: string;
}
