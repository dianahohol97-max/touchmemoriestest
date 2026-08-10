/**
 * Tags that route an order to the right pair of hands.
 *
 * Some products are not made where the rest are. Magnets and non-standard photo
 * prints go to Andriy, and until now somebody had to notice that in the order
 * and tag it manually — which works right up until the day it is busy, which is
 * exactly the day it matters.
 *
 * The rule is expressed over product slugs rather than names, because names get
 * edited for the storefront and slugs do not.
 */

export const ANDRIY_TAG = 'для Андрія';

// Slugs whose production belongs to Andriy. Matched as substrings so a future
// "photomagnets-round" is covered without another edit here.
const ANDRIY_SLUG_PATTERNS = [
    'photomagnet',
    'magnet',
    'photoprint-nonstandard',
    'fotodruk-nestandart',
];

// Deliberately excluded: 'photoprint-standard'. Standard-size printing is not
// his, and matching on 'photoprint' alone would have swept it in.
function itemGoesToAndriy(item: any): boolean {
    const slug = String(item?.slug || '').toLowerCase();
    if (!slug) return false;
    return ANDRIY_SLUG_PATTERNS.some(pattern => slug.includes(pattern));
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
    const tags: string[] = [];

    if (items.some(itemGoesToAndriy)) tags.push(ANDRIY_TAG);

    return tags;
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
