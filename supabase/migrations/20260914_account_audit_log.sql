-- account_audit_log: подія аудиту — це не згода, і вона живе окремо.
--
-- Звідки взялося. У consent_log писали чотири маршрути, і два з них писали
-- туди не згоди: «людина вивантажила свої дані» і «людина видалила акаунт».
-- Людина там нічого не дозволяла і нічого не забирала — вона скористалася
-- своїм правом. Обидві вставки до того ж відхилялися CHECK-ом таблиці, тож за
-- весь час не записалися жодного разу, і 14.09.2026 їх прибрали з consent_log
-- зовсім. Ця таблиця — їхнє нове і єдине місце.
--
-- ЩО ТУТ ЗБЕРІГАЄТЬСЯ, І ЧОМУ ТАК МАЛО.
--
-- Мінімум, який відповідає на питання «що сталося і коли»: тип події та час.
-- Ні пошти, ні імені, ні IP, ні User-Agent. Зберігати адресу людини у рядку
-- про те, що вона попросила свої дані стерти, — це робити рівно протилежне до
-- проханого, і саме так поводився старий запис у consent_log.
--
-- customer_id дозволений ТІЛЬКИ для вивантаження даних, і це не домовленість у
-- коментарі, а обмеження бази (див. CHECK нижче). Для вивантаження посилання
-- на акаунт корисне й безпечне: акаунт далі існує, а на питання «коли я
-- замовляв вивантаження» інакше не відповісти. Для видалення воно заборонене:
-- сам факт видалення вже записаний там, де йому належить — у рядку customers,
-- який маршрут знеособлює, підставляючи deleted+<id>@touchmemories.deleted.
-- Тобто «яке саме замовлення на видалення виконано» доводиться станом акаунта,
-- а не журналом, і журналу лишається тільки рахувати події.
--
-- Пише сюди виключно сервер сервісним ключем: /api/account/data-export і
-- /api/account/delete. Політик на вставку немає навмисно — ні для гостей, ні
-- для залогінених: подію аудиту не може створювати той, кого вона стосується.

create table if not exists public.account_audit_log (
    id          uuid primary key default gen_random_uuid(),
    event_type  text not null,
    customer_id uuid references public.customers(id) on delete set null,
    created_at  timestamptz not null default now()
);

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'account_audit_log_event_type_check') then
        alter table public.account_audit_log add constraint account_audit_log_event_type_check
            check (event_type = any (array['data_export', 'account_deletion']));
    end if;

    -- Структурна заборона, а не побажання: рядок про видалення акаунта не може
    -- нести посилання на акаунт. Якщо колись хтось допише такий insert, база
    -- відмовить, і це буде видно одразу.
    if not exists (select 1 from pg_constraint where conname = 'account_audit_log_no_subject_on_deletion') then
        alter table public.account_audit_log add constraint account_audit_log_no_subject_on_deletion
            check (event_type <> 'account_deletion' or customer_id is null);
    end if;
end $$;

create index if not exists account_audit_log_created_at_idx on public.account_audit_log using btree (created_at desc);
create index if not exists account_audit_log_event_type_idx on public.account_audit_log using btree (event_type);

alter table public.account_audit_log enable row level security;

-- Читають лише адміністратори. Клієнтові тут дивитися нема на що: його власне
-- вивантаження і так приходить йому файлом, а чужих рядків він бачити не має.
drop policy if exists "Admins can read account audit log" on public.account_audit_log;
create policy "Admins can read account audit log" on public.account_audit_log
    for select to authenticated using (is_admin_user());

comment on table public.account_audit_log is
    'Події аудиту акаунта: вивантаження даних і видалення. Не згоди — для них '
    'є consent_log. Мінімум даних: тип і час; customer_id дозволений лише для '
    'data_export і заборонений CHECK-ом для account_deletion.';
