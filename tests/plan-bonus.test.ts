import { describe, expect, it } from 'vitest';
import { PLAN_BONUS_UAH, resolvePlanBonus } from '@/lib/salary/plan-bonus';

/**
 * Бонус менеджера за план.
 *
 * Тест існує через 15.09.2026: стовпця `manager_plan_target` у бойовій базі не
 * було, порожнє значення через `|| 0` ставало планом «нуль», і тисяча гривень
 * нараховувалася всім п'ятьом менеджерам щомісяця, у тому числі за місяць із
 * нульовим обігом. Помилка коштувала грошей і не показувала себе нічим.
 */

describe('resolvePlanBonus', () => {
    it('без плану бонусу не дає', () => {
        for (const empty of [null, undefined, '', 0, '0', 'абищо', NaN]) {
            const bonus = resolvePlanBonus(500000, empty);
            expect(bonus.value).toBe(0);
            expect(bonus.status).toBe('no_plan');
            expect(bonus.target).toBeNull();
        }
    });

    it('пояснює, чому нуль, коли плану немає', () => {
        // Рядок видно в деталізації нарахувань, інакше нуль виглядав би збоєм.
        expect(resolvePlanBonus(0, null).note).toContain('не заданий');
    });

    it('нараховує, коли обіг дотягнув до плану', () => {
        expect(resolvePlanBonus(157604, 150000).value).toBe(PLAN_BONUS_UAH);
        expect(resolvePlanBonus(157604, 150000).status).toBe('ok');
        // Рівність теж виконання.
        expect(resolvePlanBonus(150000, 150000).value).toBe(PLAN_BONUS_UAH);
    });

    it('не нараховує, коли обігу забракло, і називає обидва числа', () => {
        const bonus = resolvePlanBonus(67960, 150000);
        expect(bonus.value).toBe(0);
        expect(bonus.status).toBe('missed');
        expect(bonus.target).toBe(150000);
        expect(bonus.note).toContain('150');
    });

    it('читає план, який база віддала рядком', () => {
        // NUMERIC приходить із PostgREST рядком, і порівняння без Number()
        // тут мовчки порівнювало б рядки.
        expect(resolvePlanBonus(200000, '150000.00').value).toBe(PLAN_BONUS_UAH);
        expect(resolvePlanBonus(100000, '150000.00').value).toBe(0);
    });
});
