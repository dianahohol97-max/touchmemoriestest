-- Довічна привʼязка клієнта до партнера (Діана, 16.09.2026).
--
-- Модель партнерської програми змінилася: вхід лише через посилання, а клієнт,
-- який хоч раз оплатив замовлення за партнерським посиланням, лишається за цим
-- партнером назавжди. Кожне його наступне оплачене замовлення нараховує
-- партнеру комісію — без переходу за посиланням, без localStorage, з будь-якого
-- пристрою. Знижка при цьому діє ЛИШЕ на перше, привʼязувальне замовлення.
--
-- ЧОМУ ОКРЕМА ТАБЛИЦЯ, А НЕ ПОЛЕ В customers. Ключ привʼязки — нормалізована
-- пошта, і реєстрація від клієнта не вимагається. Цифри з живої бази на момент
-- міграції: з 807 оплачених замовлень лише 81 має customer_id, а 256 гостьових
-- узагалі не мають рядка в customers із такою поштою. Поле на customers
-- працювало б для меншості й мовчки не працювало б для решти — тобто саме для
-- того випадку, заради якого привʼязку й роблять.
--
-- ПОШТА — ПЕРВИННИЙ КЛЮЧ, і це і є правило «привʼязка створюється один раз».
-- Її не можна перезаписати пізнішим переходом за чужим посиланням: повторна
-- вставка просто нічого не робить (ON CONFLICT DO NOTHING у коді). Правило
-- живе в обмеженні бази, а не в перевірці перед вставкою, бо перевірка перед
-- вставкою програє гонці двох одночасних оплат.
--
-- ЗОВНІШНІЙ КЛЮЧ ТУТ Є, на відміну від referral_visits, і причина конкретна:
-- без ON DELETE CASCADE видалений партнер лишив би по собі привʼязки, які
-- вічно намагалися б нарахувати комісію тому, кого немає. Гоча 12 стосується
-- ДВОХ ключів на ту саму таблицю з одного рядка — тут ключ один, і жоден запит
-- у репозиторії не вбудовує agency_partners, тож неоднозначності не виникає.

create table if not exists public.partner_client_bindings (
  email          text primary key,
  partner_id     uuid not null references agency_partners(id) on delete cascade,
  first_order_id uuid,
  bound_at       timestamptz not null default now()
);

create index if not exists partner_client_bindings_partner_idx
  on public.partner_client_bindings (partner_id);

alter table public.partner_client_bindings enable row level security;

-- Атрибуція замовлення окремо від промокоду.
--
-- Досі і знижку, і комісію ніс один рядок orders.promo_code, і нова модель це
-- розводить: клієнт може ввести звичайний промокод поверх партнерського
-- посилання — тоді знижку дає промокод, а комісія все одно належить партнеру.
-- Одне поле двох відповідей не дає, тому атрибуція переїжджає сюди.
-- Без зовнішнього ключа свідомо: orders — найбільш вбудовувана таблиця в
-- проєкті, і кожен новий ключ на ній це ще одна нагода для гочі 12.
alter table public.orders add column if not exists referral_partner_id uuid;
create index if not exists orders_referral_partner_idx
  on public.orders (referral_partner_id) where referral_partner_id is not null;

-- Нарахування за новим клієнтом і за повторним замовленням — різні рядки в
-- кабінеті партнера, бо це різна робота: перше він привів, друге приходить
-- саме. Старі рядки лишаються 'new_client': усі вони з часів, коли повторних
-- нарахувань не існувало взагалі.
alter table public.agency_commissions
  add column if not exists kind text not null default 'new_client';

-- Форма функції змінюється (додаються new_clients і repeat_orders), а Postgres
-- не дає переписати набір OUT-параметрів через CREATE OR REPLACE. DROP і
-- CREATE в одній міграції безпечні: DDL транзакційний, тож паралельний
-- читач побачить або стару функцію, або нову, і ніколи — порожнечу між ними.
-- Наявні поля зберігають імена, тому вже розгорнутий код працює далі.
drop function if exists public.agency_commission_stats();

create function public.agency_commission_stats()
returns table (
  agency_id      uuid,
  orders_count   bigint,
  revenue        numeric,
  pending_sum    numeric,
  new_clients    bigint,
  repeat_orders  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.agency_id,
         count(*) filter (where c.payout_status <> 'cancelled'),
         coalesce(sum(c.travelbook_subtotal + c.other_subtotal)
                  filter (where c.payout_status <> 'cancelled'), 0),
         coalesce(sum(c.total_commission)
                  filter (where c.payout_status = 'pending'), 0),
         count(*) filter (where c.payout_status <> 'cancelled' and c.kind = 'new_client'),
         count(*) filter (where c.payout_status <> 'cancelled' and c.kind = 'repeat')
    from agency_commissions c
   group by c.agency_id;
$$;

revoke all on function public.agency_commission_stats() from public, anon, authenticated;
grant execute on function public.agency_commission_stats() to service_role;
