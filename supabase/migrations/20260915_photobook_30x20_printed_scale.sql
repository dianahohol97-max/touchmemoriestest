-- 30×20 з друкованою обкладинкою коштує стільки ж, скільки 20×30.
--
-- ЩО САМЕ. Це та сама книга, повернута боком: той самий папір, той самий
-- друк, те саме виробництво. Код так її й рахує — у lib/products.ts обидва
-- розміри мають ОДИН спільний ключ ціни '20x30_30x20'. У таблиці цін вони
-- розійшлися, і 30×20 виявився дешевшим.
--
-- ЯК ЦЕ ВИГЛЯДАЛО. Обидві шкали починаються з 890 ₴ на 10 сторінках і
-- закінчуються 2390 ₴ на 50. Але 20×30 іде кроком 75 ₴ на кожні дві
-- сторінки, а 30×20 — кроком 70 ₴. Кінці збігаються, бо їх виставили
-- окремо, а все між ними поїхало: недобір росте рівно на 5 ₴ кожні дві
-- сторінки, від 5 ₴ на 12 сторінках до 95 ₴ на 48.
--
--   стор.   20×30    30×20   недобір
--      10     890      890         —
--      24    1415     1380      35 ₴   ← з цього почалося (Діана, 15.09.2026)
--      40    2015     1940      75 ₴
--      48    2315     2220      95 ₴
--      50    2390     2390         —
--
-- ЧОМУ ТІЛЬКИ ДРУКОВАНА. Велюр, тканина і шкірзамінник у 30×20 збігаються з
-- 20×30 до копійки — усі 21 рядок кожного типу. Розійшлася рівно одна
-- колонка, і саме так виглядає крок, набраний руками не тим числом.
--
-- НАПРЯМОК. Ціни РОСТУТЬ до рівня 20×30. Це не зміна прайсу, а зведення
-- таблиці до нього ж: правильною стороною вважається 20×30, бо її шкала
-- точно лягає між обома опорними точками (890 + 75×20 = 2390), а шкала
-- 30×20 не лягає (890 + 70×20 = 2290, а в таблиці стоїть 2390).
--
-- СЛІД. Кожен змінений рядок пишеться в photobook_price_changes, щоб зміну
-- було видно в історії цін, а не тільки в git.

with target as (
    select
        dst.id,
        ct.name  as cover,
        sd.name  as size,
        dst.page_count,
        dst.base_price as old_price,
        src.base_price as new_price
    from photobook_prices dst
    join photobook_sizes sd on sd.id = dst.size_id and sd.name = '30×20'
    join cover_types    ct on ct.id = dst.cover_type_id and ct.name = 'Друкована'
    join photobook_prices src on src.cover_type_id = dst.cover_type_id
                             and src.page_count    = dst.page_count
    join photobook_sizes ss on ss.id = src.size_id and ss.name = '20×30'
    where dst.base_price is distinct from src.base_price
),
logged as (
    insert into photobook_price_changes (cover_type, size, page_count, old_price, new_price, source)
    select cover, size, page_count, old_price, new_price,
           '20260915_photobook_30x20_printed_scale'
    from target
    returning 1
)
update photobook_prices p
set base_price = t.new_price
from target t
where p.id = t.id;
