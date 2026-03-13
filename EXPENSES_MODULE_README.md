# Business Expenses Tracking Module

Comprehensive expenses tracking and P&L reporting system for TouchMemories business.

## Features

### 1. Expense Management (`/admin/finances/expenses`)

#### Dashboard Metrics
- **Current Month Expenses**: Total expenses with percentage change vs previous month
- **Current Quarter Expenses**: Quarterly total
- **Current Year Expenses**: Annual total
- **Category Breakdown**: Donut chart showing expense distribution by category

#### Expense Categories
Default categories with icons and colors:
- 📢 Реклама (Advertising) - #FF6B6B
- 📦 Пакування (Packaging) - #4ECDC4
- 🖨️ Матеріали (Materials) - #95E1D3
- 🏠 Оренда (Rent) - #F38181
- 👥 Зарплати (Salaries) - #AA96DA
- 💼 Інше (Other) - #FCBAD3

#### Expense Form Features
- Category selection with icons
- Multi-currency support (UAH, USD, EUR)
- Automatic exchange rate fetching from NBU (National Bank of Ukraine) API
- Automatic UAH conversion
- Supplier tracking
- Invoice number tracking
- Receipt upload (Supabase Storage)
- Recurring expenses setup (weekly/monthly/yearly)
- Period tracking (start/end dates)
- Notes field

#### Filters
- Filter by category
- Date range filters (from/to)
- Quick filters: This Month, This Quarter, This Year
- Search by name or supplier
- Sort by date, amount, category

#### Excel Export
Export all expenses to Excel with:
- Date, Category, Name, Amount, Currency, Exchange Rate
- UAH Amount, Supplier, Invoice Number
- Recurring status, Interval, Notes

### 2. Recurring Expenses (`/admin/finances/expenses/recurring`)

#### Features
- View all recurring expenses
- See next scheduled date for each expense
- Enable/disable recurring expenses
- Automatic creation via Vercel Cron job

#### Automatic Processing
- **Cron Schedule**: Daily at 00:00 UTC
- **Endpoint**: `/api/cron/recurring-expenses`
- **Auth**: Requires `CRON_SECRET` environment variable
- **Logic**: Checks each recurring expense and creates new entries when due

### 3. P&L Report (`/admin/finances/report`)

#### Period Selection
- This Month
- This Quarter
- This Year
- Custom Date Range

#### Report Sections

**REVENUE (Доходи)**
- Total revenue from paid orders
- Breakdown by product categories

**EXPENSES (Витрати)**
- **COGS (Собівартість)**: Cost of Goods Sold calculated from products' cost_price
- **Operational Expenses**: By expense categories (excluding salaries)
- **Salaries (Зарплати)**: From salary_periods table

**PROFIT (Прибуток)**
- **Gross Profit (Валовий прибуток)**: Revenue - COGS
- **Operational Profit (Операційний прибуток)**: Gross Profit - Operational Expenses - Salaries
- **Margin (Маржинальність)**: (Operational Profit / Revenue) × 100%

#### Visual Analytics
- Monthly Trend Chart: Last 12 months revenue vs expenses vs profit (Bar Chart)

#### PDF Export
Export beautiful P&L report to PDF with:
- Summary section with all calculations
- Revenue breakdown by category
- Expenses breakdown by category
- Monthly trend table
- Automatic pagination
- Generated timestamp and page numbers

## Database Schema

### expense_categories
```sql
- id (uuid, PK)
- name (text) — Category name
- icon (text) — Emoji icon
- color (text) — Hex color for charts
- sort_order (int) — Display order
- created_at (timestamptz)
- updated_at (timestamptz)
```

### expenses
```sql
- id (uuid, PK)
- category_id (uuid, FK → expense_categories)
- name (text) — Expense name
- amount (numeric) — Amount in original currency
- currency (text, default "UAH") — UAH/USD/EUR
- amount_uah (numeric) — Converted to UAH
- exchange_rate (numeric) — Exchange rate used
- date (date) — Expense date
- period_start (date) — For period expenses
- period_end (date) — For period expenses
- is_recurring (boolean) — Auto-recurring flag
- recurring_interval (text) — monthly/weekly/yearly
- supplier (text) — Supplier name
- invoice_number (text) — Invoice #
- receipt_url (text) — Supabase Storage URL
- notes (text) — Additional notes
- added_by (uuid, FK → staff)
- created_at (timestamptz)
- updated_at (timestamptz)
```

## API Endpoints

### Expense Categories
- `GET /api/expenses/categories` - List all categories
- `POST /api/expenses/categories` - Create category (admin only)
- `PATCH /api/expenses/categories/[id]` - Update category (admin only)
- `DELETE /api/expenses/categories/[id]` - Delete category (admin only)

### Expenses
- `GET /api/expenses` - List expenses (supports filters)
  - Query params: `category_id`, `start_date`, `end_date`, `is_recurring`
- `POST /api/expenses` - Create expense
- `GET /api/expenses/[id]` - Get single expense
- `PATCH /api/expenses/[id]` - Update expense
- `DELETE /api/expenses/[id]` - Delete expense (admin only)

### Metrics & Reports
- `GET /api/expenses/metrics` - Get dashboard metrics
- `GET /api/expenses/exchange-rate` - Get NBU exchange rate
  - Query params: `currency` (USD/EUR), `date` (optional)
- `GET /api/finances/pl-report` - Generate P&L report
  - Query params: `start_date`, `end_date` (required)

### Cron Jobs
- `GET /api/cron/recurring-expenses` - Process recurring expenses
  - Requires `Authorization: Bearer ${CRON_SECRET}`

## Setup Instructions

### 1. Database Setup
Run the SQL schema:
```bash
psql -U postgres -d touchmemories -f lib/supabase/schema/expenses.sql
```

### 2. Environment Variables
Add to `.env.local`:
```
CRON_SECRET=your-secure-random-string
```

### 3. Vercel Configuration
The `vercel.json` is already configured with the cron job:
```json
{
  "crons": [{
    "path": "/api/cron/recurring-expenses",
    "schedule": "0 0 * * *"
  }]
}
```

### 4. Dependencies
Required packages (already installed):
```json
{
  "xlsx": "^0.18.5",
  "jspdf": "^2.5.1",
  "jspdf-autotable": "^3.8.2",
  "recharts": "^2.10.0"
}
```

## RLS (Row Level Security) Policies

### expense_categories
- Anyone can view categories
- Only admins can create/update/delete

### expenses
- All staff can view expenses
- All staff can create expenses
- Only admins can update/delete expenses

## Usage Examples

### Adding an Expense
1. Navigate to `/admin/finances/expenses`
2. Click "Додати витрату" (Add Expense)
3. Fill in the form:
   - Select category
   - Enter expense name
   - Enter amount and currency
   - System auto-fetches exchange rate from NBU
   - Select date
   - Optionally add supplier, invoice number, notes
   - Check "Регулярна витрата" for recurring
4. Click "Додати витрату" to save

### Setting Up Recurring Expense
1. When adding/editing expense, check "Регулярна витрата"
2. Select interval (weekly/monthly/yearly)
3. The cron job will automatically create new entries

### Viewing P&L Report
1. Navigate to `/admin/finances/report`
2. Select period (month/quarter/year/custom)
3. View revenue, expenses, and profit breakdown
4. Export to PDF for presentations

### Exporting Data
- **Expenses to Excel**: Click "Експорт Excel" on expenses page
- **P&L to PDF**: Click "Експорт PDF" on P&L report page

## Exchange Rate Integration

The system uses the National Bank of Ukraine (NBU) public API:
- **Endpoint**: `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange`
- **Currencies**: USD (code 840), EUR (code 978)
- **Auto-fetch**: On date/currency change in expense form
- **Fallback**: Default rates (USD: 40, EUR: 42) if API fails

## Future Enhancements

Potential improvements:
- Budget planning and alerts
- Expense approval workflow
- Attach multiple receipts per expense
- OCR for automatic receipt parsing
- Email notifications for recurring expenses
- Custom expense categories
- Expense tags/labels
- Advanced analytics and forecasting
- Mobile app integration
- Multi-store expense tracking

## Troubleshooting

### Cron job not running
1. Verify `CRON_SECRET` is set in Vercel environment variables
2. Check Vercel deployment logs
3. Manually trigger: `curl -H "Authorization: Bearer ${CRON_SECRET}" https://yourdomain.com/api/cron/recurring-expenses`

### Exchange rate not loading
1. Check internet connectivity
2. Verify NBU API is accessible
3. System falls back to default rates automatically

### PDF/Excel export not working
1. Check browser allows downloads
2. Verify libraries are installed: `npm install xlsx jspdf jspdf-autotable`
3. Check browser console for errors

## Support

For issues or questions:
1. Check this documentation
2. Review code in `lib/supabase/expenses.ts`
3. Check API responses in browser DevTools
4. Review Supabase logs for database errors
