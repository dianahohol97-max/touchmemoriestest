// Loyalty System Helper Functions
// Auto-calculate and apply loyalty discounts based on customer tier

export interface LoyaltyTier {
    name: string;
    minOrders: number;
    discount: number;
    emoji: string;
    color: string;
    bgColor: string;
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
    {
        name: 'Новий',
        minOrders: 1,
        discount: 0,
        emoji: '',
        color: '#94a3b8',
        bgColor: '#f1f5f9'
    },
    {
        name: 'Постійний',
        minOrders: 2,
        discount: 5,
        emoji: '',
        color: '#6366f1',
        bgColor: '#e0e7ff'
    },
    {
        name: 'VIP',
        minOrders: 5,
        discount: 10,
        emoji: '',
        color: '#f59e0b',
        bgColor: '#fef3c7'
    },
    {
        name: 'Преміум',
        minOrders: 10,
        discount: 15,
        emoji: '',
        color: '#7c3aed',
        bgColor: '#f3e8ff'
    }
];

/**
 * Calculate loyalty tier based on total orders count
 */
export function calculateLoyaltyTier(totalOrders: number): LoyaltyTier {
    // Find the highest tier the customer qualifies for
    const qualifyingTiers = LOYALTY_TIERS.filter(tier => totalOrders >= tier.minOrders);
    return qualifyingTiers[qualifyingTiers.length - 1] || LOYALTY_TIERS[0];
}

/**
 * Get loyalty discount percentage for a tier name
 */
export function getLoyaltyDiscount(tierName: string): number {
    const tier = LOYALTY_TIERS.find(t => t.name === tierName);
    return tier?.discount || 0;
}

/**
 * Apply loyalty discount to an order total
 */
export function applyLoyaltyDiscount(total: number, tierName: string): {
    originalTotal: number;
    discount: number;
    discountAmount: number;
    finalTotal: number;
} {
    const discount = getLoyaltyDiscount(tierName);
    const discountAmount = (total * discount) / 100;
    const finalTotal = total - discountAmount;

    return {
        originalTotal: total,
        discount,
        discountAmount,
        finalTotal
    };
}

/**
 * Get loyalty badge information for display
 */
export function getLoyaltyBadge(tierName: string): {
    emoji: string;
    color: string;
    bgColor: string;
} {
    const tier = LOYALTY_TIERS.find(t => t.name === tierName) || LOYALTY_TIERS[0];
    return {
        emoji: tier.emoji,
        color: tier.color,
        bgColor: tier.bgColor
    };
}

/**
 * Check if a birthday is within the next 7 days
 */
export function isBirthdaySoon(birthday?: string | null): boolean {
    if (!birthday) return false;

    const today = new Date();
    const birthDate = new Date(birthday);

    // Set year to current year for comparison
    birthDate.setFullYear(today.getFullYear());

    // Check if birthday already passed this year
    if (birthDate < today) {
        birthDate.setFullYear(today.getFullYear() + 1);
    }

    const daysUntil = Math.ceil((birthDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
}

/**
 * Calculate next loyalty tier progress
 */
export function getNextTierProgress(currentOrders: number): {
    currentTier: LoyaltyTier;
    nextTier: LoyaltyTier | null;
    ordersToNext: number;
    progress: number;
} {
    const currentTier = calculateLoyaltyTier(currentOrders);
    const currentTierIndex = LOYALTY_TIERS.findIndex(t => t.name === currentTier.name);
    const nextTier = currentTierIndex < LOYALTY_TIERS.length - 1
        ? LOYALTY_TIERS[currentTierIndex + 1]
        : null;

    if (!nextTier) {
        return {
            currentTier,
            nextTier: null,
            ordersToNext: 0,
            progress: 100
        };
    }

    const ordersToNext = nextTier.minOrders - currentOrders;
    const progress = ((currentOrders - currentTier.minOrders) / (nextTier.minOrders - currentTier.minOrders)) * 100;

    return {
        currentTier,
        nextTier,
        ordersToNext,
        progress: Math.min(Math.max(progress, 0), 100)
    };
}
