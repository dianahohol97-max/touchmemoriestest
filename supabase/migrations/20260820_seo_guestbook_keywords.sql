-- Keyword coverage pass over the guest book cluster, after a review with Diana
-- of how the Ukrainian market actually names this product.
--
-- The audit showed that half of the phrases buyers type did not appear on our
-- pages even once. Checked against the live copy:
--
--   альбом побажань / альбом для побажань  — absent from both products
--   гостьова книга                          — wedding page only, missing on kids
--   книга гостей                            — absent
--   wedding guest book / гест бук           — absent
--   хрещення                                — absent, we only ever wrote «хрестини»
--   з іменами та датою                      — absent as a phrase
--
-- «Хрещення» is the important one. Prom listings are titled «Книга побажань
-- дитяча на хрещення», not «на хрестини», and Google treats the two as separate
-- words rather than one. The children's meta_title moves to «хрещення» because
-- that variant had zero presence, while «хрестини» stays throughout the body and
-- the meta description, so both are covered.
--
-- Deliberately NOT targeted (Diana, 2026-08-20): wood, engraving, ribbons and
-- handmade decor. Much of the market sits on those terms (happycards.com.ua,
-- wwd.dp.ua), we do not make them, and traffic arriving on those queries would
-- bounce straight back.
--
-- The synonyms are woven into sentences that already earn their place — an
-- opening line that names the product, an occasions paragraph, and one new FAQ
-- entry answering a question buyers genuinely ask. No keyword lists, no stuffing.
--
-- Category note: categories.description renders as PLAIN TEXT inside a <p>, not
-- through dangerouslySetInnerHTML, so no markup goes in there. It also doubles
-- as the category meta description, truncated at 160 characters, so the first
-- sentence is written to stand alone at 137 characters and carry the synonyms.
-- The four non-Ukrainian category pages had no description at all and fell back
-- to Ukrainian text under an English heading; they get their own now.

-- ── Wedding guest book ───────────────────────────────────────────────────────

UPDATE products SET

  meta_description = 'Книга побажань на весілля, вона ж альбом побажань і гостьова книга. Тверда обкладинка на вибір, три розміри, 32 сторінки, від 629 ₴.',

  description = replace(replace(replace(replace(
    description,

    'залишаються назавжди. Замість листівок',
    'залишаються назавжди. Її називають по-різному: альбом побажань, гостьова книга, книга гостей або wedding guest book, а у весільній справі часто просто гест бук. Замість листівок'),

    'вашими іменами й датою на ній',
    'з іменами та датою на ній'),

    'Найчастіше це весілля, і тоді книга стоїть на окремому столику',
    'Найчастіше це весілля, і тоді весільна книга побажань стоїть на окремому столику'),

    '<h3>Скільки коштує</h3>',
    '<h3>Чим книга побажань відрізняється від альбому для побажань</h3>
<p>Це одна й та сама річ, просто назв у неї кілька. Хтось шукає альбом для побажань, хтось гостьову книгу чи книгу гостей, а мова про тверду обкладинку з іменами та датою і чисті сторінки всередині. Від фотоальбому вона відрізняється тим, що в ній немає кишень під фотографії, а є місце, де гості пишуть від руки.</p>

<h3>Скільки коштує</h3>'),

  updated_at = NOW()

WHERE slug = 'wishbook';

-- ── Children's guest book ────────────────────────────────────────────────────

UPDATE products SET

  meta_title = 'Дитяча книга побажань на хрещення',

  meta_description = 'Дитяча книга побажань на хрещення і хрестини, на перший день народження або baby shower. Тверда обкладинка з іменем малюка, від 629 ₴.',

  description = replace(replace(replace(
    description,

    -- Nominative case on purpose. The first pass wrote «альбомом побажань» in
    -- the instrumental, which is a weaker match for the phrase people type.
    'Дитяча книга побажань збирає те, що рідні говорять малечі, поки вона ще нічого з цього не розуміє.',
    'Дитяча книга побажань збирає те, що рідні говорять малечі, поки вона ще нічого з цього не розуміє. Хтось шукає її як альбом побажань для малюка, хтось як гостьова книга на хрещення, і це одна й та сама річ.'),

    'Найчастіше на хрестини, бо там',
    'Найчастіше на хрещення, або, як частіше кажуть, на хрестини, бо там'),

    'за неї. Замовляють і на baby shower',
    'за неї, і так у ній опиняється весь перший рік життя. Її дарують і на виписку з пологового, щоб перші записи зробили ті, хто зустрічав маму з дому. Замовляють і на baby shower'),

  updated_at = NOW()

WHERE slug = 'guestbook-kids';

-- ── Category landing ─────────────────────────────────────────────────────────

UPDATE categories SET

  description = 'Книга побажань, вона ж альбом побажань чи гостьова книга, збереже слова й підписи гостей із весілля, хрещення, ювілею або дня народження. Обирай розмір, колір сторінок і матеріал твердої обкладинки, а імена та дату ми винесемо на неї. Доставка по всій Україні.',

  translations = coalesce(translations, '{}'::jsonb) || jsonb_build_object(
    'en', coalesce(translations->'en', '{}'::jsonb) || jsonb_build_object(
      'description', 'A guest book, also called a wish book or a wish album, keeps the words and signatures of everyone who came to a wedding, a christening, an anniversary or a birthday. Choose the size, the page colour and the hard cover material, and we put the names and the date on it.'),
    'pl', coalesce(translations->'pl', '{}'::jsonb) || jsonb_build_object(
      'description', 'Księga gości, nazywana też księgą życzeń albo albumem życzeń, zachowa słowa i podpisy wszystkich, którzy przyszli na wesele, chrzciny, jubileusz lub urodziny. Wybierz format, kolor stron i materiał twardej oprawy, a imiona i datę umieścimy na niej.'),
    'ro', coalesce(translations->'ro', '{}'::jsonb) || jsonb_build_object(
      'description', 'Cartea de oaspeți, numită și carte de urări sau album de urări, păstrează cuvintele și semnăturile tuturor celor veniți la nuntă, botez, aniversare sau zi de naștere. Alege formatul, culoarea paginilor și materialul copertei tari, iar numele și data le punem noi pe ea.'),
    'de', coalesce(translations->'de', '{}'::jsonb) || jsonb_build_object(
      'description', 'Ein Gästebuch, auch Wunschbuch oder Wunschalbum genannt, bewahrt die Worte und Unterschriften aller, die zur Hochzeit, zur Taufe, zum Jubiläum oder zum Geburtstag gekommen sind. Wähle Format, Seitenfarbe und Material des harten Einbands, Namen und Datum setzen wir darauf.')
  )

WHERE slug = 'guestbooks';
