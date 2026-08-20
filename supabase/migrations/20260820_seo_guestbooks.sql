-- SEO rewrite of both guest books (products.slug = 'wishbook' and
-- 'guestbook-kids').
--
-- Why:
--
--   1. Both descriptions published internal prepress data to customers. The
--      live page read "обкладинка 470×328 мм (поля під загин: верх/низ по 18 мм,
--      ліво/право по 20 мм). Розворот 450×228 мм (поля під обріз: 4.5 мм)" —
--      bleed and fold margins, which mean nothing to somebody buying a wedding
--      guest book and mean everything to the print shop. That text belongs in
--      the production notes, not on a product page. It stays recoverable from
--      git history and from the previous migration state if it is ever needed.
--   2. Neither description carried a single HTML tag. They were plain text with
--      "\n\n" separators rendered through dangerouslySetInnerHTML, so the
--      newlines collapsed and the whole thing showed as one unbroken wall of
--      text. Verified on production before this change.
--   3. The bodies were 528 and 675 characters and answered none of the real
--      questions: whether 32 pages are enough for a hundred guests, what pen
--      writes on black pages, how far ahead to order when production takes 10
--      to 14 working days.
--   4. All four non-Ukrainian locales had a ONE SENTENCE description
--      ("Wishbook in 20×30 cm format — perfect for weddings and large
--      celebrations.") and no meta_title or meta_description at all. The word
--      "Wishbook" was also left untranslated in every one of them.
--   5. The Ukrainian titles ran 66–67 characters including the brand, so Google
--      truncated both. The wedding one also promised "гостьова книга з фото"
--      while nothing in the product puts photos on the pages.
--   6. wishbook had no specs worth showing: one row was "Роздільність
--      5551×3874 пікс", which is a prepress number, and guestbook-kids had no
--      specs at all.
--
-- Copy rules applied (CLAUDE.md + brand guide v1.1): "ти" not "Ви", no bullet
-- lists, no one- or two-word sentences, brand written as touch.memories.
--
-- Prices named in the copy come from WISHBOOK_PRICES in
-- components/ui/ProductOptionsSelector.tsx, which is the single source of truth
-- for this product family and is already pinned by tests/pricing-composition.
-- The copy names only the 629 ₴ entry point and says which choices raise it,
-- rather than repeating a matrix that would go stale. NOTE: products.options
-- for both rows carries surcharge deltas that the checkout never uses, because
-- the code table governs; that mismatch is reported separately and is NOT
-- touched here.
--
-- Also fills the empty sku on both rows and syncs guestbook-kids.status, which
-- was still 'draft' while is_active was true.

-- ── Wedding guest book ───────────────────────────────────────────────────────

UPDATE products SET

  meta_title = 'Книга побажань на весілля — гостьова книга',

  meta_description = 'Книга побажань на весілля з твердою обкладинкою на вибір: велюр, тканина, шкірзамінник або друк. Три розміри, 32 сторінки, від 629 ₴.',

  short_description = 'Книга, у яку гості пишуть побажання, а ти перечитуєш їх через роки. Тверда обкладинка з вашими іменами, три розміри і три кольори сторінок.',

  sku = 'TM-WISH-WED',

  description =
'<p>Книга побажань — це те місце, де слова гостей залишаються назавжди. Замість листівок, які розлізуться по шухлядах уже за місяць, ви отримуєте одну книгу з твердою обкладинкою, вашими іменами й датою на ній, і тридцятьма двома сторінками всередині. Через десять років саме її знімають з полиці, коли хочуть згадати, хто що написав того вечора.</p>

<h2>На яке свято замовляють книгу побажань</h2>
<p>Найчастіше це весілля, і тоді книга стоїть на окремому столику біля входу поруч із ручками. Її беруть на ювілей, коли хочеться зібрати слова від усіх, хто прийшов, а не тільки почути тости. Замовляють на випускний і на корпоратив, де книга стає спільним артефактом усієї групи чи команди. Якщо свято дитяче, подивись <a href="/uk/catalog/guestbook-kids">дитячу книгу побажань</a>, вона зроблена під хрестини і перші дні народження.</p>

<h2>З чого зроблена книга</h2>
<p>Обкладинка завжди тверда, а матеріал ти обираєш сам. Друкована обкладинка дозволяє винести на неї ваше фото, імена й дату, і це найдоступніший варіант. Велюр, тканина і шкірзамінник виглядають стриманіше та дорожче, добре лягають у руку і краще переживають вечір, коли книгу передають з рук у руки. Усередині тридцять дві сторінки, чого вистачає з запасом навіть на велике весілля.</p>

<h2>Розмір і колір сторінок</h2>
<p>Квадратний формат 23×23 см найкомпактніший і найпопулярніший, вертикальний 20×30 см дає більше місця під довгі побажання, а горизонтальний 30×20 см зручний, коли гості пишуть удвох на одному розвороті. Сторінки бувають білі, чорні та кремові. Білі підходять під будь-яку ручку і коштують дешевше, а чорні й кремові виглядають ефектніше, але потребують білої або золотої гелевої ручки, яку варто покласти поруч із книгою заздалегідь.</p>

<h2>Як гості її заповнюють</h2>
<p>Постав книгу на окремому столику біля входу чи біля подарунків і поклади поруч дві–три ручки, бо одна завжди кудись зникає. Невелика табличка з проханням написати кілька слів працює краще за очікування, що гості здогадаються самі. Добре, коли перший розворот заповнюють свідки або батьки, бо після них соромʼязливі гості пишуть значно охочіше.</p>

<h2>Часті питання про книгу побажань</h2>

<h3>Чи вистачить тридцяти двох сторінок на сто гостей</h3>
<p>Так, і зазвичай навіть залишається місце. Гості рідко пишуть поодинці, найчастіше одне побажання займає пів сторінки і його підписують парою або родиною.</p>

<h3>Чи можна вклеювати в неї фотографії</h3>
<p>Можна, папір це витримує, і полароїдні знімки в книзі виглядають чудово. Візьми клейові квадратики або двосторонній скотч, бо рідкий клей проступає на зворотному боці аркуша.</p>

<h3>Якою ручкою писати на чорних сторінках</h3>
<p>Білою або золотою гелевою, і краще купити одразу кілька штук. Звичайна кулькова ручка на чорному папері не видно взагалі, і це найчастіша причина зіпсованого враження від чорної книги.</p>

<h3>За скільки часу замовляти</h3>
<p>Виготовлення займає від десяти до чотирнадцяти робочих днів, плюс час на доставку. Для весілля це означає, що замовляти варто десь за місяць, а не за тиждень, бо тверда обкладинка потребує повного циклу склеювання і пресування.</p>

<h3>Скільки коштує</h3>
<p>Найдоступніший варіант, а це друкована обкладинка з білими сторінками у форматі 23×23 см, коштує 629 ₴. Ціна зростає, якщо взяти більший формат, темні сторінки або обкладинку з велюру, тканини чи шкірзамінника, і точну суму ти бачиш одразу під час вибору.</p>

<p>Решта книг цієї категорії зібрана в розділі <a href="/uk/category/knyha-pobazhan">Книга побажань</a>.</p>',

  specs = '[
    {"label":"Формат","label_en":"Size","label_pl":"Format","label_ro":"Format","label_de":"Format","value":"23×23, 20×30 або 30×20 см","value_en":"23×23, 20×30 or 30×20 cm","value_pl":"23×23, 20×30 lub 30×20 cm","value_ro":"23×23, 20×30 sau 30×20 cm","value_de":"23×23, 20×30 oder 30×20 cm"},
    {"label":"Обкладинка","label_en":"Cover","label_pl":"Okładka","label_ro":"Copertă","label_de":"Einband","value":"Тверда: друк, велюр, тканина або шкірзамінник","value_en":"Hard: print, velour, fabric or leatherette","value_pl":"Twarda: druk, welur, tkanina lub ekoskóra","value_ro":"Tare: tipar, velur, textil sau piele ecologică","value_de":"Hart: Druck, Velours, Stoff oder Kunstleder"},
    {"label":"Сторінок","label_en":"Pages","label_pl":"Stron","label_ro":"Pagini","label_de":"Seiten","value":"32","value_en":"32","value_pl":"32","value_ro":"32","value_de":"32"},
    {"label":"Колір сторінок","label_en":"Page colour","label_pl":"Kolor stron","label_ro":"Culoarea paginilor","label_de":"Seitenfarbe","value":"Білі, чорні або кремові","value_en":"White, black or cream","value_pl":"Białe, czarne lub kremowe","value_ro":"Albe, negre sau crem","value_de":"Weiß, Schwarz oder Creme"},
    {"label":"Виготовлення","label_en":"Production","label_pl":"Realizacja","label_ro":"Producție","label_de":"Herstellung","value":"10–14 робочих днів","value_en":"10–14 working days","value_pl":"10–14 dni roboczych","value_ro":"10–14 zile lucrătoare","value_de":"10–14 Werktage"}
  ]'::jsonb,

  translations = jsonb_build_object(

    'en', jsonb_build_object(
      'name', 'Guest Book',
      'meta_title', 'Wedding Guest Book with a Hard Cover',
      'meta_description', 'A wedding guest book with a hard cover of your choice: print, velour, fabric or leatherette. Three sizes, 32 pages, white, black or cream.',
      'short_description', 'The book your guests write their wishes into, and you reread years later. A hard cover with your names, three sizes and three page colours.',
      'description',
'<p>A guest book is where the words of your guests stay for good. Instead of cards that scatter into drawers within a month, you get one hard-cover book with your names and the date on it and thirty-two pages inside. Ten years on, this is the thing people take off the shelf when they want to remember who wrote what that evening.</p>

<h2>Which celebrations it is ordered for</h2>
<p>Most often a wedding, and then the book sits on its own small table by the entrance with pens beside it. It is taken to milestone anniversaries, when you want the words of everyone who came and not only the toasts. It is ordered for graduations and for company parties, where it becomes a shared artefact of a whole class or team. If the celebration is for a child, look at the <a href="/en/catalog/guestbook-kids">children''s guest book</a>, which is made for christenings and first birthdays.</p>

<h2>What the book is made of</h2>
<p>The cover is always hard, and you choose the material. A printed cover lets you put your photograph, names and date on it, and it is the most affordable option. Velour, fabric and leatherette look quieter and more expensive, sit well in the hand and survive an evening of being passed around better. Inside there are thirty-two pages, which is enough with room to spare even for a large wedding.</p>

<h2>Size and page colour</h2>
<p>The square 23×23 cm is the most compact and the most popular, the upright 20×30 cm gives more room for long messages, and the landscape 30×20 cm suits guests writing in pairs across one spread. Pages come in white, black and cream. White takes any pen and costs less, while black and cream look striking but need a white or gold gel pen, which is worth putting beside the book in advance.</p>

<h2>How guests fill it in</h2>
<p>Put the book on its own table near the entrance or beside the gifts, and leave two or three pens with it, because one always disappears. A small sign asking for a few words works far better than hoping guests will work it out. It helps when the first spread is filled in by the witnesses or the parents, because shy guests write much more willingly after them.</p>

<h2>Frequently asked questions</h2>

<h3>Are thirty-two pages enough for a hundred guests</h3>
<p>Yes, and there is usually room left over. Guests rarely write alone, so one message tends to take half a page and gets signed by a couple or a whole family.</p>

<h3>Can photographs be glued into it</h3>
<p>They can, the paper takes it well, and instant photographs look wonderful in the book. Use adhesive squares or double-sided tape, because liquid glue shows through on the other side of the sheet.</p>

<h3>Which pen writes on black pages</h3>
<p>A white or gold gel pen, and it is worth buying several at once. An ordinary ballpoint is completely invisible on black paper, and that is the most common reason a black book disappoints.</p>

<h3>How far ahead should I order</h3>
<p>Production takes ten to fourteen working days, plus delivery time. For a wedding that means ordering about a month ahead rather than a week, because a hard cover needs the full cycle of gluing and pressing.</p>

<p>The rest of this category lives in the <a href="/en/category/knyha-pobazhan">Guest Books</a> section.</p>'
    ),

    'pl', jsonb_build_object(
      'name', 'Księga Gości',
      'meta_title', 'Księga gości na wesele w twardej oprawie',
      'meta_description', 'Księga gości na wesele w twardej oprawie do wyboru: druk, welur, tkanina lub ekoskóra. Trzy formaty, 32 strony, karty białe, czarne lub kremowe.',
      'short_description', 'Księga, w której goście piszą życzenia, a Ty czytasz je po latach. Twarda oprawa z Waszymi imionami, trzy formaty i trzy kolory stron.',
      'description',
'<p>Księga gości to miejsce, w którym słowa gości zostają na zawsze. Zamiast kartek, które w miesiąc rozejdą się po szufladach, dostajesz jedną księgę w twardej oprawie z Waszymi imionami i datą oraz trzydziestoma dwoma stronami w środku. Po dziesięciu latach to właśnie ją zdejmuje się z półki, żeby przypomnieć sobie, kto co wtedy napisał.</p>

<h2>Na jaką uroczystość się ją zamawia</h2>
<p>Najczęściej na wesele, a wtedy księga stoi na osobnym stoliku przy wejściu razem z długopisami. Bierze się ją na okrągły jubileusz, kiedy chce się mieć słowa wszystkich obecnych, a nie tylko toasty. Zamawia się ją na studniówkę i na imprezę firmową, gdzie staje się wspólną pamiątką całej klasy albo zespołu. Jeśli uroczystość jest dziecięca, zobacz <a href="/pl/catalog/guestbook-kids">dziecięcą księgę życzeń</a>, przygotowaną na chrzciny i pierwsze urodziny.</p>

<h2>Z czego jest zrobiona</h2>
<p>Oprawa zawsze jest twarda, a materiał wybierasz sam. Okładka drukowana pozwala umieścić na niej Wasze zdjęcie, imiona i datę, i jest najtańszą opcją. Welur, tkanina i ekoskóra wyglądają spokojniej i drożej, dobrze leżą w dłoni i lepiej znoszą wieczór podawania z rąk do rąk. W środku jest trzydzieści dwie strony, co wystarcza z zapasem nawet na duże wesele.</p>

<h2>Format i kolor stron</h2>
<p>Kwadratowy 23×23 cm jest najbardziej kompaktowy i najpopularniejszy, pionowy 20×30 cm daje więcej miejsca na dłuższe życzenia, a poziomy 30×20 cm sprawdza się, gdy goście piszą we dwoje na jednym rozkładzie. Strony bywają białe, czarne i kremowe. Białe przyjmą każdy długopis i kosztują mniej, a czarne i kremowe wyglądają efektowniej, ale wymagają białego lub złotego długopisu żelowego, który warto położyć obok księgi wcześniej.</p>

<h2>Jak goście ją wypełniają</h2>
<p>Postaw księgę na osobnym stoliku przy wejściu albo obok prezentów i zostaw przy niej dwa lub trzy długopisy, bo jeden zawsze gdzieś znika. Mała tabliczka z prośbą o kilka słów działa znacznie lepiej niż liczenie na domyślność gości. Pomaga, gdy pierwszy rozkład wypełniają świadkowie albo rodzice, bo po nich nieśmiali goście piszą dużo chętniej.</p>

<h2>Najczęstsze pytania</h2>

<h3>Czy trzydzieści dwie strony wystarczą na stu gości</h3>
<p>Tak, zwykle jeszcze zostaje miejsce. Goście rzadko piszą pojedynczo, więc jedno życzenie zajmuje pół strony i podpisuje je para albo cała rodzina.</p>

<h3>Czy można wklejać zdjęcia</h3>
<p>Można, papier to znosi, a zdjęcia natychmiastowe wyglądają w księdze wyśmienicie. Użyj kwadracików klejowych albo taśmy dwustronnej, bo klej w płynie przebija na drugą stronę kartki.</p>

<h3>Jakim długopisem pisać po czarnych stronach</h3>
<p>Białym lub złotym żelowym, i warto kupić od razu kilka. Zwykły długopis na czarnym papierze jest zupełnie niewidoczny, i to najczęstszy powód rozczarowania czarną księgą.</p>

<h3>Z jakim wyprzedzeniem zamawiać</h3>
<p>Realizacja trwa od dziesięciu do czternastu dni roboczych, plus czas dostawy. Przy weselu oznacza to zamówienie mniej więcej miesiąc wcześniej, a nie tydzień, bo twarda oprawa wymaga pełnego cyklu klejenia i prasowania.</p>

<p>Resztę tej kategorii znajdziesz w dziale <a href="/pl/category/knyha-pobazhan">Księgi gości</a>.</p>'
    ),

    'ro', jsonb_build_object(
      'name', 'Carte de Oaspeți',
      'meta_title', 'Carte de oaspeți pentru nuntă, copertă tare',
      'meta_description', 'Carte de oaspeți pentru nuntă cu copertă tare la alegere: tipar, velur, textil sau piele ecologică. Trei formate, 32 de pagini, albe, negre sau crem.',
      'short_description', 'Cartea în care invitații scriu urări, iar tu le recitești peste ani. Copertă tare cu numele voastre, trei formate și trei culori de pagini.',
      'description',
'<p>Cartea de oaspeți este locul în care cuvintele invitaților rămân pentru totdeauna. În loc de felicitări care se împrăștie prin sertare într-o lună, primești o singură carte cu copertă tare, cu numele voastre și data pe ea, și treizeci și două de pagini înăuntru. Peste zece ani tocmai ea se ia de pe raft, când vrei să îți amintești cine ce a scris în seara aceea.</p>

<h2>Pentru ce sărbători se comandă</h2>
<p>Cel mai des pentru nuntă, iar atunci cartea stă pe o măsuță separată la intrare, alături de pixuri. Se ia la aniversări rotunde, când vrei cuvintele tuturor celor prezenți, nu doar toasturile. Se comandă pentru absolvire și pentru petrecerea de companie, unde devine o amintire comună a unei clase sau a unei echipe. Dacă sărbătoarea este a unui copil, vezi <a href="/ro/catalog/guestbook-kids">cartea de urări pentru copii</a>, făcută pentru botez și primele zile de naștere.</p>

<h2>Din ce este făcută</h2>
<p>Coperta este întotdeauna tare, iar materialul îl alegi tu. Coperta tipărită îți permite să pui pe ea fotografia, numele și data, și este varianta cea mai accesibilă. Velurul, textilul și pielea ecologică arată mai sobru și mai scump, stau bine în mână și rezistă mai bine unei seri în care cartea trece din mână în mână. Înăuntru sunt treizeci și două de pagini, ceea ce ajunge cu rezervă chiar și pentru o nuntă mare.</p>

<h2>Formatul și culoarea paginilor</h2>
<p>Pătratul de 23×23 cm este cel mai compact și cel mai popular, formatul vertical de 20×30 cm lasă mai mult loc pentru mesaje lungi, iar cel orizontal de 30×20 cm este comod când invitații scriu în doi pe aceeași pagină dublă. Paginile pot fi albe, negre sau crem. Cele albe primesc orice pix și costă mai puțin, iar cele negre și crem arată spectaculos, dar cer un pix cu gel alb sau auriu, pe care merită să îl pui lângă carte din timp.</p>

<h2>Cum o completează invitații</h2>
<p>Așază cartea pe o măsuță separată la intrare sau lângă cadouri și lasă două-trei pixuri lângă ea, pentru că unul dispare mereu. O plăcuță mică prin care ceri câteva cuvinte funcționează mult mai bine decât speranța că invitații își vor da seama singuri. Ajută mult dacă prima pagină dublă este completată de nași sau de părinți, fiindcă după ei invitații timizi scriu mult mai ușor.</p>

<h2>Întrebări frecvente</h2>

<h3>Ajung treizeci și două de pagini pentru o sută de invitați</h3>
<p>Da, și de obicei mai rămâne loc. Invitații scriu rar singuri, așa că un mesaj ocupă cam jumătate de pagină și este semnat de un cuplu sau de o familie întreagă.</p>

<h3>Se pot lipi fotografii în ea</h3>
<p>Se pot, hârtia suportă asta, iar fotografiile instant arată minunat în carte. Folosește pătrățele adezive sau bandă dublu adezivă, fiindcă lipiciul lichid se vede pe cealaltă parte a filei.</p>

<h3>Cu ce pix se scrie pe paginile negre</h3>
<p>Cu unul cu gel alb sau auriu, și merită cumpărate mai multe deodată. Un pix obișnuit este complet invizibil pe hârtia neagră, și acesta este cel mai frecvent motiv de dezamăgire.</p>

<h3>Cu cât timp înainte să comand</h3>
<p>Producția durează între zece și paisprezece zile lucrătoare, plus timpul de livrare. Pentru o nuntă asta înseamnă o comandă cu aproximativ o lună înainte, nu cu o săptămână, fiindcă o copertă tare cere ciclul complet de lipire și presare.</p>

<p>Restul acestei categorii se află în secțiunea <a href="/ro/category/knyha-pobazhan">Cărți de oaspeți</a>.</p>'
    ),

    'de', jsonb_build_object(
      'name', 'Gästebuch',
      'meta_title', 'Hochzeits-Gästebuch mit hartem Einband',
      'meta_description', 'Hochzeits-Gästebuch mit hartem Einband nach Wahl: Druck, Velours, Stoff oder Kunstleder. Drei Formate, 32 Seiten, weiße, schwarze oder cremefarbene Seiten.',
      'short_description', 'Das Buch, in das eure Gäste ihre Wünsche schreiben und das du Jahre später wieder liest. Harter Einband mit euren Namen, drei Formate und drei Seitenfarben.',
      'description',
'<p>Ein Gästebuch ist der Ort, an dem die Worte eurer Gäste dauerhaft bleiben. Statt Karten, die sich binnen eines Monats in Schubladen verlieren, bekommt ihr ein Buch mit hartem Einband, euren Namen und dem Datum darauf und zweiunddreißig Seiten im Inneren. Zehn Jahre später ist es genau dieses Buch, das man aus dem Regal holt, wenn man wissen will, wer an jenem Abend was geschrieben hat.</p>

<h2>Zu welchen Anlässen es bestellt wird</h2>
<p>Am häufigsten zur Hochzeit, und dann steht das Buch auf einem eigenen Tischchen am Eingang, mit Stiften daneben. Man nimmt es zu runden Jubiläen, wenn man die Worte aller Anwesenden möchte und nicht nur die Trinksprüche. Bestellt wird es zum Abschluss und zur Firmenfeier, wo es zur gemeinsamen Erinnerung eines ganzen Jahrgangs oder Teams wird. Ist der Anlass ein Kinderfest, sieh dir das <a href="/de/catalog/guestbook-kids">Kinder-Gästebuch</a> an, das für Taufen und erste Geburtstage gemacht ist.</p>

<h2>Woraus das Buch besteht</h2>
<p>Der Einband ist immer hart, das Material wählst du. Ein gedruckter Einband trägt euer Foto, eure Namen und das Datum und ist die günstigste Variante. Velours, Stoff und Kunstleder wirken ruhiger und hochwertiger, liegen gut in der Hand und überstehen einen Abend des Herumreichens besser. Innen sind zweiunddreißig Seiten, was selbst für eine große Hochzeit mit Reserve genügt.</p>

<h2>Format und Seitenfarbe</h2>
<p>Das quadratische 23×23 cm ist das kompakteste und beliebteste, das hochformatige 20×30 cm gibt mehr Raum für lange Wünsche, und das querformatige 30×20 cm passt, wenn Gäste zu zweit auf einer Doppelseite schreiben. Die Seiten gibt es in Weiß, Schwarz und Creme. Weiß nimmt jeden Stift an und kostet weniger, Schwarz und Creme wirken eindrucksvoller, brauchen aber einen weißen oder goldenen Gelstift, den man besser vorab neben das Buch legt.</p>

<h2>Wie die Gäste es ausfüllen</h2>
<p>Stell das Buch auf ein eigenes Tischchen am Eingang oder neben die Geschenke und leg zwei oder drei Stifte dazu, denn einer verschwindet immer. Ein kleines Schild mit der Bitte um ein paar Zeilen wirkt deutlich besser als die Hoffnung, die Gäste kämen von selbst darauf. Es hilft, wenn die erste Doppelseite von den Trauzeugen oder den Eltern gefüllt wird, weil schüchterne Gäste danach viel bereitwilliger schreiben.</p>

<h2>Häufige Fragen</h2>

<h3>Reichen zweiunddreißig Seiten für hundert Gäste</h3>
<p>Ja, und meistens bleibt sogar Platz übrig. Gäste schreiben selten allein, ein Eintrag nimmt eher eine halbe Seite ein und wird von einem Paar oder einer ganzen Familie unterschrieben.</p>

<h3>Kann man Fotos hineinkleben</h3>
<p>Ja, das Papier verträgt es, und Sofortbilder sehen darin wunderbar aus. Nimm Klebequadrate oder doppelseitiges Klebeband, denn Flüssigkleber schlägt auf der Rückseite des Blattes durch.</p>

<h3>Welcher Stift schreibt auf schwarzen Seiten</h3>
<p>Ein weißer oder goldener Gelstift, und es lohnt sich, gleich mehrere zu kaufen. Ein gewöhnlicher Kugelschreiber ist auf schwarzem Papier überhaupt nicht zu sehen, und das ist der häufigste Grund für Enttäuschung.</p>

<h3>Wie lange im Voraus sollte ich bestellen</h3>
<p>Die Herstellung dauert zehn bis vierzehn Werktage, dazu kommt der Versand. Für eine Hochzeit heißt das etwa einen Monat vorher bestellen und nicht eine Woche, weil ein harter Einband den vollen Zyklus aus Kleben und Pressen braucht.</p>

<p>Den Rest dieser Kategorie findest du im Bereich <a href="/de/category/knyha-pobazhan">Gästebücher</a>.</p>'
    )
  ),

  updated_at = NOW()

WHERE slug = 'wishbook';

-- ── Children's guest book ────────────────────────────────────────────────────

UPDATE products SET

  meta_title = 'Дитяча книга побажань на хрестини',

  meta_description = 'Дитяча книга побажань на хрестини, перший день народження або baby shower. Тверда обкладинка з іменем малюка, три розміри, від 629 ₴.',

  short_description = 'Книга, у якій рідні пишуть побажання малечі, щоб віддати її дитині через двадцять років. Тверда обкладинка з іменем і три розміри на вибір.',

  sku = 'TM-WISH-KIDS',

  status = 'active',

  description =
'<p>Дитяча книга побажань збирає те, що рідні говорять малечі, поки вона ще нічого з цього не розуміє. Хрещені, бабусі, друзі родини пишуть свої кілька рядків, книга закривається і чекає. Її віддають дитині у вісімнадцять чи двадцять, і тоді ці сторінки читаються зовсім інакше, ніж у день, коли їх писали.</p>

<h2>На яке свято її замовляють</h2>
<p>Найчастіше на хрестини, бо там збираються саме ті люди, чиї слова згодом матимуть вагу. Другий привід — перший день народження, коли дитина ще не запамʼятає свято, зате книга запамʼятає за неї. Замовляють і на baby shower, ще до пологів, і тоді перші записи зʼявляються раніше за саму дитину. Якщо тобі потрібна книга на весілля, вона <a href="/uk/catalog/wishbook">лежить окремо</a>.</p>

<h2>Обкладинка та імʼя малюка</h2>
<p>Обкладинка тверда, а на ній ми розміщуємо імʼя дитини й дату свята, за бажання разом із фотографією. Друкований варіант дозволяє винести на обкладинку повноцінне фото і коштує найменше. Велюр і тканина виглядають мʼякше й тепліше, і саме їх найчастіше обирають на хрестини, бо книга потім багато років стоїть на полиці в дитячій.</p>

<h2>Розмір і сторінки</h2>
<p>Квадратний формат 23×23 см найзручніший, коли гостей небагато і книга має жити на полиці. Вертикальний 20×30 см дає більше місця під довгі листи від хрещених, а горизонтальний 30×20 см добре працює, коли на розвороті пишуть цілою родиною. Усередині тридцять дві сторінки, а самі сторінки бувають білі або чорні, і для чорних обовʼязково потрібна біла чи золота гелева ручка.</p>

<h2>Що написати дитині</h2>
<p>Найцінніші записи виходять тоді, коли людина пише не побажання загалом, а щось конкретне про себе і про цей день. Дата, місце, кілька слів про те, яким був цей рік, і одне побажання наприкінці працюють краще за красиві загальні фрази. Поклади поруч із книгою невелику картку з таким проханням, і записи будуть зовсім іншої якості.</p>

<h2>Часті питання</h2>

<h3>Чи можна вклеювати фотографії та відбитки</h3>
<p>Так, і саме в дитячій книзі це роблять найчастіше. Відбиток долоньки чи стопи на першому розвороті стає тим, заради чого книгу потім і дістають, а для фото краще брати клейові квадратики, бо рідкий клей проступає крізь аркуш.</p>

<h3>Чи вистачить місця, якщо гостей мало</h3>
<p>Тридцять дві сторінки на хрестинах рідко заповнюються повністю, і це нормально. Порожні сторінки можна дозаповнювати щороку на день народження, і тоді книга росте разом із дитиною.</p>

<h3>За скільки часу замовляти</h3>
<p>Виготовлення триває від десяти до чотирнадцяти робочих днів, а далі додається доставка. Хрестини зазвичай призначають заздалегідь, тож замовляй десь за місяць, щоб книга приїхала спокійно і без нервів.</p>

<h3>Скільки коштує</h3>
<p>Найдоступніший варіант, а це друкована обкладинка з білими сторінками у форматі 23×23 см, коштує 629 ₴. Більший формат, чорні сторінки або велюрова чи тканинна обкладинка піднімають ціну, і точну суму видно одразу під час вибору.</p>

<p>Решта книг цієї категорії зібрана в розділі <a href="/uk/category/knyha-pobazhan">Книга побажань</a>.</p>',

  specs = '[
    {"label":"Формат","label_en":"Size","label_pl":"Format","label_ro":"Format","label_de":"Format","value":"23×23, 20×30 або 30×20 см","value_en":"23×23, 20×30 or 30×20 cm","value_pl":"23×23, 20×30 lub 30×20 cm","value_ro":"23×23, 20×30 sau 30×20 cm","value_de":"23×23, 20×30 oder 30×20 cm"},
    {"label":"Обкладинка","label_en":"Cover","label_pl":"Okładka","label_ro":"Copertă","label_de":"Einband","value":"Тверда: друк, велюр або тканина","value_en":"Hard: print, velour or fabric","value_pl":"Twarda: druk, welur lub tkanina","value_ro":"Tare: tipar, velur sau textil","value_de":"Hart: Druck, Velours oder Stoff"},
    {"label":"Сторінок","label_en":"Pages","label_pl":"Stron","label_ro":"Pagini","label_de":"Seiten","value":"32","value_en":"32","value_pl":"32","value_ro":"32","value_de":"32"},
    {"label":"Колір сторінок","label_en":"Page colour","label_pl":"Kolor stron","label_ro":"Culoarea paginilor","label_de":"Seitenfarbe","value":"Білі або чорні","value_en":"White or black","value_pl":"Białe lub czarne","value_ro":"Albe sau negre","value_de":"Weiß oder Schwarz"},
    {"label":"Виготовлення","label_en":"Production","label_pl":"Realizacja","label_ro":"Producție","label_de":"Herstellung","value":"10–14 робочих днів","value_en":"10–14 working days","value_pl":"10–14 dni roboczych","value_ro":"10–14 zile lucrătoare","value_de":"10–14 Werktage"}
  ]'::jsonb,

  translations = jsonb_build_object(

    'en', jsonb_build_object(
      'name', 'Kids Guest Book',
      'meta_title', 'Christening Guest Book for a Child',
      'meta_description', 'A children''s guest book for a christening, a first birthday or a baby shower. Hard cover with the child''s name, three sizes to choose from.',
      'short_description', 'The book where family write their wishes to a child, to be handed over twenty years later. A hard cover with the name and three sizes.',
      'description',
'<p>A children''s guest book collects what the family says to a child while the child understands none of it yet. Godparents, grandmothers and family friends write their few lines, the book closes and waits. It is handed over at eighteen or twenty, and then those pages read very differently from the day they were written.</p>

<h2>Which celebrations it is ordered for</h2>
<p>Most often a christening, because the people who gather there are exactly the ones whose words will carry weight later. The second occasion is a first birthday, when the child will remember nothing of the day but the book remembers on their behalf. It is also ordered for baby showers, before the birth, and then the first entries arrive before the child does. If you need one for a wedding, that <a href="/en/catalog/wishbook">is a separate book</a>.</p>

<h2>The cover and the child''s name</h2>
<p>The cover is hard, and we place the child''s name and the date of the celebration on it, with a photograph if you want one. The printed version carries a full photograph and costs the least. Velour and fabric feel softer and warmer, and they are what most people choose for a christening, because the book then stands on a shelf in the nursery for years.</p>

<h2>Size and pages</h2>
<p>The square 23×23 cm is the handiest when there are few guests and the book is meant to live on a shelf. The upright 20×30 cm leaves more room for long letters from godparents, and the landscape 30×20 cm works well when a whole family writes across one spread. Inside there are thirty-two pages in white or black, and black pages need a white or gold gel pen.</p>

<h2>What to write to a child</h2>
<p>The most valuable entries come from people who write something specific about themselves and about that day rather than a general wish. A date, a place, a few words about what this year was like and one wish at the end work far better than elegant generalities. Leave a small card beside the book asking for exactly that, and the entries come out different in kind.</p>

<h2>Frequently asked questions</h2>

<h3>Can photographs and handprints go in</h3>
<p>Yes, and in a children''s book that is the most common thing to do. A handprint or footprint on the first spread becomes the reason the book gets taken out later, and for photographs use adhesive squares, because liquid glue shows through the sheet.</p>

<h3>Is there enough room if there are few guests</h3>
<p>Thirty-two pages are rarely filled at a christening, and that is fine. The empty pages can be filled a little every year on the birthday, and then the book grows along with the child.</p>

<h3>How far ahead should I order</h3>
<p>Production takes ten to fourteen working days, and delivery comes on top. Christenings are usually set well in advance, so order about a month ahead and the book arrives without any rush.</p>

<p>The rest of this category lives in the <a href="/en/category/knyha-pobazhan">Guest Books</a> section.</p>'
    ),

    'pl', jsonb_build_object(
      'name', 'Księga Gości Dziecięca',
      'meta_title', 'Księga życzeń na chrzciny dla dziecka',
      'meta_description', 'Dziecięca księga życzeń na chrzciny, pierwsze urodziny lub baby shower. Twarda oprawa z imieniem dziecka, trzy formaty do wyboru.',
      'short_description', 'Księga, w której rodzina pisze życzenia dziecku, żeby oddać ją po dwudziestu latach. Twarda oprawa z imieniem i trzy formaty do wyboru.',
      'description',
'<p>Dziecięca księga życzeń zbiera to, co rodzina mówi maluchowi, kiedy on jeszcze nic z tego nie rozumie. Chrzestni, babcie i przyjaciele domu piszą swoje kilka linijek, księga się zamyka i czeka. Oddaje się ją w osiemnaste albo dwudzieste urodziny, a wtedy te strony czyta się zupełnie inaczej niż w dniu, w którym powstały.</p>

<h2>Na jaką uroczystość się ją zamawia</h2>
<p>Najczęściej na chrzciny, bo zbierają się tam dokładnie ci ludzie, których słowa będą później ważyć najwięcej. Drugą okazją są pierwsze urodziny, kiedy dziecko nie zapamięta niczego, a księga zapamięta za nie. Zamawia się ją też na baby shower, jeszcze przed porodem, i wtedy pierwsze wpisy pojawiają się wcześniej niż samo dziecko. Jeśli potrzebujesz księgi na wesele, to <a href="/pl/catalog/wishbook">osobna księga</a>.</p>

<h2>Okładka i imię dziecka</h2>
<p>Oprawa jest twarda, a na niej umieszczamy imię dziecka i datę uroczystości, w razie potrzeby razem ze zdjęciem. Wersja drukowana pomieści pełne zdjęcie i kosztuje najmniej. Welur i tkanina są w dotyku miększe i cieplejsze, i to je najczęściej wybiera się na chrzciny, bo księga stoi potem przez lata na półce w pokoju dziecka.</p>

<h2>Format i strony</h2>
<p>Kwadratowy 23×23 cm jest najwygodniejszy, gdy gości jest niewielu, a księga ma stać na półce. Pionowy 20×30 cm daje więcej miejsca na długie listy od chrzestnych, a poziomy 30×20 cm sprawdza się, gdy na jednym rozkładzie pisze cała rodzina. W środku jest trzydzieści dwie strony, białe albo czarne, a do czarnych konieczny jest biały lub złoty długopis żelowy.</p>

<h2>Co napisać dziecku</h2>
<p>Najcenniejsze wpisy powstają wtedy, gdy ktoś pisze coś konkretnego o sobie i o tym dniu, a nie życzenie w ogóle. Data, miejsce, kilka słów o tym, jaki był ten rok, i jedno życzenie na koniec działają znacznie lepiej niż piękne ogólniki. Połóż obok księgi małą karteczkę z taką prośbą, a wpisy będą zupełnie innej jakości.</p>

<h2>Najczęstsze pytania</h2>

<h3>Czy można wklejać zdjęcia i odciski</h3>
<p>Tak, i w księdze dziecięcej robi się to najczęściej. Odcisk dłoni albo stopy na pierwszym rozkładzie staje się powodem, dla którego księgę się potem wyjmuje, a do zdjęć używaj kwadracików klejowych, bo klej w płynie przebija przez kartkę.</p>

<h3>Czy wystarczy miejsca, gdy gości jest mało</h3>
<p>Trzydzieści dwie strony rzadko zapełniają się na chrzcinach i to jest w porządku. Puste strony można dopisywać co roku w urodziny, a wtedy księga rośnie razem z dzieckiem.</p>

<h3>Z jakim wyprzedzeniem zamawiać</h3>
<p>Realizacja trwa od dziesięciu do czternastu dni roboczych, a do tego dochodzi dostawa. Chrzciny zwykle planuje się z wyprzedzeniem, więc zamów mniej więcej miesiąc wcześniej, a księga dojedzie spokojnie.</p>

<p>Resztę tej kategorii znajdziesz w dziale <a href="/pl/category/knyha-pobazhan">Księgi gości</a>.</p>'
    ),

    'ro', jsonb_build_object(
      'name', 'Carte de Oaspeți pentru Copii',
      'meta_title', 'Carte de urări pentru botez, pentru copil',
      'meta_description', 'Carte de urări pentru copii, pentru botez, prima aniversare sau baby shower. Copertă tare cu numele copilului, trei formate la alegere.',
      'short_description', 'Cartea în care familia scrie urări copilului, ca să i-o dai peste douăzeci de ani. Copertă tare cu numele și trei formate la alegere.',
      'description',
'<p>Cartea de urări pentru copii adună ceea ce familia îi spune celui mic atunci când el încă nu înțelege nimic din toate acestea. Nașii, bunicile și prietenii casei își scriu cele câteva rânduri, cartea se închide și așteaptă. I se dă copilului la optsprezece sau douăzeci de ani, iar atunci paginile acelea se citesc cu totul altfel decât în ziua în care au fost scrise.</p>

<h2>Pentru ce sărbători se comandă</h2>
<p>Cel mai des pentru botez, fiindcă acolo se adună exact oamenii ale căror cuvinte vor cântări mai târziu. A doua ocazie este prima aniversare, când copilul nu va ține minte nimic din zi, dar cartea ține minte în locul lui. Se comandă și pentru baby shower, încă dinainte de naștere, iar atunci primele însemnări apar mai devreme decât copilul. Dacă ai nevoie de una pentru nuntă, aceea <a href="/ro/catalog/wishbook">este o carte separată</a>.</p>

<h2>Coperta și numele copilului</h2>
<p>Coperta este tare, iar pe ea punem numele copilului și data sărbătorii, împreună cu o fotografie dacă vrei. Varianta tipărită poate purta o fotografie întreagă și costă cel mai puțin. Velurul și textilul sunt mai moi și mai calde la atingere, și tocmai ele se aleg cel mai des pentru botez, fiindcă apoi cartea stă ani la rând pe un raft în camera copilului.</p>

<h2>Formatul și paginile</h2>
<p>Pătratul de 23×23 cm este cel mai comod când invitații sunt puțini, iar cartea urmează să stea pe raft. Formatul vertical de 20×30 cm lasă mai mult loc pentru scrisori lungi de la nași, iar cel orizontal de 30×20 cm funcționează bine când scrie o familie întreagă pe aceeași pagină dublă. Înăuntru sunt treizeci și două de pagini, albe sau negre, iar pentru cele negre este obligatoriu un pix cu gel alb sau auriu.</p>

<h2>Ce să îi scrii copilului</h2>
<p>Cele mai valoroase însemnări vin de la oameni care scriu ceva concret despre ei și despre ziua aceea, nu o urare în general. O dată, un loc, câteva cuvinte despre cum a fost anul acesta și o singură urare la final funcționează mult mai bine decât generalitățile frumoase. Lasă lângă carte un cartonaș cu exact această rugăminte, iar însemnările vor ieși de altă calitate.</p>

<h2>Întrebări frecvente</h2>

<h3>Se pot lipi fotografii și amprente</h3>
<p>Da, iar în cartea pentru copii asta se face cel mai des. O amprentă de palmă sau de picior pe prima pagină dublă devine motivul pentru care cartea se scoate mai târziu, iar pentru fotografii folosește pătrățele adezive, fiindcă lipiciul lichid se vede prin filă.</p>

<h3>Ajunge locul dacă invitații sunt puțini</h3>
<p>Cele treizeci și două de pagini se umplu rar la un botez, și asta este în regulă. Paginile goale pot fi completate câte puțin în fiecare an, de ziua copilului, iar atunci cartea crește odată cu el.</p>

<h3>Cu cât timp înainte să comand</h3>
<p>Producția durează între zece și paisprezece zile lucrătoare, iar livrarea se adaugă. Botezurile se stabilesc de obicei din timp, așa că fă comanda cu aproximativ o lună înainte și cartea ajunge fără grabă.</p>

<p>Restul acestei categorii se află în secțiunea <a href="/ro/category/knyha-pobazhan">Cărți de oaspeți</a>.</p>'
    ),

    'de', jsonb_build_object(
      'name', 'Kinder-Gästebuch',
      'meta_title', 'Gästebuch zur Taufe für ein Kind',
      'meta_description', 'Kinder-Gästebuch zur Taufe, zum ersten Geburtstag oder zur Babyparty. Harter Einband mit dem Namen des Kindes, drei Formate zur Wahl.',
      'short_description', 'Das Buch, in das die Familie dem Kind ihre Wünsche schreibt, um es zwanzig Jahre später zu übergeben. Harter Einband mit Namen, drei Formate.',
      'description',
'<p>Ein Kinder-Gästebuch sammelt das, was die Familie einem Kind sagt, solange es davon noch nichts versteht. Paten, Großmütter und Freunde des Hauses schreiben ihre paar Zeilen, das Buch schließt sich und wartet. Übergeben wird es mit achtzehn oder zwanzig, und dann lesen sich diese Seiten ganz anders als an dem Tag, an dem sie entstanden.</p>

<h2>Zu welchen Anlässen es bestellt wird</h2>
<p>Am häufigsten zur Taufe, denn dort kommen genau die Menschen zusammen, deren Worte später Gewicht haben. Der zweite Anlass ist der erste Geburtstag, an dem das Kind sich an nichts erinnern wird, das Buch aber an seiner Stelle. Bestellt wird es auch zur Babyparty, noch vor der Geburt, und dann entstehen die ersten Einträge früher als das Kind selbst. Wenn du eines für eine Hochzeit brauchst, ist das <a href="/de/catalog/wishbook">ein eigenes Buch</a>.</p>

<h2>Der Einband und der Name des Kindes</h2>
<p>Der Einband ist hart, und darauf setzen wir den Namen des Kindes und das Datum der Feier, auf Wunsch zusammen mit einem Foto. Die gedruckte Variante trägt ein vollflächiges Foto und kostet am wenigsten. Velours und Stoff fühlen sich weicher und wärmer an, und genau sie werden zur Taufe am häufigsten gewählt, weil das Buch danach jahrelang im Kinderzimmer im Regal steht.</p>

<h2>Format und Seiten</h2>
<p>Das quadratische 23×23 cm ist am praktischsten, wenn wenige Gäste kommen und das Buch im Regal leben soll. Das hochformatige 20×30 cm lässt mehr Raum für lange Briefe der Paten, und das querformatige 30×20 cm eignet sich, wenn eine ganze Familie auf einer Doppelseite schreibt. Innen sind zweiunddreißig Seiten in Weiß oder Schwarz, und schwarze Seiten brauchen einen weißen oder goldenen Gelstift.</p>

<h2>Was man einem Kind schreibt</h2>
<p>Die wertvollsten Einträge stammen von Menschen, die etwas Konkretes über sich und über diesen Tag schreiben statt eines allgemeinen Wunsches. Ein Datum, ein Ort, ein paar Worte darüber, wie dieses Jahr war, und ein einziger Wunsch am Ende wirken weit besser als schöne Allgemeinplätze. Leg eine kleine Karte mit genau dieser Bitte neben das Buch, und die Einträge fallen anders aus.</p>

<h2>Häufige Fragen</h2>

<h3>Kann man Fotos und Abdrücke einkleben</h3>
<p>Ja, und im Kinderbuch wird genau das am häufigsten gemacht. Ein Hand- oder Fußabdruck auf der ersten Doppelseite wird zu dem Grund, aus dem das Buch später hervorgeholt wird, und für Fotos nimm Klebequadrate, denn Flüssigkleber schlägt durch das Blatt.</p>

<h3>Reicht der Platz, wenn nur wenige Gäste kommen</h3>
<p>Zweiunddreißig Seiten werden bei einer Taufe selten voll, und das ist in Ordnung. Die leeren Seiten lassen sich jedes Jahr zum Geburtstag ein Stück weiterfüllen, und dann wächst das Buch mit dem Kind mit.</p>

<h3>Wie lange im Voraus sollte ich bestellen</h3>
<p>Die Herstellung dauert zehn bis vierzehn Werktage, der Versand kommt dazu. Taufen werden meist lange vorher festgelegt, bestell also etwa einen Monat im Voraus, dann kommt das Buch in Ruhe an.</p>

<p>Den Rest dieser Kategorie findest du im Bereich <a href="/de/category/knyha-pobazhan">Gästebücher</a>.</p>'
    )
  ),

  updated_at = NOW()

WHERE slug = 'guestbook-kids';
