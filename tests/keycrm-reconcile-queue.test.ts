import { describe, expect, it } from 'vitest';
import { ACTIVE_BEYOND_WINDOW } from '@/lib/automation/keycrm-twoway';

/**
 * Черга звірки з KeyCRM.
 *
 * Дефект, через який це зʼявилося: батч на 25 замовлень набирався за датою
 * створення від найновішого, тож ті самі 25 карток перечитувалися кожні пів
 * години, а двадцять шоста й старші — ніколи. 14.09.2026 зі 131 замовлення з
 * сайту 81 мало знімок старший за тиждень, 16 — старший за місяць, а 33
 * усиновлені картки не звіряли жодного разу.
 *
 * Саму чергу перевірити тестом не можна — це запит до бази з сортуванням за
 * crm_reconciled_at. Тут закріплено те, що логікою таки є: які стани
 * замовлення звіряються попри вік, бо ця межа відділяє «живу роботу» від
 * «мертвих карток», заради яких вікно й існує.
 */

describe('виняток за станом для замовлень, старших за вікно', () => {
    it('усе, що ще в роботі або в дорозі, звіряється попри вік', () => {
        for (const status of ['new', 'confirmed', 'in_production', 'quality_check', 'ready', 'shipped']) {
            expect(ACTIVE_BEYOND_WINDOW).toContain(status);
        }
    });

    it('закінчені стани у винятку не беруть участі', () => {
        // Інакше виняток перетворився б на скасоване вікно: доставлені й
        // скасовані картки — це сотні мертвих запитів до CRM щодня.
        for (const status of ['delivered', 'completed', 'cancelled', 'refunded']) {
            expect(ACTIVE_BEYOND_WINDOW).not.toContain(status);
        }
    });

    it('список не порожній і без повторів', () => {
        expect(ACTIVE_BEYOND_WINDOW.length).toBeGreaterThan(0);
        expect(new Set(ACTIVE_BEYOND_WINDOW).size).toBe(ACTIVE_BEYOND_WINDOW.length);
    });

    it('усі значення — відомі статуси сайту', () => {
        const known = ['new', 'confirmed', 'in_production', 'quality_check', 'ready', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
        for (const status of ACTIVE_BEYOND_WINDOW) expect(known).toContain(status);
    });
});
