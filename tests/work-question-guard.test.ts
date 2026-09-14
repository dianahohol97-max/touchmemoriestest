import { describe, expect, it } from 'vitest';
import { extractOrderNumbers } from '@/lib/chatbot/work-chat-monitor';
import { ORDER_NUMBER_HINT, workGuardReply } from '@/lib/chatbot/work-questions';

/**
 * Софія не має права говорити про замовлення без даних у руках.
 *
 * Тест написаний за живим провалом 14.09.2026. Діана спитала в робочому чаті
 * про TM-001314 трьома повідомленнями, жодне з них не розпізналося як номер, і
 * на третьому Софія повідомила команді статус «в роботі», дедлайн «15 січня»,
 * повну оплату і вкомплектований склад. У базі стояло «підтверджене», дедлайн
 * 15.09.2026, оплата справді повна, а поняття «склад» для замовлення не існує
 * взагалі. Факти до моделі не дійшли — відповідала гілка «розмова про життя»,
 * яка не бачить замовлень.
 *
 * Тут перевіряється рівно те, що зламалося, на тих самих трьох рядках.
 */

const REAL = {
    first: '@Sofiia_touch_bot , замовлення 1314',
    second: 'Тм-001314',
    third: 'Все',
    /** Питання Софії, на яке «Все» було відповіддю. */
    parent: 'Дивися, номер у форматі "ТМ-001314" я розумію, але в системі він записується як "1314" — саме так і шукай, коли звертатимешся ще раз! Тепер кажи, що тебе цікавить — статус, дедлайн, оплата чи склад?',
};

describe('три повідомлення, на яких усе згоріло', () => {
    it('«замовлення 1314» дає номер замовлення', () => {
        expect(extractOrderNumbers(REAL.first.replace(/@\S+/g, ' '), { allowShortForms: true }))
            .toEqual(['TM-001314']);
    });

    it('«Тм-001314» кирилицею дає той самий номер', () => {
        expect(extractOrderNumbers(REAL.second, { allowShortForms: true })).toEqual(['TM-001314']);
        // І у відповіді реплаєм, де опорного слова немає взагалі.
        expect(extractOrderNumbers(REAL.second, { allowShortForms: true, assumeOrderContext: true }))
            .toEqual(['TM-001314']);
    });

    it('«Все» номера не дає — і саме тому мусить спрацювати запобіжник', () => {
        expect(extractOrderNumbers(REAL.third, { allowShortForms: true, assumeOrderContext: true }))
            .toEqual([]);
        // Питання, на яке це відповідь, робоче: «статус, дедлайн, оплата чи склад».
        expect(workGuardReply(REAL.third, REAL.parent)).toBe(ORDER_NUMBER_HINT);
    });

    it('жодне з трьох не може дійти до балачки', () => {
        for (const t of [REAL.first, REAL.second]) {
            expect(workGuardReply(t)).toBe(ORDER_NUMBER_HINT);
        }
        expect(workGuardReply(REAL.third, REAL.parent)).toBe(ORDER_NUMBER_HINT);
    });

    it('порада в запобіжнику називає форми, які код справді розуміє', () => {
        for (const form of ['TM-001314', 'Тм-001314', '1314', '13814']) {
            expect(ORDER_NUMBER_HINT).toContain(form);
            const num = extractOrderNumbers(`замовлення ${form}`, { allowShortForms: true });
            expect(num.length).toBe(1);
        }
    });
});

describe('запобіжник: що блокується, а що ні', () => {
    it('слова про факти замовлення блокуються', () => {
        for (const t of ['який там статус?', 'коли дедлайн', 'чи пройшла оплата', 'що по складу', 'де накладна']) {
            expect(workGuardReply(t)).toBe(ORDER_NUMBER_HINT);
        }
    });

    it('будь-що схоже на номер блокується', () => {
        expect(workGuardReply('Софія, 13814?')).toBe(ORDER_NUMBER_HINT);
        expect(workGuardReply('Софія, ТМ-1290')).toBe(ORDER_NUMBER_HINT);
    });

    it('жива балачка лишається живою', () => {
        for (const t of ['Софія, як справи?', 'Софійка, дякую тобі ♥', 'Софія, ти сьогодні бадьора']) {
            expect(workGuardReply(t)).toBeNull();
        }
    });
});

describe('розпізнавач номерів', () => {
    it('латиниця і кирилиця дають однаковий результат', () => {
        for (const t of ['TM-001314', 'ТМ-001314', 'Тм-001314', 'тм 001314']) {
            expect(extractOrderNumbers(t, { allowShortForms: true })).toEqual(['TM-001314']);
        }
    });

    it('голе пʼятизначне лишається номером KeyCRM', () => {
        expect(extractOrderNumbers('13814 глянь будь ласка')).toEqual(['CRM-13814']);
    });

    it('чотиризначне без опори не рахується номером', () => {
        // «12 стор» і «1953 грн» ходять тим самим чатом, і перехоплювач
        // доручень читає геть усе.
        expect(extractOrderNumbers('на 1314 сторінок', { allowShortForms: true })).toEqual([]);
        expect(extractOrderNumbers('1314', { allowShortForms: true })).toEqual([]);
    });

    it('ціна не стає замовленням', () => {
        expect(extractOrderNumbers('замовлення на 1953 грн', { allowShortForms: true })).toEqual([]);
        expect(extractOrderNumbers('13500 грн')).toEqual([]);
    });

    it('скорочені форми вимкнені за замовчуванням — тихий перехоплювач їх не бачить', () => {
        expect(extractOrderNumbers('замовлення 1314')).toEqual([]);
        expect(extractOrderNumbers('замовлення 001314')).toEqual([]);
    });

    it('кирилична літера перед номером не робить його номером', () => {
        // JavaScript-івський \b знає лише ASCII, тож без явного lookbehind
        // «абвTM-1» зійшло б за замовлення.
        expect(extractOrderNumbers('абвTM-1314')).toEqual([]);
    });
});
