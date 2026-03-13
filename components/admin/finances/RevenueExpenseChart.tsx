'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RevenueExpenseChartProps {
  data: {
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
}

export function RevenueExpenseChart({ data }: RevenueExpenseChartProps) {
  function formatCurrency(value: number) {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => formatCurrency(value)} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #ccc',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Bar dataKey="revenue" name="Виручка" fill="#10b981" />
          <Bar dataKey="expenses" name="Витрати" fill="#ef4444" />
          <Bar dataKey="profit" name="Прибуток" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
