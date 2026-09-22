import { describe, it, expect } from 'vitest';
import {
    FORZAT_OPTION,
    NO_FORZAT,
    forzatShortfallLine,
    isForzatPaid,
    missingForzatFiles,
    paidForzatSides,
} from '@/lib/print/forzat-expectation';

/**
 * Значення опції приходить трьома різними словниками, і кожен новий спосіб її
 * записати мовчки вимкнув би перевірку. Рядки нижче — не вигадані: усі взяті з
 * замовлень у базі або зі словника lib/orders/item-options.ts.
 */

describe('чи оплачено друк на форзаці', () => {
    it('конструктор пише сторони прямо', () => {
        expect(isForzatPaid('Так (перший + останній)')).toBe(true);
        expect(isForzatPaid('Так (перший)')).toBe(true);
    });

    it('сторінка товару пише словником', () => {
        expect(isForzatPaid('with')).toBe(true);
        expect(isForzatPaid('З друком')).toBe(true);
        expect(isForzatPaid('yes')).toBe(true);
    });

    it('відмова читається як відмова, у будь-якому написанні', () => {
        expect(isForzatPaid('none')).toBe(false);
        expect(isForzatPaid('Без друку')).toBe(false);
        expect(isForzatPaid('без друку')).toBe(false);
    });

    it('порожнеча — це не оплата', () => {
        expect(isForzatPaid('')).toBe(false);
        expect(isForzatPaid(null)).toBe(false);
        expect(isForzatPaid(undefined)).toBe(false);
    });
});

describe('які сторони оплачено', () => {
    it('TM-001352: обидві, названі прямо', () => {
        expect(paidForzatSides({ [FORZAT_OPTION]: 'Так (перший + останній)' }))
            .toEqual({ first: true, last: true });
    });

    it('названа одна сторона — оплачена одна', () => {
        expect(paidForzatSides({ [FORZAT_OPTION]: 'Так (перший)' })).toEqual({ first: true, last: false });
        expect(paidForzatSides({ [FORZAT_OPTION]: 'Так (останній)' })).toEqual({ first: false, last: true });
    });

    it('«З друком» без сторін — це фіксована доплата за обидва', () => {
        expect(paidForzatSides({ [FORZAT_OPTION]: 'З друком' })).toEqual({ first: true, last: true });
        expect(paidForzatSides({ [FORZAT_OPTION]: 'with' })).toEqual({ first: true, last: true });
    });

    it('без опції і без оплати сторін немає', () => {
        expect(paidForzatSides({ 'Сторінок': '8 сторінок' })).toEqual(NO_FORZAT);
        expect(paidForzatSides({ [FORZAT_OPTION]: 'Без друку' })).toEqual(NO_FORZAT);
        expect(paidForzatSides(null)).toEqual(NO_FORZAT);
        expect(paidForzatSides('щось не те')).toEqual(NO_FORZAT);
    });
});

describe('чого бракує в наборі', () => {
    const both = { first: true, last: true };

    it('TM-001352: оплачено обидва, є тільки f2', () => {
        const files = ['00_cover_front.jpg', '00_cover_back.jpg', '01.jpg', '08.jpg', 'f2.jpg'];
        expect(missingForzatFiles(both, files)).toEqual(['f1']);
    });

    it('TM-001349: оплачено обидва, немає жодного', () => {
        const files = ['cover.jpg', '01.jpg', '02.jpg', '20.jpg'];
        expect(missingForzatFiles(both, files)).toEqual(['f1', 'f2']);
    });

    it('повний набір не дає жодної скарги', () => {
        expect(missingForzatFiles(both, ['f1.jpg', 'f2.jpg', '01.jpg'])).toEqual([]);
    });

    it('неоплачений форзац не вимагають', () => {
        expect(missingForzatFiles(NO_FORZAT, ['01.jpg', '02.jpg'])).toEqual([]);
        expect(missingForzatFiles({ first: false, last: true }, ['f2.jpg'])).toEqual([]);
    });

    it('регістр імені файлу нічого не вирішує', () => {
        expect(missingForzatFiles(both, ['F1.JPG', 'F2.jpg'])).toEqual([]);
    });

    it('цифра в назві сторінки не вдає із себе форзац', () => {
        // «01.jpg» не має жодного стосунку до f1, і сплутати їх означало б
        // мовчати саме там, де форзаца немає.
        expect(missingForzatFiles(both, ['01.jpg', '02.jpg'])).toEqual(['f1', 'f2']);
    });
});

describe('речення для людини', () => {
    it('одна сторона названа своїм ім’ям', () => {
        expect(forzatShortfallLine(['f1'])).toContain('початковий');
        expect(forzatShortfallLine(['f2'])).toContain('кінцевий');
    });

    it('обидві читаються як обидві', () => {
        expect(forzatShortfallLine(['f1', 'f2'])).toContain('обох');
    });

    it('коли все на місці, казати нічого', () => {
        expect(forzatShortfallLine([])).toBe('');
    });
});
