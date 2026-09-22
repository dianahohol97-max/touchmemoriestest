import { describe, expect, it } from 'vitest';
import { extractToc, renderMarkdown } from '@/lib/blog/markdown';

/**
 * Зміст і тіло статті мусять називати розділи однаковими якорями.
 *
 * Розбіжність тут не падає і нічого не пише в журнал: посилання просто не
 * працює, браузер лишається на місці, і дізнаємося ми про це від того, хто
 * клацнув. Тому перевірка звіряє не форму якоря, а те, що КОЖЕН якір зі
 * змісту справді є в готовому HTML.
 */
function idsInHtml(html: string): string[] {
    return [...html.matchAll(/<h2 id="([^"]+)"/g)].map(m => m[1]);
}

describe('якорі змісту збігаються з якорями тіла', () => {
    it('звичайна стаття', () => {
        const md = '# Вступ\n\nтекст\n\n## Перший розділ\n\nтекст\n\n### Підрозділ\n\n## Другий розділ\n';
        expect(extractToc(md).map(e => e.id)).toEqual(idsInHtml(renderMarkdown(md)));
    });

    it('два однакові заголовки отримують різні якорі — і однаково в обох місцях', () => {
        const md = '## Як обрати\n\nа\n\n## Як обрати\n\nб\n';
        const toc = extractToc(md);
        expect(toc).toHaveLength(2);
        expect(toc[0].id).not.toBe(toc[1].id);
        expect(toc.map(e => e.id)).toEqual(idsInHtml(renderMarkdown(md)));
    });

    it('H3 між двома H2 не зсуває нумерацію другого рівня', () => {
        // Спільний лічильник на всі рівні зробив би якір другого H2 залежним
        // від кількості H3 перед ним, і зміст розійшовся б із тілом.
        const md = '## Розділ\n\n### Розділ\n\n## Розділ\n';
        expect(extractToc(md).map(e => e.id)).toEqual(idsInHtml(renderMarkdown(md)));
    });

    it('рядок усередині ``` не стає розділом', () => {
        const md = '## Справжній\n\n```\n## несправжній\n```\n';
        expect(extractToc(md).map(e => e.text)).toEqual(['Справжній']);
    });

    it('розмітка всередині заголовка зрізається в тексті змісту', () => {
        const md = '## Як обрати **фотокнигу** і [не помилитися](/uk/catalog)\n';
        expect(extractToc(md)[0].text).toBe('Як обрати фотокнигу і не помилитися');
    });

    it('лічильник не переносить стан із попередньої статті', () => {
        // Двигун раніше жив на весь процес: друга стаття за день починала б
        // нумерацію з того місця, де спинилася перша.
        const md = '## Вступ\n';
        expect(idsInHtml(renderMarkdown(md))).toEqual(idsInHtml(renderMarkdown(md)));
    });
});
