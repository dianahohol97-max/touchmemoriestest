const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_string: `
      CREATE TABLE IF NOT EXISTS public.reply_templates (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name TEXT NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          category TEXT NOT NULL CHECK (category IN ('shipping', 'delay', 'quality', 'general')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      ALTER TABLE public.reply_templates ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Enable read access for authenticated admins" ON public.reply_templates;
      CREATE POLICY "Enable read access for authenticated admins" ON public.reply_templates
          FOR SELECT
          USING (auth.role() = 'authenticated');

      DROP POLICY IF EXISTS "Enable all access for admins" ON public.reply_templates;
      CREATE POLICY "Enable all access for admins" ON public.reply_templates
          FOR ALL
          USING (auth.role() = 'authenticated');

      -- Insert initial templates only if table is empty
      INSERT INTO public.reply_templates (name, subject, body, category)
      SELECT 'Замовлення відправлено', 'Ваше замовлення №{{order_number}} відправлено! 📦', 'Вітаємо, {{customer_name}}!\n\nВаше замовлення успішно відправлено.\nТТН: {{ttn}}\nТовар: {{product_name}}\n\nДякуємо, що обрали нас!', 'shipping'
      WHERE NOT EXISTS (SELECT 1 FROM public.reply_templates WHERE name = 'Замовлення відправлено');

      INSERT INTO public.reply_templates (name, subject, body, category)
      SELECT 'Затримка виробництва', 'Важлива інформація щодо замовлення №{{order_number}}', 'Вітаємо, {{customer_name}}.\n\nВибачте за незручності. Ваше замовлення затримується на 1-2 дні через виробничі обставини.\nМи робимо все можливе, щоб відправити його якнайшвидше.\n\nДякуємо за розуміння!', 'delay'
      WHERE NOT EXISTS (SELECT 1 FROM public.reply_templates WHERE name = 'Затримка виробництва');

      INSERT INTO public.reply_templates (name, subject, body, category)
      SELECT 'Підтвердьте адресу', 'Потрібне підтвердження адреси — замовлення №{{order_number}}', 'Вітаємо, {{customer_name}}!\n\nДля відправки вашого замовлення нам потрібно уточнити деталі доставки.\nБудь ласка, перевірте та підтвердьте правильність адреси, відповівши на цей лист.\n\nДякуємо!', 'general'
      WHERE NOT EXISTS (SELECT 1 FROM public.reply_templates WHERE name = 'Підтвердьте адресу');

      INSERT INTO public.reply_templates (name, subject, body, category)
      SELECT 'Дякуємо за відгук', 'Дякуємо! Ось ваш подарунок 🎁', 'Вітаємо, {{customer_name}}!\n\nЩиро дякуємо за ваш відгук про {{product_name}}! Нам дуже приємно.\nЯк подяку, даруємо вам промокод на знижку 10% на наступне замовлення: THANKYOU10.\n\nЧекаємо на вас знову!', 'general'
      WHERE NOT EXISTS (SELECT 1 FROM public.reply_templates WHERE name = 'Дякуємо за відгук');
    `
    });

    if (error) {
        console.error('Migration failed:', error);
    } else {
        console.log('Migration successful:', data);
    }
}

applyMigration();
