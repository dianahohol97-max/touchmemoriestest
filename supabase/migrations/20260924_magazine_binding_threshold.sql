-- Глянцевий журнал: скоба до 52 сторінок, а не до 44.
--
-- Навіщо. Друкарня назвала поріг 24.09.2026: до п'ятдесяти двох включно
-- скоба, більший обсяг на клей. В описі товару стояло 44 — усіма п'ятьма
-- мовами, числами прописом, — і звідки взялося саме 44, не пам'ятає ніхто.
-- Клієнт, який замовляв 48 або 52 сторінки, читав, що отримає клейовий
-- корінець із назвою, а в коробці отримував скобу. Це не косметика: рівний
-- корінець є однією з причин брати товщий журнал, і обіцяли ми його там, де
-- його не буде.
--
-- Заодно прибрано подвійність на самій межі. Стояло «до сорока чотирьох… а
-- від сорока чотирьох…», тобто 44 потрапляло в обидва боки і на питання «а
-- рівно сорок чотири?» текст не відповідав. Тепер верхня межа названа один
-- раз, а все, що більше, описане словами, тож наступна зміна порогу не
-- поламає речення вдруге.
--
-- Запит написаний через replace(), а не через новий текст цілком: опис Діана
-- редагує сама, і переписування всієї колонки затерло б її правки, зроблені
-- після цієї міграції. Повторний запуск нічого не змінює, бо після першого
-- проходу шуканих рядків у тексті вже немає.
--
-- Три місця в коді, які несли те саме число, зведені до однієї константи
-- MAGAZINE_STAPLE_MAX_PAGES у lib/products.ts. Опис у базі до коду не
-- дотягнути, тому він лишається текстом і правиться тут.

update public.products
set description = replace(
      description,
      'До сорока чотирьох сторінок журнал зшивається скобою, як тонке видання, а від сорока чотирьох іде на клей і отримує рівний корінець, на якому видно назву.',
      'До п''ятдесяти двох сторінок журнал зшивається скобою, як тонке видання, а більший обсяг іде на клей і отримує рівний корінець, на якому видно назву.'
    )
where slug = 'personalized-glossy-magazine';

-- Переклади лежать в одній колонці JSONB, по одному ключу на мову, тож
-- кожен правиться окремо. jsonb_set на неіснуючому ключі нічого не робить,
-- тому відсутній переклад не створить порожнього опису.
update public.products
set translations = jsonb_set(
      translations,
      '{en,description}',
      to_jsonb(replace(
        translations->'en'->>'description',
        'Up to forty-four pages the magazine is saddle-stitched like a thin publication, and from forty-four onwards it is perfect-bound and gains a flat spine with the title readable on it.',
        'Up to fifty-two pages the magazine is saddle-stitched like a thin publication, and a thicker one is perfect-bound and gains a flat spine with the title readable on it.'
      ))
    )
where slug = 'personalized-glossy-magazine'
  and translations->'en'->>'description' is not null;

update public.products
set translations = jsonb_set(
      translations,
      '{de,description}',
      to_jsonb(replace(
        translations->'de'->>'description',
        'Bis vierundvierzig Seiten wird das Magazin wie eine dünne Publikation klammergeheftet, ab vierundvierzig geht es in die Klebebindung und bekommt einen geraden Rücken mit lesbarem Titel.',
        'Bis zweiundfünfzig Seiten wird das Magazin wie eine dünne Publikation klammergeheftet, ein dickeres geht in die Klebebindung und bekommt einen geraden Rücken mit lesbarem Titel.'
      ))
    )
where slug = 'personalized-glossy-magazine'
  and translations->'de'->>'description' is not null;

update public.products
set translations = jsonb_set(
      translations,
      '{pl,description}',
      to_jsonb(replace(
        translations->'pl'->>'description',
        'Do czterdziestu czterech stron magazyn jest szyty zeszytowo jak cienkie wydawnictwo, a od czterdziestu czterech idzie na klej i zyskuje płaski grzbiet z czytelnym tytułem.',
        'Do pięćdziesięciu dwóch stron magazyn jest szyty zeszytowo jak cienkie wydawnictwo, a grubszy idzie na klej i zyskuje płaski grzbiet z czytelnym tytułem.'
      ))
    )
where slug = 'personalized-glossy-magazine'
  and translations->'pl'->>'description' is not null;

update public.products
set translations = jsonb_set(
      translations,
      '{ro,description}',
      to_jsonb(replace(
        translations->'ro'->>'description',
        'Până la patruzeci și patru de pagini revista este capsată ca o publicație subțire, iar de la patruzeci și patru încolo este lipită și capătă un cotor drept pe care se citește titlul.',
        'Până la cincizeci și două de pagini revista este capsată ca o publicație subțire, iar una mai groasă este lipită și capătă un cotor drept pe care se citește titlul.'
      ))
    )
where slug = 'personalized-glossy-magazine'
  and translations->'ro'->>'description' is not null;

-- Перевірка після застосування: жодної згадки сорока чотирьох у жодній мові.
-- select slug,
--        description ~ 'сорока чотирьох' as uk_still_44,
--        translations->'en'->>'description' ~ 'forty-four' as en_still_44,
--        translations->'de'->>'description' ~ 'vierundvierzig' as de_still_44,
--        translations->'pl'->>'description' ~ 'czterdziestu' as pl_still_44,
--        translations->'ro'->>'description' ~ 'patruzeci' as ro_still_44
--   from public.products where slug = 'personalized-glossy-magazine';
