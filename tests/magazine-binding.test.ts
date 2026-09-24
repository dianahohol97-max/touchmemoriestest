import { describe, expect, it } from 'vitest';
import {
    MAGAZINE_STAPLE_MAX_PAGES,
    PHOTO_JOURNAL_SOFT,
    getBindingInfo,
    getBindingType,
} from '@/lib/products';

/**
 * ПОРІГ ПАЛІТУРКИ ГЛЯНЦЕВОГО ЖУРНАЛУ.
 *
 * Друкарня назвала його 24.09.2026: до п'ятдесяти двох сторінок включно
 * скоба, більший обсяг на клей. До того і в коді, і в описі товару п'ятьма
 * мовами стояло 44, і звідки воно взялося, не пам'ятає ніхто.
 *
 * Ціна помилки несиметрична і платить її клієнт. Рівний корінець із назвою —
 * одна з причин брати товщий журнал, і на 48 та 52 сторінках ми його
 * обіцяли, а виробництво робило скобу. Побачити це можна лише отримавши
 * коробку, тобто вже після оплати.
 *
 * Тест тримає три речі разом: саме число, його узгодженість із переліком
 * тиражів, і те, що обидві половини `getBindingInfo` кажуть про той самий
 * поріг. Опис товару в базі сюди не дістає — він правиться міграцією
 * `20260924_magazine_binding_threshold.sql`, і це єдине місце порогу, яке
 * тест не бачить.
 */
describe('поріг палітурки', () => {
    it('ставить скобу до 52 сторінок включно', () => {
        expect(MAGAZINE_STAPLE_MAX_PAGES).toBe(52);
        expect(getBindingType(52)).toBe('saddle-stitch');
    });

    /** Саме та межа, на якій текст раніше суперечив сам собі. */
    it('віддає на клей усе, що більше за поріг', () => {
        expect(getBindingType(60)).toBe('perfect-binding');
        expect(getBindingType(100)).toBe('perfect-binding');
    });

    it('лишає скобу на тиражах, які раніше помилково йшли в клей', () => {
        // 48 і 52 при старому порозі 44 читалися як клейові.
        expect(getBindingType(48)).toBe('saddle-stitch');
        expect(getBindingType(44)).toBe('saddle-stitch');
        expect(getBindingType(8)).toBe('saddle-stitch');
    });

    /**
     * Поріг мусить бути тиражем, який справді продається. Інакше межа
     * описує обсяг, якого не існує, — так у тексті й з'явилося «від 46
     * сторінок», хоча 46 немає в переліку взагалі.
     */
    it('називає порогом тираж, який є в переліку', () => {
        expect(PHOTO_JOURNAL_SOFT.pagesAvailable).toContain(MAGAZINE_STAPLE_MAX_PAGES);
    });

    it('не обіцяє клейової палітурки на тиражі, якого немає в переліку', () => {
        const firstGlued = PHOTO_JOURNAL_SOFT.pagesAvailable.find(p => p > MAGAZINE_STAPLE_MAX_PAGES);
        expect(firstGlued).toBe(60);
        expect(getBindingInfo(100).description).toContain(String(firstGlued));
    });

    /** Обидві половини картки палітурки мусять говорити про один поріг. */
    it('узгоджує тексти скоби і клею між собою', () => {
        expect(getBindingInfo(8).description).toContain(String(MAGAZINE_STAPLE_MAX_PAGES));
        expect(getBindingInfo(8).type).toBe('saddle-stitch');
        expect(getBindingInfo(100).type).toBe('perfect-binding');
    });

    /** Число не мусить лишитися в рядку, який його вже не описує. */
    it('не тримає старого 44 у жодному з описів', () => {
        expect(getBindingInfo(8).description).not.toContain('44');
        expect(getBindingInfo(100).description).not.toContain('46');
        expect(PHOTO_JOURNAL_SOFT.binding).not.toContain('44');
        expect(PHOTO_JOURNAL_SOFT.binding).toContain('52');
    });
});
