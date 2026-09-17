import { describe, expect, it } from 'vitest';
import {
    PRINT_WARNING_MARKER,
    hasPrintWarning,
    isDesignerInFlight,
    printWarningLine,
    stripPrintWarning,
} from '@/lib/print/print-warning';

/**
 * Попередження про відсутні файли для друку писали двома різними фразами.
 *
 * Крон missing-print-files писав «файли для друку не завантажились», і цю фразу
 * знає решта системи: список замовлень підсвічує рядок червоним, KeyCRM
 * скорочує його, щоденне зведення рахує. Аудит у render-order писав власне
 * «Нема файлів для друку» — 34 замовлення стояли позначені й були невидимі для
 * всіх трьох екранів. До того ж його маркер («бракує файлів для друку») не
 * збігався з тим, що він сам писав, тож дубль у примітці був неминучий.
 *
 * Тести пінять саме те, через що це зламалося: рядок будується з тієї самої
 * константи, за якою його впізнають, а прибирання знає обидва формулювання.
 */
describe('printWarningLine', () => {
    it('рядок містить маркер, за яким його потім упізнають', () => {
        const line = printWarningLine(['Travel Book']);
        expect(line).toContain(PRINT_WARNING_MARKER);
        expect(hasPrintWarning(line)).toBe(true);
    });

    it('називає позиції, яким бракує макета', () => {
        expect(printWarningLine(['Travel Book', 'Глянцевий журнал'])).toContain('Travel Book, Глянцевий журнал');
    });
});

describe('hasPrintWarning', () => {
    it('упізнає стару фразу аудиту', () => {
        expect(hasPrintWarning('⚠️ Нема файлів для друку: Travel Book. Не в друк.')).toBe(true);
    });

    it('порожня примітка попередження не несе', () => {
        expect(hasPrintWarning('')).toBe(false);
        expect(hasPrintWarning(null)).toBe(false);
        expect(hasPrintWarning('Замовлення з дизайнером')).toBe(false);
    });
});

describe('stripPrintWarning', () => {
    it('прибирає стару фразу і не чіпає бриф', () => {
        const notes = [
            '⚠️ Нема файлів для друку: Travel Book. Не в друк — звʼяжіться з клієнтом.',
            '',
            'Замовлення з дизайнером',
            '---',
            'Надпис на обкладинці: Athens 2026',
        ].join('\n');
        expect(stripPrintWarning(notes)).toBe([
            'Замовлення з дизайнером',
            '---',
            'Надпис на обкладинці: Athens 2026',
        ].join('\n'));
    });

    it('прибирає нову фразу так само', () => {
        const notes = `${printWarningLine(['Полароїд'])}\n\nКоментар клієнта`;
        expect(stripPrintWarning(notes)).toBe('Коментар клієнта');
    });

    it('примітка з самого попередження стає порожньою', () => {
        expect(stripPrintWarning(printWarningLine(['Travel Book']))).toBe('');
    });

    it('без попередження примітка лишається як є', () => {
        const notes = 'Замовлення з дизайнером\n---\nДоставка: Нова Пошта — Канів';
        expect(stripPrintWarning(notes)).toBe(notes);
    });
});

describe('isDesignerInFlight', () => {
    /**
     * 17.09.2026 менеджерка написала «TM-001335 нема фоток» і додала «але там
     * отаке, то може клієнтка не завантажила, я хз». Мітка на той момент
     * стояла на пʼятьох замовленнях, і чотири з них були цілком справні —
     * звідси й «я хз».
     *
     * Причина була в тому, що умова вимагала ПРИЗНАЧЕНОГО дизайнера, а його
     * призначають уже після оплати. Аудит біжить одразу по оплаті, тож у тому
     * вікні умова не виконувалася ніколи.
     */
    it('оплачене замовлення з дизайнером і фото клієнта — це не втрачений макет', () => {
        // TM-001332, TM-001336, TM-001338: with_designer, фото на місці,
        // дизайнера ще не призначили.
        expect(isDesignerInFlight({ with_designer: true }, true)).toBe(true);
    });

    it('призначення дизайнера більше ні на що не впливає', () => {
        expect(isDesignerInFlight({ with_designer: true, designer_id: null } as any, true)).toBe(true);
        expect(isDesignerInFlight({ with_designer: true, designer_id: 'x' } as any, true)).toBe(true);
    });

    it('заявка з дизайнером БЕЗ жодного файлу — це справжня втрата, мітка лишається', () => {
        expect(isDesignerInFlight({ with_designer: true }, false)).toBe(false);
    });

    it('замовлення з конструктора мітку отримує, і це саме TM-001335', () => {
        expect(isDesignerInFlight({ with_designer: false }, false)).toBe(false);
        expect(isDesignerInFlight({ with_designer: false }, true)).toBe(false);
    });

    it('порожнє замовлення не валить перевірку', () => {
        expect(isDesignerInFlight({}, true)).toBe(false);
        expect(isDesignerInFlight(null as any, true)).toBe(false);
    });
});
