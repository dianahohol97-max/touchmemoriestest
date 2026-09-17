import { describe, expect, it } from 'vitest';
import { pluralUk, numberWordUk } from '@/lib/text/plural-uk';

/**
 * Форма множини жила приватною копією в lib/orders/attention.ts. Друга копія в
 * листі клієнтові означала б дві однакові функції, які колись розійдуться, а
 * розходження тут читається як безграмотність: «2 найважчих файлів не
 * пройшли» замість «два найважчі файли не пройшли».
 */
describe('pluralUk', () => {
    const f = (n: number) => pluralUk(n, 'знімок', 'знімки', 'знімків');

    it('одна форма для 1, 21, 101', () => {
        for (const n of [1, 21, 31, 101, 1001]) expect(f(n)).toBe('знімок');
    });

    it('друга форма для 2–4 і їхніх десятків', () => {
        for (const n of [2, 3, 4, 22, 23, 24, 102]) expect(f(n)).toBe('знімки');
    });

    it('третя форма для 5–20 і для підступних 11–14', () => {
        for (const n of [0, 5, 9, 11, 12, 13, 14, 15, 20, 111, 112]) expect(f(n)).toBe('знімків');
    });

    it('сміття на вході не валить текст', () => {
        expect(f(NaN as number)).toBe('знімків');
        expect(f(-2)).toBe('знімки');
        expect(f(2.7)).toBe('знімки');
    });
});

describe('numberWordUk', () => {
    it('малі числа словом, великі цифрою', () => {
        expect(numberWordUk(1)).toBe('один');
        expect(numberWordUk(2)).toBe('два');
        expect(numberWordUk(19)).toBe('девʼятнадцять');
        expect(numberWordUk(20)).toBe('двадцять');
        expect(numberWordUk(21)).toBe('21');
        expect(numberWordUk(0)).toBe('0');
    });

    it('жіночий рід для одного і двох', () => {
        expect(numberWordUk(1, 'f')).toBe('одна');
        expect(numberWordUk(2, 'f')).toBe('дві');
        expect(numberWordUk(3, 'f')).toBe('три');
    });
});
