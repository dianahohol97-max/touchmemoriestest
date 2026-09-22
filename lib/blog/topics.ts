/**
 * Реєстр тем блогу.
 *
 * НАВІЩО ЦЕ ФАЙЛ КОДУ, А НЕ СПИСОК У ЛИСТУВАННІ. Кожна тема несе не лише
 * назву, а й ДВІ речі, які модель не має права вигадувати: цільову сторінку,
 * на яку стаття веде, і те, чи можна згадувати продукт по ходу тексту. Поки
 * теми жили переліком у повідомленні, і те, і те вирішувала модель, а
 * вигаданий слаг каталогу виглядає як робоче посилання рівно до кліку.
 *
 * `target` — головна сторінка, заради якої стаття пишеться. `support` — решта
 * сторінок, які можна згадати; разом вони дають обовʼязковий мінімум із трьох
 * посилань у каталог. Усі шляхи звіряються з базою перед генерацією
 * (`scripts/blog-generate.ts`): тема, чия сторінка не існує або знята з
 * продажу, не генерується взагалі.
 *
 * `independent: true` означає статтю, яку людина шукає БЕЗ наміру щось
 * купувати: таймінг весільного дня, як розібрати галерею телефону, що
 * написати у привітанні. У таких продукт зʼявляється лише в кінці та в блоці
 * товарів, і ніколи в заголовку. Це не сором'язливість, а те, як працює
 * органіка: стаття, яка з першого абзацу продає, не тримає людину до
 * останнього, а без дочитування не буває ні посилання, ні повернення.
 *
 * `blocked` — тема, під яку немає живої сторінки. Не видаляємо і не
 * підміняємо сусідньою: тиха підміна дала б статтю, яка веде людину не туди,
 * куди обіцяє заголовок. Хай лежить із причиною, поки не зʼявиться товар.
 */

export type TopicTarget = {
    /** Шлях без коду локалі — його додає генератор. */
    path: string;
    /** Що це: сторінка категорії, товару, лендінг за приводом чи власна сторінка. */
    kind: 'category' | 'product' | 'landing' | 'page';
};

export type Topic = {
    id: string;
    /** Робоча назва теми. Справжній заголовок пише модель. */
    title: string;
    /** Ключовий запит: має бути в перших ста словах і в meta title. */
    query: string;
    /** Слаг категорії блогу (`blog_categories.slug`). */
    category: string;
    /** Продукт згадується лише в кінці та в блоці товарів. */
    independent: boolean;
    target: TopicTarget;
    /** Додаткові сторінки для внутрішніх посилань. */
    support?: TopicTarget[];
    /** Причина, з якої тему зараз не можна генерувати. */
    blocked?: string;
};

const cat = (slug: string): TopicTarget => ({ path: `/category/${slug}`, kind: 'category' });
const product = (slug: string): TopicTarget => ({ path: `/catalog/${slug}`, kind: 'product' });
const landing = (catSlug: string, occasion: string): TopicTarget => ({ path: `/category/${catSlug}/${occasion}`, kind: 'landing' });
const page = (path: string): TopicTarget => ({ path, kind: 'page' });

export const TOPICS: Topic[] = [
    // ── Під органіку ──────────────────────────────────────────────────────
    {
        id: 'fotoalbom-dlya-vkleyuvannya',
        title: 'Фотоальбом для вклеювання: сім ідей, що з ним робити',
        query: 'фотоальбом для вклеювання',
        category: 'photobooks',
        independent: false,
        target: cat('albomy-dlya-vkleyky'),
        support: [cat('fotoalbomy'), cat('druk-foto')],
    },
    {
        id: 'knyha-pobazhan-vesillya',
        title: 'Книга побажань на весілля: як зробити, щоб гості справді писали',
        query: 'книга побажань на весілля',
        category: 'wedding',
        independent: false,
        target: landing('knyha-pobazhan', 'vesilni'),
        support: [cat('knyha-pobazhan'), product('wishbook')],
    },
    {
        id: 'druk-foto-polaroid',
        title: 'Друк фото у стилі полароїд: формат, який просять найчастіше',
        query: 'друк фото полароїд',
        category: 'prints',
        independent: false,
        target: product('polaroid-print'),
        support: [cat('druk-foto'), product('photoprint-standard')],
    },
    {
        id: 'knyha-pobazhan-yuvilei',
        title: 'Книга побажань на річницю та ювілей',
        query: 'книга побажань на ювілей',
        category: 'gifts',
        independent: false,
        target: cat('knyha-pobazhan'),
        support: [product('wishbook'), cat('hlyantsevi-zhurnaly')],
    },

    // ── Подарунки ─────────────────────────────────────────────────────────
    {
        id: 'podarunok-na-den-narodzhennya',
        title: 'Персоналізований подарунок на день народження: десять ідей',
        query: 'персоналізований подарунок на день народження',
        category: 'gifts',
        independent: false,
        target: landing('fotoknygy', 'na-den-narodzhennya'),
        support: [cat('hlyantsevi-zhurnaly'), cat('fotoalbomy'), cat('fotomahnity')],
    },
    {
        id: 'shcho-podaruvaty-podruzi-na-yuvilei',
        title: 'Що подарувати подрузі на ювілей',
        query: 'що подарувати подрузі на ювілей',
        category: 'gifts',
        independent: false,
        target: landing('hlyantsevi-zhurnaly', 'u-podarunok'),
        support: [cat('hlyantsevi-zhurnaly'), product('personalized-glossy-magazine')],
    },
    {
        id: 'podarunok-na-richnytsiu-po-rokakh',
        title: 'Подарунок на річницю весілля по роках',
        query: 'подарунок на річницю весілля',
        category: 'gifts',
        independent: false,
        target: landing('hlyantsevi-zhurnaly', 'na-richnytsyu'),
        support: [cat('knyha-pobazhan'), cat('fotoalbomy')],
    },
    {
        id: 'hlyantsevyi-zhurnal-pro-lyudynu',
        title: 'Глянцевий журнал про людину: що це і кому його дарують',
        query: 'глянцевий журнал про людину',
        category: 'hlyantsevi-zhurnaly',
        independent: false,
        target: cat('hlyantsevi-zhurnaly'),
        support: [product('personalized-glossy-magazine'), product('fotozhurnal-tverd-obkladynka')],
    },

    // ── Travel ────────────────────────────────────────────────────────────
    {
        id: 'yak-zibraty-travel-book',
        title: 'Як зібрати travel-book із подорожі',
        query: 'як зібрати travel book',
        category: 'travel',
        independent: false,
        target: cat('trevel-buky'),
        support: [product('travelbook-20x30'), landing('trevel-buky', 'pro-podorozh')],
    },
    {
        id: 'yak-fotohrafuvaty-v-podorozhi',
        title: 'Як фотографувати в подорожі на телефон',
        query: 'як фотографувати в подорожі на телефон',
        category: 'travel',
        independent: false,
        target: cat('trevel-buky'),
        support: [product('travelbook-20x30'), cat('druk-foto')],
    },
    {
        id: 'shcho-robyty-z-foto-pislia-vidpustky',
        title: 'Дванадцять ідей, що робити з фото після відпустки',
        query: 'що робити з фото після відпустки',
        category: 'travel',
        independent: false,
        target: cat('trevel-buky'),
        support: [cat('druk-foto'), cat('postery'), cat('fotomahnity')],
    },

    // ── Q4 ────────────────────────────────────────────────────────────────
    {
        id: 'podarunky-na-novyi-rik-z-foto',
        title: 'Подарунки на Новий рік з фотографіями',
        query: 'подарунки на новий рік з фото',
        category: 'gifts',
        independent: false,
        target: cat('druk-foto'),
        blocked: 'Новорічної лінійки в каталозі немає: жодного активного товару «Санта» не знайшлося (перевірено 22.09.2026). Стаття вела б на сторінку, де цього немає.',
    },
    {
        id: 'planer-na-2027',
        title: 'Планер на 2027: як обрати і як його вести',
        query: 'планер на 2027',
        category: 'calendars',
        independent: false,
        target: cat('fotokalendari'),
        blocked: 'Планерів у каталозі немає жодного, а календарі — це інший товар. Підміна категорією зробила б заголовок неправдою.',
    },
    {
        id: 'personalizovana-kazka-pro-dytynu',
        title: 'Персоналізована казка про дитину: як це працює',
        query: 'персоналізована казка про дитину',
        category: 'gifts',
        independent: false,
        target: product('personalized-ai-story'),
        blocked: 'Товар `personalized-ai-story` лежить у базі зі знятою публікацією. Спершу увімкнути його в адмінці, потім генерувати статтю.',
    },

    // ── Партнерська програма ──────────────────────────────────────────────
    {
        id: 'blogeru-zarobliaty-na-rekomendatsiiakh',
        title: 'Як блогеру заробляти на рекомендаціях подарунків',
        query: 'як блогеру заробляти на рекомендаціях',
        category: 'guide',
        independent: false,
        target: page('/partnerska-programa-dlya-blogeriv'),
        support: [page('/partnery'), cat('trevel-buky')],
    },
    {
        id: 'turagentstvu-travel-book-do-turu',
        title: 'Як турагентству додати travel-book до туру',
        query: 'подарунок клієнту від турагентства',
        category: 'guide',
        independent: false,
        target: page('/partnerska-programa-dlya-turagentstv'),
        support: [page('/partnery'), cat('trevel-buky')],
    },

    // ── Незалежні ─────────────────────────────────────────────────────────
    {
        id: 'chek-lyst-pidhotovky-do-vesillya',
        title: 'Чек-лист підготовки до весілля за шість місяців',
        query: 'підготовка до весілля чек-лист',
        category: 'wedding',
        independent: true,
        target: landing('knyha-pobazhan', 'vesilni'),
        support: [landing('fotoknygy', 'vesilni'), cat('knyha-pobazhan')],
    },
    {
        id: 'taiminh-vesilnoho-dnia',
        title: 'Таймінг весільного дня',
        query: 'таймінг весільного дня',
        category: 'wedding',
        independent: true,
        target: landing('knyha-pobazhan', 'vesilni'),
        support: [cat('knyha-pobazhan'), product('wishbook')],
    },
    {
        id: 'zhyvi-foto-z-vesillya-vid-hostei',
        title: 'Як отримати живі фото з весілля від гостей',
        query: 'фото з весілля від гостей',
        category: 'wedding',
        independent: true,
        target: cat('knyha-pobazhan'),
        support: [cat('druk-foto'), landing('fotoknygy', 'vesilni')],
    },
    {
        id: 'shcho-robyty-z-vesilnymy-foto',
        title: 'Що робити з весільними фото: десять ідей',
        query: 'що робити з весільними фото',
        category: 'wedding',
        independent: true,
        target: landing('fotoknygy', 'vesilni'),
        support: [cat('fotoknygy'), cat('postery'), cat('druk-foto')],
    },
    {
        id: 'richnytsi-vesillya-po-rokakh',
        title: 'Річниці весілля по роках',
        query: 'річниці весілля по роках',
        category: 'wedding',
        independent: true,
        target: landing('hlyantsevi-zhurnaly', 'na-richnytsyu'),
        support: [cat('knyha-pobazhan'), cat('hlyantsevi-zhurnaly')],
    },
    {
        id: 'den-narodzhennya-doroslomu-ne-v-restorani',
        title: 'День народження дорослому не в ресторані',
        query: 'як відзначити день народження дорослому',
        category: 'gifts',
        independent: true,
        target: landing('fotoknygy', 'na-den-narodzhennya'),
        support: [cat('hlyantsevi-zhurnaly'), cat('fotoknygy')],
    },
    {
        id: 'idei-yuvileiu-30-40-50',
        title: 'Ідеї ювілею на 30, 40 і 50 років',
        query: 'ідеї ювілею 30 40 50',
        category: 'gifts',
        independent: true,
        target: landing('hlyantsevi-zhurnaly', 'u-podarunok'),
        support: [cat('hlyantsevi-zhurnaly'), cat('knyha-pobazhan')],
    },
    {
        id: 'shcho-napysaty-u-pryvitanni',
        title: 'Що написати у привітанні',
        query: 'що написати у привітанні',
        category: 'gifts',
        independent: true,
        target: cat('knyha-pobazhan'),
        support: [cat('hlyantsevi-zhurnaly'), cat('druk-foto')],
    },
    {
        id: 'dytyachyi-den-narodzhennya-vdoma',
        title: 'Дитячий день народження вдома',
        query: 'дитячий день народження вдома',
        category: 'gifts',
        independent: true,
        target: cat('dytyachi-fototovary'),
        support: [landing('fotoknygy', 'dytyachi'), cat('druk-foto')],
    },
    {
        id: 'yak-fotohrafuvaty-na-telefon',
        title: 'Як фотографувати на телефон професійно',
        query: 'як фотографувати на телефон',
        category: 'guide',
        independent: true,
        target: cat('druk-foto'),
        support: [cat('fotoknygy'), cat('postery')],
    },
    {
        id: 'simeini-foto-vdoma-bez-fotohrafa',
        title: 'Сімейні фото вдома без фотографа',
        query: 'сімейні фото вдома',
        category: 'guide',
        independent: true,
        target: landing('fotoknygy', 'simejni'),
        support: [cat('druk-foto'), cat('fotoalbomy')],
    },
    {
        id: 'yak-rozibraty-halereiu-telefonu',
        title: 'Як розібрати галерею телефону',
        query: 'як розібрати галерею телефону',
        category: 'guide',
        independent: true,
        target: cat('druk-foto'),
        support: [cat('fotoalbomy'), cat('fotoknygy')],
    },
    {
        id: 'yak-zberihaty-foto-shchob-ne-vtratyty',
        title: 'Як зберігати фото, щоб не втратити',
        query: 'як зберігати фото',
        category: 'guide',
        independent: true,
        target: cat('fotoalbomy'),
        support: [cat('druk-foto'), cat('fotoknygy')],
    },
    {
        id: 'yak-obraty-foto-dlia-druku',
        title: 'Як обрати фото для друку',
        query: 'як обрати фото для друку',
        category: 'prints',
        independent: true,
        target: cat('druk-foto'),
        support: [product('photoprint-standard'), cat('postery')],
    },
    {
        id: 'yak-zberehty-simeinu-istoriiu',
        title: 'Як зберегти сімейну історію',
        query: 'як зберегти сімейну історію',
        category: 'guide',
        independent: true,
        target: landing('fotoknygy', 'simejni'),
        support: [cat('hlyantsevi-zhurnaly'), cat('fotoalbomy')],
    },
    {
        id: 'simeini-tradytsii',
        title: 'Сімейні традиції',
        query: 'сімейні традиції',
        category: 'guide',
        independent: true,
        target: landing('fotoknygy', 'simejni'),
        support: [cat('fotokalendari'), cat('druk-foto')],
    },
    {
        id: 'yak-fiksuvaty-pershyi-rik-dytyny',
        title: 'Як фіксувати перший рік дитини',
        query: 'перший рік дитини фото',
        category: 'guide',
        independent: true,
        target: cat('dytyachi-fototovary'),
        support: [product('baby-first-album'), landing('fotoknygy', 'dytyachi')],
    },
];

export function findTopic(id: string): Topic | undefined {
    return TOPICS.find(t => t.id === id);
}

/** Усі шляхи теми — головний і допоміжні — одним списком. */
export function topicPaths(topic: Topic): TopicTarget[] {
    return [topic.target, ...(topic.support || [])];
}
