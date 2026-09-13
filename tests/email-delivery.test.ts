import { describe, expect, it } from 'vitest';
import {
    normaliseMessageId,
    readEventTime,
    parseDeliveryEvent,
    shouldApplyEvent,
    describeMailRow,
} from '@/lib/email/delivery-events';

/**
 * Статуси доставки від Brevo.
 *
 * Два місця тут ламаються тихо, і саме на них тест і тримається.
 *
 * Перше — ідентифікатор листа. API відправки віддає messageId, вебхук присилає
 * message-id, і різниця в кутових дужках чи регістрі не дає жодної помилки:
 * події приходять, жоден рядок не оновлюється, і виглядає це як «вебхук не
 * працює».
 *
 * Друге — порядок подій. Brevo не гарантує послідовності, тож deferred може
 * доїхати після delivered, а повтор на таймаут прилітає з тим самим ts через
 * хвилини. Свіжість рахується за часом ПОДІЇ, не за часом отримання.
 */
describe('normaliseMessageId', () => {
    it('зводить кутові дужки й регістр до одного вигляду', () => {
        const fromApi = normaliseMessageId('<202609131234.ABCDEF@smtp-relay.brevo.com>');
        const fromWebhook = normaliseMessageId('202609131234.abcdef@smtp-relay.brevo.com');
        expect(fromApi).toBe(fromWebhook);
    });

    it('обрізає пробіли', () => {
        expect(normaliseMessageId('  <abc@brevo>  ')).toBe('abc@brevo');
    });

    it('порожнеча і не-рядок дають null', () => {
        expect(normaliseMessageId('')).toBeNull();
        expect(normaliseMessageId('   ')).toBeNull();
        expect(normaliseMessageId(null)).toBeNull();
        expect(normaliseMessageId(12345)).toBeNull();
    });
});

describe('readEventTime', () => {
    it('секунди розпізнаються як секунди', () => {
        // 1789300000 — це 2026 рік у секундах. Якби число прочитали як
        // мілісекунди, вийшов би 1970-й.
        expect(readEventTime({ ts: 1789300000 })?.getUTCFullYear()).toBe(2026);
    });

    it('мілісекунди теж розпізнаються', () => {
        expect(readEventTime({ ts: 1789300000000 })?.getUTCFullYear()).toBe(2026);
    });

    it('ts_event головніший за ts', () => {
        const d = readEventTime({ ts_event: 1789300000, ts: 1600000000 });
        expect(d?.getUTCFullYear()).toBe(2026);
    });

    it('текстова дата як запасний варіант', () => {
        expect(readEventTime({ date: '2026-09-13 12:00:00' })).toBeInstanceOf(Date);
    });

    it('без часу — null, а не «зараз»', () => {
        expect(readEventTime({})).toBeNull();
        expect(readEventTime({ ts: 'хтозна' })).toBeNull();
    });
});

describe('parseDeliveryEvent', () => {
    it('delivered розбирається з message-id через дефіс', () => {
        const p = parseDeliveryEvent({ event: 'delivered', 'message-id': '<a@b>', ts: 1789300000 });
        expect(p.kind).toBe('delivery');
        if (p.kind !== 'delivery') return;
        expect(p.event.status).toBe('delivered');
        expect(p.event.messageId).toBe('a@b');
    });

    it('приймає і camelCase messageId — назви полів звірити з коду було нічим', () => {
        const p = parseDeliveryEvent({ event: 'hard_bounce', messageId: 'a@b', ts: 1 });
        expect(p.kind).toBe('delivery');
        if (p.kind !== 'delivery') return;
        expect(p.event.status).toBe('hard_bounce');
    });

    it('reason потрапляє в detail', () => {
        const p = parseDeliveryEvent({ event: 'blocked', 'message-id': 'a@b', reason: 'unsubscribed via Brevo' });
        if (p.kind !== 'delivery') throw new Error('очікували delivery');
        expect(p.event.detail).toBe('unsubscribed via Brevo');
    });

    it('spam і complaint дають один статус', () => {
        const a = parseDeliveryEvent({ event: 'spam', 'message-id': 'a@b' });
        const b = parseDeliveryEvent({ event: 'complaint', 'message-id': 'a@b' });
        if (a.kind !== 'delivery' || b.kind !== 'delivery') throw new Error('очікували delivery');
        expect(a.event.status).toBe('spam');
        expect(b.event.status).toBe('spam');
    });

    it('відкриття та кліки свідомо пропускаються', () => {
        expect(parseDeliveryEvent({ event: 'opened', 'message-id': 'a@b' }).kind).toBe('ignored');
        expect(parseDeliveryEvent({ event: 'click', 'message-id': 'a@b' }).kind).toBe('ignored');
        expect(parseDeliveryEvent({ event: 'request', 'message-id': 'a@b' }).kind).toBe('ignored');
    });

    it('невідома подія позначається невідомою, а не ламає розбір', () => {
        // Вебхук на такому віддає 2xx і пише в лог: це сигнал, що Brevo додав
        // щось нове, а не привід упасти.
        expect(parseDeliveryEvent({ event: 'teleported', 'message-id': 'a@b' }).kind).toBe('unknown');
    });

    it('подія без message-id непридатна', () => {
        expect(parseDeliveryEvent({ event: 'delivered' }).kind).toBe('unusable');
    });

    it('сміття замість події не кидає виняток', () => {
        expect(parseDeliveryEvent(null).kind).toBe('unusable');
        expect(parseDeliveryEvent('delivered').kind).toBe('unusable');
        expect(parseDeliveryEvent({}).kind).toBe('unusable');
    });
});

describe('shouldApplyEvent', () => {
    const t = (iso: string) => new Date(iso);

    it('перша подія застосовується завжди', () => {
        expect(shouldApplyEvent(t('2026-09-13T10:00:00Z'), null)).toBe(true);
    });

    it('свіжіша подія перезаписує', () => {
        expect(shouldApplyEvent(t('2026-09-13T11:00:00Z'), '2026-09-13T10:00:00Z')).toBe(true);
    });

    it('подія, що СТАЛАСЯ раніше, не затирає свіжішу — навіть прийшовши пізніше', () => {
        // Рівно той випадок: deferred доїхав після delivered.
        expect(shouldApplyEvent(t('2026-09-13T09:00:00Z'), '2026-09-13T10:00:00Z')).toBe(false);
    });

    it('повтор на таймаут із тим самим ts переписує ті самі значення', () => {
        // Ідемпотентність: нічого не змінюється, нових рядків не зʼявляється.
        expect(shouldApplyEvent(t('2026-09-13T10:00:00Z'), '2026-09-13T10:00:00Z')).toBe(true);
    });

    it('подія без часу не чіпає вже датований статус', () => {
        expect(shouldApplyEvent(null, '2026-09-13T10:00:00Z')).toBe(false);
        expect(shouldApplyEvent(null, null)).toBe(true);
    });
});

describe('describeMailRow', () => {
    it('без події це «Надіслано», а не «не дійшов»', () => {
        const r = describeMailRow({ status: 'sent' });
        expect(r.label).toBe('Надіслано');
        expect(r.tone).toBe('neutral');
    });

    it('delivered це «Доставлено» зеленим', () => {
        const r = describeMailRow({ status: 'sent', delivery_status: 'delivered' });
        expect(r.label).toBe('Доставлено');
        expect(r.tone).toBe('good');
    });

    it('hard_bounce малюється помітно і каже, що клієнт листа не бачив', () => {
        const r = describeMailRow({ status: 'sent', delivery_status: 'hard_bounce', delivery_detail: 'mailbox not found' });
        expect(r.tone).toBe('bad');
        expect(r.label).toContain('НЕ ДІЙШОВ');
        expect(r.label).toContain('mailbox not found');
    });

    it('спам це попередження, а не поразка', () => {
        expect(describeMailRow({ status: 'sent', delivery_status: 'spam' }).tone).toBe('warn');
    });

    it('deferred і soft_bounce — «затримується»', () => {
        expect(describeMailRow({ status: 'sent', delivery_status: 'deferred' }).label).toContain('Затримується');
        expect(describeMailRow({ status: 'sent', delivery_status: 'soft_bounce' }).tone).toBe('warn');
    });

    it('наша поразка каже «НЕ НАДІСЛАНО», а не «не доставлено»', () => {
        // Стара картка писала «НЕ ДОСТАВЛЕНО» на status='failed', хоча failed
        // означає, що лист навіть не пішов. Це різні поломки з різними
        // винуватцями.
        const r = describeMailRow({ status: 'failed', error: 'Invalid sender' });
        expect(r.label).toContain('НЕ НАДІСЛАНО');
        expect(r.label).toContain('Invalid sender');
    });

    it('вичерпана квота — окрема причина, не загальна помилка', () => {
        const r = describeMailRow({ status: 'failed', failure_kind: 'quota', error: 'Денний ліміт вичерпано' });
        expect(r.label).toContain('вичерпано денний ліміт');
        expect(r.tone).toBe('bad');
    });
});
