'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, TrendingDown, Download } from 'lucide-react';
import type { ExpenseMetrics, ExpenseWithCategory, ExpenseCategory } from '@/lib/types/expenses';
import { ExpensesList } from '@/components/admin/finances/ExpensesList';
import { AddExpenseDialog } from '@/components/admin/finances/AddExpenseDialog';
import { toast } from 'sonner';
import { ExpensesFilters } from '@/components/admin/finances/ExpensesFilters';
import { CategoryDonutChart } from '@/components/admin/finances/CategoryDonutChart';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';

export default function ExpensesPage() {
  return (
    <AdminErrorBoundary fallbackTitle="Помилка завантаження сторінки витрат">
      <ExpensesContent />
    </AdminErrorBoundary>
  );
}

function ExpensesContent() {
  const [metrics, setMetrics] = useState<ExpenseMetrics | null>(null);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    category_id: '',
    start_date: '',
    end_date: '',
    search: '',
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [metricsRes, expensesRes, categoriesRes] = await Promise.all([
        fetch('/api/expenses/metrics'),
        fetch(`/api/expenses?${new URLSearchParams(filters as any)}`),
        fetch('/api/expenses/categories'),
      ]);

      const [metricsData, expensesData, categoriesData] = await Promise.all([
        metricsRes.json(),
        expensesRes.json(),
        categoriesRes.json(),
      ]);

      setMetrics(metricsData?.error ? null : metricsData);
      setExpenses(Array.isArray(expensesData) ? expensesData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Помилка підключення до бази даних');
    } finally {
      setIsLoading(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function handleExportExcel() {
    const { exportExpensesToExcel } = require('@/lib/export/excel');
    const timestamp = new Date().toISOString().split('T')[0];
    exportExpensesToExcel(expenses, `expenses-${timestamp}.xlsx`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Витрати</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="mr-2 h-4 w-4" />
            Експорт Excel
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Додати витрату
          </Button>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Цей місяць</CardTitle>
            {metrics && typeof metrics.percentageChange === 'number' && metrics.percentageChange !== 0 && (
              metrics.percentageChange > 0 ? (
                <TrendingUp className="h-4 w-4 text-red-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600" />
              )
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.currentMonth || 0)}
            </div>
            {metrics && typeof metrics.percentageChange === 'number' && metrics.percentageChange !== 0 && (
              <p className={`text-xs ${metrics.percentageChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {metrics.percentageChange > 0 ? '+' : ''}
                {metrics.percentageChange.toFixed(1)}% vs минулий місяць
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Цей квартал</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.currentQuarter || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Цей рік</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.currentYear || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Категорій</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground">активних категорій</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Chart */}
      {metrics && Array.isArray(metrics.categoryBreakdown) && metrics.categoryBreakdown.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Розподіл витрат за категоріями (цей місяць)</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDonutChart data={metrics.categoryBreakdown} />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <ExpensesFilters
        filters={filters}
        categories={categories}
        onFiltersChange={setFilters}
      />

      {/* Expenses List */}
      <ExpensesList
        expenses={expenses}
        categories={categories}
        onUpdate={loadData}
      />

      {/* Add Expense Dialog */}
      <AddExpenseDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        categories={categories}
        onSuccess={loadData}
      />
    </div>
  );
}
