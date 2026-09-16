import { describe, expect, it } from 'vitest';
import { createAgencyPartner } from '@/lib/agency/create-partner';
import { normalizeBindingEmail } from '@/lib/agency/binding';

/**
 * ПОШТА ПАРТНЕРА ЗБЕРІГАЄТЬСЯ ТАК, ЯК ЇЇ ПОТІМ ШУКАЮТЬ.
 *
 * Нормалізація жила в місцях виклику, і з чотирьох її робили два. Ручне
 * оформлення в адмінці й кабінет фотографа передавали пошту як прийшла, тож у
 * базу міг лягти рядок із пробілом по краях. Читання йдуть через `ilike`, який
 * прощає регістр і НЕ прощає пробіл: такий партнер не збігся б із поштою своєї
 * сесії, `/uk/partner/cabinet` сказав би «кабінет не знайдено», а форма
 * відновлення відповіла б «надіслали» і не надіслала б нічого.
 *
 * Тести ганяють справжню createAgencyPartner: перевіряється те, що реально
 * лягає в рядок, а не те, що хтось передав на вході.
 */

function makeAdmin() {
    const inserted: Record<string, any[]> = { agency_partners: [], promo_codes: [] };
    const deleted: string[] = [];

    const from = (table: string) => {
        let pending: any = null;
        const api: any = {
            select: () => api,
            eq: () => api,
            ilike: () => api,
            // Код завжди вільний: колізії тут не тестуються.
            maybeSingle: async () => ({ data: null, error: null }),
            insert: (row: any) => { pending = row; return api; },
            delete: () => { pending = '__delete__'; return api; },
            single: async () => {
                inserted[table].push(pending);
                return { data: { id: `${table}-1`, ...pending }, error: null };
            },
            then: (resolve: any) => {
                if (pending === '__delete__') deleted.push(table);
                return Promise.resolve({ data: null, error: null }).then(resolve);
            },
        };
        return api;
    };
    return { admin: { from } as any, inserted, deleted };
}

const baseInput = {
    name: 'Подорожуй!',
    partnerKind: 'travel_agency' as const,
    clientDiscount: 5,
    travelbookRate: 5,
    otherRate: 3,
};

describe('createAgencyPartner нормалізує пошту сам', () => {
    it('обрізає пробіли й опускає регістр', async () => {
        const { admin, inserted } = makeAdmin();
        await createAgencyPartner(admin, { ...baseInput, email: '  Studio@Example.COM ' });
        expect(inserted.agency_partners[0].email).toBe('studio@example.com');
    });

    it('пошта в рядку збігається з тим, як її нормалізує привʼязка', async () => {
        // Саме на цьому тримається перевірка самореферала: isSelfReferral
        // порівнює пошту покупця з agency_partners.email через ту саму функцію.
        const raw = ' Partner@Agency.com ';
        const { admin, inserted } = makeAdmin();
        await createAgencyPartner(admin, { ...baseInput, email: raw });
        expect(inserted.agency_partners[0].email).toBe(normalizeBindingEmail(raw));
    });

    it('внутрішні крапки й «+тег» лишаються недоторканими', async () => {
        // Для Google це та сама скринька, для решти світу — різні адреси.
        // Склеювати їх заради одного постачальника означало б віддавати комісію
        // не тому партнеру.
        const { admin, inserted } = makeAdmin();
        await createAgencyPartner(admin, { ...baseInput, email: 'first.last+tm@gmail.com' });
        expect(inserted.agency_partners[0].email).toBe('first.last+tm@gmail.com');
    });

    it('непридатна пошта — гучна відмова, а не напівживий партнер', async () => {
        // Партнеру без пошти нікуди надіслати ні код, ні відновлення доступу.
        const { admin, inserted } = makeAdmin();
        await expect(createAgencyPartner(admin, { ...baseInput, email: '   ' })).rejects.toThrow();
        await expect(createAgencyPartner(admin, { ...baseInput, email: 'не-пошта' })).rejects.toThrow();
        // І жодного промокоду-сироти після відмови теж не лишилося.
        expect(inserted.promo_codes).toHaveLength(0);
        expect(inserted.agency_partners).toHaveLength(0);
    });
});
