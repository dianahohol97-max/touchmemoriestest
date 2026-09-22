import { Marked } from 'marked';

/**
 * Серверний рендер markdown для тіла посту блогу.
 *
 * НАВІЩО. До 21.09.2026 тіло посту збирав `components/ui/MarkdownViewer.tsx`:
 * він тягнув редактор динамічним імпортом усередині `useEffect`, тобто
 * виключно в браузері. На сервері віддавався запасний варіант — той самий
 * текст із вирізаними `#` і `**`, одним абзацом. Наслідки бачив кожен, хто
 * відкривав будь-який із шістнадцяти постів: внутрішнє посилання показувалося
 * як голий `[текст](url)`, заголовки переставали бути заголовками, а таблиця
 * лишалася рядком із вертикальними рисками. Для статей, які пишуться під
 * відповіді ШІ-асистентів, це втрата саме тієї структури, заради якої вони так
 * і побудовані: пошуковий робот і асистент читають те, що прийшло з сервера, і
 * `useEffect` до них не доїжджає взагалі.
 *
 * ЧОМУ `marked`, А НЕ НОВА ЗАЛЕЖНІСТЬ. Він уже лежав у `package-lock.json` як
 * залежність редактора з адмінки, тож додавати нічого не довелося — тільки
 * назвати його прямо в `package.json`. Саме про цей випадок попереджає розділ
 * про Vercel у CLAUDE.md: імпорт пакета, якого немає в залежностях, збирається
 * локально і падає на деплої.
 *
 * ПРО БЕЗПЕКУ. Текст посту пише адміністратор, але рендериться він через
 * `dangerouslySetInnerHTML`, тож сирий HTML із markdown ми не пропускаємо
 * взагалі (`renderer.html` повертає порожньо), а кожну адресу в посиланні й
 * картинці звіряємо з білим списком схем. `javascript:` і `data:` не проходять:
 * посилання лишається текстом, картинка зникає.
 */

/** Дозволені адреси: свої шляхи, звичайний веб, пошта і якорі. */
const SAFE_HREF = /^(?:\/(?!\/)|https?:\/\/|mailto:|#)/i;

/** Картинку віддаємо тільки зі свого шляху або по http(s). */
const SAFE_SRC = /^(?:\/(?!\/)|https?:\/\/)/i;

function escapeAttribute(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Якір для заголовка. Кирилицю лишаємо як є — HTML5 це дозволяє, а
 * транслітерація зробила б посилання нечитабельним для людини.
 */
export function headingId(text: string): string {
    return text
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Якір для повторного заголовка.
 *
 * Два однакові H2 в одній статті дали б два однакові `id`, і друге посилання
 * змісту вело б на перший розділ — сторінка не падає, браузер просто лишається
 * на місці. Правило одне на рендер і на зміст навмисно: щойно вони почнуть
 * рахувати якір кожен по-своєму, зміст поведе в нікуди, і помітить це лише
 * той, хто клацне.
 */
export type HeadingSeen = Map<number, Set<string>>;

/**
 * Лічильник ведеться ОКРЕМО для кожного рівня заголовка. Спільний зробив би
 * якір другого H2 залежним від того, скільки H3 трапилося перед ним, — а
 * зміст перебирає самі лише H2 і про ті H3 не знає нічого.
 */
function uniqueHeadingId(text: string, level: number, seen: HeadingSeen): string {
    const used = seen.get(level) ?? new Set<string>();
    seen.set(level, used);

    const base = headingId(text);
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
}

function buildEngine(seen: HeadingSeen): Marked {
    const engine = new Marked({ gfm: true, breaks: false });

    engine.use({
        renderer: {
            // Сирий HTML із тіла посту не проходить ні блоком, ні тегом усередині рядка.
            html() {
                return '';
            },

            heading({ tokens, depth }) {
                // `#` у тілі посту зробив би другий <h1> поруч із заголовком
                // сторінки, тож найвищий рівень тут — другий, найнижчий — четвертий.
                const level = Math.min(Math.max(depth, 2), 4);
                const inner = this.parser.parseInline(tokens);
                const id = uniqueHeadingId(inner, level, seen);
                return `<h${level} id="${escapeAttribute(id)}">${inner}</h${level}>\n`;
            },

            link({ href, title, tokens }) {
                const inner = this.parser.parseInline(tokens);
                if (!SAFE_HREF.test(href || '')) {
                    // Посилання, якому не можна вірити, лишається текстом:
                    // мовчки викинути його разом із текстом було б гірше.
                    return inner;
                }
                const external = /^https?:\/\//i.test(href);
                const attrs = [
                    `href="${escapeAttribute(href)}"`,
                    title ? `title="${escapeAttribute(title)}"` : '',
                    external ? 'target="_blank" rel="noopener noreferrer"' : '',
                ].filter(Boolean).join(' ');
                return `<a ${attrs}>${inner}</a>`;
            },

            // ЧОМУ ТУТ ЗВИЧАЙНИЙ <img>, А НЕ next/image. Картинка всередині
            // тексту приходить рядком markdown, і її власних розмірів ми не
            // знаємо — `next/image` без них або вимагає `fill` із заданою
            // рамкою, або зсуває верстку. До того ж оптимізатор приймає лише
            // хости з `images.remotePatterns` у next.config, і стаття з
            // картинкою з іншого домену віддавала б 400 замість зображення.
            // Обкладинка, картки товарів, герой списку і «Читайте також» —
            // тобто все, що впливає на LCP і на зсув верстки, — йдуть через
            // next/image; тіло статті лишається лінькуватим <img>.
            image({ href, title, text }) {
                if (!SAFE_SRC.test(href || '')) return '';
                const attrs = [
                    `src="${escapeAttribute(href)}"`,
                    `alt="${escapeAttribute(text || '')}"`,
                    title ? `title="${escapeAttribute(title)}"` : '',
                    'loading="lazy"',
                    'decoding="async"',
                ].filter(Boolean).join(' ');
                return `<img ${attrs} />`;
            },
        },
    });

    return engine;
}

/**
 * Перетворює тіло посту на HTML. Синхронно — асинхронних розширень немає.
 *
 * Двигун будується на кожен виклик, бо нумерація однакових заголовків — це
 * стан однієї конкретної статті. Модульний двигун на весь процес переносив би
 * лічильник із попередньої статті на наступну, і в другій за день статті
 * перший же заголовок отримав би якір із суфіксом.
 */
export function renderMarkdown(source: string | null | undefined): string {
    if (!source) return '';
    return buildEngine(new Map()).parse(source, { async: false }) as string;
}

export type TocEntry = { id: string; text: string };

/**
 * Зміст статті — список H2 з тими самими якорями, що й у тілі.
 *
 * ЧОМУ ЯКОРІ БЕРУТЬСЯ З `headingId`, А НЕ РАХУЮТЬСЯ ОКРЕМО. Зміст і заголовки
 * малюються різними шматками коду, і щойно вони почнуть рахувати якір кожен
 * по-своєму, посилання поведуть у нікуди. Мовчки: сторінка не падає, браузер
 * просто лишається на місці. Одна функція на обидва боки — єдина гарантія.
 *
 * ЧОМУ ТІЛЬКИ ДРУГИЙ РІВЕНЬ. Зміст із H3 і H4 перетворюється на друге
 * олівцеве зображення статті і перестає бути навігацією. H2 — це і є скелет,
 * який ми вимагаємо від генератора: пʼять-вісім розділів.
 *
 * Розмітка всередині заголовка (`**жирний**`, посилання) зрізається: у змісті
 * потрібен текст, а не вкладені теги.
 */
export function extractToc(source: string | null | undefined): TocEntry[] {
    if (!source) return [];

    const entries: TocEntry[] = [];
    const seen: HeadingSeen = new Map();
    let inFence = false;

    for (const line of source.split('\n')) {
        // Рядок усередині ``` — це код, а не заголовок, навіть коли починається
        // з решіток.
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        // `#` і `##` обидва дають H2: рендер піднімає перший рівень до другого,
        // щоб у тілі не зʼявився другий <h1> поруч із заголовком сторінки.
        // Зміст мусить рахувати їх так само, інакше розділ, написаний однією
        // решіткою, буде в статті, але не в змісті.
        const m = /^#{1,2}\s+(.+?)\s*#*\s*$/.exec(line);
        if (!m) continue;

        const text = m[1]
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/[*_`]/g, '')
            .trim();
        if (!text) continue;

        entries.push({ id: uniqueHeadingId(text, 2, seen), text });
    }

    return entries;
}
