-- Черга розсилки: унікальність по колонці, а не по виразу.
--
-- Проблема: /api/admin/send-newsletter ставить сегмент у чергу через
-- upsert(..., { onConflict: 'campaign_id,email' }), а єдиний унікальний індекс
-- був побудований по виразу (campaign_id, lower(email)). Postgres такий
-- ON CONFLICT не приймає взагалі — запит падає з 42P10, і кнопка «Надіслати»
-- в адмінці повертає «Не вдалося поставити в чергу». Помітили це аж у вересні
-- 2026, бо серпнева кампанія по базі KeyCRM заводилася руками в SQL, і шлях
-- через адмінку жодного разу не виконувався.
--
-- Рішення: не додавати другий унікальний індекс поруч, а перенести гарантію
-- з виразу в саму колонку. Тригер зводить адресу до нижнього регістру й
-- обрізає пробіли перед кожним записом, тож звичайний унікальний індекс по
-- (campaign_id, email) дає рівно ту саму нечутливість до регістру, що давав
-- вираз, і при цьому годиться для ON CONFLICT.
--
-- Нормалізація навмисно живе в базі, а не тільки в коді роуту. Роут справді
-- викликає toLowerCase(), але ця обіцянка трималася на уважності того, хто
-- пише наступний шлях запису — а індекс мовчки перестав би ловити дублікати
-- тієї миті, коли хтось про неї забуде.

create or replace function public.email_campaign_queue_normalize_email()
returns trigger
language plpgsql
as $$
begin
    new.email := lower(btrim(new.email));
    return new;
end;
$$;

drop trigger if exists email_campaign_queue_normalize_email on public.email_campaign_queue;
create trigger email_campaign_queue_normalize_email
    before insert or update of email on public.email_campaign_queue
    for each row execute function public.email_campaign_queue_normalize_email();

-- Наявні рядки вже в нижньому регістрі (перевірено перед міграцією: 0 рядків
-- відрізняються від lower(btrim(email))), тож перебудова індексу нічого не
-- зламає й колізій не дасть.
update public.email_campaign_queue
   set email = email
 where email is distinct from lower(btrim(email));

drop index if exists public.email_campaign_queue_unique;
create unique index email_campaign_queue_unique
    on public.email_campaign_queue (campaign_id, email);
