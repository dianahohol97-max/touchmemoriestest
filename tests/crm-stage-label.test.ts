import { describe, expect, it, vi } from 'vitest';
import { CRM_STAGE_UA, SITE_STATUS_UA, crmStageLabel, stageOrStatus } from '@/lib/automation/crm-stage';

/**
 * Етап KeyCRM у людському вигляді.
 *
 * Тест написаний за живою скаргою 14.09.2026: 597 карток із 1011 показували
 * менеджерові англійський ключ замість назви — `completed`, `in_transit`,
 * `waiting_for_prepayment`. Причина не в нас: KeyCRM віддає свої вбудовані
 * статуси під внутрішніми ключами, а власні стадії команди — під їхніми
 * українськими назвами, і обидві мови приходять з однієї мапи.
 *
 * Головне, що тут закріплено: переклад НЕ ковтає нічого. Українська назва
 * проходить недоторканою, невідомий ключ лишається на видноті, а відсутність
 * етапу не перетворюється на етап.
 */

describe('людські назви проходять як є', () => {
    it('власні стадії команди не чіпаються', () => {
        for (const stage of ['Передано на друк', 'Прийнято', 'Очікування відповіді від клієнта', 'Передано Томі для друку']) {
            expect(crmStageLabel(stage, 'підтверджене')).toBe(stage);
        }
    });

    it('назва з великої літери і пробілами не читається як ключ', () => {
        expect(crmStageLabel('Готово до друку')).toBe('Готово до друку');
    });
});

describe('вбудовані ключі KeyCRM перекладаються', () => {
    it.each(Object.entries(CRM_STAGE_UA))('%s → %s', (key, expected) => {
        expect(crmStageLabel(key, 'підтверджене')).toBe(expected);
    });

    it('у словнику рівно ті пʼять ключів, які ми бачили в даних', () => {
        expect(Object.keys(CRM_STAGE_UA).sort()).toEqual([
            'canceled', 'completed', 'delivered_to_delivery', 'in_transit', 'waiting_for_prepayment',
        ]);
    });
});

describe('невідомий ключ', () => {
    it('показується як статус сайту, а сам ключ лишається в дужках', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(crmStageLabel('returned', 'підтверджене')).toBe('підтверджене (CRM: returned)');
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('без статусу сайту віддається сам ключ, а не порожнеча', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(crmStageLabel('partially_returned')).toBe('partially_returned');
        warn.mockRestore();
    });
});

describe('відсутній етап — це не етап', () => {
    it('порожнє значення дає null, а не статус сайту', () => {
        // 96 замовлень із 1107 до CRM не доїхали. Рядок «Етап у KeyCRM:
        // підтверджене» для них був би вигадкою — саме тому тут null.
        expect(crmStageLabel(null, 'підтверджене')).toBeNull();
        expect(crmStageLabel('', 'підтверджене')).toBeNull();
        expect(crmStageLabel('   ', 'підтверджене')).toBeNull();
    });

    it('у списках замість порожнього етапу показується статус сайту', () => {
        expect(stageOrStatus(null, 'підтверджене')).toBe('підтверджене');
        expect(stageOrStatus('completed', 'підтверджене')).toBe('Виконано');
        expect(stageOrStatus('Прийнято', 'підтверджене')).toBe('Прийнято');
    });
});

describe('словник статусів сайту', () => {
    it('лишився з маленької літери — видимий текст у чаті не змінюється', () => {
        expect(SITE_STATUS_UA.confirmed).toBe('підтверджене');
        expect(SITE_STATUS_UA.cancelled).toBe('скасоване');
    });
});

describe('TM-001314 — картка, на якій це знайшли', () => {
    it('етап waiting_for_prepayment більше не показується ключем', () => {
        expect(crmStageLabel('waiting_for_prepayment', SITE_STATUS_UA.confirmed)).toBe('Очікує передоплати');
    });
});
