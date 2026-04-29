-- Missing infrastructure tables that the code references but production doesn't have.
--
-- Audit on 2026-04-29 found that the following code paths fail silently or return 500
-- because the underlying tables were never created in prod:
--
--   - Order status email automation (email_templates, automation_settings, notification_log)
--     Affects: lib/automation/email-notifications.ts, app/api/automation/settings/route.ts
--     Symptom: customers do not receive email when order status changes.
--
--   - Salary + QC module (staff_shifts, qc_error_log, salary_calculations)
--     Affects: lib/salary/calculator.ts, app/api/admin/salary/*, app/api/admin/salary/qc/*
--     Symptom: /admin/salary returns 500; calculator returns zeroed shifts/QC.
--     Note: a non-applied migration exists at `supabase/migrations/salary_qc/20260313010000_salary_qc_module.sql`.
--           Supabase CLI does not recurse into subfolders, so it never ran. We re-state it
--           here at the correct location.
--
-- All `CREATE TABLE` use IF NOT EXISTS so this is safe to re-run on dev DBs that may
-- already have some of these. Defaults match the historical schema reference at
-- `lib/supabase/schema/automation.sql`.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. automation_settings — single-row config table for order automation
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_assign_designer BOOLEAN DEFAULT TRUE,
  notify_designer_telegram BOOLEAN DEFAULT TRUE,
  notify_customer_email BOOLEAN DEFAULT TRUE,
  standard_production_days INTEGER DEFAULT 5,
  express_production_days INTEGER DEFAULT 2,
  high_volume_threshold INTEGER DEFAULT 60,
  high_volume_extra_days INTEGER DEFAULT 1,
  busy_queue_threshold INTEGER DEFAULT 20,
  busy_queue_extra_days INTEGER DEFAULT 1,
  express_priority_boost INTEGER DEFAULT 2,
  vip_priority_boost INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a single config row only if the table is empty (the API uses .single() and 404s
-- if there's no row, which is why /api/automation/settings has been failing).
INSERT INTO automation_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM automation_settings);

ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins manage automation_settings' AND polrelid = 'automation_settings'::regclass) THEN
    CREATE POLICY "Admins manage automation_settings" ON automation_settings
      FOR ALL
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'));
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 2. email_templates — one row per OrderStatus, used by status-change emails
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_trigger TEXT NOT NULL UNIQUE CHECK (status_trigger IN (
    'pending', 'confirmed', 'in_production', 'quality_check', 'shipped', 'delivered', 'cancelled'
  )),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins manage email_templates' AND polrelid = 'email_templates'::regclass) THEN
    CREATE POLICY "Admins manage email_templates" ON email_templates
      FOR ALL
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'));
  END IF;
END $$;

-- Seed default templates from the schema reference (the four status changes the
-- code path actually fires for). Idempotent via ON CONFLICT.
INSERT INTO email_templates (status_trigger, subject, body, enabled) VALUES
('confirmed',
 'Ваше замовлення підтверджено - TouchMemories',
 E'Вітаємо, {{customer_name}}!\n\nВаше замовлення №{{order_number}} підтверджено і передано у виробництво.\n\nДеталі:\n- Товар: {{product_title}}\n- Дедлайн виробництва: {{production_deadline}}\n\nДякуємо, що обрали TouchMemories.',
 TRUE),
('in_production',
 'Ваша фотокнига друкується - TouchMemories',
 E'Вітаємо, {{customer_name}}!\n\nВаше замовлення №{{order_number}} зараз у виробництві.\n\nОчікуваний час завершення: {{production_deadline}}.',
 TRUE),
('shipped',
 'Відправлено - TouchMemories',
 E'Вітаємо, {{customer_name}}!\n\nВаше замовлення №{{order_number}} відправлено.\n\nТТН: {{tracking_number}}\nВідстеження: {{tracking_url}}',
 TRUE),
('delivered',
 'Доставлено - TouchMemories',
 E'Вітаємо, {{customer_name}}!\n\nВаше замовлення №{{order_number}} успішно доставлено.\n\nДякуємо за довіру.',
 TRUE)
ON CONFLICT (status_trigger) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────
-- 3. notification_log — append-only log of sent status-change notifications
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_email TEXT,
  customer_name TEXT,
  old_status TEXT,
  new_status TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  template_id UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_log_order_id_idx ON notification_log(order_id);
CREATE INDEX IF NOT EXISTS notification_log_sent_at_idx ON notification_log(sent_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins read notification_log' AND polrelid = 'notification_log'::regclass) THEN
    CREATE POLICY "Admins read notification_log" ON notification_log
      FOR SELECT
      USING (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role IN ('admin','manager')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service inserts notification_log' AND polrelid = 'notification_log'::regclass) THEN
    -- Service-role inserts only; regular auth users cannot write here.
    CREATE POLICY "Service inserts notification_log" ON notification_log
      FOR INSERT
      WITH CHECK (false);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. staff_shifts — daily-shift records, used by salary calculator (per-shift rate)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, work_date)
);

CREATE INDEX IF NOT EXISTS staff_shifts_work_date_idx ON staff_shifts(work_date);

ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated manage staff_shifts' AND polrelid = 'staff_shifts'::regclass) THEN
    CREATE POLICY "Authenticated manage staff_shifts" ON staff_shifts
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 5. qc_error_log — penalty points per staff member, used by salary calculator
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qc_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  error_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qc_error_log_staff_id_idx ON qc_error_log(staff_id);
CREATE INDEX IF NOT EXISTS qc_error_log_error_date_idx ON qc_error_log(error_date);

ALTER TABLE qc_error_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated manage qc_error_log' AND polrelid = 'qc_error_log'::regclass) THEN
    CREATE POLICY "Authenticated manage qc_error_log" ON qc_error_log
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 6. salary_calculations — periodic salary records per staff member
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'partial')),
  notes TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS salary_calculations_staff_id_idx ON salary_calculations(staff_id);
CREATE INDEX IF NOT EXISTS salary_calculations_date_from_idx ON salary_calculations(date_from);

ALTER TABLE salary_calculations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated manage salary_calculations' AND polrelid = 'salary_calculations'::regclass) THEN
    CREATE POLICY "Authenticated manage salary_calculations" ON salary_calculations
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 7. Extend `expenses` for recurring-expenses cron
-- ─────────────────────────────────────────────────────────────────────────
-- The `recurring-expenses` cron at app/api/cron/recurring-expenses/route.ts
-- reads/writes columns that the live `expenses` table doesn't have.
-- Adding them here so the cron can run without 500ing on every invocation.
-- All NULL by default; existing rows are unaffected.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_interval TEXT
  CHECK (recurring_interval IS NULL OR recurring_interval IN ('weekly', 'monthly', 'yearly'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE INDEX IF NOT EXISTS expenses_is_recurring_idx ON expenses(is_recurring) WHERE is_recurring = TRUE;


-- ─────────────────────────────────────────────────────────────────────────
-- Final note: this migration creates infrastructure tables that have been silently
-- broken in production. Once applied, the next code change should also rewrite
-- weekly-report's TOP PRODUCTS query (it uses a non-existent order_items table;
-- order line items live in orders.items JSONB), and remove the dead ai_chat_*
-- and editor_projects references in code, since those tables are not used.
