// Magazine page templates — pre-designed page layouts with text blocks and photo slots
// Used in glossy magazines to provide ready-made editorial pages

export interface PageTemplate {
  id: string;
  label: string;
  group: string;
  tags?: string[]; // 'magazine', 'journal', 'birthday', 'wedding'
  // Page layout
  layout: string; // LayoutType id — 'p-full', 'p-left', 'p-center', etc.
  bgColor?: string;
  // Pre-filled text blocks
  texts: {
    text: string;
    x: number; // % from left
    y: number; // % from top
    fontSize: number;
    fontFamily: string;
    color: string;
    bold: boolean;
    italic?: boolean;
  }[];
  // Photo slot configs (optional — some pages are text-only)
  hasPhoto?: boolean;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ── Вступна сторінка "Привіт, [Ім'я]!" ──
  {
    id: 'pt-hello',
    label: 'Привіт, Ім\'я!',
    group: 'Вступні',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-center',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'Привіт, [Ім\'я]!', x: 50, y: 8, fontSize: 36, fontFamily: 'Dancing Script', color: '#c02030', bold: false },
      { text: 'Цей журнал — маленький подарунок для тебе. Він про тебе.', x: 50, y: 52, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'Дякую, що ти є.', x: 50, y: 82, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'З любов\'ю, [Ім\'я]', x: 50, y: 88, fontSize: 12, fontFamily: 'Dancing Script', color: '#333333', bold: false },
      { text: 'Пам\'ятай, ти неймовірна!', x: 50, y: 95, fontSize: 10, fontFamily: 'Montserrat', color: '#999999', bold: false },
    ],
  },

  // ── About / Про [Ім'я] ──
  {
    id: 'pt-about',
    label: 'About [Ім\'я]',
    group: 'Про людину',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-left',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'about', x: 12, y: 5, fontSize: 18, fontFamily: 'Dancing Script', color: '#c09080', bold: false, italic: true },
      { text: '[Ім\'я]', x: 35, y: 8, fontSize: 42, fontFamily: 'Dancing Script', color: '#c09080', bold: false },
      { text: 'Є люди, які просто мають той самий "внутрішній світлофільтр" — з ними світ виглядає трохи м\'якіше, яскравіше, тепліше.', x: 65, y: 42, fontSize: 11, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'Її суперсила — [суперсила].', x: 65, y: 78, fontSize: 11, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'Це лише початок історії. Найцікавіше — попереду.', x: 65, y: 86, fontSize: 11, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
    ],
  },

  // ── 8 речей, за які ми тебе любимо ──
  {
    id: 'pt-8-reasons',
    label: '8 речей любимо',
    group: 'Списки',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-full',
    bgColor: '#ffffff',
    hasPhoto: false,
    texts: [
      { text: '8 РЕЧЕЙ, ЗА ЯКІ МИ ТЕБЕ ЛЮБИМО', x: 50, y: 12, fontSize: 28, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'ЗА ТВОЮ СПРАВЖНІСТЬ.', x: 25, y: 28, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'Ти не граєш ролей. Ти — це ти.', x: 25, y: 32, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'ЗА ТЕПЛО, ЯКЕ ТИ ДАРУЄШ.', x: 68, y: 36, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'З тобою легко. З тобою затишно.', x: 68, y: 40, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'ЗА ВМІННЯ СЛУХАТИ.', x: 25, y: 48, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'Не просто чути, а розуміти.', x: 25, y: 52, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'ЗА СИЛУ, ЯКУ ТИ НЕ ВИСТАВЛЯЄШ.', x: 65, y: 56, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'Ти тримаєш світ інших.', x: 68, y: 60, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'ЗА ТВОЇ УСМІШКИ.', x: 25, y: 68, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'ЗА ТВОЮ ЕСТЕТИКУ В ДЕТАЛЯХ.', x: 65, y: 76, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'ЗА ТУРБОТУ В ДЕТАЛЯХ.', x: 25, y: 84, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'І ЗА ТЕ, ЩО ТИ ПРОСТО Є.', x: 68, y: 92, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
    ],
  },

  // ── Мистецтво бути поруч ──
  {
    id: 'pt-art-of-being',
    label: 'Мистецтво бути поруч',
    group: 'Стосунки',
    tags: ['magazine', 'journal'],
    layout: 'p-full',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'FASHION MAGAZINE', x: 72, y: 5, fontSize: 8, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'ТАМ, ДЕ ЛЕГКО', x: 50, y: 10, fontSize: 24, fontFamily: 'Cormorant Garamond', color: '#1a1a1a', bold: false },
      { text: 'МИСТЕЦТВО БУТИ ПОРУЧ', x: 65, y: 40, fontSize: 20, fontFamily: 'Playfair Display', color: '#ffffff', bold: true },
      { text: '[Ім\'я] обирає не гучні історії, а глибокі. Не феєрверки — а тишу, в якій усе зрозуміло.', x: 65, y: 55, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#ffffff', bold: false },
      { text: 'THYNK UNLIMITED', x: 15, y: 95, fontSize: 8, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
    ],
  },

  // ── В коханні: ніжність і сила ──
  {
    id: 'pt-love-tenderness',
    label: 'В коханні',
    group: 'Стосунки',
    tags: ['magazine', 'journal'],
    layout: 'p-left',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: '[ІМ\'Я] В КОХАННІ: НІЖНІСТЬ І СИЛА, ЩО ЗАЧАРОВУЮТЬ', x: 50, y: 5, fontSize: 18, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'У коханні [Ім\'я] завжди залишається собою — щирою, відкритою і справжньою.', x: 65, y: 22, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'Кохання — це простір, у якому ти можеш бути собою і щоразу вибирати залишатися.', x: 50, y: 78, fontSize: 12, fontFamily: 'Dancing Script', color: '#8b1a1a', bold: false, italic: true },
    ],
  },

  // ── Під знаком [Зодіаку] ──
  {
    id: 'pt-zodiac',
    label: 'Під знаком зодіаку',
    group: 'Про людину',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-full',
    bgColor: '#ffffff',
    hasPhoto: false,
    texts: [
      { text: 'ПІД ЗНАКОМ', x: 50, y: 12, fontSize: 36, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: '[ЗОДІАК]', x: 50, y: 28, fontSize: 48, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: '[Ім\'я] — це вогонь, що горить постійно. Не для того, щоб знищувати — а щоб освітлювати, надихати, підіймати.', x: 50, y: 48, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'У [Ім\'я] немає напівтону — або повністю в темі, або не витрачає на це й секунди.', x: 50, y: 62, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'Величезне серце, яке завжди б\'ється в ритмі "зараз або ніколи".', x: 50, y: 78, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
    ],
  },

  // ── Дім — це не місце ──
  {
    id: 'pt-home',
    label: 'Дім — це не місце',
    group: 'Сім\'я',
    tags: ['magazine', 'journal'],
    layout: 'p-full',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'Дім — це не місце', x: 50, y: 55, fontSize: 32, fontFamily: 'Dancing Script', color: '#1a1a1a', bold: false },
      { text: 'Дім — це не координати на карті. Це люди. Їхні голоси.', x: 25, y: 68, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: '[Ім\'я] не з тих, хто говорить багато, але кожен її жест — про любов.', x: 25, y: 76, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'Для неї сім\'я — це безумовність.', x: 75, y: 68, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'І попри все, вони завжди на твоїй стороні.', x: 65, y: 80, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
    ],
  },

  // ── Серцем назавжди (Дружба) ──
  {
    id: 'pt-friends',
    label: 'Серцем назавжди',
    group: 'Дружба',
    tags: ['magazine', 'journal'],
    layout: 'p-left',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'Серцем назавжди', x: 60, y: 10, fontSize: 28, fontFamily: 'Playfair Display', color: '#8b1a1a', bold: true },
      { text: 'Є дружба для "погуляти" — легка, випадкова. А є така, як у [Ім\'я]. Та, що будується роками.', x: 72, y: 25, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: '[Ім\'я] вміє дружити чесно. Завжди поруч, коли дійсно треба.', x: 72, y: 45, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'Такі люди не трапляються часто. Але якщо вже трапились — це назавжди.', x: 50, y: 85, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
    ],
  },

  // ── Цитата на весь розворот ──
  {
    id: 'pt-quote-full',
    label: 'Цитата',
    group: 'Цитати',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-full',
    bgColor: '#faf8f5',
    hasPhoto: false,
    texts: [
      { text: '«', x: 20, y: 30, fontSize: 72, fontFamily: 'Playfair Display', color: '#c09080', bold: false },
      { text: 'Можливо все, а що не можливо, просто потребує більше часу', x: 50, y: 50, fontSize: 22, fontFamily: 'Dancing Script', color: '#333333', bold: false, italic: true },
      { text: '»', x: 70, y: 65, fontSize: 72, fontFamily: 'Playfair Display', color: '#c09080', bold: false },
    ],
  },

  // ── Порожня сторінка з заголовком ──
  {
    id: 'pt-chapter-title',
    label: 'Заголовок розділу',
    group: 'Структурні',
    tags: ['magazine', 'journal'],
    layout: 'p-full',
    bgColor: '#ffffff',
    hasPhoto: false,
    texts: [
      { text: 'НАЗВА РОЗДІЛУ', x: 50, y: 45, fontSize: 32, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'Підзаголовок або опис', x: 50, y: 55, fontSize: 14, fontFamily: 'Cormorant Garamond', color: '#888888', bold: false },
    ],
  },

  // ── Фото на весь розворот з цитатою ──
  {
    id: 'pt-photo-quote',
    label: 'Фото + цитата',
    group: 'Цитати',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-full',
    bgColor: '#1a1a1a',
    hasPhoto: true,
    texts: [
      { text: 'Ваша цитата тут', x: 50, y: 85, fontSize: 18, fontFamily: 'Dancing Script', color: '#ffffff', bold: false, italic: true },
      { text: '— [Ім\'я]', x: 50, y: 93, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#cccccc', bold: false },
    ],
  },
];

// ════════════════════════════════════════════════════════
// НОВІ ШАБЛОНИ — додані для різних тематик та кількостей фото
// ════════════════════════════════════════════════════════

// ── Весілля ──
export const WEDDING_TEMPLATES: PageTemplate[] = [
  {
    id: 'pt-wedding-vows',
    label: 'Клятви',
    group: 'Весілля',
    tags: ['magazine', 'journal', 'wedding'],
    layout: 'p-center',
    bgColor: '#fdf8f3',
    hasPhoto: true,
    texts: [
      { text: 'КЛЯТВИ', x: 50, y: 6, fontSize: 10, fontFamily: 'Montserrat', color: '#c8b89a', bold: true },
      { text: '[Ім\'я] & [Ім\'я]', x: 50, y: 14, fontSize: 34, fontFamily: 'Dancing Script', color: '#8b6914', bold: false },
      { text: '"Я обіцяю любити тебе щодня, в радості та горі, сьогодні та назавжди."', x: 50, y: 82, fontSize: 11, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false, italic: true },
      { text: '[дата весілля]', x: 50, y: 92, fontSize: 10, fontFamily: 'Montserrat', color: '#c8b89a', bold: false },
    ],
  },
  {
    id: 'pt-wedding-day',
    label: 'Наш день',
    group: 'Весілля',
    tags: ['magazine', 'journal', 'wedding'],
    layout: 'p-2-h',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'НАШ ДЕНЬ', x: 50, y: 5, fontSize: 10, fontFamily: 'Montserrat', color: '#b8a88a', bold: true },
      { text: '[дата]', x: 50, y: 95, fontSize: 14, fontFamily: 'Dancing Script', color: '#8b6914', bold: false },
    ],
  },
  {
    id: 'pt-wedding-details',
    label: 'Деталі дня',
    group: 'Весілля',
    tags: ['magazine', 'journal', 'wedding'],
    layout: 'p-3-hero-top',
    bgColor: '#fefefe',
    hasPhoto: true,
    texts: [
      { text: 'ДЕТАЛІ, ЯКІ МИ ЗАПАМ\'ЯТАЄМО', x: 50, y: 5, fontSize: 9, fontFamily: 'Montserrat', color: '#999999', bold: true },
      { text: 'Кожна дрібниця була продумана з любов\'ю.', x: 50, y: 95, fontSize: 11, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false, italic: true },
    ],
  },
  {
    id: 'pt-wedding-guests',
    label: 'Наші гості',
    group: 'Весілля',
    tags: ['magazine', 'journal', 'wedding'],
    layout: 'p-4-grid',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'ЛЮДИ, ЯКІ РОЗДІЛИЛИ НАШ ДЕНЬ', x: 50, y: 4, fontSize: 9, fontFamily: 'Montserrat', color: '#aaaaaa', bold: true },
    ],
  },
  {
    id: 'pt-wedding-quote',
    label: 'Цитата про кохання',
    group: 'Весілля',
    tags: ['magazine', 'journal', 'wedding'],
    layout: 'p-full',
    bgColor: '#1c1c1c',
    hasPhoto: false,
    texts: [
      { text: '"Кохання — це не дивитись одне на одного, а дивитись разом в одному напрямку."', x: 50, y: 40, fontSize: 20, fontFamily: 'Cormorant Garamond', color: '#ffffff', bold: false, italic: true },
      { text: '— Антуан де Сент-Екзюпері', x: 50, y: 58, fontSize: 11, fontFamily: 'Montserrat', color: '#aaaaaa', bold: false },
      { text: '[Ім\'я] & [Ім\'я] • [рік]', x: 50, y: 90, fontSize: 12, fontFamily: 'Dancing Script', color: '#c8b89a', bold: false },
    ],
  },
  {
    id: 'pt-wedding-collage',
    label: 'Колаж моментів',
    group: 'Весілля',
    tags: ['magazine', 'journal', 'wedding'],
    layout: 'p-6-grid',
    bgColor: '#f9f6f1',
    hasPhoto: true,
    texts: [
      { text: 'МОМЕНТИ', x: 50, y: 3, fontSize: 9, fontFamily: 'Montserrat', color: '#c8b89a', bold: true },
    ],
  },
];

// ── Дитячий / Family ──
export const FAMILY_TEMPLATES: PageTemplate[] = [
  {
    id: 'pt-baby-first-year',
    label: 'Перший рік',
    group: 'Сім\'я',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-3-hero-top',
    bgColor: '#fff8f0',
    hasPhoto: true,
    texts: [
      { text: 'ПЕРШИЙ РІК ЖИТТЯ', x: 50, y: 4, fontSize: 10, fontFamily: 'Montserrat', color: '#e8a87c', bold: true },
      { text: '[Ім\'я малюка]', x: 50, y: 12, fontSize: 36, fontFamily: 'Caveat', color: '#d4956b', bold: false },
      { text: 'Кожен день — нове відкриття.', x: 50, y: 94, fontSize: 11, fontFamily: 'Cormorant Garamond', color: '#888888', bold: false, italic: true },
    ],
  },
  {
    id: 'pt-family-moments',
    label: 'Сімейні моменти',
    group: 'Сім\'я',
    tags: ['magazine', 'journal'],
    layout: 'p-4-mosaic',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'СІМЕЙНІ МОМЕНТИ', x: 50, y: 3, fontSize: 9, fontFamily: 'Montserrat', color: '#aaaaaa', bold: true },
      { text: '[рік]', x: 50, y: 97, fontSize: 12, fontFamily: 'Dancing Script', color: '#cccccc', bold: false },
    ],
  },
  {
    id: 'pt-family-collage',
    label: 'Наша сім\'я',
    group: 'Сім\'я',
    tags: ['magazine', 'journal'],
    layout: 'p-5-grid',
    bgColor: '#fafafa',
    hasPhoto: true,
    texts: [
      { text: 'НАША СІМ\'Я', x: 50, y: 3, fontSize: 9, fontFamily: 'Montserrat', color: '#aaaaaa', bold: true },
    ],
  },
  {
    id: 'pt-family-quote',
    label: 'Цитата про сім\'ю',
    group: 'Сім\'я',
    tags: ['magazine', 'journal'],
    layout: 'p-center',
    bgColor: '#f5f0e8',
    hasPhoto: true,
    texts: [
      { text: '"Сім\'я — це те місце, де тебе люблять просто так."', x: 50, y: 72, fontSize: 16, fontFamily: 'Cormorant Garamond', color: '#5c4a2a', bold: false, italic: true },
      { text: '[рік] • наша сім\'я', x: 50, y: 85, fontSize: 10, fontFamily: 'Montserrat', color: '#b8a88a', bold: false },
    ],
  },
];

// ── Подорожі ──
export const TRAVEL_TEMPLATES: PageTemplate[] = [
  {
    id: 'pt-travel-hero',
    label: 'Головне фото',
    group: 'Подорожі',
    tags: ['magazine', 'journal'],
    layout: 'p-full',
    bgColor: '#1a1a2e',
    hasPhoto: true,
    texts: [
      { text: '[МІСТО / КРАЇНА]', x: 50, y: 10, fontSize: 28, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: '[місяць рік]', x: 50, y: 20, fontSize: 12, fontFamily: 'Cormorant Garamond', color: 'rgba(255,255,255,0.7)', bold: false },
      { text: '📍 [координати або опис місця]', x: 50, y: 90, fontSize: 10, fontFamily: 'Montserrat', color: 'rgba(255,255,255,0.6)', bold: false },
    ],
  },
  {
    id: 'pt-travel-day',
    label: 'День подорожі',
    group: 'Подорожі',
    tags: ['magazine', 'journal'],
    layout: 'p-2-big-top',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'ДЕНЬ [N]', x: 50, y: 4, fontSize: 10, fontFamily: 'Montserrat', color: '#aaaaaa', bold: true },
      { text: '[опис дня]', x: 50, y: 88, fontSize: 11, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false, italic: true },
      { text: '[місце]', x: 50, y: 95, fontSize: 10, fontFamily: 'Montserrat', color: '#aaaaaa', bold: false },
    ],
  },
  {
    id: 'pt-travel-grid',
    label: 'Сітка вражень',
    group: 'Подорожі',
    tags: ['magazine', 'journal'],
    layout: 'p-3-row',
    bgColor: '#f8f8f8',
    hasPhoto: true,
    texts: [
      { text: 'ВРАЖЕННЯ', x: 50, y: 3, fontSize: 9, fontFamily: 'Montserrat', color: '#aaaaaa', bold: true },
      { text: '[місце] • [рік]', x: 50, y: 97, fontSize: 10, fontFamily: 'Dancing Script', color: '#888888', bold: false },
    ],
  },
  {
    id: 'pt-travel-collage',
    label: 'Колаж подорожі',
    group: 'Подорожі',
    tags: ['magazine', 'journal'],
    layout: 'p-5-mosaic',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: '[МІСТО]', x: 50, y: 3, fontSize: 12, fontFamily: 'Montserrat', color: '#333333', bold: true },
    ],
  },
  {
    id: 'pt-travel-quote',
    label: 'Подорожня цитата',
    group: 'Подорожі',
    tags: ['magazine', 'journal'],
    layout: 'p-full',
    bgColor: '#0d1b2a',
    hasPhoto: false,
    texts: [
      { text: '"Подорожуй — поки є час, поки є сили, поки є бажання."', x: 50, y: 38, fontSize: 20, fontFamily: 'Cormorant Garamond', color: '#ffffff', bold: false, italic: true },
      { text: '[місто, країна]', x: 50, y: 55, fontSize: 14, fontFamily: 'Montserrat', color: 'rgba(255,255,255,0.5)', bold: false },
      { text: '[рік]', x: 50, y: 90, fontSize: 12, fontFamily: 'Dancing Script', color: 'rgba(255,255,255,0.4)', bold: false },
    ],
  },
  {
    id: 'pt-travel-route',
    label: 'Маршрут',
    group: 'Подорожі',
    tags: ['magazine', 'journal'],
    layout: 'p-text',
    bgColor: '#f5f0e8',
    hasPhoto: false,
    texts: [
      { text: 'МАРШРУТ', x: 50, y: 8, fontSize: 12, fontFamily: 'Montserrat', color: '#8b6914', bold: true },
      { text: 'День 1 — [місто]', x: 50, y: 25, fontSize: 14, fontFamily: 'Playfair Display', color: '#333333', bold: false },
      { text: 'День 2 — [місто]', x: 50, y: 35, fontSize: 14, fontFamily: 'Playfair Display', color: '#333333', bold: false },
      { text: 'День 3 — [місто]', x: 50, y: 45, fontSize: 14, fontFamily: 'Playfair Display', color: '#333333', bold: false },
      { text: 'День 4 — [місто]', x: 50, y: 55, fontSize: 14, fontFamily: 'Playfair Display', color: '#333333', bold: false },
      { text: 'День 5 — [місто]', x: 50, y: 65, fontSize: 14, fontFamily: 'Playfair Display', color: '#333333', bold: false },
      { text: 'Загалом: [N] км • [N] міст • безліч вражень', x: 50, y: 82, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#888888', bold: false, italic: true },
    ],
  },
];

// ── День народження ──
export const BIRTHDAY_TEMPLATES: PageTemplate[] = [
  {
    id: 'pt-bday-hero-photo',
    label: 'Головне фото',
    group: 'День народження',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-full',
    bgColor: '#1a1a1a',
    hasPhoto: true,
    texts: [
      { text: '[ІМ\'Я]', x: 50, y: 8, fontSize: 42, fontFamily: 'Playfair Display', color: '#ffffff', bold: true },
      { text: '[N] РОКІВ', x: 50, y: 18, fontSize: 14, fontFamily: 'Montserrat', color: 'rgba(255,255,255,0.6)', bold: true },
    ],
  },
  {
    id: 'pt-bday-memories',
    label: 'Спогади року',
    group: 'День народження',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-3-top2',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'ЦЕЙ РІК БУВ ОСОБЛИВИМ', x: 50, y: 4, fontSize: 9, fontFamily: 'Montserrat', color: '#aaaaaa', bold: true },
      { text: '[найяскравіший момент року]', x: 50, y: 94, fontSize: 12, fontFamily: 'Dancing Script', color: '#666666', bold: false, italic: true },
    ],
  },
  {
    id: 'pt-bday-wishes',
    label: 'Побажання',
    group: 'День народження',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-text',
    bgColor: '#fff8f0',
    hasPhoto: false,
    texts: [
      { text: 'ПОБАЖАННЯ', x: 50, y: 8, fontSize: 12, fontFamily: 'Montserrat', color: '#e8a87c', bold: true },
      { text: 'Бажаємо тобі...', x: 50, y: 22, fontSize: 16, fontFamily: 'Dancing Script', color: '#d4956b', bold: false },
      { text: '✦ Здоров\'я та сил', x: 50, y: 35, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '✦ Кохання та тепла', x: 50, y: 45, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '✦ Мрій, що здійснюються', x: 50, y: 55, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '✦ Людей, що надихають', x: 50, y: 65, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '✦ Щастя у дрібницях', x: 50, y: 75, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'З любов\'ю, [хто підписав] ♥', x: 50, y: 88, fontSize: 14, fontFamily: 'Dancing Script', color: '#d4956b', bold: false },
    ],
  },
  {
    id: 'pt-bday-collage-4',
    label: '4 фото року',
    group: 'День народження',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-4-grid',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: 'НАЙКРАЩІ МОМЕНТИ [РОКУ]', x: 50, y: 3, fontSize: 8, fontFamily: 'Montserrat', color: '#aaaaaa', bold: true },
    ],
  },
  {
    id: 'pt-bday-facts',
    label: 'Факти про тебе',
    group: 'День народження',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-center',
    bgColor: '#f8f4ff',
    hasPhoto: true,
    texts: [
      { text: '[N] ФАКТІВ ПРО ТЕБЕ', x: 50, y: 6, fontSize: 11, fontFamily: 'Montserrat', color: '#8b5cf6', bold: true },
      { text: '1. [факт]', x: 50, y: 68, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: '2. [факт]', x: 50, y: 75, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: '3. [факт]', x: 50, y: 82, fontSize: 12, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
    ],
  },
];

// ── Цитати ──
export const QUOTE_TEMPLATES: PageTemplate[] = [
  {
    id: 'pt-quote-dark',
    label: 'Цитата темна',
    group: 'Цитати',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-full',
    bgColor: '#1c1c1c',
    hasPhoto: false,
    texts: [
      { text: '"', x: 50, y: 20, fontSize: 80, fontFamily: 'Playfair Display', color: 'rgba(255,255,255,0.15)', bold: true },
      { text: '[Ваша цитата тут]', x: 50, y: 50, fontSize: 22, fontFamily: 'Cormorant Garamond', color: '#ffffff', bold: false, italic: true },
      { text: '— [Автор]', x: 50, y: 65, fontSize: 12, fontFamily: 'Montserrat', color: 'rgba(255,255,255,0.5)', bold: false },
    ],
  },
  {
    id: 'pt-quote-light',
    label: 'Цитата світла',
    group: 'Цитати',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-full',
    bgColor: '#faf6f0',
    hasPhoto: false,
    texts: [
      { text: '❝', x: 50, y: 22, fontSize: 48, fontFamily: 'Playfair Display', color: '#e8d5b0', bold: false },
      { text: '[Ваша цитата тут]', x: 50, y: 50, fontSize: 20, fontFamily: 'Cormorant Garamond', color: '#3a3a3a', bold: false, italic: true },
      { text: '— [Автор]', x: 50, y: 65, fontSize: 12, fontFamily: 'Montserrat', color: '#999999', bold: false },
    ],
  },
  {
    id: 'pt-quote-with-photo',
    label: 'Цитата з фото',
    group: 'Цитати',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-2-big-top',
    bgColor: '#ffffff',
    hasPhoto: true,
    texts: [
      { text: '"[цитата]"', x: 50, y: 82, fontSize: 16, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false, italic: true },
      { text: '— [Автор / Ім\'я]', x: 50, y: 92, fontSize: 11, fontFamily: 'Montserrat', color: '#999999', bold: false },
    ],
  },
  {
    id: 'pt-quote-minimal',
    label: 'Мінімалізм',
    group: 'Цитати',
    tags: ['magazine', 'journal'],
    layout: 'p-text',
    bgColor: '#ffffff',
    hasPhoto: false,
    texts: [
      { text: '[Одне слово або коротка думка]', x: 50, y: 45, fontSize: 30, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: false, italic: true },
      { text: '———', x: 50, y: 58, fontSize: 14, fontFamily: 'Montserrat', color: '#cccccc', bold: false },
      { text: '[Ім\'я / Дата]', x: 50, y: 66, fontSize: 11, fontFamily: 'Montserrat', color: '#aaaaaa', bold: false },
    ],
  },
];

// ── Структурні / Навігаційні ──
export const STRUCTURAL_TEMPLATES: PageTemplate[] = [
  {
    id: 'pt-section-dark',
    label: 'Розділ темний',
    group: 'Структурні',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-full',
    bgColor: '#1a1a2e',
    hasPhoto: false,
    texts: [
      { text: 'РОЗДІЛ [N]', x: 50, y: 35, fontSize: 11, fontFamily: 'Montserrat', color: 'rgba(255,255,255,0.4)', bold: true },
      { text: '[Назва розділу]', x: 50, y: 48, fontSize: 36, fontFamily: 'Playfair Display', color: '#ffffff', bold: false },
      { text: '[опис або підзаголовок]', x: 50, y: 60, fontSize: 13, fontFamily: 'Cormorant Garamond', color: 'rgba(255,255,255,0.6)', bold: false, italic: true },
    ],
  },
  {
    id: 'pt-section-photo',
    label: 'Розділ з фото',
    group: 'Структурні',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-full',
    bgColor: '#000000',
    hasPhoto: true,
    texts: [
      { text: '[НАЗВА РОЗДІЛУ]', x: 50, y: 85, fontSize: 28, fontFamily: 'Montserrat', color: '#ffffff', bold: true },
      { text: '[підзаголовок]', x: 50, y: 94, fontSize: 12, fontFamily: 'Cormorant Garamond', color: 'rgba(255,255,255,0.7)', bold: false, italic: true },
    ],
  },
  {
    id: 'pt-timeline',
    label: 'Таймлайн',
    group: 'Структурні',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-text',
    bgColor: '#fafafa',
    hasPhoto: false,
    texts: [
      { text: 'НАША ІСТОРІЯ', x: 50, y: 6, fontSize: 11, fontFamily: 'Montserrat', color: '#333333', bold: true },
      { text: '[рік] — [подія]', x: 50, y: 20, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '[рік] — [подія]', x: 50, y: 30, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '[рік] — [подія]', x: 50, y: 40, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '[рік] — [подія]', x: 50, y: 50, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '[рік] — [подія]', x: 50, y: 60, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: '[рік] — [подія]', x: 50, y: 70, fontSize: 13, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'і це лише початок...', x: 50, y: 85, fontSize: 16, fontFamily: 'Dancing Script', color: '#aaaaaa', bold: false, italic: true },
    ],
  },
  {
    id: 'pt-stats',
    label: 'Цифри року',
    group: 'Структурні',
    tags: ['magazine', 'journal', 'birthday'],
    layout: 'p-text',
    bgColor: '#f8f4ff',
    hasPhoto: false,
    texts: [
      { text: '[ІМ\'Я] У ЦИФРАХ', x: 50, y: 7, fontSize: 11, fontFamily: 'Montserrat', color: '#8b5cf6', bold: true },
      { text: '[N]', x: 25, y: 28, fontSize: 48, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'РОКІВ', x: 25, y: 38, fontSize: 9, fontFamily: 'Montserrat', color: '#8b5cf6', bold: true },
      { text: '[N]', x: 68, y: 28, fontSize: 48, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'МІСТ', x: 68, y: 38, fontSize: 9, fontFamily: 'Montserrat', color: '#8b5cf6', bold: true },
      { text: '[N]', x: 25, y: 62, fontSize: 48, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: true },
      { text: 'МРІЙ', x: 25, y: 72, fontSize: 9, fontFamily: 'Montserrat', color: '#8b5cf6', bold: true },
      { text: '∞', x: 68, y: 62, fontSize: 48, fontFamily: 'Playfair Display', color: '#1a1a1a', bold: false },
      { text: 'ЛЮБОВІ', x: 68, y: 72, fontSize: 9, fontFamily: 'Montserrat', color: '#8b5cf6', bold: true },
    ],
  },
];

// ── Фінальні сторінки ──
export const FINAL_TEMPLATES: PageTemplate[] = [
  {
    id: 'pt-the-end',
    label: 'Кінець (темний)',
    group: 'Фінальні',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-full',
    bgColor: '#111111',
    hasPhoto: false,
    texts: [
      { text: 'THE END', x: 50, y: 45, fontSize: 42, fontFamily: 'Playfair Display', color: '#ffffff', bold: false, italic: true },
      { text: '— але це тільки початок', x: 50, y: 58, fontSize: 14, fontFamily: 'Dancing Script', color: 'rgba(255,255,255,0.5)', bold: false },
      { text: '[рік]', x: 50, y: 88, fontSize: 12, fontFamily: 'Montserrat', color: 'rgba(255,255,255,0.2)', bold: false },
    ],
  },
  {
    id: 'pt-thank-you',
    label: 'Дякую',
    group: 'Фінальні',
    tags: ['magazine', 'journal', 'birthday', 'wedding'],
    layout: 'p-center',
    bgColor: '#fdf8f3',
    hasPhoto: true,
    texts: [
      { text: 'Дякую, що ти є.', x: 50, y: 72, fontSize: 28, fontFamily: 'Dancing Script', color: '#8b6914', bold: false },
      { text: 'Цей журнал — лише маленька частина того, що я відчуваю.', x: 50, y: 82, fontSize: 11, fontFamily: 'Cormorant Garamond', color: '#888888', bold: false, italic: true },
      { text: 'З любов\'ю, [ім\'я] ♥', x: 50, y: 91, fontSize: 13, fontFamily: 'Dancing Script', color: '#c8b89a', bold: false },
    ],
  },
  {
    id: 'pt-to-be-continued',
    label: 'Продовження...',
    group: 'Фінальні',
    tags: ['magazine', 'journal'],
    layout: 'p-text',
    bgColor: '#1a1a2e',
    hasPhoto: false,
    texts: [
      { text: 'продовження слідує...', x: 50, y: 45, fontSize: 32, fontFamily: 'Dancing Script', color: '#ffffff', bold: false, italic: true },
      { text: '[рік] • Том [N]', x: 50, y: 60, fontSize: 11, fontFamily: 'Montserrat', color: 'rgba(255,255,255,0.4)', bold: false },
    ],
  },
];

// ── Експортуємо всі нові шаблони разом зі старими ──
// Додаємо нові шаблони до PAGE_TEMPLATES
PAGE_TEMPLATES.push(
  ...WEDDING_TEMPLATES,
  ...FAMILY_TEMPLATES,
  ...TRAVEL_TEMPLATES,
  ...BIRTHDAY_TEMPLATES,
  ...QUOTE_TEMPLATES,
  ...STRUCTURAL_TEMPLATES,
  ...FINAL_TEMPLATES,
);
