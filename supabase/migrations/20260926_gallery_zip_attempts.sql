-- Журнал спроб «Завантажити все» в клієнтській галереї (Діана, 2026-09-24).
--
-- До цього був один лічильник photographer_galleries.zip_downloads, і він
-- збільшувався тільки ПІСЛЯ успішного збору архіву. Архів збирався цілком у
-- пам'яті браузера, тож вкладка телефона на великій галереї просто гинула, і
-- нуль у лічильнику означав однаково «ніхто не натискав» і «натискали, але
-- впало». Тепер рядок з'являється на старті, а результат дописується в кінці.
-- Рядок без результату — це спроба, яка не дійшла до кінця і не встигла про
-- це сказати: найчастіше вкладку вбила нестача пам'яті (закриття вкладки
-- людиною пишеться як cancelled/page_closed, наскільки браузер дає це
-- зробити).
--
-- Чому таблиця, а не дві колонки started/completed. Колонки дали б два числа,
-- але не сказали б, НА ЧОМУ падає: якому пристрою, яким способом, на якій
-- частині, скільки файлів пішло запасним шляхом через Vercel (а це і є
-- жива відповідь на питання, чи дозволяє бакет R2 прямий GET). Розмір частин
-- підкручується саме за цими даними.
--
-- Персональних даних тут немає свідомо: ні IP, ні User-Agent, ні жодного
-- ідентифікатора людини — лише тип пристрою, спосіб і результат. Так само,
-- як із кліками партнерських посилань.
--
-- Зовнішній ключ один, із нової таблиці на photographer_galleries. Наявних
-- вбудовувань він не зачіпає: між галереями й фото ключів як було два, а
-- photographer_galleries → gallery_zip_attempts має рівно один звʼязок
-- (гоча 12). Таблицю наповнюють клієнти, а не адміністратор, тож вона в
-- WATCHED_TABLES скрипта unpaginated-queries (гоча 14); кабінет читає її
-- тільки агрегатом через gallery_zip_attempt_stats.

create table if not exists public.gallery_zip_attempts (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.photographer_galleries(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text check (outcome in ('completed', 'failed', 'cancelled')),
  device text not null check (device in ('ios', 'android', 'desktop', 'in-app')),
  method text not null check (method in ('stream', 'parts', 'single')),
  part_index int check (part_index >= 1),
  parts_total int check (parts_total >= 1),
  files_total int not null check (files_total >= 0),
  bytes_total bigint not null check (bytes_total >= 0),
  files_via_proxy int not null default 0 check (files_via_proxy >= 0),
  -- Коротка технічна причина відмови (ім'я помилки, статус), без тексту від
  -- людини. Обрізається до 200 символів у маршруті.
  error text,
  constraint gallery_zip_attempts_outcome_with_finish
    check ((finished_at is null) = (outcome is null))
);

create index if not exists gallery_zip_attempts_gallery_started_idx
  on public.gallery_zip_attempts (gallery_id, started_at desc);

-- Пишуть і читають тільки маршрути з service role. Політик немає — анонімний і
-- автентифікований клієнт не бачать нічого.
alter table public.gallery_zip_attempts enable row level security;

comment on table public.gallery_zip_attempts is
  'Спроби «Завантажити все» в клієнтській галереї. finished_at is null — спроба не дійшла до кінця (найчастіше вкладка впала). Без персональних даних.';

-- Агрегат для кабінету фотографа: один рядок на галерею, тож стеля PostgREST
-- у тисячу рядків тут не страшна, скільки б спроб не набралося.
create or replace function public.gallery_zip_attempt_stats(gallery_ids uuid[])
returns table (
  gallery_id uuid,
  started bigint,
  completed bigint,
  failed bigint,
  cancelled bigint,
  unfinished bigint
)
language sql stable security definer set search_path = public as $$
  select a.gallery_id,
         count(*) as started,
         count(*) filter (where a.outcome = 'completed') as completed,
         count(*) filter (where a.outcome = 'failed') as failed,
         count(*) filter (where a.outcome = 'cancelled') as cancelled,
         count(*) filter (where a.finished_at is null) as unfinished
  from public.gallery_zip_attempts a
  where a.gallery_id = any(gallery_ids)
  group by a.gallery_id
$$;

revoke all on function public.gallery_zip_attempt_stats(uuid[]) from public, anon, authenticated;
