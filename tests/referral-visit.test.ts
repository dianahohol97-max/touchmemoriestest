import { describe, expect, it } from 'vitest';
import {
    shouldRecordVisit,
    normalizeLandingPath,
    isVisitCodeShaped,
    visitStorageKey,
    VISIT_DEDUP_WINDOW_MS,
} from '@/lib/referral/visit';

/**
 * Переходи за партнерським посиланням мають показувати людей, а не кліки.
 *
 * Партнер без жодного замовлення досі не міг відрізнити «посилання ніхто не
 * відкрив» від «відкривали, але не купували» — числа переходів не існувало
 * взагалі. Щойно воно зʼявляється, воно мусить бути чесним: одне й те саме
 * посилання, відкрите вранці з листа й увечері зі збереженої вкладки, це один
 * перехід однієї людини, а не два.
 *
 * Окремо перевіряється, що в шлях сторінки входу не потрапляють параметри
 * адреси: там живуть і сам код, і рекламні мітки, які цілком можуть містити
 * ідентифікатор конкретного показу — рівно те, чого в таблиці без персональних
 * даних бути не повинно.
 */
const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe('shouldRecordVisit', () => {
    it('рахує перший перехід, коли в сховищі порожньо', () => {
        expect(shouldRecordVisit(null, NOW)).toBe(true);
        expect(shouldRecordVisit(undefined, NOW)).toBe(true);
        expect(shouldRecordVisit('', NOW)).toBe(true);
    });

    it('не рахує повторний захід у межах доби', () => {
        expect(shouldRecordVisit(NOW - HOUR, NOW)).toBe(false);
        expect(shouldRecordVisit(NOW - 23 * HOUR, NOW)).toBe(false);
    });

    it('рахує знову, коли доба минула', () => {
        expect(shouldRecordVisit(NOW - 24 * HOUR, NOW)).toBe(true);
        expect(shouldRecordVisit(NOW - 100 * HOUR, NOW)).toBe(true);
    });

    it('читає час, збережений рядком — саме так його кладе localStorage', () => {
        expect(shouldRecordVisit(String(NOW - HOUR), NOW)).toBe(false);
        expect(shouldRecordVisit(String(NOW - 25 * HOUR), NOW)).toBe(true);
    });

    it('зіпсоване значення трактує як «не рахували»', () => {
        // Втратити перехід гірше, ніж порахувати зайвий: перше коштує партнеру
        // грошей, друге — точності числа.
        expect(shouldRecordVisit('казна-що', NOW)).toBe(true);
        expect(shouldRecordVisit('0', NOW)).toBe(true);
        expect(shouldRecordVisit('-5', NOW)).toBe(true);
    });

    it('час із майбутнього не блокує підрахунок назавжди', () => {
        // Переставлений годинник інакше замкнув би партнеру лічильник.
        expect(shouldRecordVisit(NOW + 100 * HOUR, NOW)).toBe(true);
    });

    it('вікно дедуплікації — рівно доба', () => {
        expect(VISIT_DEDUP_WINDOW_MS).toBe(24 * HOUR);
    });
});

describe('normalizeLandingPath', () => {
    it('лишає тільки шлях', () => {
        expect(normalizeLandingPath('/uk/catalog')).toBe('/uk/catalog');
    });

    it('відрізає параметри адреси разом із рекламними мітками', () => {
        expect(normalizeLandingPath('/uk?ref=ПОДОTABB&utm_source=ig&fbclid=abc123')).toBe('/uk');
        expect(normalizeLandingPath('/uk/catalog#section')).toBe('/uk/catalog');
    });

    it('не приймає абсолютних адрес і сміття', () => {
        expect(normalizeLandingPath('https://example.com/uk')).toBeNull();
        expect(normalizeLandingPath('javascript:alert(1)')).toBeNull();
        expect(normalizeLandingPath('')).toBeNull();
        expect(normalizeLandingPath(null)).toBeNull();
    });

    it('обрізає надто довгий шлях — він приходить від клієнта', () => {
        expect(normalizeLandingPath('/' + 'a'.repeat(500))!.length).toBe(200);
    });
});

describe('isVisitCodeShaped', () => {
    it('приймає живі партнерські коди, зокрема кириличний', () => {
        expect(isVisitCodeShaped('DIANPD3X')).toBe(true);
        expect(isVisitCodeShaped('ПОДОTABB')).toBe(true);
    });

    it('відкидає надто коротке, надто довге й підстановні знаки', () => {
        expect(isVisitCodeShaped('AB')).toBe(false);
        expect(isVisitCodeShaped('A'.repeat(17))).toBe(false);
        expect(isVisitCodeShaped('%%%%')).toBe(false);
        expect(isVisitCodeShaped('____')).toBe(false);
        expect(isVisitCodeShaped(null)).toBe(false);
    });
});

describe('visitStorageKey', () => {
    it('ключ свій на кожен код і не залежить від регістру', () => {
        expect(visitStorageKey('dianpd3x')).toBe('tm_ref_visit:DIANPD3X');
        expect(visitStorageKey('DIANPD3X')).toBe(visitStorageKey('dianpd3x'));
        expect(visitStorageKey('ПОДОTABB')).not.toBe(visitStorageKey('DIANPD3X'));
    });
});
