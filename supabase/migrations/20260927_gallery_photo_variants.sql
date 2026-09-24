-- Екранні копії фото клієнтських галерей (Діана, 2026-09-24).
--
-- До цього сітка галереї показувала оригінали: галерея Ірини Владової — 280
-- фото на 3,66 ГБ, і людина, яка догортала її до кінця, тягнула всі 3,66 ГБ.
-- Тепер поруч з оригіналом лежать копії на 640, 1280 і 2048 px по довшій
-- стороні (lib/photographers/gallery-variant-paths.ts). Шляхи копій в базі
-- НЕ зберігаються: вони однозначно рахуються з storage_path, а які саме копії
-- існують, випливає з розмірів оригіналу. Тому колонок небагато:
--
--   width, height      — сторони оригіналу після EXIF-повороту. Потрібні для
--                        width/height у <img>, щоб сітка не стрибала, і для
--                        ширин у srcset.
--   variants_at        — коли копії лягли в сховище. NULL — копій немає, і
--                        екран показує оригінал, як раніше.
--   variant_bytes      — скільки важать копії разом. У квоту фотографа НЕ
--                        йде: квота — це size_bytes його оригіналів.
--   variant_tries,
--   variant_tried_at   — скільки разів пробували і коли востаннє. Ставиться
--                        ДО запису копій у сховище, тож рядок без цієї позначки
--                        копій не має, і видалення знає, коли їх шукати.
--   variant_error      — остання причина відмови, для діагностики.
--
-- Зовнішніх ключів немає, наявних вбудовувань це не зачіпає (гоча 12).

alter table public.photographer_gallery_photos
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists variants_at timestamptz,
  add column if not exists variant_bytes bigint,
  add column if not exists variant_tries smallint not null default 0,
  add column if not exists variant_tried_at timestamptz,
  add column if not exists variant_error text;

-- Черга копій: фото без копій у порядку завантаження.
create index if not exists photographer_gallery_photos_variants_queue_idx
  on public.photographer_gallery_photos (gallery_id, created_at, id)
  where variants_at is null and media_type = 'photo';

-- Стан бекфілу по галереях: рядок на галерею, тож стеля PostgREST у тисячу
-- рядків тут не діє (гоча 14). Читає тільки адмінський маршрут через
-- service role.
create or replace function public.gallery_variant_stats(gallery_ids uuid[])
returns table (
  gallery_id uuid,
  photos bigint,
  with_copies bigint,
  waiting bigint,
  given_up bigint,
  original_bytes numeric,
  copy_bytes numeric
)
language sql stable security definer set search_path = public as $$
  select p.gallery_id,
         count(*) filter (where p.media_type = 'photo'),
         count(*) filter (where p.variants_at is not null),
         count(*) filter (where p.media_type = 'photo' and p.variants_at is null and p.variant_tries < 3),
         count(*) filter (where p.media_type = 'photo' and p.variants_at is null and p.variant_tries >= 3),
         coalesce(sum(p.size_bytes) filter (where p.media_type = 'photo'), 0),
         coalesce(sum(p.variant_bytes), 0)
  from public.photographer_gallery_photos p
  where p.gallery_id = any(gallery_ids)
  group by p.gallery_id
$$;

revoke all on function public.gallery_variant_stats(uuid[]) from public, anon, authenticated;
