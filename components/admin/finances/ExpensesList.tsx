'use client';

import { useState } from 'react';
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
import { Pencil, Trash2, Receipt } from 'lucide-react';
import type { ExpenseWithCategory, ExpenseCategory } from '@/lib/types/expenses';
import { EditExpenseDialog } from './EditExpenseDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ExpensesListProps {
  expenses: ExpenseWithCategory[];
  categories: ExpenseCategory[];
  onUpdate: () => void;
}

export function ExpensesList({ expenses, categories, onUpdate }: ExpensesListProps) {
  const [editingExpense, setEditingExpense] = useState<ExpenseWithCategory | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
    } finally {
      setDeletingExpenseId(null);
    }
  }

  function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: currency === 'UAH' ? 'UAH' : currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Витрати не знайдено</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-[3px] border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Категорія</TableHead>
              <TableHead>Назва</TableHead>
              <TableHead>Постачальник</TableHead>
              <TableHead className="text-right">Сума</TableHead>
              <TableHead className="text-right">Сума (UAH)</TableHead>
              <TableHead className="w-[100px]">Дії</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.isArray(expenses) && expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(expense.date)}
                </TableCell>
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
                <TableCell>
                  <div className="flex items-center gap-2">
                    {expense.name}
                    {expense.is_recurring && (
                      <Badge variant="secondary" className="text-xs">
                        Регулярна
                      </Badge>
                    )}
                    {expense.receipt_url && (
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {expense.supplier || '—'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(expense.amount, expense.currency)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(expense.amount_uah, 'UAH')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingExpense(expense)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingExpenseId(expense.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          categories={categories}
          open={!!editingExpense}
          onOpenChange={(open) => !open && setEditingExpense(null)}
          onSuccess={() => {
            setEditingExpense(null);
            onUpdate();
          }}
        />
      )}

      <AlertDialog open={!!deletingExpenseId} onOpenChange={(open) => !open && setDeletingExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити витрату?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія не може бути скасована. Витрата буде видалена назавжди.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingExpenseId && handleDelete(deletingExpenseId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
