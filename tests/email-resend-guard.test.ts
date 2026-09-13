import { describe, expect, it } from 'vitest';
import {
    RESEND_GUARD_WINDOW_MINUTES,
    isResendGuarded,
    resendGuardSince,
} from '@/lib/email/resend-guard';

/**
 * Захист від повторного надсилання транзакційного листа.
 *
 * Лист про отриману оплату йшов клієнтам двічі на 70 замовленнях із 71, бо у
 * вебхуку монобанку стояли два незалежні блоки відправки. Блок прибрано, але
 * відправників дії 'paid' лишається троє, тож правило живе окремо від них
 * усіх — і саме тому його треба тримати перевіреним.
 *
 * Найдорожча помилка тут — придушити 'placed'. Повторне надсилання посилання
 * на оплату є кнопкою в картці замовлення, якою менеджери користуються; якщо
 * вона тихо перестане працювати, ніхто не побачить помилки, а клієнт просто
 * не отримає посилання.
 */
describe('isResendGuarded', () => {
    it('leaves the payment link resendable, because that button exists on purpose', () => {
        expect(isResendGuarded('placed')).toBe(false);
    });

    it('guards the payment-received letter — the one that went out twice', () => {
        expect(isResendGuarded('paid')).toBe(true);
    });

    it('guards the shipping letter too', () => {
        expect(isResendGuarded('shipped')).toBe(true);
    });

    /** Зайвий пробіл у тілі запиту не має вмикати придушення кнопки. */
    it('ignores surrounding whitespace', () => {
        expect(isResendGuarded('  placed  ')).toBe(false);
    });

    /**
     * Дія приходить ззовні, тож невідоме значення краще придушити, ніж
     * надіслати двічі. Мовчазний дубль дорожчий за мовчазну паузу.
     */
    it('guards an unknown action rather than letting it through', () => {
        expect(isResendGuarded('something-new')).toBe(true);
    });

    it('guards a non-string action', () => {
        expect(isResendGuarded(undefined)).toBe(true);
        expect(isResendGuarded(null)).toBe(true);
        expect(isResendGuarded(42)).toBe(true);
    });

    /** Схожа назва — не та сама назва. */
    it('does not let a lookalike action ride on the exemption', () => {
        expect(isResendGuarded('placed_again')).toBe(true);
        expect(isResendGuarded('Placed')).toBe(true);
    });
});

describe('resendGuardSince', () => {
    it('looks exactly one window back from the given moment', () => {
        const now = new Date('2026-09-13T12:00:00.000Z');
        expect(resendGuardSince(now)).toBe('2026-09-13T11:00:00.000Z');
    });

    /**
     * Поріг винесено константою навмисно, щоб його міняли в одному місці.
     * Тест пильнує не саме число, а те, що межа рахується від нього.
     */
    it('derives the boundary from the constant, not from a hardcoded hour', () => {
        const now = new Date('2026-09-13T12:00:00.000Z');
        const expected = new Date(now.getTime() - RESEND_GUARD_WINDOW_MINUTES * 60_000).toISOString();
        expect(resendGuardSince(now)).toBe(expected);
    });

    it('is a window into the past, never into the future', () => {
        const now = new Date('2026-09-13T12:00:00.000Z');
        expect(new Date(resendGuardSince(now)).getTime()).toBeLessThan(now.getTime());
    });
});
