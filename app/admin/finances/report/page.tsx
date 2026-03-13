'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import type { PLReportData } from '@/lib/types/expenses';
import { RevenueExpenseChart } from '@/components/admin/finances/RevenueExpenseChart';

export default function PLReportPage() {
  const [report, setReport] = useState<PLReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [customDates, setCustomDates] = useState({
    start: '',
    end: '',
  });

  useEffect(() => {
    loadReport();
  }, [period]);

  function getPeriodDates() {
    const now = new Date();
    let start: string;
    let end: string;

    switch (period) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStart, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), quarterStart + 3, 0).toISOString().split('T')[0];
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      case 'custom':
        start = customDates.start;
        end = customDates.end;
        break;
    }

    return { start, end };
  }

  async function loadReport() {
    if (period === 'custom' && (!customDates.start || !customDates.end)) {
      return;
    }

    setIsLoading(true);
    try {
      const { start, end } = getPeriodDates();
      const response = await fetch(
        `/api/finances/pl-report?start_date=${start}&end_date=${end}`
      );
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Error loading P&L report:', error);
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

  function formatPercent(value: number) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  }

  function handleExportPDF() {
    if (!report) return;
    const { exportPLReportToPDF } = require('@/lib/export/pdf');
    const timestamp = new Date().toISOString().split('T')[0];
    exportPLReportToPDF(report, `pl-report-${timestamp}.pdf`);
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
        <div>
          <h1 className="text-3xl font-bold">P&L Звіт</h1>
          <p className="text-muted-foreground mt-2">Звіт про прибутки та збитки</p>
        </div>
        <Button onClick={handleExportPDF}>
          <Download className="mr-2 h-4 w-4" />
          Експорт PDF
        </Button>
      </div>

      {/* Period Selector */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Період звіту</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Виберіть період</Label>
              <Select
                value={period}
                onValueChange={(value: any) => setPeriod(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Цей місяць</SelectItem>
                  <SelectItem value="quarter">Цей квартал</SelectItem>
                  <SelectItem value="year">Цей рік</SelectItem>
                  <SelectItem value="custom">Кастомний період</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === 'custom' && (
              <>
                <div>
                  <Label>Від дати</Label>
                  <Input
                    type="date"
                    value={customDates.start}
                    onChange={(e) =>
                      setCustomDates({ ...customDates, start: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>До дати</Label>
                  <Input
                    type="date"
                    value={customDates.end}
                    onChange={(e) =>
                      setCustomDates({ ...customDates, end: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={loadReport}>Застосувати</Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Виручка</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(report.revenue.total)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Витрати</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(report.expenses.total)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Операційний прибуток</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${report.profit.operational >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(report.profit.operational)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Маржинальність: {formatPercent(report.profit.margin)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Report */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Revenue Section */}
            <Card>
              <CardHeader>
                <CardTitle>Доходи</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="font-medium">Виручка від замовлень</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(report.revenue.total)}
                    </span>
                  </div>

                  {report.revenue.byCategory.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Розбивка по категоріях:
                      </p>
                      {report.revenue.byCategory.map((cat) => (
                        <div key={cat.category} className="flex justify-between text-sm">
                          <span>{cat.category}</span>
                          <span>{formatCurrency(cat.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Expenses Section */}
            <Card>
              <CardHeader>
                <CardTitle>Витрати</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Собівартість товарів</span>
                    <span className="font-medium">{formatCurrency(report.expenses.cogs)}</span>
                  </div>

                  {report.expenses.operational.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Операційні витрати:
                      </p>
                      {report.expenses.operational.map((exp) => (
                        <div key={exp.category_id} className="flex justify-between text-sm">
                          <span>
                            <span className="mr-1">{exp.category_icon}</span>
                            {exp.category_name}
                          </span>
                          <span>{formatCurrency(exp.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span>Зарплати</span>
                    <span className="font-medium">{formatCurrency(report.expenses.salaries)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t font-bold">
                    <span>Всього витрат</span>
                    <span className="text-red-600">{formatCurrency(report.expenses.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit Breakdown */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Підсумок</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Виручка</span>
                  <span className="font-medium">{formatCurrency(report.revenue.total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">− Собівартість</span>
                  <span className="font-medium">({formatCurrency(report.expenses.cogs)})</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">= Валовий прибуток</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(report.profit.gross)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">− Операційні витрати</span>
                  <span className="font-medium">
                    ({formatCurrency(report.expenses.operational.reduce((sum, e) => sum + e.amount, 0))})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">− Зарплати</span>
                  <span className="font-medium">({formatCurrency(report.expenses.salaries)})</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-bold text-lg">= Операційний прибуток</span>
                  <span className={`font-bold text-lg ${report.profit.operational >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(report.profit.operational)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-muted p-3 rounded-lg">
                  <span className="font-medium">Маржинальність</span>
                  <span className="font-bold">{formatPercent(report.profit.margin)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend Chart */}
          {report.monthlyTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Виручка vs Витрати (останні 12 місяців)</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueExpenseChart data={report.monthlyTrend} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
