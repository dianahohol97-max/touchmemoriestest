import { describe, it, expect } from 'vitest';
import { isDomesticNovaPoshta } from '@/lib/shipping/carrier';

/**
 * Крон відстеження питає статус лише про внутрішні відправлення Новою Поштою.
 * До 14.09.2026 він визначав їх за порожнім `tracking_carrier`, і 61 ТТН, які
 * приїхали з KeyCRM із написом «Нова Пошта», не відстежувались узагалі.
 */
describe('isDomesticNovaPoshta', () => {
    it('порожнє поле — це внутрішнє відправлення', () => {
        expect(isDomesticNovaPoshta(null)).toBe(true);
        expect(isDomesticNovaPoshta(undefined)).toBe(true);
        expect(isDomesticNovaPoshta('')).toBe(true);
        expect(isDomesticNovaPoshta('   ')).toBe(true);
    });

    it('назва служби з KeyCRM теж означає внутрішнє відправлення', () => {
        expect(isDomesticNovaPoshta('Нова Пошта')).toBe(true);
        expect(isDomesticNovaPoshta('нова пошта')).toBe(true);
        expect(isDomesticNovaPoshta('Nova Poshta')).toBe(true);
        expect(isDomesticNovaPoshta('novaposhta')).toBe(true);
    });

    it('міжнародну мітку відсікаємо, хоч у ній і є «Нова Пошта»', () => {
        expect(isDomesticNovaPoshta('nova_poshta_intl')).toBe(false);
        expect(isDomesticNovaPoshta('Нова Пошта Global')).toBe(false);
    });

    it('інші служби домашній трекінг не знає', () => {
        expect(isDomesticNovaPoshta('Укрпошта')).toBe(false);
        expect(isDomesticNovaPoshta('Meest')).toBe(false);
        expect(isDomesticNovaPoshta('DHL')).toBe(false);
    });
});
