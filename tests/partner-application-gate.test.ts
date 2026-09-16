import { describe, it, expect } from 'vitest';
import { applicationGate, isRepeatApplication } from '@/lib/partners/application-gate';

describe('applicationGate', () => {
    it('пропускає першу заявку з незнайомої пошти', () => {
        const gate = applicationGate([], []);
        expect(gate.allow).toBe(true);
        expect(gate.repeat).toBe(false);
    });

    it('не створює другу заявку, поки партнер активний', () => {
        // Саме цей випадок стався 11.09.2026: партнер «Подорожуй!» працював із
        // 14.07, а форма мовчки склала другу заявку на ту саму пошту.
        const gate = applicationGate([{ status: 'active' }], [{ status: 'approved' }]);
        expect(gate.allow).toBe(false);
        expect(gate.code).toBe('active_partner');
        expect(gate.message).toContain('кабінет');
    });

    it('не створює другу заявку, поки перша на розгляді', () => {
        const gate = applicationGate([], [{ status: 'new' }]);
        expect(gate.allow).toBe(false);
        expect(gate.code).toBe('pending_request');
    });

    it('заявка в роботі («contacted») теж зупиняє другу', () => {
        expect(applicationGate([], [{ status: 'contacted' }]).allow).toBe(false);
    });

    it('НЕАКТИВНИЙ партнер може податися знову', () => {
        // Жорстке блокування по факту запису закрило б колишньому партнеру
        // єдину дорогу назад: форма казала б «ви вже наш партнер», а кабінет
        // при цьому не працював би.
        const gate = applicationGate([{ status: 'inactive' }], [{ status: 'approved' }]);
        expect(gate.allow).toBe(true);
        expect(gate.repeat).toBe(true);
    });

    it('після відмови або позначки «повторна» дорога знову відкрита', () => {
        expect(applicationGate([], [{ status: 'declined' }]).allow).toBe(true);
        expect(applicationGate([], [{ status: 'duplicate' }]).allow).toBe(true);
    });

    it('статус читається без огляду на регістр і пробіли', () => {
        expect(applicationGate([{ status: ' Active ' }], []).code).toBe('active_partner');
    });
});

describe('isRepeatApplication', () => {
    const req = { email: 'A@b.com', created_at: '2026-09-11T08:00:00Z' };

    it('бачить партнера на ту саму пошту попри регістр', () => {
        expect(isRepeatApplication(req, [{ email: 'a@B.com' }], [req])).toBe(true);
    });

    it('бачить старішу заявку', () => {
        const older = { email: 'a@b.com', created_at: '2026-07-14T12:00:00Z' };
        expect(isRepeatApplication(req, [], [req, older])).toBe(true);
    });

    it('НОВІША заявка не робить цю повторною', () => {
        const newer = { email: 'a@b.com', created_at: '2026-10-01T12:00:00Z' };
        expect(isRepeatApplication(req, [], [req, newer])).toBe(false);
    });

    it('чужа пошта не рахується', () => {
        expect(isRepeatApplication(req, [{ email: 'other@b.com' }], [req])).toBe(false);
    });

    it('заявка без пошти не повторна', () => {
        expect(isRepeatApplication({ email: '', created_at: req.created_at }, [{ email: 'a@b.com' }], [])).toBe(false);
    });
});
