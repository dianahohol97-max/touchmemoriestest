import { describe, expect, it } from 'vitest';
import { readSendOutcome, failedOutcome, sendOutcomeFromError, htmlToTextSnapshot, readActor } from '@/lib/email/log-outgoing';

/**
 * Журнал вихідних листів: розбір відповіді провайдера.
 *
 * Тест існує тому, що саме тут ховалася проблема. У репо ДВІ транспортні
 * обгортки з різними формами результату, кожен виклик розбирав їх по-своєму, і
 * через це в email_logs не було жодного provider_message_id на 255 рядків, а
 * лист «замовлення прийнято» при відмові не лишав узагалі нічого.
 *
 * Найважливіший випадок нижче — той, де порожня або незрозуміла відповідь
 * рахується ВІДМОВОЮ. Помилка в цей бік дає рівно те, від чого лікуємо: тихе
 * «успішно» без відповіді провайдера.
 */
describe('readSendOutcome', () => {
    it('sendEmail: успіх віддає messageId від Brevo', () => {
        const o = readSendOutcome({ success: true, data: { messageId: '<202609.13@smtp-relay.brevo.com>' } });
        expect(o.sent).toBe(true);
        expect(o.providerMessageId).toBe('<202609.13@smtp-relay.brevo.com>');
        expect(o.error).toBeNull();
    });

    it('sendBrevoEmail напряму: сира відповідь { messageId } — це успіх', () => {
        // Третя форма, яка зʼявилася разом з автоматичними розсилками: вони
        // кличуть Brevo без обгортки. Раніше така відповідь розбиралася як
        // «незрозуміла» і успішний лист лягав у журнал помилкою.
        const o = readSendOutcome({ messageId: '<202609.16@smtp-relay.brevo.com>' });
        expect(o.sent).toBe(true);
        expect(o.providerMessageId).toBe('<202609.16@smtp-relay.brevo.com>');
        expect(o.error).toBeNull();
    });

    it('обʼєкт без жодного ідентифікатора лишається відмовою', () => {
        const o = readSendOutcome({ whatever: 1 });
        expect(o.sent).toBe(false);
        expect(o.failureKind).toBe('provider');
    });

    it('sendEmail: відмова віддає причину, а не «send failed»', () => {
        const o = readSendOutcome({ success: false, error: { message: 'Invalid sender' } });
        expect(o.sent).toBe(false);
        expect(o.error).toBe('Invalid sender');
    });

    it('sendEmail: причина рядком теж проходить як є', () => {
        expect(readSendOutcome({ success: false, error: 'Email provider not configured' }).error)
            .toBe('Email provider not configured');
    });

    it('resend-обгортка: успіх це error === null', () => {
        const o = readSendOutcome({ data: { messageId: 'abc' }, error: null });
        expect(o.sent).toBe(true);
        expect(o.providerMessageId).toBe('abc');
    });

    it('resend-обгортка: відмова', () => {
        const o = readSendOutcome({ data: null, error: new Error('Brevo error 400') });
        expect(o.sent).toBe(false);
        expect(o.error).toBe('Brevo error 400');
    });

    it('успіх без messageId лишається успіхом', () => {
        const o = readSendOutcome({ success: true, data: {} });
        expect(o.sent).toBe(true);
        expect(o.providerMessageId).toBeNull();
    });

    it('порожня відповідь — це ВІДМОВА, а не успіх', () => {
        // Саме так виглядає обірваний виклик, і саме його приймали за
        // «надіслано».
        expect(readSendOutcome(null).sent).toBe(false);
        expect(readSendOutcome(undefined).sent).toBe(false);
        expect(readSendOutcome({}).sent).toBe(false);
    });

    it('failedOutcome описує відмову ще до звернення до провайдера', () => {
        const o = failedOutcome('У клієнта не вказано email');
        expect(o.sent).toBe(false);
        expect(o.error).toBe('У клієнта не вказано email');
        expect(o.providerMessageId).toBeNull();
    });
});

describe('htmlToTextSnapshot', () => {
    it('лишає текст, який побачив клієнт, без розмітки', () => {
        const html = '<div><p>Добрий день!</p><p>Ваше замовлення <b>TM-001203</b> прийнято.</p></div>';
        const text = htmlToTextSnapshot(html);
        expect(text).toContain('Добрий день!');
        expect(text).toContain('TM-001203');
        expect(text).not.toContain('<');
    });

    it('розбиває абзаци переносами, а не зліплює в рядок', () => {
        expect(htmlToTextSnapshot('<p>Перший</p><p>Другий</p>')).toBe('Перший\nДругий');
    });

    it('прибирає style і script цілком', () => {
        const text = htmlToTextSnapshot('<style>.a{color:red}</style><p>Текст</p>');
        expect(text).toBe('Текст');
    });

    it('повертає сутності назад у символи', () => {
        expect(htmlToTextSnapshot('<p>Ціна &lt; 500 &amp; знижка</p>')).toBe('Ціна < 500 & знижка');
    });

    it('довгий лист обрізається з трикрапкою', () => {
        const long = htmlToTextSnapshot(`<p>${'а'.repeat(5000)}</p>`);
        expect(long.length).toBeLessThanOrEqual(4001);
        expect(long.endsWith('…')).toBe(true);
    });

    it('порожній вхід не ламає нічого', () => {
        expect(htmlToTextSnapshot('')).toBe('');
        expect(htmlToTextSnapshot(undefined as any)).toBe('');
    });
});

describe('readActor', () => {
    it('приймає коректного автора', () => {
        const a = readActor({ id: '3f1d2c4e-9a7b-4c2d-8e1f-5a6b7c8d9e0f', name: 'Катерина' });
        expect(a).toEqual({ id: '3f1d2c4e-9a7b-4c2d-8e1f-5a6b7c8d9e0f', name: 'Катерина' });
    });

    it('відкидає id, який не uuid, але лишає імʼя', () => {
        // Порожній id означає «звʼязку зі staff немає», і це нормальний стан:
        // журнал усе одно збереже, хто це був.
        expect(readActor({ id: 'не-uuid', name: 'Вероніка' })).toEqual({ id: null, name: 'Вероніка' });
    });

    it('обрізає задовге імʼя', () => {
        const a = readActor({ id: null, name: 'я'.repeat(500) });
        expect(a?.name?.length).toBe(200);
    });

    it('сміття й порожнеча дають відсутнього автора', () => {
        expect(readActor(null)).toBeNull();
        expect(readActor('Катерина')).toBeNull();
        expect(readActor({})).toBeNull();
        expect(readActor({ id: 123, name: {} })).toBeNull();
    });
});

describe('sendOutcomeFromError', () => {
    it('вичерпаний власний ліміт розпізнається як quota', () => {
        const e: any = new Error('Денний ліміт вичерпано');
        e.code = 'EMAIL_QUOTA_EXCEEDED';
        const o = sendOutcomeFromError(e);
        expect(o.sent).toBe(false);
        expect(o.failureKind).toBe('quota');
    });

    it('402 від Brevo — теж quota', () => {
        const e: any = new Error('Not enough credits');
        e.status = 402;
        expect(sendOutcomeFromError(e).failureKind).toBe('quota');
    });

    it('решта відмов лишаються provider і зберігають причину', () => {
        const o = sendOutcomeFromError(new Error('Invalid sender'));
        expect(o.failureKind).toBe('provider');
        expect(o.error).toBe('Invalid sender');
        expect(o.providerMessageId).toBeNull();
    });
});
