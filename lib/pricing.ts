export interface PricingParams {
    basePrice: number;
    pricePerPage: number;
    pages: number;
    format: string;
    cover: string;
    quantity: number;
}

export const FORMAT_MULTIPLIERS: Record<string, number> = {
    '15×15': 0.8,
    '20×20': 1.0,
    '21×29': 1.3,
    '30×30': 1.6,
};

export const COVER_OFFSETS: Record<string, number> = {
    'М\'яка': -100,
    'Тверда': 0,
    'Преміум': 350,
};

export const calculatePrice = ({
    basePrice,
    pricePerPage,
    pages,
    format,
    cover,
    quantity
}: PricingParams) => {
    const formatMultiplier = FORMAT_MULTIPLIERS[format] || 1;
    const coverOffset = COVER_OFFSETS[cover] || 0;

    // Base pages is usually 20
    const extraPages = Math.max(0, pages - 20);

    const unitPrice = (basePrice * formatMultiplier) + coverOffset + (extraPages * pricePerPage);

    return {
        unitPrice: Math.round(unitPrice),
        total: Math.round(unitPrice * quantity),
        breakdown: {
            base: Math.round(basePrice * formatMultiplier),
            cover: coverOffset,
            pages: extraPages,
            pagesTotal: extraPages * pricePerPage
        }
    };
};
