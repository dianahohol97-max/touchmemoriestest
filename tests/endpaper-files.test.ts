import { describe, expect, it } from 'vitest';
import {
    checkEndpapers,
    endpaperIndexes,
    itemForProject,
    pageHasContent,
    paidEndpapers,
} from '@/lib/print/endpaper-files';

/**
 * Форзац — єдиний аркуш, якого в комплекті може законно не бути, тож саме тут
 * «пропущено навмисне» і «загублено» виглядають однаково. Числа в тестах узяті
 * з живих замовлень: TM-001352 (журнал на 8 сторінок, куплений друк на обох
 * форзацах, перший порожній) і TM-001342 (тревелбук на 20 сторінок, форзаци
 * порожні обидва і не оплачені).
 */

/** Макет журналу TM-001352: обкладинка + 10 фізичних сторінок. */
const magazine = (opts: { firstFilled?: boolean; lastFilled?: boolean } = {}) => {
    const empty = () => ({ slots: [{ photoId: null }], textBlocks: [] });
    const filled = () => ({ slots: [{ photoId: 'p1' }], textBlocks: [{ text: 'Крит' }] });
    const pages: any[] = [empty()]; // [0] — обкладинка
    pages.push(opts.firstFilled ? filled() : empty());          // форзац 1
    for (let i = 0; i < 8; i++) pages.push(filled());           // оплачені 8
    pages.push(opts.lastFilled ? filled() : empty());           // форзац 2
    return {
        id: 'df15edd7',
        product_type: 'magazine',
        pages_data: pages,
        overlays_data: { config: { productSlug: 'personalized-glossy-magazine', selectedPageCount: '8 сторінок' } },
        cart_payload: { id: 'pb-1790003355038-qgf40v' },
    };
};

const paidBothItem = {
    cart_item_id: 'pb-1790003355038-qgf40v',
    slug: 'personalized-glossy-magazine',
    options: { 'Сторінок': '8 сторінок', 'Друк на форзаці': 'Так (перший + останній)' },
};

describe('paidEndpapers', () => {
    it('читає обидві сторони', () => {
        expect(paidEndpapers(paidBothItem)).toEqual({ first: true, last: true });
    });

    it('читає одну сторону', () => {
        expect(paidEndpapers({ options: { 'Друк на форзаці': 'Так (останній)' } })).toEqual({ first: false, last: true });
        expect(paidEndpapers({ options: { 'Друк на форзаці': 'Так (перший)' } })).toEqual({ first: true, last: false });
    });

    it('голе «Так» без сторін читається як обидві — так писав старий конструктор', () => {
        expect(paidEndpapers({ options: { 'Друк на форзаці': 'Так' } })).toEqual({ first: true, last: true });
    });

    it('«Ні» і відсутня опція — не оплачено', () => {
        expect(paidEndpapers({ options: { 'Друк на форзаці': 'Ні' } })).toEqual({ first: false, last: false });
        expect(paidEndpapers({ options: { 'Сторінок': '8 сторінок' } })).toEqual({ first: false, last: false });
        expect(paidEndpapers(null)).toEqual({ first: false, last: false });
    });
});

describe('endpaperIndexes', () => {
    it('форма «оплачено + 2» дає перший і останній аркуш', () => {
        expect(endpaperIndexes(magazine())).toEqual({ first: 1, last: 10 });
    });

    it('макет без двох зайвих аркушів форзаців окремо не несе', () => {
        const p = magazine();
        p.pages_data = p.pages_data.slice(0, 9); // 8 сторінок разом із форзацами
        expect(endpaperIndexes(p)).toBeNull();
    });

    it('фотокнига форзаців окремими аркушами не має', () => {
        const p: any = magazine();
        p.product_type = 'photobook';
        p.overlays_data.config.productSlug = 'photobook-20x20';
        expect(endpaperIndexes(p)).toBeNull();
    });
});

describe('pageHasContent', () => {
    it('порожній форзац TM-001352 — жодного шару', () => {
        expect(pageHasContent(magazine(), 1)).toBe(false);
    });

    it('сам лише фон робить сторінку непорожньою', () => {
        const p: any = magazine();
        p.overlays_data.pageBgs = { '1': '#f5e6d3' };
        expect(pageHasContent(p, 1)).toBe(true);
    });

    it('наліпка без фото теж рахується', () => {
        const p: any = magazine();
        p.overlays_data.pageStickers = { '1': [{ id: 's1' }] };
        expect(pageHasContent(p, 1)).toBe(true);
    });
});

describe('checkEndpapers', () => {
    it('TM-001352: оплачено обидва, перший порожній — це сказано прямо', () => {
        const verdict = checkEndpapers(magazine({ lastFilled: true }), paidBothItem, ['01.jpg', '08.jpg', 'f2.jpg']);
        expect(verdict.skipped).toBe(1);
        expect(verdict.problems).toHaveLength(1);
        expect(verdict.problems[0]).toContain('перший форзац');
        expect(verdict.problems[0]).toContain('f1.jpg');
        // Перегенерація тут не лікує, і попередження мусить це казати.
        expect(verdict.problems[0]).toContain('не допоможе');
    });

    it('форзац із вмістом, але без файлу — це вже втрата рендеру', () => {
        const verdict = checkEndpapers(magazine({ firstFilled: true, lastFilled: true }), paidBothItem, ['01.jpg', 'f2.jpg']);
        expect(verdict.skipped).toBe(0);
        expect(verdict.problems).toHaveLength(1);
        expect(verdict.problems[0]).toContain('рендер його не віддав');
    });

    it('обидва форзаци заповнені й віддані — мовчить', () => {
        const verdict = checkEndpapers(magazine({ firstFilled: true, lastFilled: true }), paidBothItem, ['f1.jpg', '01.jpg', 'f2.jpg']);
        expect(verdict).toEqual({ skipped: 0, problems: [] });
    });

    it('TM-001342: форзаци порожні й не оплачені — жодної тривоги, лише два пропущені аркуші', () => {
        const travelbook: any = {
            id: '7b2d5f50',
            product_type: 'travelbook',
            pages_data: magazine().pages_data,
            overlays_data: { config: { productSlug: 'travelbook-20x30', selectedPageCount: '8 сторінок' } },
        };
        const verdict = checkEndpapers(travelbook, { options: { 'Сторінок': '8 сторінок' } }, ['01.jpg', '08.jpg']);
        expect(verdict.skipped).toBe(2);
        expect(verdict.problems).toEqual([]);
    });

    it('шлях файлу приймається нарівні з назвою', () => {
        const verdict = checkEndpapers(
            magazine({ firstFilled: true, lastFilled: true }),
            paidBothItem,
            ['drafts/u/p/print/f1.jpg', 'drafts/u/p/print/f2.jpg'],
        );
        expect(verdict.problems).toEqual([]);
    });
});

describe('itemForProject', () => {
    const other = { cart_item_id: 'pb-000', slug: 'photoprint-standard', options: {} };

    it('зіставляє за ключем позиції кошика', () => {
        expect(itemForProject([other, paidBothItem], magazine())).toBe(paidBothItem);
    });

    it('без ключа бере єдиний друкований рядок', () => {
        const p: any = magazine();
        p.cart_payload = null;
        expect(itemForProject([other, paidBothItem], p)).toBe(paidBothItem);
    });

    it('без ключа і з кількома книгами не вигадує — краще мовчати, ніж приписати чужий рядок', () => {
        const p: any = magazine();
        p.cart_payload = null;
        const second = { cart_item_id: 'pb-999', slug: 'travelbook-20x30', options: {} };
        expect(itemForProject([paidBothItem, second], p)).toBeNull();
    });
});
