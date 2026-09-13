-- email_logs: що сталося з листом ПІСЛЯ того, як ми віддали його Brevo.
--
-- Досі журнал знав рівно одне: чи вдалося передати листа провайдеру. Чи він
-- дійшов до людини, чи відскочив, чи впав у спам — не знав ніхто, і менеджер
-- не мав жодного сигналу про те, що клієнт листа не бачив.
--
-- delivery_status НАВМИСНО окремий від status, а не нові значення в ньому. Це
-- два різні питання про різні моменти: status відповідає «чи ми віддали»
-- (sent | failed), delivery_status — «що з ним сталося далі». Злиті в одну
-- колонку, вони змусили б успішно переданий лист, якого Brevo не зміг
-- доставити, стати failed — і різниця між нашою поразкою і чужою зникла б саме
-- там, де вона потрібна.
--
-- failure_kind окремо з тієї ж причини: вичерпана квота це не інший результат,
-- а інша причина того самого. Значення: quota (наш денний ліміт або ліміт
-- тарифу Brevo — текст у error каже, чий саме), provider (відмова Brevo з
-- іншої причини), config (немає ключа чи налаштування), precheck (відмова ще
-- до звернення до провайдера — немає email, поганий файл).
--
-- Індекс частковий, бо вебхук шукає рядок ТІЛЬКИ за provider_message_id, і
-- значень там сьогодні нуль на 256 рядків: писати їх почали з деплою
-- 13.09.2026, тож історію дозаповнити нічим.

alter table public.email_logs
    add column if not exists delivery_status     text,
    add column if not exists delivery_detail     text,
    add column if not exists delivered_at        timestamptz,
    add column if not exists delivery_updated_at timestamptz,
    add column if not exists failure_kind        text;

comment on column public.email_logs.delivery_status is
    'Звіт Brevo після передачі: delivered, hard_bounce, soft_bounce, spam, blocked, deferred, invalid_email. NULL означає, що події ще не було.';
comment on column public.email_logs.delivery_detail is
    'Поле reason з події — текст причини від поштовика одержувача.';
comment on column public.email_logs.delivery_updated_at is
    'Час ПОДІЇ (ts із самої події), а не час її отримання. Подія, що прийшла пізніше, але сталася раніше, не має права затерти свіжішу.';
comment on column public.email_logs.failure_kind is
    'Чому не вдалося передати: quota | provider | config | precheck. Порожнє, коли лист передано.';

create index if not exists email_logs_provider_message_id_idx
    on public.email_logs (provider_message_id)
    where provider_message_id is not null;
