'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { X, ChevronRight, Info } from 'lucide-react';

interface ProductOption {
    name: string;
    values: Array<{
        name: string;
        price?: number;
        priceModifier?: number;
    }>;
}

interface BookProduct {
    id: string;
    name: string;
    slug: string;
    price: number;
    options?: ProductOption[];
    variants?: Array<{ name: string; price: number }>;
}

interface PhotoRecommendation {
    pages: number;
    photoCount: string;
}

// Photo recommendations by product type and page count
const PHOTO_RECOMMENDATIONS: Record<string, PhotoRecommendation[]> = {
    photobook: [
        { pages: 10, photoCount: '11-16' },
        { pages: 12, photoCount: '13-18' },
        { pages: 16, photoCount: '17-22' },
        { pages: 20, photoCount: '21-26' },
        { pages: 24, photoCount: '25-30' },
        { pages: 28, photoCount: '29-34' },
        { pages: 32, photoCount: '33-38' },
        { pages: 36, photoCount: '37-42' },
        { pages: 40, photoCount: '41-46' },
        { pages: 48, photoCount: '49-54' },
        { pages: 56, photoCount: '57-62' },
        { pages: 64, photoCount: '65-70' },
        { pages: 72, photoCount: '73-78' },
        { pages: 80, photoCount: '81-86' }
    ],
    magazine: [
        { pages: 8, photoCount: '9-14' },
        { pages: 12, photoCount: '13-23' },
        { pages: 16, photoCount: '17-27' },
        { pages: 20, photoCount: '21-31' },
        { pages: 24, photoCount: '25-35' },
        { pages: 28, photoCount: '29-39' },
        { pages: 32, photoCount: '33-43' },
        { pages: 36, photoCount: '37-47' }
    ],
    travelbook: [
        { pages: 12, photoCount: '13-23' },
        { pages: 16, photoCount: '17-27' },
        { pages: 20, photoCount: '21-31' },
        { pages: 24, photoCount: '25-35' },
        { pages: 32, photoCount: '33-43' },
        { pages: 40, photoCount: '41-51' },
        { pages: 48, photoCount: '49-59' },
        { pages: 56, photoCount: '57-67' },
        { pages: 64, photoCount: '65-75' },
        { pages: 72, photoCount: '73-83' },
        { pages: 80, photoCount: '81-91' }
    ]
};

interface BookConstructorConfigProps {
    productSlug: string;
}

export default function BookConstructorConfig({ productSlug }: BookConstructorConfigProps) {
    const router = useRouter();
    const [product, setProduct] = useState<BookProduct | null>(null);
    const [loading, setLoading] = useState(true);

    // Configuration state
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [selectedCoverType, setSelectedCoverType] = useState<string>('');
    const [selectedPageCount, setSelectedPageCount] = useState<string>('');
    const [selectedCopies, setSelectedCopies] = useState<string>('');
    const [enableEndpaper, setEnableEndpaper] = useState(false);
    const [enableKalka, setEnableKalka] = useState(false);

    // New state for photobook pricing
    const [photobookPrices, setPhotobookPrices] = useState<any[]>([]);
    const [coverTypes, setCoverTypes] = useState<any[]>([]);
    const [photobookSizes, setPhotobookSizes] = useState<any[]>([]);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        async function fetchProduct() {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('slug', productSlug)
                .eq('is_active', true)
                .single();

            if (data && !error) {
                setProduct(data);

                // Set default values
                if (data.variants && data.variants.length > 0) {
                    setSelectedSize(data.variants[0].name);
                }

                if (data.options) {
                    const options = data.options as ProductOption[];

                    // Set defaults for each option
                    options.forEach((option) => {
                        if (option.values && option.values.length > 0) {
                            if (option.name === 'Тип обкладинки') {
                                setSelectedCoverType(option.values[0].name);
                            } else if (option.name === 'Кількість сторінок') {
                                setSelectedPageCount(option.values[0].name);
                            } else if (option.name === 'Кількість примірників') {
                                setSelectedCopies(option.values[0].name);
                            }
                        }
                    });
                }
            }
            setLoading(false);
        }

        async function fetchPhotobookPricing() {
            // Only fetch if product is a photobook
            if (!productSlug.includes('photobook')) return;

            // Fetch photobook_prices with related data
            const { data: pricesData } = await supabase
                .from('photobook_prices')
                .select(`
                    *,
                    cover_type:cover_types(id, name, slug),
                    size:photobook_sizes(id, name, dimensions)
                `)
                .order('page_count', { ascending: true });

            if (pricesData) {
                setPhotobookPrices(pricesData);
            }

            // Fetch cover types
            const { data: coverTypesData } = await supabase
                .from('cover_types')
                .select('*')
                .order('id', { ascending: true });

            if (coverTypesData) {
                setCoverTypes(coverTypesData);
                if (coverTypesData.length > 0) {
                    setSelectedCoverType(coverTypesData[0].name);
                }
            }

            // Fetch photobook sizes
            const { data: sizesData } = await supabase
                .from('photobook_sizes')
                .select('*')
                .order('id', { ascending: true });

            if (sizesData) {
                setPhotobookSizes(sizesData);
                if (sizesData.length > 0) {
                    setSelectedSize(sizesData[0].name);
                }
            }
        }

        fetchProduct();
        fetchPhotobookPricing();
    }, [productSlug, supabase]);

    const calculatePrice = (): number => {
        if (!product) return 0;

        const productType = getProductType();

        // ==============================
        // PHOTOBOOK PRICING (from photobook_prices table)
        // ==============================
        if (productType === 'photobook' && photobookPrices.length > 0) {
            // Find matching price entry
            const pageNum = parseInt(selectedPageCount.match(/\d+/)?.[0] || '0');

            const priceEntry = photobookPrices.find(p => {
                const matchesCover = p.cover_type?.name === selectedCoverType;
                const matchesSize = p.size?.name === selectedSize;
                const matchesPages = p.page_count === pageNum;
                return matchesCover && matchesSize && matchesPages;
            });

            if (priceEntry) {
                let total = priceEntry.base_price || 0;

                // Add калька surcharge if enabled
                if (enableKalka && priceEntry.kalka_surcharge) {
                    total += priceEntry.kalka_surcharge;
                }

                return total;
            }

            // Fallback if no exact match found
            return 0;
        }

        // ==============================
        // NON-PHOTOBOOK PRICING (magazines, travel book)
        // ==============================
        let total = product.price || 0;

        // For products with variants (size-based pricing)
        if (product.variants && selectedSize) {
            const variant = product.variants.find(v => v.name === selectedSize);
            if (variant) {
                total = variant.price || 0;
            }
        }

        // Add price modifiers from options
        if (product.options) {
            const options = product.options as ProductOption[];

            options.forEach((option) => {
                let selectedValue = '';

                if (option.name === 'Тип обкладинки') {
                    selectedValue = selectedCoverType;
                } else if (option.name === 'Кількість сторінок') {
                    selectedValue = selectedPageCount;
                } else if (option.name === 'Кількість примірників') {
                    selectedValue = selectedCopies;
                }

                if (selectedValue) {
                    const valueOption = option.values.find(v => v.name === selectedValue);
                    if (valueOption) {
                        if (valueOption.price !== undefined) {
                            total = valueOption.price;
                        } else if (valueOption.priceModifier !== undefined) {
                            total += valueOption.priceModifier;
                        }
                    }
                }
            });
        }

        // Add surcharges for endpaper (travel book and hard cover magazines)
        if (productType === 'travelbook' && enableEndpaper) {
            total += 100; // Друк на форзаці для Travel Book
        }

        if (productType === 'magazine' && selectedCoverType.includes('Тверда') && enableEndpaper) {
            total += 200; // Друк на форзаці для журналу з твердою обкладинкою
        }

        return total;
    };

    const getProductType = (): string => {
        if (productSlug.includes('photobook')) return 'photobook';
        if (productSlug.includes('magazine') || productSlug.includes('journal')) return 'magazine';
        if (productSlug.includes('travel')) return 'travelbook';
        return '';
    };

    const getPhotoRecommendation = (): string => {
        if (!selectedPageCount) return '';

        const pageNum = parseInt(selectedPageCount.match(/\d+/)?.[0] || '0');
        if (pageNum === 0) return '';

        const productType = getProductType();
        const recommendations = PHOTO_RECOMMENDATIONS[productType] || [];
        const rec = recommendations.find(r => r.pages === pageNum);

        return rec ? rec.photoCount : '';
    };

    const shouldShowEndpaperOption = (): boolean => {
        const productType = getProductType();

        // Travel Book always has endpapers
        if (productType === 'travelbook') return true;

        // Magazine with hard cover has endpapers
        if (productType === 'magazine' && selectedCoverType.includes('Тверда')) return true;

        return false;
    };

    const shouldShowKalkaOption = (): boolean => {
        const productType = getProductType();
        return productType === 'photobook';
    };

    const handleContinue = () => {
        // Store configuration in sessionStorage
        const config = {
            productSlug,
            productName: product?.name,
            selectedSize,
            selectedCoverType,
            selectedPageCount,
            selectedCopies,
            enableEndpaper,
            enableKalka,
            totalPrice: calculatePrice(),
            photoRecommendation: getPhotoRecommendation(),
            timestamp: Date.now()
        };

        sessionStorage.setItem('bookConstructorConfig', JSON.stringify(config));

        // Navigate to photo upload step (Phase 2)
        router.push(`/editor/book/upload?product=${productSlug}`);
    };

    const isFormValid = (): boolean => {
        if (product?.variants && !selectedSize) return false;

        if (product?.options) {
            const options = product.options as ProductOption[];

            const requiredCoverType = options.some(o => o.name === 'Тип обкладинки');
            if (requiredCoverType && !selectedCoverType) return false;

            const requiredPageCount = options.some(o => o.name === 'Кількість сторінок');
            if (requiredPageCount && !selectedPageCount) return false;
        }

        return true;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Завантаження...</div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-red-500">Продукт не знайдено</div>
            </div>
        );
    }

    const totalPrice = calculatePrice();
    const photoRec = getPhotoRecommendation();
    const productType = getProductType();

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-[#1e2d7d] mb-2">{product.name}</h1>
                <p className="text-gray-600">Крок 1: Налаштування конфігурації</p>
            </div>

            {/* Configuration Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
                <h2 className="text-xl font-bold text-[#1e2d7d] mb-6">Оберіть параметри</h2>

                <div className="space-y-6">
                    {/* Size Selector (for photobooks) */}
                    {product.variants && product.variants.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Розмір <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedSize}
                                onChange={(e) => setSelectedSize(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                            >
                                {product.variants.map((variant) => (
                                    <option key={variant.name} value={variant.name}>
                                        {variant.name} — {variant.price} ₴
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Dynamic Options from Supabase */}
                    {product.options && (product.options as ProductOption[]).map((option) => (
                        <div key={option.name}>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {option.name} <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={
                                    option.name === 'Тип обкладинки' ? selectedCoverType :
                                    option.name === 'Кількість сторінок' ? selectedPageCount :
                                    option.name === 'Кількість примірників' ? selectedCopies :
                                    ''
                                }
                                onChange={(e) => {
                                    if (option.name === 'Тип обкладинки') {
                                        setSelectedCoverType(e.target.value);
                                    } else if (option.name === 'Кількість сторінок') {
                                        setSelectedPageCount(e.target.value);
                                    } else if (option.name === 'Кількість примірників') {
                                        setSelectedCopies(e.target.value);
                                    }
                                }}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                            >
                                {option.values.map((value) => (
                                    <option key={value.name} value={value.name}>
                                        {value.name}
                                        {value.priceModifier !== undefined && value.priceModifier !== 0 &&
                                            ` (+${value.priceModifier} ₴)`
                                        }
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}

                    {/* Калька Option (for photobooks) */}
                    {shouldShowKalkaOption() && (
                        <div className="border-t pt-6">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="kalka"
                                    checked={enableKalka}
                                    onChange={(e) => setEnableKalka(e.target.checked)}
                                    className="w-5 h-5 mt-1 rounded border-gray-300 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                                />
                                <div className="flex-1">
                                    <label htmlFor="kalka" className="block text-sm font-semibold text-gray-700 cursor-pointer">
                                        Калька перед першою сторінкою (+280 ₴)
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Напівпрозора перша сторінка з надписом або фото.
                                        Перша ліва та остання права сторінки стануть порожніми (форзац).
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Endpaper Option (for Travel Book and Hard Cover Magazine) */}
                    {shouldShowEndpaperOption() && (
                        <div className="border-t pt-6">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="endpaper"
                                    checked={enableEndpaper}
                                    onChange={(e) => setEnableEndpaper(e.target.checked)}
                                    className="w-5 h-5 mt-1 rounded border-gray-300 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                                />
                                <div className="flex-1">
                                    <label htmlFor="endpaper" className="block text-sm font-semibold text-gray-700 cursor-pointer">
                                        Друк на форзаці
                                        {productType === 'travelbook' && ' (+100 ₴)'}
                                        {productType === 'magazine' && ' (+200 ₴)'}
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Перша ліва та остання права сторінки за замовчуванням порожні.
                                        З цією опцією ви зможете завантажити дизайн для форзацу.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Photo Recommendation */}
                {photoRec && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-blue-900 mb-1">
                                    📸 Рекомендована кількість фото
                                </p>
                                <p className="text-sm text-blue-700">
                                    Для {selectedPageCount} рекомендуємо підготувати <strong>{photoRec} фото</strong>
                                </p>
                                <p className="text-xs text-blue-600 mt-2">
                                    Це орієнтовна кількість — ви можете завантажити більше або менше фото.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Real-time Price Display */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Орієнтовна вартість:</p>
                            <p className="text-xs text-gray-500">
                                Остаточна ціна може змінитися в залежності від складності макету
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold text-[#1e2d7d]">{totalPrice} ₴</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex-1 px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-lg"
                >
                    Скасувати
                </button>
                <button
                    onClick={handleContinue}
                    disabled={!isFormValid()}
                    className={`flex-1 flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold transition-colors text-lg ${
                        isFormValid()
                            ? 'bg-[#1e2d7d] text-white hover:bg-[#263a99]'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    Продовжити до завантаження фото
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
