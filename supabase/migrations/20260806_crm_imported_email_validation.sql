-- Email validation for the imported CRM base.
-- Applied to production via Supabase MCP on 2026-08-06; committed here for tracking.
--
-- Every distinct domain in the table (71 of them) was checked for a real mail
-- destination — an MX record, or an A record which RFC 5321 still accepts.
-- Six domains have neither, and a further group are one-character typos of the
-- big providers that DO resolve, which is worse than a bounce: the letter is
-- delivered to whoever squats the typo domain rather than to the customer.
--
-- Hard bounces above ~5% get a sender treated as careless, which degrades
-- delivery for every message from the domain, order confirmations included.
--
-- Result on the 5364 imported rows: 5324 ok, 24 invalid, 16 suspect.

alter table public.crm_imported_customers
  add column if not exists email_status text not null default 'ok',
  add column if not exists email_status_reason text,
  add column if not exists email_suggestion text;

-- 1. Domains with no mail server at all — these bounce, always.
update public.crm_imported_customers
   set email_status = 'invalid',
       email_status_reason = 'домен не має поштового сервера'
 where lower(split_part(email, '@', 2)) in
       ('com.ua', 'gmail.comj', 'gmail.con', 'gmaill.com', 'gmal.com', 'icloud.con');

-- 2. Local part that cannot belong to a person, or Cyrillic letters typed into
--    a Latin-only address.
update public.crm_imported_customers
   set email_status = 'invalid',
       email_status_reason = 'адреса не схожа на справжню'
 where email ~ '[а-яґєіїА-ЯҐЄІЇ]'
    or length(split_part(email, '@', 1)) <= 2
    or lower(split_part(email, '@', 2)) = 'aaaaa.com.ua';

-- 3. Typos of the major providers that resolve to a squatter. Flagged rather
--    than rewritten: correcting an address on the customer's behalf is a guess,
--    and a wrong guess mails a stranger.
update public.crm_imported_customers
   set email_status = 'suspect',
       email_status_reason = 'схоже на помилку в домені',
       email_suggestion = split_part(email, '@', 1) || '@' ||
         case when lower(split_part(email, '@', 2)) = 'icloud.con' then 'icloud.com' else 'gmail.com' end
 where lower(split_part(email, '@', 2)) in
       ('gamil.com', 'gmai.com', 'gmail.cm', 'gmail.co', 'gmil.com', 'gnail.com', 'hmail.com')
   and email_status = 'ok';

-- 4. Russian mail providers: unreachable or heavily filtered from a Ukrainian
--    sender, and not an audience this shop mails.
update public.crm_imported_customers
   set email_status = 'suspect',
       email_status_reason = 'російський поштовий домен'
 where lower(split_part(email, '@', 2)) in ('mail.ru', 'yandex.ru', 'yandex.ua', 'bk.ru', 'inbox.ru', 'list.ru', 'rambler.ru', 'ya.ru')
   and email_status = 'ok';

create index if not exists crm_imported_customers_email_status_idx
  on public.crm_imported_customers (email_status);

-- Win-back must skip everything that is not clean. Without this the automation
-- would spend the daily send quota on addresses that cannot receive mail.
create or replace function public.get_winback_candidates(
  p_days_min int, p_days_max int, p_cooldown_days int, p_limit int
)
returns table(email text, customer_name text, last_order_at timestamptz, days_since int)
language sql stable security definer as $$
  with site_orders as (
    select lower(o.customer_email) as email,
           max(coalesce(o.customer_name, o.customer_first_name)) as customer_name,
           max(o.created_at) as last_order_at
    from public.orders o
    where o.payment_status = 'paid'
      and o.customer_email is not null and o.customer_email <> ''
    group by lower(o.customer_email)
  ),
  imported as (
    select lower(c.email) as email,
           max(c.name) as customer_name,
           max(c.last_order_at) as last_order_at
    from public.crm_imported_customers c
    where c.email is not null and c.email <> ''
      and coalesce(c.email_status, 'ok') = 'ok'
    group by lower(c.email)
  ),
  merged as (
    select coalesce(s.email, i.email) as email,
           coalesce(s.customer_name, i.customer_name) as customer_name,
           greatest(s.last_order_at, i.last_order_at) as last_order_at
    from site_orders s
    full outer join imported i on s.email = i.email
  )
  select m.email, m.customer_name, m.last_order_at,
         extract(day from (now() - m.last_order_at))::int as days_since
  from merged m
  where m.last_order_at is not null
    and m.last_order_at <= now() - make_interval(days => p_days_min)
    and m.last_order_at >= now() - make_interval(days => p_days_max)
    and not exists (select 1 from public.subscribers s2 where lower(s2.email) = m.email and s2.is_active = false)
    and not exists (
      select 1 from public.email_automation_log l
      where l.automation_type = 'winback' and lower(l.email) = m.email
        and l.sent_at >= now() - make_interval(days => p_cooldown_days)
    )
  order by m.last_order_at asc
  limit p_limit;
$$;
