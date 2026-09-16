-- Закриття заявки на партнерство: причина відмови й слід про те, хто закрив.
--
-- НАВІЩО. До 16.09.2026 заявку можна було ТІЛЬКИ підтвердити: у картці стояла
-- одна кнопка «Підтвердити та видати код», а список тягнув усе, де статус не
-- 'approved'. Відхилити заявку з адмінки було неможливо в принципі, тож усе,
-- що не стало партнером, висіло в «Нових» вічно — разом із повторною заявкою
-- від 11.09 на пошту, де партнер існував із 14.07.
--
-- Статуси після цієї міграції: new, contacted, approved, declined, duplicate.
-- 'duplicate' саме окремо від 'declined': заявку не відхилили по суті, вона
-- просто друга на ту саму пошту, і слід про те, що людина зверталася двічі,
-- має лишитися видимим.
--
-- Без зовнішніх ключів свідомо (гоча 12 у CLAUDE.md): другий ключ на ту саму
-- таблицю ламає вбудовування в PostgREST, а хто закрив заявку — це запис у
-- журнал, а не звʼязок, який комусь треба буде join-ити.
alter table partnership_requests
  add column if not exists decline_reason text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by text;

comment on column partnership_requests.decline_reason is 'Причина відмови або позначки «повторна», як її обрала адміністраторка';
comment on column partnership_requests.closed_at is 'Коли заявку закрили (declined або duplicate)';
comment on column partnership_requests.closed_by is 'Пошта того, хто закрив заявку';
