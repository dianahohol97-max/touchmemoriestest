'use client';

import { useState, useEffect, useMemo } from 'react';
import { getMagazinePrice } from '@/lib/products';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { X, ChevronRight, Info, Image as ImageIcon } from 'lucide-react';
import TravelBookCoverSelector from './TravelBookCoverSelector';

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


const VELOUR_COLORS: Record<string, string> = {
  'Молочний':'#F0EAD6',      // B-01
  'Бежевий':'#D9C8B0',       // B-02
  'Таупе':'#A89880',          // B-03 — сіро-бежевий
  'Рожевий':'#E8B4B8',       // B-04
  'Бордо':'#7A2838',          // B-05
  'Сірий перловий':'#9A9898', // B-06 — срібно-сірий
  'Лаванда':'#B8A8C8',       // B-07
  'Синій':'#1A2040',          // B-08
  'Графітовий':'#3A3038',    // B-09
  'Бірюзовий':'#1A9090',     // B-10
  'Марсала':'#6E2840',        // B-11
  'Блакитно-сірий':'#607080', // B-12
  'Темно-зелений':'#1E3028', // B-13
  'Жовтий':'#D4A020',         // B-14
};
const LEATHERETTE_BOOK_COLORS: Record<string, string> = {
  'Білий':'#F5F5F0','Бежевий':'#D9C8B0','Пісочний':'#D4A76A','Рудий':'#C8844E',
  'Бордо темний':'#7A2838','Золотистий':'#C4A83A','Теракотовий':'#C25A3C',
  'Рожевий ніжний':'#E8B4B8','Червоний насичений':'#A01030','Коричневий':'#8E5038',
  'Вишневий':'#7A2020','Графітовий темний':'#3A3038','Темно-синій':'#1A2040','Чорний':'#1A1A1A',
};
const FABRIC_BOOK_COLORS: Record<string, string> = {
  'Бежевий/пісочний':'#C4AA88','Теракотовий':'#A04838','Фуксія':'#B838A0',
  'Марсала/бордо':'#602838','Коричневий':'#6E4830','Сірий/графітовий':'#586058',
  'Червоний яскравий':'#C02030','Оливковий/зелений':'#A0A020',
};
export default function BookConstructorConfig({ productSlug }: BookConstructorConfigProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [product, setProduct] = useState<BookProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoAdvance, setAutoAdvance] = useState(false);

    // Configuration state — restored from sessionStorage if user navigates back
    const _savedKey = `bookConfig_${productSlug}`;
    const _saved = typeof window !== 'undefined' ? (() => { try { return JSON.parse(sessionStorage.getItem(_savedKey) || 'null'); } catch { return null; } })() : null;

    const [selectedSize, setSelectedSize] = useState<string>(_saved?.selectedSize || '');
    const [selectedCoverType, setSelectedCoverType] = useState<string>(_saved?.selectedCoverType || '');
    const [selectedPageCount, setSelectedPageCount] = useState<string>(_saved?.selectedPageCount || '');
    const [selectedCopies, setSelectedCopies] = useState<string>(_saved?.selectedCopies || '');
    const [enableEndpaper, setEnableEndpaper] = useState(_saved?.enableEndpaper || false);
    const [enableKalka, setEnableKalka] = useState(_saved?.enableKalka || false);

    // Travel Book cover selector state
    const [showCoverSelector, setShowCoverSelector] = useState(false);
    const [selectedCover, setSelectedCover] = useState<any>(null);

    // New state for photobook pricing
    const [photobookPrices, setPhotobookPrices] = useState<any[]>([]);
    const [coverTypes, setCoverTypes] = useState<any[]>([]);
    const [photobookSizes, setPhotobookSizes] = useState<any[]>([]);

    // Decoration state
    const [decorationTypes, setDecorationTypes] = useState<any[]>([]);
    const [decorationVariants, setDecorationVariants] = useState<any[]>([]);
    const [selectedDecorationType, setSelectedDecorationType] = useState<string>(_saved?.selectedDecorationType || 'none');
    const [selectedDecorationVariant, setSelectedDecorationVariant] = useState<string>(_saved?.selectedDecorationVariant || '');

    // Lamination state (for Друкована cover only)
    const [selectedLamination, setSelectedLamination] = useState<string>(_saved?.selectedLamination || '');
    const [selectedCoverColor, setSelectedCoverColor] = useState<string>(_saved?.selectedCoverColor || '');

    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);

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
            const { data: pricesData, error: pricesError } = await supabase
                .from('photobook_prices')
                .select(`
                    *,
                    cover_type:cover_types(id, name),
                    size:photobook_sizes(id, name, width_cm, height_cm)
                `)
                .order('page_count', { ascending: true });

            if (pricesError) {
                console.error('[BookConstructor] Error fetching prices:', pricesError);
            }

            console.log('[BookConstructor] prices fetched:', pricesData?.length || 0);
            if (pricesData) {
                setPhotobookPrices(pricesData);
            }

            // Fetch cover types
            const { data: coverTypesData, error: coverError } = await supabase
                .from('cover_types')
                .select('*')
                .order('sort_order', { ascending: true });

            if (coverError) console.error('[BookConstructor] cover_types error:', coverError);

            console.log('[BookConstructor] cover_types fetched:', coverTypesData?.length || 0);
            if (coverTypesData) {
                setCoverTypes(coverTypesData);
            }

            // Fetch photobook sizes
            const { data: sizesData } = await supabase
                .from('photobook_sizes')
                .select('*')
                .order('sort_order', { ascending: true });

            console.log('[BookConstructor] sizes fetched:', sizesData?.length || 0);
            if (sizesData) {
                setPhotobookSizes(sizesData);
            }

            // Fetch decoration types
            const { data: decTypesData } = await supabase
                .from('decoration_types')
                .select('*')
                .order('sort_order', { ascending: true });

            if (decTypesData) {
                setDecorationTypes(decTypesData);
            }

            // Fetch decoration variants with joins
            const { data: decVariantsData } = await supabase
                .from('decoration_variants')
                .select(`
                    *,
                    decoration_type:decoration_types(id, name),
                    cover_type:cover_types(id, name),
                    size:photobook_sizes(id, name)
                `)
                .eq('active', true)
                .order('sort_order', { ascending: true });

            if (decVariantsData) {
                setDecorationVariants(decVariantsData);
            }
        }

        fetchProduct();
        fetchPhotobookPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productSlug]);

    // Auto-save configuration state to sessionStorage so it survives "back" navigation
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const state = {
            selectedSize, selectedCoverType, selectedPageCount, selectedCopies,
            enableEndpaper, enableKalka, selectedDecorationType, selectedDecorationVariant,
            selectedLamination, selectedCoverColor,
        };
        sessionStorage.setItem(`bookConfig_${productSlug}`, JSON.stringify(state));
    }, [selectedSize, selectedCoverType, selectedPageCount, selectedCopies,
        enableEndpaper, enableKalka, selectedDecorationType, selectedDecorationVariant,
        selectedLamination, selectedCoverColor, productSlug]);

    // Pre-fill from URL query params (when coming from catalog product page)
    useEffect(() => {
        if (loading || !product) return;

        const size = searchParams.get('size');
        const pages = searchParams.get('pages');
        const tracing = searchParams.get('tracing');
        const lamination = searchParams.get('lamination');
        const cover = searchParams.get('cover');
        const decoration = searchParams.get('decoration');
        const textLayout = searchParams.get('text_layout');

        if (!pages) return; // Need at least pages to pre-fill

        // Size (photobooks have size, magazines don't)
        if (size) {
            const sizeNorm = size.replace(/[хxX]/g, '×');
            const sizeMatch = photobookSizes.find((s: any) => s.name === sizeNorm || s.name === size);
            setSelectedSize(sizeMatch?.name || sizeNorm);
        }

        // Pages
        setSelectedPageCount(pages.includes('сторінок') ? pages : `${pages} сторінок`);

        // Cover type: from URL or derive from product slug
        if (cover) {
            setSelectedCoverType(cover);
        } else {
            const pt = getProductType();
            if (pt === 'photobook') {
                const sl = productSlug.toLowerCase();
                if (sl.includes('velour') || sl.includes('velyur')) setSelectedCoverType('Велюр');
                else if (sl.includes('leather')) setSelectedCoverType('Шкірзамінник');
                else if (sl.includes('fabric') || sl.includes('tkanina')) setSelectedCoverType('Тканина');
                else if (sl.includes('printed') || sl.includes('drukov')) setSelectedCoverType('Друкована');
            }
        }

        // Kalka / tracing
        if (tracing) {
            setEnableKalka(tracing === 'with' || tracing === 'true' || tracing.includes('калькою'));
        }

        // Lamination (printed cover only)
        if (lamination) setSelectedLamination(lamination);

        // Decoration
        if (decoration) setSelectedDecorationType(decoration);

        // Auto-set default cover color if not already set
        if (!selectedCoverColor) {
            const sl = productSlug.toLowerCase();
            if (sl.includes('velour') || sl.includes('velyur')) setSelectedCoverColor('Бежевий');
            else if (sl.includes('leather')) setSelectedCoverColor('Бежевий');
            else if (sl.includes('fabric') || sl.includes('tkanina')) setSelectedCoverColor('Бежевий/пісочний');
            // Друкована doesn't need color
        }
        setAutoAdvance(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, product, photobookSizes.length]);

    // Auto-advance: skip Step 1 and go directly to photo upload
    useEffect(() => {
        if (!autoAdvance || loading || !product) return;
        const pt = getProductType();
        const timer = setTimeout(() => {
            // Photobooks need size + pages; magazines/travelbooks need just pages
            const canAdvance = pt === 'photobook'
                ? (selectedSize && selectedPageCount && (selectedCoverType === 'Друкована' || selectedCoverColor))
                : selectedPageCount;
            if (canAdvance) {
                handleContinue();
            }
        }, 150);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoAdvance, selectedSize, selectedPageCount, selectedCoverType]);

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

                // Add decoration surcharge
                if (selectedDecorationType !== 'none' && selectedDecorationVariant) {
                    const decVariant = decorationVariants.find(
                        (dv: any) => dv.decoration_type?.name === selectedDecorationType &&
                        dv.variant_name === selectedDecorationVariant &&
                        dv.cover_type?.name === selectedCoverType &&
                        dv.size?.name === selectedSize
                    );
                    if (decVariant) {
                        total += Number(decVariant.surcharge) || 0;
                    }
                }

                return total;
            }

            // Fallback if no exact match found
            return 0;
        }

        // ==============================
        // MAGAZINE / JOURNAL PRICING (uses getMagazinePrice)
        // ==============================
        if (productType === 'magazine' || productType === 'photo-journal-soft' || productType === 'photo-journal-hard') {
            const pageNum = parseInt(selectedPageCount?.match(/\d+/)?.[0] || '0');
            if (pageNum > 0) {
                return getMagazinePrice(pageNum, false);
            }
            return product.price || 475;
        }

        // ==============================
        // NON-PHOTOBOOK PRICING (travel book, etc)
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

                if (selectedValue && option.values) {
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
        if (productSlug.includes('magazine') || productSlug.includes('journal') || productSlug.includes('zhurnal') || productSlug.includes('fotozhurnal')) return 'magazine';
        if (productSlug.includes('travel')) return 'travelbook';
        if (productSlug.includes('wish') || productSlug.includes('guest') || productSlug.includes('pobazhan')) return 'wishbook';
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
        // Validate cover color for soft covers
        if (selectedCoverType && selectedCoverType !== 'Друкована' && !selectedCoverColor) {
            alert('Будь ласка, оберіть колір обкладинки');
            return;
        }
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
            selectedLamination: selectedLamination || null,
            selectedCoverColor: selectedCoverColor || null,
            selectedDecorationType: selectedDecorationType !== 'none' ? selectedDecorationType : null,
            selectedDecorationVariant: selectedDecorationVariant || null,
            decorationSurcharge: (() => {
                if (selectedDecorationType === 'none' || !selectedDecorationVariant) return 0;
                const v = decorationVariants.find(
                    (dv: any) => dv.decoration_type?.name === selectedDecorationType &&
                    dv.variant_name === selectedDecorationVariant &&
                    dv.cover_type?.name === selectedCoverType &&
                    dv.size?.name === selectedSize
                );
                return v ? Number(v.surcharge) : 0;
            })(),
            selectedCover: selectedCover ? {
                id: selectedCover.id,
                city_name: selectedCover.city_name,
                city_name_en: selectedCover.city_name_en,
                country: selectedCover.country,
                landmark: selectedCover.landmark,
                image_url: selectedCover.image_url,
                background_color: selectedCover.background_color
            } : null,
            totalPrice: calculatePrice(),
            photoRecommendation: getPhotoRecommendation(),
            minPageCount: (() => {
                // Minimum pages for this size/cover from available price entries
                const available = photobookPrices
                    .filter((p: any) => p.cover_type?.name === selectedCoverType && p.size?.name === selectedSize)
                    .map((p: any) => p.page_count);
                return available.length > 0 ? Math.min(...available) : 6;
            })(),
            timestamp: Date.now()
        };

        sessionStorage.setItem('bookConstructorConfig', JSON.stringify(config));
        // Clear draft — user successfully proceeded, no need to restore on back
        sessionStorage.removeItem(`bookConfig_${productSlug}`);

        const pt = getProductType();
        // Wishbook — no editor needed, go directly to order summary
        if (pt === 'wishbook') {
            const params = new URLSearchParams();
            params.set('product', productSlug);
            if (selectedSize) params.set('size', selectedSize);
            if (selectedCoverType) params.set('cover', selectedCoverType);
            if (selectedLamination) params.set('lamination', selectedLamination);
            if (selectedCoverColor) params.set('cover_color', selectedCoverColor);
            if (selectedDecorationType !== 'none') params.set('decoration', selectedDecorationType);
            if (selectedDecorationVariant) params.set('decoration_variant', selectedDecorationVariant);
            router.push(`/order/wishbook?${params.toString()}`);
            return;
        }

        // Navigate to photo upload step (Phase 2) with all params
        const params = new URLSearchParams();
        params.set('product', productSlug);
        if (selectedSize) params.set('size', selectedSize);
        if (selectedPageCount) params.set('pages', selectedPageCount.replace(/[^\d]/g, ''));
        if (selectedCoverType) params.set('cover', selectedCoverType);
        if (enableKalka) params.set('tracing', 'with');
        if (selectedLamination) params.set('lamination', selectedLamination);
        if (selectedDecorationType !== 'none') params.set('decoration', selectedDecorationType);
        if (selectedDecorationVariant) params.set('decoration_variant', selectedDecorationVariant);
        // Pass through any URL params from catalog page (like text_layout)
        const textLayout = searchParams.get('text_layout');
        if (textLayout) params.set('text_layout', textLayout);
        router.push(`/editor/book/upload?${params.toString()}`);
    };

    const isFormValid = (): boolean => {
        const pt = getProductType();

        if (pt === 'photobook') {
            if (!selectedSize) return false;
            if (!selectedCoverType) return false;
            if (!selectedPageCount) return false;
            if (selectedCoverType === 'Друкована' && !selectedLamination) return false;
            if (selectedDecorationType !== 'none' && !selectedDecorationVariant) return false;
            if (selectedCoverType !== 'Друкована' && !selectedCoverColor) return false;
            return true;
        }

        // Wishbook validation — same as photobook but fixed sizes
        if (pt === 'wishbook') {
            if (!selectedSize) return false;
            if (!selectedCoverType) return false;
            if (selectedCoverType !== 'Друкована' && !selectedCoverColor) return false;
            if (selectedCoverType === 'Друкована' && !selectedLamination) return false;
            if (selectedDecorationType !== 'none' && !selectedDecorationVariant) return false;
            return true;
        }

        // Non-photobook validation
        if (product?.variants && product.variants.length > 0 && !selectedSize) return false;

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
                <h1 className="text-3xl font-bold text-[#1e2d7d] mb-2">
                    {productType === 'photobook' || productType === 'wishbook'
                        ? (selectedCoverType
                            ? `${product?.name || (productType === 'wishbook' ? 'Книга побажань' : 'Фотокнига')} — ${selectedCoverType.toLowerCase()} обкладинка`
                            : product?.name || (productType === 'wishbook' ? 'Книга побажань' : 'Фотокнига'))
                        : product.name}
                </h1>
                <p className="text-gray-600">Крок 1: Налаштування конфігурації</p>
            </div>

            {/* Configuration Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
                <h2 className="text-xl font-bold text-[#1e2d7d] mb-6">Оберіть параметри</h2>

                <div className="space-y-6">

                    {/* ── Wishbook: Fixed sizes (identical style to photobook) ── */}
                    {productType === 'wishbook' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Розмір <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    { name: '20×30', w: 20, h: 30, label: 'Вертикальна' },
                                    { name: '30×20', w: 30, h: 20, label: 'Горизонтальна' },
                                    { name: '23×23', w: 23, h: 23, label: 'Квадратна' },
                                ].map(sz => (
                                    <button key={sz.name} type="button"
                                        onClick={() => setSelectedSize(sz.name)}
                                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                                            selectedSize === sz.name
                                                ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                        }`}>
                                        <span className="block text-lg font-bold">{sz.name}</span>
                                        <span className="block text-xs text-gray-500 mt-1">{sz.w}×{sz.h} см · {sz.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Wishbook: Cover type — identical to photobook ── */}
                    {productType === 'wishbook' && coverTypes.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Тип обкладинки <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {coverTypes.sort((a: any, b: any) => a.sort_order - b.sort_order).map((cover: any) => (
                                    <button key={cover.id} type="button"
                                        onClick={() => { setSelectedCoverType(cover.name); setSelectedDecorationType('none'); setSelectedDecorationVariant(''); setSelectedLamination(''); setSelectedPageCount(''); setSelectedCoverColor(''); }}
                                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                                            selectedCoverType === cover.name
                                                ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                        }`}>
                                        <span className="block text-base font-bold">{cover.name}</span>
                                        {cover.name_en && <span className="block text-xs text-gray-500 mt-1">{cover.name_en}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Wishbook: Color swatches — identical to photobook ── */}
                    {productType === 'wishbook' && selectedCoverType && selectedCoverType !== 'Друкована' && (() => {
                        const colors = selectedCoverType === 'Шкірзамінник' ? LEATHERETTE_BOOK_COLORS
                            : selectedCoverType === 'Тканина' ? FABRIC_BOOK_COLORS
                            : VELOUR_COLORS;
                        return (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    Колір обкладинки <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(colors).map(([name, hex]) => (
                                        <button key={name} type="button" title={name}
                                            onClick={() => setSelectedCoverColor(name)}
                                            className="relative"
                                            style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: hex,
                                                border: selectedCoverColor === name ? '3px solid #1e2d7d' : '2px solid #e2e8f0',
                                                cursor: 'pointer',
                                                boxShadow: selectedCoverColor === name ? '0 0 0 2px #fff, 0 0 0 4px #1e2d7d' : 'none',
                                                transition: 'all 0.15s',
                                            }}
                                        />
                                    ))}
                                </div>
                                {selectedCoverColor && (
                                    <p className="text-sm text-gray-500 mt-2">Обрано: <strong>{selectedCoverColor}</strong></p>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── Wishbook: Lamination for Друкована — identical to photobook ── */}
                    {productType === 'wishbook' && selectedCoverType === 'Друкована' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Тип ламінації <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {['Глянцева', 'Матова'].map(lam => (
                                    <button key={lam} type="button"
                                        onClick={() => setSelectedLamination(lam)}
                                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                                            selectedLamination === lam
                                                ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                        }`}>
                                        <span className="block text-base font-bold">{lam}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Wishbook: Decoration types — identical to photobook ── */}
                    {productType === 'wishbook' && selectedCoverType && selectedCoverType !== 'Друкована' && decorationTypes.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Оздоблення обкладинки
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <button type="button"
                                    onClick={() => { setSelectedDecorationType('none'); setSelectedDecorationVariant(''); }}
                                    className={`p-3 rounded-lg border-2 text-center transition-all text-sm ${
                                        selectedDecorationType === 'none'
                                            ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                            : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                    }`}>
                                    <span className="block font-bold">Без оздоблення</span>
                                </button>
                                {decorationTypes.map((dt: any) => {
                                    const hasVariants = decorationVariants.some(
                                        (dv: any) => dv.decoration_type?.name === dt.name &&
                                        dv.cover_type?.name === selectedCoverType &&
                                        dv.size?.name === selectedSize
                                    );
                                    if (!hasVariants) return null;
                                    return (
                                        <button key={dt.id} type="button"
                                            onClick={() => { setSelectedDecorationType(dt.name); setSelectedDecorationVariant(''); }}
                                            className={`p-3 rounded-lg border-2 text-center transition-all text-sm ${
                                                selectedDecorationType === dt.name
                                                    ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                    : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                            }`}>
                                            <span className="block font-bold">{dt.name}</span>
                                            {dt.name_en && <span className="block text-xs text-gray-500 mt-0.5">{dt.name_en}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Wishbook: Decoration variant — identical to photobook ── */}
                    {productType === 'wishbook' && selectedDecorationType !== 'none' && selectedCoverType && selectedCoverType !== 'Друкована' && selectedSize && (() => {
                        const variants = decorationVariants.filter(
                            (dv: any) => dv.decoration_type?.name === selectedDecorationType &&
                            dv.cover_type?.name === selectedCoverType &&
                            dv.size?.name === selectedSize
                        );
                        if (variants.length === 0) return null;
                        return (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Варіант {selectedDecorationType.toLowerCase()} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedDecorationVariant}
                                    onChange={(e) => setSelectedDecorationVariant(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                                >
                                    <option value="">Оберіть варіант</option>
                                    {variants.map((v: any) => (
                                        <option key={v.id} value={v.variant_name}>
                                            {v.variant_name}{Number(v.surcharge) > 0 ? ` (+${v.surcharge} ₴)` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })()}

                    {/* ── Photobook: Size selector from photobook_sizes ── */}
                    {productType === 'photobook' && photobookSizes.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Розмір <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {photobookSizes.sort((a: any, b: any) => a.sort_order - b.sort_order).map((size: any) => (
                                    <button
                                        key={size.id}
                                        type="button"
                                        onClick={() => {
                            setSelectedSize(size.name);
                            // Reset page count if not available for new size
                            if (selectedPageCount) {
                                const pageNum = parseInt(selectedPageCount.match(/\d+/)?.[0] || '0');
                                const available = photobookPrices.some((p: any) => p.size?.name === size.name && p.page_count === pageNum);
                                if (!available) setSelectedPageCount('');
                            }
                        }}
                                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                                            selectedSize === size.name
                                                ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                        }`}
                                    >
                                        <span className="block text-lg font-bold">{size.name}</span>
                                        <span className="block text-xs text-gray-500 mt-1">{size.width_cm}×{size.height_cm} см</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Photobook: Cover type selector from cover_types ── */}
                    {productType === 'photobook' && coverTypes.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Тип обкладинки <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {coverTypes.sort((a: any, b: any) => a.sort_order - b.sort_order).map((cover: any) => (
                                    <button
                                        key={cover.id}
                                        type="button"
                                        onClick={() => { setSelectedCoverType(cover.name); setSelectedDecorationType('none'); setSelectedDecorationVariant(''); setSelectedLamination(''); setSelectedPageCount(''); setSelectedCoverColor(''); }}
                                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                                            selectedCoverType === cover.name
                                                ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                        }`}
                                    >
                                        <span className="block text-base font-bold">{cover.name}</span>
                                        {cover.name_en && (
                                            <span className="block text-xs text-gray-500 mt-1">{cover.name_en}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Cover color picker for soft covers ── */}
                    {productType === 'photobook' && selectedCoverType && selectedCoverType !== 'Друкована' && (() => {
                        const colors = selectedCoverType === 'Шкірзамінник' ? LEATHERETTE_BOOK_COLORS
                            : selectedCoverType === 'Тканина' ? FABRIC_BOOK_COLORS
                            : VELOUR_COLORS;
                        return (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    Колір обкладинки <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(colors).map(([name, hex]) => (
                                        <button
                                            key={name}
                                            type="button"
                                            title={name}
                                            onClick={() => setSelectedCoverColor(name)}
                                            className="relative"
                                            style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: hex,
                                                border: selectedCoverColor === name ? '3px solid #1e2d7d' : '2px solid #e2e8f0',
                                                cursor: 'pointer',
                                                boxShadow: selectedCoverColor === name ? '0 0 0 2px #fff, 0 0 0 4px #1e2d7d' : 'none',
                                                transition: 'all 0.15s',
                                            }}
                                        />
                                    ))}
                                </div>
                                {selectedCoverColor && (
                                    <p className="text-sm text-gray-500 mt-2">Обрано: <strong>{selectedCoverColor}</strong></p>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── Photobook: Lamination for Друкована cover ── */}
                    {productType === 'photobook' && selectedCoverType === 'Друкована' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Тип ламінації <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {['Глянцева', 'Матова'].map((lam) => (
                                    <button
                                        key={lam}
                                        type="button"
                                        onClick={() => setSelectedLamination(lam)}
                                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                                            selectedLamination === lam
                                                ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                        }`}
                                    >
                                        <span className="block text-base font-bold">{lam}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Photobook: Decoration selector (not for Друкована) ── */}
                    {productType === 'photobook' && selectedCoverType && selectedCoverType !== 'Друкована' && decorationTypes.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Оздоблення обкладинки
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setSelectedDecorationType('none'); setSelectedDecorationVariant(''); }}
                                    className={`p-3 rounded-lg border-2 text-center transition-all text-sm ${
                                        selectedDecorationType === 'none'
                                            ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                            : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                    }`}
                                >
                                    <span className="block font-bold">Без оздоблення</span>
                                </button>
                                {decorationTypes.map((dt: any) => {
                                    // Check if this decoration type has variants for selected cover+size
                                    const hasVariants = decorationVariants.some(
                                        (dv: any) => dv.decoration_type?.name === dt.name &&
                                        dv.cover_type?.name === selectedCoverType &&
                                        dv.size?.name === selectedSize
                                    );
                                    if (!hasVariants) return null;
                                    return (
                                        <button
                                            key={dt.id}
                                            type="button"
                                            onClick={() => { setSelectedDecorationType(dt.name); setSelectedDecorationVariant(''); }}
                                            className={`p-3 rounded-lg border-2 text-center transition-all text-sm ${
                                                selectedDecorationType === dt.name
                                                    ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                    : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                            }`}
                                        >
                                            <span className="block font-bold">{dt.name}</span>
                                            {dt.name_en && <span className="block text-xs text-gray-500 mt-0.5">{dt.name_en}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Photobook: Decoration variant sub-options ── */}
                    {productType === 'photobook' && selectedDecorationType !== 'none' && selectedCoverType && selectedCoverType !== 'Друкована' && selectedSize && (() => {
                        const variants = decorationVariants.filter(
                            (dv: any) => dv.decoration_type?.name === selectedDecorationType &&
                            dv.cover_type?.name === selectedCoverType &&
                            dv.size?.name === selectedSize
                        );
                        if (variants.length === 0) return null;
                        return (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Варіант {selectedDecorationType.toLowerCase()} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedDecorationVariant}
                                    onChange={(e) => setSelectedDecorationVariant(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                                >
                                    <option value="">Оберіть варіант</option>
                                    {variants.map((v: any) => (
                                        <option key={v.id} value={v.variant_name}>
                                            {v.variant_name}
                                            {Number(v.surcharge) > 0 ? ` (+${v.surcharge} ₴)` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })()}

                    {/* ── Photobook: Page count selector from photobook_prices ── */}
                    {productType === 'photobook' && photobookPrices.length > 0 && selectedSize && selectedCoverType && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Кількість сторінок <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedPageCount}
                                onChange={(e) => setSelectedPageCount(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                            >
                                <option value="">Оберіть кількість сторінок</option>
                                {[...new Set(photobookPrices
                                    .filter((p: any) => p.cover_type?.name === selectedCoverType && p.size?.name === selectedSize)
                                    .map((p: any) => p.page_count)
                                )].sort((a: number, b: number) => a - b).map((pageCount) => {
                                    const priceEntry = photobookPrices.find(
                                        (p: any) => p.cover_type?.name === selectedCoverType && p.size?.name === selectedSize && p.page_count === pageCount
                                    );
                                    return (
                                        <option key={pageCount} value={`${pageCount} сторінок`}>
                                            {pageCount} сторінок — {priceEntry?.base_price || 0} ₴
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {/* ── Non-photobook: Size from product.variants ── */}
                    {productType !== 'photobook' && product.variants && product.variants.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Розмір <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedSize}
                                onChange={(e) => { setSelectedSize(e.target.value); setSelectedPageCount(''); }}
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

                    {/* ── Non-photobook: Dynamic options from product.options ── */}
                    {productType !== 'photobook' && product.options && (product.options as ProductOption[]).filter((option) => option.values && option.values.length > 0).map((option) => (
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
                                {(option.values || []).map((value) => (
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

                    {/* Travel Book Cover Selector */}
                    {productType === 'travelbook' && (
                        <div className="border-t pt-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Обкладинка Travel Book
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                    Оберіть дизайн обкладинки з колекцією міст зі всього світу
                                </p>

                                {selectedCover ? (
                                    <div className="flex items-center gap-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                        <div className="w-20 h-28 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                            <img
                                                src={selectedCover.image_url}
                                                alt={selectedCover.city_name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-purple-900">
                                                {selectedCover.city_name}
                                            </p>
                                            <p className="text-sm text-purple-700">
                                                {selectedCover.country} — {selectedCover.landmark}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowCoverSelector(true)}
                                            className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
                                        >
                                            Змінити
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowCoverSelector(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-gray-600 hover:text-purple-700"
                                    >
                                        <ImageIcon className="w-5 h-5" />
                                        Обрати обкладинку
                                    </button>
                                )}
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

            {/* Travel Book Cover Selector Modal */}
            {showCoverSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                        <div className="p-6 overflow-y-auto max-h-[90vh]">
                            <TravelBookCoverSelector
                                selectedCoverId={selectedCover?.id || null}
                                onCoverSelect={(cover) => {
                                    setSelectedCover(cover);
                                    setShowCoverSelector(false);
                                }}
                                onClose={() => setShowCoverSelector(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
