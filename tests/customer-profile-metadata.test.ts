import { describe, expect, it } from 'vitest';
import {
    birthdayFromMetadata,
    nameFromMetadata,
    profilePatchFromMetadata,
} from '@/lib/customers/profile-from-metadata';

/**
 * Дістати з метаданих реєстрації те, що не доїхало до картки клієнта.
 *
 * Числа в коментарях — з бази на 14.09.2026: 310 карток без імені, з них 288
 * мають first_name у метаданих, і 35 дат народження, яких у customers немає
 * жодної.
 */

describe('nameFromMetadata', () => {
    it('бере name і full_name — те, що кладуть Google і сторінка /register', () => {
        expect(nameFromMetadata({ name: 'Оксана Михайленко' })).toBe('Оксана Михайленко');
        expect(nameFromMetadata({ full_name: 'Ruslana Buchynska' })).toBe('Ruslana Buchynska');
    });

    /** Саме цей випадок і загубив 288 імен: AuthModal клав лише first_name. */
    it('збирає ім’я з first_name, коли більше нічого немає', () => {
        expect(nameFromMetadata({ first_name: 'Оксана' })).toBe('Оксана');
        expect(nameFromMetadata({ first_name: 'Оксана', last_name: 'Михайленко' })).toBe('Оксана Михайленко');
    });

    it('name важливіший за first_name, коли є обидва', () => {
        expect(nameFromMetadata({ name: 'Оксана Михайленко', first_name: 'Оксана' })).toBe('Оксана Михайленко');
    });

    it('зайві пробіли не стають іменем', () => {
        expect(nameFromMetadata({ first_name: '   ' })).toBeNull();
        expect(nameFromMetadata({ name: '  Оксана   Михайленко  ' })).toBe('Оксана Михайленко');
    });

    it('не падає на порожньому і нерядковому', () => {
        expect(nameFromMetadata(null)).toBeNull();
        expect(nameFromMetadata({})).toBeNull();
        expect(nameFromMetadata({ name: 42 })).toBeNull();
    });
});

describe('birthdayFromMetadata', () => {
    it('приймає повний ISO-вигляд', () => {
        expect(birthdayFromMetadata({ birthday: '1990-05-11' })).toBe('1990-05-11');
        expect(birthdayFromMetadata({ birthday: '1978-02-26' })).toBe('1978-02-26');
    });

    /**
     * Вгадувати формати не можна: дата йде в привітальний лист, і 05.11.1990
     * прочитане як 11 травня означає лист не в той день.
     */
    it('відмовляє всьому, що не РРРР-ММ-ДД', () => {
        expect(birthdayFromMetadata({ birthday: '11.05.1990' })).toBeNull();
        expect(birthdayFromMetadata({ birthday: '1990/05/11' })).toBeNull();
        expect(birthdayFromMetadata({ birthday: '11 травня' })).toBeNull();
        expect(birthdayFromMetadata({ birthday: '1990-5-1' })).toBeNull();
    });

    it('відмовляє неможливим датам', () => {
        expect(birthdayFromMetadata({ birthday: '1990-02-31' })).toBeNull();
        expect(birthdayFromMetadata({ birthday: '1990-13-01' })).toBeNull();
        expect(birthdayFromMetadata({ birthday: '1800-01-01' })).toBeNull();
        expect(birthdayFromMetadata({ birthday: '2999-01-01' })).toBeNull();
    });

    it('високосний день лишається дійсним', () => {
        expect(birthdayFromMetadata({ birthday: '1996-02-29' })).toBe('1996-02-29');
        expect(birthdayFromMetadata({ birthday: '1997-02-29' })).toBeNull();
    });

    it('не падає на порожньому', () => {
        expect(birthdayFromMetadata({})).toBeNull();
        expect(birthdayFromMetadata(null)).toBeNull();
        expect(birthdayFromMetadata({ birthday: '' })).toBeNull();
    });
});

/**
 * Головне правило: заповнене НЕ перезаписується.
 *
 * Людина могла виправити ім'я в кабінеті, і метадані з моменту реєстрації не
 * мають права це відкотити.
 */
describe('profilePatchFromMetadata', () => {
    it('заповнює лише порожнє', () => {
        expect(profilePatchFromMetadata({ name: null, birthday: null }, { first_name: 'Оксана', birthday: '1990-05-11' }))
            .toEqual({ name: 'Оксана', birthday: '1990-05-11' });
    });

    it('не чіпає вже заповнене ім’я', () => {
        expect(profilePatchFromMetadata({ name: 'Оксана Михайленко', birthday: null }, { first_name: 'Оксана' }))
            .toEqual({});
    });

    it('не чіпає вже заповнену дату', () => {
        expect(profilePatchFromMetadata({ name: 'Оксана', birthday: '1990-05-11' }, { birthday: '1985-01-01' }))
            .toEqual({});
    });

    it('заповнює по частинах, коли є лише одне з двох', () => {
        expect(profilePatchFromMetadata({ name: null, birthday: '1990-05-11' }, { first_name: 'Оксана' }))
            .toEqual({ name: 'Оксана' });
        expect(profilePatchFromMetadata({ name: 'Оксана', birthday: null }, { birthday: '1990-05-11' }))
            .toEqual({ birthday: '1990-05-11' });
    });

    it('порожній результат, коли брати нема чого', () => {
        expect(profilePatchFromMetadata({ name: null, birthday: null }, {})).toEqual({});
        expect(profilePatchFromMetadata({ name: 'Оксана', birthday: '1990-05-11' }, { first_name: 'Х', birthday: '2000-01-01' })).toEqual({});
    });

    it('порожнє ім’я з пробілів вважається порожнім', () => {
        expect(profilePatchFromMetadata({ name: '   ', birthday: null }, { first_name: 'Оксана' }))
            .toEqual({ name: 'Оксана' });
    });
});
