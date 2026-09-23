import { describe, expect, it } from 'vitest';
import {
    CRM_STALE_HOURS,
    EMAIL_GRACE_HOURS,
    PRINT_GRACE_HOURS,
    LAYOUT_GRACE_HOURS,
    MAX_PER_PASS,
    bookLinesWithoutLayout,
    decideLostSignals,
    findLostOrderSignals,
    formatLostSignals,
    pruneSignalStore,
    signalKey,
    trackCrmCandidates,
    type BookPrintState,
    type LostSignal,
    type OrderRow,
} from '@/lib/alerts/lost-order-signals';

/**
 * Сторож тихих втрат.
 *
 * 17.09.2026 за один день знайшлося п'ять поломок, і всі мали одну спільну
 * рису: дані про кожну вже лежали в базі, і ніхто в них не дивився. Фото Юлії
 * Джулай гинули об стелю Vercel, її заявка приїхала без товару, через нуль
 * гривень не поїхала в CRM, листа їй не надіслав ніхто. Дізналися ми аж тоді,
 * коли вона через дві доби написала в дирекг сама.
 *
 * Кожну причину полагоджено окремо. Ці тести — про те, чи спіймаємо наступну.
 */

const HOUR = 3600_000;
const NOW = Date.parse('2026-09-17T12:00:00Z');
const ago = (hours: number) => new Date(NOW - hours * HOUR).toISOString();

const order = (o: Partial<OrderRow> = {}): OrderRow => ({
    id: o.id || 'id-1',
    order_number: o.order_number ?? 'TM-000001',
    created_at: o.created_at ?? ago(1),
    customer_email: o.customer_email ?? null,
    source: o.source ?? 'site',
    ...o,
});

/** Виріб замовлення в тому вигляді, у якому його бачать друкарські ознаки. */
const book = (b: Partial<BookPrintState> = {}): BookPrintState => ({
    // `??` тут не годиться: свідомо переданий null означає «макет не
    // впізнано», і зводити його до значення за умовчанням не можна.
    projectId: b.projectId === undefined ? 'proj-1' : b.projectId,
    cartItemId: b.cartItemId === undefined ? 'pb-1' : b.cartItemId,
    label: b.label ?? 'Travel Book',
    orderedSheets: b.orderedSheets ?? 0,
    files: b.files ?? [],
    forzatExtra: b.forzatExtra ?? null,
    paid: b.paid ?? { first: false, last: false },
});

const find = (
    orders: OrderRow[],
    opts: {
        emailed?: string[];
        queue?: Record<string, string>;
        books?: Record<string, BookPrintState[]>;
        printOnly?: string[];
    } = {},
) =>
    findLostOrderSignals({
        orders,
        emailedOrderIds: new Set(opts.emailed || []),
        crmCandidateSince: new Map(Object.entries(opts.queue || {})),
        booksByOrder: new Map(Object.entries(opts.books || {})),
        printOnlyOrderIds: new Set(opts.printOnly || []),
        now: NOW,
    });

describe('фото не доїхали', () => {
    it('ловить рівно випадок Юлії Джулай', () => {
        const got = find([order({
            order_number: 'TM-001320',
            custom_attributes: { photos_submitted: 21, photos_attached: 19 },
        })]);
        expect(got).toHaveLength(1);
        expect(got[0].kind).toBe('photos');
        expect(got[0].detail).toContain('19');
        expect(got[0].detail).toContain('21');
        expect(got[0].detail).toContain('бракує 2');
    });

    it('ловить і найгірший випадок — TM-001305, девʼять із двадцяти шести', () => {
        const got = find([order({ custom_attributes: { photos_submitted: 26, photos_attached: 9 } })]);
        expect(got[0].detail).toContain('бракує 17');
    });

    it('коли доїхали всі — мовчить', () => {
        expect(find([order({ custom_attributes: { photos_submitted: 14, photos_attached: 14 } })])).toEqual([]);
    });

    it('замовлення з інших потоків не мають цих чисел і не чіпаються', () => {
        expect(find([order({ custom_attributes: {} })])).toEqual([]);
        expect(find([order({ custom_attributes: null })])).toEqual([]);
    });
});

describe('заявка без товару', () => {
    it('нуль гривень разом із порожнім товаром — це сигнал', () => {
        const got = find([order({
            with_designer: true, total: 0,
            items: [{ product_slug: '', product_name: 'Замовлення з дизайнером', options: {} }],
        })]);
        expect(got.map(s => s.kind)).toContain('no_product');
    });

    it('нуль гривень сам по собі — не сигнал, якщо товар відомий', () => {
        // У заявці ціни ще й не мусить бути: її ставить менеджерка після розмови.
        const got = find([order({
            with_designer: true, total: 0,
            items: [{ product_slug: 'wish-book', options: { 'Розмір': '20x30' } }],
        })]);
        expect(got.map(s => s.kind)).not.toContain('no_product');
    });

    it('опції без slug теж рятують — категорія вже каже, про що йдеться', () => {
        const got = find([order({
            with_designer: true, total: 0,
            items: [{ product_slug: '', options: { 'Кількість сторінок': '24' } }],
        })]);
        expect(got.map(s => s.kind)).not.toContain('no_product');
    });

    it('звичайне замовлення без дизайнера сюди не потрапляє', () => {
        const got = find([order({ with_designer: false, total: 0, items: [{ product_slug: '' }] })]);
        expect(got.map(s => s.kind)).not.toContain('no_product');
    });
});

describe('жодного листа', () => {
    it('через три години без листа — сигнал', () => {
        const got = find([order({ customer_email: 'a@b.com', created_at: ago(EMAIL_GRACE_HOURS + 1) })]);
        expect(got.map(s => s.kind)).toContain('no_email');
    });

    it('свіже замовлення чекає — лист міг ще не піти', () => {
        const got = find([order({ customer_email: 'a@b.com', created_at: ago(1) })]);
        expect(got.map(s => s.kind)).not.toContain('no_email');
    });

    it('лист є — питань немає', () => {
        const got = find(
            [order({ id: 'x', customer_email: 'a@b.com', created_at: ago(10) })],
            { emailed: ['x'] },
        );
        expect(got.map(s => s.kind)).not.toContain('no_email');
    });

    it('без пошти писати нікуди, дзеркалена копія листів і не мусить мати', () => {
        expect(find([order({ customer_email: null, created_at: ago(10) })]).map(s => s.kind)).not.toContain('no_email');
        expect(find([order({ customer_email: 'a@b.com', source: 'keycrm', created_at: ago(10) })])
            .map(s => s.kind)).not.toContain('no_email');
    });
});

describe('висить у черзі на перенесення', () => {
    it('шість годин у черзі — це дванадцять невдалих спроб поспіль', () => {
        const got = find([order({ id: 'q' })], { queue: { q: ago(CRM_STALE_HOURS + 1) } });
        expect(got.map(s => s.kind)).toContain('not_in_crm');
    });

    it('щойно потрапило в чергу — це норма', () => {
        const got = find([order({ id: 'q' })], { queue: { q: ago(1) } });
        expect(got.map(s => s.kind)).not.toContain('not_in_crm');
    });
});

describe('черга кандидатів', () => {
    it('дата першої зустрічі не перезаписується — саме вона й міряє застрягання', () => {
        const before = { a: ago(5) };
        const next = trackCrmCandidates(before, ['a', 'b'], ago(0));
        expect(next.a).toBe(before.a);
        expect(next.b).toBe(ago(0));
    });

    it('зникле з черги забувається, інакше воно вічно виглядало б застряглим', () => {
        const next = trackCrmCandidates({ a: ago(9), b: ago(9) }, ['b'], ago(0));
        expect(next.a).toBeUndefined();
        expect(next.b).toBe(ago(9));
    });
});

describe('про що казати цього разу', () => {
    const sig = (kind: any, orderId: string): LostSignal =>
        ({ kind, orderId, orderNumber: 'TM-1', createdAt: ago(1), detail: 'детально' });

    it('кожна ознака кожного замовлення — рівно один раз', () => {
        const signals = [sig('photos', 'a'), sig('no_email', 'a')];
        const first = decideLostSignals(signals, {}, NOW);
        expect(first.fresh).toHaveLength(2);

        const second = decideLostSignals(signals, first.nextStore, NOW + HOUR);
        expect(second.fresh).toEqual([]);
    });

    it('нова ознака того самого замовлення — це нова новина', () => {
        const first = decideLostSignals([sig('photos', 'a')], {}, NOW);
        const second = decideLostSignals([sig('photos', 'a'), sig('no_email', 'a')], first.nextStore, NOW);
        expect(second.fresh.map(s => s.kind)).toEqual(['no_email']);
    });

    it('памʼять не росте вічно', () => {
        const old = { [signalKey({ kind: 'photos', orderId: 'a' })]: NOW - 40 * 24 * HOUR };
        const fresh = { [signalKey({ kind: 'photos', orderId: 'b' })]: NOW - HOUR };
        const kept = pruneSignalStore({ ...old, ...fresh }, NOW);
        expect(Object.keys(kept)).toEqual(['photos:b']);
    });
});

describe('повідомлення в чат', () => {
    const many = Array.from({ length: 8 }, (_, i): LostSignal => ({
        kind: 'photos', orderId: `id${i}`, orderNumber: `TM-00${i}`,
        createdAt: ago(1), detail: 'доїхало 1 фото з 2, бракує 1',
    }));

    it('одне повідомлення на прохід, а не вісім поспіль', () => {
        const text = formatLostSignals(many);
        expect(text.match(/Фото не доїхали/g) || []).toHaveLength(MAX_PER_PASS);
        expect(text).toContain(`Ще ${many.length - MAX_PER_PASS} таких`);
    });

    it('коли все вміщається — про решту не згадуємо', () => {
        expect(formatLostSignals(many.slice(0, 2))).not.toContain('Ще ');
    });

    it('номер замовлення видно одразу, без нього сигнал марний', () => {
        expect(formatLostSignals([many[0]])).toContain('TM-000');
    });
});

/**
 * Пʼята ознака: книга, за якою немає макета.
 *
 * Історія TM-001342. Клієнтка зібрала дві РІЗНІ тревелбуки в одному
 * конструкторі, жодного спільного фото між ними, і оплатила обидві одним
 * замовленням на 2052 ₴. До замовлення привʼязався один макет, і якби ніхто
 * не звірив картку руками, у друк поїхали б дві копії однієї книги, а другої
 * клієнтка не отримала б узагалі. Дізналися ми про це від менеджерки, а не
 * від жодної перевірки.
 *
 * Тридцятиденний прохід по живій базі, перш ніж це писати, дав чотири
 * замовлення, у яких макетів МЕНШЕ, ніж книг, і жодне з них не було поломкою:
 * два з дизайнером, одне з готовими файлами, одне з поясненням людини в
 * примітці. Тому звірка тут не по лічильнику, а по ідентифікатору рядка.
 */
describe('книга без макета', () => {
    const bookOrder = (extra: Partial<OrderRow> = {}): OrderRow => ({
        id: 'o-1342',
        order_number: 'TM-001342',
        created_at: ago(3),
        with_designer: false,
        total: 2052,
        customer_email: null,
        source: 'site',
        items: [
            { slug: 'travelbook-20x30', product_name: 'Travel Book', cart_item_id: 'pb-1' },
            { slug: 'travelbook-20x30', product_name: 'Travel Book', cart_item_id: 'pb-2' },
        ],
        ...extra,
    });

    const run = (order: OrderRow, known: string[]) => findLostOrderSignals({
        orders: [order],
        emailedOrderIds: new Set([order.id]),
        crmCandidateSince: new Map(),
        layoutCartIds: new Set(known),
        now: NOW,
    }).filter(s => s.kind === 'no_layout');

    it('ловить рядок, за яким макета немає', () => {
        const found = run(bookOrder(), ['pb-1']);
        expect(found).toHaveLength(1);
        expect(found[0].orderNumber).toBe('TM-001342');
        expect(found[0].detail).toContain('Travel Book');
    });

    it('мовчить, коли макет є за кожним рядком', () => {
        expect(run(bookOrder(), ['pb-1', 'pb-2'])).toHaveLength(0);
    });

    it('не чіпає заявки з дизайнером — макет там роблять пізніше', () => {
        expect(run(bookOrder({ with_designer: true }), [])).toHaveLength(0);
    });

    it('мовчить перші хвилини, поки оформлення ще пише макет', () => {
        const fresh = bookOrder({ created_at: ago(LAYOUT_GRACE_HOURS / 2) });
        expect(run(fresh, [])).toHaveLength(0);
    });

    it('не чіпає товарів, у яких макета з конструктора не буває', () => {
        const order = bookOrder({
            items: [{ slug: 'photomagnets', product_name: 'Магніти', cart_item_id: 'pm-1' }],
        });
        expect(run(order, [])).toHaveLength(0);
    });

    /**
     * Найдорожче тут — не пропустити поломку, а навчити не читати. Замовлення,
     * оформлені до того, як ключ рядка почали зберігати, звірити нічим.
     */
    it('мовчить на старих замовленнях без ідентифікатора рядка', () => {
        const legacy = bookOrder({
            items: [
                { slug: 'travelbook-20x30', product_name: 'Travel Book' },
                { slug: 'travelbook-20x30', product_name: 'Travel Book' },
            ],
        });
        expect(run(legacy, [])).toHaveLength(0);
    });
});

describe('bookLinesWithoutLayout', () => {
    it('повертає лише книги без макета', () => {
        const items = [
            { slug: 'photobook-printed', product_name: 'Фотокнига', cart_item_id: 'a' },
            { slug: 'photobook-printed', product_name: 'Фотокнига', cart_item_id: 'b' },
            { slug: 'photoprint-standard', product_name: 'Фотодрук', cart_item_id: 'c' },
        ];
        const out = bookLinesWithoutLayout(items, new Set(['a']));
        expect(out.map(o => o.cartItemId)).toEqual(['b']);
    });

    it('переживає сміття замість позицій', () => {
        expect(bookLinesWithoutLayout(null, new Set())).toEqual([]);
        expect(bookLinesWithoutLayout([null, 'x', 7], new Set())).toEqual([]);
    });
});


/**
 * Шоста ознака: оплачений форзац, якого немає у файлах.
 *
 * Сервіс рендеру навмисно НЕ вантажить порожній форзац — друкарня просила не
 * отримувати чистих аркушів. Правило добре доти, доки форзац нікому не
 * потрібен. Коли за нього заплатили, той самий пропуск стає тихою втратою: у
 * теці просто немає f1, а рядок про це лишається в консолі Railway.
 *
 * Прохід по живій базі за шістдесят днів (22.09.2026) дав два замовлення,
 * обидва вже в статусі confirmed: TM-001352 оплатило обидва форзаци й
 * отримало тільки f2, TM-001349 оплатило обидва й не отримало жодного. Два —
 * це ознака, а не шум.
 */
describe('друкарський набір: форзац і аркуші', () => {
    const paidOrder = (id: string, number: string): OrderRow => ({
        id,
        order_number: number,
        created_at: ago(PRINT_GRACE_HOURS + 1),
        customer_email: null,
        source: 'site',
        items: [{
            cart_item_id: 'pb-1',
            product_name: 'Глянцевий журнал',
            slug: 'personalized-glossy-magazine',
            options: { 'Друк на форзаці': 'Так (перший + останній)', 'Сторінок': '8 сторінок' },
        }],
    });
    const both = { first: true, last: true };

    it('TM-001352: є f2, немає f1 — сигнал', () => {
        const got = find([paidOrder('o-1352', 'TM-001352')], {
            books: { 'o-1352': [book({
                orderedSheets: 8, forzatExtra: true, paid: both,
                files: ['00_cover_front.jpg', '00_cover_back.jpg',
                    ...Array.from({ length: 8 }, (_, i) => `0${i + 1}.jpg`), 'f2.jpg'],
            })] },
        });
        const s = got.filter(x => x.kind === 'no_forzat');
        expect(s).toHaveLength(1);
        expect(s[0].detail).toContain('початковий');
        // Аркушів дев'ять проти восьми замовлених, тобто надлишок, а не нестача.
        expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
    });

    it('TM-001349: немає жодного форзаца — сигнал про обидва', () => {
        const got = find([paidOrder('o-1349', 'TM-001349')], {
            books: { 'o-1349': [book({
                orderedSheets: 8, forzatExtra: true, paid: both,
                files: ['cover.jpg', ...Array.from({ length: 8 }, (_, i) => `0${i + 1}.jpg`)],
            })] },
        });
        const s = got.filter(x => x.kind === 'no_forzat');
        expect(s).toHaveLength(1);
        expect(s[0].detail).toContain('обох');
    });

    /**
     * ХИБНА ТРИВОГА, ЯКУ СТОРОЖ СПРАВДІ ПІДНЯВ.
     *
     * 22.09.2026 у памʼяті сторожа зʼявився no_forzat на TM-001354, а там
     * чотири тревелбуки, у яких форзаци йдуть ПРОНУМЕРОВАНИМИ аркушами.
     * Окремих файлів f1 та f2 такий виріб не дає за будовою, і вимагати їх від
     * нього означало кричати на цілком справний набір.
     */
    it('форзац усередині нумерації не вимагає окремих файлів (TM-001354)', () => {
        const o = paidOrder('o-1354', 'TM-001354');
        (o.items as any)[0].slug = 'travelbook-20x30';
        (o.items as any)[0].options['Сторінок'] = '16 сторінок';
        const got = find([o], {
            books: { 'o-1354': [book({
                orderedSheets: 16, forzatExtra: false, paid: both,
                files: ['cover.jpg', ...Array.from({ length: 16 }, (_, i) => `${String(i + 1).padStart(2, '0')}.jpg`)],
            })] },
        });
        expect(got.filter(x => x.kind === 'no_forzat')).toHaveLength(0);
        expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
    });

    /**
     * Набори, старші за 11.08.2026, форзаців окремими файлами не мають за
     * визначенням: тоді рендер писав `NN_page.jpg` і форзаци йшли
     * пронумерованими разом зі сторінками. TM-001110 від 2 серпня і TM-001091
     * від 26 липня — саме такі, і вимагати від них f1 та f2 означало б
     * кричати на давно надруковане.
     */
    it('старе іменування NN_page не вимагає f1 та f2 (TM-001110, TM-001091)', () => {
        const o = paidOrder('o-legacy', 'TM-001110');
        (o.items as any)[0].slug = 'travelbook-20x30';
        (o.items as any)[0].options['Сторінок'] = '12 сторінок';
        const got = find([o], {
            books: { 'o-legacy': [book({
                orderedSheets: 12, forzatExtra: true, paid: both,
                files: ['00_cover.jpg', ...Array.from({ length: 14 }, (_, i) => `${String(i + 1).padStart(2, '0')}_page.jpg`)],
            })] },
        });
        expect(got.filter(x => x.kind === 'no_forzat')).toHaveLength(0);
    });

    it('макет не читали — про форзац мовчимо, а не вгадуємо', () => {
        const got = find([paidOrder('o-unknown', 'TM-000994')], {
            books: { 'o-unknown': [book({ orderedSheets: 8, forzatExtra: null, paid: both,
                files: ['cover.jpg', ...Array.from({ length: 8 }, (_, i) => `0${i + 1}.jpg`)] })] },
        });
        expect(got.filter(x => x.kind === 'no_forzat')).toHaveLength(0);
    });

    it('повний набір мовчить', () => {
        const got = find([paidOrder('o-ok', 'TM-000999')], {
            books: { 'o-ok': [book({
                orderedSheets: 8, forzatExtra: true, paid: both,
                files: ['cover.jpg', 'f1.jpg', ...Array.from({ length: 8 }, (_, i) => `0${i + 1}.jpg`), 'f2.jpg'],
            })] },
        });
        expect(got.filter(x => x.kind === 'no_forzat')).toHaveLength(0);
        expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
    });

    it('неоплачений форзац не вимагається', () => {
        const o = paidOrder('o-free', 'TM-000998');
        (o.items as any)[0].options = { 'Друк на форзаці': 'Без друку', 'Сторінок': '8 сторінок' };
        const got = find([o], {
            books: { 'o-free': [book({ orderedSheets: 8, forzatExtra: true,
                files: ['cover.jpg', ...Array.from({ length: 8 }, (_, i) => `0${i + 1}.jpg`)] })] },
        });
        expect(got.filter(x => x.kind === 'no_forzat')).toHaveLength(0);
    });

    it('поки експортів немає взагалі, це ознака no_layout, а не ця', () => {
        const got = find([paidOrder('o-none', 'TM-000997')], {
            books: { 'o-none': [book({ orderedSheets: 8, forzatExtra: true, paid: both, files: [] })] },
        });
        expect(got.filter(x => x.kind === 'no_forzat')).toHaveLength(0);
        expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
    });

    it('свіже замовлення чекає, поки рендер добіжить', () => {
        const o = paidOrder('o-fresh', 'TM-000996');
        o.created_at = ago(PRINT_GRACE_HOURS - 1);
        const got = find([o], {
            books: { 'o-fresh': [book({ orderedSheets: 8, forzatExtra: true, paid: both,
                files: ['cover.jpg', '01.jpg'] })] },
        });
        expect(got.filter(x => x.kind === 'no_forzat')).toHaveLength(0);
        expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
    });

    it('дві книги без форзаців дають ОДНУ скаргу, що називає обидві', () => {
        const o = paidOrder('o-two', 'TM-000995');
        (o.items as any).push({
            cart_item_id: 'pb-2',
            product_name: 'Ще один журнал',
            slug: 'personalized-glossy-magazine',
            options: { 'Друк на форзаці': 'Так (перший + останній)', 'Сторінок': '8 сторінок' },
        });
        const files = ['cover.jpg', ...Array.from({ length: 8 }, (_, i) => `0${i + 1}.jpg`)];
        const got = find([o], {
            books: { 'o-two': [
                book({ cartItemId: 'pb-1', label: 'Перша', orderedSheets: 8, forzatExtra: true, paid: both, files }),
                book({ cartItemId: 'pb-2', label: 'Друга', orderedSheets: 8, forzatExtra: true, paid: both, files }),
            ] },
        });
        const s = got.filter(x => x.kind === 'no_forzat');
        expect(s).toHaveLength(1);
        expect(s[0].detail).toContain('Перша');
        expect(s[0].detail).toContain('Друга');
    });

    /**
     * НЕПОВНИЙ НАБІР ДЛЯ ДРУКУ.
     *
     * Рендер іде розворотами, і розворот, який упав, пропускається цілком —
     * разом з обома сторінками. Помилки немає ніде: у теці просто менше
     * файлів. TM-001244 поїхало б без аркушів 01, 04, 05 і без початкового
     * форзаца, TM-001354 — трьома книгами з чотирьох.
     */
    describe('менше аркушів, ніж замовлено', () => {
        const plain = (id: string, number: string, lines: number): OrderRow => ({
            id,
            order_number: number,
            created_at: ago(PRINT_GRACE_HOURS + 1),
            customer_email: null,
            source: 'site',
            items: Array.from({ length: lines }, (_, i) => ({
                cart_item_id: `pb-${i + 1}`,
                product_name: `Travel Book ${i + 1}`,
                slug: 'travelbook-20x30',
                options: { 'Сторінок': '12 сторінок' },
            })),
        });

        it('TM-001244: девʼять аркушів плюс f2 замість дванадцяти', () => {
            const got = find([plain('o-1244', 'TM-001244', 1)], {
                books: { 'o-1244': [book({
                    orderedSheets: 12, forzatExtra: true, paid: { first: true, last: true },
                    files: ['cover.jpg', '02.jpg', '03.jpg', '06.jpg', '07.jpg', '08.jpg',
                        '09.jpg', '10.jpg', '11.jpg', '12.jpg', 'f2.jpg'],
                })] },
            });
            const s = got.filter(x => x.kind === 'short_print');
            expect(s).toHaveLength(1);
            expect(s[0].detail).toContain('10 аркушів');
            expect(s[0].detail).toContain('мало бути 12');
        });

        it('TM-001354: одна скарга називає всі три неповні книги', () => {
            const o = plain('o-1354b', 'TM-001354', 4);
            const full = (n: number) => Array.from({ length: n }, (_, i) => `${String(i + 1).padStart(2, '0')}.jpg`);
            const got = find([o], {
                books: { 'o-1354b': [
                    book({ cartItemId: 'pb-1', label: 'Книга 1', orderedSheets: 12, files: ['cover.jpg', ...full(12)] }),
                    book({ cartItemId: 'pb-2', label: 'Книга 2', orderedSheets: 12, files: ['cover.jpg'] }),
                    book({ cartItemId: 'pb-3', label: 'Книга 3', orderedSheets: 12, files: ['cover.jpg', ...full(4)] }),
                    book({ cartItemId: 'pb-4', label: 'Книга 4', orderedSheets: 12, files: ['cover.jpg', ...full(10)] }),
                ] },
            });
            const s = got.filter(x => x.kind === 'short_print');
            expect(s).toHaveLength(1);
            expect(s[0].detail).toContain('3 виробах');
            expect(s[0].detail).toContain('Книга 2');
            expect(s[0].detail).toContain('Книга 4');
            expect(s[0].detail).not.toContain('Книга 1');
        });

        it('НАДЛИШОК мовчить: старий рендер нумерував форзаци разом зі сторінками', () => {
            // TM-001110 і TM-001108: замовлено дванадцять, у теці чотирнадцять
            // аркушів, бо обидва форзаци пішли пронумерованими. Це видно очима
            // і це не тиха втрата.
            const got = find([plain('o-1110', 'TM-001110', 1)], {
                books: { 'o-1110': [book({
                    orderedSheets: 12,
                    files: ['00_cover.jpg', ...Array.from({ length: 14 }, (_, i) => `${String(i + 1).padStart(2, '0')}_page.jpg`)],
                })] },
            });
            expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
        });

        /**
         * ФОТОКНИГА ЕКСПОРТУЄТЬСЯ РОЗВОРОТАМИ, А НЕ СТОРІНКАМИ.
         *
         * Порівняння файлів із кількістю сторінок оголошувало б неповним
         * кожен справний фотокнижковий набір: 23.09.2026 таких було шість із
         * двадцяти шести — TM-001331, TM-001321, TM-001293, TM-001288,
         * TM-001262 і TM-001254, усі з рівно половиною файлів.
         */
        it('розворотний набір рахується розворотами (TM-001331)', () => {
            const o = plain('o-1331', 'TM-001331', 1);
            (o.items as any)[0].slug = 'photobook-printed';
            (o.items as any)[0].options = { 'Сторінок': '24 сторінок' };
            const got = find([o], {
                books: { 'o-1331': [book({
                    orderedSheets: 24,
                    files: ['00_cover.jpg', ...Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, '0')}_spread.jpg`)],
                })] },
            });
            expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
        });

        it('розворотами бракує половини — сигнал', () => {
            const o = plain('o-half', 'TM-000992', 1);
            (o.items as any)[0].options = { 'Сторінок': '24 сторінок' };
            const got = find([o], {
                books: { 'o-half': [book({
                    orderedSheets: 24,
                    files: ['00_cover.jpg', ...Array.from({ length: 5 }, (_, i) => `${String(i + 1).padStart(2, '0')}_spread.jpg`)],
                })] },
            });
            const s = got.filter(x => x.kind === 'short_print');
            expect(s).toHaveLength(1);
            expect(s[0].detail).toContain('мало бути 12');
        });

        /**
         * Вставка на обкладинку не є аркушем книги. На TM-001094 файл
         * `akryl_1.jpg` робив із вісімнадцяти розворотів девʼятнадцять.
         */
        it('вставка на обкладинку не рахується аркушем', () => {
            const o = plain('o-1094', 'TM-001094', 1);
            (o.items as any)[0].options = { 'Сторінок': '36 сторінок' };
            const got = find([o], {
                books: { 'o-1094': [book({
                    orderedSheets: 36,
                    files: ['00_cover.jpg', 'akryl_1.jpg',
                        ...Array.from({ length: 18 }, (_, i) => `${String(i + 1).padStart(2, '0')}_spread.jpg`)],
                })] },
            });
            expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
        });

        /**
         * Коли макет виробу не впізнано, файлів у нього нуль не тому, що вони
         * зникли, а тому, що ми не змогли їх зіставити. На TM-001342 рядки
         * кошика не несуть ключа, і нуль аркушів замість двадцяти був би
         * наклепом на справний набір.
         */
        it('не впізнали макет — мовчимо, а не рахуємо нуль (TM-001342)', () => {
            const got = find([plain('o-1342', 'TM-001342', 2)], {
                books: { 'o-1342': [
                    book({ projectId: null, cartItemId: null, label: 'Книга 1', orderedSheets: 20, files: [] }),
                    book({ projectId: null, cartItemId: null, label: 'Книга 2', orderedSheets: 20,
                        files: ['cover.jpg', '01.jpg'] }),
                ] },
            });
            expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
        });

        it('без кількості сторінок у рядку кошика ознака мовчить', () => {
            const o = plain('o-nopages', 'TM-000993', 1);
            (o.items as any)[0].options = {};
            const got = find([o], {
                books: { 'o-nopages': [book({ orderedSheets: 0, files: ['cover.jpg', '01.jpg'] })] },
            });
            expect(got.filter(x => x.kind === 'short_print')).toHaveLength(0);
        });
    });

    /**
     * ЗАМОВЛЕННЯ ПОЗА ВІКНОМ, ЯКЕ ЩЕ ЧЕКАЄ ДРУКУ.
     *
     * TM-001244 стоїть неповним із 28 серпня, TM-001091 з 26 липня. Вікно на
     * добу з гаком їх не бачить, а друкувати їх іще будуть — тож друкарські
     * ознаки для них лишаються, а часові вимикаються: скарга на лист, якого не
     * надіслали в липні, вже нікому не допоможе.
     */
    describe('поза вікном, але ще не в друці', () => {
        const old = (id: string): OrderRow => ({
            id,
            order_number: 'TM-001244',
            created_at: ago(24 * 26),
            customer_email: 'someone@example.com',
            source: 'site',
            items: [{
                cart_item_id: 'pb-1',
                product_name: 'Travel Book',
                slug: 'travelbook-20x30',
                options: { 'Сторінок': '12 сторінок', 'Друк на форзаці': 'Так (перший + останній)' },
            }],
            custom_attributes: { photos_submitted: 20, photos_attached: 18 },
        });
        const books = { 'o-old': [book({
            orderedSheets: 12, forzatExtra: true, paid: { first: true, last: true },
            files: ['cover.jpg', '02.jpg', '03.jpg', 'f2.jpg'],
        })] };

        it('друкарські ознаки працюють', () => {
            const got = find([old('o-old')], { books, printOnly: ['o-old'] });
            expect(got.filter(x => x.kind === 'short_print')).toHaveLength(1);
            expect(got.filter(x => x.kind === 'no_forzat')).toHaveLength(1);
        });

        it('часові ознаки мовчать', () => {
            const got = find([old('o-old')], { books, printOnly: ['o-old'] });
            expect(got.filter(x => x.kind === 'no_email')).toHaveLength(0);
            expect(got.filter(x => x.kind === 'photos')).toHaveLength(0);
            expect(got.filter(x => x.kind === 'no_layout')).toHaveLength(0);
        });

        it('те саме замовлення У ВІКНІ отримує всі ознаки', () => {
            const got = find([old('o-old')], { books });
            expect(got.filter(x => x.kind === 'photos')).toHaveLength(1);
            expect(got.filter(x => x.kind === 'no_email')).toHaveLength(1);
        });
    });
});
