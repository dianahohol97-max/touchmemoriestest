# 🎯 Як увімкнути Designer Service - ПОКРОКОВА ІНСТРУКЦІЯ

## Крок 1: Відкрийте Supabase Dashboard

1. Перейдіть за посиланням: **https://supabase.com/dashboard/project/yivfsicvaoewxrtkrfxr**
2. Увійдіть в ваш акаунт (якщо потрібно)

## Крок 2: Відкрийте SQL Editor

1. В лівому меню клацніть на **"SQL Editor"** (іконка з кодом)
2. Клацніть кнопку **"+ New query"** (вгорі праворуч)

## Крок 3: Скопіюйте та виконайте SQL

Скопіюйте **ВЕСЬ КОД НИЖЧЕ** і вставте в SQL Editor:

```sql
-- ============================================
-- DESIGNER SERVICE SETUP
-- ============================================

-- 1. Create design_briefs table
CREATE TABLE IF NOT EXISTS design_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  occasion TEXT,
  style_preference TEXT,
  important_photos TEXT,
  title_text TEXT,
  additional_notes TEXT,
  photo_order TEXT,
  is_gift BOOLEAN DEFAULT FALSE,
  photos_count INTEGER DEFAULT 0,
  photos_folder TEXT,
  photos_metadata JSONB DEFAULT '[]'::JSONB,
  status TEXT DEFAULT 'waiting_brief',
  ai_draft_project_id UUID,
  ai_analysis_result JSONB,
  ai_layout_plan JSONB,
  ai_error TEXT,
  submitted_at TIMESTAMPTZ,
  ai_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create design_revisions table
CREATE TABLE IF NOT EXISTS design_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  revision_number INTEGER NOT NULL,
  project_id UUID NOT NULL,
  client_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sent_to_client_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  client_decision TEXT,
  client_comments JSONB DEFAULT '[]'::JSONB,
  general_feedback TEXT,
  designer_notes TEXT,
  revision_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_designer_option BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS designer_service_price NUMERIC(10, 2) DEFAULT 500;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_free_revisions INTEGER DEFAULT 2;

-- 4. Add columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS with_designer BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS designer_service_fee NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS brief_token UUID;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_design_briefs_order ON design_briefs(order_id);
CREATE INDEX IF NOT EXISTS idx_design_briefs_token ON design_briefs(token);
CREATE INDEX IF NOT EXISTS idx_design_briefs_status ON design_briefs(status);
CREATE INDEX IF NOT EXISTS idx_design_revisions_order ON design_revisions(order_id);
CREATE INDEX IF NOT EXISTS idx_design_revisions_token ON design_revisions(client_token);

-- 6. Enable RLS
ALTER TABLE design_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_revisions ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies
DROP POLICY IF EXISTS "Anyone can access brief via token" ON design_briefs;
CREATE POLICY "Anyone can access brief via token" ON design_briefs FOR ALL USING (true);

DROP POLICY IF EXISTS "Anyone can access revision via token" ON design_revisions;
CREATE POLICY "Anyone can access revision via token" ON design_revisions FOR ALL USING (true);

-- 8. Enable designer option on product
UPDATE products
SET
  has_designer_option = true,
  designer_service_price = 500,
  max_free_revisions = 2
WHERE slug = 'classic-photobook-20x20';

-- 9. Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('design-briefs', 'design-briefs', true)
ON CONFLICT (id) DO NOTHING;

-- 10. Storage policies
DROP POLICY IF EXISTS "Anyone can upload to design-briefs" ON storage.objects;
CREATE POLICY "Anyone can upload to design-briefs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'design-briefs');

DROP POLICY IF EXISTS "Anyone can view design-briefs" ON storage.objects;
CREATE POLICY "Anyone can view design-briefs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'design-briefs');

-- ✅ DONE!
```

## Крок 4: Виконайте SQL

1. Після вставки коду натисніть кнопку **"RUN"** (або **Cmd+Enter** / **Ctrl+Enter**)
2. Зачекайте кілька секунд
3. Ви побачите повідомлення "Success. No rows returned"

## Крок 5: Перевірте результат

1. Відкрийте в браузері: **http://localhost:3000/catalog/photobooks/classic-photobook-20x20**
2. Прокрутіть вниз після параметрів продукту
3. Ви побачите **ФІОЛЕТОВИЙ БЛОК** з текстом:

```
✨ Послуга дизайнера "Зроби за мене"

Завантажте фото, заповніть короткий бриф — і наш AI + професійний
дизайнер створять для вас ідеальний макет фотокниги. Ви отримаєте
готовий дизайн на перегляд з можливістю 2 безкоштовних правок.

+ 500 грн
```

## 🎉 Готово!

Тепер ви можете:
- ✅ Включити чекбокс "Послуга дизайнера"
- ✅ Ціна автоматично збільшиться на 500 грн
- ✅ При додаванні в кошик опція збережеться

---

## ❓ Якщо щось не працює:

1. **Не бачу фіолетовий блок** → Перевірте в Supabase що SQL виконався успішно
2. **Помилка в консолі** → Перезавантажте сторінку (Cmd+R / Ctrl+R)
3. **Таблиці не створились** → Напишіть мені, я допоможу

---

## 📍 Наступні кроки:

Після налаштування бази даних, Designer Service готовий до роботи!

**Повний workflow:**
1. Клієнт вибирає продукт + послугу дизайнера
2. Після оплати отримує email з посиланням на бриф
3. Завантажує фото і заповнює форму
4. AI аналізує фото та створює план
5. Дизайнер доопрацьовує та надсилає на перегляд
6. Клієнт переглядає з 3D page-flip viewer
7. Затверджує або просить правки
8. Друк та доставка!
