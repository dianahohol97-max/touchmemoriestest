-- Automation Settings Table
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

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_trigger TEXT NOT NULL CHECK (status_trigger IN (
    'pending', 'confirmed', 'in_production', 'quality_check', 'shipped', 'delivered', 'cancelled'
  )),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(status_trigger)
);

-- Add columns to orders table for automation
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_deadline TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority_score BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manual_priority_override INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_designer_id UUID REFERENCES staff(id) ON DELETE SET NULL;

-- Add telegram_chat_id to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Insert default automation settings
INSERT INTO automation_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Insert default email templates
INSERT INTO email_templates (status_trigger, subject, body, enabled) VALUES
(
  'confirmed',
  'Ваше замовлення підтверджено - TouchMemories',
  E'Вітаємо, {{customer_name}}!\n\nВаше замовлення №{{order_number}} підтверджено і передано у виробництво.\n\nДеталі замовлення:\n- Товар: {{product_title}}\n- Дедлайн виробництва: {{production_deadline}}\n\nМи повідомимо вас про кожен етап виготовлення.\n\nДякуємо, що обрали TouchMemories! 💙\n\n---\nЦей лист надіслано автоматично. Якщо у вас виникли питання, відповідайте на цей email.',
  TRUE
),
(
  'in_production',
  'Ваша фотокнига друкується - TouchMemories',
  E'Вітаємо, {{customer_name}}!\n\nВаше замовлення №{{order_number}} зараз у виробництві.\nНаша команда працює над створенням вашої унікальної фотокниги! 📸✨\n\nОчікуваний час завершення: {{production_deadline}}\n\nМи повідомимо вас, як тільки замовлення буде готове до відправки.\n\nДякуємо за терпіння!\n\n---\nTouchMemories - Ваші спогади назавжди 💙',
  TRUE
),
(
  'shipped',
  'Відправлено! Ваше замовлення в дорозі - TouchMemories',
  E'Чудові новини, {{customer_name}}! 🎉\n\nВаше замовлення №{{order_number}} відправлено!\n\n📦 ТТН: {{tracking_number}}\n🔗 Відстежити посилку: {{tracking_url}}\n\nОчікуваний час доставки: 1-3 робочих дні\n\nДякуємо, що обрали TouchMemories!\n\n---\nЯкщо у вас виникли питання щодо доставки, зв\'яжіться з нами.',
  TRUE
),
(
  'delivered',
  'Доставлено! Сподіваємось вам сподобається - TouchMemories',
  E'Вітаємо, {{customer_name}}! 🎉\n\nВаше замовлення №{{order_number}} успішно доставлено!\n\nСподіваємось, ваша фотокнига принесе вам багато радості та теплих спогадів. 💙\n\nБудемо раді, якщо ви поділитеся враженнями:\n- Залиште відгук на нашому сайті\n- Відзначте нас в Instagram @touchmemories\n\nДякуємо, що довірили нам зберігати ваші найцінніші моменти!\n\n---\nTouchMemories - Ваші спогади назавжди',
  TRUE
)
ON CONFLICT (status_trigger) DO NOTHING;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_production_deadline ON orders(production_deadline);
CREATE INDEX IF NOT EXISTS idx_orders_priority_score ON orders(priority_score);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_designer ON orders(assigned_designer_id);
CREATE INDEX IF NOT EXISTS idx_staff_telegram_chat ON staff(telegram_chat_id);

-- RLS Policies
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify automation settings
CREATE POLICY "Only admins can access automation_settings"
  ON automation_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- Only admins can manage email templates
CREATE POLICY "Only admins can access email_templates"
  ON email_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_automation_settings_updated_at
  BEFORE UPDATE ON automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
