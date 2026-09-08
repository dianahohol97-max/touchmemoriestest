import { describe, expect, it } from 'vitest';
import { KALKA_PAGE_RESERVE, getKalkaIndices, kalkaTopUpCount } from '@/lib/editor/utils';

/**
 * Калька і сторінки, які вона з'їдає.
 *
 * Ціна помилки тут — оплачені сторінки. TM-001262 замовив 50 сторінок з
 * калькою, а в друк пішло 48: перший розворот забрали форзац і калька, а двох
 * компенсаційних сторінок у кінці не було. Клієнт заплатив за 50.
 */
describe('getKalkaIndices', () => {
    it('puts the blank forzats left and the kalka right of the first spread', () => {
        const idx = getKalkaIndices(true, 53);
        expect(idx.kalkaForzatsIdx).toBe(1);
        expect(idx.kalkaPageIdx).toBe(2);
    });

    it('marks nothing at all when there is no kalka', () => {
        const idx = getKalkaIndices(false, 53);
        expect(idx.kalkaForzatsIdx).toBe(-1);
        expect(idx.kalkaPageIdx).toBe(-1);
        expect(idx.kalkaEndPageIdxStart).toBe(-1);
    });

    it('reserves the last two pages as well', () => {
        expect(getKalkaIndices(true, 53).kalkaEndPageIdxStart).toBe(51);
    });
});

describe('kalkaTopUpCount', () => {
    /** Саме форма TM-001262: калька увімкнена вже після побудови чернетки. */
    it('asks for the two pages a pre-kalka draft is missing', () => {
        expect(kalkaTopUpCount(50, 50, true)).toBe(KALKA_PAGE_RESERVE);
    });

    it('asks for nothing when the draft already carries the reserve', () => {
        expect(kalkaTopUpCount(52, 50, true)).toBe(0);
    });

    it('asks for nothing at all without kalka', () => {
        expect(kalkaTopUpCount(50, 50, false)).toBe(0);
    });

    it('tops up only partially when the draft is short by one', () => {
        expect(kalkaTopUpCount(51, 50, true)).toBe(1);
    });

    /**
     * Чернетка, коротша більш ніж на резерв кальки, — це інша конфігурація.
     * Дописувати їй дві сторінки означало б замаскувати справжню розбіжність,
     * тому більше за резерв не додаємо ніколи.
     */
    it('never adds more than the kalka reserve, however short the draft is', () => {
        expect(kalkaTopUpCount(10, 50, true)).toBe(KALKA_PAGE_RESERVE);
    });

    it('never takes pages away from a draft the customer extended', () => {
        expect(kalkaTopUpCount(60, 50, true)).toBe(0);
    });

    it('stays at zero on broken numbers instead of guessing', () => {
        expect(kalkaTopUpCount(NaN, 50, true)).toBe(0);
        expect(kalkaTopUpCount(50, NaN, true)).toBe(0);
    });
});
