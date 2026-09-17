/**
 * Що саме замовляє людина, яка натиснула «Замовити з дизайнером».
 *
 * Конфігурація товару їхала на /order ТІЛЬКИ в sessionStorage, а адреса була
 * гола: `router.push('/order')`. Сховище вкладки — річ крихка. Воно порожнє в
 * новій вкладці, його не видно після «відкрити в Safari» з вбудованого
 * браузера Інстаграма, і воно зникає, коли людина повертається на /order
 * вдруге (після успішної відправки ключ стирається навмисно). У всіх цих
 * випадках сторінка відкривалася без товару зовсім.
 *
 * Наслідок був не косметичний. Замовлення приїздило з порожнім slug, без
 * назви товару і на нуль гривень, тому не виставлявся рахунок, не було переходу
 * на оплату, і перенесення в KeyCRM відкидало його як «порожній кошик». Так
 * TM-001320 (Юлія Джулай, дев'ятнадцять фото) дві доби пролежало непоміченим,
 * поки клієнтка сама не написала в дирекг (Діана, 17.09.2026). Те саме сталося
 * з TM-001241, TM-001212, TM-001163 і TM-001048.
 *
 * Тепер той самий набір їде ще й в адресі, а ця функція збирає докупи обидва
 * джерела: сховище головне, адреса затуляє дірки. Адреса переживає і нову
 * вкладку, і перезавантаження, і повернення назад.
 */

export type DesignerConfig = {
    slug: string;
    productName: string;
    config: Record<string, any>;
    price: number;
};

type ParamReader = { get(key: string): string | null };

const asPrice = (v: unknown): number => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Назва з slug, коли справжньої не передали: 'wish-book' → 'Wish Book'. */
export function nameFromSlug(slug: string): string {
    return String(slug || '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

export function readDesignerConfig(stored: string | null, params: ParamReader | null): DesignerConfig | null {
    let fromStore: any = null;
    if (stored) {
        try { fromStore = JSON.parse(stored); } catch { fromStore = null; }
    }

    const urlSlug = params?.get('product')?.trim() || '';
    const urlName = params?.get('name')?.trim() || '';
    const urlPrice = asPrice(params?.get('price'));
    let urlOpts: Record<string, any> = {};
    const rawOpts = params?.get('opts');
    if (rawOpts) {
        try {
            const parsed = JSON.parse(rawOpts);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) urlOpts = parsed;
        } catch { /* зіпсований параметр не має валити сторінку */ }
    }

    const slug = String(fromStore?.slug || '').trim() || urlSlug;
    const storedConfig = fromStore?.config && typeof fromStore.config === 'object' && !Array.isArray(fromStore.config)
        ? fromStore.config as Record<string, any>
        : null;
    const config = storedConfig && Object.keys(storedConfig).length ? storedConfig : urlOpts;
    const price = asPrice(fromStore?.price) || urlPrice;
    const productName = String(fromStore?.productName || '').trim()
        || urlName
        || (slug ? nameFromSlug(slug) : '');

    // Ні товару, ні опцій, ні ціни — показувати нема чого, і вигадувати теж.
    if (!slug && !price && !Object.keys(config).length) return null;

    return { slug, productName, config, price };
}
