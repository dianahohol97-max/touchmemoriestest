import { afterAll, describe, expect, it } from 'vitest';
import {
    clampWords, isPreviewToken, metaDescription, metaTitle, postLocales,
    META_DESCRIPTION_MAX, META_TITLE_MAX,
} from '@/lib/blog/post';
import { getSubsetAlternates } from '@/lib/seo/locales';
import { listPath, pageRange, prevNextLinks, totalPages } from '@/lib/blog/pagination';
import { parseFaq } from '@/components/blog/ArticleFaq';

/**
 * SEO статті: мови, мета-теги, пагінація.
 *
 * СПІЛЬНА РИСА ВСЬОГО, ЩО ТУТ ПЕРЕВІРЯЄТЬСЯ: жодна з цих помилок не падає.
 * hreflang на неіснуючий переклад, заголовок довший за видачу, канонікал
 * пагінації на першу сторінку — усе це працює, показується і мовчить. Видно
 * їх тільки в Search Console через тижні, коли сторінки вже випали з індексу.
 */

describe('hreflang обіцяє тільки те, що існує', () => {
    it('стаття без перекладів віддає одну мову і x-default на неї', () => {
        const post = { locale: 'uk', translations: null };
        expect(postLocales(post)).toEqual(['uk']);

        const alts = getSubsetAlternates('/blog/test', postLocales(post), 'uk');
        expect(Object.keys(alts).sort()).toEqual(['uk-UA', 'x-default']);
        expect(alts['x-default']).toBe('https://touchmemories.com.ua/uk/blog/test');
    });

    it('порожній обʼєкт перекладу не робить статтю перекладеною', () => {
        // Такий обʼєкт заводиться сам, щойно хтось відкрив вкладку мови в
        // редакторі й нічого не написав. Порахувати його за переклад означає
        // пообіцяти Google німецьку версію українського тексту.
        const post = { locale: 'uk', translations: { de: {}, en: { title: 'Only a title' } } };
        expect(postLocales(post)).toEqual(['uk']);
    });

    it('переклад із заголовком і тілом рахується', () => {
        const post = {
            locale: 'uk',
            translations: { en: { title: 'How to pick', content: 'text' } },
        };
        expect(postLocales(post)).toEqual(['uk', 'en']);
        expect(Object.keys(getSubsetAlternates('/blog/test', postLocales(post), 'uk')).sort())
            .toEqual(['en', 'uk-UA', 'x-default']);
    });

    it('x-default веде на базову мову статті, а не на uk наосліп', () => {
        const alts = getSubsetAlternates('/blog/test', ['en'], 'en');
        expect(alts['x-default']).toBe('https://touchmemories.com.ua/en/blog/test');
    });
});

describe('мета-теги вкладаються в розміри видачі', () => {
    it('заголовок ріжеться по слову, а не посеред нього', () => {
        const post = {
            locale: 'uk',
            meta_title: 'Фотоальбом для вклеювання: сім ідей, як зібрати його так, щоб його гортали роками',
        };
        const title = metaTitle(post, 'uk');
        expect(title.length).toBeLessThanOrEqual(META_TITLE_MAX);
        expect(title.endsWith(' ')).toBe(false);
        // Останнє слово має бути цілим: наступний символ оригіналу — не літера.
        // Кома чи крапка там бути можуть, бо хвостова пунктуація зрізається.
        expect(post.meta_title.startsWith(title)).toBe(true);
        const next = post.meta_title[title.length];
        expect(next === undefined || !/\p{L}/u.test(next)).toBe(true);
    });

    it('бренд із бази не подвоюється', () => {
        // Половина рядків у базі вже несе суфікс, а сторінка додає свій.
        const post = { locale: 'uk', meta_title: 'Як обрати фотокнигу | Touch.Memories' };
        expect(metaTitle(post, 'uk')).toBe('Як обрати фотокнигу');
    });

    it('короткий опис доповнюється початком статті', () => {
        const post = {
            locale: 'uk',
            excerpt: 'Коротко про головне.',
            content: '# Заголовок\n\nФотоальбом для вклеювання лишає місце для підписів рукою, і саме це робить його теплішим за друковану книгу, яку неможливо доповнити.',
        };
        const description = metaDescription(post, 'uk');
        expect(description.length).toBeGreaterThan(100);
        expect(description.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
        // Розмітка в опис не потрапляє.
        expect(description).not.toContain('#');
    });

    it('довгий опис ріжеться і не лишає хвостової коми', () => {
        const post = { locale: 'uk', meta_description: `${'слово '.repeat(60)}` };
        const description = metaDescription(post, 'uk');
        expect(description.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
        expect(/[\s,.;:—–-]$/.test(description)).toBe(false);
    });

    it('слово, довше за ліміт, усе одно ріжеться', () => {
        expect(clampWords('а'.repeat(100), 20)).toHaveLength(20);
    });
});

describe('пагінація має справжні адреси', () => {
    it('перша сторінка — це /blog, а не /blog/storinka/1', () => {
        expect(listPath('uk', null, 1)).toBe('/uk/blog');
        expect(listPath('uk', null, 2)).toBe('/uk/blog/storinka/2');
        expect(listPath('uk', 'travel', 3)).toBe('/uk/blog/category/travel/storinka/3');
    });

    it('межі range рахуються з одиниці', () => {
        expect(pageRange(1)).toEqual({ from: 0, to: 8 });
        expect(pageRange(2)).toEqual({ from: 9, to: 17 });
        // Нуль і сміття читаються як перша сторінка, а не як відʼємний зсув:
        // `.range(-9, -1)` PostgREST віддав би порожньо без жодної помилки.
        expect(pageRange(0)).toEqual({ from: 0, to: 8 });
        expect(pageRange(NaN)).toEqual({ from: 0, to: 8 });
    });

    it('порожній блог — це одна сторінка, а не нуль', () => {
        expect(totalPages(0)).toBe(1);
        expect(totalPages(null)).toBe(1);
        expect(totalPages(9)).toBe(1);
        expect(totalPages(10)).toBe(2);
    });

    it('prev і next зʼявляються тільки там, де є куди йти', () => {
        expect(prevNextLinks('uk', null, 1, 3)).toEqual({ next: 'https://touchmemories.com.ua/uk/blog/storinka/2' });
        expect(prevNextLinks('uk', null, 3, 3)).toEqual({ previous: 'https://touchmemories.com.ua/uk/blog/storinka/2' });
        expect(prevNextLinks('uk', null, 1, 1)).toEqual({});
    });
});

describe('FAQ читається з того, що віддала модель', () => {
    it('обидві форми ключів', () => {
        expect(parseFaq([{ q: 'Питання', a: 'Відповідь' }, { question: 'Друге', answer: 'Друга' }]))
            .toEqual([{ q: 'Питання', a: 'Відповідь' }, { q: 'Друге', a: 'Друга' }]);
    });

    it('половинчастий запис відкидається', () => {
        // Акордеон із питанням без відповіді гірший за його відсутність, а в
        // розмітці FAQPage це ще й обіцянка, якої сторінка не виконує.
        expect(parseFaq([{ q: 'Питання', a: '' }, 'сміття', null])).toEqual([]);
    });

    it('не масив — не FAQ', () => {
        expect(parseFaq('питання' as any)).toEqual([]);
        expect(parseFaq(null)).toEqual([]);
    });

    it('більше пʼяти питань зрізається', () => {
        const many = Array.from({ length: 9 }, (_, i) => ({ q: `Питання ${i}`, a: 'Відповідь' }));
        expect(parseFaq(many)).toHaveLength(5);
    });
});

describe('прев\'ю чернетки', () => {
    const OLD = process.env.BLOG_PREVIEW_SECRET;
    afterAll(() => { process.env.BLOG_PREVIEW_SECRET = OLD; });

    it('без змінної не відкривається нічим', () => {
        // Найгірший випадок: порожній секрет і запит без токена дали б
        // '' === '' і відкрили чернетки всьому світу.
        delete process.env.BLOG_PREVIEW_SECRET;
        expect(isPreviewToken('')).toBe(false);
        expect(isPreviewToken(null)).toBe(false);
        expect(isPreviewToken('щось')).toBe(false);
    });

    it('збігається тільки точний токен', () => {
        process.env.BLOG_PREVIEW_SECRET = 'taemnyi-kliuch';
        expect(isPreviewToken('taemnyi-kliuch')).toBe(true);
        expect(isPreviewToken('taemnyi-kliucH')).toBe(false);
        expect(isPreviewToken('taemnyi')).toBe(false);
        expect(isPreviewToken(undefined)).toBe(false);
    });
});
