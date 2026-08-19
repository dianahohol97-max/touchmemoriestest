-- SEO rewrite of the star map poster (products.slug = 'poster-star-map').
--
-- Why: the page ranked for nothing. Three problems, all in the data rather than
-- in the page code:
--
--   1. The whole UA search demand sits on "карта зоряного неба" / "зоряна
--      карта" (see starsname.com, mimimaps.com.ua, customgifts.com.ua — all
--      ranking on that phrase). Our meta_title said "карта зірок", which nobody
--      types, and the phrase "карта зоряного неба" appeared once in the body.
--   2. The four non-Ukrainian locales had no meta_title and no meta_description
--      at all, so /en, /pl, /ro and /de fell back to the bare product name.
--      Four indexed URLs each with an untargeted title.
--   3. The body was ~1080 characters of mostly specs — thin for a money page,
--      and it answered none of the questions buyers actually ask (accuracy of
--      the map, how far back the date can go, what to write at the bottom).
--
-- What this changes: meta_title / meta_description for all five locales, longer
-- keyword-led bodies with an occasions block and an FAQ block, prose
-- short_descriptions, two extra spec rows, and a SKU so the Product structured
-- data carries an identifier.
--
-- Copy rules applied (CLAUDE.md + brand guide v1.1): "ти" not "Ви", no bullet
-- lists, no one- or two-word sentences, brand written as touch.memories.
--
-- Prices named in the copy (А4 350 ₴, А3 450 ₴) match products.price and
-- products.variants as of this migration; they are only mentioned in the
-- Ukrainian text, because the other locales are billed in EUR with the
-- international markup applied, so a hryvnia figure there would be wrong.
--
-- Also syncs products.status to 'active'. The row was created outside the admin
-- form, so it kept status='draft' while is_active=true — nothing reads `status`
-- today, but the two columns disagreeing is a trap for whatever reads it next.

UPDATE products SET

  meta_title = 'Карта зоряного неба — постер на твою дату',

  meta_description = 'Постер зоряного неба таким, яким воно було над твоїм містом у твою особливу ніч. Обираєш дату, місце, колір і підпис. Формати А4 і А3 від 350 ₴.',

  short_description = 'Карта зоряного неба такою, якою вона була над твоїм містом у найважливішу ніч. Ти обираєш дату, місце, кольори і підпис, решту робимо ми.',

  sku = 'TM-PSTR-SKY',

  status = 'active',

  description =
'<p>Карта зоряного неба — це знімок неба таким, яким воно було над конкретним містом у конкретну ніч. Ти називаєш дату, час і місце, а ми розраховуємо справжнє положення зір та сузір''їв на той момент і збираємо з нього постер. Кожне замовлення рахується окремо, тому двох однакових карт не буває.</p>

<h2>Кому дарують постер зоряного неба</h2>
<p>Найчастіше таку карту замовляють на річницю стосунків або весілля і ставлять на постер ніч першого побачення чи день, коли сказали «так». Друга велика причина — народження дитини: небо в годину пологів стає першим подарунком, який залишиться з нею назавжди. Замовляють і на день народження, на випускний, на новосілля, на роковини знайомства з людиною, якої вже немає поруч. Спільне в цих історіях одне — є дата, яку не хочеться забути.</p>

<h2>Що ти обираєш у замовленні</h2>
<p>Дата і час визначають, які сузір''я стоятимуть у центрі карти. Місто задає точку, з якої ми дивимося на небо, тому Дніпро і Львів у ту саму ніч дадуть трохи різні карти. Кольорова схема відповідає за настрій постера, а підпис або цитата внизу — за те, щоб через роки не довелося пригадувати, чим саме була ця дата.</p>

<h3>Кольорові схеми карти</h3>
<p>Темне небо залишається класикою: глибокий синьо-чорний фон і білі зорі, як у справжню ясну ніч. Світла схема робить постер майже графічним, бо бежевий фон і темні зорі спокійно живуть на світлій стіні. Синє небо додає насиченості й добре виглядає поруч із деревом. Рожево-пурпурний градієнт обирають ті, кому хочеться відвертої романтики без напівтонів.</p>

<h3>Формати друку і папір</h3>
<p>Постер друкуємо у форматі А4 розміром 21×30 см за 350 ₴ або А3 розміром 30×42 см за 450 ₴, на фотопапері Fujifilm, матовому чи глянцевому на твій вибір. А4 добре стоїть на робочому столі й на полиці, а А3 бере на себе стіну і читається з іншого кінця кімнати. Матове покриття не відблискує під лампою, глянець дає глибший чорний і сильніше світіння зір.</p>

<h2>Часті питання про карту зоряного неба</h2>

<h3>Наскільки точна ця карта</h3>
<p>Положення зір розраховуємо за астрономічними даними на вказані дату, час і координати міста, тому постер показує реальне небо тієї ночі, а не декоративний малюнок. Якщо точного часу ти не пам''ятаєш, беремо опівніч, і на загальний вигляд неба це майже не впливає.</p>

<h3>Скільки часу займає виготовлення</h3>
<p>Від одного до трьох робочих днів після того, як ми узгодимо деталі. Далі постер їде Новою поштою у будь-яке місто України, а за потреби відправляємо його і за кордон.</p>

<h3>Чи можна замовити небо за давню дату</h3>
<p>Так, обмежень за роком немає. Небо над Тернополем у 1985 році порахуємо так само точно, як небо над Києвом торік.</p>

<h3>Що написати внизу постера</h3>
<p>Найчастіше це коротка фраза, сама дата і координати міста. Можна поставити імена, рядок із пісні або те речення, яке має значення тільки для двох.</p>

<h3>Як оформити замовлення</h3>
<p>Додай постер у кошик і обери формат. Після оформлення ми напишемо тобі, щоб уточнити дату, місто, колір і підпис, а перед друком надішлемо макет на погодження.</p>

<p>Решта наших постерів зібрана в розділі <a href="/uk/category/postery">Постери</a>.</p>',

  specs = '[
    {"label":"Виготовлення","value":"1–2 дні","value_en":"1–2 days","value_pl":"1–2 dni","value_ro":"1–2 zile","value_de":"1–2 Tage"},
    {"label":"Розмір","value":"A4 (21×30 см) або A3 (30×42 см)","value_en":"A4 (21×30 cm) or A3 (30×42 cm)","value_pl":"A4 (21×30 cm) lub A3 (30×42 cm)","value_ro":"A4 (21×30 cm) sau A3 (30×42 cm)","value_de":"A4 (21×30 cm) oder A3 (30×42 cm)"},
    {"label":"Друк","value":"Фотопапір Fujifilm","value_en":"Fujifilm photo paper","value_pl":"Papier fotograficzny Fujifilm","value_ro":"Hârtie foto Fujifilm","value_de":"Fujifilm Fotopapier"},
    {"label":"Покриття","label_en":"Finish","label_pl":"Wykończenie","label_ro":"Finisaj","label_de":"Oberfläche","value":"Матове або глянцеве","value_en":"Matte or glossy","value_pl":"Matowe lub błyszczące","value_ro":"Mat sau lucios","value_de":"Matt oder glänzend"},
    {"label":"Персоналізація","label_en":"Personalisation","label_pl":"Personalizacja","label_ro":"Personalizare","label_de":"Personalisierung","value":"Дата, час, місто, кольорова схема і підпис","value_en":"Date, time, city, colour scheme and inscription","value_pl":"Data, godzina, miasto, kolorystyka i podpis","value_ro":"Data, ora, orașul, schema de culori și inscripția","value_de":"Datum, Uhrzeit, Stadt, Farbschema und Inschrift"}
  ]'::jsonb,

  translations = jsonb_build_object(

    'en', jsonb_build_object(
      'name', 'Star Map Poster',
      'meta_title', 'Star Map Poster for Your Date and City',
      'meta_description', 'A star map poster showing the sky exactly as it stood over your city on your night. Choose the date, place, colour scheme and your own inscription.',
      'short_description', 'A star map of the sky as it stood above your city on the night that mattered. You choose the date, the place, the colours and the inscription.',
      'description',
'<p>A star map is the sky captured exactly as it stood above one city on one night. You give us the date, the time and the place, and we calculate the real position of the stars and constellations for that moment and build a poster from it. Every order is computed on its own, so no two maps are ever the same.</p>

<h2>Who a star map poster is for</h2>
<p>Most of these maps are ordered for a relationship anniversary or a wedding, printing the night of a first date or the day someone said yes. The second big reason is a birth, when the sky at the hour of delivery becomes the first gift a child keeps for life. People also order them for birthdays, graduations, a first home together, and for the anniversary of someone who is no longer here. All of these stories share one thing, which is a date nobody wants to forget.</p>

<h2>What you choose when ordering</h2>
<p>The date and time decide which constellations sit at the centre of the map. The city sets the point we look at the sky from, so Kyiv and Berlin on the same night give slightly different maps. The colour scheme carries the mood of the poster, and the inscription along the bottom makes sure that years later nobody has to work out what the date meant.</p>

<h3>Colour schemes</h3>
<p>The dark sky remains the classic choice, with a deep blue-black background and white stars, the way a genuinely clear night looks. The light scheme turns the poster almost graphic, since a beige background with dark stars sits calmly on a pale wall. The blue sky adds saturation and works well next to wood. The pink and purple gradient is for anyone who wants the romance stated openly.</p>

<h3>Formats and paper</h3>
<p>We print in A4 at 21×30 cm or A3 at 30×42 cm on Fujifilm photo paper, matte or glossy as you prefer. A4 sits well on a desk or a shelf, while A3 takes over a wall and reads from across the room. The matte finish never catches a lamp, and the gloss gives a deeper black with brighter stars.</p>

<h2>Frequently asked questions</h2>

<h3>How accurate is the map</h3>
<p>Star positions are calculated from astronomical data for the date, time and coordinates you give us, so the poster shows the real sky of that night rather than a decorative drawing. If you do not remember the exact time we use midnight, and the overall look of the sky barely changes.</p>

<h3>How long does it take to make</h3>
<p>One to three working days once we have agreed the details with you. The poster then ships anywhere in Ukraine with Nova Poshta, and we send orders abroad as well.</p>

<h3>Can I order a sky from decades ago</h3>
<p>Yes, there is no limit on the year. A sky over Ternopil in 1985 is calculated just as precisely as a sky over Kyiv last spring.</p>

<h3>What should the inscription say</h3>
<p>Usually a short line, the date itself and the coordinates of the city. Names work well, so does a line from a song, or the one sentence that only means something to two people.</p>

<h3>How do I place an order</h3>
<p>Add the poster to your cart and pick a format. We write to you afterwards to confirm the date, the city, the colour and the inscription, and we send the artwork for approval before anything is printed.</p>

<p>The rest of our posters live in the <a href="/en/category/postery">Posters</a> section.</p>'
    ),

    'pl', jsonb_build_object(
      'name', 'Plakat Mapy Gwiazd',
      'meta_title', 'Plakat mapy gwiezdnego nieba na Twoją datę',
      'meta_description', 'Plakat gwiezdnego nieba takiego, jakie było nad Twoim miastem tej jednej nocy. Wybierasz datę, miejsce, kolor i własny podpis. Format A4 lub A3.',
      'short_description', 'Mapa gwiezdnego nieba takiego, jakie stało nad Twoim miastem tej najważniejszej nocy. Wybierasz datę, miejsce, kolory i podpis, resztę robimy my.',
      'description',
'<p>Mapa gwiezdnego nieba to obraz nieba dokładnie takiego, jakie stało nad jednym miastem jednej nocy. Podajesz datę, godzinę i miejsce, a my wyliczamy rzeczywiste położenie gwiazd i gwiazdozbiorów na tamten moment i składamy z tego plakat. Każde zamówienie liczone jest osobno, więc dwie identyczne mapy nie istnieją.</p>

<h2>Komu daruje się plakat gwiezdnego nieba</h2>
<p>Najczęściej taką mapę zamawia się na rocznicę związku albo ślubu i drukuje noc pierwszej randki lub dzień, w którym padło tak. Drugim wielkim powodem są narodziny dziecka, bo niebo z godziny porodu staje się pierwszym prezentem, który zostaje z nim na zawsze. Zamawia się je też na urodziny, na studniówkę, na własne mieszkanie i na rocznicę poznania kogoś, kogo już nie ma obok. Wszystkie te historie łączy jedno, czyli data, której nie chce się zapomnieć.</p>

<h2>Co wybierasz w zamówieniu</h2>
<p>Data i godzina decydują o tym, które gwiazdozbiory znajdą się w centrum mapy. Miasto wyznacza punkt, z którego patrzymy na niebo, więc Warszawa i Kijów tej samej nocy dadzą nieco inne mapy. Schemat kolorów odpowiada za nastrój plakatu, a podpis na dole za to, żeby po latach nikt nie musiał dochodzić, czym była ta data.</p>

<h3>Schematy kolorystyczne</h3>
<p>Ciemne niebo pozostaje klasyką, z głębokim granatowo-czarnym tłem i białymi gwiazdami, dokładnie jak w naprawdę pogodną noc. Jasny wariant robi z plakatu niemal grafikę, bo beżowe tło z ciemnymi gwiazdami spokojnie żyje na jasnej ścianie. Niebieskie niebo dodaje nasycenia i dobrze wygląda obok drewna. Różowo-fioletowy gradient wybierają ci, którzy chcą romantyzmu powiedzianego wprost.</p>

<h3>Formaty i papier</h3>
<p>Drukujemy w formacie A4 o wymiarach 21×30 cm albo A3 o wymiarach 30×42 cm, na papierze fotograficznym Fujifilm, matowym lub błyszczącym do wyboru. A4 dobrze stoi na biurku i na półce, a A3 bierze na siebie ścianę i czyta się z drugiego końca pokoju. Mat nie odbija światła lampy, a połysk daje głębszą czerń i mocniejszy blask gwiazd.</p>

<h2>Najczęstsze pytania</h2>

<h3>Na ile dokładna jest ta mapa</h3>
<p>Położenie gwiazd liczymy z danych astronomicznych dla podanej daty, godziny i współrzędnych miasta, więc plakat pokazuje prawdziwe niebo tamtej nocy, a nie ozdobny rysunek. Jeśli nie pamiętasz dokładnej godziny, przyjmujemy północ, co niemal nie zmienia ogólnego wyglądu nieba.</p>

<h3>Ile trwa realizacja</h3>
<p>Od jednego do trzech dni roboczych od uzgodnienia szczegółów. Potem plakat jedzie Nową Pocztą do dowolnego miasta w Ukrainie, a na życzenie wysyłamy go również za granicę.</p>

<h3>Czy mogę zamówić niebo sprzed wielu lat</h3>
<p>Tak, nie ma ograniczenia rocznika. Niebo nad Tarnopolem w 1985 roku policzymy równie dokładnie jak niebo nad Kijowem zeszłej wiosny.</p>

<h3>Co napisać na dole plakatu</h3>
<p>Zwykle jest to krótkie zdanie, sama data i współrzędne miasta. Dobrze działają imiona, wers z piosenki albo to jedno zdanie, które ma znaczenie tylko dla dwojga.</p>

<h3>Jak złożyć zamówienie</h3>
<p>Dodaj plakat do koszyka i wybierz format. Po złożeniu zamówienia napiszemy do Ciebie, żeby potwierdzić datę, miasto, kolor i podpis, a przed drukiem wyślemy projekt do akceptacji.</p>

<p>Pozostałe nasze plakaty znajdziesz w dziale <a href="/pl/category/postery">Plakaty</a>.</p>'
    ),

    'ro', jsonb_build_object(
      'name', 'Poster Harta Stelelor',
      'meta_title', 'Harta cerului înstelat — poster pe data ta',
      'meta_description', 'Poster cu cerul înstelat așa cum a fost deasupra orașului tău în noaptea aceea. Alegi data, locul, culoarea și propria inscripție. Format A4 sau A3.',
      'short_description', 'Harta cerului înstelat așa cum a fost deasupra orașului tău în cea mai importantă noapte. Alegi data, locul, culorile și inscripția, restul facem noi.',
      'description',
'<p>Harta cerului înstelat este cerul surprins exact așa cum a stat deasupra unui oraș într-o singură noapte. Ne spui data, ora și locul, iar noi calculăm poziția reală a stelelor și a constelațiilor pentru acel moment și construim posterul din ea. Fiecare comandă se calculează separat, așa că nu există două hărți identice.</p>

<h2>Cui i se dăruiește un poster cu harta stelelor</h2>
<p>Cel mai des harta se comandă pentru o aniversare a relației sau a nunții și se tipărește noaptea primei întâlniri ori ziua în care cineva a spus da. Al doilea motiv important este nașterea unui copil, pentru că cerul din ora nașterii devine primul cadou care îi rămâne pe viață. Se comandă și de ziua cuiva, la absolvire, la mutarea în prima locuință și la aniversarea unei persoane care nu mai este alături. Toate aceste povești au un lucru comun, adică o dată pe care nimeni nu vrea să o uite.</p>

<h2>Ce alegi în comandă</h2>
<p>Data și ora hotărăsc ce constelații ajung în centrul hărții. Orașul stabilește punctul din care privim cerul, așa că București și Kyiv în aceeași noapte dau hărți ușor diferite. Schema de culori poartă atmosfera posterului, iar inscripția de jos face ca peste ani nimeni să nu fie nevoit să își amintească ce a însemnat data aceea.</p>

<h3>Scheme de culori</h3>
<p>Cerul întunecat rămâne alegerea clasică, cu fundal albastru-negru profund și stele albe, exact cum arată o noapte cu adevărat senină. Varianta luminoasă transformă posterul aproape într-o grafică, fiindcă fundalul bej cu stele întunecate stă liniștit pe un perete deschis. Cerul albastru adaugă saturație și arată bine lângă lemn. Degradeul roz-violet este pentru cei care vor romantismul spus direct.</p>

<h3>Formate și hârtie</h3>
<p>Tipărim în format A4 de 21×30 cm sau A3 de 30×42 cm, pe hârtie foto Fujifilm, mată sau lucioasă la alegere. A4 stă bine pe birou și pe raft, iar A3 preia peretele și se citește din celălalt capăt al camerei. Finisajul mat nu prinde lumina lămpii, iar cel lucios dă un negru mai adânc și stele mai puternice.</p>

<h2>Întrebări frecvente</h2>

<h3>Cât de exactă este harta</h3>
<p>Poziția stelelor este calculată din date astronomice pentru data, ora și coordonatele pe care ni le dai, așa că posterul arată cerul real al acelei nopți, nu un desen decorativ. Dacă nu îți amintești ora exactă folosim miezul nopții, iar aspectul general al cerului aproape nu se schimbă.</p>

<h3>Cât durează realizarea</h3>
<p>Între una și trei zile lucrătoare după ce stabilim detaliile împreună. Apoi posterul pleacă prin Nova Poshta în orice oraș din Ucraina, iar la cerere îl trimitem și în străinătate.</p>

<h3>Pot comanda cerul dintr-un an îndepărtat</h3>
<p>Da, nu există o limită de an. Cerul de deasupra orașului Ternopil în 1985 se calculează la fel de precis ca cerul de deasupra Kyivului primăvara trecută.</p>

<h3>Ce să scriu în josul posterului</h3>
<p>De obicei o frază scurtă, data în sine și coordonatele orașului. Merg foarte bine numele, un vers dintr-un cântec sau propoziția aceea care înseamnă ceva doar pentru doi oameni.</p>

<h3>Cum plasez comanda</h3>
<p>Adaugă posterul în coș și alege formatul. După comandă îți scriem ca să confirmăm data, orașul, culoarea și inscripția, iar înainte de tipar trimitem macheta spre aprobare.</p>

<p>Restul posterelor noastre se află în secțiunea <a href="/ro/category/postery">Postere</a>.</p>'
    ),

    'de', jsonb_build_object(
      'name', 'Sternenhimmel-Poster',
      'meta_title', 'Sternenkarte — Poster auf dein Datum',
      'meta_description', 'Sternenhimmel-Poster genau so, wie der Himmel in jener Nacht über deiner Stadt stand. Du wählst Datum, Ort, Farbe und Inschrift. Format A4 oder A3.',
      'short_description', 'Eine Sternenkarte des Himmels, wie er in der wichtigsten Nacht über deiner Stadt stand. Du wählst Datum, Ort, Farben und Inschrift, den Rest machen wir.',
      'description',
'<p>Eine Sternenkarte zeigt den Himmel genau so, wie er in einer einzigen Nacht über einer bestimmten Stadt stand. Du nennst uns Datum, Uhrzeit und Ort, wir berechnen die tatsächliche Position der Sterne und Sternbilder für diesen Moment und bauen daraus ein Poster. Jede Bestellung wird einzeln berechnet, deshalb gibt es keine zwei gleichen Karten.</p>

<h2>Wem man ein Sternenhimmel-Poster schenkt</h2>
<p>Am häufigsten wird die Karte zum Jahrestag einer Beziehung oder einer Hochzeit bestellt, gedruckt wird dann die Nacht des ersten Dates oder der Tag des Jaworts. Der zweite große Anlass ist eine Geburt, denn der Himmel zur Stunde der Geburt wird zum ersten Geschenk, das ein Kind ein Leben lang behält. Bestellt wird sie außerdem zum Geburtstag, zum Abschluss, zur ersten eigenen Wohnung und zum Jahrestag eines Menschen, der nicht mehr da ist. All diese Geschichten haben eines gemeinsam, nämlich ein Datum, das niemand vergessen möchte.</p>

<h2>Was du bei der Bestellung wählst</h2>
<p>Datum und Uhrzeit entscheiden, welche Sternbilder in der Mitte der Karte stehen. Die Stadt bestimmt den Punkt, von dem aus wir auf den Himmel schauen, deshalb ergeben Berlin und Kyjiw in derselben Nacht leicht unterschiedliche Karten. Das Farbschema trägt die Stimmung des Posters, und die Inschrift am unteren Rand sorgt dafür, dass nach Jahren niemand mehr überlegen muss, wofür dieses Datum stand.</p>

<h3>Farbschemata</h3>
<p>Der dunkle Himmel bleibt die klassische Wahl, mit tiefblau-schwarzem Hintergrund und weißen Sternen, so wie eine wirklich klare Nacht aussieht. Die helle Variante macht aus dem Poster fast eine Grafik, denn ein beiger Hintergrund mit dunklen Sternen wirkt ruhig an einer hellen Wand. Der blaue Himmel bringt Sättigung und steht gut neben Holz. Den rosa-violetten Verlauf wählen alle, die Romantik offen ausgesprochen haben wollen.</p>

<h3>Formate und Papier</h3>
<p>Wir drucken im Format A4 mit 21×30 cm oder A3 mit 30×42 cm auf Fujifilm Fotopapier, matt oder glänzend nach deiner Wahl. A4 steht gut auf dem Schreibtisch und im Regal, A3 übernimmt eine ganze Wand und ist vom anderen Ende des Zimmers lesbar. Matt fängt kein Lampenlicht ein, Glanz gibt ein tieferes Schwarz und hellere Sterne.</p>

<h2>Häufige Fragen</h2>

<h3>Wie genau ist diese Karte</h3>
<p>Die Sternpositionen berechnen wir aus astronomischen Daten für das Datum, die Uhrzeit und die Koordinaten der Stadt, das Poster zeigt also den echten Himmel jener Nacht und keine dekorative Zeichnung. Wenn du die genaue Uhrzeit nicht mehr weißt, nehmen wir Mitternacht, und am Gesamtbild des Himmels ändert das kaum etwas.</p>

<h3>Wie lange dauert die Herstellung</h3>
<p>Ein bis drei Werktage, nachdem wir die Details mit dir abgestimmt haben. Danach geht das Poster mit Nova Poshta in jede Stadt der Ukraine, und auf Wunsch versenden wir es auch ins Ausland.</p>

<h3>Kann ich einen Himmel von vor Jahrzehnten bestellen</h3>
<p>Ja, eine Jahresgrenze gibt es nicht. Den Himmel über Ternopil im Jahr 1985 berechnen wir genauso präzise wie den Himmel über Kyjiw im letzten Frühling.</p>

<h3>Was soll unten auf dem Poster stehen</h3>
<p>Meistens ist es ein kurzer Satz, das Datum selbst und die Koordinaten der Stadt. Gut funktionieren Namen, eine Zeile aus einem Lied oder der eine Satz, der nur für zwei Menschen etwas bedeutet.</p>

<h3>Wie gebe ich die Bestellung auf</h3>
<p>Leg das Poster in den Warenkorb und wähle das Format. Nach der Bestellung schreiben wir dir, um Datum, Stadt, Farbe und Inschrift zu bestätigen, und vor dem Druck schicken wir dir den Entwurf zur Freigabe.</p>

<p>Unsere übrigen Poster findest du im Bereich <a href="/de/category/postery">Poster</a>.</p>'
    )
  ),

  updated_at = NOW()

WHERE slug = 'poster-star-map';
