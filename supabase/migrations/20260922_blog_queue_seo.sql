-- Черга публікацій блогу та поля, яких бракувало для SEO статті.
--
-- НАВІЩО. До 22.09.2026 черга трималася на двох полях: `is_published` разом із
-- датою в майбутньому. Гейт `lib/blog/published.ts` ховав таку статтю до
-- настання дати, і це працювало, але стан «чернетка» і стан «чекає своєї
-- дати» виглядали в базі однаково — обидва мали `is_published = false` або ж
-- обидва `true` з датою, і відрізнити їх можна було тільки поглядом на
-- календар. Крон, який щодня відкриває рівно одну статтю, потребує третього
-- стану, який видно рядком, а не обчисленням.
--
-- ТРИ СТАНИ. `draft` — пишеться, не в черзі взагалі. `scheduled` — стоїть у
-- черзі, має `publish_at`. `published` — відкрита, має `published_at`.
--
-- ЩО НЕ ДУБЛЮЄТЬСЯ. Поля `cover_alt` і `author` із технічного завдання тут не
-- заводяться: у таблиці вже є `cover_image_alt` і `author_name`, які читають
-- сторінка статті й адмінка. Другий стовпець із тим самим змістом означав би
-- два джерела правди й мовчазну розбіжність між ними.
--
-- БЕКФІЛ. Двадцять чотири наявні пости розкладаються за фактичним станом:
-- шістнадцять із датою в минулому стають `published`, вісім із жовтневими
-- датами — `scheduled` із `publish_at`, який дорівнює вже проставленій даті.
-- Жодна дата не зсувається, жодна стаття не відкривається раніше.

alter table public.blog_posts
  add column if not exists status text not null default 'draft',
  add column if not exists publish_at timestamptz,
  add column if not exists faq jsonb not null default '[]'::jsonb,
  add column if not exists internal_links jsonb not null default '[]'::jsonb,
  add column if not exists related_product_slugs text[] not null default '{}'::text[],
  add column if not exists locale text not null default 'uk';

-- Мова, якою написаний базовий рядок. Переклади живуть у `translations`, і
-- саме з цих двох джерел сторінка статті рахує hreflang: обіцяти Google пʼять
-- перекладів, маючи один український текст, — це самому здати пʼять дублів.
comment on column public.blog_posts.locale is
  'Мова базового рядка. Решта локалей — ключі в translations. hreflang будується з обох.';

comment on column public.blog_posts.publish_at is
  'Коли стаття має відкритися. Веде чергу; після публікації дату показує published_at.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blog_posts_status_check'
  ) then
    alter table public.blog_posts
      add constraint blog_posts_status_check
      check (status in ('draft', 'scheduled', 'published'));
  end if;
end $$;

update public.blog_posts
set status = case
      when is_published and (published_at is null or published_at <= now()) then 'published'
      when is_published and published_at > now() then 'scheduled'
      else 'draft'
    end,
    publish_at = coalesce(publish_at, published_at)
where status = 'draft';

-- Вісім статей у черзі приводяться до того вигляду, який черга від них
-- очікує. Дві розбіжності, обидві мовчазні:
--
-- 1. У них стояло `is_published = true` з датою в майбутньому. Гейт їх і так
--    ховає за `status`, але три поля видимості мають означати одне й те саме,
--    інакше наступний, хто гляне на рядок, побачить «опубліковано» там, де
--    насправді черга. Відкрити статтю має крон, і тільки він.
-- 2. Час стояв на дев'ятій ранку за Києвом, тобто 06:00 UTC, а крон ходить о
--    05:00 UTC. Кожна стаття розминалася зі своїм проходом на годину і вийшла
--    б НАСТУПНОГО дня — усі вісім зі зсувом на добу, і помітили б ми це аж по
--    факту. Час зводиться на сьому за Києвом, дати лишаються ті самі.
update public.blog_posts
set is_published = false,
    published_at = null,
    publish_at = (date_trunc('day', publish_at at time zone 'Europe/Kyiv') + interval '7 hours')
                 at time zone 'Europe/Kyiv'
where status = 'scheduled' and publish_at is not null;

-- Черга читається одним запитом «найстаріша заплановна, чий час настав», тож
-- індекс складений рівно під нього.
create index if not exists blog_posts_queue_idx
  on public.blog_posts (status, publish_at);

-- `updated_at` у статті — це дата оновлення в розмітці Article, яку бачить
-- Google. До цієї міграції її не оновлювало ніщо: стовпець мав `default now()`
-- і після створення рядка залишався вічно однаковим, тож `dateModified`
-- дорівнював `datePublished` у кожній із двадцяти чотирьох статей.
create or replace function public.touch_blog_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.touch_blog_posts_updated_at();
