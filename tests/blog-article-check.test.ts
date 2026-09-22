import { describe, expect, it } from 'vitest';
import { checkArticle, countWords, hasQueryEarly, type ArticleDraft, type CheckContext } from '@/lib/blog/article-check';
import { TOPICS, topicPaths } from '@/lib/blog/topics';

/**
 * Перевірка згенерованої статті.
 *
 * НАВІЩО ТЕСТУВАТИ ПЕРЕВІРКУ. Промт — це прохання, а не гарантія: модель,
 * яку попросили не називати цін, назве їх у восьмій статті з десяти разів. Ця
 * функція — єдине, що стоїть між таким текстом і чергою, тож якщо вона сама
 * тихо перестане ловити, ми дізнаємося про це зі статті на сайті.
 */

const LINKS = [
    'https://touchmemories.com.ua/uk/category/fotoknygy',
    'https://touchmemories.com.ua/uk/category/druk-foto',
    'https://touchmemories.com.ua/uk/catalog/photobook-velour',
];

const BLOG_SLUGS = ['yak-vybraty-fotoknyhu', 'chomu-varto-drukuvaty-foto'];

/** Стаття, яка проходить усе. Кожен тест ламає в ній рівно одну річ. */
function goodArticle(over: Partial<ArticleDraft> = {}): ArticleDraft {
    const filler = 'Фотокнига збирається зі знімків, які вже лежать у телефоні, і головна робота тут не технічна, а редакторська. '.repeat(14);
    const body = [
        `Фотокнига для сімейних знімків починається не з обкладинки, а з вибору кадрів. ${filler}`,
        '## Перший розділ',
        `Тут ми розповідаємо про добір кадрів і про те, чому їх має бути менше, ніж здається. ${filler}`,
        `Докладніше про формати ми писали у статті [як вибрати фотокнигу](https://touchmemories.com.ua/uk/blog/yak-vybraty-fotoknyhu).`,
        '## Другий розділ',
        `Порядок сторінок вирішує більше, ніж якість окремого знімка. ${filler}`,
        `Про друк окремих кадрів є стаття [чому варто друкувати фото](https://touchmemories.com.ua/uk/blog/chomu-varto-drukuvaty-foto).`,
        '## Третій розділ',
        `Підписи роблять книгу зрозумілою через десять років. ${filler}`,
        '## Четвертий розділ',
        `Обкладинка задає настрій усьому, що всередині. ${filler}`,
        '## Пʼятий розділ',
        'Готові зібрати свою книгу — почніть з [каталогу фотокниг](https://touchmemories.com.ua/uk/category/fotoknygy), подивіться [друк фото](https://touchmemories.com.ua/uk/category/druk-foto) або одразу [велюрову фотокнигу](https://touchmemories.com.ua/uk/catalog/photobook-velour).',
    ].join('\n\n');

    return {
        title: 'Фотокнига для сімейних знімків',
        slug: 'fotoknyha-dlya-simeinykh-znimkiv',
        meta_title: 'Фотокнига для сімейних знімків: як зібрати',
        meta_description: 'Фотокнига для сімейних знімків збирається з того, що вже лежить у телефоні. Розповідаємо, як обрати кадри, скласти порядок сторінок і не перевантажити.',
        excerpt: 'Як зібрати сімейну фотокнигу з того, що вже є в телефоні.',
        content: body,
        cover_alt: 'Розгорнута фотокнига на столі',
        tags: ['фотокнига', 'сімейні фото'],
        faq: [
            { q: 'Скільки фото потрібно?', a: 'Від шістдесяти до ста двадцяти на книгу середнього обсягу.' },
            { q: 'Чи можна додати підписи?', a: 'Так, підписи додаються до кожного розвороту в конструкторі.' },
            { q: 'Яку обкладинку обрати?', a: 'Велюрова тепліша на дотик, друкована дозволяє винести фото на саму обкладинку.' },
        ],
        ...over,
    };
}

const ctx: CheckContext = {
    query: 'фотокнига для сімейних знімків',
    independent: false,
    links: LINKS,
    blogSlugs: BLOG_SLUGS,
};

describe('здорова стаття проходить', () => {
    it('жодної претензії', () => {
        expect(checkArticle(goodArticle(), ctx)).toEqual([]);
    });

    it('обсяг рахується без розмітки', () => {
        expect(countWords('## Заголовок\n\n**слово** [текст](/uk)')).toBe(4);
    });
});

describe('ціна в тексті не проходить ніколи', () => {
    // Найдорожча з усіх помилок: не падає, не світиться, виявляється в кошику.
    it.each([
        'Така книга коштує 1200 грн і робиться за тиждень.',
        'Ціна починається від 900 ₴ за формат А4.',
        'Вартість залежить від обсягу і стартує з 750 гривень.',
        'Ціна такої книги — 2100 за стандартний обсяг.',
    ])('%s', (sentence) => {
        const problems = checkArticle(goodArticle({ content: `${goodArticle().content}\n\n${sentence}` }), ctx);
        expect(problems.some(p => p.startsWith('у тексті сума'))).toBe(true);
    });

    it('а рік і кількість сторінок — не ціна', () => {
        const ok = 'У 2026 році ми зібрали книгу на 120 сторінок із 68 знімків.';
        const problems = checkArticle(goodArticle({ content: `${goodArticle().content}\n\n${ok}` }), ctx);
        expect(problems).toEqual([]);
    });
});

describe('заборонені згадки', () => {
    it.each([
        ['Макет можна зібрати в Canva, але ми робимо інакше.', 'Canva'],
        ['Наша друкарня працює на офсеті.', 'друкарні'],
        ['Ретуш облич входить у вартість.', 'ретуші'],
    ])('%s', (sentence, what) => {
        const problems = checkArticle(goodArticle({ content: `${goodArticle().content}\n\n${sentence}` }), ctx);
        expect(problems.some(p => p.includes(what))).toBe(true);
    });
});

describe('структура', () => {
    it('замало розділів', () => {
        const short = '## Один\n\nтекст\n\n## Два\n\nтекст';
        expect(checkArticle(goodArticle({ content: short }), ctx))
            .toContainEqual(expect.stringContaining('заголовків другого рівня 2'));
    });

    it('H1 у тілі — це другий H1 на сторінці', () => {
        const withH1 = `# Заголовок\n\n${goodArticle().content}`;
        expect(checkArticle(goodArticle({ content: withH1 }), ctx))
            .toContainEqual(expect.stringContaining('заголовок першого рівня'));
    });

    it('короткий текст', () => {
        expect(checkArticle(goodArticle({ content: '## Один\n\nкоротко' }), ctx))
            .toContainEqual(expect.stringContaining('обсяг'));
    });

    it('питання без відповіді в FAQ', () => {
        // Половинчастий запис — це обіцянка в розмітці FAQPage, якої сторінка
        // не виконує.
        const faq = [...goodArticle().faq!, { q: 'А це?', a: '' }];
        expect(checkArticle(goodArticle({ faq }), ctx))
            .toContainEqual('у FAQ є питання без відповіді');
    });
});

describe('мета-теги і слаг', () => {
    it('задовгий meta_title', () => {
        expect(checkArticle(goodArticle({ meta_title: 'а'.repeat(61) }), ctx))
            .toContainEqual(expect.stringContaining('meta_title 61'));
    });

    it('meta_description поза вилкою', () => {
        expect(checkArticle(goodArticle({ meta_description: 'закоротко' }), ctx))
            .toContainEqual(expect.stringContaining('meta_description 9'));
    });

    it('кирилиця в слагу', () => {
        expect(checkArticle(goodArticle({ slug: 'фотокнига' }), ctx))
            .toContainEqual(expect.stringContaining('не латиницею'));
    });
});

describe('внутрішні посилання', () => {
    it('замало посилань у каталог', () => {
        const content = goodArticle().content!.replace(LINKS[1], '#').replace(LINKS[2], '#');
        expect(checkArticle(goodArticle({ content }), ctx))
            .toContainEqual(expect.stringContaining('посилань у каталог 1'));
    });

    it('замало посилань на статті', () => {
        const content = goodArticle().content!.replace('/blog/chomu-varto-drukuvaty-foto', '/blog/');
        expect(checkArticle(goodArticle({ content }), ctx))
            .toContainEqual(expect.stringContaining('посилань на інші статті 1'));
    });
});

describe('ключовий запит на початку', () => {
    it('відмінена форма зараховується', () => {
        // «книга побажань» у тексті стане «книгу побажань» — точний збіг
        // відсіював би цілком правильні статті.
        expect(hasQueryEarly('Книгу побажань зазвичай кладуть біля входу.', 'книга побажань')).toBe(true);
    });

    it('запиту немає зовсім', () => {
        expect(hasQueryEarly('Текст про щось цілком інше і далеке.', 'книга побажань')).toBe(false);
    });

    it('запит аж у кінці не рахується', () => {
        const far = `${'слово '.repeat(150)} книга побажань`;
        expect(hasQueryEarly(far, 'книга побажань')).toBe(false);
    });
});

describe('незалежна стаття не продає з порога', () => {
    const independent: CheckContext = { ...ctx, independent: true };

    it('бренд у заголовку', () => {
        expect(checkArticle(goodArticle({ title: 'Таймінг весільного дня від touch.memories' }), independent))
            .toContainEqual(expect.stringContaining('незалежна стаття згадує бренд'));
    });

    it('бренд у вступі', () => {
        const content = goodArticle().content!.replace('Фотокнига для сімейних', 'У touch.memories фотокнига для сімейних');
        expect(checkArticle(goodArticle({ content }), independent))
            .toContainEqual(expect.stringContaining('незалежна стаття згадує бренд'));
    });

    it('бренд у кінці — дозволено', () => {
        const content = `${goodArticle().content}\n\nЗібрати таку книгу можна в touch.memories.`;
        expect(checkArticle(goodArticle({ content }), independent)).toEqual([]);
    });
});

describe('реєстр тем', () => {
    it('ідентифікатори унікальні', () => {
        const ids = TOPICS.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('кожна тема має щонайменше три сторінки для посилань', () => {
        // Мінімум із трьох посилань у каталог тримає сама тема: якщо сторінок
        // менше, стаття не змогла б його виконати, скільки її не переписуй.
        for (const topic of TOPICS) {
            if (topic.blocked) continue;
            expect(topicPaths(topic).length, topic.id).toBeGreaterThanOrEqual(3);
        }
    });

    it('заблокована тема несе причину, а не просто прапорець', () => {
        for (const topic of TOPICS.filter(t => t.blocked)) {
            expect(topic.blocked!.length, topic.id).toBeGreaterThan(40);
        }
    });

    it('слаг категорії блогу — з наявних', () => {
        const known = ['travel', 'photobooks', 'hlyantsevi-zhurnaly', 'prints', 'gifts', 'wedding', 'guide', 'posters', 'calendars'];
        for (const topic of TOPICS) {
            expect(known, topic.id).toContain(topic.category);
        }
    });
});
