-- Транзакційний резерв стає пропорційним до решти доби.
--
-- email_quota_config.transactional_reserve — це 120 листів НА ЦІЛУ ДОБУ, які
-- тримаємо для підтверджень замовлень, щоб розсилка їх не з'їла. Але віднімався
-- він однаково і о девʼятій ранку, і о восьмій вечора. Увечері 25.08 це дало
-- такий стан: витрачено 61 транзакційний і 62 маркетингових зі стелі 300, тобто
-- реально вільно 177 листів, а розсилці дозволялося лише 57 — бо повні 120
-- «на добу» блокувалися тоді, коли від доби лишалося три з половиною години.
--
-- Тепер резерв масштабується часткою доби, яка ще попереду (за київським
-- часом), але ніколи не падає нижче сорока. О девʼятій ранку це майже повні
-- 120, о четвертій дня — сорок, увечері — теж сорок. Стеля 300 і сам поділ на
-- транзакційні й маркетингові не змінюються: захист лишається, просто він
-- більше не охороняє години, яких уже немає.
create or replace function public.email_quota_reserve(p_count integer, p_kind text)
returns integer
language plpgsql
security definer
as $function$
declare
  cfg public.email_quota_config;
  cur public.email_quota_usage;
  kyiv timestamp;
  day_left numeric;
  reserve_now int;
  used_total int;
  allowed int;
  granted int;
begin
  if p_count is null or p_count <= 0 then return 0; end if;

  select * into cfg from public.email_quota_config where id;
  -- No configuration row means the budget is not in use; never block on it.
  if not found then return p_count; end if;

  insert into public.email_quota_usage (day) values (current_date)
    on conflict (day) do nothing;
  select * into cur from public.email_quota_usage where day = current_date for update;

  used_total := cur.transactional_used + cur.marketing_used;

  if p_kind = 'marketing' then
    kyiv := (now() at time zone 'Europe/Kyiv');
    day_left := greatest(0, extract(epoch from (date_trunc('day', kyiv) + interval '1 day' - kyiv)) / 86400.0);
    -- Ніколи не менше сорока: скільки б не лишалося від доби, підтвердження
    -- замовлень мають куди піти.
    reserve_now := greatest(40, ceil(cfg.transactional_reserve * day_left)::int);
    allowed := greatest(0, cfg.daily_cap - reserve_now - used_total);
  else
    allowed := greatest(0, cfg.daily_cap - used_total);
  end if;

  granted := least(p_count, allowed);

  if granted > 0 then
    if p_kind = 'marketing' then
      update public.email_quota_usage
         set marketing_used = marketing_used + granted, updated_at = now()
       where day = current_date;
    else
      update public.email_quota_usage
         set transactional_used = transactional_used + granted, updated_at = now()
       where day = current_date;
    end if;
  end if;

  return granted;
end $function$;

-- Статус має показувати те саме число, інакше адмінка й cron сперечалися б.
create or replace function public.email_quota_status()
returns table(daily_cap integer, transactional_reserve integer, transactional_used integer,
              marketing_used integer, marketing_left integer, total_left integer)
language sql
stable
security definer
as $function$
  with k as (select (now() at time zone 'Europe/Kyiv') as kyiv)
  select
    c.daily_cap,
    greatest(40, ceil(c.transactional_reserve
      * greatest(0, extract(epoch from (date_trunc('day', k.kyiv) + interval '1 day' - k.kyiv)) / 86400.0))::int),
    coalesce(u.transactional_used, 0),
    coalesce(u.marketing_used, 0),
    greatest(0, c.daily_cap
      - greatest(40, ceil(c.transactional_reserve
          * greatest(0, extract(epoch from (date_trunc('day', k.kyiv) + interval '1 day' - k.kyiv)) / 86400.0))::int)
      - coalesce(u.transactional_used, 0) - coalesce(u.marketing_used, 0)),
    greatest(0, c.daily_cap - coalesce(u.transactional_used, 0) - coalesce(u.marketing_used, 0))
  from public.email_quota_config c
  cross join k
  left join public.email_quota_usage u on u.day = current_date
  where c.id;
$function$;
