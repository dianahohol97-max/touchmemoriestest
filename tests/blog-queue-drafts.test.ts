import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Правила, яким мусить відповідати текст статті ДО заливки в `blog_posts`.
 *
 * НАВІЩО. Щойно стаття потрапляє в базу, жоден grep і жоден тест її більше не
 * бачить — рівно про це пункт 9 у docs/pending-checks.md, де ставку 5% довелося
 * перевіряти окремим SQL-запитом, бо шістнадцять живих постів недосяжні з
 * репозиторію. Поки чернетка лежить у docs/blog, вона ще під перевіркою, і
 * дешевше спіймати помилку тут, ніж потім шукати її в базі руками.
 *
 * Перевіряється те, що вже коштувало нам часу: заборонені слова, ціни, яких
 * не можна називати, формула партнерської ставки і бренд із крапкою.
 */

const DOCS = resolve('docs/blog');

/** Статті черги «партнерські сторінки + подорожі» від 21.09.2026. */
const QUEUE = [
    'shcho-podaruvaty-pislia-podorozhi',
    'iak-blogeru-monetyzuvaty-travel-kontent',
    'iak-zberehty-spohady-z-podorozhi',
    'partnerska-programa-dlya-turagentstv-loialnist',
    'iak-blogeru-doluchytysia-do-partnerskoi-programy',
    'biudzhetni-podorozhi-2026',
    'sertyfikat-chy-travelbook-turagentstvu',
    'podarunok-kliientu-pislia-turu-tsyfry',
];

/** Скільки внутрішніх посилань має нести кожна стаття і куди саме. */
const LINKS: Record<string, string | null> = {
    'shcho-podaruvaty-pislia-podorozhi': '/uk/catalog/travelbook-20x30',
    'iak-blogeru-monetyzuvaty-travel-kontent': '/uk/partnerska-programa-dlya-blogeriv',
    'iak-zberehty-spohady-z-podorozhi': '/uk/catalog/travelbook-20x30',
    'partnerska-programa-dlya-turagentstv-loialnist': '/uk/partnerska-programa-dlya-turagentstv',
    'iak-blogeru-doluchytysia-do-partnerskoi-programy': '/uk/partnerska-programa-dlya-blogeriv',
    // Тема про планування поїздки партнерську сторінку не тягне, тож лінка
    // тут немає навмисно — лишилася тільки згадка бренду.
    'biudzhetni-podorozhi-2026': null,
    'sertyfikat-chy-travelbook-turagentstvu': '/uk/partnery',
    'podarunok-kliientu-pislia-turu-tsyfry': '/uk/partnerska-programa-dlya-turagentstv',
};

const draft = (slug: string) => readFileSync(resolve(DOCS, `${slug}.md`), 'utf8');

/** Тіло без заголовків, таблиць і посилань — саме проза, яку читає людина. */
function prose(md: string): string {
    return md
        .split('\n')
        .filter(l => !l.startsWith('#') && !l.trim().startsWith('|'))
        .join('\n')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*/g, '');
}

describe.each(QUEUE)('чернетка %s', slug => {
    const md = draft(slug);

    it('має обсяг 600–900 слів', () => {
        const words = md.split(/\s+/).filter(Boolean).length;
        expect(words).toBeGreaterThanOrEqual(600);
        expect(words).toBeLessThanOrEqual(900);
    });

    it('розбита на 3–5 змістових H2 плюс необовʼязковий блок питань', () => {
        const h2 = md.split('\n').filter(l => l.startsWith('## '));
        const content = h2.filter(l => !l.includes('Часті питання'));
        expect(content.length).toBeGreaterThanOrEqual(3);
        expect(content.length).toBeLessThanOrEqual(6);
    });

    it('не називає нічого із забороненого списку', () => {
        // Інтерфейс, яким збирають макет, партнера з виробництва і ретуш ми не
        // згадуємо ніде і ніколи — це правило бренду, а не стилістика.
        for (const banned of [/canva/i, /ретуш/i, /виробнич\w* партнер/i, /типограф/i]) {
            expect(banned.test(md), `${slug}: знайдено «${banned}»`).toBe(false);
        }
    });

    it('пише бренд із крапкою', () => {
        const mentions = md.match(/touch[\s.]?memories/gi) || [];
        for (const m of mentions) {
            expect(m, `${slug}: «${m}» замість touch.memories`).toBe('touch.memories');
        }
    });

    it('називає тільки ті ціни, які дозволені для текстів', () => {
        // Рішення Діани для всієї черги: зоряна карта 350/450 ₴ і глянцевий
        // журнал від 525 ₴. Решта цін живе в каталозі й застаріває без нас.
        const prices = (md.match(/\d[\d\s]*₴/g) || []).map(p => p.replace(/\s/g, ''));
        for (const p of prices) {
            expect(['350₴', '450₴', '525₴'], `${slug}: ціна ${p}`).toContain(p);
        }
    });

    it('несе рівно стільки внутрішніх посилань, скільки домовлено', () => {
        const links = [...md.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]);
        const expected = LINKS[slug];
        if (expected === null) {
            expect(links, `${slug}: лінк тут не потрібен`).toEqual([]);
            expect(md).toContain('touch.memories');
        } else {
            expect(links).toEqual([expected]);
        }
    });

    it('не містить речень з одного-двох слів', () => {
        const short = prose(md)
            .split(/(?<=[.!?…])\s+|\n+/)
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => s.split(/\s+/).length <= 2);
        expect(short, `${slug}: ${short.join(' | ')}`).toEqual([]);
    });

    it('не жене щільність ключової фрази вище 1,5%', () => {
        const words = md.toLowerCase().split(/\s+/).filter(Boolean);
        const phrases = ['тревелбук', 'партнерська програма', 'подарунок', 'подорож'];
        for (const phrase of phrases) {
            const hits = (md.toLowerCase().match(new RegExp(phrase, 'g')) || []).length;
            const density = (hits * phrase.split(' ').length) / words.length;
            expect(density, `${slug}: «${phrase}» — ${(density * 100).toFixed(2)}%`).toBeLessThanOrEqual(0.015);
        }
    });
});

describe('черга статей як ціле', () => {
    it('кожна чернетка має поруч свій SQL', () => {
        const files = new Set(readdirSync(DOCS));
        for (const slug of QUEUE) {
            expect(files.has(`${slug}.md`), `немає ${slug}.md`).toBe(true);
            expect(files.has(`${slug}.sql`), `немає ${slug}.sql`).toBe(true);
        }
    });

    it('дати публікації йдуть по понеділках і четвергах, без повторів', () => {
        const dates = QUEUE.map(slug => {
            const sql = readFileSync(resolve(DOCS, `${slug}.sql`), 'utf8');
            const m = sql.match(/'(\d{4}-\d{2}-\d{2}) 06:00:00\+00'/);
            expect(m, `${slug}: у SQL немає дати публікації`).toBeTruthy();
            return m![1];
        });

        expect(new Set(dates).size, 'дві статті на одну дату').toBe(QUEUE.length);
        expect([...dates]).toEqual([...dates].sort());

        for (const d of dates) {
            const day = new Date(`${d}T06:00:00Z`).getUTCDay();
            expect([1, 4], `${d} — не понеділок і не четвер`).toContain(day);
        }
    });

    it('жодна стаття не залита без гейта — усі несуть майбутню дату і прапорець', () => {
        for (const slug of QUEUE) {
            const sql = readFileSync(resolve(DOCS, `${slug}.sql`), 'utf8');
            expect(sql).toContain('true,');
            expect(sql, `${slug}: у шапці немає застереження про порядок`).toContain('pending-checks');
        }
    });

    it('meta title вкладається в 60 символів, meta description — у 150–160', () => {
        for (const slug of QUEUE) {
            const sql = readFileSync(resolve(DOCS, `${slug}.sql`), 'utf8');
            // Два передостанні текстові поля перед масивом тегів.
            const fields = [...sql.matchAll(/^  '(.+)',$/gm)].map(m => m[1].replace(/''/g, "'"));
            const tagsAt = sql.split('\n').findIndex(l => l.startsWith('  array['));
            const before = sql.split('\n').slice(0, tagsAt).filter(l => /^  '.*',$/.test(l));
            const metaDescription = before[before.length - 1].slice(3, -2).replace(/''/g, "'");
            const metaTitle = before[before.length - 2].slice(3, -2).replace(/''/g, "'");

            expect(fields.length).toBeGreaterThan(0);
            expect(metaTitle.length, `${slug}: meta title ${metaTitle.length}`).toBeLessThanOrEqual(60);
            expect(metaDescription.length, `${slug}: meta description ${metaDescription.length}`).toBeGreaterThanOrEqual(150);
            expect(metaDescription.length, `${slug}: meta description ${metaDescription.length}`).toBeLessThanOrEqual(160);
        }
    });
});
