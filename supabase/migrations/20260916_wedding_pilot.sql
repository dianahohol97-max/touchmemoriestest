-- Весільна сторінка для гостей — пайлот майбутньої лінійки (Діана, 16.09.2026).
--
-- Що це. Пара роздає гостям QR-код у день весілля, гість відкриває сторінку і
-- кладе туди свої фото. Знімки лишаються в нашій базі, а не розсипаються по
-- чужих телефонах і чатах, звідки їх потім ніхто не збирає. Перша пара —
-- Андрій та Оксана, 10 жовтня 2026 року.
--
-- ДОСТУП. Захист тут один і він свідомий: адреса сторінки непередбачувана.
-- Ані кодів, ані входу в кабінет гість не має, бо весілля триває один вечір і
-- будь-який зайвий крок означає, що фото просто не завантажать. Саме тому слаг
-- містить випадковий хвіст і лежить у базі, а не в коді: наступній парі його
-- видає SQL-рядок, а не деплой.
--
-- RLS УВІМКНЕНА БЕЗ ЖОДНОЇ ПОЛІТИКИ, тобто читати і писати може лише службова
-- роль. Це те саме рішення, що й у referral_visits, і причина та сама: браузер
-- гостя ходить тільки через наші роути, де ми встигаємо перевірити тип файлу,
-- розмір і частоту звернень. Дати анонімові прямий insert у таблицю означало б
-- віддати ці перевірки на слово клієнту.
--
-- ЗОВНІШНІЙ КЛЮЧ ТУТ РІВНО ОДИН, і це навмисно (гоча 12). Поки на
-- wedding_events дивиться один ключ, PostgREST не має між чим вибирати. Якщо
-- колись зʼявиться другий — наприклад, подія почне посилатися на замовлення
-- пари, — усі вбудовування доведеться називати повністю. Зараз роути читають
-- дві таблиці окремими запитами і не вбудовують нічого взагалі.

create table if not exists public.wedding_events (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  couple_names    text not null,
  event_date      date not null,
  -- Шлях у бакеті wedding-photos, не готова адреса. Адреса складається в коді,
  -- тож заміна фото пари — це перезалив файлу і один update, без деплою.
  hero_photo_path text,
  created_at      timestamptz not null default now()
);

create table if not exists public.wedding_photos (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.wedding_events (id) on delete cascade,
  -- Імʼя гостя необовʼязкове: підписатися можна, але змушувати не можна.
  guest_name   text,
  storage_path text not null unique,
  width        integer,
  height       integer,
  created_at   timestamptz not null default now()
);

-- Єдиний запит галереї: фото однієї події, найновіші зверху. Індекс покриває і
-- перше відкриття сторінки, і догортування, і опитування про свіжі знімки.
create index if not exists wedding_photos_event_created_idx
  on public.wedding_photos (event_id, created_at desc);

alter table public.wedding_events enable row level security;
alter table public.wedding_photos enable row level security;

-- Перша пара. Слаг зберігається тут і нікуди більше не дублюється.
--
-- Фото пари для шапки не лежить у wedding_photos і не має там рядка — воно
-- живе в hero_photo_path. Через це воно не може здублюватися в галереї: галерея
-- читає wedding_photos, де його просто немає.
insert into public.wedding_events (slug, couple_names, event_date)
values ('andriy-oksana-k7f3x9', 'Андрій & Оксана', '2026-10-10')
on conflict (slug) do nothing;

-- Бакет під весільні фото.
--
-- ОКРЕМИЙ ВІД order-files НАВМИСНО. Там файли самознищуються через 90 днів, бо
-- це матеріали до замовлення, які після друку не потрібні. Весільні фото живуть
-- стільки, скільки схоче пара, тож автовидалення над ними стояти не може.
--
-- ПРИВАТНИЙ. Публічний віддавав би файли напряму з CDN і був би на крок
-- швидшим, але тоді адреса кожного знімка працювала б вічно й сама по собі,
-- поза нашим кодом. Гість бачить фото через /api/wedding/photo/[id], а next/image
-- перед цим роутом робить зменшене прев'ю — тобто швидкість ми не втратили.
--
-- Політик на storage.objects для цього бакета немає жодної, і це не забудькуватість:
-- відсутність політики при увімкненій RLS означає доступ лише для службової ролі,
-- тобто рівно для наших роутів. Перелічити вміст бакета анонім не може теж.
--
-- Список типів дублює ALLOWED_MIME з lib/wedding/config.ts: перевірка стоїть і в
-- роуті, і тут, і обійти треба обидві.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-photos',
  'wedding-photos',
  false,
  20971520, -- 20 МБ, збігається з MAX_UPLOAD_BYTES
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
