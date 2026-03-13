import * as XLSX from 'xlsx';
import type { ExpenseWithCategory } from '@/lib/types/expenses';

export function exportExpensesToExcel(
  expenses: ExpenseWithCategory[],
  filename: string = 'expenses.xlsx'
) {
  // Prepare data for Excel
  const data = expenses.map((expense) => ({
    'Дата': new Date(expense.date).toLocaleDateString('uk-UA'),
    'Категорія': expense.category.name,
    'Назва': expense.name,
    'Сума': expense.amount,
    'Валюта': expense.currency,
    'Курс': expense.exchange_rate,
    'Сума (UAH)': expense.amount_uah,
    'Постачальник': expense.supplier || '',
    'Номер рахунку': expense.invoice_number || '',
    'Регулярна': expense.is_recurring ? 'Так' : 'Ні',
    'Інтервал': expense.recurring_interval || '',
    'Нотатки': expense.notes || '',
  }));

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Витрати');

  // Set column widths
  const colWidths = [
    { wch: 12 }, // Дата
    { wch: 15 }, // Категорія
    { wch: 30 }, // Назва
    { wch: 12 }, // Сума
    { wch: 8 },  // Валюта
    { wch: 10 }, // Курс
    { wch: 12 }, // Сума (UAH)
    { wch: 20 }, // Постачальник
    { wch: 15 }, // Номер рахунку
    { wch: 10 }, // Регулярна
    { wch: 12 }, // Інтервал
    { wch: 30 }, // Нотатки
  ];
  ws['!cols'] = colWidths;

  // Generate Excel file
  XLSX.writeFile(wb, filename);
}

export function exportSalariesToExcel(
  salaries: any[],
  filename: string = 'salaries.xlsx'
) {
  const data = salaries.map((s) => {
    const breakdown = s.breakdown || {};
    const flatData: any = {
      'Співробітник': s.staff?.name,
      'Роль': s.staff?.role,
      'Період': `${s.date_from} - ${s.date_to}`,
      'Разом (₴)': s.total_amount,
      'Статус': s.status,
    };

    // Add breakdown components as columns
    Object.entries(breakdown).forEach(([key, item]: [string, any]) => {
      flatData[item.label] = item.value;
    });

    return flatData;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Зарплати');

  XLSX.writeFile(wb, filename);
}
