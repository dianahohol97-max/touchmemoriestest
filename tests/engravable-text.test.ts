import { describe, expect, it } from 'vitest';
import { hasEmoji, isEngravedDeco, stripEmoji } from '@/lib/print/engravable-text';

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
