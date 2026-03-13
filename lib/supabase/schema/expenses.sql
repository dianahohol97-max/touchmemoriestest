-- Expense Categories Table
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL, -- emoji
  color TEXT NOT NULL, -- hex color for charts
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UAH',
  amount_uah NUMERIC(12, 2) NOT NULL,
  exchange_rate NUMERIC(10, 4) DEFAULT 1.0,
  date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_interval TEXT CHECK (recurring_interval IN ('monthly', 'weekly', 'yearly')),
  supplier TEXT,
  invoice_number TEXT,
  receipt_url TEXT,
  notes TEXT,
  added_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_expenses_added_by ON expenses(added_by);

-- RLS Policies for expense_categories
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view expense categories"
  ON expense_categories FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage expense categories"
  ON expense_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- RLS Policies for expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all expenses"
  ON expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Staff can create expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Only admins can update/delete expenses"
  ON expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- Insert default expense categories
INSERT INTO expense_categories (name, icon, color, sort_order) VALUES
  ('Реклама', '📢', '#FF6B6B', 1),
  ('Пакування', '📦', '#4ECDC4', 2),
  ('Матеріали', '🖨️', '#95E1D3', 3),
  ('Оренда', '🏠', '#F38181', 4),
  ('Зарплати', '👥', '#AA96DA', 5),
  ('Інше', '💼', '#FCBAD3', 6)
ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
