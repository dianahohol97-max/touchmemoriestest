'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ExpenseWithCategory } from '@/lib/types/expenses';

export default function RecurringExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecurringExpenses();
  }, []);

  async function loadRecurringExpenses() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/expenses?is_recurring=true');
      const data = await response.json();
      setExpenses(data);
    } catch (error) {
      console.error('Error loading recurring expenses:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleRecurring(id: string, enabled: boolean) {
    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_recurring: enabled }),
      });

      if (response.ok) {
        loadRecurringExpenses();
      }
    } catch (error) {
      console.error('Error toggling recurring expense:', error);
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

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getNextDate(expense: ExpenseWithCategory): string {
    const lastDate = new Date(expense.date);
    const now = new Date();
    let nextDate = new Date(lastDate);

    switch (expense.recurring_interval) {
      case 'weekly':
        nextDate.setDate(lastDate.getDate() + 7);
        while (nextDate < now) {
          nextDate.setDate(nextDate.getDate() + 7);
        }
        break;
      case 'monthly':
        nextDate.setMonth(lastDate.getMonth() + 1);
        while (nextDate < now) {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        break;
      case 'yearly':
        nextDate.setFullYear(lastDate.getFullYear() + 1);
        while (nextDate < now) {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        break;
    }

    return formatDate(nextDate.toISOString().split('T')[0]);
  }

  function getIntervalLabel(interval?: string): string {
    switch (interval) {
      case 'weekly':
        return 'Щотижня';
      case 'monthly':
        return 'Щомісяця';
      case 'yearly':
        return 'Щороку';
      default:
        return '—';
    }
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
      <div className="mb-8">
        <Link href="/admin/finances/expenses">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад до витрат
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Регулярні витрати</h1>
        <p className="text-muted-foreground mt-2">
          Витрати, які автоматично додаються за розкладом
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Активні регулярні витрати</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Регулярних витрат не знайдено</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Категорія</TableHead>
                    <TableHead>Назва</TableHead>
                    <TableHead>Сума</TableHead>
                    <TableHead>Інтервал</TableHead>
                    <TableHead>Остання дата</TableHead>
                    <TableHead>Наступна дата</TableHead>
                    <TableHead>Активна</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: expense.category.color,
                            color: expense.category.color,
                          }}
                        >
                          <span className="mr-1">{expense.category.icon}</span>
                          {expense.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell>{expense.name}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(expense.amount_uah)}
                      </TableCell>
                      <TableCell>{getIntervalLabel(expense.recurring_interval)}</TableCell>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {getNextDate(expense)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={expense.is_recurring}
                          onCheckedChange={(checked) =>
                            toggleRecurring(expense.id, checked)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
