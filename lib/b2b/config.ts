/**
 * B2B partner program — roles, discounts and category mapping.
 *
 * A verified B2B customer (customers.b2b_status = 'verified') gets a standing
 * percentage discount on a specific set of product categories tied to their role.
 * The discount is computed server-side and reflected in the cart / product pages;
 * it is NOT a promo code the user types.
 */

export type B2bRole = 'photographer' | 'wedding_agency';
export type B2bStatus = 'pending' | 'verified' | 'rejected';

export interface B2bRoleConfig {
    role: B2bRole;
    /** Discount percentage applied to the categories below (e.g. 10 = -10%). */
    discountPercent: number;
    /** Category slugs this role gets the discount on. */
    categorySlugs: string[];
    /** Human label (uk) shown in cart / on product pages. */
    label: string;
    /** Registration page path. */
    registerPath: string;
}

export const B2B_ROLES: Record<B2bRole, B2bRoleConfig> = {
    photographer: {
        role: 'photographer',
        discountPercent: 10,
        categorySlugs: ['photobooks', 'hlyantsevi-zhurnaly', 'prints', 'travelbooks'],
        label: 'Ціна для фотографів',
        registerPath: '/photographers',
    },
    wedding_agency: {
        role: 'wedding_agency',
        discountPercent: 10,
        categorySlugs: ['guestbooks'],
        label: 'Ціна для весільних агенцій',
        registerPath: '/wedding-agencies',
    },
};

export function getRoleConfig(role?: string | null): B2bRoleConfig | null {
    if (!role) return null;
    return (B2B_ROLES as Record<string, B2bRoleConfig>)[role] || null;
}

/**
 * Given a verified customer's role and a product's category slug, return the
 * discount percent (0 if none). Safe to call with any/undefined values.
 */
export function getB2bDiscountPercent(opts: {
    role?: string | null;
    status?: string | null;
    categorySlug?: string | null;
}): number {
    if (opts.status !== 'verified') return 0;
    const cfg = getRoleConfig(opts.role);
    if (!cfg) return 0;
    if (!opts.categorySlug) return 0;
    return cfg.categorySlugs.includes(opts.categorySlug) ? cfg.discountPercent : 0;
}

/**
 * Apply a B2B discount to a base price. Returns the discounted price rounded
 * to the nearest whole UAH (prices on the site are whole numbers).
 */
export function applyB2bDiscount(basePrice: number, discountPercent: number): number {
    if (!discountPercent || discountPercent <= 0) return basePrice;
    return Math.round(basePrice * (1 - discountPercent / 100));
}
