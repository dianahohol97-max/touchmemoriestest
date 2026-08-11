/**
 * Test orders that must never leave the site.
 *
 * The rule (Diana, 2026-08-11): «Замовлення киця кицюня не переноси ніколи.
 * Це наші тестові замовлення». Orders placed under these customer names are
 * created while testing the site checkout — they are not real sales, so no
 * automation may treat them as work: not the KeyCRM push (two of them, #13804
 * and #13805, got created in the CRM before this rule existed and had to be
 * deleted by hand), not the stock deduction, not the production calendar, not
 * the ops digest.
 *
 * Matched by substring on the normalised customer name, so «Киця Кицюня»,
 * «киця  кицюня» and «Тест Киця Кицюня» all count. Add future test personas to
 * the list — one line here covers every automation at once.
 */
const TEST_CUSTOMER_NAMES = ['киця кицюня'];

export function isTestOrder(order: { customer_name?: string | null } | null | undefined): boolean {
    const name = String(order?.customer_name || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    if (!name) return false;
    return TEST_CUSTOMER_NAMES.some(test => name.includes(test));
}
