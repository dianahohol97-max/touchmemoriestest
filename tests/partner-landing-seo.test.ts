import { describe, it, expect } from 'vitest';
import { getPartnerHub, getPartnerLanding, landingHref, type PartnerLanding } from '@/lib/partners/landing-content';

/**
 * Текст трьох сторінок партнерської програми перевіряється тестом, бо
 * перевіряти його очима не виходить.
 *
 * НАВІЩО. На лендінгу, написаному під пошук, ламається не код, а текст, і
 * ламається тихо: дописали абзац — і та сама фраза поїхала в третій заголовок,
 * поправили умови — і в одному місці лишилося старе число. Побачити це можна
 * тільки прочитавши всю сторінку підряд, чого ніхто не робить після дрібної
 * правки. Тут те саме коштує секунду.
 *
 * Що саме ловиться:
 *   1. Заборонені слова. Ми ніколи не згадуємо ні Canva, ні ретуш, ні того,
 *      хто друкує — це правило бренду, а не смак.
 *   2. Переоптимізацію. Кожна ключова фраза має бути в одному структурному
 *      елементі, а її частка в тексті — не більше півтора відсотка.
 *   3. Втрачений ключ. Фраза, заради якої сторінка й писалася, може зникнути
 *      при переписуванні абзацу, і нічого не впаде.
 *   4. Речення з одного-двох слів — окреме правило Діани для української.
 *   5. Написання бренду: touch.memories з крапкою і з малої літери.
 */

const FORBIDDEN = ['canva', 'ретуш', 'виробничий партнер', 'виробничого партнера'];

/** Ключові фрази сторінки. Число — скільки разів фраза може трапитися в тексті. */
type KeywordSpec = Array<[phrase: string, maxOccurrences: number]>;

// Ядро стоїть у Title і в H1, тобто рівно двічі; решта — по одному разу.
const BLOGGER_KEYWORDS: KeywordSpec = [
    ['партнерська програма для тревел-блогерів', 2],
    ['реферальна програма для тревел-блогерів', 1],
    ['як блогеру заробити на рекомендаціях', 1],
    ['affiliate програма для блогера', 1],
    ['заробити на партнерському посиланні', 1],
    ['монетизація тревел-блогу', 1],
    ['партнерка для інстаграм-блогера', 1],
    ['заробіток на рекомендаціях продукту', 1],
    ['як заробити блогеру без реклами', 1],
    ['партнерська програма без вкладень', 1],
    ['скільки платить партнерська програма за замовлення', 1],
    ['реферальна програма з відсотком від продажу', 1],
    ['заробіток блогера на фотокнигах', 1],
    ['монетизація блогу без продажу власного продукту', 1],
];

const AGENCY_KEYWORDS: KeywordSpec = [
    ['партнерська програма для турагентств', 2],
    ['співпраця з туристичною агенцією', 1],
    ['реферальна програма для тревел-агенцій', 1],
    ['подарунок клієнту турагентства після туру', 1],
    ['сертифікат на фотокнигу для клієнтів агенції', 1],
    ['додатковий дохід турагентства', 1],
    ['партнерство з туристичними компаніями', 1],
    ['що подарувати клієнту після туру', 1],
    ['як турагентству заробити на рекомендаціях', 1],
    ['сертифікат на тревелбук зі знижкою', 1],
    ['співпраця турагентства з виробником фотокниг', 1],
    ['подарунковий сертифікат для клієнтів туристичної фірми', 1],
];

// LSI — їх шукаємо коренем, бо в тексті вони стоять у різних відмінках.
const BLOGGER_LSI = ['персональне посилання', 'знижка клієнту', 'кабінет', 'виплата на карту', 'реферальне посилання'];
const AGENCY_LSI = ['кабінет', 'винагород', 'реферальне посилання', 'знижк', 'виплат'];

function normalise(text: string): string {
    return text.toLowerCase().replace(/[’ʼ']/g, "'");
}

function countWords(text: string): number {
    return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’ʼ-]*/gu) || []).length;
}

function occurrences(haystack: string, needle: string): number {
    const h = normalise(haystack);
    const n = normalise(needle);
    let count = 0;
    let from = 0;
    for (;;) {
        const at = h.indexOf(n, from);
        if (at === -1) return count;
        count += 1;
        from = at + n.length;
    }
}

/** Увесь текст сторінки — усе, що бачить людина, плюс meta. */
function landingText(l: PartnerLanding): string {
    return [
        l.metaTitle, l.metaDescription, l.badge, l.h1, l.intro,
        ...l.sections.flatMap(s => [s.h2, s.lead, s.alt, ...s.cards.flatMap(c => [c.title, c.text])]),
        l.faqH2, l.faqAlt, ...l.faq.flatMap(f => [f.q, f.a]),
        l.ctaH2, l.ctaText, l.ctaPrimary, l.ctaSecondary,
    ].join(' ');
}

/** Суцільні абзаци, до яких застосовується правило про короткі речення. */
function landingProse(l: PartnerLanding): string[] {
    return [
        l.metaDescription, l.intro,
        ...l.sections.flatMap(s => [s.lead, ...s.cards.map(c => c.text)]),
        ...l.faq.map(f => f.a),
        l.ctaText,
    ];
}

function shortSentences(paragraph: string): string[] {
    return paragraph
        .split(/(?<=[.!?…])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && countWords(s) > 0 && countWords(s) < 3);
}

const LANDINGS: Array<[name: string, landing: PartnerLanding, keywords: KeywordSpec, lsi: string[]]> = [
    ['для блогерів', getPartnerLanding('blogger', 'uk'), BLOGGER_KEYWORDS, BLOGGER_LSI],
    ['для турагентств', getPartnerLanding('agency', 'uk'), AGENCY_KEYWORDS, AGENCY_LSI],
];

describe('лендінги партнерської програми', () => {
    for (const [name, landing, keywords, lsi] of LANDINGS) {
        describe(name, () => {
            const text = landingText(landing);
            const total = countWords(text);

            it('не містить жодного забороненого слова', () => {
                for (const word of FORBIDDEN) {
                    expect(normalise(text)).not.toContain(word);
                }
            });

            it('пише бренд як touch.memories', () => {
                // «Touch.Memories» з великих літер лишилося на старих сторінках;
                // нові пишуться так, як каже бренд-гайд.
                expect(text).not.toMatch(/Touch[.\s]?Memories/);
                expect(text).toContain('touch.memories');
            });

            it('тримає кожен ключ у своєму елементі, без повторів', () => {
                for (const [phrase, max] of keywords) {
                    const found = occurrences(text, phrase);
                    expect(found, `«${phrase}» — знайдено ${found} разів`).toBeGreaterThan(0);
                    expect(found, `«${phrase}» повторюється ${found} разів`).toBeLessThanOrEqual(max);
                }
            });

            it('тримає щільність кожного ключа нижче 1,5%', () => {
                for (const [phrase] of keywords) {
                    const density = (occurrences(text, phrase) * countWords(phrase)) / total;
                    expect(density, `«${phrase}» — ${(density * 100).toFixed(2)}%`).toBeLessThanOrEqual(0.015);
                }
            });

            it('вживає супутні слова природно по тексту', () => {
                for (const word of lsi) {
                    expect(occurrences(text, word), `«${word}» не трапляється жодного разу`).toBeGreaterThan(0);
                }
            });

            it('не має речень з одного-двох слів', () => {
                // Правило Діани для будь-якого українського тексту на сайті.
                for (const paragraph of landingProse(landing)) {
                    expect(shortSentences(paragraph), paragraph).toEqual([]);
                }
            });

            it('має рівно чотири питання FAQ, і всі вони питання', () => {
                expect(landing.faq).toHaveLength(4);
                for (const { q, a } of landing.faq) {
                    expect(q.endsWith('?'), `«${q}» не закінчується знаком питання`).toBe(true);
                    // Відповідь для FAQPage має бути відповіддю, а не рядком «так».
                    expect(countWords(a)).toBeGreaterThan(8);
                }
            });

            it('обіцяє ті самі умови, що й партнерський кабінет', () => {
                // Числа з lib/agency/create-partner.ts: 5% з тревелбуків, 3% з
                // решти, знижка клієнту 5%, виплата від 500 грн. Якщо умови
                // колись зміняться, цей рядок має впасти разом із ними.
                expect(text).toContain('5%');
                expect(text).toContain('3%');
                expect(text).toContain('500 грн');
            });

            it('веде заявку на форму з правильним типом партнера', () => {
                expect(['blogger', 'agency']).toContain(landing.applyKind);
            });
        });
    }

    it('meta сторінки для блогерів збігається з погодженою', () => {
        const l = getPartnerLanding('blogger', 'uk');
        expect(l.metaTitle).toBe('Партнерська програма для тревел-блогерів | touch.memories');
        expect(l.h1).toBe('Партнерська програма для тревел-блогерів');
        expect(l.path).toBe('/partnerska-programa-dlya-blogeriv');
    });

    it('meta сторінки для турагентств збігається з погодженою', () => {
        const l = getPartnerLanding('agency', 'uk');
        expect(l.metaTitle).toBe('Партнерська програма для турагентств | touch.memories');
        expect(l.h1).toBe('Партнерська програма для турагентств');
        expect(l.path).toBe('/partnerska-programa-dlya-turagentstv');
    });

    it('meta description вкладається в межі сніпета', () => {
        for (const [, landing] of LANDINGS) {
            expect(landing.metaDescription.length).toBeLessThanOrEqual(320);
            expect(landing.metaDescription.length).toBeGreaterThan(80);
        }
    });

    describe('хаб співпраці', () => {
        const hub = getPartnerHub('uk');

        it('веде на обидві профільні сторінки', () => {
            expect(hub.routes.map(r => landingHref('uk', r.landing))).toEqual([
                '/uk/partnerska-programa-dlya-blogeriv',
                '/uk/partnerska-programa-dlya-turagentstv',
            ]);
        });

        it('лишає на місці умови сертифікатів', () => {
            const certificates = [hub.certificates.lead, ...hub.certificates.cards.map(c => c.text)].join(' ');
            expect(certificates).toContain('10%');
            expect(certificates).toContain('три місяці');
        });

        it('не містить заборонених слів і пише бренд правильно', () => {
            const text = [hub.metaTitle, hub.metaDescription, hub.h1, hub.intro, hub.chooseH2, hub.chooseLead,
                hub.certificates.h2, hub.certificates.lead,
                ...hub.certificates.cards.flatMap(c => [c.title, c.text]),
                ...hub.routes.flatMap(r => [r.title, r.text, r.cta, r.alt])].join(' ');
            for (const word of FORBIDDEN) expect(normalise(text)).not.toContain(word);
            expect(text).not.toMatch(/Touch[.\s]?Memories/);
        });
    });

    it('падає назад на українську, коли локаль не перекладена', () => {
        // Сторінки відкриваються за будь-якою локаллю, а перекладу поки немає:
        // getServerT бере ключ з uk.json, і /de показує те саме, що /uk.
        expect(getPartnerLanding('blogger', 'de').h1).toBe(getPartnerLanding('blogger', 'uk').h1);
    });
});
