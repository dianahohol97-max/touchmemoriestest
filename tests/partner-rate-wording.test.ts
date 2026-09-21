import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPartnerWelcomeEmail } from '@/lib/agency/welcome-email';
import { getPartnerHub, getPartnerLanding, type PartnerLanding } from '@/lib/partners/landing-content';

/**
 * П'ятивідсоткова ставка діє НЕ ТІЛЬКИ на тревелбуки, і текст мусить це казати.
 *
 * ІСТОРІЯ. Правило Діани від 04.08.2026 звучить «5% на тревелбуки і журнали,
 * решта 3%», і код його виконує: `isPremiumRateItem` у lib/agency/commission.ts
 * кладе в дорожчий кошик і тревелбуки, і глянцеві журнали. А колонка, з якої
 * береться ставка, зветься `travelbook_rate` — і кожен, хто писав текст для
 * людей, читав це ім'я буквально. Так у шести місцях зʼявилося «5% з
 * тревелбуків і 3% з решти товарів»: партнер читав, що за журнал отримає три
 * відсотки, а отримував пʼять. Помилка була на його користь, тому ніхто й не
 * поскаржився — знайшлася вона при звірці цифр 21.09.2026.
 *
 * ЧОМУ ТЕСТ, А НЕ ПРАВКА. Правка вже зроблена, але наступний текст напишуть з
 * того самого імені колонки, бо воно нікуди не ділося (перейменування зачепило
 * б кожен запит на виплату). Тож перевіряється саме правило: якщо речення
 * називає пʼять відсотків і тревелбук, воно мусить назвати і журнал. Речення
 * про знижку клієнту 5% під умову не підпадають, бо тревелбук у них не
 * згадується.
 */

const TRAVELBOOK = /тревелбук|travelbook|тревел-бук/i;
const MAGAZINE = /журнал|magazine/i;
const FIVE_PERCENT = /5\s?%/;

/** Речення, які обіцяють пʼять відсотків саме з тревелбуків. */
function rateSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?…])\s+|\n+|<\/?[a-z][^>]*>/i)
        .map(s => s.trim())
        .filter(s => FIVE_PERCENT.test(s) && TRAVELBOOK.test(s));
}

function expectMagazineNamed(source: string, text: string) {
    const sentences = rateSentences(text);
    expect(sentences.length, `${source}: жодної згадки ставки — тест перестав щось перевіряти`).toBeGreaterThan(0);
    for (const sentence of sentences) {
        expect(MAGAZINE.test(sentence), `${source}: «${sentence}» обіцяє 5% лише з тревелбуків`).toBe(true);
    }
}

function landingText(l: PartnerLanding): string {
    return [
        l.metaTitle, l.metaDescription, l.intro,
        ...l.sections.flatMap(s => [s.h2, s.lead, ...s.cards.flatMap(c => [c.title, c.text])]),
        ...l.faq.flatMap(f => [f.q, f.a]),
        l.ctaText,
    ].join('\n');
}

describe('ставка 5% усюди названа разом із журналами', () => {
    it('лендінг для блогерів', () => {
        expectMagazineNamed('лендінг для блогерів', landingText(getPartnerLanding('blogger', 'uk')));
    });

    it('лендінг для турагентств', () => {
        expectMagazineNamed('лендінг для турагентств', landingText(getPartnerLanding('agency', 'uk')));
    });

    it('хаб співпраці не називає ставку сам', () => {
        // Хаб навмисно відсилає по умови на профільні сторінки. Якщо ставка
        // колись зʼявиться і тут, її треба буде написати повністю — тоді цей
        // тест впаде і про це нагадає.
        const hub = getPartnerHub('uk');
        const text = [hub.metaDescription, hub.intro, hub.certificates.lead, ...hub.routes.map(r => r.text)].join('\n');
        for (const sentence of rateSentences(text)) {
            expect(MAGAZINE.test(sentence), `хаб: «${sentence}» обіцяє 5% лише з тревелбуків`).toBe(true);
        }
    });

    it('вітальний лист партнеру, і в HTML, і в текстовій частині', () => {
        const { html, text } = buildPartnerWelcomeEmail({
            email: 'studio@example.com',
            name: 'Подорожуй!',
            code: 'ПОДОTABB',
            cabinetToken: '11111111-2222-3333-4444-555555555555',
            partnerKind: 'travel_agency',
            clientDiscount: 5,
            travelbookRate: 5,
            otherRate: 3,
        });
        // У HTML підпис рядка і саме число стоять у різних комірках
        // таблиці, тож правило «одне речення» їх не звʼяже — перевіряємо
        // підпис навпроти ставки.
        expect(html).toContain('Комісія з тревелбуків і глянцевих журналів:');
        expect(html).not.toContain('Комісія з тревелбуків:');
        expectMagazineNamed('лист партнеру (текст)', text);
    });

    it('картка сайту для ШІ-асистентів', () => {
        // llms.txt читають ChatGPT, Perplexity і Claude, і цитують вони саме
        // цифри. Неправильна формула тут розходиться далі за будь-яку сторінку.
        expectMagazineNamed('public/llms.txt', readFileSync(resolve('public/llms.txt'), 'utf8'));
    });

    it('підказка в адмінці над списком партнерів', () => {
        const page = readFileSync(resolve('app/admin/agency-partners/page.tsx'), 'utf8');
        const hint = page.split('\n').filter(l => l.includes('Реферальна програма:')).join('\n');
        expect(hint, 'підказка зникла — онови тест разом зі сторінкою').not.toBe('');
        expectMagazineNamed('адмінка, підказка', hint);
    });
});
