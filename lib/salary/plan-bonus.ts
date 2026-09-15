/**
 * Бонус менеджера за виконання плану.
 *
 * Винесено з калькулятора окремо, бо це рішення про чужі гроші, і воно має
 * бути перевірюваним без походу в базу.
 *
 * До 15.09.2026 логіка була перевернута. Код звіряв обіг зі
 * `staff.manager_plan_target`, а цього стовпця в бойовій таблиці не було —
 * міграція `salary_qc` створила таблиці змін і помилок, але ALTER на `staff`
 * не доїхав. Порожнє значення через `|| 0` ставало планом «нуль», умова
 * «обіг не менший за план» — завжди істинною, і тисяча гривень нараховувалася
 * всім незалежно від результату, у тому числі за місяць із нульовим обігом.
 *
 * Правило тепер просте: **немає плану — немає бонусу**. План ставить Діана
 * руками, і поки він порожній, рядок у нарахуваннях чесно каже, чому нуль.
 */

/** Скільки коштує виконаний план, грн. */
export const PLAN_BONUS_UAH = 1000;

export type PlanBonusStatus = 'no_plan' | 'missed' | 'ok';

export interface PlanBonus {
    /** Сума до нарахування, грн. */
    value: number;
    status: PlanBonusStatus;
    /** План, із яким звіряли. Порожньо, коли його не задано. */
    target: number | null;
    /** Пояснення для рядка в деталізації. Порожньо, коли пояснювати нічого. */
    note?: string;
}

/**
 * `target` — значення `staff.manager_plan_target`: число, рядок із бази або
 * порожнеча. Порожнеча, нуль і будь-що нечислове означають «плану немає».
 */
export function resolvePlanBonus(turnover: number, target: unknown): PlanBonus {
    const planned = Number(target);
    const hasPlan = Number.isFinite(planned) && planned > 0;

    if (!hasPlan) {
        return {
            value: 0,
            status: 'no_plan',
            target: null,
            note: 'План не заданий, тож бонус не нараховується',
        };
    }

    const reached = Number(turnover) >= planned;
    return {
        value: reached ? PLAN_BONUS_UAH : 0,
        status: reached ? 'ok' : 'missed',
        target: planned,
        note: reached
            ? undefined
            : `Обіг ${Math.round(Number(turnover) || 0).toLocaleString('uk-UA')} ₴ проти плану ${Math.round(planned).toLocaleString('uk-UA')} ₴`,
    };
}
