-- Меню «Співпраця»: замість одного пункту — дві профільні сторінки.
--
-- НАВІЩО. Партнерська програма переїхала з /travel-agencies на хаб /partnery і
-- дві сторінки під різні запити: блогерам потрібна винагорода з замовлення,
-- агенціям — подарунок клієнту після туру. У меню лишався один пункт, який вів
-- на стару адресу.
--
-- ЧОМУ МІГРАЦІЯ, А НЕ РУКИ В АДМІНЦІ. Меню живе в таблиці navigation_links, і
-- кожен рядок у ній колись хтось додав кнопкою. Такі правки ніде не видно з
-- коду: людина, яка через місяць шукатиме, звідки в шапці взялося посилання,
-- знайде його тільки тут. Міграція ідемпотентна — її можна прогнати двічі.
--
-- ПРО АДРЕСИ БЕЗ ЛОКАЛІ. Посилання зберігаються без /uk на початку: шапка сама
-- підставляє локаль відвідувача (lib/i18n/path.ts). Записаний сюди /uk/… відвів
-- би німця з /de в українську частину сайту.

DO $$
DECLARE
    coop_id UUID;
BEGIN
    -- 1. Батьківський пункт. Спершу шукаємо за назвою, потім — за старим
    --    посиланням: пункт міг називатися як завгодно, але вести на партнерську
    --    сторінку, і тоді це саме він.
    SELECT id INTO coop_id
    FROM navigation_links
    WHERE parent_id IS NULL AND lower(link_text) IN ('співпраця', 'спiвпраця', 'партнерам')
    LIMIT 1;

    IF coop_id IS NULL THEN
        SELECT id INTO coop_id
        FROM navigation_links
        WHERE parent_id IS NULL AND link_url LIKE '%travel-agencies%'
        LIMIT 1;
    END IF;

    IF coop_id IS NULL THEN
        INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id)
        VALUES ('Співпраця', '/partnery', 90, true, NULL)
        RETURNING id INTO coop_id;
    ELSE
        -- Пункт існує: лишаємо його назву недоторканою (Діана могла назвати
        -- його по-своєму), але адресу переводимо на хаб.
        UPDATE navigation_links
        SET link_url = '/partnery', is_active = true, updated_at = NOW()
        WHERE id = coop_id;
    END IF;

    -- 2. Старі діти цього пункту, що вели на /travel-agencies, зникають з меню.
    --    Не видаляємо, а гасимо: рядок лишається видимим в адмінці, і повернути
    --    його — одна галочка.
    UPDATE navigation_links
    SET is_active = false, updated_at = NOW()
    WHERE parent_id = coop_id AND link_url LIKE '%travel-agencies%';

    -- 3. Два нові пункти. ON CONFLICT тут не спрацює (унікального ключа на
    --    link_url немає), тому перевіряємо наявність самі — інакше повторний
    --    прогін подвоїв би меню.
    IF NOT EXISTS (
        SELECT 1 FROM navigation_links
        WHERE parent_id = coop_id AND link_url = '/partnerska-programa-dlya-blogeriv'
    ) THEN
        INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id)
        VALUES ('Для блогерів', '/partnerska-programa-dlya-blogeriv', 1, true, coop_id);
    ELSE
        UPDATE navigation_links
        SET is_active = true, display_order = 1, updated_at = NOW()
        WHERE parent_id = coop_id AND link_url = '/partnerska-programa-dlya-blogeriv';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM navigation_links
        WHERE parent_id = coop_id AND link_url = '/partnerska-programa-dlya-turagentstv'
    ) THEN
        INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id)
        VALUES ('Для турагентств', '/partnerska-programa-dlya-turagentstv', 2, true, coop_id);
    ELSE
        UPDATE navigation_links
        SET is_active = true, display_order = 2, updated_at = NOW()
        WHERE parent_id = coop_id AND link_url = '/partnerska-programa-dlya-turagentstv';
    END IF;
END $$;

-- 4. Будь-які інші посилання на стару адресу — у футері й у меню — ведуть на
--    хаб. Редирект у next.config.ts їх і так підхопить, але зайвий перехід
--    краще прибрати в самому джерелі.
UPDATE navigation_links
SET link_url = replace(link_url, '/travel-agencies', '/partnery'), updated_at = NOW()
WHERE link_url LIKE '%/travel-agencies%';

UPDATE footer_links
SET link_url = replace(link_url, '/travel-agencies', '/partnery'), updated_at = NOW()
WHERE link_url LIKE '%/travel-agencies%';
