/**
 * Перевірка статті, яку написала модель, перед тим як вона потрапить у чергу.
 *
 * НАВІЩО ЦЕ ВЗАГАЛІ. Промт — це прохання, а не гарантія. Модель, яку попросили
 * не називати цін, назве їх у восьмій статті з десяти разів — і саме ця стаття
 * піде в чергу, вийде за розкладом і житиме на сайті, поки хтось випадково не
 * дочитає її до того абзацу. Тут стоять ті вимоги, порушення яких НЕ видно
 * оком при швидкому перегляді: довжина мета-тегів, кількість посилань, сума
 * посеред тексту.
 *
 * ЧОМУ ОКРЕМО ВІД СКРИПТА. Щоб на це можна було поставити тест. Перевірка, яку
 * ніхто не перевіряв, — це перевірка, яка одного дня почне пропускати все
 * підряд і нічим про це не скаже.
 *
 * ФАЙЛ НАВМИСНО БЕЗ ЖОДНОГО ІМПОРТУ: його читає скрипт, який запускається
 * голим node, без псевдонімів шляхів і без складача.
 */

export type ArticleDraft = {
    title?: string;
    slug?: string;
    meta_title?: string;
    meta_description?: string;
    excerpt?: string;
    content?: string;
    cover_alt?: string;
    tags?: string[];
    faq?: Array<{ q?: string; a?: string }>;
};

export type CheckContext = {
    /** Ключовий запит теми. */
    query: string;
    /** Стаття, у якій продукт згадується лише в кінці. */
    independent: boolean;
    /** Повні адреси сторінок каталогу, на які стаття має послатися. */
    links: string[];
    /** Слаги інших статей блогу, на які стаття має послатися. */
    blogSlugs: string[];
};

export const WORDS_MIN = 1200;
export const WORDS_MAX = 1800;

const BANNED: Array<{ re: RegExp; why: string }> = [
    { re: /\bcanva\b/i, why: 'згадка Canva' },
    { re: /друкарн|типограф/i, why: 'згадка друкарні' },
    { re: /ретуш/i, why: 'згадка ретуші' },
    { re: /[\p{Emoji_Presentation}]/u, why: 'емодзі' },
];

/**
 * Сума в тексті.
 *
 * ПРО `\b`. Тут його немає навмисно: у JavaScript межа слова рахується за
 * латиницею, тож `\bціна\b` не збігається на початку рядка з кириличним
 * «Ціна» взагалі. Помилка мовчазна — вираз працює, просто ніколи не спрацьовує.
 *
 * Шукаємо не будь-яке число, а число поруч із гривнею або зі словом про ціну:
 * у статті про річниці весілля цифри років цілком доречні, а «від 900 грн» —
 * ні. Ціна, написана в тілі, застаріває мовчки і виявляється тоді, коли людина
 * з неї приходить у кошик і бачить іншу.
 */
export const PRICE_RE = /(\d[\d\s]{0,9})\s*(грн|₴|гривень|гривні)|(?:^|[^\p{L}])(ціна|ціни|коштує|коштують|вартість|вартує)(?:[^.\n]{0,40}?)\d/iu;

export function countWords(markdown: string): number {
    return markdown.replace(/[#*_>`[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;
}

export function checkArticle(article: ArticleDraft, ctx: CheckContext): string[] {
    const problems: string[] = [];
    const content = article.content || '';

    const words = countWords(content);
    if (words < WORDS_MIN || words > WORDS_MAX) {
        problems.push(`обсяг ${words} слів, а треба від ${WORDS_MIN} до ${WORDS_MAX}`);
    }

    const h2 = (content.match(/^##\s+/gm) || []).length;
    if (h2 < 5 || h2 > 8) problems.push(`заголовків другого рівня ${h2}, а треба від пʼяти до восьми`);

    if (/^#\s+/m.test(content)) problems.push('у тілі є заголовок першого рівня — H1 на сторінці вже один');

    const faq = Array.isArray(article.faq) ? article.faq : [];
    const wholeFaq = faq.filter(f => f && String(f.q || '').trim() && String(f.a || '').trim());
    if (wholeFaq.length !== faq.length) problems.push('у FAQ є питання без відповіді');
    if (wholeFaq.length < 3 || wholeFaq.length > 5) {
        problems.push(`питань у FAQ ${wholeFaq.length}, а треба від трьох до пʼяти`);
    }

    if (!/^[a-z0-9-]+$/.test(article.slug || '')) problems.push(`слаг «${article.slug}» не латиницею`);

    const titleLen = (article.meta_title || '').length;
    if (!titleLen || titleLen > 60) problems.push(`meta_title ${titleLen} символів, ліміт 60`);

    const descLen = (article.meta_description || '').length;
    if (descLen < 140 || descLen > 160) problems.push(`meta_description ${descLen} символів, а треба від 140 до 160`);

    if (!hasQueryEarly(content, ctx.query)) problems.push('ключового запиту немає в перших ста словах');

    for (const rule of BANNED) {
        if (rule.re.test(content)) problems.push(`у тексті ${rule.why}`);
    }

    const price = PRICE_RE.exec(content);
    if (price) problems.push(`у тексті сума або ціна: «${price[0].trim()}»`);

    const catalogLinks = ctx.links.filter(l => content.includes(l)).length;
    if (catalogLinks < 3) problems.push(`посилань у каталог ${catalogLinks}, а треба щонайменше три`);

    const blogLinks = ctx.blogSlugs.filter(s => content.includes(`/blog/${s}`)).length;
    if (blogLinks < 2) problems.push(`посилань на інші статті ${blogLinks}, а треба щонайменше два`);

    if (ctx.independent) {
        // Вступ — це все до першого H2. Саме там незалежна стаття найчастіше
        // зривається на продаж, і саме там це найдорожче: людина прийшла за
        // відповіддю, а їй з порога пропонують товар.
        const intro = content.split(/^##\s+/m)[0] || '';
        const brand = /touch\.memories/i;
        if (brand.test(article.title || '') || brand.test(intro)) {
            problems.push('незалежна стаття згадує бренд у заголовку або у вступі');
        }
    }

    return problems;
}

/**
 * Чи стоїть ключовий запит на початку.
 *
 * Слова порівнюються по корені — відкидаємо два останні символи, — бо
 * українська відмінює все: «книга побажань» у тексті стане «книгу побажань»,
 * і точний збіг тут відсіював би цілком правильні статті.
 */
export function hasQueryEarly(content: string, query: string): boolean {
    const firstHundred = content.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (!words.length) return true;

    const hits = words.filter(w => firstHundred.includes(w.slice(0, Math.max(4, w.length - 2))));
    return hits.length >= Math.ceil(words.length / 2);
}
