# Salary Definition Schema
This file contains the configuration for the structural tables required to run the Salary Calculation system.

## staff_work_log
- **id**: UUID, Primary Key.
- **staff_id**: UUID, Foreign Key.
- **order_id**: UUID, Foreign Key.
- **action**: TEXT, Constraint: `assigned_manager`, `assigned_designer`, `status_changed`, `completed`.
- **old_status**: TEXT.
- **new_status**: TEXT.
- **logged_at**: TIMESTAMPTZ, default now.
- **notes**: TEXT.

## salary_periods
- **id**: UUID, Primary Key.
- **staff_id**: UUID, Foreign Key.
- **period_start**: DATE.
- **period_end**: DATE.
- **orders_managed**: INT, default 0.
- **orders_designed**: INT, default 0.
- **base_amount**: NUMERIC, default 0.
- **bonus_amount**: NUMERIC, default 0.
- **total_amount**: NUMERIC, default 0.
- **status**: TEXT, Constraint: `draft`, `approved`, `paid`.
- **notes**: TEXT.
- **created_at**: TIMESTAMPTZ, default now.
