-- Message Templates Table
-- Stores SMS and Email templates with variables for automation and manual sending

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sms', 'email')),
    category TEXT NOT NULL CHECK (category IN ('order', 'payment', 'delivery', 'marketing')),
    subject TEXT, -- only for email
    body TEXT NOT NULL,
    variables TEXT[] DEFAULT ARRAY[]::TEXT[], -- available variables like {client_name}, {order_id}
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(type);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);

-- RLS Policies
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON message_templates;
CREATE POLICY "Enable read access for authenticated users" ON message_templates
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON message_templates;
CREATE POLICY "Enable insert for authenticated users" ON message_templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users" ON message_templates;
CREATE POLICY "Enable update for authenticated users" ON message_templates
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON message_templates;
CREATE POLICY "Enable delete for authenticated users" ON message_templates
    FOR DELETE USING (auth.role() = 'authenticated');

-- Pre-built Templates
INSERT INTO message_templates (name, type, category, subject, body, variables) VALUES
(
    'Підтвердження замовлення',
    'sms',
    'order',
    NULL,
    'Дякуємо за замовлення #{order_id}! Ваше замовлення прийнято і буде оброблено найближчим часом. TouchMemories',
    ARRAY['order_id']
),
(
    'Запит оплати',
    'sms',
    'payment',
    NULL,
    '{client_name}, посилання для оплати замовлення #{order_id} на {total_price} грн: {payment_link}. TouchMemories',
    ARRAY['client_name', 'order_id', 'total_price', 'payment_link']
),
(
    'Замовлення відправлено',
    'sms',
    'delivery',
    NULL,
    '{client_name}, ваше замовлення відправлено! Трек-номер: {tracking_number}. Відстежити: novaposhta.ua. TouchMemories',
    ARRAY['client_name', 'tracking_number']
),
(
    'День народження',
    'sms',
    'marketing',
    NULL,
    '{client_name}, вітаємо з Днем народження! 🎉 Даруємо знижку 15% на всі товари. Код: BIRTHDAY15. TouchMemories',
    ARRAY['client_name']
),
(
    'Підтвердження замовлення',
    'email',
    'order',
    'Дякуємо за замовлення #{order_id} — TouchMemories',
    '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: #263a99; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;"><h1 style="margin: 0;">TouchMemories</h1></div><div style="background: #f8f9ff; padding: 30px; border-radius: 0 0 8px 8px;"><h2 style="color: #263a99;">Дякуємо за замовлення!</h2><p>Шановний(-а) <strong>{client_name}</strong>,</p><p>Ваше замовлення <strong>#{order_id}</strong> успішно прийнято і буде оброблено найближчим часом.</p><div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0;"><strong>Сума замовлення:</strong> {total_price} грн</p></div><p>Ми зв''яжемося з вами найближчим часом для підтвердження деталей.</p><p style="margin-top: 30px;">З повагою,<br><strong>Команда TouchMemories</strong></p></div></body></html>',
    ARRAY['client_name', 'order_id', 'total_price']
);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_templates_updated_at ON message_templates;
CREATE TRIGGER message_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_message_templates_updated_at();
