import { describe, expect, it } from 'vitest';
import { readDesignerConfig, nameFromSlug } from '@/lib/orders/designer-config';
import { hasSomethingToSell } from '@/lib/automation/keycrm-push';

/**
 * Замовлення з дизайнером не має приїжджати порожнім, а приїхавши — не має
 * зникати з поля зору.
 *
 * TM-001320: Юлія Джулай завантажила двадцять одне фото, замовлення лягло з
 * порожнім товаром і нулем гривень, перенесення в KeyCRM відкинуло його як
 * порожній кошик, і дві доби про нього ніхто не знав. Написала вона сама.
 */

const params = (obj: Record<string, string>) => new URLSearchParams(obj);

describe('readDesignerConfig', () => {
    it('сховище вкладки головне', () => {
        const stored = JSON.stringify({ slug: 'wish-book', productName: 'Книга побажань', config: { 'Розмір': '20x30' }, price: 1415 });
        expect(readDesignerConfig(stored, params({ product: 'photobook', price: '100' })))
            .toEqual({ slug: 'wish-book', productName: 'Книга побажань', config: { 'Розмір': '20x30' }, price: 1415 });
    });

    it('порожнє сховище — товар читається з адреси', () => {
        const got = readDesignerConfig(null, params({
            product: 'wish-book', name: 'Книга побажань', price: '1415',
            opts: JSON.stringify({ 'Кількість сторінок': '24' }),
        }));
        expect(got).toEqual({
            slug: 'wish-book', productName: 'Книга побажань',
            config: { 'Кількість сторінок': '24' }, price: 1415,
        });
    });

    it('саме той випадок, з якого все почалося: без адреси й без сховища нічого немає', () => {
        expect(readDesignerConfig(null, params({}))).toBeNull();
        expect(readDesignerConfig(null, null)).toBeNull();
    });

    it('адреса затуляє дірки, а не перебиває сховище', () => {
        const stored = JSON.stringify({ slug: 'wish-book', config: {}, price: 0 });
        const got = readDesignerConfig(stored, params({ product: 'photobook', price: '890', opts: JSON.stringify({ 'Розмір': '20x20' }) }));
        expect(got).toMatchObject({ slug: 'wish-book', price: 890, config: { 'Розмір': '20x20' } });
    });

    it('назва виводиться зі slug, коли справжньої немає', () => {
        expect(nameFromSlug('wish-book')).toBe('Wish Book');
        expect(readDesignerConfig(null, params({ product: 'travel-journal' }))?.productName).toBe('Travel Journal');
    });

    it('зіпсоване сховище і зіпсовані опції не валять сторінку', () => {
        expect(readDesignerConfig('{не json', params({ product: 'wish-book' }))).toMatchObject({ slug: 'wish-book' });
        expect(readDesignerConfig(null, params({ product: 'wish-book', opts: '[1,2]' }))?.config).toEqual({});
        expect(readDesignerConfig(null, params({ product: 'wish-book', opts: 'хтозна' }))?.config).toEqual({});
    });

    it('ціна читається як ціле число і ніколи не відʼємна', () => {
        expect(readDesignerConfig(null, params({ product: 'x', price: '1414.6' }))?.price).toBe(1415);
        expect(readDesignerConfig(null, params({ product: 'x', price: '-5' }))?.price).toBe(0);
        expect(readDesignerConfig(null, params({ product: 'x', price: 'дорого' }))?.price).toBe(0);
    });
});

describe('категорії без сторінки товару (/constructor/puzzles і сусіди)', () => {
    it('магніти й постери мають єдину позицію, тож slug відомий', () => {
        expect(readDesignerConfig(null, params({ kind: 'magnets' })))
            .toMatchObject({ slug: 'photomagnets', productName: 'Фотомагніти' });
        expect(readDesignerConfig(null, params({ kind: 'posters' })))
            .toMatchObject({ slug: 'poster', productName: 'Постер' });
    });

    it('де позицій кілька — записуємо категорію, а товар не вигадуємо', () => {
        for (const [kind, name] of [['puzzles', 'Фотопазл'], ['calendars', 'Фотокалендар'], ['prints', 'Фотодрук']]) {
            const got = readDesignerConfig(null, params({ kind }));
            expect(got).toMatchObject({ slug: '', productName: name });
        }
    });

    it('категорія сама по собі вже не дає порожньої заявки', () => {
        // Саме це й відрізняє «Фотопазл» від «Замовлення з дизайнером».
        expect(readDesignerConfig(null, params({ kind: 'puzzles' }))).not.toBeNull();
    });

    it('невідома категорія нічого не вигадує', () => {
        expect(readDesignerConfig(null, params({ kind: 'хтозна' }))).toBeNull();
    });

    it('справжній товар перебиває підказку категорії', () => {
        expect(readDesignerConfig(null, params({ kind: 'puzzles', product: 'puzzle-a5', name: 'Пазл А5' })))
            .toMatchObject({ slug: 'puzzle-a5', productName: 'Пазл А5' });
    });
});

describe('hasSomethingToSell', () => {
    it('звичайне замовлення з сумою їде в CRM', () => {
        expect(hasSomethingToSell({ total: 1415, with_designer: false })).toBe(true);
    });

    it('заявка з дизайнером без ціни — це робота, а не порожній кошик', () => {
        // Рівно TM-001320: нуль гривень, бо ціну ще має поставити менеджерка.
        expect(hasSomethingToSell({ total: 0, with_designer: true })).toBe(true);
        expect(hasSomethingToSell({ total: '0.00', with_designer: true })).toBe(true);
    });

    it('нуль без дизайнера лишається за бортом', () => {
        expect(hasSomethingToSell({ total: 0, with_designer: false })).toBe(false);
        expect(hasSomethingToSell({ total: null, with_designer: null })).toBe(false);
        expect(hasSomethingToSell({})).toBe(false);
    });

    it('ціна рядком з бази читається як число', () => {
        expect(hasSomethingToSell({ total: '1415.00' })).toBe(true);
    });
});
