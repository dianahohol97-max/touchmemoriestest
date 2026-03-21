-- Automation Rules System

-- Create automation_rules table
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,

    -- Trigger configuration
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('order_status_changed', 'payment_received', 'order_created', 'birthday')),
    trigger_value TEXT, -- e.g., specific status like "shipped" for order_status_changed

    -- Action configuration
    action_type TEXT NOT NULL CHECK (action_type IN ('send_sms', 'send_email', 'change_order_status', 'create_task')),
    action_template TEXT NOT NULL, -- SMS/Email template with variables
    action_value TEXT, -- e.g., target status for change_order_status

    -- Execution settings
    is_active BOOLEAN DEFAULT true,
    delay_hours INTEGER DEFAULT 0, -- Delay before executing action

    -- Statistics
    execution_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    last_status TEXT, -- 'success' or 'failed'
    last_error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create automation_logs table to track executions
CREATE TABLE IF NOT EXISTS automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,

    -- Trigger details
    triggered_by TEXT, -- e.g., 'order', 'customer'
    trigger_ref_id UUID, -- Reference to order/customer ID

    -- Execution details
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    action_taken TEXT, -- Description of action taken
    error_message TEXT,

    -- Metadata
    template_variables JSONB, -- Variables used in template
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type, is_active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_trigger_ref ON automation_logs(trigger_ref_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed ON automation_logs(executed_at DESC);

-- Enable RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin full access to automation_rules" ON automation_rules
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access to automation_logs" ON automation_logs
    FOR ALL USING (auth.role() = 'authenticated');

-- Insert pre-built automation rules
INSERT INTO automation_rules (name, description, trigger_type, trigger_value, action_type, action_template, is_active) VALUES
(
    'Відправка ТТН',
    'Надіслати SMS клієнту коли замовлення передано в доставку',
    'order_status_changed',
    'shipped',
    'send_sms',
    'Вітаємо! Замовлення відправлено! ТТН: {tracking_number}. Відстежити: https://novaposhta.ua/tracking/?cargo_number={tracking_number}',
    true
),
(
    'Підтвердження замовлення',
    'Надіслати SMS після підтвердження замовлення',
    'order_status_changed',
    'confirmed',
    'send_sms',
    'Дякуємо, {customer_name}! Замовлення #{order_id} підтверджено. Сума: {order_total} грн. Очікуйте повідомлення про відправку.',
    true
),
(
    'Автопідтвердження після оплати',
    'Автоматично змінити статус на "Виробництво" після отримання оплати',
    'payment_received',
    null,
    'change_order_status',
    'Замовлення #{order_id} автоматично переведено в виробництво після оплати',
    true
),
(
    'День народження - знижка',
    'Надіслати SMS зі знижкою на день народження',
    'birthday',
    null,
    'send_sms',
    'Вітаємо з Днем народження, {customer_name}! 🎉 Ваша персональна знижка 15% на будь-яке замовлення: BIRTHDAY15. Дійсна 7 днів.',
    true
),
(
    'Нове замовлення - Email адміну',
    'Надіслати email адміністратору про нове замовлення',
    'order_created',
    null,
    'send_email',
    'Нове замовлення #{order_id} від {customer_name}. Сума: {order_total} грн. Телефон: {customer_phone}',
    true
),
(
    'Замовлення виконано',
    'Надіслати SMS після виконання замовлення',
    'order_status_changed',
    'delivered',
    'send_sms',
    'Дякуємо за замовлення, {customer_name}! Будемо раді бачити Вас знову. Залиште відгук: https://touchmemories.com.ua/reviews',
    true
)
ON CONFLICT DO NOTHING;
