-- Весільні агенції повертаються в меню і стають четвертим напрямом.
--
-- ЩО СТАЛОСЯ. Міграція 20260924 звела напрями до трьох і згасила пункт «Для
-- весільних агенцій» під «Співпрацею». Діана побачила це першою ж перевіркою і
-- сказала, що його бракує (24.09.2026). Напрямів чотири: фотографи, весільні
-- агенції, блогери, турагентства.
--
-- ЧОМУ ОКРЕМА МІГРАЦІЯ, А НЕ ПРАВКА ПОПЕРЕДНЬОЇ. Та вже прогнана на живій базі,
-- і переписана вона нічого б там не змінила: база знає тільки те, що вже
-- виконалося. Друга міграція — єдиний спосіб, щоб і продакшн, і чистий прогін
-- із нуля прийшли до одного стану.
--
-- У navigation_links і footer_links немає updated_at, тільки created_at.

DO $$
DECLARE
    coop_id UUID;
    item RECORD;
BEGIN
    SELECT id INTO coop_id FROM navigation_links
    WHERE parent_id IS NULL AND lower(link_text) IN ('співпраця', 'спiвпраця', 'партнерам')
    LIMIT 1;

    IF coop_id IS NULL THEN
        RETURN;
    END IF;

    FOR item IN
        SELECT * FROM (VALUES
            ('Для фотографів',       '/photographers',                       1),
            ('Для весільних агенцій','/wedding-agencies',                     2),
            ('Для блогерів',         '/partnerska-programa-dlya-blogeriv',    3),
            ('Для турагентств',      '/partnerska-programa-dlya-turagentstv', 4)
        ) AS v(link_text, link_url, display_order)
    LOOP
        IF EXISTS (SELECT 1 FROM navigation_links WHERE parent_id = coop_id AND link_url = item.link_url) THEN
            UPDATE navigation_links
            SET link_text = item.link_text, display_order = item.display_order, is_active = true
            WHERE parent_id = coop_id AND link_url = item.link_url;
        ELSE
            INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id)
            VALUES (item.link_text, item.link_url, item.display_order, true, coop_id);
        END IF;
    END LOOP;
END $$;

-- Той самий список у футері, щоб вибір не залежав від того, звідки людина зайшла.
DO $$
DECLARE
    partners_section UUID;
    item RECORD;
BEGIN
    SELECT id INTO partners_section FROM footer_sections WHERE section_name = 'partners' LIMIT 1;
    IF partners_section IS NULL THEN
        RETURN;
    END IF;

    FOR item IN
        SELECT * FROM (VALUES
            ('Для фотографів',       '/photographers',                       2),
            ('Для весільних агенцій','/wedding-agencies',                     3),
            ('Для блогерів',         '/partnerska-programa-dlya-blogeriv',    4),
            ('Для турагентств',      '/partnerska-programa-dlya-turagentstv', 5)
        ) AS v(link_text, link_url, display_order)
    LOOP
        IF EXISTS (SELECT 1 FROM footer_links WHERE section_id = partners_section AND link_url = item.link_url) THEN
            UPDATE footer_links
            SET link_text = item.link_text, display_order = item.display_order, is_active = true
            WHERE section_id = partners_section AND link_url = item.link_url;
        ELSE
            INSERT INTO footer_links (section_id, link_text, link_url, display_order, is_active)
            VALUES (partners_section, item.link_text, item.link_url, item.display_order, true);
        END IF;
    END LOOP;

    UPDATE footer_links
    SET display_order = 6, is_active = true
    WHERE section_id = partners_section AND link_url = '/partner/cabinet';
END $$;

-- «Для весільних агенцій» переїхало в колонку «Партнерам», тож у «Допомозі» воно
-- тепер дублікат: на телефоні обидві колонки видно одночасно.
UPDATE footer_links
SET is_active = false
WHERE section_id = (SELECT id FROM footer_sections WHERE section_name = 'help')
  AND link_url = '/wedding-agencies';
