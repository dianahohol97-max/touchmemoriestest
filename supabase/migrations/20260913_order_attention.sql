-- Відповідальний за замовлення і фільтр «Потребує уваги».
--
-- Привід — фідбек менеджерки: за замовленням ніхто не закріплений, ніхто не
-- бачить, кому писали й коли, тож замовлення тихо зависає і його скасовують.
-- Аудит 13.09.2026 це підтвердив: поле orders.manager_id існує з випадайкою в
-- списку й у картці, але заповнене в НУЛЯ замовлень із 1092. Добровільна
-- випадайка вже була і не спрацювала, тому призначення стало побічним ефектом
-- відправки листа (див. lib/email/log-outgoing.ts).
--
-- Колонки «останній контакт» тут немає навмисно: вона рахується з email_logs і
-- дублювати дату в orders не треба.

-- 1. Єдина копія допуску на боці SQL.
--
-- Друге джерело правди про гроші — це те, на чому цей репозиторій уже
-- обпікався, тож допуск живе рівно в одній функції, а не розписаний по
-- запитах. TS-двійник: FULL_TOLERANCE_UAH у lib/orders/payment-state.ts.
-- Міняєте тут — міняйте там, і навпаки.
--
-- total > 0 перевіряється ПЕРШИМ, бо в базі є 13 рядків із нульовою сумою, і
-- на них «сплачено ≥ вартості» вірне тривіально: замовлення без ціни і без
-- грошей вважалося б оплаченим.
create or replace function public.is_paid_in_full(p_total numeric, p_paid numeric)
returns boolean
language sql
immutable
as $$
    select coalesce(p_total, 0) > 0
       and coalesce(p_paid, 0) >= coalesce(p_total, 0) - 1;
$$;

comment on function public.is_paid_in_full(numeric, numeric) is
    'Чи оплачене замовлення повністю, з допуском у 1 ₴. Єдина копія правила в SQL; TS-двійник — FULL_TOLERANCE_UAH у lib/orders/payment-state.ts.';

-- 2. Останній контакт із клієнтом.
--
-- security_invoker = true, щоб RLS на email_logs (політика is_admin_user())
-- не обходилася через вигляд. Права звужені за зразком customer_data_export,
-- який уже є в цій базі: читати має тільки service_role, бо «кому і коли ми
-- писали» не мусить бачити ані anon, ані звичайний authenticated.
--
-- Індекс під агрегат уже стоїть — email_logs (order_id, sent_at DESC) з
-- міграції 20260913_email_logs_sent_by. Заміряно: 11 мс на всьому журналі.
create or replace view public.order_last_contact
    with (security_invoker = true) as
select order_id,
       max(sent_at) as last_contact_at,
       count(*)     as letters_sent
from public.email_logs
where order_id is not null
group by order_id;

revoke all on public.order_last_contact from anon, authenticated;
grant select on public.order_last_contact to service_role;

-- 3. «Потребує уваги» — на сервері, а не в браузері.
--
-- Список в адмінці фільтрує вже отриману сторінку на 200 найновіших рядків, а
-- зависле замовлення — це рівно те, що з тієї сторінки давно випало. Фільтр,
-- зроблений так само, показував би порожньо саме тоді, коли він найпотрібніший.
--
-- Поріг годин і перелік виключених джерел ідуть ПАРАМЕТРАМИ. Години — щоб
-- константа жила в коді в однині (ATTENTION_AFTER_HOURS у lib/orders/
-- attention.ts). Джерела — щоб увімкнення дзеркалених із CRM не вимагало
-- міграції: сьогодні сайт цим клієнтам не пише взагалі (0 листів на 252
-- замовлення), тож вони б із фільтра ніколи не вийшли, а список, який
-- неможливо розчистити, перестають відкривати.
--
-- shipped і delivered теж поза фільтром: замовлення з боргом, яке вже поїхало
-- до клієнта, — задача для обліку, а не для менеджера, який має написати, поки
-- замовлення не скасували.
create or replace function public.orders_needing_attention(
    p_hours           int,
    p_exclude_sources text[] default array['keycrm'],
    p_limit           int     default 200
)
returns table (order_id uuid, last_contact_at timestamptz)
language sql
stable
set search_path to 'public'
as $$
    select o.id, lc.last_contact_at
    from public.orders o
    left join public.order_last_contact lc on lc.order_id = o.id
    where o.order_status not in ('cancelled', 'shipped', 'delivered')
      and coalesce(o.payment_status, '') <> 'cancelled'
      and not public.is_paid_in_full(o.total, o.paid_amount)
      and (p_exclude_sources is null
           or cardinality(p_exclude_sources) = 0
           or coalesce(o.source, '') <> all (p_exclude_sources))
      and (lc.last_contact_at is null
           or lc.last_contact_at < now() - make_interval(hours => p_hours))
    -- Найдавніший контакт зверху, «жодного листа» — найперше. Далі за віком
    -- замовлення, щоб порядок був стабільним.
    order by lc.last_contact_at asc nulls first, o.created_at asc
    limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

comment on function public.orders_needing_attention(int, text[], int) is
    'Замовлення, які зависли: не оплачені повністю, не скасовані, ще не відправлені, і без контакту довше за p_hours. p_exclude_sources за замовчуванням прибирає дзеркалені з KeyCRM.';

revoke all on function public.orders_needing_attention(int, text[], int) from anon, authenticated;
grant execute on function public.orders_needing_attention(int, text[], int) to service_role;
