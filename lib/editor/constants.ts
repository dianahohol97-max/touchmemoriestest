
//  Layout definitions 

// NOTE: a stale `LAYOUTS: LayoutDef[]` export lived here and was removed on
// 2026-08-31. It had no consumers — the editor uses its own LAYOUTS in
// components/BookLayoutEditor.tsx — and it had drifted: ten of its ids
// (p-5-col-hero, p-5-l-hero, p-5-r-hero, p-6-2col, p-6-hero-bot, p-10-grid,
// p-12-grid, p-12-3x4, p-15-grid, p-16-grid) exist in no LayoutType union and
// have no geometry in slot-defs.ts, so they could never have rendered. It was
// invisible because LayoutType in ./types was typed `string`.
//
// Moving the editor's real LAYOUTS here was floated as the natural follow-up
// and then deliberately dropped: nothing outside BookLayoutEditor consumes
// that list (the template picker reads PAGE_TEMPLATES from its own module),
// so relocating it would be churn with no consumer on the other side. Left
// where it is on purpose — this note is here so the idea does not get
// rediscovered and acted on.

//  Page proportions 

export const PAGE_PROPORTIONS: Record<string, { w: number; h: number }> = {
  '20x20': { w: 200, h: 200 }, '20×20': { w: 200, h: 200 },
  '25x25': { w: 250, h: 250 }, '25×25': { w: 250, h: 250 },
  '20x30': { w: 200, h: 300 }, '20×30': { w: 200, h: 300 },
  '30x20': { w: 300, h: 200 }, '30×20': { w: 300, h: 200 },
  '30x30': { w: 300, h: 300 }, '30×30': { w: 300, h: 300 },
  'A4': { w: 210, h: 297 },
  '23x23': { w: 230, h: 230 }, '23×23': { w: 230, h: 230 },
  'magazine-A4': { w: 210, h: 297 },
  // Travel Book: sold as «20×30», but the print partner's file check demands
  // pages of EXACTLY 210×297 mm (Diana, 2026-08-06) — the editor must draw
  // the same proportion or every slot crop shifts at print time.
  'travelbook': { w: 210, h: 297 },
};

//  Color maps (single source of truth) 

export const VELOUR_COLORS: Record<string, string> = {
  'Молочний':'#F0EAD6','Бежевий':'#D9C8B0','Таупе':'#7C7167','Рожевий':'#E8B4B8',
  'Бордо':'#7A2838','Сірий перловий':'#9A9898','Лаванда':'#B8A8C8','Синій':'#1A2040',
  'Графітовий':'#3A3038','Бірюзовий':'#1A9090','Фіолетовий':'#8C2D80','Блакитно-сірий':'#607080',
  'Темно-зелений':'#1A6A53','Жовтий':'#D4A020','Чорний':'#1A1A1A',
};

export const LEATHERETTE_COLORS: Record<string, string> = {
  'Білий':'#F5F5F0','Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Рудий':'#C8844E',
  'Бордо темний':'#7A2838','Золотистий':'#C4A83A','Теракотовий':'#C25A3C','Жовтий':'#F0B820',
  'Рожевий ніжний':'#E8B4B8','Фуксія':'#D84080','Червоний насичений':'#A01030',
  'Коричневий':'#8E5038','Вишневий':'#7A2020','Марсала':'#6E2840','Графітовий темний':'#3A3038',
  'Фіолетовий яскравий':'#8030A0','Фіолетовий темний':'#502060','Бірюзовий':'#4E9090',
  'Оливковий':'#A0A030','Темно-зелений':'#1E3028','Бірюзовий яскравий':'#00B0B0',
  'Блакитний яскравий':'#0088D0','Темно-синій':'#1A2040','Чорний':'#1A1A1A','Персиковий':'#E8A8A0',
};

export const FABRIC_COLORS: Record<string, string> = {
  'Бежевий/пісочний':'#C4AA88','Теракотовий/цегляний':'#A04838','Фуксія/пурпурний':'#B838A0',
  'Фіолетовий темний':'#582050','Марсала/бордо':'#602838','Коричневий':'#6E4830',
  'Сірий/графітовий':'#586058','Червоний яскравий':'#C02030','Оливковий/зелений':'#A0A020',
};

//  Decoration variants 

export const ACRYLIC_VARIANTS: Record<string, string[]> = {
  '20x20':['100×100 мм','Ø145 мм'],
  '25x25':['100×100 мм','Ø145 мм'],
  '20x30':['100×100 мм','Ø145 мм'],
  '30x20':['100×100 мм','Ø145 мм'],
  '30x30':['100×100 мм','Ø145 мм','290×100 мм','215×290 мм'],
};

export const PHOTO_INSERT_VARIANTS: Record<string, string[]> = {
  '20x20':['100×100 мм'],'25x25':['100×100 мм'],
  '20x30':['100×100 мм'],'30x20':['100×100 мм'],
  '30x30':['197×197 мм','100×100 мм'],
};

export const METAL_VARIANTS: Record<string, string[]> = {
  '20x20':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '25x25':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '20x30':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний'],
  '30x20':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний','250×70 золотий','250×70 срібний'],
  '30x30':['60×60 золотий','60×60 срібний','90×50 золотий','90×50 срібний','250×70 золотий','250×70 срібний'],
};

export const FLEX_COLORS = [
  { label:'Золотий', value:'gold', color:'#D4AF37' },
  { label:'Срібний', value:'silver', color:'#C0C0C0' },
  { label:'Білий',   value:'white', color:'#FFFFFF' },
  { label:'Чорний',  value:'black', color:'#1A1A1A' },
];

export const METAL_COLORS = [
  { label:'Золотий', value:'gold',   color:'#D4AF37' },
  { label:'Срібний', value:'silver', color:'#C0C0C0' },
];

//  Text colors palette 

export const TEXT_COLORS = [
  '#1e2d7d','#000000','#ffffff','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899',
  '#6b7280','#92400e','#065f46','#1e3a5f','#7c2d12','#4c1d95',
];

//  Font groups 

export const CYRILLIC_DECORATIVE_FONTS = [
  { label:'Marck Script', value:'Marck Script', style:'cursive' },
  { label:'Caveat', value:'Caveat', style:'cursive' },
  { label:'Comfortaa', value:'Comfortaa', style:'rounded' },
  { label:'Philosopher', value:'Philosopher', style:'serif' },
  { label:'Cormorant Garamond', value:'Cormorant Garamond', style:'elegant' },
  { label:'Montserrat', value:'Montserrat', style:'sans' },
  { label:'Lobster', value:'Lobster', style:'cursive' },
  { label:'Pacifico', value:'Pacifico', style:'cursive' },
  { label:'Rubik', value:'Rubik', style:'rounded' },
  { label:'Nunito', value:'Nunito', style:'rounded' },
  { label:'Ubuntu', value:'Ubuntu', style:'sans' },
];

/**
 * Кожен шрифт: назва і прапорець кирилиці.
 *
 * `cyr` вирішує, чи пропонувати шрифт у підбірці (`FONT_GROUPS` нижче фільтрує
 * ним), і він МУСИТЬ збігатися з фактом про файли. Чотири родини стояли з
 * `cyr: true` без жодного кириличного гліфа: Lato, Poppins і Schibsted Grotesk
 * (Google не віддає для них кириличної підмножини, і в апстрімі google/fonts її
 * теж немає) та Kyiv Type Sans, якої Google не віддає взагалі. Український
 * текст у них весь цей час малювався системним шрифтом — на кожній машині
 * своїм, а в друці третім. Lato стоїть у дванадцяти збережених макетах,
 * Poppins у чотирьох.
 *
 * Самі назви з переліку НЕ прибрані: макет, збережений із таким шрифтом, має
 * відкриватися й рендеритися далі. Змінилося те, що новий макет цього шрифту
 * для українського тексту вже не отримає, а старий каже про себе — у переліку
 * перед «Додати в кошик» і в перевірці макетів в адмінці.
 *
 * Факт береться з файлів (`FONTS_WITH_CYRILLIC` у `lib/editor/font-scripts.ts`),
 * і `tests/editor-fonts-pack.test.ts` не дає `cyr: true` розійтися з ним знову.
 * Зворотний бік — `cyr: false` при наявній кирилиці — тест пропускає навмисне:
 * Great Vibes, Dela Gothic One і El Messiri кирилицю мають, але з підбірки
 * прибрані, і повертати їх туди — окреме рішення про товар, а не про код.
 */
export const FONT_DATA: { name: string; cyr: boolean }[] = [
  // Сучасні (20)
  { name: 'Montserrat', cyr: true }, { name: 'Inter', cyr: true }, { name: 'Lato', cyr: false },
  { name: 'Raleway', cyr: true }, { name: 'Nunito', cyr: true }, { name: 'Poppins', cyr: false },
  { name: 'Oswald', cyr: true }, { name: 'Josefin Sans', cyr: false }, { name: 'Rubik', cyr: true },
  { name: 'Ubuntu', cyr: true }, { name: 'Exo 2', cyr: true }, { name: 'Jost', cyr: true },
  { name: 'Manrope', cyr: true }, { name: 'Roboto', cyr: true }, { name: 'Fira Sans', cyr: true },
  { name: 'Source Sans 3', cyr: true }, { name: 'Noto Sans', cyr: true }, { name: 'Outfit', cyr: false },
  { name: 'DM Sans', cyr: false }, { name: 'Plus Jakarta Sans', cyr: false },
  // Класичні (14)
  { name: 'Playfair Display', cyr: true }, { name: 'Cormorant Garamond', cyr: true },
  { name: 'EB Garamond', cyr: true }, { name: 'Libre Baskerville', cyr: false },
  { name: 'Lora', cyr: true }, { name: 'Merriweather', cyr: true },
  { name: 'PT Serif', cyr: true }, { name: 'Noto Serif', cyr: true },
  { name: 'Crimson Text', cyr: false }, { name: 'Cormorant', cyr: true },
  { name: 'Old Standard TT', cyr: true }, { name: 'Literata', cyr: true },
  { name: 'Bitter', cyr: true }, { name: 'Vollkorn', cyr: true },
  // Рукописні (22)
  { name: 'Dancing Script', cyr: false }, { name: 'Great Vibes', cyr: false },
  { name: 'Pacifico', cyr: true }, { name: 'Sacramento', cyr: false },
  { name: 'Satisfy', cyr: false }, { name: 'Caveat', cyr: true },
  { name: 'Marck Script', cyr: true }, { name: 'Bad Script', cyr: true },
  { name: 'Neucha', cyr: true }, { name: 'Pangolin', cyr: true },
  { name: 'Ruslan Display', cyr: true }, { name: 'Amatic SC', cyr: true },
  { name: 'Indie Flower', cyr: false }, { name: 'Kalam', cyr: false },
  { name: 'Patrick Hand', cyr: false }, { name: 'Shadows Into Light', cyr: false },
  { name: 'Permanent Marker', cyr: false }, { name: 'Handlee', cyr: false },
  { name: 'Architects Daughter', cyr: false }, { name: 'Reenie Beanie', cyr: false },
  { name: 'Comforter', cyr: true }, { name: 'Tektur', cyr: true },
  // NEW cyrillic handwriting
  { name: 'Cormorant Unicase', cyr: true }, { name: 'Podkova', cyr: true },
  { name: 'Seymour One', cyr: true }, { name: 'Shantell Sans', cyr: true },
  { name: 'Comforter Brush', cyr: true }, { name: 'Kyiv Type Sans', cyr: false },
  { name: 'Wix Madefor Text', cyr: true }, { name: 'Schibsted Grotesk', cyr: false },
  // Декоративні (30)
  { name: 'Abril Fatface', cyr: false }, { name: 'Cinzel', cyr: false },
  { name: 'Bebas Neue', cyr: false }, { name: 'Righteous', cyr: false },
  { name: 'Cormorant SC', cyr: true }, { name: 'Dela Gothic One', cyr: false },
  { name: 'Unbounded', cyr: true }, { name: 'Kelly Slab', cyr: true },
  { name: 'Philosopher', cyr: true }, { name: 'Russo One', cyr: true },
  { name: 'Comfortaa', cyr: true }, { name: 'Lobster', cyr: true },
  { name: 'Poiret One', cyr: true }, { name: 'Yeseva One', cyr: true },
  { name: 'Press Start 2P', cyr: true }, { name: 'Spectral', cyr: true },
  { name: 'Alegreya', cyr: true }, { name: 'Alegreya SC', cyr: true },
  { name: 'Open Sans', cyr: true }, { name: 'Kurale', cyr: true },
  { name: 'Tenor Sans', cyr: true }, { name: 'Forum', cyr: true },
  { name: 'Oranienbaum', cyr: true }, { name: 'Bellota', cyr: true },
  // NEW cyrillic decorative
  { name: 'Playfair Display SC', cyr: true }, { name: 'Prosto One', cyr: true },
  { name: 'Stalinist One', cyr: true }, { name: 'Underdog', cyr: true },
  { name: 'Gabriela', cyr: true }, { name: 'Cormorant Infant', cyr: true },
  { name: 'Cinzel Decorative', cyr: false }, { name: 'El Messiri', cyr: false },
  { name: 'Marmelad', cyr: true }, { name: 'Ledger', cyr: true },
];

/**
 * Родини, яких Google Fonts не віддає взагалі.
 *
 * Окремий запит на `Kyiv Type Sans` повертає «400: Font family not found», а в
 * спільному запиті на всі 98 родин Google просто мовчки викидає цю назву й
 * віддає 97 інших — тобто збірка не падає, помилки немає, і дізнатися можна
 * тільки перелічивши родини у відповіді. Назва лишається в `FONT_DATA` навмисне:
 * прибрати її звідси означало б, що збережений макет із нею втратить шрифт ще й
 * на відкритті. Натомість її не просять ні в css2, ні в локальному пакеті, і
 * `tests/editor-fonts-pack.test.ts` не вимагає для неї файлів.
 */
export const FONTS_NOT_ON_GOOGLE = new Set<string>(['Kyiv Type Sans']);

const FONT_GROUPS_ALL = [
  { group: 'Сучасні', fonts: ['Montserrat','Inter','Lato','Raleway','Nunito','Poppins','Oswald','Josefin Sans','Rubik','Ubuntu','Exo 2','Jost','Manrope','Roboto','Fira Sans','Source Sans 3','Noto Sans','Outfit','DM Sans','Plus Jakarta Sans'] },
  { group: 'Класичні', fonts: ['Playfair Display','Cormorant Garamond','EB Garamond','Libre Baskerville','Lora','Merriweather','PT Serif','Noto Serif','Crimson Text','Cormorant','Old Standard TT','Literata','Bitter','Vollkorn'] },
  { group: 'Рукописні', fonts: ['Dancing Script','Great Vibes','Pacifico','Sacramento','Satisfy','Caveat','Marck Script','Bad Script','Neucha','Pangolin','Ruslan Display','Amatic SC','Indie Flower','Kalam','Patrick Hand','Shadows Into Light','Permanent Marker','Handlee','Architects Daughter','Reenie Beanie','Comforter','Tektur','Cormorant Unicase','Podkova','Seymour One','Shantell Sans','Comforter Brush','Kyiv Type Sans','Wix Madefor Text','Schibsted Grotesk'] },
  { group: 'Декоративні', fonts: ['Abril Fatface','Cinzel','Bebas Neue','Righteous','Cormorant SC','Dela Gothic One','Unbounded','Kelly Slab','Philosopher','Russo One','Comfortaa','Lobster','Poiret One','Yeseva One','Alegreya','Alegreya SC','Press Start 2P','Spectral','Kurale','Tenor Sans','Forum','Oranienbaum','Bellota','Playfair Display SC','Prosto One','Stalinist One','Underdog','Gabriela','Cormorant Infant','Cinzel Decorative','El Messiri','Marmelad','Ledger'] },
];

// Only offer fonts that actually render Cyrillic. These constructors produce
// Ukrainian captions, and a Latin-only font silently falls back / shows tofu for
// Cyrillic text — which is why some fonts "didn't read Cyrillic". Latin-only
// faces are dropped from the picker (kept in FONT_GROUPS_ALL for reference).
const _cyrFontNames = new Set(FONT_DATA.filter(f => f.cyr).map(f => f.name));
export const FONT_GROUPS = FONT_GROUPS_ALL
  .map(g => ({ ...g, fonts: g.fonts.filter(f => _cyrFontNames.has(f)) }))
  .filter(g => g.fonts.length > 0);

/**
 * Звідки береться вся підбірка шрифтів — і в конструкторі, і в макеті для друку.
 *
 * Це локальна копія рівно тих файлів, які віддає Google css2, з нашого ж
 * походження. Файли і дескриптори збігаються один в один (`font-weight: 400`,
 * `font-style: normal`, ті самі `unicode-range`), тому перехід не змінив нічого
 * на вигляд: піксельне порівняння того самого рядка в Chromium дає однаковий
 * хеш знімка в кожній родині.
 *
 * Чому мережі тут більше немає. Макет для друку знімає headless Chromium на
 * Railway, і шрифти качав він сам, а невдалий запит нічим себе не виявляв:
 * `document.fonts.ready` резолвиться і тоді, коли файл упав. Виміряно в тому
 * самому Chromium — із заблокованою таблицею стилів жодної грані немає, а
 * `document.fonts.check()` для будь-якої родини відповідає `true`, тобто й
 * найочевидніша наступна перевірка сліпа. Знімок виходив у підставленому
 * накресленні й ішов у друк таким.
 *
 * Екран тепер бере ті самі файли, що й друк, тож розійтися їм більше ні на чому.
 * Колишня `GOOGLE_FONTS_URL` прибрана навмисне: доки вона існувала, повернути
 * мережу в цей шлях можна було одним рядком. Збирає пакет
 * `scripts/build-editor-fonts.py`, а `tests/editor-fonts-pack.test.ts` не дає
 * додати шрифт у підбірку без файлів і не дає з'явитися новому посиланню на
 * fonts.googleapis.com у конструкторі чи в друці.
 *
 * Що НЕ переведено і лишається на мережі, бо просить родини поза цією підбіркою:
 * `components/CoverEditor.tsx` (Pinyon Script, Alex Brush, Italianno),
 * `components/PhotoPrintConstructor.tsx`, `components/ui/InscriptionDesigner.tsx`,
 * `app/admin/orders/[id]/page.tsx` і два конструктори з `@import` у CSS —
 * guestbook і photoalbum.
 */
export const EDITOR_FONTS_CSS_URL = '/editor-fonts/fonts.css';

//  Printed cover background presets 

export const PRINTED_BG_PRESETS = [
  '#ffffff','#f1f5f9','#0a0e1a','#050a18','#1e2d7d','#263a99',
  '#fef3c7','#fce7f3','#f0fdf4','#fff7ed','#1a1a2e','#16213e',
];
