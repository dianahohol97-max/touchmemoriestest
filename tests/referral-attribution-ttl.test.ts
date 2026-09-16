import { describe, expect, it } from 'vitest';
import {
    parseStoredReferralCode,
    serializeReferralCode,
    REF_ATTRIBUTION_TTL_MS,
} from '@/lib/referral/pending-code';

/**
 * Один ключ у сховищі несе дві різні речі, і строк придатності в них різний.
 *
 * Звʼязок «друг запросив друга» створюється при реєстрації, тобто за лічені
 * хвилини після переходу, і сам не старіє — його читають без строку. Партнерська
 * атрибуція на чекауті означає комісію агенції чи блогеру з кожного оплаченого
 * замовлення, і ось вона старіє: вікно — девʼяносто днів під тревел-цикл
 * (подорож, повернення, розбір фотографій). До цієї зміни код лежав голим
 * рядком без часу взагалі, тож перехід дворічної давнини приносив партнеру
 * комісію так само, як учорашній.
 *
 * Окремо перевіряється сумісність зі старим записом: голий рядок без часу — це
 * те, що лежить у браузерах людей, які перейшли за посиланням до цієї зміни, і
 * вважати його простроченим означало б забрати комісію за вчорашній перехід.
 */
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe('parseStoredReferralCode', () => {
    it('читає свіжий запис із часом', () => {
        const raw = serializeReferralCode('ПОДОTABB', NOW - DAY);
        expect(parseStoredReferralCode(raw, NOW, REF_ATTRIBUTION_TTL_MS)).toBe('ПОДОTABB');
    });

    it('тримає атрибуцію рівно до девʼяноста днів', () => {
        const raw = serializeReferralCode('DIANPD3X', NOW - 89 * DAY);
        expect(parseStoredReferralCode(raw, NOW, REF_ATTRIBUTION_TTL_MS)).toBe('DIANPD3X');
    });

    it('відпускає атрибуцію після девʼяноста днів', () => {
        const raw = serializeReferralCode('DIANPD3X', NOW - 91 * DAY);
        expect(parseStoredReferralCode(raw, NOW, REF_ATTRIBUTION_TTL_MS)).toBeNull();
    });

    it('без строку повертає код будь-якої давнини — це реферальний звʼязок, він не старіє', () => {
        const raw = serializeReferralCode('DIANPD3X', NOW - 900 * DAY);
        expect(parseStoredReferralCode(raw, NOW, null)).toBe('DIANPD3X');
    });

    it('старий запис без часу вважається свіжим, а не простроченим', () => {
        expect(parseStoredReferralCode('DIANPD3X', NOW, REF_ATTRIBUTION_TTL_MS)).toBe('DIANPD3X');
    });

    it('приводить до верхнього регістру, зокрема кириличний код', () => {
        expect(parseStoredReferralCode('подоtabb', NOW, REF_ATTRIBUTION_TTL_MS)).toBe('ПОДОTABB');
    });

    it('відкидає порожнє, зіпсований JSON і несхожі на код рядки', () => {
        expect(parseStoredReferralCode(null, NOW, REF_ATTRIBUTION_TTL_MS)).toBeNull();
        expect(parseStoredReferralCode('{зламано', NOW, REF_ATTRIBUTION_TTL_MS)).toBeNull();
        expect(parseStoredReferralCode('AB', NOW, REF_ATTRIBUTION_TTL_MS)).toBeNull();
        expect(parseStoredReferralCode('A'.repeat(17), NOW, REF_ATTRIBUTION_TTL_MS)).toBeNull();
        expect(parseStoredReferralCode('CODE WITH SPACE', NOW, REF_ATTRIBUTION_TTL_MS)).toBeNull();
    });

    it('не пропускає підстановні знаки, якими шукають цілий набір кодів', () => {
        expect(parseStoredReferralCode('%%%%', NOW, REF_ATTRIBUTION_TTL_MS)).toBeNull();
        expect(parseStoredReferralCode('____', NOW, REF_ATTRIBUTION_TTL_MS)).toBeNull();
    });
});
