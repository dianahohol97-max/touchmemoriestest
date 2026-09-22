import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { onlyVisiblePosts, publishedAtFilter, publishedCutoff } from '@/lib/blog/published';

/**
 * Стаття, написана наперед, не має показуватися раніше за свою дату.
 *
 * ІСТОРІЯ. До 21.09.2026 всі публічні читання `blog_posts` фільтрували тільки
 * `is_published`, а сортували за `published_at desc`. Тобто чернетка з датою
 * наступного понеділка, якщо їй поставити прапорець заздалегідь, ставала б не
 * просто видимою — вона ставала б ПЕРШОЮ в списку, у стрічці RSS і в
 * `sitemap.xml`. Черга з восьми статей робить цю пастку неминучою, бо всі вони
 * лежать із датами в майбутньому.
 *
 * ЧОМУ ТЕСТ ІЩЕ Й ПЕРЕБИРАЄ РЕПОЗИТОРІЙ. Місць, які читають пости для
 * відвідувача, вісім, і вони розкидані по сторінках, RSS, API та sitemap.
 * Дев'яте додадуть, не згадавши про гейт, — рівно так само, як забували про
 * пагінацію в гочі 14. Ціна помилки несиметрична: недогейтована стаття не
 * падає і нікуди не пише, вона просто виходить раніше за графік, і помітить це
 * хіба що той, хто складав графік.
 */

/** Мінімальний двійник PostgREST-білдера: запам'ятовує застосовані фільтри. */
function fakeQuery() {
    const calls: Array<[string, ...any[]]> = [];
    const builder: any = new Proxy({}, {
        get: (_t, prop: string) => (...args: any[]) => {
            calls.push([prop, ...args]);
            return builder;
        },
    });
    return { builder, calls };
}

describe('гейт публікації за датою', () => {
    it('додає обидві умови — прапорець і дату', () => {
        const { builder, calls } = fakeQuery();
        onlyVisiblePosts(builder, new Date('2026-09-28T06:00:00.000Z'));

        expect(calls).toEqual([
            ['eq', 'status', 'published'],
            ['eq', 'is_published', true],
            ['or', 'published_at.is.null,published_at.lte.2026-09-28T06:00:00.000Z'],
        ]);
    });

    it('повертає той самий білдер, щоб ланцюжок не розривався', () => {
        const { builder } = fakeQuery();
        expect(onlyVisiblePosts(builder)).toBe(builder);
    });

    it('межа відсікання — це «зараз», а не початок доби', () => {
        const now = new Date('2026-10-01T06:00:00.000Z');
        expect(publishedCutoff(now)).toBe('2026-10-01T06:00:00.000Z');
    });

    it('порожня дата лишається видимою — наявні пости не мають зникнути', () => {
        // Простий `.lte()` відсік би NULL мовчки. Умова навмисно з двох частин.
        expect(publishedAtFilter(new Date('2026-09-28T06:00:00.000Z')))
            .toMatch(/^published_at\.is\.null,/);
    });

    it('умова не містить коми, яка розвалила б or() на зайвий доданок', () => {
        const [, dated] = publishedAtFilter(new Date('2026-12-31T21:00:00.000Z')).split(',');
        expect(dated.split(',')).toHaveLength(1);
        expect(dated).toBe('published_at.lte.2026-12-31T21:00:00.000Z');
    });
});

/**
 * Те саме, що PostgREST зробить із рядком: `status`, `is_published` І умова з
 * `or(...)`. Потрібно, щоб перевірити гейт на справжній статті, а не лише на
 * формі рядка.
 */
function postgrestWouldReturn(
    row: { is_published: boolean; published_at: string | null; status?: string },
    now: Date,
): boolean {
    if ((row.status ?? 'published') !== 'published') return false;
    if (!row.is_published) return false;
    const [nullPart, datePart] = publishedAtFilter(now).split(',');
    expect(nullPart).toBe('published_at.is.null');
    const cutoff = datePart.replace('published_at.lte.', '');
    return row.published_at === null || row.published_at <= cutoff;
}

describe('перша стаття черги справді не видна до своєї дати', () => {
    // Дата взята з docs/blog/shcho-podaruvaty-pislia-podorozhi.sql, а не
    // вигадана: якщо розклад у черзі зсунуть, цей тест зсунеться разом із ним.
    const sql = readFileSync(resolve('docs/blog/shcho-podaruvaty-pislia-podorozhi.sql'), 'utf8');
    const scheduled = sql.match(/'(\d{4}-\d{2}-\d{2}) 06:00:00\+00'/)![1];
    const row = { is_published: true, published_at: `${scheduled}T06:00:00+00:00` };

    it(`${'за добу до'} публікації її немає у вибірці`, () => {
        const dayBefore = new Date(`${scheduled}T06:00:00Z`);
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
        expect(postgrestWouldReturn(row, dayBefore)).toBe(false);
    });

    it('за хвилину до публікації її все ще немає', () => {
        const minuteBefore = new Date(new Date(`${scheduled}T06:00:00Z`).getTime() - 60_000);
        expect(postgrestWouldReturn(row, minuteBefore)).toBe(false);
    });

    it('у свою хвилину вона зʼявляється', () => {
        expect(postgrestWouldReturn(row, new Date(`${scheduled}T06:00:00Z`))).toBe(true);
    });

    it('а наявний пост із порожньою датою не зникає разом із нею', () => {
        const legacy = { is_published: true, published_at: null };
        expect(postgrestWouldReturn(legacy, new Date('2026-09-21T00:00:00Z'))).toBe(true);
    });

    it('стаття в черзі лишається схованою, навіть коли її час уже минув', () => {
        // Відкриває її крон, а не годинник: поки він не переписав `status`,
        // стаття не показується жодним із восьми читань. Так «вийшла за
        // розкладом» і «вийшла, бо дата збіглася» перестають бути одним і тим
        // самим — а різницю між ними видно рядком у базі.
        const queued = { is_published: false, published_at: row.published_at, status: 'scheduled' };
        const afterDate = new Date(new Date(`${scheduled}T06:00:00Z`).getTime() + 3_600_000);
        expect(postgrestWouldReturn(queued, afterDate)).toBe(false);
    });
});

/** Усі файли репозиторію, які читають `blog_posts` не для адмінки. */
function publicReadSites(): Array<{ file: string; line: number; context: string }> {
    // `components` доданий 22.09.2026: список статей переїхав у
    // `components/blog/BlogIndex.tsx`, і поки перевірка дивилася лише в `app`
    // та `lib`, найбільше читання постів на сайті лишилося поза наглядом. Без
    // гейта воно показало б чергу на першій же сторінці блогу.
    const roots = ['app', 'lib', 'components'].map(r => resolve(r));
    const found: Array<{ file: string; line: number; context: string }> = [];

    const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) {
                if (name === 'node_modules') continue;
                walk(full);
                continue;
            }
            if (!/\.tsx?$/.test(name)) continue;
            // Адмінка навмисно бачить і заплановані пости — інакше Діана не
            // змогла б відкрити чернетку, яка ще не вийшла.
            if (full.includes(`${'/'}admin${'/'}`)) continue;
            // `lib/blog/queue.ts` — це сама черга: вона читає рівно те, що ще
            // НЕ опубліковане, тож гейт видимості відсік би їй усі рядки до
            // єдиного. Крон і кнопки адмінки ходять у базу тільки через неї,
            // і це єдиний файл поза `/admin/`, якому так можна.
            if (full.endsWith(`${'/'}lib${'/'}blog${'/'}queue.ts`)) continue;

            const lines = readFileSync(full, 'utf8').split('\n');
            lines.forEach((line, i) => {
                if (!line.includes("from('blog_posts')")) return;
                found.push({
                    file: full.replace(`${resolve('.')}/`, ''),
                    line: i + 1,
                    // Виклик-обгортка стоїть на тому самому або попередньому рядку.
                    context: lines.slice(Math.max(0, i - 2), i + 1).join('\n'),
                });
            });
        }
    };

    for (const root of roots) walk(root);
    return found;
}

describe('жодне публічне читання постів не обходить гейт', () => {
    const sites = publicReadSites();

    it('місця знайшлися — інакше перевірка перестала щось перевіряти', () => {
        expect(sites.length).toBeGreaterThanOrEqual(8);
    });

    it.each(sites.map(s => [`${s.file}:${s.line}`, s] as const))(
        '%s проходить через onlyVisiblePosts',
        (_label, site) => {
            expect(
                site.context.includes('onlyVisiblePosts('),
                `${site.file}:${site.line} читає blog_posts повз lib/blog/published.ts`,
            ).toBe(true);
        },
    );
});
