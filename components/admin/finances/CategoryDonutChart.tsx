'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CategoryDonutChartProps {
  data: {
    category_name: string;
    category_icon: string;
    category_color: string;
    total: number;
    percentage: number;
  }[];
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  const chartData = data.map((item) => ({
    name: `${item.category_icon} ${item.category_name}`,
    value: item.total,
    color: item.category_color,
  }));

  function formatCurrency(value: any) {
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
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={120}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #ccc',
              borderRadius: '8px',
            }}
          />
          <Legend
            verticalAlign="middle"
            align="right"
            layout="vertical"
            formatter={(value, entry: any) => (
              <span className="text-sm">
                {value}: {formatCurrency(entry.payload.value)}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
