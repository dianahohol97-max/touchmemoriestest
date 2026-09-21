import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { headingId, renderMarkdown } from '@/lib/blog/markdown';

/**
 * Тіло посту мусить приходити з сервера вже розміткою.
 *
 * ІСТОРІЯ. До 21.09.2026 `MarkdownViewer` збирав markdown у браузері, а на
 * сервері віддавав той самий текст із вирізаними `#` і `**`. Шістнадцять живих
 * постів показували внутрішні посилання як голий `[текст](url)`, і саме через
 * це пункт 6 у docs/pending-checks.md забороняв заливати нові статті раніше,
 * ніж буде зроблений серверний рендер. Перевіряється тут не бібліотека, а
 * наслідки: посилання, заголовки й таблиці, заради яких статті так і написані.
 */

describe('розмітка збирається на сервері', () => {
    it('внутрішнє посилання стає справжнім <a>, а не лишається дужками', () => {
        const html = renderMarkdown('Дивись [тревелбук](/uk/catalog/travelbook-20x30) тут.');
        expect(html).toContain('<a href="/uk/catalog/travelbook-20x30">тревелбук</a>');
        expect(html).not.toContain('[тревелбук]');
    });

    it('заголовок другого рівня стає <h2> з якорем', () => {
        const html = renderMarkdown('## Чому сувенір не спрацьовує');
        expect(html).toContain('<h2 id="чому-сувенір-не-спрацьовує">Чому сувенір не спрацьовує</h2>');
    });

    it('одинарна решітка не створює другий <h1> поруч із заголовком сторінки', () => {
        expect(renderMarkdown('# Назва')).toContain('<h2');
        expect(renderMarkdown('# Назва')).not.toContain('<h1');
    });

    it('глибші рівні не опускаються нижче <h4>', () => {
        expect(renderMarkdown('##### Дрібниця')).toContain('<h4');
    });

    it('таблиця порівняння стає таблицею', () => {
        const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
        expect(html).toContain('<table>');
        expect(html).toContain('<th>A</th>');
        expect(html).toContain('<td>1</td>');
    });

    it('жирний текст у відповідях FAQ лишається жирним', () => {
        expect(renderMarkdown('**Скільки коштує?**')).toContain('<strong>Скільки коштує?</strong>');
    });

    it('зовнішнє посилання відкривається в новій вкладці й не тече реферером', () => {
        const html = renderMarkdown('[сайт](https://example.com)');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
    });

    it('внутрішнє посилання нової вкладки не відкриває', () => {
        expect(renderMarkdown('[каталог](/uk/catalog)')).not.toContain('target="_blank"');
    });

    it('порожнє тіло не падає і нічого не малює', () => {
        expect(renderMarkdown('')).toBe('');
        expect(renderMarkdown(null)).toBe('');
        expect(renderMarkdown(undefined)).toBe('');
    });
});

describe('нічого зайвого з тіла посту не проходить', () => {
    it('сирий HTML не рендериться', () => {
        const html = renderMarkdown('<script>alert(1)</script>\n\nЗвичайний абзац.');
        expect(html).not.toContain('<script');
        expect(html).toContain('Звичайний абзац.');
    });

    it('тег усередині рядка теж не проходить', () => {
        const html = renderMarkdown('Текст <img src=x onerror=alert(1)> далі.');
        expect(html).not.toContain('onerror');
    });

    it('javascript: у посиланні лишається текстом без <a>', () => {
        const html = renderMarkdown('[тисни](javascript:alert(1))');
        expect(html).toContain('тисни');
        expect(html).not.toContain('<a ');
        expect(html).not.toContain('javascript:');
    });

    it('картинка з чужою схемою зникає', () => {
        expect(renderMarkdown('![а](data:image/svg+xml;base64,PHN2Zz4=)')).not.toContain('<img');
    });

    it('звичайна картинка лишається і вантажиться лінькувато', () => {
        const html = renderMarkdown('![обкладинка](/images/blog/cover.jpg)');
        expect(html).toContain('src="/images/blog/cover.jpg"');
        expect(html).toContain('alt="обкладинка"');
        expect(html).toContain('loading="lazy"');
    });

    it('лапки в підписі картинки не ламають атрибут', () => {
        const html = renderMarkdown('![а" onerror="alert(1)](/i.jpg)');
        expect(html).not.toContain('onerror="alert');
        expect(html).toContain('&quot;');
    });
});

describe('якорі заголовків', () => {
    it('складаються з літер і цифр, решта стає дефісом', () => {
        expect(headingId('Крок 1. Перевірте, чи формат підходить')).toBe('крок-1-перевірте-чи-формат-підходить');
    });

    it('не починаються і не закінчуються дефісом', () => {
        expect(headingId('  Що далі?  ')).toBe('що-далі');
    });
});

/** Статті черги — саме те, заради чого рендер і робився. */
const QUEUE_WITH_LINKS: Array<[string, string]> = [
    ['shcho-podaruvaty-pislia-podorozhi', '/uk/catalog/travelbook-20x30'],
    ['iak-blogeru-monetyzuvaty-travel-kontent', '/uk/partnerska-programa-dlya-blogeriv'],
    ['iak-zberehty-spohady-z-podorozhi', '/uk/catalog/travelbook-20x30'],
    ['partnerska-programa-dlya-turagentstv-loialnist', '/uk/partnerska-programa-dlya-turagentstv'],
    ['iak-blogeru-doluchytysia-do-partnerskoi-programy', '/uk/partnerska-programa-dlya-blogeriv'],
    ['sertyfikat-chy-travelbook-turagentstvu', '/uk/partnery'],
    ['podarunok-kliientu-pislia-turu-tsyfry', '/uk/partnerska-programa-dlya-turagentstv'],
];

describe.each(QUEUE_WITH_LINKS)('стаття %s у зібраному вигляді', (slug, href) => {
    const html = renderMarkdown(readFileSync(resolve('docs/blog', `${slug}.md`), 'utf8'));

    it('веде на свою сторінку справжнім посиланням', () => {
        expect(html).toContain(`<a href="${href}">`);
    });

    it('не лишає жодних квадратних дужок від markdown', () => {
        expect(html).not.toMatch(/\]\([^)]*\)/);
    });

    it('має заголовки другого рівня', () => {
        expect((html.match(/<h2 /g) || []).length).toBeGreaterThanOrEqual(4);
    });
});

describe('порівняльна стаття', () => {
    const html = renderMarkdown(readFileSync(resolve('docs/blog/sertyfikat-chy-travelbook-turagentstvu.md'), 'utf8'));

    it('містить зібрану таблицю, а не рядки з рисками', () => {
        expect(html).toContain('<table>');
        expect((html.match(/<tr>/g) || []).length).toBeGreaterThanOrEqual(8);
        expect(html).not.toContain('|---|');
    });
});

describe('стаття без посилання', () => {
    const html = renderMarkdown(readFileSync(resolve('docs/blog/biudzhetni-podorozhi-2026.md'), 'utf8'));

    it('лишається без <a>, але зі згадкою бренду', () => {
        expect(html).not.toContain('<a ');
        expect(html).toContain('touch.memories');
    });
});
