-- consent_log: міграція-зліпок таблиці, якої в репозиторії не було ніколи.
--
-- Проблема. Таблицю створили руками в дашборді Supabase, і в supabase/migrations
-- вона не описана жодним файлом. Тобто база, піднята з самих міграцій, не має
-- consent_log узагалі, а всі чотири маршрути, які в неї пишуть, зламалися б на
-- порожньому місці. Це той самий клас розбіжності, що описаний в
-- ARCHITECTURE.md під «Schema drift between repo and prod Supabase».
--
-- Наслідок, який ми вже бачили. CHECK-обмеження цієї таблиці не бачив ніхто з
-- авторів коду — їх немає в жодному файлі, який можна прочитати. Тому код писав
-- назви ДІЙ ('cookies_accepted') і власні джерела ('cookie_banner') у колонки,
-- де база чекає назви КАТЕГОРІЙ і чотири фіксовані джерела. Кожна вставка
-- відхилялася, помилку ніхто не перевіряв, і на 14.09.2026 таблиця мала рівно
-- нуль рядків при 366 підписниках.
--
-- Що робить цей файл. Описує СТАН ЯК Є, нічого не змінюючи в проді: на живій
-- базі кожна команда нижче — no-op завдяки IF NOT EXISTS і DROP ... IF EXISTS
-- перед CREATE POLICY. Мета одна: щоб таблиця існувала там, де базу піднімають
-- із міграцій, і щоб її правила нарешті можна було прочитати в репозиторії.
--
-- Перевірено на проді 14.09.2026 — структура, обмеження, індекси й політики
-- нижче зняті з живої бази, а не написані з голови.

create table if not exists public.consent_log (
    id             uuid primary key default gen_random_uuid(),
    customer_id    uuid references public.customers(id) on delete set null,
    email          text,
    consent_type   text not null,
    granted        boolean not null,
    policy_version text default '1.0',
    ip_address     text,
    user_agent     text,
    source         text default 'web',
    created_at     timestamptz not null default now()
);

-- Словник значень. Саме він і є причиною, чому журнал мовчав: consent_type
-- приймає КАТЕГОРІЮ згоди, а не назву дії користувача. Переклад із мови
-- інтерфейсу в цю мову живе в lib/consent/log-entries.ts і покритий тестом
-- tests/consent-log.test.ts — списки в коді й тут мусять збігатися.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'consent_log_consent_type_check') then
        alter table public.consent_log add constraint consent_log_consent_type_check
            check (consent_type = any (array['essential', 'analytics', 'marketing', 'functional', 'terms', 'privacy']));
    end if;

    if not exists (select 1 from pg_constraint where conname = 'consent_log_source_check') then
        alter table public.consent_log add constraint consent_log_source_check
            check (source = any (array['web', 'mobile', 'api', 'admin']));
    end if;
end $$;

create index if not exists consent_log_customer_id_idx on public.consent_log using btree (customer_id);
create index if not exists consent_log_email_idx       on public.consent_log using btree (email);
create index if not exists consent_log_created_at_idx  on public.consent_log using btree (created_at desc);

alter table public.consent_log enable row level security;

-- Політики. Маршрути пишуть сервісним клієнтом і RLS обходять, тож ці правила
-- стосуються лише прямих звернень із браузера.
drop policy if exists "Admins can read consent log" on public.consent_log;
create policy "Admins can read consent log" on public.consent_log
    for select to authenticated using (is_admin_user());

drop policy if exists customers_read_own_consent_log on public.consent_log;
create policy customers_read_own_consent_log on public.consent_log
    for select to authenticated
    using (customer_id in (select customers.id from public.customers where customers.auth_user_id = auth.uid()));

drop policy if exists authenticated_insert_own_consent on public.consent_log;
create policy authenticated_insert_own_consent on public.consent_log
    for insert to authenticated
    with check (
        customer_id is null
        or customer_id in (select customers.id from public.customers where customers.auth_user_id = auth.uid())
    );

-- УВАГА, суперечність збережена свідомо, а не перенесена помилково.
--
-- Ця політика дозволяє гостю вставляти рядки лише з consent_type у списку
-- 'cookies_accepted' / 'cookies_partial' / 'cookies_rejected'. А CHECK самої
-- таблиці такі значення забороняє: там дозволені тільки категорії. Виходить,
-- що ЖОДНА вставка від анонімного відвідувача не може задовольнити обидва
-- правила одночасно — політика і обмеження виключають одне одного.
--
-- Сьогодні це ні на що не впливає: у consent_log пише тільки сервер сервісним
-- ключем, а він RLS не питає. Але залишати таку пастку без пояснення не можна,
-- і виправляти її мовчки, під виглядом зліпка, теж: рішення за Діаною.
drop policy if exists anon_insert_cookie_consent on public.consent_log;
create policy anon_insert_cookie_consent on public.consent_log
    for insert to anon
    with check (
        customer_id is null
        and consent_type = any (array['cookies_accepted', 'cookies_partial', 'cookies_rejected'])
    );

comment on table public.consent_log is
    'Журнал згод: один рядок на КАТЕГОРІЮ згоди, не на клік. Пише тільки '
    'сервер через /api/consent/log і /api/account/consent-marketing. Події '
    'аудиту (вивантаження даних, видалення акаунта) сюди не пишуться — це не '
    'згоди. Таблицю створено в дашборді Supabase; цей файл лише фіксує її стан.';
