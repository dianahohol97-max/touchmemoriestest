'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { ExpenseWithCategory, ExpenseCategory, Currency, RecurringInterval } from '@/lib/types/expenses';

interface EditExpenseDialogProps {
  expense: ExpenseWithCategory;
  categories: ExpenseCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditExpenseDialog({ expense, categories, open, onOpenChange, onSuccess }: EditExpenseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    category_id: expense.category_id,
    name: expense.name,
    amount: expense.amount,
    currency: expense.currency as Currency,
    date: expense.date,
    supplier: expense.supplier || '',
    invoice_number: expense.invoice_number || '',
    is_recurring: expense.is_recurring,
    recurring_interval: expense.recurring_interval,
    notes: expense.notes || '',
  });
  const [exchangeRate, setExchangeRate] = useState<number>(expense.exchange_rate);
  const [isLoadingRate, setIsLoadingRate] = useState(false);

  useEffect(() => {
    if (formData.currency !== 'UAH' && formData.date) {
      fetchExchangeRate();
    } else {
      setExchangeRate(1);
    }
  }, [formData.currency, formData.date]);

  async function fetchExchangeRate() {
    if (formData.currency === 'UAH') return;

    setIsLoadingRate(true);
    try {
      const response = await fetch(
        `/api/expenses/exchange-rate?currency=${formData.currency}&date=${formData.date}`
      );
      const data = await response.json();
      setExchangeRate(data.rate);
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    } finally {
      setIsLoadingRate(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          exchange_rate: exchangeRate,
        }),
      });

      if (response.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error updating expense:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редагувати витрату</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="category">Категорія *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category_id: value }))
                }
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="name">Назва витрати *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="amount">Сума *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="currency">Валюта *</Label>
              <Select
                value={formData.currency}
                onValueChange={(value: Currency) =>
                  setFormData((prev) => ({ ...prev, currency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UAH">UAH (₴)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.currency !== 'UAH' && (
              <div className="col-span-2">
                <Label htmlFor="exchange_rate">
                  Курс обміну {isLoadingRate && '(завантаження...)'}
                </Label>
                <Input
                  id="exchange_rate"
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                  disabled={isLoadingRate}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Сума в UAH: ₴{(formData.amount * exchangeRate).toFixed(2)}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="date">Дата *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="supplier">Постачальник</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, supplier: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="invoice_number">Номер рахунку</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, invoice_number: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_recurring: checked as boolean }))
                  }
                />
                <Label htmlFor="is_recurring" className="cursor-pointer">
                  Регулярна витрата
                </Label>
              </div>
            </div>

            {formData.is_recurring && (
              <div className="col-span-2">
                <Label htmlFor="recurring_interval">Інтервал</Label>
                <Select
                  value={formData.recurring_interval}
                  onValueChange={(value: RecurringInterval) =>
                    setFormData((prev) => ({ ...prev, recurring_interval: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Щотижня</SelectItem>
                    <SelectItem value="monthly">Щомісяця</SelectItem>
                    <SelectItem value="yearly">Щороку</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="col-span-2">
              <Label htmlFor="notes">Нотатки</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Збереження...' : 'Зберегти зміни'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
