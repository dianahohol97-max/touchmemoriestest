-- SEO rewrite of both photo puzzles (products.slug = 'puzzle-a5' and
-- 'puzzle-20x30'), plus a data correction on the A5 row.
--
-- ── The data bug, found while auditing ──────────────────────────────────────
--
-- products.slug = 'puzzle-a5' described two different products at once. Its
-- name, description and options all agreed on A5, 15×21 cm, 35 or 60 pieces —
-- but its specs table said «Деталей 120» and «Формат A4 (21×30 см)», and ALL
-- FOUR non-Ukrainian locales carried name «Puzzle A4» with «120 pieces, A4
-- format». So a customer on /en read that they were buying a 120-piece A4
-- puzzle, while the configurator sold them an A5 with 35 or 60 pieces.
--
-- The row was evidently copied from an older A4/120 product and only the
-- Ukrainian fields were updated. Corrected here to match `options`, which is
-- what the customer actually configures and pays for — two of the three
-- Ukrainian sources already agreed with it. If 120 pieces is a real variant
-- that got dropped rather than a leftover, this needs a product decision, not
-- another data patch.
--
-- ── The SEO problems ────────────────────────────────────────────────────────
--
--   1. The bodies were 116 and 134 characters. Not thin — effectively absent.
--   2. The word «фотопазл» appeared only on the 20×30 product and was missing
--      from the A5 one, which is the active, popular row of the two.
--   3. Missing from both: «пазли з фото» in the plural, «пазл по фото» (how
--      puzzlean.com.ua, puzzleok.com.ua and thegravix.ua title their pages),
--      «пазл на замовлення», «персоналізований пазл», «іменний пазл».
--   4. No occasion words at all — no birthday, no gift for a child — on a
--      product that is bought almost exclusively as a present.
--   5. The pair used different head words, «Пазл А5» against «Фотопазл А4», so
--      they read as unrelated items instead of two sizes of one product. Both
--      meta titles now open with «Фотопазл» and split on size and piece count.
--   6. Neither had meta_title or meta_description in any non-Ukrainian locale,
--      and 'puzzle-20x30' had no specs at all.
--
-- Deliberately NOT targeted: wooden puzzles, puzzles in wooden boxes and
-- magnetic-backed puzzles. That is where puzzle.in.ua, puzzleok.com.ua and
-- aspect.ink sit, we print on cardboard, and that traffic would bounce.
--
-- On «А4» in the 20×30 title: 20×30 cm is not literally A4 (210×297 mm). The
-- shorthand is kept in the title because it is a real query and the trade uses
-- it loosely, but every body text states the exact 20×30 cm so nobody is misled.
-- Renaming products.name is a separate decision — it shows in carts and orders.
--
-- Piece-count-to-age lines are written as orientation («орієнтовно»), matching
-- ordinary retail practice, not as a certified age rating.
--
-- Copy rules applied (CLAUDE.md + brand guide v1.1): "ти" not "Ви", no bullet
-- lists, no one- or two-word sentences, brand written as touch.memories.
--
-- Prices named in the copy match products.price and products.options as of this
-- migration: A5 249 ₴, 20×30 349 ₴, matte or glossy coating +20 ₴. Only the
-- Ukrainian text names hryvnia, because other locales bill in EUR with markup.

-- ── A5 puzzle ────────────────────────────────────────────────────────────────

UPDATE products SET

  meta_title = 'Фотопазл А5 з фото — 35 або 60 деталей',

  meta_description = 'Фотопазл А5 15×21 см із твоїм фото, на вибір 35 або 60 деталей. Друк на щільному картоні, коробка в комплекті, готовність 1–3 дні. 249 ₴.',

  short_description = 'Пазл із твоєю фотографією у форматі А5. Обираєш 35 деталей для малечі або 60 для тих, хто вже складає впевнено, і картонна коробка їде разом із ним.',

  sku = 'TM-PZL-A5',

  description =
'<p>Фотопазл — це звичайний пазл, тільки картинка на ньому твоя. Ми друкуємо вибране фото на щільному картоні, ріжемо на деталі та кладемо в картонну коробку, тож подарунок приїжджає готовим до вручення. Формат А5, тобто 15×21 сантиметр, і на вибір 35 або 60 деталей. Такий пазл шукають як пазл з фото, пазл по фото або персоналізований пазл на замовлення, і мова про одну й ту саму річ.</p>

<h2>Скільки деталей обрати</h2>
<p>Тридцять пʼять деталей орієнтовно підходять дошкільнятам, бо кожен шматочок великий, добре тримається в маленьких пальцях і картинка складається за кілька хвилин без сліз. Шістдесят деталей беруть тоді, коли дитина вже впевнено складає готові набори з магазину, або коли пазл їде дорослому як маленький сувенір на робочий стіл. Різниці в ціні між ними немає, тож дивись на того, кому даруєш, а не на бюджет.</p>

<h2>Яке фото підійде</h2>
<p>Найкраще працюють знімки, де є одне велике обличчя або чіткий головний обʼєкт, бо саме за нього чіпляється око, коли деталі перемішані. Групове фото з десятьма маленькими фігурами складати нудно, адже половина деталей виглядає однаково. Надсилай оригінал з телефону чи камери, а не пересланий у месенджері файл, бо месенджери стискають фото, і на друці це видно.</p>

<h2>Кому його дарують</h2>
<p>Найчастіше це подарунок дитині на день народження, і тоді на пазлі опиняється вона сама, її улюблена іграшка або вся родина. Дорослим такий пазл дарують на річницю стосунків чи просто без приводу, і сенс тут у самому процесі, бо фото відкривається поступово. Його беруть і як спосіб оголосити новину, коли складена картинка показує знімок з УЗД або дату, і людина дізнається про подію тільки після останньої деталі.</p>

<h2>Часті питання про фотопазл</h2>

<h3>Чи міцний картон</h3>
<p>Деталі вирізані зі щільного картону, тримають форму і не розшаровуються від складання. За бажання можна додати матове або глянцеве покриття за 20 ₴, і тоді друк не боїться вологих пальців, а матове ще й не відблискує під лампою.</p>

<h3>Чи є коробка</h3>
<p>Так, картонна коробка входить у комплект і на неї теж можна винести те саме фото. Це важливо саме для подарунка, бо пазл у пакеті і пазл у коробці справляють зовсім різне враження.</p>

<h3>Скільки часу займає виготовлення</h3>
<p>Від одного до трьох робочих днів, далі доставка Новою поштою по Україні. Це один із найшвидших товарів у нас, тому пазл реально встигнути замовити за тиждень до дати.</p>

<h3>Чи можна замовити кілька однакових</h3>
<p>Можна, і це часта історія для дитячих свят, коли пазл роздають гостям замість цукерок. Напиши нам кількість, і ми порахуємо разом.</p>

<p>Якщо потрібен більший, подивись <a href="/uk/catalog/puzzle-20x30">фотопазл 20×30 см</a>, а решта зібрана в розділі <a href="/uk/category/pazly">Пазли</a>.</p>',

  specs = '[
    {"label":"Формат","label_en":"Size","label_pl":"Format","label_ro":"Format","label_de":"Format","value":"А5 (15×21 см)","value_en":"A5 (15×21 cm)","value_pl":"A5 (15×21 cm)","value_ro":"A5 (15×21 cm)","value_de":"A5 (15×21 cm)"},
    {"label":"Деталей","label_en":"Pieces","label_pl":"Elementów","label_ro":"Piese","label_de":"Teile","value":"35 або 60","value_en":"35 or 60","value_pl":"35 lub 60","value_ro":"35 sau 60","value_de":"35 oder 60"},
    {"label":"Матеріал","label_en":"Material","label_pl":"Materiał","label_ro":"Material","label_de":"Material","value":"Щільний картон","value_en":"Heavy cardboard","value_pl":"Gruby karton","value_ro":"Carton dens","value_de":"Fester Karton"},
    {"label":"Покриття","label_en":"Coating","label_pl":"Powłoka","label_ro":"Finisaj","label_de":"Beschichtung","value":"Без покриття, матове або глянцеве","value_en":"None, matte or glossy","value_pl":"Brak, matowa lub błyszcząca","value_ro":"Fără, mat sau lucios","value_de":"Ohne, matt oder glänzend"},
    {"label":"Комплект","label_en":"Included","label_pl":"W zestawie","label_ro":"Include","label_de":"Im Set","value":"Картонна коробка","value_en":"Cardboard box","value_pl":"Kartonowe pudełko","value_ro":"Cutie de carton","value_de":"Kartonbox"},
    {"label":"Виготовлення","label_en":"Production","label_pl":"Realizacja","label_ro":"Producție","label_de":"Herstellung","value":"1–3 робочих дні","value_en":"1–3 working days","value_pl":"1–3 dni robocze","value_ro":"1–3 zile lucrătoare","value_de":"1–3 Werktage"}
  ]'::jsonb,

  translations = jsonb_build_object(

    'en', jsonb_build_object(
      'name', 'Photo Puzzle A5',
      'meta_title', 'A5 Photo Puzzle — 35 or 60 Pieces',
      'meta_description', 'An A5 photo puzzle, 15×21 cm, printed from your own photo, with a choice of 35 or 60 pieces. Heavy cardboard, box included, ready in one to three days.',
      'short_description', 'A puzzle made from your photograph in A5 format. Choose 35 pieces for a small child or 60 for a confident one, and the box travels with it.',
      'description',
'<p>A photo puzzle is an ordinary puzzle with your own picture on it. We print the photograph you choose on heavy cardboard, cut it into pieces and pack it in a cardboard box, so the present arrives ready to hand over. The format is A5, which is 15×21 cm, with a choice of 35 or 60 pieces.</p>

<h2>How many pieces to choose</h2>
<p>Thirty-five pieces suit a preschooler as a rough guide, because each piece is large, sits well in small fingers and the picture comes together in a few minutes without tears. Sixty pieces are for a child who already handles shop-bought sets confidently, or for an adult receiving the puzzle as a small keepsake for a desk. There is no price difference between them, so choose by the person rather than by the budget.</p>

<h2>Which photograph works</h2>
<p>Pictures with one large face or one clear main subject work best, because that is what the eye latches onto once the pieces are mixed. A group photo with ten small figures is dull to assemble, since half the pieces look alike. Send the original from your phone or camera rather than a file forwarded through a messenger, because messengers compress photographs and it shows in print.</p>

<h2>Who it is given to</h2>
<p>Most often it is a birthday present for a child, and then the puzzle carries the child, a favourite toy or the whole family. Adults receive one for a relationship anniversary or for no occasion at all, and the point is the process, because the photograph reveals itself slowly. It is also used to announce news, when the finished picture turns out to be a scan or a date and the person only learns of it after the last piece.</p>

<h2>Frequently asked questions</h2>

<h3>Is the cardboard sturdy</h3>
<p>The pieces are cut from heavy cardboard, hold their shape and do not delaminate with handling. A matte or glossy coating can be added, and then the print shrugs off damp fingers, while matte also keeps the surface from catching lamplight.</p>

<h3>Is a box included</h3>
<p>Yes, a cardboard box comes with it and can carry the same photograph. That matters for a present, because a puzzle in a bag and a puzzle in a box make very different impressions.</p>

<h3>How long does it take to make</h3>
<p>One to three working days, then delivery. This is one of the fastest things we make, so a puzzle really can be ordered a week before the date.</p>

<h3>Can I order several identical ones</h3>
<p>You can, and it is a common request for children''s parties, where puzzles are handed to guests instead of sweets. Tell us the quantity and we will work it out together.</p>

<p>If you need a bigger one, look at the <a href="/en/catalog/puzzle-20x30">20×30 cm photo puzzle</a>, and the rest sit in the <a href="/en/category/pazly">Puzzles</a> section.</p>'
    ),

    'pl', jsonb_build_object(
      'name', 'Fotopuzzle A5',
      'meta_title', 'Fotopuzzle A5 ze zdjęciem — 35 lub 60 elementów',
      'meta_description', 'Fotopuzzle A5 15×21 cm z Twoim zdjęciem, do wyboru 35 lub 60 elementów. Gruby karton, pudełko w zestawie, gotowe w jeden do trzech dni.',
      'short_description', 'Puzzle z Twoim zdjęciem w formacie A5. Wybierasz 35 elementów dla malucha albo 60 dla kogoś, kto składa już pewnie, a pudełko jedzie razem z nimi.',
      'description',
'<p>Fotopuzzle to zwykłe puzzle, tylko obrazek na nich jest Twój. Drukujemy wybrane zdjęcie na grubym kartonie, tniemy na elementy i pakujemy w kartonowe pudełko, więc prezent przyjeżdża gotowy do wręczenia. Format A5, czyli 15×21 cm, do wyboru 35 albo 60 elementów.</p>

<h2>Ile elementów wybrać</h2>
<p>Trzydzieści pięć elementów orientacyjnie pasuje przedszkolakowi, bo każdy kawałek jest duży, dobrze trzyma się w małych palcach, a obrazek składa się w kilka minut bez łez. Sześćdziesiąt bierze się wtedy, gdy dziecko pewnie radzi sobie z gotowymi zestawami ze sklepu, albo gdy puzzle jadą do dorosłego jako mała pamiątka na biurko. Różnicy w cenie nie ma, więc patrz na osobę, a nie na budżet.</p>

<h2>Jakie zdjęcie się nada</h2>
<p>Najlepiej działają kadry z jedną dużą twarzą albo wyraźnym głównym obiektem, bo właśnie o niego zaczepia się oko, kiedy elementy są wymieszane. Zdjęcie grupowe z dziesięcioma małymi postaciami składa się nudno, bo połowa elementów wygląda tak samo. Przyślij oryginał z telefonu albo aparatu, a nie plik przesłany komunikatorem, bo komunikatory kompresują zdjęcia i w druku to widać.</p>

<h2>Komu się je daruje</h2>
<p>Najczęściej to prezent urodzinowy dla dziecka, a wtedy na puzzlach ląduje ono samo, ulubiona zabawka albo cała rodzina. Dorośli dostają je na rocznicę związku albo zupełnie bez okazji, a sens tkwi w samym składaniu, bo zdjęcie odsłania się powoli. Używa się ich też do ogłoszenia nowiny, gdy złożony obrazek okazuje się zdjęciem USG albo datą, a osoba dowiaduje się dopiero po ostatnim elemencie.</p>

<h2>Najczęstsze pytania</h2>

<h3>Czy karton jest wytrzymały</h3>
<p>Elementy są wycięte z grubego kartonu, trzymają kształt i nie rozwarstwiają się przy składaniu. Można dodać powłokę matową albo błyszczącą, i wtedy druk nie boi się wilgotnych palców, a mat dodatkowo nie odbija światła lampy.</p>

<h3>Czy pudełko jest w zestawie</h3>
<p>Tak, kartonowe pudełko wchodzi w skład zestawu i można na nim umieścić to samo zdjęcie. Przy prezencie to ma znaczenie, bo puzzle w woreczku i puzzle w pudełku robią zupełnie inne wrażenie.</p>

<h3>Ile trwa realizacja</h3>
<p>Od jednego do trzech dni roboczych, potem dostawa. To jedna z najszybszych rzeczy, jakie robimy, więc puzzle naprawdę da się zamówić tydzień przed terminem.</p>

<h3>Czy mogę zamówić kilka takich samych</h3>
<p>Można, i jest to częsta prośba przy dziecięcych przyjęciach, gdzie puzzle rozdaje się gościom zamiast słodyczy. Napisz nam ilość, a policzymy to razem.</p>

<p>Jeśli potrzebujesz większych, zobacz <a href="/pl/catalog/puzzle-20x30">fotopuzzle 20×30 cm</a>, a reszta jest w dziale <a href="/pl/category/pazly">Puzzle</a>.</p>'
    ),

    'ro', jsonb_build_object(
      'name', 'Puzzle Foto A5',
      'meta_title', 'Puzzle foto A5 — 35 sau 60 de piese',
      'meta_description', 'Puzzle foto A5 de 15×21 cm cu fotografia ta, la alegere 35 sau 60 de piese. Carton dens, cutie inclusă, gata în una până la trei zile.',
      'short_description', 'Puzzle cu fotografia ta în format A5. Alegi 35 de piese pentru cel mic sau 60 pentru cineva care asamblează deja sigur, iar cutia vine odată cu el.',
      'description',
'<p>Puzzle-ul foto este un puzzle obișnuit, doar că imaginea de pe el este a ta. Tipărim fotografia aleasă pe carton dens, o tăiem în piese și o punem într-o cutie de carton, așa că darul ajunge gata de oferit. Formatul este A5, adică 15×21 cm, cu 35 sau 60 de piese la alegere.</p>

<h2>Câte piese să alegi</h2>
<p>Treizeci și cinci de piese se potrivesc orientativ unui preșcolar, fiindcă fiecare bucată este mare, stă bine în degete mici, iar imaginea se închide în câteva minute fără lacrimi. Șaizeci se aleg atunci când copilul se descurcă deja sigur cu seturile din magazin, sau când puzzle-ul merge la un adult ca mică amintire pentru birou. Diferență de preț nu există, așa că uită-te la persoană, nu la buget.</p>

<h2>Ce fotografie merge</h2>
<p>Funcționează cel mai bine cadrele cu un chip mare sau cu un subiect principal clar, fiindcă de el se agață ochiul când piesele sunt amestecate. O fotografie de grup cu zece siluete mici se asamblează plictisitor, pentru că jumătate dintre piese arată la fel. Trimite originalul din telefon sau din aparat, nu un fișier redirecționat prin messenger, fiindcă mesageria comprimă fotografiile și la tipar se vede.</p>

<h2>Cui i se dăruiește</h2>
<p>Cel mai des este un cadou de zi de naștere pentru un copil, iar atunci pe puzzle ajunge el însuși, jucăria preferată sau toată familia. Adulții îl primesc la aniversarea relației sau fără nicio ocazie, iar sensul stă în proces, fiindcă fotografia se dezvăluie încet. Se folosește și pentru a anunța o veste, când imaginea terminată se dovedește a fi o ecografie sau o dată, iar persoana află abia după ultima piesă.</p>

<h2>Întrebări frecvente</h2>

<h3>Este cartonul rezistent</h3>
<p>Piesele sunt tăiate din carton dens, își țin forma și nu se desfac în straturi la asamblare. Se poate adăuga un finisaj mat sau lucios, și atunci tiparul nu se teme de degete umede, iar cel mat nu prinde nici lumina lămpii.</p>

<h3>Cutia este inclusă</h3>
<p>Da, cutia de carton vine în set și poate purta aceeași fotografie. Pentru un cadou asta contează, fiindcă un puzzle într-o pungă și unul într-o cutie fac impresii complet diferite.</p>

<h3>Cât durează realizarea</h3>
<p>Între una și trei zile lucrătoare, apoi livrarea. Este unul dintre cele mai rapide lucruri pe care le facem, așa că puzzle-ul chiar poate fi comandat cu o săptămână înainte.</p>

<h3>Pot comanda mai multe identice</h3>
<p>Se poate, și este o cerere frecventă pentru petrecerile copiilor, unde puzzle-urile se împart invitaților în loc de dulciuri. Scrie-ne cantitatea și socotim împreună.</p>

<p>Dacă îți trebuie unul mai mare, vezi <a href="/ro/catalog/puzzle-20x30">puzzle-ul foto de 20×30 cm</a>, iar restul se află în secțiunea <a href="/ro/category/pazly">Puzzle-uri</a>.</p>'
    ),

    'de', jsonb_build_object(
      'name', 'Fotopuzzle A5',
      'meta_title', 'Fotopuzzle A5 — 35 oder 60 Teile',
      'meta_description', 'Fotopuzzle A5 mit 15×21 cm aus deinem eigenen Foto, wahlweise 35 oder 60 Teile. Fester Karton, Box inklusive, fertig in ein bis drei Tagen.',
      'short_description', 'Ein Puzzle aus deinem Foto im A5-Format. Du wählst 35 Teile für ein kleines Kind oder 60 für ein geübtes, und die Box reist mit.',
      'description',
'<p>Ein Fotopuzzle ist ein ganz normales Puzzle, nur mit deinem eigenen Bild darauf. Wir drucken das gewählte Foto auf festen Karton, schneiden es in Teile und legen es in eine Kartonbox, sodass das Geschenk fertig zum Überreichen ankommt. Das Format ist A5, also 15×21 cm, wahlweise mit 35 oder 60 Teilen.</p>

<h2>Wie viele Teile du wählen solltest</h2>
<p>Fünfunddreißig Teile passen als grobe Orientierung zu einem Vorschulkind, weil jedes Teil groß ist, gut in kleinen Fingern liegt und das Bild in wenigen Minuten ohne Tränen zusammenkommt. Sechzig nimmt man, wenn ein Kind mit gekauften Sets schon sicher umgeht, oder wenn das Puzzle als kleines Andenken für den Schreibtisch an einen Erwachsenen geht. Ein Preisunterschied besteht nicht, richte dich also nach der Person und nicht nach dem Budget.</p>

<h2>Welches Foto sich eignet</h2>
<p>Am besten wirken Aufnahmen mit einem großen Gesicht oder einem klaren Hauptmotiv, denn genau daran hält sich das Auge fest, sobald die Teile gemischt sind. Ein Gruppenfoto mit zehn kleinen Figuren legt sich langweilig, weil die Hälfte der Teile gleich aussieht. Schick das Original vom Handy oder aus der Kamera und keine über einen Messenger weitergeleitete Datei, denn Messenger komprimieren Fotos, und im Druck sieht man das.</p>

<h2>Wem man es schenkt</h2>
<p>Meistens ist es ein Geburtstagsgeschenk für ein Kind, und dann landet es selbst, sein Lieblingsspielzeug oder die ganze Familie auf dem Puzzle. Erwachsene bekommen eines zum Jahrestag oder ganz ohne Anlass, und der Sinn liegt im Zusammenlegen, weil sich das Foto langsam zeigt. Man nutzt es auch, um Neuigkeiten zu verkünden, wenn das fertige Bild ein Ultraschallbild oder ein Datum zeigt und der Mensch es erst nach dem letzten Teil erfährt.</p>

<h2>Häufige Fragen</h2>

<h3>Ist der Karton stabil</h3>
<p>Die Teile sind aus festem Karton geschnitten, halten ihre Form und lösen sich beim Legen nicht in Schichten auf. Eine matte oder glänzende Beschichtung lässt sich ergänzen, dann macht dem Druck auch eine feuchte Hand nichts aus, und matt fängt zusätzlich kein Lampenlicht ein.</p>

<h3>Ist eine Box dabei</h3>
<p>Ja, eine Kartonbox gehört dazu und kann dasselbe Foto tragen. Bei einem Geschenk zählt das, denn ein Puzzle im Beutel und eines in der Box hinterlassen einen völlig anderen Eindruck.</p>

<h3>Wie lange dauert die Herstellung</h3>
<p>Ein bis drei Werktage, danach der Versand. Das ist eines der schnellsten Dinge bei uns, ein Puzzle lässt sich also tatsächlich eine Woche vor dem Termin bestellen.</p>

<h3>Kann ich mehrere gleiche bestellen</h3>
<p>Ja, und bei Kindergeburtstagen ist das eine häufige Bitte, wo Puzzles statt Süßigkeiten an die Gäste gehen. Schreib uns die Stückzahl, und wir rechnen es gemeinsam durch.</p>

<p>Brauchst du ein größeres, sieh dir das <a href="/de/catalog/puzzle-20x30">Fotopuzzle 20×30 cm</a> an, der Rest steht im Bereich <a href="/de/category/pazly">Puzzles</a>.</p>'
    )
  ),

  updated_at = NOW()

WHERE slug = 'puzzle-a5';

-- ── 20×30 puzzle ─────────────────────────────────────────────────────────────

UPDATE products SET

  meta_title = 'Фотопазл А4 з фото — 24 або 104 деталі',

  meta_description = 'Фотопазл 20×30 см із твоїм фото, на вибір 24 або 104 деталі. Щільний картон, матове чи глянцеве покриття, готовність 1–3 дні. 349 ₴.',

  short_description = 'Пазл 20×30 см із твоєю фотографією. Обираєш 24 деталі для швидкого складання або 104 для довгого вечора, а покриття захищає друк від пальців.',

  sku = 'TM-PZL-A4',

  status = 'active',

  description =
'<p>Це той самий фотопазл, тільки більший: 20×30 сантиметрів проти А5, тому фото на ньому читається з відстані і пазл не губиться на столі. Друкуємо твій знімок на щільному картоні й ріжемо на 24 або 104 деталі, а орієнтацію обираєш сам, вертикальну чи горизонтальну, під те, як зроблено кадр. Шукають його як фотопазл, пазл з фото, пазл по фото або пазл на замовлення.</p>

<h2>Двадцять чотири чи сто чотири</h2>
<p>Двадцять чотири деталі на такому форматі виходять великими, і це варіант для найменших або для тих випадків, коли пазл має скластися швидко просто зараз. Сто чотири деталі перетворюють його на нормальне заняття на вечір, з яким доросла людина сидітиме годину, і саме цей варіант беруть частіше. Ціна однакова, різниця тільки в тому, скільки часу ти хочеш подарувати разом із картинкою.</p>

<h2>Яке фото підійде</h2>
<p>Великий формат прощає більше, ніж А5, тому тут добре працюють і портрети, і пейзажі, і кадри з поїздки. Уникай тільки знімків, де половину площі займає рівне небо чи однотонна стіна, бо такі ділянки складати нецікаво, і саме на них пазл зазвичай кидають. Надсилай оригінальний файл, бо стиснуте месенджером фото на форматі 20×30 виглядає помітно гірше.</p>

<h2>Покриття і навіщо воно</h2>
<p>Без покриття пазл коштує дешевше і виглядає матово-натурально. Матове покриття за 20 ₴ додає стійкості до пальців і не відблискує під лампою, а глянцеве робить кольори насиченішими і темніші ділянки глибшими. Для дитячого пазла, який складатимуть часто, покриття справді має сенс, для сувеніра на полицю не обовʼязкове.</p>

<h2>Часті питання</h2>

<h3>Чи є коробка</h3>
<p>Так, пазл їде в картонній коробці, тому його можна дарувати без додаткового пакування.</p>

<h3>Скільки часу займає виготовлення</h3>
<p>Від одного до трьох робочих днів, далі доставка Новою поштою. Це швидкий товар, тож він встигає навіть тоді, коли про подарунок згадали в останній момент.</p>

<h3>Чим він відрізняється від дерев''яного пазла</h3>
<p>Наш пазл картонний, а не дерев''яний. Картон легший, тонший і дешевший, деталі в нього класичної форми, і саме на картоні друк виходить найточнішим за кольором. Дерев''яних пазлів ми не робимо, тому якщо принципово потрібне дерево, ми чесно не той варіант.</p>

<p>Менший формат лежить поруч, це <a href="/uk/catalog/puzzle-a5">фотопазл А5</a>, а вся категорія зібрана в розділі <a href="/uk/category/pazly">Пазли</a>.</p>',

  specs = '[
    {"label":"Формат","label_en":"Size","label_pl":"Format","label_ro":"Format","label_de":"Format","value":"20×30 см або 30×20 см","value_en":"20×30 cm or 30×20 cm","value_pl":"20×30 cm lub 30×20 cm","value_ro":"20×30 cm sau 30×20 cm","value_de":"20×30 cm oder 30×20 cm"},
    {"label":"Деталей","label_en":"Pieces","label_pl":"Elementów","label_ro":"Piese","label_de":"Teile","value":"24 або 104","value_en":"24 or 104","value_pl":"24 lub 104","value_ro":"24 sau 104","value_de":"24 oder 104"},
    {"label":"Матеріал","label_en":"Material","label_pl":"Materiał","label_ro":"Material","label_de":"Material","value":"Щільний картон","value_en":"Heavy cardboard","value_pl":"Gruby karton","value_ro":"Carton dens","value_de":"Fester Karton"},
    {"label":"Покриття","label_en":"Coating","label_pl":"Powłoka","label_ro":"Finisaj","label_de":"Beschichtung","value":"Без покриття, матове або глянцеве","value_en":"None, matte or glossy","value_pl":"Brak, matowa lub błyszcząca","value_ro":"Fără, mat sau lucios","value_de":"Ohne, matt oder glänzend"},
    {"label":"Комплект","label_en":"Included","label_pl":"W zestawie","label_ro":"Include","label_de":"Im Set","value":"Картонна коробка","value_en":"Cardboard box","value_pl":"Kartonowe pudełko","value_ro":"Cutie de carton","value_de":"Kartonbox"},
    {"label":"Виготовлення","label_en":"Production","label_pl":"Realizacja","label_ro":"Producție","label_de":"Herstellung","value":"1–3 робочих дні","value_en":"1–3 working days","value_pl":"1–3 dni robocze","value_ro":"1–3 zile lucrătoare","value_de":"1–3 Werktage"}
  ]'::jsonb,

  translations = jsonb_build_object(

    'en', jsonb_build_object(
      'name', 'Photo Puzzle 20×30 cm',
      'meta_title', 'Photo Puzzle 20×30 cm — 24 or 104 Pieces',
      'meta_description', 'A 20×30 cm photo puzzle printed from your own photo, with a choice of 24 or 104 pieces. Heavy cardboard, matte or glossy coating, ready in one to three days.',
      'short_description', 'A 20×30 cm puzzle made from your photograph. Choose 24 pieces for a quick assembly or 104 for a long evening, and a coating protects the print.',
      'description',
'<p>This is the same photo puzzle, only larger: 20×30 centimetres against A5, so the picture reads from a distance and the puzzle does not get lost on a table. We print your shot on heavy cardboard and cut it into 24 or 104 pieces, and you pick the orientation, upright or landscape, to match how the frame was taken.</p>

<h2>Twenty-four or a hundred and four</h2>
<p>Twenty-four pieces come out large at this size, which suits the youngest children or any occasion where the puzzle has to come together quickly. A hundred and four turns it into a proper evening''s occupation that an adult will sit with for an hour, and this is the option people take more often. The price is the same, so the only difference is how much time you want to give along with the picture.</p>

<h2>Which photograph works</h2>
<p>The large format forgives more than A5 does, so portraits, landscapes and travel shots all work here. Avoid only pictures where half the area is flat sky or a plain wall, because those stretches are dull to assemble and that is exactly where a puzzle gets abandoned. Send the original file, because a photograph compressed by a messenger looks noticeably worse at 20×30.</p>

<h2>The coating and what it is for</h2>
<p>Without a coating the puzzle costs less and looks naturally matte. A matte coating adds resistance to fingers and keeps the surface from catching lamplight, while a glossy one makes colours richer and dark areas deeper. For a child''s puzzle that will be assembled often a coating genuinely helps; for a keepsake on a shelf it is optional.</p>

<h2>Frequently asked questions</h2>

<h3>Is a box included</h3>
<p>Yes, the puzzle travels in a cardboard box, so it can be given without any extra wrapping.</p>

<h3>How long does it take to make</h3>
<p>One to three working days, then delivery. It is a fast product, so it makes it even when the present was remembered at the last moment.</p>

<h3>How does it differ from a wooden puzzle</h3>
<p>Ours is cardboard rather than wood. Cardboard is lighter, thinner and cheaper, its pieces have the classic shape, and print colour comes out most accurately on it. We do not make wooden puzzles, so if wood is essential we are honestly not the right choice.</p>

<p>The smaller format sits alongside it as the <a href="/en/catalog/puzzle-a5">A5 photo puzzle</a>, and the whole category is in the <a href="/en/category/pazly">Puzzles</a> section.</p>'
    ),

    'pl', jsonb_build_object(
      'name', 'Fotopuzzle 20×30 cm',
      'meta_title', 'Fotopuzzle 20×30 cm — 24 lub 104 elementy',
      'meta_description', 'Fotopuzzle 20×30 cm z Twoim zdjęciem, do wyboru 24 lub 104 elementy. Gruby karton, powłoka matowa lub błyszcząca, gotowe w jeden do trzech dni.',
      'short_description', 'Puzzle 20×30 cm z Twoim zdjęciem. Wybierasz 24 elementy na szybkie składanie albo 104 na długi wieczór, a powłoka chroni druk przed palcami.',
      'description',
'<p>To te same fotopuzzle, tylko większe: 20×30 centymetrów zamiast A5, więc zdjęcie czyta się z odległości, a puzzle nie giną na stole. Drukujemy Twój kadr na grubym kartonie i tniemy na 24 albo 104 elementy, a orientację wybierasz sam, pionową lub poziomą, pod to, jak zrobione jest zdjęcie.</p>

<h2>Dwadzieścia cztery czy sto cztery</h2>
<p>Dwadzieścia cztery elementy wychodzą w tym formacie duże i to wariant dla najmłodszych albo na sytuacje, gdy puzzle mają złożyć się szybko. Sto cztery zamieniają je w porządne zajęcie na wieczór, przy którym dorosły posiedzi godzinę, i to je bierze się częściej. Cena jest ta sama, więc różnica polega tylko na tym, ile czasu chcesz podarować razem z obrazkiem.</p>

<h2>Jakie zdjęcie się nada</h2>
<p>Duży format wybacza więcej niż A5, więc sprawdzają się tu i portrety, i pejzaże, i kadry z podróży. Unikaj tylko zdjęć, gdzie połowę powierzchni zajmuje gładkie niebo albo jednolita ściana, bo takie fragmenty składa się nudno i właśnie na nich puzzle się porzuca. Przyślij oryginalny plik, bo zdjęcie skompresowane przez komunikator przy 20×30 wygląda zauważalnie gorzej.</p>

<h2>Powłoka i po co ona</h2>
<p>Bez powłoki puzzle kosztują mniej i wyglądają naturalnie matowo. Powłoka matowa dodaje odporności na palce i nie odbija światła lampy, a błyszcząca robi kolory bardziej nasyconymi, a ciemne partie głębszymi. Przy dziecięcych puzzlach, które będą składane często, powłoka naprawdę ma sens, przy pamiątce na półkę jest opcjonalna.</p>

<h2>Najczęstsze pytania</h2>

<h3>Czy pudełko jest w zestawie</h3>
<p>Tak, puzzle jadą w kartonowym pudełku, więc można je wręczyć bez dodatkowego pakowania.</p>

<h3>Ile trwa realizacja</h3>
<p>Od jednego do trzech dni roboczych, potem dostawa. To szybki produkt, więc zdąży nawet wtedy, gdy o prezencie przypomniało się w ostatniej chwili.</p>

<h3>Czym różnią się od puzzli drewnianych</h3>
<p>Nasze są kartonowe, nie drewniane. Karton jest lżejszy, cieńszy i tańszy, elementy mają klasyczny kształt, a druk wychodzi na nim najwierniej kolorystycznie. Drewnianych puzzli nie robimy, więc jeśli drewno jest konieczne, uczciwie nie jesteśmy tym wyborem.</p>

<p>Mniejszy format leży obok jako <a href="/pl/catalog/puzzle-a5">fotopuzzle A5</a>, a cała kategoria jest w dziale <a href="/pl/category/pazly">Puzzle</a>.</p>'
    ),

    'ro', jsonb_build_object(
      'name', 'Puzzle Foto 20×30 cm',
      'meta_title', 'Puzzle foto 20×30 cm — 24 sau 104 piese',
      'meta_description', 'Puzzle foto de 20×30 cm cu fotografia ta, la alegere 24 sau 104 piese. Carton dens, finisaj mat sau lucios, gata în una până la trei zile.',
      'short_description', 'Puzzle de 20×30 cm cu fotografia ta. Alegi 24 de piese pentru o asamblare rapidă sau 104 pentru o seară lungă, iar finisajul protejează tiparul.',
      'description',
'<p>Este același puzzle foto, doar mai mare: 20×30 centimetri față de A5, așa că fotografia se citește de la distanță și puzzle-ul nu se pierde pe masă. Îți tipărim cadrul pe carton dens și îl tăiem în 24 sau 104 piese, iar orientarea o alegi tu, verticală sau orizontală, după cum a fost făcută poza.</p>

<h2>Douăzeci și patru sau o sută patru</h2>
<p>Douăzeci și patru de piese ies mari la acest format și este varianta pentru cei mai mici sau pentru situațiile în care puzzle-ul trebuie să se închege repede. O sută patru îl transformă într-o ocupație serioasă de seară, la care un adult stă o oră, și tocmai aceasta se ia mai des. Prețul este același, deci diferența ține doar de cât timp vrei să dăruiești odată cu imaginea.</p>

<h2>Ce fotografie merge</h2>
<p>Formatul mare iartă mai mult decât A5, așa că merg și portretele, și peisajele, și cadrele din călătorii. Evită doar imaginile în care jumătate din suprafață este cer uniform sau un perete simplu, fiindcă zonele acelea se asamblează plictisitor și exact acolo se abandonează puzzle-ul. Trimite fișierul original, pentru că o fotografie comprimată de messenger arată vizibil mai slab la 20×30.</p>

<h2>Finisajul și la ce folosește</h2>
<p>Fără finisaj puzzle-ul costă mai puțin și arată mat, natural. Finisajul mat adaugă rezistență la atingere și nu prinde lumina lămpii, iar cel lucios face culorile mai saturate și zonele întunecate mai adânci. Pentru un puzzle de copil, care va fi asamblat des, finisajul chiar ajută; pentru o amintire de raft este opțional.</p>

<h2>Întrebări frecvente</h2>

<h3>Cutia este inclusă</h3>
<p>Da, puzzle-ul călătorește într-o cutie de carton, deci poate fi oferit fără ambalaj suplimentar.</p>

<h3>Cât durează realizarea</h3>
<p>Între una și trei zile lucrătoare, apoi livrarea. Este un produs rapid, deci ajunge la timp chiar și când cadoul a fost amintit în ultimul moment.</p>

<h3>Prin ce diferă de un puzzle din lemn</h3>
<p>Al nostru este din carton, nu din lemn. Cartonul este mai ușor, mai subțire și mai ieftin, piesele au forma clasică, iar culoarea tiparului iese cel mai fidel pe el. Puzzle-uri din lemn nu facem, așa că dacă lemnul este obligatoriu, sincer nu suntem varianta potrivită.</p>

<p>Formatul mai mic stă alături ca <a href="/ro/catalog/puzzle-a5">puzzle foto A5</a>, iar toată categoria este în secțiunea <a href="/ro/category/pazly">Puzzle-uri</a>.</p>'
    ),

    'de', jsonb_build_object(
      'name', 'Fotopuzzle 20×30 cm',
      'meta_title', 'Fotopuzzle 20×30 cm — 24 oder 104 Teile',
      'meta_description', 'Fotopuzzle 20×30 cm aus deinem eigenen Foto, wahlweise 24 oder 104 Teile. Fester Karton, matte oder glänzende Beschichtung, fertig in ein bis drei Tagen.',
      'short_description', 'Ein Puzzle mit 20×30 cm aus deinem Foto. Du wählst 24 Teile für schnelles Legen oder 104 für einen langen Abend, und die Beschichtung schützt den Druck.',
      'description',
'<p>Das ist dasselbe Fotopuzzle, nur größer: 20×30 Zentimeter statt A5, sodass das Bild aus der Entfernung lesbar bleibt und das Puzzle auf dem Tisch nicht verloren geht. Wir drucken deine Aufnahme auf festen Karton und schneiden sie in 24 oder 104 Teile, und die Ausrichtung wählst du selbst, hoch oder quer, passend dazu, wie das Bild aufgenommen wurde.</p>

<h2>Vierundzwanzig oder hundertvier</h2>
<p>Vierundzwanzig Teile fallen in diesem Format groß aus, was den Jüngsten entgegenkommt oder allen Gelegenheiten, bei denen das Puzzle schnell fertig sein soll. Hundertvier machen daraus eine richtige Abendbeschäftigung, an der ein Erwachsener eine Stunde sitzt, und diese Variante wird häufiger genommen. Der Preis ist derselbe, der Unterschied liegt also nur darin, wie viel Zeit du zusammen mit dem Bild verschenken willst.</p>

<h2>Welches Foto sich eignet</h2>
<p>Das große Format verzeiht mehr als A5, deshalb funktionieren hier Porträts, Landschaften und Reiseaufnahmen gleichermaßen. Meide nur Bilder, bei denen die halbe Fläche gleichmäßiger Himmel oder eine einfarbige Wand ist, denn solche Partien legt man ungern, und genau dort bleibt ein Puzzle liegen. Schick die Originaldatei, denn ein vom Messenger komprimiertes Foto sieht bei 20×30 deutlich schlechter aus.</p>

<h2>Die Beschichtung und wozu sie dient</h2>
<p>Ohne Beschichtung kostet das Puzzle weniger und wirkt natürlich matt. Eine matte Beschichtung macht es unempfindlicher gegen Finger und fängt kein Lampenlicht ein, eine glänzende lässt Farben satter und dunkle Bereiche tiefer erscheinen. Bei einem Kinderpuzzle, das oft gelegt wird, hilft die Beschichtung wirklich, bei einem Andenken fürs Regal ist sie optional.</p>

<h2>Häufige Fragen</h2>

<h3>Ist eine Box dabei</h3>
<p>Ja, das Puzzle reist in einer Kartonbox und kann ohne zusätzliche Verpackung überreicht werden.</p>

<h3>Wie lange dauert die Herstellung</h3>
<p>Ein bis drei Werktage, danach der Versand. Es ist ein schnelles Produkt und schafft es selbst dann, wenn das Geschenk erst im letzten Moment eingefallen ist.</p>

<h3>Worin unterscheidet es sich von einem Holzpuzzle</h3>
<p>Unseres ist aus Karton und nicht aus Holz. Karton ist leichter, dünner und günstiger, seine Teile haben die klassische Form, und die Druckfarbe kommt darauf am genauesten heraus. Holzpuzzles machen wir nicht, wenn Holz also zwingend ist, sind wir ehrlich gesagt die falsche Wahl.</p>

<p>Das kleinere Format liegt daneben als <a href="/de/catalog/puzzle-a5">Fotopuzzle A5</a>, und die ganze Kategorie steht im Bereich <a href="/de/category/pazly">Puzzles</a>.</p>'
    )
  ),

  updated_at = NOW()

WHERE slug = 'puzzle-20x30';
