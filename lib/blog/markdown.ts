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

function buildEngine(): Marked {
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
                const id = headingId(inner);
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

            image({ href, title, text }) {
                if (!SAFE_SRC.test(href || '')) return '';
                const attrs = [
                    `src="${escapeAttribute(href)}"`,
                    `alt="${escapeAttribute(text || '')}"`,
                    title ? `title="${escapeAttribute(title)}"` : '',
                    'loading="lazy"',
                ].filter(Boolean).join(' ');
                return `<img ${attrs} />`;
            },
        },
    });

    return engine;
}

const engine = buildEngine();

/** Перетворює тіло посту на HTML. Синхронно — асинхронних розширень немає. */
export function renderMarkdown(source: string | null | undefined): string {
    if (!source) return '';
    return engine.parse(source, { async: false }) as string;
}
