import { describe, expect, it } from 'vitest';
import {
    CRM_STALE_HOURS,
    EMAIL_GRACE_HOURS,
    LAYOUT_GRACE_HOURS,
    MAX_PER_PASS,
    bookLinesWithoutLayout,
    decideLostSignals,
    findLostOrderSignals,
    formatLostSignals,
    pruneSignalStore,
    signalKey,
    trackCrmCandidates,
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

const find = (orders: OrderRow[], opts: { emailed?: string[]; queue?: Record<string, string> } = {}) =>
    findLostOrderSignals({
        orders,
        emailedOrderIds: new Set(opts.emailed || []),
        crmCandidateSince: new Map(Object.entries(opts.queue || {})),
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
