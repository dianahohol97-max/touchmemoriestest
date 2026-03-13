-- AI Chat Conversations Table
CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  customer_email TEXT,
  customer_name TEXT,
  customer_ip TEXT,
  is_handled_by_ai BOOLEAN DEFAULT TRUE,
  assigned_to_human UUID REFERENCES staff(id) ON DELETE SET NULL,
  handoff_reason TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  customer_satisfaction INTEGER CHECK (customer_satisfaction BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Chat Messages Table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  context_used TEXT, -- JSON string of context provided to AI
  failed_attempt BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Chat Context Sources (for knowledge base)
CREATE TABLE IF NOT EXISTS ai_chat_context_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('faq', 'product', 'pricing', 'delivery', 'custom')),
  question TEXT,
  answer TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Chat Statistics
CREATE TABLE IF NOT EXISTS ai_chat_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_conversations INTEGER DEFAULT 0,
  ai_resolved_conversations INTEGER DEFAULT 0,
  human_handoff_conversations INTEGER DEFAULT 0,
  average_messages_per_conversation NUMERIC(5, 2) DEFAULT 0,
  average_ai_resolution_time_minutes INTEGER DEFAULT 0,
  customer_satisfaction_avg NUMERIC(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_session ON ai_chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_assigned ON ai_chat_conversations(assigned_to_human);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation ON ai_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created ON ai_chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_chat_context_category ON ai_chat_context_sources(category);
CREATE INDEX IF NOT EXISTS idx_ai_chat_context_enabled ON ai_chat_context_sources(enabled) WHERE enabled = TRUE;

-- RLS Policies
ALTER TABLE ai_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_context_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_statistics ENABLE ROW LEVEL SECURITY;

-- Public can create conversations and messages
CREATE POLICY "Anyone can create conversations"
  ON ai_chat_conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view their own conversation"
  ON ai_chat_conversations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update their own conversation"
  ON ai_chat_conversations FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can create messages"
  ON ai_chat_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view messages in conversations"
  ON ai_chat_messages FOR SELECT
  USING (true);

-- Staff can view all conversations and manage context
CREATE POLICY "Staff can view all conversations"
  ON ai_chat_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Staff can update conversations"
  ON ai_chat_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all messages"
  ON ai_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage context sources"
  ON ai_chat_context_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view enabled context"
  ON ai_chat_context_sources FOR SELECT
  USING (enabled = TRUE);

CREATE POLICY "Only admins can view statistics"
  ON ai_chat_statistics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
    )
  );

-- Triggers
CREATE TRIGGER update_ai_chat_conversations_updated_at
  BEFORE UPDATE ON ai_chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_chat_context_sources_updated_at
  BEFORE UPDATE ON ai_chat_context_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default FAQ context
INSERT INTO ai_chat_context_sources (category, question, answer, priority) VALUES
(
  'faq',
  'Які формати фотокниг ви пропонуєте?',
  'Ми пропонуємо кілька форматів: 20x20см (міні), 25x25см (стандарт), 30x30см (преміум). Всі формати доступні з твердою або м''якою обкладинкою.',
  10
),
(
  'faq',
  'Скільки часу займає виробництво?',
  'Стандартне виробництво займає 5 робочих днів. Якщо замовлення терміново, є опція експрес-виробництва за 2 робочих дні (позначте тег "⚡ Відправити швидше").',
  10
),
(
  'faq',
  'Які способи доставки?',
  'Ми відправляємо Новою Поштою по всій Україні. Вартість доставки розраховується за тарифами Нової Пошти. Після відправки ви отримаєте ТТН для відстеження.',
  10
),
(
  'faq',
  'Які способи оплати?',
  'Приймаємо оплату карткою онлайн (Visa, Mastercard), переказ на банківську карту, або оплату при отриманні (накладений платіж).',
  10
),
(
  'faq',
  'Чи можна повернути замовлення?',
  'Так, ви можете повернути замовлення протягом 14 днів після отримання, якщо фотокнига не була використана і знаходиться в оригінальній упаковці. Повернення коштів протягом 5-7 робочих днів.',
  9
),
(
  'faq',
  'Як користуватись конструктором?',
  'Наш конструктор дуже простий: 1) Оберіть формат та кількість сторінок, 2) Завантажте фото, 3) Перетягуйте фото на сторінки, 4) Додайте текст якщо потрібно, 5) Оформіть замовлення. Є автозаповнення шаблонів для швидкого створення.',
  8
),
(
  'pricing',
  'Яка вартість фотокниги?',
  'Ціна залежить від формату і кількості сторінок. Приблизно: 20x20см від 450 грн, 25x25см від 650 грн, 30x30см від 850 грн. Точну ціну ви побачите в конструкторі.',
  10
),
(
  'delivery',
  'Скільки коштує доставка?',
  'Доставка розраховується за тарифами Нової Пошти залежно від вашого міста та ваги посилки. Зазвичай це 50-80 грн по Україні.',
  9
)
ON CONFLICT DO NOTHING;
