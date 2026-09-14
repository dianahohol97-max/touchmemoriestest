import { describe, expect, it } from 'vitest';
import { engravedInscriptions, hasEmoji, isEngravedDeco, stripEmoji } from '@/lib/print/engravable-text';

/**
 * Правило: емодзі на гравіювання не йдуть (Діана, 2026-09-07).
 *
 * Тест стереже межу правила з обох боків. Пропустити емодзі означає чорну
 * пляму на металі, яку помітять уже після верстата. Прибрати зайве — забрати
 * у клієнта ♡ і ★, якими обкладинки оформлюють свідомо і заради яких у
 * font-coverage окремо доклали шрифти.
 */
describe('stripEmoji', () => {
    /** Напис із TM-001288 — той самий, що поїхав би під лазер із сердечками. */
    it('removes the emoji from a real inscription and closes the gap', () => {
        const r = stripEmoji('Із тисячі доріг - одна привела нас одне до одного🤍11.07.2026🤍');
        expect(r.text).toBe('Із тисячі доріг - одна привела нас одне до одного11.07.2026');
        expect(r.dropped).toEqual(['🤍']);
    });

    it('does not leave a double space where an emoji stood between words', () => {
        const r = stripEmoji('Наталя 🤍 Олег');
        expect(r.text).toBe('Наталя Олег');
    });

    it('keeps typographic marks that are not emoji', () => {
        // Саме вони живуть у роздільниках на обкладинках.
        const r = stripEmoji('─── ♡ ─── ♥ ★ ☀ ✓ — 7');
        expect(r.dropped).toEqual([]);
        expect(r.text).toBe('─── ♡ ─── ♥ ★ ☀ ✓ — 7');
    });

    it('removes a text glyph that was explicitly asked to render as emoji', () => {
        // ❤ + FE0F — це вже кольорове емодзі за задумом автора.
        const r = stripEmoji('Разом ❤️ назавжди');
        expect(r.text).toBe('Разом назавжди');
        expect(r.dropped).toContain('❤');
    });

    it('removes flags, skin tones and joined sequences whole', () => {
        expect(stripEmoji('Слава 🇺🇦').text).toBe('Слава');
        expect(stripEmoji('👍🏽').text).toBe('');
        expect(stripEmoji('сімʼя 👨‍👩‍👧 разом').text).toBe('сімʼя разом');
    });

    it('leaves an ordinary inscription byte for byte', () => {
        const plain = 'Наталя та Олег\n11.07.2026';
        const r = stripEmoji(plain);
        expect(r.text).toBe(plain);
        expect(r.dropped).toEqual([]);
    });

    it('keeps the author own line breaks', () => {
        expect(stripEmoji('Наталя 🤍\nта Олег').text).toBe('Наталя\nта Олег');
    });

    it('survives empty input', () => {
        expect(stripEmoji('')).toEqual({ text: '', dropped: [] });
        expect(stripEmoji(null)).toEqual({ text: '', dropped: [] });
        expect(stripEmoji(undefined)).toEqual({ text: '', dropped: [] });
    });

    it('returns an empty string when the whole inscription was emoji', () => {
        expect(stripEmoji('🤍🤍🤍').text).toBe('');
    });
});

describe('hasEmoji', () => {
    it('answers the question the editor asks before warning the customer', () => {
        expect(hasEmoji('Наталя 🤍 Олег')).toBe(true);
        expect(hasEmoji('Наталя та Олег')).toBe(false);
        expect(hasEmoji('─── ♡ ───')).toBe(false);
    });
});

describe('isEngravedDeco', () => {
    it('covers exactly the three types that go under the laser', () => {
        expect(isEngravedDeco('metal')).toBe(true);
        expect(isEngravedDeco('graviruvannya')).toBe(true);
        expect(isEngravedDeco('flex')).toBe(true);
    });

    it('leaves the printed inserts alone — they are full colour', () => {
        expect(isEngravedDeco('acryl')).toBe(false);
        expect(isEngravedDeco('photovstavka')).toBe(false);
        expect(isEngravedDeco('none')).toBe(false);
        expect(isEngravedDeco(null)).toBe(false);
    });
});

/**
 * Сигнал для менеджера: емодзі в написі, який поїде під лазер.
 *
 * Фільтр у полі вводу стоїть не на всіх шляхах — TM-001165, TM-001203,
 * TM-001204 і TM-001209 прийшли саме там, де його немає, і ніхто цього не
 * побачив до друку. Тому правило читає ГОТОВУ позицію, де всі ключі лежать
 * поруч, і називає проблему замість того, щоб мовчки її виправити.
 */
describe('engravedInscriptions', () => {
    it('персоналізований напис на альбомі — випадок TM-001209', () => {
        const found = engravedInscriptions({
            'Колір напису': 'Білий',
            'Текст напису': 'FAMILY🤍 Л+И',
            'Шрифт напису': 'Philosopher',
            'Розмір напису': 'Великий',
        });
        expect(found).toEqual([{ key: 'Текст напису', text: 'FAMILY🤍 Л+И', dropped: ['🤍'] }]);
    });

    it('вільний напис на велюрі — той самий лазер, хоч вставка й акрилова', () => {
        const found = engravedInscriptions({
            'Обкладинка': 'Велюр',
            'Текст на обкладинці': 'Олександр & Наталія 🤍',
            'Декорація обкладинки': 'Акрилова вставка',
            'Спосіб напису на обкладинці': 'гравірування',
        });
        expect(found.map(f => f.key)).toEqual(['Текст на обкладинці']);
    });

    it('друкована обкладинка кольорова — емодзі на ній проходить', () => {
        expect(engravedInscriptions({
            'Матеріал обкладинки': 'Друкована',
            'Напис на обкладинку': 'Kyrylo & Sasha 🤍 15.08.26',
        })).toEqual([]);
    });

    it('напис на акриловій вставці друкується, а на металевій гравіюється', () => {
        expect(engravedInscriptions({
            'Декорація обкладинки': 'Акрилова вставка',
            'Напис на декорації': 'Весілля 🤍',
        })).toEqual([]);
        expect(engravedInscriptions({
            'Декорація обкладинки': 'Металева вставка',
            'Напис на декорації': 'Весілля 🤍',
        }).map(f => f.key)).toEqual(['Напис на декорації']);
    });

    it('напис без емодзі сигналу не дає', () => {
        expect(engravedInscriptions({
            'Обкладинка': 'Велюр',
            'Напис на декорації': 'Андрій & Мар\'яна',
            'Декорація обкладинки': 'гравірування',
        })).toEqual([]);
    });

    it('типографіка лишається типографікою', () => {
        expect(engravedInscriptions({ 'Текст напису': '─── ♡ ─── 2026' })).toEqual([]);
    });

    it('порожні опції й порожні написи нічого не повертають', () => {
        expect(engravedInscriptions(null)).toEqual([]);
        expect(engravedInscriptions({})).toEqual([]);
        expect(engravedInscriptions({ 'Текст напису': '   ' })).toEqual([]);
    });
});
