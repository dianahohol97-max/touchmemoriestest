-- Три напрями співпраці — і в меню, і у футері.
--
-- ЩО БУЛО ЗЛАМАНО. Партнерських напрямів три: фотографи, блогери, турагентства.
-- Жодне місце на сайті не показувало всі три. Пункт меню «Співпраця» вів на
-- /photographers, тобто одразу на сторінку одного напряму, і людина з телефона
-- бачила тільки кабінет фотографа: вкладені пункти показувала лише випадайка на
-- десктопі. Футер вів на /travel-agencies, звідки редирект кидав на хаб
-- /partnery, а там стояли дві картки з трьох — блогер і агенція. Виходило, що
-- фотограф ніколи не бачив двох інших напрямів, а блогер не бачив себе в меню
-- (Діана, 24.09.2026).
--
-- ЩО РОБИТЬ ЦЯ МІГРАЦІЯ. Веде обидва входи на хаб /partnery, де тепер три
-- картки, і вирівнює списки під ними: у меню і у футері стоять ті самі три
-- напрями в тому самому порядку, що й картки (lib/partners/landing-content.ts,
-- HUB_ROUTES).
--
-- ЧОМУ МІГРАЦІЯ, А НЕ РУКИ В АДМІНЦІ. Меню живе в navigation_links, футер — у
-- footer_links, і кожен рядок там колись хтось додав кнопкою. З коду таких
-- правок не видно: людина, яка через місяць шукатиме, звідки в шапці взялося
-- посилання, знайде його тільки тут. Міграція ідемпотентна, її можна прогнати
-- двічі.
--
-- ПРО updated_at. У navigation_links і footer_links його НЕМАЄ, тільки
-- created_at. Саме на цьому мовчки спинилася міграція 20260921: вона пише
-- updated_at = NOW(), падає на першому ж UPDATE і тому ніколи не доїхала в
-- продакшн, через що меню лишалося зі старим поділом ще три дні.
--
-- ПРО АДРЕСИ БЕЗ ЛОКАЛІ. Посилання зберігаються без /uk на початку: шапка сама
-- підставляє локаль відвідувача (lib/i18n/path.ts). Записаний сюди /uk/… відвів
-- би німця з /de в українську частину сайту.

-- Стара адреса /travel-agencies віддає 308 на хаб (next.config.ts), тож
-- посилання на неї працюють, але через зайвий перехід. Переводимо їх на
-- профільну сторінку турагентств одразу — і робимо це ПЕРШИМ кроком: інакше
-- старий пункт меню «Для тревел-агенцій» отримає цю адресу вже після того, як
-- ми додамо новий, і під «Співпрацею» лишиться два рядки з однаковим
-- посиланням. Футерне «Стати партнером» нижче отримає свою адресу за назвою,
-- тож його це переписування не зачіпає.
UPDATE navigation_links
SET link_url = '/partnerska-programa-dlya-turagentstv'
WHERE link_url LIKE '%/travel-agencies%';

UPDATE footer_links
SET link_url = '/partnerska-programa-dlya-turagentstv'
WHERE link_url LIKE '%/travel-agencies%';

DO $$
DECLARE
    coop_id UUID;
BEGIN
    -- ── Меню ─────────────────────────────────────────────────────────────────
    -- Батьківський пункт шукаємо за назвою, а потім за адресою: він міг
    -- називатися як завгодно, але вести на партнерську сторінку.
    SELECT id INTO coop_id
    FROM navigation_links
    WHERE parent_id IS NULL AND lower(link_text) IN ('співпраця', 'спiвпраця', 'партнерам')
    LIMIT 1;

    IF coop_id IS NULL THEN
        SELECT id INTO coop_id
        FROM navigation_links
        WHERE parent_id IS NULL AND link_url IN ('/photographers', '/travel-agencies', '/partnery')
        LIMIT 1;
    END IF;

    IF coop_id IS NULL THEN
        INSERT INTO navigation_links (link_text, link_url, display_order, is_active, parent_id)
        VALUES ('Співпраця', '/partnery', 8, true, NULL)
        RETURNING id INTO coop_id;
    ELSE
        -- Назву лишаємо недоторканою (Діана могла назвати пункт по-своєму),
        -- адресу переводимо на хаб: натиск на телефоні має відкривати вибір із
        -- трьох, а не сторінку одного напряму.
        UPDATE navigation_links
        SET link_url = '/partnery', is_active = true
        WHERE id = coop_id;
    END IF;

    -- Гасимо все, що лишилося під цим пунктом від старого поділу. Не видаляємо:
    -- рядок лишається видимим в адмінці, і повернути його — одна галочка.
    -- «Для весільних агенцій» теж гасне тут, бо напрямів у нас три, а сторінка
    -- /wedding-agencies нікуди не дівається і лишається в розділі «Допомога».
    UPDATE navigation_links
    SET is_active = false
    WHERE parent_id = coop_id
      AND link_url NOT IN (
          '/photographers',
          '/partnerska-programa-dlya-blogeriv',
          '/partnerska-programa-dlya-turagentstv'
      );
END $$;

-- Три пункти меню. Ідемпотентно і одним циклом: унікального ключа на link_url
-- немає, тож ON CONFLICT тут не спрацює, а шість окремих INSERT … IF NOT EXISTS
-- дали б шість місць, де можна помилитися адресою.
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
            ('Для фотографів',  '/photographers',                          1),
            ('Для блогерів',    '/partnerska-programa-dlya-blogeriv',       2),
            ('Для турагентств', '/partnerska-programa-dlya-turagentstv',    3)
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

-- ── Футер ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    partners_section UUID;
    item RECORD;
BEGIN
    SELECT id INTO partners_section FROM footer_sections WHERE section_name = 'partners' LIMIT 1;
    IF partners_section IS NULL THEN
        RETURN;
    END IF;

    -- «Стати партнером» вело на /travel-agencies, тобто через редирект. Зайвий
    -- перехід прибираємо в самому джерелі.
    UPDATE footer_links
    SET link_url = '/partnery', display_order = 1, is_active = true
    WHERE section_id = partners_section AND link_text ILIKE 'стати партнером%';

    -- Ті самі три напрями, що й у меню, щоб людина бачила однаковий вибір
    -- незалежно від того, звідки зайшла.
    FOR item IN
        SELECT * FROM (VALUES
            ('Для фотографів',  '/photographers',                          2),
            ('Для блогерів',    '/partnerska-programa-dlya-blogeriv',       3),
            ('Для турагентств', '/partnerska-programa-dlya-turagentstv',    4)
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
    SET display_order = 5, is_active = true
    WHERE section_id = partners_section AND link_url = '/partner/cabinet';
END $$;

-- Розділ «Допомога» у футері тримав ті самі партнерські посилання ще з часів,
-- коли розділу «Партнерам» не було. Тепер вони стоять поруч, у сусідній колонці,
-- і на телефоні обидві колонки видно одночасно: «Для фотографів» двічі в одному
-- футері. Гасимо ті, що переїхали, і не чіпаємо «Для весільних агенцій» — після
-- цієї міграції це єдиний вхід на /wedding-agencies, бо з меню «Співпраця» цей
-- пункт пішов.
UPDATE footer_links
SET is_active = false
WHERE section_id = (SELECT id FROM footer_sections WHERE section_name = 'help')
  AND link_url IN ('/photographers', '/partnerska-programa-dlya-turagentstv');
