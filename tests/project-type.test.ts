import { describe, it, expect } from 'vitest';
import { resolveProjectType } from '@/lib/orders/project-type';

/**
 * Значення product_type писали два місця, і вони розходилися: конструктор клав
 * глянцевий журнал як «journal», оформлення — як «magazine». У базі станом на
 * 22.09.2026 це 130 рядків проти 15, і всі вони від тих самих двох slug.
 *
 * Тести нижче пінять саме ті slug, які є в каталозі, а не вигадані.
 */

describe('тип макета за slug', () => {
    it('глянцевий журнал і фотожурнал — обидва journal', () => {
        expect(resolveProjectType('personalized-glossy-magazine')).toBe('journal');
        expect(resolveProjectType('fotozhurnal-tverd-obkladynka')).toBe('journal');
    });

    it('обидва старі написання сходяться в одне', () => {
        // Саме на цій розбіжності «Поставити на замовлення» на TM-001352
        // дописала другий виріб замість заміни.
        expect(resolveProjectType('personalized-glossy-magazine'))
            .toBe(resolveProjectType('magazine-a4-journal'));
    });

    it('тревелбук', () => {
        expect(resolveProjectType('travelbook')).toBe('travelbook');
        expect(resolveProjectType('travel-book-20x30')).toBe('travelbook');
    });

    it('книга побажань', () => {
        expect(resolveProjectType('wishbook')).toBe('wishbook');
        expect(resolveProjectType('knyga-pobazhan')).toBe('wishbook');
        expect(resolveProjectType('guest-book')).toBe('wishbook');
    });

    it('планер', () => {
        expect(resolveProjectType('planner-a5')).toBe('planner');
    });

    it('усе інше — фотокнига, і порожнеча теж', () => {
        expect(resolveProjectType('photobook-20x20')).toBe('photobook');
        expect(resolveProjectType('scrapbook')).toBe('photobook');
        expect(resolveProjectType('')).toBe('photobook');
        expect(resolveProjectType(null)).toBe('photobook');
        expect(resolveProjectType(undefined)).toBe('photobook');
    });

    it('регістр не вирішує нічого', () => {
        expect(resolveProjectType('Personalized-Glossy-MAGAZINE')).toBe('journal');
        expect(resolveProjectType('TravelBook')).toBe('travelbook');
    });

    it('тревелбук сильніший за решту, бо перевіряється першим', () => {
        // Захист від слугу, який містить два слова одразу: порядок перевірок
        // повторює той, що був у обох записувачів, і міняти його не можна.
        expect(resolveProjectType('travel-journal')).toBe('travelbook');
    });
});
