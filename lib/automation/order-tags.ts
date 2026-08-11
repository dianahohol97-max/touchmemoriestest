/**
 * Tags that route an order to the right pair of hands.
 *
 * Some work is not done where the rest is. Magnets, non-standard photo prints,
 * engraving and colour printing all go to Andriy, and until now somebody had to
 * notice that in the order and tag it by hand — which works right up until the
 * day it is busy, which is exactly the day it matters.
 *
 * Two more tags group work by type so a whole batch can be pulled at once:
 * "магніти" and "фото".
 *
 * What makes this non-trivial is WHERE the deciding fact lives. It is not
 * always the product: engraving is usually an option on a photobook ("Оздоблення:
 * Гравірування"), and on a KeyCRM card it arrives as a line property ("Вид
 * оздоблення: Гравіювання фотокнига"). So every rule is matched against the
 * slug, the product name and every chosen option value.
 */

// Spelled exactly as KeyCRM spells them — the CRM's tag dictionary is the
// source of truth (Diana, 2026-08-11). Before this, the auto-tagger wrote
// «для Андрія» while managers in the CRM wrote «Для Андрія», so the same
// routing tag existed twice across the order table and each version matched
// only half the orders.
export const ANDRIY_TAG = 'Для Андрія';
export const MAGNETS_TAG = 'Магніти';
export const PHOTO_TAG = 'Фото';
export const URGENT_TAG = 'Терміновий з доплатою';

/** Everything about a line that could carry the deciding word. */
function lineText(item: any): string {
    const options = item?.options && typeof item.options === 'object' ? item.options : {};

    return [
        String(item?.slug || ''),
        String(item?.product_name || item?.name || ''),
        ...Object.entries(options).map(([key, value]) => `${key} ${value}`),
    ]
        .join(' ')
        .toLowerCase();
}

function isMagnet(text: string): boolean {
    return text.includes('magnet') || text.includes('магніт');
}

function isPhotoPrint(text: string): boolean {
    return text.includes('photoprint')
        || text.includes('фотодрук')
        || text.includes('polaroid')
        || text.includes('полароїд');
}

function isNonStandardPhotoPrint(text: string): boolean {
    return isPhotoPrint(text) && (text.includes('nonstandard') || text.includes('нестандарт'));
}

/** Covers both spellings in use: "гравіювання" and "гравірування". */
function isEngraving(text: string): boolean {
    return text.includes('граві');
}

/**
 * Colour printing — and the reason this is not a one-word match.
 *
 * The catalogue is full of colours that have nothing to do with printing:
 * "Колір обкладинки", "Колір напису", "Колір сторінок", and a star map whose
 * style is "Кольоровий". Matching on "колір" alone would have tagged nearly
 * every order in the shop. Both ideas have to appear together in the same
 * phrase for it to mean colour printing.
 */
function isColourPrinting(text: string): boolean {
    const hasColour = text.includes('кольор') || text.includes('колір');
    const hasPrinting = text.includes('друк');
    if (!hasColour || !hasPrinting) return false;

    // "Матеріал обкладинки: Друкована" plus a separate "Колір обкладинки" would
    // otherwise satisfy both halves across two unrelated options, so require
    // them close together rather than merely both present.
    return /(кольор\w*|колір)[^а-яіїєґ]{0,12}друк|друк\w*[^а-яіїєґ]{0,12}(кольор\w*|колір)/.test(text);
}

/**
 * Tags this order should carry based on what is in it.
 *
 * Derived, never stored as the only copy: recomputing on every sync means a
 * corrected line item fixes the routing by itself, and a tag somebody deleted
 * by accident comes back.
 */
export function autoTagsForOrder(order: any): string[] {
    const items = Array.isArray(order?.items) ? order.items : [];
    const texts = items.map(lineText);

    const tags: string[] = [];

    const hasMagnets = texts.some(isMagnet);
    const hasPhoto = texts.some(isPhotoPrint);
    const goesToAndriy = texts.some(t =>
        isMagnet(t) || isNonStandardPhotoPrint(t) || isEngraving(t) || isColourPrinting(t)
    );

    if (goesToAndriy) tags.push(ANDRIY_TAG);
    if (hasMagnets) tags.push(MAGNETS_TAG);
    if (hasPhoto) tags.push(PHOTO_TAG);
    if (items.some(isUrgentWithSurcharge)) tags.push(URGENT_TAG);

    return tags;
}

/**
 * Rush jobs that were PAID for as rush (Diana, 2026-08-11: «всі що термінові з
 * доплатою — має автоматично йти теж Терміновий з доплатою»).
 *
 * Read from the option pair rather than the flattened line, because the
 * deciding word appears in two unrelated places: «Терміновість: Термінова 1–3
 * дні (+30%)» is a rush order, while «Термін дії: 29 липня 2027 р.» is a gift
 * certificate's validity date. Only the урgency option counts, and only when
 * its value is not the standard one — the live values are «standard»,
 * «urgent», «Термінова 1–3 дні (+30%)», «Термінове виготовлення (+30%)» and
 * «Стандартна (5–8 днів)».
 */
function isUrgentWithSurcharge(item: any): boolean {
    const options = item?.options && typeof item.options === 'object' ? item.options : {};

    for (const [rawKey, rawValue] of Object.entries(options)) {
        const key = String(rawKey || '').toLowerCase();
        if (!/терміновість|urgen|express/.test(key)) continue;

        const value = String(rawValue ?? '').toLowerCase().trim();
        if (!value) continue;
        if (/standard|стандарт|звичайн/.test(value)) continue;
        if (/термінов|urgen|express/.test(value)) return true;
    }

    // Some carts add the rush as its own line («Термінове виготовлення»,
    // «Доплата за терміновість») instead of an option on the product.
    const name = String(item?.product_name || item?.name || '').toLowerCase();
    return /термінов/.test(name) && /доплат|\+\s*\d|виготовлен/.test(name);
}

/**
 * Combine tag lists without losing anyone's work.
 *
 * Tags are written by three parties — the automation, a manager in the CRM, and
 * a manager in the admin panel — so a sync that replaced the list would quietly
 * delete whichever side wrote last. Case and surrounding spaces are normalised
 * for comparison only; the first spelling seen is the one kept, so "Терміново"
 * does not become a second tag next to "терміново".
 */
export function mergeTags(...lists: Array<string[] | null | undefined>): string[] {
    const seen = new Map<string, string>();

    for (const list of lists) {
        for (const raw of list || []) {
            const value = String(raw || '').trim();
            if (!value) continue;

            const key = value.toLowerCase();
            if (!seen.has(key)) seen.set(key, value);
        }
    }

    return [...seen.values()];
}

/** True when the two lists hold the same tags, ignoring order and case. */
export function sameTags(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
    const norm = (list: string[] | null | undefined) =>
        [...new Set((list || []).map(t => String(t).trim().toLowerCase()).filter(Boolean))].sort();

    const left = norm(a);
    const right = norm(b);

    return left.length === right.length && left.every((v, i) => v === right[i]);
}
