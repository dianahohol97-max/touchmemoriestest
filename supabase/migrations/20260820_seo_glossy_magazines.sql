-- SEO rewrite of the soft-cover glossy magazine, plus a title alignment on its
-- hard-cover twin (products.slug = 'personalized-glossy-magazine' and
-- 'fotozhurnal-tverd-obkladynka').
--
-- Positioning decided by Diana (2026-08-20): the two magazines are equal
-- variants that differ only by cover, NOT a budget tier and a premium tier. And
-- the magazine sells best as a gift, so the gift intent has to be carried by the
-- SEO fields, not just by the photos.
--
-- Why the rewrite:
--
--   1. The soft-cover title read "Глянцевий журнал про людину — незвичайний
--      подарунок", 68 characters including the brand, so Google truncated it —
--      and "про людину" is not a phrase anyone searches. The market says
--      "фотожурнал" and "персональний журнал" (vela-art.com, im-frame.com,
--      modni.com.ua all rank on those).
--   2. Worse, the hard-cover twin already owned "з твердою обкладинкою" while
--      the soft one carried no cover modifier at all, so both pages competed for
--      the same generic head term and Google picked the winner for us. Each
--      title now leads with the shared head term plus the gift intent and is
--      separated by its own cover, which is what makes the pair legible as two
--      variants rather than two rivals. They also cross-link now.
--   3. The soft-cover body was 585 characters and was essentially a bullet price
--      list, duplicating the configurator and answering none of the questions a
--      gift buyer asks (staple versus glue, how many pages for a given story,
--      who writes the text).
--   4. All four non-Ukrainian locales stated "20–80 pages · soft or hard cover".
--      Both halves are false: this magazine is 8 to 100 pages and soft cover
--      only. That is a factual error on four markets, fixed here regardless of
--      any ranking consideration.
--   5. Neither product had meta_title or meta_description in any non-Ukrainian
--      locale, so /en, /pl, /ro and /de fell back to the bare product name.
--
-- Copy rules applied (CLAUDE.md + brand guide v1.1): "ти" not "Ви", no bullet
-- lists, no one- or two-word sentences, brand written as touch.memories.
--
-- Prices named in the copy match products.options as of this migration: the
-- soft-cover magazine runs 525 ₴ at 8 pages to 3150 ₴ at 100, typesetting is
-- +195 ₴ for your own text or the basic package and +395 ₴ for premium, and
-- rush production is +30%. Only the Ukrainian text names hryvnia figures,
-- because the other locales are billed in EUR with the international markup.
--
-- Also fills the empty sku on both rows and syncs the hard-cover row's status,
-- which was still 'draft' while is_active was true.

-- ── Soft cover ────────────────────────────────────────────────────────────────

UPDATE products SET

  meta_title = 'Фотожурнал у подарунок — м''яка обкладинка',

  meta_description = 'Фотожурнал А4 у подарунок із твоїми фото і текстами. Від 8 до 100 сторінок, м''яка глянцева обкладинка, крейдований папір 115 г. Від 525 ₴.',

  short_description = 'Журнал про тебе і твоїх людей, зверстаний як справжнє глянцеве видання. М''яка обкладинка, від 8 до 100 сторінок, готовність за 5–8 днів.',

  sku = 'TM-MAG-SOFT',

  description =
'<p>Фотожурнал — це подарунок, який людина гортає при тобі і бачить власне життя, зверстане як справжнє глянцеве видання. Формат А4, м''яка глянцева обкладинка, крейдований папір усередині, і на кожному розвороті фотографії та тексти про того, кому ти його даруєш. Тираж від одного примірника, тому це не типографія, а один журнал про одну людину.</p>

<h2>Кому дарують фотожурнал</h2>
<p>Найчастіше його замовляють на круглий день народження, коли звичайний подарунок здається замалим для тридцяти чи п''ятдесяти років. Другий великий привід — річниця весілля, де журнал збирає всю спільну історію від першого побачення до останньої відпустки. Його дарують мамі й бабусі, бо там є фото, яких вони не бачили в друці жодного разу. Колезі на прощання перед звільненням чи виходом на пенсію теж, і тоді статті пише вся команда. На випускний журнал стає альтернативою альбому, бо в ньому є місце для тексту, а не лише для портретів.</p>

<h2>Що всередині</h2>
<p>Журнал будується як звичайне видання, тому в ньому є обкладинка з головним кадром і заголовком, розвороти з великими фото і колонки тексту поруч. Ти можеш віддати самі фотографії, а можеш додати статті, інтерв''ю, привітання від різних людей або підписи до кожного кадру. Саме тексти відрізняють журнал від фотоальбому, бо через рік вони пояснять, чому цей знімок узагалі тут опинився.</p>

<h2>М''яка обкладинка і як журнал зшитий</h2>
<p>М''яка обкладинка — це крейдований картон 130 г із глянцем, вона гнеться, легша за тверду і дає журналу впізнаваний вигляд справжньої преси. До сорока чотирьох сторінок журнал зшивається скобою, як тонке видання, а від сорока чотирьох іде на клей і отримує рівний корінець, на якому видно назву. Якщо тобі ближче подарунок, який стоїть на полиці як книжка, подивись <a href="/uk/catalog/fotozhurnal-tverd-obkladynka">фотожурнал з твердою обкладинкою</a> — наповнення там таке саме, різниця лише в обкладинці.</p>

<h2>Скільки сторінок обрати</h2>
<p>Вісім чи дванадцять сторінок вистачає для однієї події, наприклад для поїздки або для дня народження, і це найдешевший вхід за 525 ₴. Двадцять чотири чи сорок сторінок беруть, коли треба вмістити цілий рік чи всю історію пари, і це найпопулярніший діапазон. Від шістдесяти до ста сторінок замовляють на ювілей або на корпоративний журнал про команду, і сто сторінок коштують 3150 ₴. Орієнтуйся приблизно на дві–чотири фотографії на розворот, якщо хочеш, щоб кадри дихали.</p>

<h2>Хто пише тексти</h2>
<p>Ти можеш написати все сам у конструкторі, і тоді верстка тексту коштує 195 ₴. Якщо писати немає часу або хочеться, щоб це звучало як журнальна стаття, тексти пишемо ми: після замовлення відкриється анкета, де ти обираєш базовий пакет за 195 ₴ або преміум за 395 ₴ і розповідаєш про людину та події. Можна взяти і третій варіант, у якому в журналі немає жодного тексту, а працюють самі фотографії.</p>

<h2>Часті питання про фотожурнал</h2>

<h3>Чим він відрізняється від фотокниги</h3>
<p>Фотокнига будується навколо фотографій, а журнал навколо історії, тому в ньому є заголовки, статті та підписи. Журнал легший і тонший, і його читають, а не лише розглядають.</p>

<h3>Скільки фотографій влізе</h3>
<p>Це залежить від верстки, але як орієнтир бери дві–чотири фотографії на розворот. У журналі на сорок сторінок комфортно живе близько шістдесяти кадрів разом із текстом.</p>

<h3>Чи можна замовити кілька однакових примірників</h3>
<p>Так, і це часта історія для випускних або корпоративних журналів. Другий і наступні примірники того самого макета коштують дешевше, бо верстка вже готова.</p>

<h3>Чи встигнете до дати</h3>
<p>Стандартне виробництво займає від п''яти до восьми робочих днів після погодження макета. Якщо дата близько, є термінове виконання за один–три дні з доплатою тридцять відсотків, і його можна обрати просто в замовленні.</p>

<h3>Як усе відбувається</h3>
<p>Ти обираєш кількість сторінок і варіант тексту, після чого відкривається конструктор, у якому ти сам розкладаєш фото, або анкета, якщо тексти пишемо ми. Перед друком ми надсилаємо готовий макет, і журнал іде в роботу тільки після твого підтвердження.</p>

<p>Обидва наші журнали зібрані в розділі <a href="/uk/category/hlyantsevi-zhurnaly">Глянцеві журнали</a>.</p>',

  translations = jsonb_build_object(

    'en', jsonb_build_object(
      'name', 'Glossy Magazine with Soft Cover',
      'meta_title', 'Photo Magazine Gift with a Soft Cover',
      'meta_description', 'An A4 photo magazine to give as a gift, built from your photos and texts. From 8 to 100 pages, soft glossy cover, 115gsm coated paper.',
      'short_description', 'A magazine about someone you love, laid out like a real glossy publication. Soft cover, from 8 to 100 pages, ready in five to eight days.',
      'description',
'<p>A photo magazine is the kind of gift someone leafs through while you watch, seeing their own life laid out like a real glossy publication. A4 format, soft glossy cover, coated paper inside, and on every spread the photographs and the writing about the person you are giving it to. A print run starts at one copy, so this is not a print shop job but one magazine about one person.</p>

<h2>Who a photo magazine is for</h2>
<p>Most often it is ordered for a milestone birthday, when an ordinary present feels too small for thirty or fifty years. The second big occasion is a wedding anniversary, where the magazine gathers the whole shared story from a first date to the last holiday. People give it to mothers and grandmothers, because it holds photographs they have never once seen in print. Colleagues get one as a leaving present or at retirement, and then the whole team writes the articles. At graduation the magazine replaces the album, because it has room for text and not only for portraits.</p>

<h2>What is inside</h2>
<p>The magazine is built like an actual publication, so it has a cover with a hero shot and a headline, spreads with large photographs and columns of text beside them. You can hand over the pictures alone, or add articles, an interview, messages from several people, or a caption under every frame. The writing is what separates a magazine from a photo album, because a year later it explains why a given shot is there at all.</p>

<h2>The soft cover and how the magazine is bound</h2>
<p>The soft cover is 130gsm coated board with a gloss finish, it bends, it weighs less than a hard cover and it gives the magazine the recognisable look of real press. Up to forty-four pages the magazine is saddle-stitched like a thin publication, and from forty-four onwards it is perfect-bound and gains a flat spine with the title readable on it. If you would rather give something that stands on a shelf like a book, look at the <a href="/en/catalog/fotozhurnal-tverd-obkladynka">hard cover photo magazine</a>, where the contents are identical and only the cover differs.</p>

<h2>How many pages to choose</h2>
<p>Eight or twelve pages is enough for a single event such as a trip or a birthday, and it is the cheapest way in. Twenty-four to forty pages is what people take when a whole year or the entire story of a couple has to fit, and it is the most popular range. Sixty to a hundred pages is ordered for a big anniversary or for a corporate magazine about a team. Reckon on roughly two to four photographs per spread if you want the frames to breathe.</p>

<h2>Who writes the text</h2>
<p>You can write everything yourself in the editor, and then the typesetting is charged as an extra. If there is no time for writing, or you want it to read like a real feature, we write the text for you: after ordering, a short brief opens where you pick a basic or a premium package and tell us about the person and the events. There is also a third option in which the magazine carries no text at all and the photographs do all the work.</p>

<h2>Frequently asked questions</h2>

<h3>How is it different from a photo book</h3>
<p>A photo book is built around the photographs while a magazine is built around the story, so it has headlines, articles and captions. A magazine is lighter and thinner, and it is read rather than only looked at.</p>

<h3>How many photographs will fit</h3>
<p>That depends on the layout, but two to four photographs per spread is a fair guide. A forty page magazine comfortably holds around sixty frames alongside the text.</p>

<h3>Can I order several identical copies</h3>
<p>Yes, and it is a common request for graduations and corporate magazines. The second and further copies of the same layout cost less, because the typesetting is already done.</p>

<h3>Will it be ready in time</h3>
<p>Standard production takes five to eight working days once the layout is approved. If the date is close there is rush production in one to three days for a surcharge, and you can select it right in the order.</p>

<h3>How does it work</h3>
<p>You choose the page count and the text option, after which either the editor opens so you can place the photographs yourself, or the brief opens if we are writing. Before printing we send you the finished layout, and the magazine goes to press only once you approve it.</p>

<p>Both of our magazines live in the <a href="/en/category/hlyantsevi-zhurnaly">Glossy Magazines</a> section.</p>'
    ),

    'pl', jsonb_build_object(
      'name', 'Magazyn Błyszczący z Miękką Okładką',
      'meta_title', 'Fotomagazyn na prezent — miękka okładka',
      'meta_description', 'Fotomagazyn A4 na prezent z Twoimi zdjęciami i tekstami. Od 8 do 100 stron, miękka błyszcząca okładka, papier kredowy 115 g.',
      'short_description', 'Magazyn o kimś bliskim, złożony jak prawdziwe błyszczące wydawnictwo. Miękka okładka, od 8 do 100 stron, gotowy w pięć do ośmiu dni.',
      'description',
'<p>Fotomagazyn to prezent, który obdarowany przegląda przy Tobie i widzi własne życie złożone jak prawdziwe błyszczące wydawnictwo. Format A4, miękka błyszcząca okładka, papier kredowy w środku, a na każdym rozkładzie zdjęcia i teksty o osobie, której go dajesz. Nakład zaczyna się od jednego egzemplarza, więc to nie zlecenie drukarskie, tylko jeden magazyn o jednej osobie.</p>

<h2>Komu daruje się fotomagazyn</h2>
<p>Najczęściej zamawia się go na okrągłe urodziny, kiedy zwykły prezent wydaje się za mały na trzydzieści albo pięćdziesiąt lat. Drugą wielką okazją jest rocznica ślubu, gdzie magazyn zbiera całą wspólną historię od pierwszej randki po ostatni urlop. Daje się go mamie i babci, bo są tam zdjęcia, których nigdy nie widziały w druku. Koledzy dostają taki magazyn na pożegnanie albo na emeryturę, a wtedy artykuły pisze cały zespół. Na studniówkę magazyn zastępuje album, bo ma miejsce na tekst, a nie tylko na portrety.</p>

<h2>Co jest w środku</h2>
<p>Magazyn budowany jest jak prawdziwe wydawnictwo, więc ma okładkę z głównym kadrem i tytułem, rozkładówki z dużymi zdjęciami i kolumny tekstu obok. Możesz oddać same fotografie albo dodać artykuły, wywiad, życzenia od kilku osób lub podpis pod każdym kadrem. To właśnie teksty odróżniają magazyn od albumu, bo po roku wyjaśnią, dlaczego dane zdjęcie w ogóle się tam znalazło.</p>

<h2>Miękka okładka i sposób oprawy</h2>
<p>Miękka okładka to karton kredowy 130 g z połyskiem, gnie się, waży mniej od twardej i daje magazynowi rozpoznawalny wygląd prawdziwej prasy. Do czterdziestu czterech stron magazyn jest szyty zeszytowo jak cienkie wydawnictwo, a od czterdziestu czterech idzie na klej i zyskuje płaski grzbiet z czytelnym tytułem. Jeśli wolisz prezent, który stoi na półce jak książka, zobacz <a href="/pl/catalog/fotozhurnal-tverd-obkladynka">fotomagazyn z twardą okładką</a>, gdzie zawartość jest taka sama, a różni się tylko okładka.</p>

<h2>Ile stron wybrać</h2>
<p>Osiem albo dwanaście stron wystarcza na jedno wydarzenie, na przykład na wyjazd lub urodziny, i jest to najtańsze wejście. Dwadzieścia cztery do czterdziestu stron bierze się wtedy, gdy trzeba zmieścić cały rok albo całą historię pary, i jest to najpopularniejszy zakres. Od sześćdziesięciu do stu stron zamawia się na duży jubileusz albo na magazyn firmowy o zespole. Licz mniej więcej dwa do czterech zdjęć na rozkładówkę, jeśli chcesz, żeby kadry oddychały.</p>

<h2>Kto pisze teksty</h2>
<p>Możesz napisać wszystko sam w edytorze, a wtedy skład tekstu jest liczony osobno. Jeśli nie ma czasu na pisanie albo chcesz, żeby brzmiało to jak prawdziwy artykuł, teksty piszemy my: po zamówieniu otwiera się ankieta, w której wybierasz pakiet podstawowy lub premium i opowiadasz o osobie oraz wydarzeniach. Jest też trzecia opcja, w której magazyn nie ma żadnego tekstu i pracują same zdjęcia.</p>

<h2>Najczęstsze pytania</h2>

<h3>Czym różni się od fotoksiążki</h3>
<p>Fotoksiążka budowana jest wokół zdjęć, a magazyn wokół historii, dlatego ma nagłówki, artykuły i podpisy. Magazyn jest lżejszy i cieńszy, i się go czyta, a nie tylko ogląda.</p>

<h3>Ile zdjęć się zmieści</h3>
<p>To zależy od składu, ale dwa do czterech zdjęć na rozkładówkę to dobra miara. Magazyn na czterdzieści stron mieści komfortowo około sześćdziesięciu kadrów razem z tekstem.</p>

<h3>Czy mogę zamówić kilka identycznych egzemplarzy</h3>
<p>Tak, i jest to częsta prośba przy studniówkach oraz magazynach firmowych. Drugi i kolejne egzemplarze tego samego projektu kosztują mniej, bo skład jest już gotowy.</p>

<h3>Czy zdążycie na termin</h3>
<p>Standardowa realizacja zajmuje od pięciu do ośmiu dni roboczych po akceptacji projektu. Jeśli data jest blisko, jest realizacja ekspresowa w jeden do trzech dni za dopłatą, którą wybierasz bezpośrednio w zamówieniu.</p>

<h3>Jak to przebiega</h3>
<p>Wybierasz liczbę stron i wariant tekstu, po czym otwiera się edytor, w którym sam układasz zdjęcia, albo ankieta, jeśli teksty piszemy my. Przed drukiem wysyłamy gotowy projekt, a magazyn idzie do druku dopiero po Twojej akceptacji.</p>

<p>Oba nasze magazyny znajdziesz w dziale <a href="/pl/category/hlyantsevi-zhurnaly">Magazyny błyszczące</a>.</p>'
    ),

    'ro', jsonb_build_object(
      'name', 'Revistă Lucioasă cu Copertă Moale',
      'meta_title', 'Fotorevistă cadou — copertă moale',
      'meta_description', 'Fotorevistă A4 cadou, cu fotografiile și textele tale. De la 8 la 100 de pagini, copertă moale lucioasă, hârtie cretată 115 g.',
      'short_description', 'O revistă despre cineva drag, machetată ca o publicație lucioasă adevărată. Copertă moale, de la 8 la 100 de pagini, gata în cinci până la opt zile.',
      'description',
'<p>Fotorevista este cadoul pe care omul îl răsfoiește chiar în fața ta și își vede propria viață machetată ca o publicație lucioasă adevărată. Format A4, copertă moale lucioasă, hârtie cretată în interior, iar pe fiecare pagină dublă fotografiile și textele despre persoana căreia i-o dăruiești. Tirajul începe de la un exemplar, deci nu este o comandă de tipografie, ci o revistă despre un singur om.</p>

<h2>Cui i se dăruiește o fotorevistă</h2>
<p>Cel mai des se comandă pentru o zi de naștere rotundă, când un cadou obișnuit pare prea mic pentru treizeci sau cincizeci de ani. A doua ocazie importantă este aniversarea nunții, unde revista adună toată povestea comună de la prima întâlnire până la ultima vacanță. Se dăruiește mamelor și bunicilor, pentru că acolo sunt fotografii pe care nu le-au văzut niciodată tipărite. Colegii o primesc la plecarea din echipă sau la pensionare, iar atunci articolele le scrie toată echipa. La absolvire revista înlocuiește albumul, fiindcă are loc pentru text, nu doar pentru portrete.</p>

<h2>Ce este înăuntru</h2>
<p>Revista se construiește ca o publicație reală, deci are copertă cu imaginea principală și un titlu, pagini duble cu fotografii mari și coloane de text alături. Poți preda doar fotografiile sau poți adăuga articole, un interviu, mesaje de la mai multe persoane ori o legendă sub fiecare cadru. Tocmai textele deosebesc revista de un album foto, pentru că peste un an ele explică de ce se află acolo o anumită fotografie.</p>

<h2>Coperta moale și modul de legare</h2>
<p>Coperta moale este carton cretat de 130 g cu finisaj lucios, se îndoaie, cântărește mai puțin decât cea tare și dă revistei aspectul recognoscibil al presei adevărate. Până la patruzeci și patru de pagini revista este capsată ca o publicație subțire, iar de la patruzeci și patru încolo este lipită și capătă un cotor drept pe care se citește titlul. Dacă preferi un cadou care stă pe raft ca o carte, vezi <a href="/ro/catalog/fotozhurnal-tverd-obkladynka">fotorevista cu copertă tare</a>, unde conținutul este identic și diferă doar coperta.</p>

<h2>Câte pagini să alegi</h2>
<p>Opt sau douăsprezece pagini ajung pentru un singur eveniment, de pildă o călătorie sau o zi de naștere, și este cea mai ieftină variantă de intrare. Douăzeci și patru până la patruzeci de pagini se aleg când trebuie să încapă un an întreg sau toată povestea unui cuplu, și este intervalul cel mai popular. De la șaizeci la o sută de pagini se comandă pentru o aniversare mare sau pentru o revistă de companie despre echipă. Socotește cam două până la patru fotografii pe pagina dublă, dacă vrei ca imaginile să respire.</p>

<h2>Cine scrie textele</h2>
<p>Poți scrie totul singur în editor, iar atunci machetarea textului se taxează separat. Dacă nu ai timp de scris sau vrei să sune ca un articol adevărat, textele le scriem noi: după comandă se deschide un formular unde alegi pachetul de bază sau cel premium și ne povestești despre om și despre evenimente. Există și o a treia variantă, în care revista nu are niciun text și lucrează doar fotografiile.</p>

<h2>Întrebări frecvente</h2>

<h3>Prin ce diferă de o fotocarte</h3>
<p>Fotocartea se construiește în jurul fotografiilor, iar revista în jurul poveștii, de aceea are titluri, articole și legende. Revista este mai ușoară și mai subțire, și se citește, nu doar se privește.</p>

<h3>Câte fotografii încap</h3>
<p>Depinde de machetă, dar două până la patru fotografii pe pagina dublă este un reper bun. O revistă de patruzeci de pagini găzduiește confortabil în jur de șaizeci de cadre împreună cu textul.</p>

<h3>Pot comanda mai multe exemplare identice</h3>
<p>Da, și este o cerere frecventă pentru absolviri și reviste de companie. Al doilea exemplar și următoarele ale aceleiași machete costă mai puțin, fiindcă machetarea este deja făcută.</p>

<h3>Ajungeți la timp</h3>
<p>Producția standard durează între cinci și opt zile lucrătoare după aprobarea machetei. Dacă data este aproape, există execuție urgentă în una până la trei zile cu un supliment, pe care îl alegi direct în comandă.</p>

<h3>Cum decurge</h3>
<p>Alegi numărul de pagini și varianta de text, după care se deschide editorul în care așezi singur fotografiile, sau formularul, dacă textele le scriem noi. Înainte de tipar îți trimitem macheta finală, iar revista intră în producție doar după confirmarea ta.</p>

<p>Ambele reviste ale noastre se află în secțiunea <a href="/ro/category/hlyantsevi-zhurnaly">Reviste lucioase</a>.</p>'
    ),

    'de', jsonb_build_object(
      'name', 'Hochglanzmagazin mit weichem Einband',
      'meta_title', 'Fotomagazin als Geschenk — weicher Einband',
      'meta_description', 'Ein A4 Fotomagazin als Geschenk, aus deinen Fotos und Texten. Von 8 bis 100 Seiten, weicher Hochglanzeinband, gestrichenes Papier 115 g.',
      'short_description', 'Ein Magazin über einen lieben Menschen, gesetzt wie eine echte Hochglanzpublikation. Weicher Einband, von 8 bis 100 Seiten, fertig in fünf bis acht Tagen.',
      'description',
'<p>Ein Fotomagazin ist das Geschenk, das jemand vor deinen Augen durchblättert und darin das eigene Leben sieht, gesetzt wie eine echte Hochglanzpublikation. A4-Format, weicher Hochglanzeinband, gestrichenes Papier im Innenteil, und auf jeder Doppelseite die Fotos und die Texte über den Menschen, dem du es schenkst. Die Auflage beginnt bei einem Exemplar, das hier ist also kein Druckereiauftrag, sondern ein Magazin über einen einzigen Menschen.</p>

<h2>Wem man ein Fotomagazin schenkt</h2>
<p>Am häufigsten wird es zu einem runden Geburtstag bestellt, wenn ein gewöhnliches Geschenk für dreißig oder fünfzig Jahre zu klein wirkt. Der zweite große Anlass ist der Hochzeitstag, wo das Magazin die ganze gemeinsame Geschichte vom ersten Date bis zum letzten Urlaub versammelt. Man schenkt es Müttern und Großmüttern, weil dort Fotos stehen, die sie noch nie gedruckt gesehen haben. Kollegen bekommen eines zum Abschied oder zum Ruhestand, und dann schreibt das ganze Team die Artikel. Zum Abschluss ersetzt das Magazin das Album, weil es Platz für Text hat und nicht nur für Porträts.</p>

<h2>Was darin steckt</h2>
<p>Das Magazin ist wie eine echte Publikation aufgebaut, es hat also einen Einband mit dem Hauptmotiv und einer Schlagzeile, Doppelseiten mit großen Fotos und Textspalten daneben. Du kannst nur die Bilder übergeben oder Artikel, ein Interview, Grüße von mehreren Menschen und eine Bildunterschrift zu jedem Motiv ergänzen. Gerade die Texte unterscheiden ein Magazin von einem Fotoalbum, denn nach einem Jahr erklären sie, warum ein bestimmtes Bild überhaupt dort steht.</p>

<h2>Der weiche Einband und die Bindung</h2>
<p>Der weiche Einband besteht aus gestrichenem Karton mit 130 g und Glanzfinish, er ist biegsam, leichter als ein harter Deckel und gibt dem Magazin den erkennbaren Look echter Presse. Bis vierundvierzig Seiten wird das Magazin wie eine dünne Publikation klammergeheftet, ab vierundvierzig geht es in die Klebebindung und bekommt einen geraden Rücken mit lesbarem Titel. Wenn dir ein Geschenk lieber ist, das wie ein Buch im Regal steht, sieh dir das <a href="/de/catalog/fotozhurnal-tverd-obkladynka">Fotomagazin mit hartem Einband</a> an, bei dem der Inhalt identisch ist und sich nur der Einband unterscheidet.</p>

<h2>Wie viele Seiten du wählen solltest</h2>
<p>Acht oder zwölf Seiten genügen für ein einzelnes Ereignis, etwa eine Reise oder einen Geburtstag, und das ist der günstigste Einstieg. Vierundzwanzig bis vierzig Seiten nimmt man, wenn ein ganzes Jahr oder die komplette Geschichte eines Paares hineinpassen soll, und das ist der beliebteste Bereich. Sechzig bis hundert Seiten werden für ein großes Jubiläum oder für ein Firmenmagazin über das Team bestellt. Rechne mit etwa zwei bis vier Fotos je Doppelseite, wenn die Bilder atmen sollen.</p>

<h2>Wer die Texte schreibt</h2>
<p>Du kannst alles selbst im Editor schreiben, dann wird der Textsatz gesondert berechnet. Wenn dafür die Zeit fehlt oder es wie eine echte Reportage klingen soll, schreiben wir die Texte: nach der Bestellung öffnet sich ein Fragebogen, in dem du ein Basis- oder ein Premiumpaket wählst und uns von dem Menschen und den Ereignissen erzählst. Es gibt auch eine dritte Variante, bei der das Magazin ganz ohne Text auskommt und allein die Fotos arbeiten.</p>

<h2>Häufige Fragen</h2>

<h3>Worin unterscheidet es sich von einem Fotobuch</h3>
<p>Ein Fotobuch ist um die Bilder herum gebaut, ein Magazin um die Geschichte, deshalb hat es Schlagzeilen, Artikel und Bildunterschriften. Ein Magazin ist leichter und dünner, und man liest es, statt es nur anzusehen.</p>

<h3>Wie viele Fotos passen hinein</h3>
<p>Das hängt vom Satz ab, aber zwei bis vier Fotos je Doppelseite sind ein guter Richtwert. Ein Magazin mit vierzig Seiten fasst zusammen mit dem Text bequem rund sechzig Motive.</p>

<h3>Kann ich mehrere gleiche Exemplare bestellen</h3>
<p>Ja, und bei Abschlussfeiern und Firmenmagazinen ist das eine häufige Bitte. Das zweite und jedes weitere Exemplar desselben Layouts kostet weniger, weil der Satz bereits fertig ist.</p>

<h3>Schafft ihr es bis zum Termin</h3>
<p>Die Standardproduktion dauert fünf bis acht Werktage nach der Freigabe des Layouts. Wenn das Datum nah ist, gibt es eine Eilproduktion in ein bis drei Tagen gegen Aufpreis, die du direkt in der Bestellung wählst.</p>

<h3>Wie läuft es ab</h3>
<p>Du wählst die Seitenzahl und die Textvariante, danach öffnet sich der Editor, in dem du die Fotos selbst platzierst, oder der Fragebogen, wenn wir schreiben. Vor dem Druck schicken wir dir das fertige Layout, und das Magazin geht erst nach deiner Freigabe in Produktion.</p>

<p>Beide Magazine findest du im Bereich <a href="/de/category/hlyantsevi-zhurnaly">Hochglanzmagazine</a>.</p>'
    )
  ),

  updated_at = NOW()

WHERE slug = 'personalized-glossy-magazine';

-- ── Hard cover: title symmetry + gift intent only ────────────────────────────
-- The body copy here is left alone; only the fields that made the pair read as
-- rivals rather than as two variants are touched, plus the empty identifiers.

UPDATE products SET

  meta_title = 'Фотожурнал у подарунок — тверда обкладинка',

  meta_description = 'Фотожурнал А4 у подарунок із твоїми фото і текстами. Тверда обкладинка з ламінацією, від 12 до 80 сторінок, глянцевий папір 170 г. Від 675 ₴.',

  sku = 'TM-MAG-HARD',

  status = 'active',

  updated_at = NOW()

WHERE slug = 'fotozhurnal-tverd-obkladynka';
