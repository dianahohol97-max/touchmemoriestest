import { isPageLaminationSelected, LAMINATION_PRICE_PER_PAGE } from '@/lib/products';

/**
 * Підсумкова ціна на сторінці товару — те, що бачить покупець і що йде в
 * кошик.
 *
 * Ця арифметика жила всередині ProductClient як ~150 рядків посеред
 * React-компонента. Викликати її з тесту було неможливо, тому КОЖЕН ціновий
 * баг цієї ділянки — 936 замість 878, 1716 замість 1463, 15.5 ₴ за
 * полароїд, з'їдені 50 ₴ на TM-001043, 825 замість 675 на TM-001202 —
 * помічав покупець або менеджер, а не тест. Винесено сюди 2026-08-19 як
 * ДОСЛІВНИЙ переніс: жодна гілка не «покращена», поведінка збігається з
 * компонентом рядок у рядок, а страхує це tests/final-price.test.ts.
 *
 * Модель у три джерела, за пріоритетом:
 *
 *   1. Фотокниги — рядок таблиці photobook_prices (обкладинка × розмір ×
 *      сторінки) плюс калька з того самого рядка.
 *   2. dynamicPrice — ціна, яку вже порахувала шкала (ProductOptionsSelector
 *      або журнальний ефект на сторінці). Для Travel Book вона ВЖЕ містить
 *      і множник терміновості, і ламінацію — тому тревели виключені з
 *      загального циклу відсотків нижче.
 *   3. Модифікатори з products.options, яких перші два джерела не знають.
 *
 * Порядок доплат принциповий: відсоткова терміновість множить базову ціну
 * виробу, а плоскі доплати (верстка, напис, ламінація сторінок) лягають
 * зверху ПІСЛЯ множення. Терміновість — надбавка за виробництво книги;
 * плоскі позиції — окрема праця, яку поспіх не робить дорожчою.
 */

export type PriceBreakdownLine = { label: string; amount: number };

export type FinalPriceProduct = {
    slug?: string | null;
    price?: number | null;
    options?: any;
};

export type PhotobookPriceEntry = {
    cover_type?: { name?: string } | null;
    size?: { name?: string } | null;
    page_count?: number;
    base_price?: number | string;
    kalka_surcharge?: number | string;
};

/**
 * Ключ опції «напис увімкнено». Значення повторює INSCRIPTION_KEYS.on з
 * components/ui/InscriptionDesigner — імпортувати звідти не можна, бо це
 * 'use client'-модуль з React-компонентом, а цей файл мусить лишатися
 * чистим. Тест «ключ вмикання напису збігається…» тримає обидва рядки
 * разом: розійдуться — впаде.
 */
export const INSCRIPTION_ON_KEY = 'Напис';

export function computeFinalPrice(args: {
    product: FinalPriceProduct;
    selectedOptions: Record<string, string | number>;
    dynamicPrice: number | null;
    photobookPrices?: PhotobookPriceEntry[];
    /**
     * ProductOptionsSelector.getCalculatedPrice, переданий знадвору — з тієї
     * самої причини 'use client', що й INSCRIPTION_ON_KEY. Потрібен лише
     * photoprint-подібним товарам на першому рендері.
     */
    getCalculatedPrice?: (slug: string, opts: Record<string, string | number>) => number | null;
}): { finalPrice: number; breakdown: PriceBreakdownLine[] } {
    const { product, selectedOptions, dynamicPrice, photobookPrices = [], getCalculatedPrice } = args;

    const isPhotobook = !!(product.slug?.includes('photobook') || product.slug?.includes('graduation'));

    let finalPrice: number = product.price || 0;
    let breakdown: PriceBreakdownLine[] = [];

    // Source 1: Photobook prices table lookup (ALL photobooks use this when data available)
    if (isPhotobook && photobookPrices.length > 0) {
        const sizeVal = String(selectedOptions['Розмір'] || '');
        const pagesVal = String(selectedOptions['Кількість сторінок'] || '');
        const kalkaVal = String(selectedOptions['Калька перед першою сторінкою'] || '');

        const pageCount = Number(String(pagesVal).replace(/[^\d]/g, '')) || 0;
        const sizeNorm = sizeVal.replace(/[хxX]/g, '×').replace(/\s*см$/i, '').trim();

        let coverName = 'Друкована';
        const sl = product.slug || '';
        if (sl.includes('velour') || sl.includes('velyur')) coverName = 'Велюр';
        else if (sl.includes('leather')) coverName = 'Шкірзамінник';
        else if (sl.includes('fabric') || sl.includes('tkanina')) coverName = 'Тканина';
        else if (sl.includes('graduation')) coverName = 'Випускна';

        if (sizeNorm && pageCount) {
            const entry = photobookPrices.find((p: any) =>
                p.cover_type?.name === coverName && p.size?.name === sizeNorm && p.page_count === pageCount
            );
            if (entry) {
                finalPrice = Number(entry.base_price) || 0;
                // Калька / tracing paper surcharge
                if (String(kalkaVal).includes('калькою') || String(kalkaVal).includes('Так') || kalkaVal === 'with') {
                    finalPrice += Number(entry.kalka_surcharge) || 300;
                }
            }
        }
    }
    // Source 2: ProductOptionsSelector calculated price (non-photobook hardcoded products)
    else if (dynamicPrice !== null && dynamicPrice > 0) {
        finalPrice = dynamicPrice;
    }

    // Source 3: ALWAYS add modifiers from product.options that aren't covered by sources 1-2
    // This catches DB-only options like "Верстка тексту" that hardcoded PRODUCT_OPTIONS doesn't know about
    if (product.options && Array.isArray(product.options)) {
        // Photoprint / polaroid / photomagnet are "size IS the price" products:
        // each size in product.options carries the FULL per-unit price (7.5 or
        // 8 ₴), not a surcharge over product.price. If we let Source 3 below
        // treat it as a modifier we'd add 8 on top of the 7.5 base → 15.5 ₴,
        // which is exactly what was shown on the nonstandard page. Detect
        // these products by slug and overwrite finalPrice with the matching
        // size's price instead of adding to it.
        const slugLower = (product.slug || '').toLowerCase();
        const isPhotoprintLike =
            slugLower.includes('photoprint') ||
            slugLower.includes('polaroid') ||
            slugLower.includes('photomagnet') ||
            slugLower.includes('polotni') ||
            slugLower.includes('canvas') ||
            slugLower.includes('puzzle') ||
            slugLower.includes('pazl');
        if (isPhotoprintLike) {
            const sizeOpt = product.options.find((o: any) => o.name === 'Розмір' || o.name === 'Формат');
            if (sizeOpt) {
                const sel = selectedOptions[sizeOpt.name];
                if (sel !== undefined) {
                    const items = sizeOpt.options || sizeOpt.values || [];
                    const match = items.find((i: any) =>
                        i === sel || String(i.value) === String(sel) ||
                        i.label === sel || i.name === sel
                    );
                    if (match && typeof match === 'object' && match.price != null) {
                        // For photoprint-standard the DB stores a SURCHARGE over
                        // product.price (e.g. 13×18 → price:10, base:8 → total 18 ₴).
                        // For polaroid / photomagnet the DB stores the FULL per-unit
                        // price. Distinguish by checking dynamicPrice (ProductOptionsSelector
                        // already computed the correct full price from the hardcoded table):
                        // if dynamicPrice is set and positive, trust it; otherwise fall back
                        // to base + surcharge from the DB.
                        if (dynamicPrice !== null && dynamicPrice > 0) {
                            finalPrice = dynamicPrice;
                        } else {
                            // dynamicPrice not yet set on initial render — use getCalculatedPrice
                            // so we show correct per-unit price instead of base+surcharge from DB
                            // (e.g. nonstandard 9x9: 7.5 base + 8 surcharge = 15 was wrong; correct = 8).
                            const calcPrice = getCalculatedPrice
                                ? getCalculatedPrice(product.slug || '', selectedOptions)
                                : null;
                            if (calcPrice !== null && calcPrice > 0) {
                                finalPrice = calcPrice;
                            } else {
                                const baseProductPrice = Number(product.price || 0);
                                const optionPrice = Number(match.price);
                                finalPrice = optionPrice > baseProductPrice
                                    ? optionPrice
                                    : baseProductPrice + optionPrice;
                            }
                        }
                    }
                }
            }
        }
        // Names already handled by ProductOptionsSelector (hardcoded PRODUCT_OPTIONS).
        // 'Розмір' is only excluded when dynamicPrice is set (ProductOptionsSelector already priced it)
        // or for photobooks (priced via Source 1). For pure DB products (posters, maps etc.)
        // 'Розмір' carries a price modifier and must be included here.
        const hardcodedNames = new Set([
            'Тип обкладинки',
            'Калька перед першою сторінкою', 'Тип ламінації',
            'Рамка', 'Вид', 'Покриття', 'Біла рамочка 3мм', 'Матеріал',
            'Матеріал обкладинки', 'Колір сторінок',
            'Ламінація', 'Ламінація сторінок', 'Ламінування сторінок', 'Індивідуальна обкладинка',
            'Терміновість',
            // 'Кількість сторінок' is excluded ONLY when a dynamic price
            // (page-scale lookup) already covered it. For DB-configured
            // products like the glossy magazine dynamicPrice is null and the
            // page surcharge lives in the option itself (+50 for 12 pages
            // etc.) — TM-001043 was undercharged by exactly that 50 ₴
            // because the exclusion was unconditional.
            ...(dynamicPrice !== null || isPhotobook ? ['Кількість сторінок'] : []),
            // Note: 'Верстка тексту' is INTENTIONALLY NOT excluded here.
            // The ProductOptionsSelector returns the BASE magazine price
            // without the typesetting surcharge, so the +195 ₴ has to be
            // added by this Source 3 modifier loop. That way the
            // surcharge × 1.3 (urgency) multiplies the base price only,
            // and the flat typesetting fee rides on top — matching how
            // the editor BookLayoutEditor and the catalog magazine-a4
            // page calculate it. See lib/products.ts getMagazinePrice.
            //
            // Exclude 'Розмір' only when already handled by ProductOptionsSelector or photobook lookup
            ...(dynamicPrice !== null || isPhotobook || isPhotoprintLike ? ['Розмір', 'Формат'] : []),
        ]);

        let extraModifiers = 0;
        // Human-readable price breakdown, captured AT PURCHASE TIME so the
        // admin can always answer "чому 720, а не 770" — each surcharge is a
        // labeled line stored with the cart item (team request, TM-001043).
        const priceBreakdown: PriceBreakdownLine[] = [];

        product.options.forEach((opt: any) => {
            // Skip options already accounted for in dynamicPrice or photobook lookup
            if (hardcodedNames.has(opt.name)) return;

            if (opt.type === 'inscription') {
                if (selectedOptions[INSCRIPTION_ON_KEY] === 'yes') {
                    extraModifiers += Number(opt.price || 0);
                    if (Number(opt.price)) priceBreakdown.push({ label: opt.name || 'Надпис', amount: Number(opt.price) });
                }
                return;
            }

            const selected = selectedOptions[opt.name];
            if (selected === undefined) return;
            if (opt.type === 'counter') {
                {
                    const qty = Math.max(0, Math.floor(Number(selected) || 0));
                    const add = qty * Number(opt.unit_price || 0);
                    extraModifiers += add;
                    if (add) priceBreakdown.push({ label: `${opt.name} × ${qty}`, amount: add });
                }
                return;
            }
            const items = opt.options || opt.values || [];
            const match = items.find((i: any) =>
                i === selected || String(i.value) === String(selected) ||
                i.label === selected || i.name === selected
            );
            if (match && typeof match === 'object') {
                {
                    const add = Number(match.price || match.priceModifier || 0);
                    extraModifiers += add;
                    if (add) priceBreakdown.push({ label: `${opt.name}: ${match.label || selected}`, amount: add });
                }
            }
        });

        // Apply percentage surcharges (e.g. Терміновість +30%) BEFORE
        // adding the flat-rate extras. Урgency multiplies the base
        // production price; typesetting / inscription / kalka are flat
        // labour fees that don't compound with the rush. So:
        // 525 base × 1.3 urgent + 195 typesetting = 878 ✓
        // not the previous order which gave
        // (525 + 195) × 1.3 = 936 ✕
        // Travel Book is EXCLUDED from this generic pct loop: its dynamicPrice
        // comes from calcTravelBookTotal, which already applies the rush
        // multiplier itself. Running the loop on top compounded it twice —
        // the header showed «від 1283 ₴» (987 × 1.3) for an urgent 12-page book.
        const slugForPct = slugLower;
        if (product.options && Array.isArray(product.options) && !slugForPct.includes('travel')) {
            product.options.forEach((opt: any) => {
                if (!opt.options) return;
                const selected = selectedOptions[opt.name];
                if (!selected) return;
                const match = opt.options.find((i: any) =>
                    String(i.value) === String(selected) || i.label === selected
                );
                if (match && match.surcharge_pct && Number(match.surcharge_pct) > 0) {
                    finalPrice = Math.round(finalPrice * (1 + Number(match.surcharge_pct) / 100));
                }
            });
        }
        // Hard-journal page lamination — flat 7 ₴/стор AFTER the rush
        // multiplier (its old home inside ProductOptionsSelector's total let
        // the +30% compound it). Travel Book handles this inside
        // calcTravelBookTotal; the soft magazine has no page lamination.
        if (/photojournal-hard|tverd|hardcover/.test(slugForPct)) {
            const lamSel = String(selectedOptions['Ламінування сторінок'] ?? selectedOptions['Ламінація сторінок'] ?? '');
            const lamPages = Number(selectedOptions['Кількість сторінок']) || 0;
            if (isPageLaminationSelected(lamSel) && lamPages > 0) {
                const add = lamPages * LAMINATION_PRICE_PER_PAGE;
                // Goes through extraModifiers so the «Базова вартість» line in
                // the breakdown stays lamination-free and the lines sum up.
                extraModifiers += add;
                priceBreakdown.push({ label: `Ламінування сторінок (7 ₴ × ${lamPages})`, amount: add });
            }
        }
        // Flat extras (typesetting, retouching, QR, etc.) ride on top
        // of the rush-inflated baseline, not below it.
        finalPrice += extraModifiers;
        breakdown = [
            { label: 'Базова вартість', amount: finalPrice - extraModifiers },
            ...priceBreakdown,
        ];
    }

    return { finalPrice, breakdown };
}
