import { describe, expect, it } from 'vitest';
import { CONTENT_TABLES, pickColumns } from '@/lib/admin/content-tables';
import { ADMIN_SECTION_KEYS } from '@/lib/auth/admin-sections';

/**
 * Реєстр таблиць контенту — це і є весь захист роуту /api/admin/content.
 *
 * Роут один на дев'ятнадцять таблиць, і єдине, що відрізняє його від
 * універсального доступу до бази, — цей перелік: які таблиці існують, який
 * розділ прав на них потрібен і які саме колонки дозволено записати. Тому він
 * під тестами: помилка тут не «щось не працює», а тихо відкритий запис туди,
 * куди не треба.
 */
describe('CONTENT_TABLES', () => {
    it('names a section every guard can actually resolve', () => {
        for (const [table, entry] of Object.entries(CONTENT_TABLES)) {
            expect(ADMIN_SECTION_KEYS.has(entry.section), `${table} → ${entry.section}`).toBe(true);
        }
    });

    it('never lets id or created_at into the writable columns', () => {
        for (const [table, entry] of Object.entries(CONTENT_TABLES)) {
            expect(entry.columns, table).not.toContain('id');
            expect(entry.columns, table).not.toContain('created_at');
        }
    });

    it('gives every table at least one writable column', () => {
        for (const [table, entry] of Object.entries(CONTENT_TABLES)) {
            expect(entry.columns.length, table).toBeGreaterThan(0);
        }
    });

    /**
     * Каталог і контент — різні розділи прав. Дизайнер має content: full і
     * catalog: view, тож якби категорії каталогу лежали під 'content', він
     * редагував би каталог через цей роут.
     */
    it('keeps catalog tables out of the content section', () => {
        expect(CONTENT_TABLES.categories.section).toBe('catalog');
        expect(CONTENT_TABLES.gift_collections.section).toBe('catalog');
        expect(CONTENT_TABLES.blog_posts.section).toBe('content');
    });

    it('does not allow deleting rows the pages only ever update', () => {
        expect(CONTENT_TABLES.site_content.allowDelete).toBe(false);
        expect(CONTENT_TABLES.site_blocks.allowDelete).toBe(false);
        expect(CONTENT_TABLES.theme_settings.allowDelete).toBe(false);
    });
});

describe('pickColumns', () => {
    const table = CONTENT_TABLES.blog_posts;

    it('keeps allowed columns', () => {
        const { row, rejected } = pickColumns(table, { title: 'Привіт', is_published: true });
        expect(row).toEqual({ title: 'Привіт', is_published: true });
        expect(rejected).toEqual([]);
    });

    /**
     * Сторінки шлють у роут обʼєкт рядка цілком, разом з id. Це адреса рядка,
     * а не поле для запису, тож вона просто відкидається — інакше кожне
     * збереження впиралося б у скаргу на зайве поле.
     */
    it('drops id silently but reports everything else it refuses', () => {
        const { row, rejected } = pickColumns(table, {
            id: 'abc', title: 'Привіт', views_count: 9999, created_at: '2020-01-01',
        });
        expect(row).toEqual({ title: 'Привіт' });
        expect(rejected).toEqual(['views_count', 'created_at']);
    });

    it('returns nothing for junk input instead of throwing', () => {
        expect(pickColumns(table, null)).toEqual({ row: {}, rejected: [] });
        expect(pickColumns(table, 'рядок')).toEqual({ row: {}, rejected: [] });
        expect(pickColumns(table, [1, 2])).toEqual({ row: {}, rejected: [] });
    });
});
