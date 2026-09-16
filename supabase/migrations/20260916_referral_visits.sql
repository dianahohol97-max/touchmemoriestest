-- Переходи за партнерським посиланням (Діана, 16.09.2026).
--
-- Досі їх не рахував ніхто. Кабінет партнера показував лише нарахування, тож
-- на питання «скільки людей перейшло і скільки з них купило» відповіді не було
-- ні в партнера, ні в адмінці: конверсію не було з чого порахувати, а партнер
-- без жодного замовлення не міг відрізнити «посилання ніхто не відкрив» від
-- «відкривали, але не купували». Це різні проблеми з різними рішеннями.
--
-- ЩО ТУТ НЕ ЗБЕРІГАЄТЬСЯ. Ні IP, ні User-Agent, ні ідентифікатор відвідувача,
-- ні звʼязок із customers — нічого, за чим людину можна впізнати чи зіставити
-- два її переходи. Рядок каже «за цим кодом був перехід тоді-то на таку
-- сторінку», і більше нічого. Це свідоме обмеження: партнеру для роботи
-- достатньо кількості, а нам не потрібна ще одна таблиця з персональними
-- даними під видалення за запитом.
--
-- ЧОМУ БЕЗ ЗОВНІШНЬОГО КЛЮЧА на agency_partners. Ключ був би зручний для
-- каскадного видалення, але гоча 12 коштувала нам кількох годин лежачої
-- адмінки, і кожен новий ключ — це ще одне місце, де PostgREST колись
-- відмовить цілим запитом. Рахувати за кодом по індексу не повільніше, а код
-- партнера незмінний: його видає genAgencyCode один раз при створенні.
-- Код зберігається у верхньому регістрі (нормалізує і клієнт, і роут), тож
-- звірка йде звичайним `=`, без ilike.
--
-- ЧОМУ ОДРАЗУ З ФУНКЦІЄЮ ПІДРАХУНКУ. Таблиця наповнюється трафіком магазину,
-- тобто росте швидше за всі шість із гочі 14 разом узяті. Читати її вибіркою
-- і рахувати в JavaScript означало б упертися в тисячу рядків, яку PostgREST
-- віддає мовчки, і показати партнеру занижене число без жодної помилки.

create table if not exists public.referral_visits (
  id            uuid primary key default gen_random_uuid(),
  referral_code text not null,
  landing_path  text,
  created_at    timestamptz not null default now()
);

create index if not exists referral_visits_code_created_idx
  on public.referral_visits (referral_code, created_at desc);

-- RLS увімкнена БЕЗ політик: це заборона всім, крім службової ролі, і саме так
-- закриті agency_partners та agency_commissions. Переходи партнера — не
-- публічна інформація, і читати їх із браузера не має ніхто.
alter table public.referral_visits enable row level security;

create or replace function public.referral_visit_stats()
returns table (
  referral_code  text,
  visits         bigint,
  last_visit_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.referral_code, count(*), max(v.created_at)
    from referral_visits v
   group by v.referral_code;
$$;

revoke all on function public.referral_visit_stats() from public, anon, authenticated;
grant execute on function public.referral_visit_stats() to service_role;
