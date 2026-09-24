import { describe, expect, it } from 'vitest';
import { extendedExpiry } from '@/lib/photographers/gallery-term';

/**
 * Продовження терміну галереї ніколи не скорочує його (демо-галерея лендингу
 * втратила термін 2035 року саме так).
 */

const DAY = 86_400_000;
const NOW = new Date('2026-09-24T12:00:00.000Z');
const at = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

describe('extendedExpiry', () => {
    it('галерея з терміном через 200 днів + продовження = термін не змінився', () => {
        for (const d of [30, 60, 90]) expect(extendedExpiry(at(200), d, NOW)).toBeNull();
    });

    it('термін 2035 року лишається, а не падає до «сьогодні + 90»', () => {
        expect(extendedExpiry('2035-01-01T00:00:00.000Z', 30, NOW)).toBeNull();
    });

    it('звичайне продовження додає дні до поточного терміну', () => {
        expect(extendedExpiry(at(10), 30, NOW)).toBe(at(40));
    });

    it('стеля 90 днів від сьогодні і далі діє, коли термін коротший за неї', () => {
        expect(extendedExpiry(at(70), 60, NOW)).toBe(at(90));
    });

    it('термін уже рівно на стелі — без змін', () => {
        expect(extendedExpiry(at(90), 30, NOW)).toBeNull();
    });

    it('прострочена, але не очищена галерея продовжується від сьогодні', () => {
        expect(extendedExpiry(at(-2), 30, NOW)).toBe(at(30));
    });
});
