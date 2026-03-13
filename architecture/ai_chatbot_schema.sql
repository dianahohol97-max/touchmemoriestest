-- Migration for AI Social Media Chatbot (Module 13)

-- Create settings table if it doesn't exist (using a generic kv store approach)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed initial chatbot settings
INSERT INTO public.settings (key, value) VALUES (
    'chatbot_system_prompt', 
    '"Ти — Софія, менеджер TouchMemories.\nТи доброзичлива, тепла, трохи неформальна але професійна.\nПишеш коротко — 1-3 речення. Без зайвих слів і шаблонних фраз.\nНіколи не пишеш \"Звісно!\", \"Чудово!\", \"Звичайно!\" — це звучить штучно.\nВикористовуєш емодзі — але обережно, 1-2 на повідомлення максимум.\nНіколи не згадуєш що ти AI, бот або програма.\nЯкщо не знаєш точної відповіді — кажеш щось на зразок:\n\"Зараз уточню для вас 🙏\" або \"Дайте мені секунду\"\nВідповідаєш тією ж мовою якою написав клієнт.\nКоли клієнт питає про конкретне замовлення:\nПопроси номер замовлення або email.\nПісля отримання — пошукаєш в БД та відповіси точно.\nВАЖЛИВО: якщо клієнт незадоволений, злий або вимагає компенсацію — скажи \"Зрозуміла вас, зараз підключу нашого старшого менеджера\" і повідоми менеджера."'::jsonb
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES (
    'chatbot_auto_escalate_count', '10'::jsonb
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES (
    'chatbot_enabled_platforms', '{"telegram": true, "instagram": false, "facebook": false}'::jsonb
) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES (
    'chatbot_working_hours', '{"start": "09:00", "end": "21:00"}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Create social_conversations table
CREATE TABLE IF NOT EXISTS public.social_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform IN ('telegram', 'instagram', 'facebook', 'viber')),
    external_user_id TEXT NOT NULL,
    external_username TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ai_handling' CHECK (status IN ('ai_handling', 'needs_human', 'human_handling', 'resolved')),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ai_message_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(platform, external_user_id) -- A user has one active conversation per platform at a time (conceptually)
);

-- Create social_messages table
CREATE TABLE IF NOT EXISTS public.social_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.social_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('customer', 'ai', 'human_manager')),
    original_text TEXT NOT NULL,
    translated_text TEXT,
    detected_language TEXT,
    platform_message_id TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update last_message_at trigger
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.social_conversations
    SET last_message_at = NEW.sent_at,
        is_read = CASE WHEN NEW.sender = 'customer' THEN FALSE ELSE TRUE END
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_last_message ON public.social_messages;
CREATE TRIGGER trg_update_conversation_last_message
AFTER INSERT ON public.social_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_messages ENABLE ROW LEVEL SECURITY;

-- Allow public read of settings
CREATE POLICY "Allow public read of settings" 
ON public.settings FOR SELECT USING (true);

-- Allow full access to admins for settings
CREATE POLICY "Allow full access for authenticated users to settings" 
ON public.settings FOR ALL USING (auth.role() = 'authenticated');

-- Allow DB access for conversations and messages
CREATE POLICY "Allow full access to social_conversations for authenticated" 
ON public.social_conversations FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access to social_messages for authenticated" 
ON public.social_messages FOR ALL USING (auth.role() = 'authenticated');
