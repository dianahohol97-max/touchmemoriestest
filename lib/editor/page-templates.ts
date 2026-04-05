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
      { text: 'ЗА ТЕПЛО, ЯКЕ ТИ ДАРУЄШ.', x: 75, y: 36, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'З тобою легко. З тобою затишно.', x: 75, y: 40, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'ЗА ВМІННЯ СЛУХАТИ.', x: 25, y: 48, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'Не просто чути, а розуміти.', x: 25, y: 52, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'ЗА СИЛУ, ЯКУ ТИ НЕ ВИСТАВЛЯЄШ.', x: 75, y: 56, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'Ти тримаєш світ інших.', x: 75, y: 60, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#555555', bold: false },
      { text: 'ЗА ТВОЇ УСМІШКИ.', x: 25, y: 68, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'ЗА ТВОЮ ЕСТЕТИКУ В ДЕТАЛЯХ.', x: 75, y: 76, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'ЗА ТУРБОТУ В ДЕТАЛЯХ.', x: 25, y: 84, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
      { text: 'І ЗА ТЕ, ЩО ТИ ПРОСТО Є.', x: 75, y: 92, fontSize: 11, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
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
      { text: 'FASHION MAGAZINE', x: 88, y: 5, fontSize: 8, fontFamily: 'Montserrat', color: '#1a1a1a', bold: true },
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
      { text: 'Кохання — це простір, у якому ти можеш бути собою і щоразу вибирати залишатися.', x: 72, y: 78, fontSize: 12, fontFamily: 'Dancing Script', color: '#8b1a1a', bold: false, italic: true },
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
      { text: 'І попри все, вони завжди на твоїй стороні.', x: 75, y: 80, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
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
      { text: 'Серцем назавжди', x: 72, y: 10, fontSize: 28, fontFamily: 'Playfair Display', color: '#8b1a1a', bold: true },
      { text: 'Є дружба для "погуляти" — легка, випадкова. А є така, як у [Ім\'я]. Та, що будується роками.', x: 72, y: 25, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: '[Ім\'я] вміє дружити чесно. Завжди поруч, коли дійсно треба.', x: 72, y: 45, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
      { text: 'Такі люди не трапляються часто. Але якщо вже трапились — це назавжди.', x: 72, y: 85, fontSize: 10, fontFamily: 'Cormorant Garamond', color: '#333333', bold: false },
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
      { text: '»', x: 80, y: 65, fontSize: 72, fontFamily: 'Playfair Display', color: '#c09080', bold: false },
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
