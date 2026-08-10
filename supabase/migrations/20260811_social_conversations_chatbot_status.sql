-- Chatbot core (lib/chatbot/core.ts) reads and updates conversation.status and
-- conversation.ai_message_count, but the original social_conversations table was
-- created without them, so every bot reply failed on UPDATE. Adding with safe
-- defaults: existing rows become 'ai_handling' with a zero counter.
alter table public.social_conversations
  add column if not exists status text not null default 'ai_handling',
  add column if not exists ai_message_count integer not null default 0;
