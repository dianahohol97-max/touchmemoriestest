import { describe, expect, it } from 'vitest';
import { CONFIGURATOR_OPTION_NAMES, PRODUCT_OPTION_NAMES, configuratorOptionKey, getMagazinePrice } from '@/lib/products';
import uk from '@/locales/uk.json';
import en from '@/locales/en.json';
import pl from '@/locales/pl.json';
import de from '@/locales/de.json';
import ro from '@/locales/ro.json';

/**
 * Назви опцій у Supabase — це ключі, а не написи на екрані.
 *
 * Конструктор довго питав «яка це опція?» порівнянням
 * `option.name === t('constructor.page_count')`, тобто зіставляв ключ бази з
 * перекладеним написом. Українською цей переклад — «Сторінок», а в базі стоїть
 * «Кількість сторінок», тож збіг не траплявся ніколи: у глянцевого журналу
 * список сторінок лишався без значення за замовчуванням, без `value` і з
 * onChange, який нічого не робив. Клієнт обирав 36 сторінок, а список мовчки
 * повертався на 8, ціна трималася запасних 525 ₴, і в редактор ішов порожній
 * selectedPageCount, який журнальна гілка читає як ті самі 8 сторінок. В
 * англійській, румунській, польській та німецькій перекладені всі чотири
 * назви, тому там не працював увесь блок опцій.
 *
 * Тест пінить саме це: ключ бази розпізнається, а будь-який переклад — ні.
 */
describe('configuratorOptionKey', () => {
    it('розпізнає назви опцій так, як їх зберігає Supabase', () => {
        expect(configuratorOptionKey('Тип обкладинки')).toBe('coverType');
        expect(configuratorOptionKey('Кількість сторінок')).toBe('pageCount');
        expect(configuratorOptionKey('Кількість примірників')).toBe('copies');
        expect(configuratorOptionKey('Ламінація сторінок')).toBe('pageLamination');
    });

    it('не має власної думки про опції, якими конструктор не керує', () => {
        expect(configuratorOptionKey('Верстка тексту')).toBeNull();
        expect(configuratorOptionKey('Терміновість')).toBeNull();
        expect(configuratorOptionKey('Розмір')).toBeNull();
        expect(configuratorOptionKey(undefined)).toBeNull();
        expect(configuratorOptionKey('')).toBeNull();
    });

    it('перекладений напис не є ключем бази — жодною з пʼяти мов', () => {
        const dbNames: string[] = Object.values(CONFIGURATOR_OPTION_NAMES);
        const locales: Array<[string, Record<string, any>]> = [
            ['uk', uk], ['en', en], ['pl', pl], ['de', de], ['ro', ro],
        ];

        for (const [code, locale] of locales) {
            const c = locale['constructor'] as Record<string, string>;
            const labels = [c.page_count, c.cover_type, c.copies_count, c.page_lamination];

            for (const label of labels) {
                expect(typeof label, `${code}: переклад має існувати`).toBe('string');
                // Українською деякі написи дослівно збігаються з ключем бази
                // («Тип обкладинки»), і це нормально. Усе інше — просто текст на
                // екрані, і як ключ опції воно не розпізнається.
                if (!dbNames.includes(label)) {
                    expect(configuratorOptionKey(label), `${code}: «${label}»`).toBeNull();
                }
            }

            // Саме та пара, на якій усе трималося: «Сторінок» — напис, а не ключ.
            expect(c.page_count).not.toBe(CONFIGURATOR_OPTION_NAMES.pageCount);
            expect(configuratorOptionKey(c.page_count)).toBeNull();
        }
    });

    it('конструктори друку шукають опції під тими назвами, що лежать у базі', () => {
        // Реальні назви з products.options для photoprint-standard,
        // photoprint-nonstandard, photomagnets, poster, poster-star-map і
        // druk-na-polotni — «Розмір», а в polaroid-print — «Формат».
        expect(PRODUCT_OPTION_NAMES.size).toBe('Розмір');
        expect(PRODUCT_OPTION_NAMES.format).toBe('Формат');
        expect(PRODUCT_OPTION_NAMES.coating).toBe('Покриття');
        expect(PRODUCT_OPTION_NAMES.whiteBorder).toBe('Біла рамочка 3мм');

        // Саме тут ховалася друга половина тієї ж помилки: переклад
        // constructor.size — «Розмір книги», і жоден товар так не називає опцію.
        expect((uk as any).constructor.size).not.toBe(PRODUCT_OPTION_NAMES.size);
    });

    it('надбавка з картки товару збігається зі шкалою журналу', () => {
        // Список у конструкторі показує надбавку від базової ціни: «36 сторінок
        // (+950 ₴)» на базі 525 ₴. Тест тримає цю обіцянку чесною — сума має
        // дорівнювати тому, що порахує сама шкала.
        const base = getMagazinePrice(8, false);
        expect(base).toBe(525);
        expect(base + 950).toBe(getMagazinePrice(36, false));
        expect(base + 2625).toBe(getMagazinePrice(100, false));
    });
});
