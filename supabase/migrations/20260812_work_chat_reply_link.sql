-- Which message a chat message replies to. Without it, «Молдова» sent as a
-- reply to «13500 яка країна?» is indistinguishable from any other line in the
-- chat, and the memory answer had to guess by adjacency — which is how «Софія
-- мовчи!!!» ended up quoted as an answer about a country.
alter table work_chat_messages add column if not exists reply_to_message_id text;
create index if not exists work_chat_messages_reply_idx on work_chat_messages (chat_id, reply_to_message_id);
