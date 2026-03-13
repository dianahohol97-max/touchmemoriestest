'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ExpenseCategory } from '@/lib/types/expenses';

interface ExpensesFiltersProps {
  filters: {
    category_id: string;
    start_date: string;
    end_date: string;
    search: string;
  };
  categories: ExpenseCategory[];
  onFiltersChange: (filters: any) => void;
}

export function ExpensesFilters({ filters, categories, onFiltersChange }: ExpensesFiltersProps) {
  function handleReset() {
    onFiltersChange({
      category_id: '',
      start_date: '',
      end_date: '',
      search: '',
    });
  }

  function setCurrentMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    onFiltersChange({ ...filters, start_date: start, end_date: end });
  }

  function setCurrentQuarter() {
    const now = new Date();
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStart, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), quarterStart + 3, 0).toISOString().split('T')[0];
    onFiltersChange({ ...filters, start_date: start, end_date: end });
  }

  function setCurrentYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    onFiltersChange({ ...filters, start_date: start, end_date: end });
  }

  return (
    <div className="bg-muted/50 p-4 rounded-lg mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="category_filter">Категорія</Label>
          <Select
            value={filters.category_id}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, category_id: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Всі категорії" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Всі категорії</SelectItem>
              {Array.isArray(categories) && categories.map((category) => (
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

        <div>
          <Label htmlFor="start_date">Від дати</Label>
          <Input
            id="start_date"
            type="date"
            value={filters.start_date}
            onChange={(e) =>
              onFiltersChange({ ...filters, start_date: e.target.value })
            }
          />
        </div>

        <div>
          <Label htmlFor="end_date">До дати</Label>
          <Input
            id="end_date"
            type="date"
            value={filters.end_date}
            onChange={(e) =>
              onFiltersChange({ ...filters, end_date: e.target.value })
            }
          />
        </div>

        <div>
          <Label htmlFor="search">Пошук</Label>
          <Input
            id="search"
            placeholder="Назва, постачальник..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={setCurrentMonth}>
          Цей місяць
        </Button>
        <Button variant="outline" size="sm" onClick={setCurrentQuarter}>
          Цей квартал
        </Button>
        <Button variant="outline" size="sm" onClick={setCurrentYear}>
          Цей рік
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <X className="mr-1 h-4 w-4" />
          Скинути фільтри
        </Button>
      </div>
    </div>
  );
}
