-- SEO copy for the two priority products and their categories (Diana, 2026-09-22).
--
-- Every number here is read off data that already existed — products.specs,
-- products.price and the page scale in lib/products.ts — and nothing was
-- invented. Two facts worth writing down because they contradicted each other
-- before this commit:
--
--   * travelbook-20x30 and fotozhurnal-tverd-obkladynka are BOTH 12–80 pages.
--     products.min_pages = 1 / max_pages = 100 on those rows is loose column
--     bookkeeping, not the sellable range; the real scale is
--     TRAVEL_BOOK.pagesAvailable. Only the soft magazine is 8–100.
--   * the hard journal takes 7–10 working days (Diana, 2026-09-22). Its specs
--     said 10–14 and its urgency option said 5–8 — three numbers on one card.
--     production_time is the single source of truth now and the other two are
--     brought to it in 20260922_production_time_single_source.sql.
--
-- Length discipline: descriptions ≤155 characters, titles ≤65 BEFORE the
-- « | Touch.Memories» suffix, which generateMetadata appends via
-- withBrandSuffix(). Storing the suffix here would print it twice.

-- ── travelbook-20x30 ────────────────────────────────────────────────────────
-- «тревелбук» is the query; «Travel Book» is what the product is called in the
-- cart and in KeyCRM. The title carries both spellings, the h1 and the first
-- paragraph carry the Ukrainian one. name is deliberately NOT touched.
update products set
  meta_title = 'Тревелбук (Travel Book) 20×30 з твоїх фото — книга про подорож',
  meta_description = 'Тревелбук 20×30 см із твоїх фото: тверда обкладинка, папір 170 г, 12–80 сторінок, обкладинки під країни. Конструктор або дизайнер. Від 675 ₴, 8–10 днів.',
  h1 = 'Тревелбук 20×30 — книга про одну твою подорож',
  translations = coalesce(translations, '{}'::jsonb)
    || jsonb_build_object(
      'en', coalesce(translations->'en', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Travel Book 20×30 from Your Own Photos — One Trip, One Book',
        'meta_description', 'A 20×30 cm travel book from your photos: hard cover, 170gsm paper, 12–80 pages, covers made for specific countries. From 675 UAH, 8–10 working days.',
        'h1', 'Travel Book 20×30 — a book about one trip of yours'),
      'pl', coalesce(translations->'pl', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Travelbook 20×30 z Twoich zdjęć — książka o podróży',
        'meta_description', 'Travelbook 20×30 cm z Twoich zdjęć: twarda okładka, papier 170 g, 12–80 stron, okładki pod konkretne kraje. Od 675 UAH, 8–10 dni roboczych.',
        'h1', 'Travelbook 20×30 — książka o jednej Twojej podróży'),
      'de', coalesce(translations->'de', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Reisebuch 20×30 aus deinen Fotos — ein Buch über die Reise',
        'meta_description', 'Reisebuch 20×30 cm aus deinen Fotos: Hardcover, 170g Papier, 12–80 Seiten, Cover für einzelne Länder. Ab 675 UAH, 8–10 Werktage.',
        'h1', 'Reisebuch 20×30 — ein Buch über eine deiner Reisen'),
      'ro', coalesce(translations->'ro', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Travel Book 20×30 din fotografiile tale — carte despre călătorie',
        'meta_description', 'Travel book 20×30 cm din fotografiile tale: copertă tare, hârtie 170 g, 12–80 pagini, coperți pentru țări anume. De la 675 UAH, 8–10 zile lucrătoare.',
        'h1', 'Travel Book 20×30 — o carte despre o călătorie a ta'))
where slug = 'travelbook-20x30';

-- ── personalized-glossy-magazine (soft cover) ───────────────────────────────
update products set
  meta_title = 'Глянцевий журнал з фото на замовлення — подарунок з вау-ефектом',
  meta_description = 'Глянцевий журнал А4 про людину: твої фото, статті пишемо ми. 8–100 сторінок, від 525 ₴, 5–8 днів (терміново 1–3). Ювілей, річниця, мамі, вчителю.',
  h1 = 'Глянцевий журнал з м''якою обкладинкою — журнал про тебе і твоїх людей',
  translations = coalesce(translations, '{}'::jsonb)
    || jsonb_build_object(
      'en', coalesce(translations->'en', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Custom Glossy Magazine with Your Photos — A Gift That Lands',
        'meta_description', 'A personal A4 glossy magazine about someone: your photos, we write the articles. 8–100 pages, from 525 UAH, 5–8 days (rush 1–3).',
        'h1', 'Soft-cover glossy magazine — a magazine about you and your people'),
      'pl', coalesce(translations->'pl', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Błyszczący magazyn z Twoimi zdjęciami na zamówienie',
        'meta_description', 'Osobisty magazyn A4 o człowieku: Twoje zdjęcia, teksty piszemy my. 8–100 stron, od 525 UAH, 5–8 dni (ekspres 1–3). Jubileusz, rocznica, mamie.',
        'h1', 'Magazyn w miękkiej oprawie — magazyn o Tobie i Twoich ludziach'),
      'de', coalesce(translations->'de', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Hochglanz-Magazin mit deinen Fotos nach Maß — Geschenk',
        'meta_description', 'Persönliches A4-Hochglanzmagazin über einen Menschen: deine Fotos, die Texte schreiben wir. 8–100 Seiten, ab 525 UAH, 5–8 Tage (Express 1–3).',
        'h1', 'Hochglanz-Magazin mit Softcover — ein Magazin über dich und deine Menschen'),
      'ro', coalesce(translations->'ro', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Revistă lucioasă cu fotografiile tale la comandă — cadou',
        'meta_description', 'Revistă A4 lucioasă despre un om: fotografiile tale, textele le scriem noi. 8–100 pagini, de la 525 UAH, 5–8 zile (urgent 1–3).',
        'h1', 'Revistă lucioasă cu copertă moale — o revistă despre tine și oamenii tăi'))
where slug = 'personalized-glossy-magazine';

-- ── fotozhurnal-tverd-obkladynka (hard cover) ───────────────────────────────
-- Same family, deliberately a DIFFERENT title from the soft version: the two
-- rows sat in one category with near-identical titles, which is how a pair of
-- pages compete for one query and neither wins. Cover type is the difference
-- the customer is actually choosing between, so it leads both title and h1.
update products set
  meta_title = 'Глянцевий журнал з твердою обкладинкою — фотожурнал А4',
  meta_description = 'Глянцевий журнал А4 з твердою обкладинкою: твої фото і тексти про людину, 12–80 сторінок, папір 170 г. Від 675 ₴, 7–10 робочих днів.',
  h1 = 'Глянцевий журнал з твердою обкладинкою — журнал про твою людину',
  translations = coalesce(translations, '{}'::jsonb)
    || jsonb_build_object(
      'en', coalesce(translations->'en', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Hard-Cover Glossy Magazine — A4 Photo Journal',
        'meta_description', 'An A4 glossy magazine with a hard cover: your photos and texts about someone, 12–80 pages, 170gsm paper. From 675 UAH, 7–10 working days.',
        'h1', 'Hard-cover glossy magazine — a journal about your person'),
      'pl', coalesce(translations->'pl', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Błyszczący magazyn w twardej oprawie — fotoksiążka A4',
        'meta_description', 'Magazyn A4 w twardej oprawie: Twoje zdjęcia i teksty o człowieku, 12–80 stron, papier 170 g. Od 675 UAH, 7–10 dni roboczych.',
        'h1', 'Magazyn w twardej oprawie — magazyn o Twoim człowieku'),
      'de', coalesce(translations->'de', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Hochglanz-Magazin mit Hardcover — A4 Fotojournal',
        'meta_description', 'A4-Hochglanzmagazin mit Hardcover: deine Fotos und Texte über einen Menschen, 12–80 Seiten, 170g Papier. Ab 675 UAH, 7–10 Werktage.',
        'h1', 'Hochglanz-Magazin mit Hardcover — ein Journal über deinen Menschen'),
      'ro', coalesce(translations->'ro', '{}'::jsonb) || jsonb_build_object(
        'meta_title', 'Revistă lucioasă cu copertă tare — fotojurnal A4',
        'meta_description', 'Revistă A4 cu copertă tare: fotografiile și textele tale despre un om, 12–80 pagini, hârtie 170 g. De la 675 UAH, 7–10 zile lucrătoare.',
        'h1', 'Revistă lucioasă cu copertă tare — un jurnal despre omul tău'))
where slug = 'fotozhurnal-tverd-obkladynka';

-- ── categories ──────────────────────────────────────────────────────────────
-- meta_title / meta_description are new columns (20260922_seo_h1_category_meta).
-- Before them the category <title> was always "{name} | Touch.Memories" and the
-- description was the body paragraph cut at 160 characters mid-word.
update categories set
  meta_title = 'Глянцеві журнали з фото на замовлення — м''яка і тверда обкладинка',
  meta_description = 'Фотожурнал А4 з твоїми фото і текстами про людину. Дві обкладинки, 8–100 сторінок, від 525 ₴. Замов онлайн з доставкою Новою Поштою по Україні.'
where slug = 'hlyantsevi-zhurnaly';

-- The travel book category was literally named «Travelbooks» — an English word
-- as the <h1> of the page meant to rank for «тревелбук», and the description
-- only ever spelled it hyphenated («тревел-бук»), which is a different token to
-- a search engine. categories.name is display-only (no code matches on it; the
-- functional key is the slug), so renaming it is safe.
update categories set
  name = 'Тревелбуки',
  description = 'Тревелбук — окрема книга про твою подорож: маршрут, емоції та найкращі кадри в одному форматі 20×30 см, від 12 сторінок. Ми збираємо індивідуальний дизайн під твою історію, щоб спогади про мандрівку лишалися не лише в телефоні. Замов travel book онлайн із доставкою по всій Україні.',
  meta_title = 'Тревелбук на замовлення — книга про твою подорож 20×30',
  meta_description = 'Тревелбук 20×30 см із твоїх фото: маршрут, емоції та найкращі кадри однієї подорожі. Від 12 до 80 сторінок, від 675 ₴. Доставка по Україні.'
where slug = 'travelbooks';
