import { describe, expect, it } from 'vitest';
import { STUCK_THRESHOLDS, stuckLabel, stuckParcels } from '@/lib/shipping/stuck-parcels';

/**
 * Застряглі посилки.
 *
 * До 15.09.2026 сайт про посилки не знав нічого: крон відстеження падав, і в
 * 837 замовлень із накладною не було статусу. Щойно статуси з'явилися, стало
 * видно сімнадцять видалених накладних і три відмови від одержання, які роками
 * ніхто не бачив. Тести пінять саме межі: що вважаємо проблемою одразу, що —
 * лише після порога, і що робимо, коли вік статусу ще невідомий.
 */
const day = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-15T09:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * day).toISOString();

const row = (over: Partial<any> = {}) => ({
    id: 'id-1',
    order_number: 'CRM-13593',
    customer_name: 'Ірина',
    ttn: '20451501599844',
    tracking_status: 'Вилучено',
    tracking_status_at: ago(1),
    created_at: ago(40),
    order_status: 'confirmed',
    ...over,
});

describe('stuckParcels', () => {
    it('видалена накладна — проблема з першого дня', () => {
        const r = stuckParcels([row({ tracking_status_at: ago(0) })], NOW);
        expect(r.problem).toHaveLength(1);
        expect(r.atBranch).toEqual([]);
    });

    it('відмова від одержання теж, і в обох формулюваннях', () => {
        expect(stuckParcels([row({ tracking_status: 'Відмова від одержання' })], NOW).problem).toHaveLength(1);
        expect(stuckParcels([row({ tracking_status: 'Відмова від одержання (повернення)' })], NOW).problem).toHaveLength(1);
    });

    it('на відділенні рахується від порога, а не від дати замовлення', () => {
        const justArrived = row({ tracking_status: 'Прибув на відділення', tracking_status_at: ago(1), created_at: ago(74) });
        expect(stuckParcels([justArrived], NOW).atBranch).toEqual([]);

        const waiting = row({ tracking_status: 'Прибув на відділення', tracking_status_at: ago(STUCK_THRESHOLDS.atBranchDays) });
        expect(stuckParcels([waiting], NOW).atBranch).toHaveLength(1);
    });

    it('накладна без руху потрапляє у зведення лише через тиждень', () => {
        const fresh = row({ tracking_status: 'Нове', tracking_status_at: ago(6) });
        expect(stuckParcels([fresh], NOW).notHandedOver).toEqual([]);

        const forgotten = row({ tracking_status: 'Нове', tracking_status_at: ago(STUCK_THRESHOLDS.waybillNewDays) });
        expect(stuckParcels([forgotten], NOW).notHandedOver).toHaveLength(1);
    });

    it('без часу зміни статусу вікові кошики мовчать, а проблемні — ні', () => {
        // Перший день після впровадження: краще недорахувати, ніж назвати вік
        // замовлення віком посилки.
        expect(stuckParcels([row({ tracking_status: 'Прибув на відділення', tracking_status_at: null })], NOW).atBranch).toEqual([]);
        expect(stuckParcels([row({ tracking_status: 'Нове', tracking_status_at: null })], NOW).notHandedOver).toEqual([]);
        expect(stuckParcels([row({ tracking_status_at: null })], NOW).problem).toHaveLength(1);
    });

    it('закриті замовлення й позиції без накладної не беруться', () => {
        expect(stuckParcels([row({ order_status: 'delivered' })], NOW).problem).toEqual([]);
        expect(stuckParcels([row({ order_status: 'cancelled' })], NOW).problem).toEqual([]);
        expect(stuckParcels([row({ ttn: null })], NOW).problem).toEqual([]);
        expect(stuckParcels([row({ tracking_status: null })], NOW).problem).toEqual([]);
    });

    it('вручені посилки застряглими не вважаються', () => {
        expect(stuckParcels([row({ tracking_status: 'Вручено', tracking_status_at: ago(30) })], NOW))
            .toEqual({ problem: [], atBranch: [], notHandedOver: [] });
    });

    it('найдовші стоять першими', () => {
        const r = stuckParcels([
            row({ id: 'a', tracking_status: 'Нове', tracking_status_at: ago(8) }),
            row({ id: 'b', tracking_status: 'Нове', tracking_status_at: ago(40) }),
        ], NOW);
        expect(r.notHandedOver.map(p => p.row.id)).toEqual(['b', 'a']);
    });
});

describe('stuckLabel', () => {
    it('називає статус, вік і накладну', () => {
        const [p] = stuckParcels([row({ tracking_status_at: ago(5) })], NOW).problem;
        expect(stuckLabel(p)).toBe('Вилучено, 5 дн., ТТН 20451501599844');
    });

    it('без часу зміни статусу вік не вигадує', () => {
        const [p] = stuckParcels([row({ tracking_status_at: null })], NOW).problem;
        expect(stuckLabel(p)).toBe('Вилучено, ТТН 20451501599844');
    });
});
