import { describe, expect, it } from 'vitest';
import {
    ALLOWED_CONSENT_TYPES,
    ALLOWED_SOURCES,
    buildConsentRows,
    readConsentEmail,
} from '@/lib/consent/log-entries';

/**
 * Журнал згод.
 *
 * Тест існує через конкретну поломку: таблиця consent_log мала нуль рядків при
 * 366 підписниках, бо код писав у consent_type назви ДІЙ, а CHECK-обмеження
 * бази приймає назви КАТЕГОРІЙ. Помилку вставки ніхто не перевіряв, і чотири
 * маршрути роками відповідали успіхом, не записавши нічого.
 *
 * Обмеження бази не видно з коду взагалі — таблицю створили в дашборді
 * Supabase. Тому дозволений словник продубльовано константою, а цей тест
 * стежить, щоб кожне значення, яке маршрут збирається записати, у ньому було.
 */

const ALLOWED = new Set<string>(ALLOWED_CONSENT_TYPES);

describe('словник таблиці', () => {
    it('дозволені типи згоди — це категорії, а не дії', () => {
        expect([...ALLOWED_CONSENT_TYPES]).toEqual(['essential', 'analytics', 'marketing', 'functional', 'terms', 'privacy']);
    });

    it('джерел рівно чотири, і «cookie_banner» серед них немає', () => {
        expect([...ALLOWED_SOURCES]).toEqual(['web', 'mobile', 'api', 'admin']);
        expect(ALLOWED_SOURCES).not.toContain('cookie_banner' as never);
        expect(ALLOWED_SOURCES).not.toContain('account_privacy' as never);
    });
});

describe('buildConsentRows — банер cookie', () => {
    it('повна згода дає чотири рядки, усі дозволені', () => {
        const rows = buildConsentRows('cookies_accepted', { essential: true, functional: true, analytics: true, marketing: true });
        expect(rows).toEqual([
            { consent_type: 'essential', granted: true },
            { consent_type: 'functional', granted: true },
            { consent_type: 'analytics', granted: true },
            { consent_type: 'marketing', granted: true },
        ]);
    });

    it('відмова теж дає чотири рядки — відмова це теж факт', () => {
        // Порожній журнал не відрізнити від «людина натиснула відмовити», а це
        // якраз те, що доводить дотримання правил.
        const rows = buildConsentRows('cookies_rejected', { essential: true, functional: false, analytics: false, marketing: false });
        expect(rows).toHaveLength(4);
        expect(rows.filter(r => r.granted).map(r => r.consent_type)).toEqual(['essential']);
    });

    it('часткова згода записує кожну категорію окремо', () => {
        const rows = buildConsentRows('cookies_partial', { essential: true, functional: true, analytics: false, marketing: false });
        const granted = Object.fromEntries(rows.map(r => [r.consent_type, r.granted]));
        expect(granted).toEqual({ essential: true, functional: true, analytics: false, marketing: false });
    });

    it('essential лишається true, навіть якщо браузер прислав false', () => {
        // Технічні cookie вимкнути не можна, і банер їх не питає.
        const rows = buildConsentRows('cookies_accepted', { essential: false });
        expect(rows.find(r => r.consent_type === 'essential')?.granted).toBe(true);
    });

    it('відсутні категорії читаються як «не дозволено», а не як «так»', () => {
        const rows = buildConsentRows('cookies_partial', {});
        expect(rows.filter(r => r.granted).map(r => r.consent_type)).toEqual(['essential']);
    });

    it('не-булеве значення не вважається згодою', () => {
        const rows = buildConsentRows('cookies_partial', { analytics: 'yes', marketing: 1 } as any);
        expect(rows.find(r => r.consent_type === 'analytics')?.granted).toBe(false);
        expect(rows.find(r => r.consent_type === 'marketing')?.granted).toBe(false);
    });
});

describe('buildConsentRows — решта дій', () => {
    it('реєстрація дає два рядки: умови і політика', () => {
        // Чекбокс один, але покриває два документи, і з журналу має бути видно
        // обидва.
        expect(buildConsentRows('terms_accepted')).toEqual([
            { consent_type: 'terms', granted: true },
            { consent_type: 'privacy', granted: true },
        ]);
    });

    it('підписка і відписка — це та сама категорія з різним granted', () => {
        expect(buildConsentRows('marketing_accepted')).toEqual([{ consent_type: 'marketing', granted: true }]);
        expect(buildConsentRows('marketing_withdrawn')).toEqual([{ consent_type: 'marketing', granted: false }]);
    });

    it('невідома дія не дає рядків — маршрут відповість помилкою', () => {
        // Саме цього бракувало: раніше невідоме мовчки «записувалося».
        expect(buildConsentRows('teleported')).toEqual([]);
        expect(buildConsentRows('')).toEqual([]);
        expect(buildConsentRows('account_deleted')).toEqual([]);
        expect(buildConsentRows('data_export_requested')).toEqual([]);
    });

    it('сміття замість категорій не ламає розбір', () => {
        expect(buildConsentRows('cookies_accepted', null)).toHaveLength(4);
        expect(buildConsentRows('cookies_accepted', 'ні' as any)).toHaveLength(4);
    });
});

describe('кожне значення, яке пишемо, дозволене базою', () => {
    const actions = ['cookies_accepted', 'cookies_rejected', 'cookies_partial', 'terms_accepted', 'marketing_accepted', 'marketing_withdrawn'];

    it.each(actions)('%s не порушує CHECK на consent_type', (action) => {
        const rows = buildConsentRows(action, { essential: true, functional: true, analytics: true, marketing: true });
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) expect(ALLOWED.has(row.consent_type)).toBe(true);
    });
});

describe('readConsentEmail', () => {
    it('нормальна пошта проходить у нижньому регістрі', () => {
        expect(readConsentEmail('  Diana@Example.COM ')).toBe('diana@example.com');
    });

    it('не-пошта відкидається', () => {
        expect(readConsentEmail('не пошта')).toBeNull();
        expect(readConsentEmail('a@b')).toBeNull();
        expect(readConsentEmail('')).toBeNull();
        expect(readConsentEmail(null)).toBeNull();
        expect(readConsentEmail(42)).toBeNull();
    });

    it('надто довге значення не потрапляє в базу', () => {
        expect(readConsentEmail(`${'a'.repeat(320)}@example.com`)).toBeNull();
    });
});
