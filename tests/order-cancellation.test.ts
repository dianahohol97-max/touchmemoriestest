import { describe, expect, it } from 'vitest';
import {
    CANCELLATION_ACTION,
    CANCELLATION_REASONS,
    NOTE_MAX_LENGTH,
    NOT_PROVIDED,
    buildCancellationHistoryRow,
    cancellationAuthorLabel,
    cancellationLabel,
    isSelectableReason,
    readCancellation,
    validateCancellation,
} from '@/lib/orders/cancellation';

/**
 * Причина скасування.
 *
 * Тест тримає три речі, на яких це може тихо розʼїхатися. Перша — обовʼязковість:
 * щойно невідомий код почне мовчки ставати «іншою причиною», поле перестане
 * бути обовʼязковим, і ніхто цього не помітить. Друга — спільний формат: рядок
 * історії пишуть три різні місця, і картка знаходить причину лише тому, що
 * формат один. Третя — чесність порожнього: скасоване до цієї зміни замовлення
 * мусить казати «причину не записано», а не показувати вигадану.
 */

describe('словник причин', () => {
    it('сім причин для людини, не більше і не менше', () => {
        expect(CANCELLATION_REASONS).toHaveLength(7);
    });

    it('«клієнт не відповідає» є окремою причиною і стоїть першою', () => {
        // Найчастіший випадок. Схований у «іншому», він перестав би бути видимим
        // у звітності саме тоді, коли його треба рахувати.
        expect(CANCELLATION_REASONS[0].code).toBe('no_response');
    });

    it('вільний текст обовʼязковий рівно для «іншої причини»', () => {
        const required = CANCELLATION_REASONS.filter(r => r.noteRequired).map(r => r.code);
        expect(required).toEqual(['other']);
    });

    it('коди не повторюються', () => {
        const codes = CANCELLATION_REASONS.map(r => r.code);
        expect(new Set(codes).size).toBe(codes.length);
    });

    it('not_provided не є вибором людини', () => {
        expect(isSelectableReason(NOT_PROVIDED)).toBe(false);
        expect(CANCELLATION_REASONS.some(r => (r.code as string) === NOT_PROVIDED)).toBe(false);
    });

    it('«причину не передано» і «причину не записано» — різні підписи', () => {
        // Перше означає, що скасували в CRM і причини там немає. Друге — що
        // замовлення скасували ще до появи цього поля. Плутати їх не можна.
        expect(cancellationLabel(NOT_PROVIDED)).toBe('Причину не передано');
        expect(cancellationLabel('хтозна-що')).toBe('Причину не записано');
    });
});

describe('validateCancellation', () => {
    it('порожня причина не проходить', () => {
        expect(validateCancellation({}).ok).toBe(false);
        expect(validateCancellation({ reason: '' }).ok).toBe(false);
        expect(validateCancellation({ reason: '   ' }).ok).toBe(false);
    });

    it('невідомий код відхиляється, а не стає «іншою причиною»', () => {
        const r = validateCancellation({ reason: 'бо так', note: 'опис' });
        expect(r.ok).toBe(false);
    });

    it('не-рядок замість коду теж відхиляється', () => {
        expect(validateCancellation({ reason: 7 }).ok).toBe(false);
        expect(validateCancellation({ reason: { code: 'other' } }).ok).toBe(false);
    });

    it('звичайна причина проходить без тексту', () => {
        const r = validateCancellation({ reason: 'no_response' });
        expect(r).toEqual({ ok: true, reason: 'no_response', note: null });
    });

    it('«інша причина» без тексту не проходить', () => {
        const r = validateCancellation({ reason: 'other', note: '   ' });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error).toContain('Опишіть причину');
    });

    it('«інша причина» з текстом проходить', () => {
        const r = validateCancellation({ reason: 'other', note: '  Клієнтка знайшла дешевше в іншому місці  ' });
        expect(r).toEqual({ ok: true, reason: 'other', note: 'Клієнтка знайшла дешевше в іншому місці' });
    });

    it('надто довгий текст обрізається, а не відхиляється', () => {
        const r = validateCancellation({ reason: 'other', note: 'я'.repeat(NOTE_MAX_LENGTH + 200) });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.note).toHaveLength(NOTE_MAX_LENGTH);
    });
});

describe('buildCancellationHistoryRow', () => {
    it('адмінська причина несе код, текст і автора', () => {
        const row = buildCancellationHistoryRow('order-1', {
            state: 'client_refused',
            note: 'Передумала за день до друку',
            source: 'admin',
            actor: { id: 'staff-1', name: 'Вероніка Пиріжок' },
        });

        expect(row.order_id).toBe('order-1');
        expect(row.action).toBe(CANCELLATION_ACTION);
        expect(row.added_by).toBe('staff-1');
        expect(row.notes).toBe('Скасовано: Клієнт відмовився від замовлення. Передумала за день до друку');
        expect(row.details).toEqual({
            reason: 'client_refused',
            note: 'Передумала за день до друку',
            source: 'admin',
            by: 'Вероніка Пиріжок',
        });
    });

    it('крон пише той самий формат із порожнім автором', () => {
        const row = buildCancellationHistoryRow('order-2', {
            state: 'not_paid',
            note: 'Замовлення не оплачене протягом 24 годин',
            source: 'cron',
        });

        expect(row.action).toBe(CANCELLATION_ACTION);
        expect(row.added_by).toBeNull();
        expect(row.details.by).toBeNull();
        expect(row.details.source).toBe('cron');
        expect(row.details.reason).toBe('not_paid');
    });

    it('дзеркало CRM пише not_provided, а не вигадану причину', () => {
        const row = buildCancellationHistoryRow('order-3', { state: NOT_PROVIDED, source: 'keycrm' });
        expect(row.notes).toBe('Скасовано: Причину не передано');
        expect(row.details.reason).toBe(NOT_PROVIDED);
        expect(row.details.note).toBeNull();
        expect(row.added_by).toBeNull();
    });

    it('порожній текст не перетворюється на порожню фразу в notes', () => {
        const row = buildCancellationHistoryRow('order-4', { state: 'duplicate', note: '   ', source: 'admin' });
        expect(row.notes).toBe('Скасовано: Дубль уже наявного замовлення');
        expect(row.details.note).toBeNull();
    });
});

describe('readCancellation', () => {
    const reasonRow = (over: Record<string, any> = {}) => ({
        action: CANCELLATION_ACTION,
        created_at: '2026-09-10T10:00:00Z',
        details: { reason: 'no_response', note: null, source: 'admin', by: 'Оксана Мацьопа' },
        ...over,
    });

    it('знаходить причину серед решти історії', () => {
        const r = readCancellation([
            { action: 'Зміна статусу: new → cancelled', created_at: '2026-09-10T10:00:01Z' },
            reasonRow(),
        ]);
        expect(r.missing).toBe(false);
        expect(r.state).toBe('no_response');
        expect(r.label).toBe('Клієнт не відповідає');
        expect(r.by).toBe('Оксана Мацьопа');
    });

    it('бере найсвіжіший запис, коли замовлення скасовували двічі', () => {
        // Замовлення можна повернути в роботу і скасувати знову. Показувати
        // треба чинну причину, а не першу.
        const r = readCancellation([
            reasonRow({ created_at: '2026-09-01T08:00:00Z', details: { reason: 'duplicate', source: 'admin' } }),
            reasonRow({ created_at: '2026-09-12T08:00:00Z', details: { reason: 'deadline_missed', source: 'admin' } }),
        ]);
        expect(r.state).toBe('deadline_missed');
        expect(r.at).toBe('2026-09-12T08:00:00Z');
    });

    it('без запису каже «причину не записано» і позначає це окремо', () => {
        const r = readCancellation([{ action: 'Зміна статусу: new → cancelled', created_at: '2026-01-01T00:00:00Z' }]);
        expect(r.missing).toBe(true);
        expect(r.label).toBe('Причину не записано');
        expect(r.state).toBe(NOT_PROVIDED);
    });

    it('порожня і зіпсована історія не ламають картку', () => {
        expect(readCancellation(null).missing).toBe(true);
        expect(readCancellation([]).missing).toBe(true);
        expect(readCancellation([null, 'сміття', 42] as any).missing).toBe(true);
    });

    it('невідомий код у details читається як «причини немає», а не як код', () => {
        const r = readCancellation([reasonRow({ details: { reason: 'crm_cancelled', source: 'keycrm' } })]);
        expect(r.state).toBe(NOT_PROVIDED);
        expect(r.missing).toBe(false);
    });
});

describe('cancellationAuthorLabel', () => {
    it('людина підписується власним імʼям', () => {
        const r = readCancellation([{
            action: CANCELLATION_ACTION,
            created_at: '2026-09-10T10:00:00Z',
            details: { reason: 'other', note: 'текст', source: 'admin', by: 'Марина Співакова' },
        }]);
        expect(cancellationAuthorLabel(r)).toBe('Марина Співакова');
    });

    it('крон і CRM підписуються собою, а не порожнечею', () => {
        const cron = readCancellation([{ action: CANCELLATION_ACTION, created_at: '2026-09-10T10:00:00Z', details: { reason: 'not_paid', source: 'cron' } }]);
        const crm = readCancellation([{ action: CANCELLATION_ACTION, created_at: '2026-09-10T10:00:00Z', details: { reason: NOT_PROVIDED, source: 'keycrm' } }]);
        expect(cancellationAuthorLabel(cron)).toBe('Автоматичне скасування через несплату');
        expect(cancellationAuthorLabel(crm)).toBe('Скасовано в KeyCRM');
    });
});
