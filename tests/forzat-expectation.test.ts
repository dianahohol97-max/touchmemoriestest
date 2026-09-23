import { describe, it, expect } from 'vitest';
import {
    FORZAT_OPTION,
    NO_FORZAT,
    forzatShortfallLine,
    isForzatPaid,
    missingForzatFiles,
    paidForzatSides,
    resolveEndpaperPaid,
    pageHasPrintableContent,
    forzatPageIndexes,
    blankPaidForzats,
    blankForzatLine,
} from '@/lib/print/forzat-expectation';

/**
 * Значення опції приходить трьома різними словниками, і кожен новий спосіб її
 * записати мовчки вимкнув би перевірку. Рядки нижче — не вигадані: усі взяті з
 * замовлень у базі або зі словника lib/orders/item-options.ts.
 */

describe('чи оплачено друк на форзаці', () => {
    it('конструктор пише сторони прямо', () => {
        expect(isForzatPaid('Так (перший + останній)')).toBe(true);
        expect(isForzatPaid('Так (перший)')).toBe(true);
    });

    it('сторінка товару пише словником', () => {
        expect(isForzatPaid('with')).toBe(true);
        expect(isForzatPaid('З друком')).toBe(true);
        expect(isForzatPaid('yes')).toBe(true);
    });

    it('відмова читається як відмова, у будь-якому написанні', () => {
        expect(isForzatPaid('none')).toBe(false);
        expect(isForzatPaid('Без друку')).toBe(false);
        expect(isForzatPaid('без друку')).toBe(false);
    });

    it('порожнеча — це не оплата', () => {
        expect(isForzatPaid('')).toBe(false);
        expect(isForzatPaid(null)).toBe(false);
        expect(isForzatPaid(undefined)).toBe(false);
    });
});

describe('які сторони оплачено', () => {
    it('TM-001352: обидві, названі прямо', () => {
        expect(paidForzatSides({ [FORZAT_OPTION]: 'Так (перший + останній)' }))
            .toEqual({ first: true, last: true });
    });

    it('названа одна сторона — оплачена одна', () => {
        expect(paidForzatSides({ [FORZAT_OPTION]: 'Так (перший)' })).toEqual({ first: true, last: false });
        expect(paidForzatSides({ [FORZAT_OPTION]: 'Так (останній)' })).toEqual({ first: false, last: true });
    });

    it('«З друком» без сторін — це фіксована доплата за обидва', () => {
        expect(paidForzatSides({ [FORZAT_OPTION]: 'З друком' })).toEqual({ first: true, last: true });
        expect(paidForzatSides({ [FORZAT_OPTION]: 'with' })).toEqual({ first: true, last: true });
    });

    it('без опції і без оплати сторін немає', () => {
        expect(paidForzatSides({ 'Сторінок': '8 сторінок' })).toEqual(NO_FORZAT);
        expect(paidForzatSides({ [FORZAT_OPTION]: 'Без друку' })).toEqual(NO_FORZAT);
        expect(paidForzatSides(null)).toEqual(NO_FORZAT);
        expect(paidForzatSides('щось не те')).toEqual(NO_FORZAT);
    });
});

describe('чого бракує в наборі', () => {
    const both = { first: true, last: true };

    it('TM-001352: оплачено обидва, є тільки f2', () => {
        const files = ['00_cover_front.jpg', '00_cover_back.jpg', '01.jpg', '08.jpg', 'f2.jpg'];
        expect(missingForzatFiles(both, files)).toEqual(['f1']);
    });

    it('TM-001349: оплачено обидва, немає жодного', () => {
        const files = ['cover.jpg', '01.jpg', '02.jpg', '20.jpg'];
        expect(missingForzatFiles(both, files)).toEqual(['f1', 'f2']);
    });

    it('повний набір не дає жодної скарги', () => {
        expect(missingForzatFiles(both, ['f1.jpg', 'f2.jpg', '01.jpg'])).toEqual([]);
    });

    it('неоплачений форзац не вимагають', () => {
        expect(missingForzatFiles(NO_FORZAT, ['01.jpg', '02.jpg'])).toEqual([]);
        expect(missingForzatFiles({ first: false, last: true }, ['f2.jpg'])).toEqual([]);
    });

    it('регістр імені файлу нічого не вирішує', () => {
        expect(missingForzatFiles(both, ['F1.JPG', 'F2.jpg'])).toEqual([]);
    });

    it('цифра в назві сторінки не вдає із себе форзац', () => {
        // «01.jpg» не має жодного стосунку до f1, і сплутати їх означало б
        // мовчати саме там, де форзаца немає.
        expect(missingForzatFiles(both, ['01.jpg', '02.jpg'])).toEqual(['f1', 'f2']);
    });
});

describe('речення для людини', () => {
    it('одна сторона названа своїм ім’ям', () => {
        expect(forzatShortfallLine(['f1'])).toContain('початковий');
        expect(forzatShortfallLine(['f2'])).toContain('кінцевий');
    });

    it('обидві читаються як обидві', () => {
        expect(forzatShortfallLine(['f1', 'f2'])).toContain('обох');
    });

    it('коли все на місці, казати нічого', () => {
        expect(forzatShortfallLine([])).toBe('');
    });
});


/**
 * Звідки конструктор дізнається про оплачений форзац при повторному відкритті.
 *
 * Поле `endpaperPaid` зʼявилося 22.09.2026 і є тільки в НОВИХ збереженнях, а
 * форзац оплачений у десятках старих макетів. Прохід по живій базі того ж дня:
 * із 62 макетів на замовленнях з оплаченим форзацом рядок кошика має 52, тобто
 * 16 замовлень із 20. Решта шість несуть тонку позначку `{ id }` без опцій.
 *
 * Порядок джерел тут не косметика, і перевернути його коштує в обидва боки:
 * рядок кошика, поставлений вище за збережене, мовчки розблокував би форзац,
 * який людина свідомо лишила замкненим, а збережене, яке не вміє бути
 * порожнім, лишило б замкненим оплачене — і видалення розвороту стерло б із
 * нього фото як із неоплаченого.
 */
describe('звідки береться оплата форзаца при відкритті', () => {
    const BOTH = { 'Друк на форзаці': 'Так (перший + останній)' };

    it('збережене в макеті сильніше за рядок кошика', () => {
        // Людина розблокувала лише початковий, хоча заплатила за обидва.
        expect(resolveEndpaperPaid({ first: true, last: false }, BOTH))
            .toEqual({ first: true, last: false });
    });

    it('збережене «обидва замкнені» НЕ перебивається кошиком', () => {
        // Свідомо замкнений форзац лишається замкненим: інакше рядок кошика
        // повертав би розблокування, яке людина зняла.
        expect(resolveEndpaperPaid({ first: false, last: false }, BOTH))
            .toEqual({ first: false, last: false });
    });

    it('старий макет без поля бере оплату з рядка кошика', () => {
        expect(resolveEndpaperPaid(undefined, BOTH)).toEqual({ first: true, last: true });
        expect(resolveEndpaperPaid(null, { 'Друк на форзаці': 'Так (останній)' }))
            .toEqual({ first: false, last: true });
    });

    it('без оплати не каже нічого — конструктор лишається на своєму enableEndpaper', () => {
        expect(resolveEndpaperPaid(undefined, { 'Друк на форзаці': 'Без друку' })).toBe(null);
        expect(resolveEndpaperPaid(undefined, {})).toBe(null);
        expect(resolveEndpaperPaid(undefined, undefined)).toBe(null);
    });

    it('тонка позначка кошика без опцій — це теж «нічого», а не відмова', () => {
        // Саме такий cart_payload у шести замовлень: { id } без options.
        expect(resolveEndpaperPaid(undefined, undefined)).toBe(null);
    });

    it('зіпсоване збережене поле не валить відкриття', () => {
        expect(resolveEndpaperPaid('так', BOTH)).toEqual({ first: true, last: true });
        expect(resolveEndpaperPaid({}, BOTH)).toEqual({ first: false, last: false });
    });
});

/**
 * СПІЛЬНИЙ ПЕРЕЛІК ВИПАДКІВ ДЛЯ ДВОХ КОПІЙ ОДНІЄЇ ПЕРЕВІРКИ.
 *
 * `pageHasPrintableContent` тут і `pageHasContent` у render-service/server.ts —
 * це одна перевірка у двох файлах. Об'єднати їх неможливо: render-service
 * збирається окремим Docker-образом, у який Dockerfile кладе рівно `tsconfig.json`
 * і `server.ts`, тож імпортувати `lib/` звідти фізично нічим. Єдине, що тримає
 * копії разом, — цей перелік. Правлячи одну копію, правте другу і додавайте
 * сюди випадок.
 */
const PAGE_WITH_PHOTO = { slots: [{ photoId: 'p1' }], textBlocks: [] };
const PAGE_EMPTY = { slots: [{ photoId: null }], textBlocks: [] };

describe('що вважається вмістом сторінки', () => {
    it('фото у слоті — це вміст', () => {
        expect(pageHasPrintableContent([{}, PAGE_WITH_PHOTO], {}, 1)).toBe(true);
    });

    it('текст із символами — це вміст', () => {
        const page = { slots: [], textBlocks: [{ text: 'З любов’ю' }] };
        expect(pageHasPrintableContent([{}, page], {}, 1)).toBe(true);
    });

    it('ПОРОЖНІЙ текстовий блок вмістом НЕ є', () => {
        // Саме через це форзац TM-001352 міг поїхати в друк чистим аркушем:
        // блок існує, отже сторінка «має вміст», а на папері немає нічого.
        const page = { slots: [], textBlocks: [{ text: '' }] };
        expect(pageHasPrintableContent([{}, page], {}, 1)).toBe(false);
    });

    it('блок із самих пробілів і переносів вмістом НЕ є', () => {
        const page = { slots: [], textBlocks: [{ text: '   \n\t  ' }] };
        expect(pageHasPrintableContent([{}, page], {}, 1)).toBe(false);
    });

    it('блок без поля text вмістом НЕ є', () => {
        const page = { slots: [], textBlocks: [{}, { text: null }] };
        expect(pageHasPrintableContent([{}, page], {}, 1)).toBe(false);
    });

    it('один непорожній блок серед порожніх рятує сторінку', () => {
        const page = { slots: [], textBlocks: [{ text: ' ' }, { text: 'Ера кайфу' }] };
        expect(pageHasPrintableContent([{}, page], {}, 1)).toBe(true);
    });

    it('наліпки, фігури, QR, вільні слоти і заливка лишаються вмістом', () => {
        expect(pageHasPrintableContent([{}, PAGE_EMPTY], { freeSlots: { 1: [{ id: 'a' }] } }, 1)).toBe(true);
        expect(pageHasPrintableContent([{}, PAGE_EMPTY], { pageStickers: { 1: [{ id: 'a' }] } }, 1)).toBe(true);
        expect(pageHasPrintableContent([{}, PAGE_EMPTY], { pageShapes: { 1: [{ id: 'a' }] } }, 1)).toBe(true);
        expect(pageHasPrintableContent([{}, PAGE_EMPTY], { qrOverlays: { 1: [{ id: 'a' }] } }, 1)).toBe(true);
        // Кольоровий форзац замовляють свідомо — це вміст, а не порожнеча.
        expect(pageHasPrintableContent([{}, PAGE_EMPTY], { pageBgs: { 1: '#f0e6d2' } }, 1)).toBe(true);
    });

    it('сторінки, якої немає, вмістом теж немає', () => {
        expect(pageHasPrintableContent([{}, PAGE_WITH_PHOTO], {}, 7)).toBe(false);
        expect(pageHasPrintableContent(null, null, 1)).toBe(false);
    });
});

describe('де саме лежать форзаци', () => {
    // Тревелбуки і журнали несуть ДВІ зайві змістові сторінки під форзаци.
    const cfg = (n: number) => ({ selectedPageCount: `${n} сторінок` });
    const pages = (contentCount: number) => Array.from({ length: contentCount + 1 }, () => ({}));

    it('знаходить першу і останню змістову', () => {
        // Замовлено 8, у макеті 10 змістових → форзаци це 1 і 10.
        expect(forzatPageIndexes('personalized-glossy-magazine', pages(10), cfg(8)))
            .toEqual({ first: 1, last: 10 });
    });

    it('мовчить, коли зайвих сторінок немає', () => {
        expect(forzatPageIndexes('personalized-glossy-magazine', pages(8), cfg(8))).toBeNull();
    });

    it('мовчить для виробів без посторінкового друку', () => {
        // Фотокнига друкується розворотами і форзацних сторінок не має.
        expect(forzatPageIndexes('photobook', pages(10), cfg(8))).toBeNull();
    });

    it('мовчить, коли кількість замовлених сторінок невідома', () => {
        expect(forzatPageIndexes('travelbook', pages(10), {})).toBeNull();
        expect(forzatPageIndexes('travelbook', pages(10), null)).toBeNull();
    });
});

describe('оплачений форзац, на якому нічого немає', () => {
    const both = { first: true, last: true };
    const cfg = { selectedPageCount: '8 сторінок' };
    /** Макет на 10 змістових сторінок: 1 і 10 — форзаци. */
    const layout = (first: any, last: any) => {
        const arr: any[] = Array.from({ length: 11 }, () => ({ slots: [], textBlocks: [] }));
        arr[1] = first;
        arr[10] = last;
        return arr;
    };

    it('ловить форзац із самим лише порожнім блоком', () => {
        const pages = layout({ slots: [], textBlocks: [{ text: '  ' }] }, PAGE_WITH_PHOTO);
        expect(blankPaidForzats(both, 'personalized-glossy-magazine', pages, {}, cfg)).toEqual(['f1']);
    });

    it('ловить TM-001352: голий перший форзац при заповненому останньому', () => {
        const pages = layout({ slots: [], textBlocks: [] }, PAGE_WITH_PHOTO);
        expect(blankPaidForzats(both, 'personalized-glossy-magazine', pages, {}, cfg)).toEqual(['f1']);
    });

    it('ловить TM-001349: заливка на першому, порожнеча на останньому', () => {
        const pages = layout({ slots: [], textBlocks: [] }, { slots: [], textBlocks: [] });
        const overlays = { pageBgs: { 1: '#f0e6d2' } };
        expect(blankPaidForzats(both, 'travelbook', pages, overlays, cfg)).toEqual(['f2']);
    });

    it('мовчить, коли на обох форзацах є фото', () => {
        const pages = layout(PAGE_WITH_PHOTO, PAGE_WITH_PHOTO);
        expect(blankPaidForzats(both, 'travelbook', pages, {}, cfg)).toEqual([]);
    });

    it('не чіпає неоплачений форзац', () => {
        const pages = layout({ slots: [], textBlocks: [] }, { slots: [], textBlocks: [] });
        expect(blankPaidForzats(NO_FORZAT, 'travelbook', pages, {}, cfg)).toEqual([]);
        expect(blankPaidForzats({ first: true, last: false }, 'travelbook', pages, {}, cfg)).toEqual(['f1']);
    });

    it('мовчить там, де форзацних сторінок узагалі немає', () => {
        expect(blankPaidForzats(both, 'photobook', layout(PAGE_EMPTY, PAGE_EMPTY), {}, cfg)).toEqual([]);
    });

    it('каже по-людськи, чого бракує', () => {
        expect(blankForzatLine(['f1'])).toContain('початковому');
        expect(blankForzatLine(['f1', 'f2'])).toContain('обох');
        expect(blankForzatLine([])).toBe('');
    });
});
