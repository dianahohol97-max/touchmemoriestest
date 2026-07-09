'use client';

import { useState, useEffect, useMemo } from 'react';
import { getMagazinePrice, TYPESETTING_PRICE, URGENT_MULTIPLIER, getPhotojournalHardPrice, getTravelBookPrice, LAMINATION_PRICE_PER_PAGE, isPageLaminationSelected } from '@/lib/products';
import { WISHBOOK_PRICES, getWishbookPrice } from './ui/ProductOptionsSelector';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { X, ChevronRight, Info, Image as ImageIcon } from 'lucide-react';
import TravelBookCoverSelector from './TravelBookCoverSelector';
import { useT, useLocale } from '@/lib/i18n/context';
import { getLocalized } from '@/lib/i18n/localize';

interface ProductOption {
    name: string;
    values: Array<{
        name: string;
        price?: number;
        priceModifier?: number;
    }>;
}

// Option names the configurator has dedicated state + pricing for. Others
// (e.g. "Верстка тексту", "Терміновість") are chosen on the product page and
// arrive as URL params, so we don't render dead selects for them here.
const HANDLED_OPTION_NAMES = ['Тип обкладинки', 'Кількість сторінок', 'Кількість примірників', 'Ламінація сторінок'];

// Some products store choices under `values: [{name, priceModifier}]` and others
// under `options: [{label, value, price}]`. Normalize to the former shape so the
// configurator renders either correctly (this is why the glossy magazine showed
// no options — its page-count choices live under `options`, not `values`).
function getOptionValues(option: any): Array<{ name: string; priceModifier?: number }> {
    if (Array.isArray(option?.values) && option.values.length > 0) return option.values;
    if (Array.isArray(option?.options) && option.options.length > 0) {
        return option.options.map((o: any) => ({
            name: o.name ?? o.label ?? o.value ?? '',
            priceModifier: o.priceModifier ?? o.price ?? 0,
        }));
    }
    return [];
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
    mixed: string;            // Primary range, e.g. "12-16 фото"
    collage?: string;         // Optional "more collages" range (photobook only)
}

// Photo capacity recommendations per page count. Source: Diana's print-sheet
// (May 2026). Photobook has two columns (mixed vs collage strategies); travel
// book, hard-cover journal and soft-cover magazine each have a single
// recommended range from the printed price-sheet posters.
const PHOTO_RECOMMENDATIONS: Record<string, PhotoRecommendation[]> = {
    photobook: [
        { pages: 8,  mixed: '12-16 фото', collage: '20 фото' },
        { pages: 10, mixed: '15-20 фото', collage: '25 фото' },
        { pages: 12, mixed: '18-24 фото', collage: '30 фото' },
        { pages: 14, mixed: '21-28 фото', collage: '35 фото' },
        { pages: 16, mixed: '24-32 фото', collage: '40 фото' },
        { pages: 18, mixed: '27-36 фото', collage: '45 фото' },
        { pages: 20, mixed: '30-40 фото', collage: '50 фото' },
        { pages: 22, mixed: '33-44 фото', collage: '55 фото' },
        { pages: 24, mixed: '36-48 фото', collage: '60 фото' },
        { pages: 26, mixed: '39-52 фото', collage: '65 фото' },
        { pages: 28, mixed: '42-56 фото', collage: '70 фото' },
        { pages: 30, mixed: '45-60 фото', collage: '75 фото' },
        { pages: 32, mixed: '48-66 фото', collage: '80 фото' },
        { pages: 34, mixed: '51-70 фото', collage: '85 фото' },
        { pages: 36, mixed: '54-74 фото', collage: '90 фото' },
        { pages: 38, mixed: '57-78 фото', collage: '95 фото' },
        { pages: 40, mixed: '60-82 фото', collage: '100 фото' },
        { pages: 42, mixed: '63-86 фото', collage: '105 фото' },
        { pages: 44, mixed: '66-90 фото', collage: '110 фото' },
        { pages: 46, mixed: '69-94 фото', collage: '115 фото' },
        { pages: 48, mixed: '72-98 фото', collage: '120 фото' },
        { pages: 50, mixed: '75-100 фото', collage: '125-135 фото' },
    ],
    // Travel Book and hard-cover photojournal share the same physical book
    // shape and the same recommendation scale (12 → 13-18, 80 → 81-120).
    travelbook: [
        { pages: 12, mixed: '13-23 фото' },
        { pages: 16, mixed: '17-27 фото' },
        { pages: 20, mixed: '21-31 фото' },
        { pages: 24, mixed: '25-35 фото' },
        { pages: 28, mixed: '29-40 фото' },
        { pages: 32, mixed: '33-45 фото' },
        { pages: 36, mixed: '37-50 фото' },
        { pages: 40, mixed: '41-60 фото' },
        { pages: 44, mixed: '45-65 фото' },
        { pages: 48, mixed: '49-70 фото' },
        { pages: 52, mixed: '53-75 фото' },
        { pages: 60, mixed: '61-85 фото' },
        { pages: 72, mixed: '73-105 фото' },
        { pages: 80, mixed: '81-120 фото' },
    ],
    'photojournal-hard': [
        { pages: 12, mixed: '13-23 фото' },
        { pages: 16, mixed: '17-27 фото' },
        { pages: 20, mixed: '21-31 фото' },
        { pages: 24, mixed: '25-35 фото' },
        { pages: 28, mixed: '29-40 фото' },
        { pages: 32, mixed: '33-45 фото' },
        { pages: 36, mixed: '37-50 фото' },
        { pages: 40, mixed: '41-60 фото' },
        { pages: 44, mixed: '45-65 фото' },
        { pages: 48, mixed: '49-70 фото' },
        { pages: 52, mixed: '53-75 фото' },
        { pages: 60, mixed: '61-85 фото' },
        { pages: 72, mixed: '73-105 фото' },
        { pages: 80, mixed: '81-120 фото' },
    ],
    // Soft-cover magazine — has its own scale (8 → 9-13, up to 100 pages)
    magazine: [
        { pages: 8,   mixed: '9-13 фото' },
        { pages: 12,  mixed: '13-17 фото' },
        { pages: 16,  mixed: '17-21 фото' },
        { pages: 20,  mixed: '21-25 фото' },
        { pages: 24,  mixed: '25-29 фото' },
        { pages: 28,  mixed: '29-35 фото' },
        { pages: 32,  mixed: '33-43 фото' },
        { pages: 36,  mixed: '37-47 фото' },
        { pages: 40,  mixed: '41-55 фото' },
        { pages: 44,  mixed: '45-55 фото' },
        { pages: 48,  mixed: '49-65 фото' },
        { pages: 52,  mixed: '53-70 фото' },
        { pages: 60,  mixed: '61-75 фото' },
        { pages: 72,  mixed: '73-85 фото' },
        { pages: 80,  mixed: '81-95 фото' },
        { pages: 92,  mixed: '93-110 фото' },
        { pages: 100, mixed: '101-120 фото' },
    ],
};

interface BookConstructorConfigProps {
    productSlug: string;
}


// Velour colors — synced with the cover_colors DB table (В-01…В-15).
// Names + hex values must match exactly so the constructor's preview
// swatches line up with the card selector and admin views.
const VELOUR_COLORS: Record<string, string> = {
  'Молочний':'#F0EAD6',       // В-01
  'Бежевий':'#D9C8B0',        // В-02
  'Таупе':'#7C7167',          // В-03
  'Рожевий':'#E8B4B8',        // В-04
  'Бордо':'#7A2838',          // В-05
  'Сірий перловий':'#9A9898', // В-06
  'Лаванда':'#B8A8C8',        // В-07
  'Синій':'#1A2040',          // В-08
  'Графітовий':'#3A3038',     // В-09
  'Бірюзовий':'#1A9090',      // В-10
  'Фіолетовий':'#8C2D80',     // В-11
  'Блакитно-сірий':'#607080', // В-12
  'Темно-зелений':'#1A6A53',  // В-13
  'Жовтий':'#D4A020',         // В-14
  'Чорний':'#1A1A1A',         // В-15
};
// Leatherette colours — synced with the cover_colors DB table
// (Ш-01…Ш-25 + Ш-28). Names + hex must match the DB exactly; also
// synced with LEATHERETTE_COLORS_WB in ProductOptionsSelector.tsx and
// LEATHERETTE_COLORS in CoverEditor.tsx.
const LEATHERETTE_BOOK_COLORS: Record<string, string> = {
  'Білий':'#F5F5F0',               // Ш-01
  'Бежевий':'#D9C8B0',             // Ш-03
  'Пісочний':'#D4A76A',            // Ш-04
  'Рудий':'#C8844E',               // Ш-05
  'Бордо темний':'#7A2838',        // Ш-06
  'Золотистий':'#C4A83A',          // Ш-07
  'Теракотовий':'#C25A3C',         // Ш-08
  'Жовтий':'#F0B820',              // Ш-09
  'Рожевий ніжний':'#E8B4B8',      // Ш-10
  'Фуксія':'#D84080',              // Ш-11
  'Червоний насичений':'#A01030',  // Ш-12
  'Коричневий':'#8E5038',          // Ш-13
  'Вишневий':'#7A2020',            // Ш-14
  'Марсала':'#6E2840',             // Ш-15
  'Графітовий темний':'#3A3038',   // Ш-16
  'Фіолетовий яскравий':'#8030A0', // Ш-17
  'Фіолетовий темний':'#502060',   // Ш-18
  'Бірюзовий':'#4E9090',           // Ш-19
  'Оливковий':'#A0A030',           // Ш-20
  'Темно-зелений':'#1E3028',       // Ш-21
  'Бірюзовий яскравий':'#00B0B0',  // Ш-22
  'Блакитний яскравий':'#0088D0',  // Ш-23
  'Темно-синій':'#1A2040',         // Ш-24
  'Чорний':'#1A1A1A',              // Ш-25
  'Персиковий':'#E8A8A0',          // Ш-28
};
const FABRIC_BOOK_COLORS: Record<string, string> = {
  'Бежевий/пісочний':'#C4AA88','Теракотовий':'#A04838','Фуксія':'#B838A0',
  'Марсала/бордо':'#602838','Коричневий':'#6E4830','Сірий/графітовий':'#586058',
  'Червоний яскравий':'#C02030','Оливковий/зелений':'#A0A020',
};
export default function BookConstructorConfig({ productSlug }: BookConstructorConfigProps) {
    const t = useT();
    const locale = useLocale();
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
    const [selectedPageLamination, setSelectedPageLamination] = useState<string>(_saved?.selectedPageLamination || '');
    const [selectedPageColor, setSelectedPageColor] = useState<string>(_saved?.selectedPageColor || t('constructor.color_white_pl'));
    const [enableEndpaper, setEnableEndpaper] = useState(_saved?.enableEndpaper || false);
    const [enableKalka, setEnableKalka] = useState(_saved?.enableKalka || false);
    const [kalkaText, setKalkaText] = useState<string>(_saved?.kalkaText || '');

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
    const [selectedDecorationColor, setSelectedDecorationColor] = useState<string>(_saved?.selectedDecorationColor || '');

    // Lamination state (for Друкована cover only)
    const [selectedLamination, setSelectedLamination] = useState<string>(_saved?.selectedLamination || '');
    const [selectedCoverColor, setSelectedCoverColor] = useState<string>(_saved?.selectedCoverColor || '');

    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);

    useEffect(() => {
        // Starting a fresh book order from the catalog — drop any leftover
        // "editing this cart item" flag so a new configuration is ADDED to the
        // cart rather than replacing a previously edited item.
        try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('bookEditCartItemId'); } catch { /* ignore */ }
    }, []);

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
                        const vals = getOptionValues(option);
                        if (vals.length > 0) {
                            if (option.name === t('constructor.cover_type')) {
                                setSelectedCoverType(vals[0].name);
                            } else if (option.name === t('constructor.page_count')) {
                                setSelectedPageCount(vals[0].name);
                            } else if (option.name === t('constructor.copies_count')) {
                                setSelectedCopies(vals[0].name);
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

            if (pricesData) {
                setPhotobookPrices(pricesData);
            }

            // Fetch cover types
            const { data: coverTypesData, error: coverError } = await supabase
                .from('cover_types')
                .select('*')
                .order('sort_order', { ascending: true });

            if (coverError) console.error('[BookConstructor] cover_types error:', coverError);

            if (coverTypesData) {
                setCoverTypes(coverTypesData);
            }

            // Fetch photobook sizes
            const { data: sizesData } = await supabase
                .from('photobook_sizes')
                .select('*')
                .order('sort_order', { ascending: true });

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
            enableEndpaper, enableKalka, selectedDecorationType, selectedDecorationVariant, selectedDecorationColor,
            selectedLamination, selectedCoverColor, selectedPageLamination, selectedPageColor,
        };
        sessionStorage.setItem(`bookConfig_${productSlug}`, JSON.stringify(state));
    }, [selectedSize, selectedCoverType, selectedPageCount, selectedCopies,
        enableEndpaper, enableKalka, selectedDecorationType, selectedDecorationVariant, selectedDecorationColor,
        selectedLamination, selectedCoverColor, selectedPageLamination, selectedPageColor, productSlug]);

    // Pre-fill from URL query params (when coming from catalog product page)
    useEffect(() => {
        if (loading || !product) return;

        const size = searchParams.get('size');
        const pages = searchParams.get('pages');
        const tracing = searchParams.get('tracing');
        const endpaper = searchParams.get('endpaper');
        const lamination = searchParams.get('lamination');
        const cover = searchParams.get('cover');
        const decoration = searchParams.get('decoration');
        const decorationVariant = searchParams.get('decoration_variant');
        const decorationColor = searchParams.get('decoration_color');
        const coverColorParam = searchParams.get('cover_color');
        const pageLaminationParam = searchParams.get('page_lamination');
        const pageColor = searchParams.get('page_color');
        const textLayout = searchParams.get('text_layout');
        // Also read Ukrainian param names from catalog URL (legacy support)
        const coverFromCatalog = searchParams.get('Матеріал обкладинки') || searchParams.get('Матеріал+обкладинки');
        const colorFromCatalog = searchParams.get('Колір велюру') || searchParams.get('Колір+велюру')
            || searchParams.get('Колір тканини') || searchParams.get('Колір+тканини')
            || searchParams.get('Колір шкірзамінника') || searchParams.get('Колір+шкірзамінника')
            || searchParams.get('Колір шкірзаміннику') || searchParams.get('Колір+шкірзаміннику');
        const decorationFromCatalog = searchParams.get('Тип оздоблення') || searchParams.get('Тип+оздоблення')
            || searchParams.get('Тип оздоблення обкладинки') || searchParams.get('Тип+оздоблення+обкладинки');

        const pt = getProductType();

        // Cover color is applied BEFORE the pages guard because for dedicated
        // soft-cover slugs (photobook-leatherette, photobook-velour, photobook-fabric)
        // photobookOptions may not have initialized yet when the customer clicks
        // 'Відкрити редактор', so the URL may carry cover_color but not pages.
        // Without this early read the guard below exits the effect and the stale
        // sessionStorage color persists into the configurator.
        const coverColorEarly = coverColorParam || colorFromCatalog;
        if (coverColorEarly) {
            const colorNameEarly = coverColorEarly.replace(/\s*\([^)]*\)\s*$/, '').trim();
            setSelectedCoverColor(colorNameEarly || coverColorEarly);
        } else {
            // No color from URL — always reset to slug default so a stale old
            // session color never leaks through on a fresh catalog entry.
            // Back-navigation is safe: bookConstructorConfig early-return (below)
            // fires before this branch is reached.
            const sl = productSlug.toLowerCase();
            if (sl.includes('velour') || sl.includes('velyur')) setSelectedCoverColor('Бежевий');
            else if (sl.includes('leather')) setSelectedCoverColor('Бежевий');
            else if (sl.includes('fabric') || sl.includes('tkanina')) setSelectedCoverColor('Бежевий/пісочний');
        }

        if (!pages && pt !== 'wishbook') return; // Need at least pages to pre-fill (except wishbook)

        // Size (photobooks have size, magazines don't)
        if (size) {
            const sizeNorm = size.replace(/[хxX]/g, '×');
            const sizeMatch = photobookSizes.find((s: any) => s.name === sizeNorm || s.name === size);
            setSelectedSize(sizeMatch?.name || sizeNorm);
        }

        // Pages
        if (pages) setSelectedPageCount(pages.includes('сторінок') ? pages : `${pages} сторінок`);

        // Cover type: from URL or derive from product slug
        const coverValue = cover || coverFromCatalog;
        if (coverValue) {
            // Map Ukrainian catalog names to internal names
            // IMPORTANT: map to the same localized t() values the rest of the
            // component uses for comparisons (color picker, decoration variant
            // filter). Internal codes like 'leatherette'/'velour' break those
            // comparisons since they compare against t('constructor.*') strings.
            const coverMap: Record<string, string> = {
                'Велюрова': t('constructor.velour'),
                'Велюр': t('constructor.velour'),
                'velour': t('constructor.velour'),
                'Тканинна': t('constructor.fabric'),
                'Тканина': t('constructor.fabric'),
                'З тканини': t('constructor.fabric'),
                'fabric': t('constructor.fabric'),
                'leatherette': t('constructor.faux_leather'),
                'Друкована': t('constructor.printed'),
                'Друкована тверда': t('constructor.printed'),
                'printed': t('constructor.printed'),
            };
            // 'Шкірзамінник' not in map → falls through to || coverValue
            // which is already the correct localized name.
            setSelectedCoverType(coverMap[coverValue] || coverValue);
        } else {
            if (pt === 'photobook' || pt === 'wishbook') {
                const sl = productSlug.toLowerCase();
                if (sl.includes('velour') || sl.includes('velyur') || sl.includes(t('constructor.velour'))) setSelectedCoverType(t('constructor.velour'));
                else if (sl.includes('leather')) setSelectedCoverType(t('constructor.faux_leather'));
                else if (sl.includes('fabric') || sl.includes('tkanina')) setSelectedCoverType(t('constructor.fabric'));
                else if (sl.includes('printed') || sl.includes('drukov')) setSelectedCoverType(t('constructor.printed'));
                // Graduation photobooks are produced only with a printed hard
                // cover (no velour/fabric variant). Use the canonical
                // «Випускна» cover type: that is the cover_type the
                // photobook_prices matrix is keyed by for graduation books, so
                // the editor price lookup matches the catalog card. The editor
                // treats «Випускна» as a printed cover (see isPrinted).
                else if (sl.includes('graduation') || sl.includes('vypusk') || sl.includes('випуск')) setSelectedCoverType(t('constructor.graduation'));
            }
        }

        // Kalka / tracing. Enable ONLY for an explicit positive value; treat
        // anything carrying «без» (e.g. «Без кальки») or «none»/empty as OFF so
        // kalka is never silently added.
        if (tracing) {
            const tr = tracing.toLowerCase();
            setEnableKalka((tr === 'with' || tr === 'true' || tr === 'так' || tr.includes('калькою')) && !tr.includes('без'));
        }

        // Endpaper (Travel Book / hard-cover magazine). Treat the positive
        // values from ProductOptionsSelector («З друком», «з друком (+100 ₴)»)
        // as ON; anything with «без» or «none»/empty as OFF.
        if (endpaper) {
            const ep = endpaper.toLowerCase();
            setEnableEndpaper(ep !== 'none' && ep !== '' && !ep.includes('без'));
        }

        // Lamination (printed cover only)
        if (lamination) setSelectedLamination(lamination);

        // Page lamination — carried from the product card (designer flow has no
        // constructor, so the card is the only place it can be chosen).
        if (pageLaminationParam) setSelectedPageLamination(pageLaminationParam);

        // Decoration type + variant (from URL or Ukrainian catalog name)
        const decorationValue = decoration || decorationFromCatalog;
        if (decorationValue) {
            // Normalise any incoming form (internal id, short or full Ukrainian
            // label) to the DB decoration_types.name — the tiles AND the variant
            // filter below compare against that exact name, so mapping to an
            // internal id like 'metal' left the tile unselected and hid the
            // variant selector. (The editor re-detects the internal type from
            // this Ukrainian name via detectDecoType.)
            const decorationMap: Record<string, string> = {
                'Без оздоблення': 'none', 'none': 'none',
                'Акрил': 'Акрил', 'acryl': 'Акрил',
                'Фотовставка': 'Фотовставка', 'photovstavka': 'Фотовставка', 'photo_insert': 'Фотовставка',
                'Метал': 'Металева вставка', 'Металева вставка': 'Металева вставка', 'metal': 'Металева вставка',
                'Друк кольором': 'Друк кольором', 'Флекс': 'Друк кольором', 'flex': 'Друк кольором',
                'Гравірування': 'Гравірування', 'graviruvannya': 'Гравірування',
            };
            setSelectedDecorationType(decorationMap[decorationValue] || decorationValue);
        } else {
            // No decoration param in URL → reset to none so a stale session
            // value (e.g. 'Друк кольором' from a previous order) never surfaces
            // as the selected decoration on a fresh entry from the catalog.
            // Back-navigation is protected by the early-return a few lines below.
            setSelectedDecorationType('none');
            setSelectedDecorationVariant('');
        }
        // The variant can arrive as a generic key OR under its Ukrainian option
        // name — that's how the product page forwards the customer's choice.
        // NOTE: product.options values include the decoration-type prefix (e.g.
        // "Акрил Ø145 мм", "Фотовставка 100×100 мм") but decoration_variants
        // DB rows store variant_name WITHOUT prefix ("Ø145 мм", "100×100 мм").
        // Strip the prefix before setting so the dropdown pre-selection works.
        const variantFromCatalog = decorationVariant
            || searchParams.get('Варіант металевої вставки') || searchParams.get('Варіант+металевої+вставки')
            || searchParams.get('Варіант акрилу') || searchParams.get('Варіант+акрилу')
            || searchParams.get('Варіант фотовставки') || searchParams.get('Варіант+фотовставки');
        if (variantFromCatalog) {
            const strippedVariant = variantFromCatalog
                .replace(/^(Акрил|Acryl|Фотовставка|Photo\s*insert|Photo\s*вставка)\s+/i, '')
                .trim();
            setSelectedDecorationVariant(strippedVariant || variantFromCatalog);
        }
        if (decorationColor) setSelectedDecorationColor(decorationColor);

        // Page color (wishbook only)
        if (pageColor) {
            setSelectedPageColor(pageColor);
        }

        // Auto-advance to editor is for the FIRST entry from the product
        // card only. If a bookConstructorConfig already lives in
        // sessionStorage, it means the user was in the editor and pressed
        // "Назад" — pushing them forward again would trap them in a loop
        // (back → config page → 150ms timer → editor → repeat). Only the
        // editor's addToCart clears this key, so its presence is a reliable
        // "user has been past this step already" marker.
        if (typeof window !== 'undefined' && sessionStorage.getItem('bookConstructorConfig')) {
            return;
        }
        // Also don't auto-advance if the user explicitly pressed "Назад"
        // from the upload step — they want to review/change options.
        if (typeof window !== 'undefined' && sessionStorage.getItem('bookConfigBackNav')) {
            sessionStorage.removeItem('bookConfigBackNav');
            return;
        }
        setAutoAdvance(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, product, photobookSizes.length]);

    // Auto-advance: skip Step 1 and go directly to photo upload
    useEffect(() => {
        if (!autoAdvance || loading || !product) return;
        const pt = getProductType();
        const timer = setTimeout(() => {
            // For magazines/travelbooks: ensure selectedPageCount matches the
            // URL param before auto-advancing. If _saved had a different page
            // count (e.g. 12 from a previous order), the URL-param useEffect
            // will update it, but that setState is async — the 150ms timer
            // might fire while selectedPageCount still holds the stale value.
            // Guard: compare against the raw URL param and bail if they differ;
            // the dependency array re-triggers this effect once state catches up.
            const urlPages = searchParams.get('pages');
            if (urlPages && (pt === 'travelbook' || pt === 'magazine')) {
                const urlPagesNum = parseInt(urlPages, 10);
                const statePagesNum = parseInt((selectedPageCount || '').match(/\d+/)?.[0] || '0', 10);
                if (statePagesNum !== urlPagesNum) return; // wait for state to sync
            }
            // Photobooks need size + pages; wishbook needs size + cover; magazines/travelbooks need just pages
            const canAdvance = pt === 'photobook'
                ? (selectedSize && selectedPageCount && (selectedCoverType === t('constructor.printed') || selectedCoverColor) && photobookPrices.length > 0)
                : pt === 'wishbook'
                ? (selectedSize && selectedCoverType && (selectedCoverType === t('constructor.printed') || selectedCoverColor))
                : selectedPageCount;
            if (canAdvance) {
                handleContinue();
            }
        }, 150);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoAdvance, selectedSize, selectedPageCount, selectedCoverType, selectedCoverColor, photobookPrices.length]);

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

            // Diagnostic: log when match is missing or when fallback fires.
            // Helps trace the "shows 600 ₴ for 25×25/16/Друкована" bug —
            // most likely cause is selectedSize / selectedCoverType being
            // empty or different from what the UI displays at save time.
            if (!priceEntry && typeof window !== 'undefined') {
                const distinctSizes = Array.from(new Set(photobookPrices.map((p: any) => p.size?.name)));
                const distinctCovers = Array.from(new Set(photobookPrices.map((p: any) => p.cover_type?.name)));
                console.log('[TM-photobook-price] no exact match', {
                  selectedSize, selectedCoverType, pageNum,
                  pricesLoaded: photobookPrices.length,
                  distinctSizes, distinctCovers,
                });
            }

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

                // Multiply by copies count
                const copiesNum = parseInt(selectedCopies) || 1;
                return total * copiesNum;
            }

            // Fallback: find closest available page count for this size/cover
            const available = photobookPrices.filter((p: any) =>
                p.cover_type?.name === selectedCoverType && p.size?.name === selectedSize
            ).sort((a: any, b: any) => a.page_count - b.page_count);
            if (available.length > 0) {
                const closest = available.reduce((prev: any, curr: any) =>
                    Math.abs(curr.page_count - pageNum) < Math.abs(prev.page_count - pageNum) ? curr : prev
                );
                let total = closest.base_price || 0;
                // Same kalka surcharge as the exact-match path — otherwise a
                // nearest-page-count fallback silently dropped the +300 ₴.
                if (enableKalka && closest.kalka_surcharge) {
                    total += Number(closest.kalka_surcharge) || 0;
                }
                const copiesNum = parseInt(selectedCopies) || 1;
                return total * copiesNum;
            }
            return 0;
        }

        // ==============================
        // ==============================
        // MAGAZINE / JOURNAL PRICING (single-source helpers per product type)
        // ==============================
        if (productType === 'magazine' || productType === 'photo-journal-soft' || productType === 'photo-journal-hard') {
            const pageNum = parseInt(selectedPageCount?.match(/\d+/)?.[0] || '0');
            const copiesNum = parseInt(selectedCopies) || 1;
            // text_layout can arrive in several shapes:
            //   'own' / 'with'              — customer writes / legacy "with text"
            //   'we' / 'we-basic'/'we-premium' — we write it (these normally go
            //                                  to the brief, but guard anyway)
            //   'none'                      — no text
            //   t('constructor.with_text') / label — verbatim label from an old card
            //   '' / null                   — option not selected (no text)
            // Any value that means "there is text" must add the typesetting
            // surcharge. Previously only 'with' / 'текстом' / 'верстк' matched,
            // so the new canonical 'own' value slipped through as no-text and
            // the +195 ₴ never reached the constructor's price (showed 683
            // instead of 878 for an 8-page urgent magazine with own text).
            const textLayoutRaw = searchParams.get('text_layout') || '';
            const tl = textLayoutRaw.toLowerCase();
            const hasText = tl === 'own' || tl === 'with' ||
                            tl === 'we' || tl === 'we-basic' || tl === 'we-premium' ||
                            tl.includes('текстом') || tl.includes('верстк') ||
                            tl.includes('власн') || tl.includes('пишемо');

            // Pick the right helper. Hard journal uses its own scale
            // (12–80 ст starting at 675 ₴), not the soft/magazine scale.
            // IMPORTANT: compute the BASE price WITHOUT typesetting here.
            // The +195 ₴ typesetting is a flat labour fee that must be
            // added AFTER the urgency multiplier, not before — otherwise
            // the rush surcharge inflates it too:
            //   wrong: (525 + 195) × 1.3 = 936
            //   right:  525 × 1.3 + 195 = 878
            // This mirrors how the product detail page prices it.
            // getProductType() returns 'magazine' for EVERY *zhurnal* slug, so
            // the hard cover can't be told apart by productType. Detect it by
            // slug: the hard journal shares Travel Book's higher scale (soft
            // +100 ₴ at every page count) and is the only journal that offers
            // per-page lamination. Without this the constructor priced the
            // hard journal on the soft scale and dropped the +7 ₴/стор.
            const isHardJournal = /tverd|hardcover|photojournal-hard/.test(productSlug);
            let basePrice: number;
            if (pageNum > 0) {
                if (isHardJournal) {
                    basePrice = getPhotojournalHardPrice(pageNum);
                } else {
                    // magazine + soft journal share the same scale.
                    // Pass false — typesetting is added below as a flat extra.
                    basePrice = getMagazinePrice(pageNum, false);
                }
            } else {
                basePrice = product.price || 525;
            }

            let magazineTotal = basePrice * copiesNum;

            // Page lamination — flat per-page surcharge (7 ₴/стор). Applies
            // to hard journal and Travel Book per Diana's price list.
            if (isHardJournal && isPageLaminationSelected(selectedPageLamination)) {
                magazineTotal += pageNum * LAMINATION_PRICE_PER_PAGE;
            }

            // Urgent production surcharge (+30%). The product detail page
            // sends this either as the canonical value ('standard' / 'urgent')
            // or as the verbatim label (t('constructor.express_delivery')) depending
            // on whether the option was just chosen (canonical) or hydrated
            // from sessionStorage (label). isUrgent must be true only when
            // the value is explicitly urgent — anything else (empty, '0',
            // 'standard', or a label containing 'стандартна') means standard.
            const urgentRaw = (searchParams.get('urgent') || '').toLowerCase();
            const isUrgent = urgentRaw !== '' &&
                             urgentRaw !== '0' &&
                             urgentRaw !== 'standard' &&
                             !urgentRaw.includes('стандартна');
            if (isUrgent) {
                magazineTotal = Math.round(magazineTotal * (1 + URGENT_MULTIPLIER));
            }

            // Typesetting (+195 ₴) added AFTER urgency so the rush doesn't
            // compound it. Applies to all journal types when text is chosen.
            if (hasText) {
                magazineTotal += TYPESETTING_PRICE;
            }
            return magazineTotal;
        }

        // ==============================
        // WISHBOOK PRICING (cover material × size, table-based)
        // ==============================
        if (productType === 'wishbook') {
            // Scrapbooks share the wishbook UI flow but are simple
            // fixed-price products (no per-size velour matrix). Diverting
            // them through WISHBOOK_PRICES makes a 30×20 scrapbook cost
            // ~1059 ₴ instead of its real 525 ₴ from products.price.
            // Detect by slug, take the DB price, add decoration surcharge
            // like wishbook does, multiply by copies.
            if (productSlug.includes('scrapbook')) {
                let total = product.price || 0;
                if (selectedDecorationType !== 'none' && selectedDecorationVariant) {
                    const decVariant = decorationVariants.find(
                        (dv: any) => dv.decoration_type?.name === selectedDecorationType &&
                        dv.variant_name === selectedDecorationVariant &&
                        dv.cover_type?.name === selectedCoverType &&
                        dv.size?.name === selectedSize
                    );
                    if (decVariant) total += Number(decVariant.surcharge) || 0;
                }
                const copiesNum = parseInt(selectedCopies) || 1;
                return total * copiesNum;
            }

            // Price table: WISHBOOK_PRICES[cover_type][page_color][size]
            // Black/Cream pages use thicker stock → higher price.

            const sizeKey = selectedSize || '30×20';
            const coverKey = selectedCoverType || t('constructor.velour');
            const colorKey = selectedPageColor || t('constructor.color_white_pl');
            let total = getWishbookPrice(coverKey, colorKey, sizeKey);

            if (!total) {
                const altSize = sizeKey.replace(/×/g, 'x');
                total = getWishbookPrice(coverKey, colorKey, altSize);
            }
            if (!total) total = product.price || 559;

            // Add decoration surcharge from decoration_variants table if applicable
            if (selectedDecorationType !== 'none' && selectedDecorationVariant) {
                const decVariant = decorationVariants.find(
                    (dv: any) => dv.decoration_type?.name === selectedDecorationType &&
                    dv.variant_name === selectedDecorationVariant &&
                    dv.cover_type?.name === selectedCoverType &&
                    dv.size?.name === selectedSize
                );
                if (decVariant) total += Number(decVariant.surcharge) || 0;
            }

            const copiesNum = parseInt(selectedCopies) || 1;
            return total * copiesNum;
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

                if (option.name === t('constructor.cover_type')) {
                    selectedValue = selectedCoverType;
                } else if (option.name === t('constructor.page_count')) {
                    selectedValue = selectedPageCount;
                } else if (option.name === t('constructor.copies_count')) {
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

        // Page lamination — flat per-page surcharge (7 ₴/стор per Diana's
        // May 2026 price list). Applies to Travel Book; hard journal handles
        // it in the magazine/journal branch above.
        if (productType === 'travelbook' && isPageLaminationSelected(selectedPageLamination)) {
            const pageNum = parseInt(selectedPageCount?.match(/\d+/)?.[0] || '0');
            if (pageNum > 0) total += pageNum * LAMINATION_PRICE_PER_PAGE;
        }

        // Add surcharges for endpaper (travel book and hard cover magazines)
        if (productType === 'travelbook' && enableEndpaper) {
            total += 100; // Друк на форзаці для Travel Book
        }

        if (productType === 'magazine' && selectedCoverType.includes(t('constructor.hardcover')) && enableEndpaper) {
            total += 100; // Друк на форзаці для журналу з твердою обкладинкою
        }

        // Travel Book urgency: +30% on the full total (pages + lamination +
        // forzac), mirroring the magazine/hard-journal branch above.
        if (productType === 'travelbook') {
            const urgentRaw = (searchParams.get('urgent') || '').toLowerCase();
            const isUrgent = urgentRaw !== '' && urgentRaw !== '0' &&
                             urgentRaw !== 'standard' &&
                             !urgentRaw.includes('стандартна');
            if (isUrgent) total = Math.round(total * (1 + URGENT_MULTIPLIER));
        }

        return total;
    };

    const getProductType = (): string => {
        if (productSlug.includes('photobook')) return 'photobook';
        if (productSlug.includes('magazine') || productSlug.includes('journal') || productSlug.includes('zhurnal') || productSlug.includes('fotozhurnal')) return 'magazine';
        if (productSlug.includes('travel')) return 'travelbook';
        // scrapbook (альбоми для вклейки фото) shares wishbook flow — fixed pages, no
        // page count selector, simple cover material picker. The only difference is
        // handled downstream: BookLayoutEditor hides cover templates for scrapbook.
        if (productSlug.includes('scrapbook')) return 'wishbook';
        if (productSlug.includes('wish') || productSlug.includes('guest') || productSlug.includes('pobazhan')) return 'wishbook';
        return '';
    };

    // Photo recommendation lookup key — diverges from getProductType() because
    // the hard-cover and soft-cover photojournals share the 'magazine' product
    // type for pricing (legacy), but have different photo-capacity tables.
    const getPhotoRecKey = (): string => {
        if (productSlug.includes('photobook')) return 'photobook';
        if (productSlug.includes('photojournal-hard') || productSlug.includes('tverd') || productSlug.includes('hardcover')) return 'photojournal-hard';
        if (productSlug.includes('magazine') || productSlug.includes('journal') || productSlug.includes('zhurnal') || productSlug.includes('fotozhurnal')) return 'magazine';
        if (productSlug.includes('travel')) return 'travelbook';
        return '';
    };

    const getPhotoRecommendation = (): { mixed: string; collage?: string } | null => {
        if (!selectedPageCount) return null;

        const pageNum = parseInt(selectedPageCount.match(/\d+/)?.[0] || '0');
        if (pageNum === 0) return null;

        const recKey = getPhotoRecKey();
        const recommendations = PHOTO_RECOMMENDATIONS[recKey] || [];
        if (recommendations.length === 0) return null;

        // Try exact match first
        const exact = recommendations.find(r => r.pages === pageNum);
        if (exact) {
          // For magazines / travelbooks / hard-cover journals the
          // tier table has no `collage` column — only `mixed`. We
          // intentionally omit the field rather than emitting
          // undefined so the consumer can switch on its presence.
          return exact.collage
            ? { mixed: exact.mixed, collage: exact.collage }
            : { mixed: exact.mixed };
        }

        // Fallback: closest lower match (extend the range proportionally)
        const lower = [...recommendations].reverse().find(r => r.pages <= pageNum);
        if (lower) {
            const diff = pageNum - lower.pages;
            const [lo, hi] = lower.mixed.replace(/[^\d-]/g, '').split('-').map(Number);
            const result: { mixed: string; collage?: string } = {
                mixed: `${lo + diff}-${(hi || lo) + diff} фото`,
            };
            if (lower.collage) {
                const collageNum = parseInt(lower.collage.replace(/[^\d]/g, '')) || 0;
                result.collage = collageNum ? `${collageNum + Math.round(diff * 2.5)} фото` : lower.collage;
            }
            return result;
        }

        // Ultimate fallback: rough formula
        return {
            mixed: `${pageNum + 1}-${Math.round(pageNum * 1.5)} фото`,
        };
    };

    const shouldShowEndpaperOption = (): boolean => {
        const productType = getProductType();

        // Travel Book always has endpapers
        if (productType === 'travelbook') return true;

        // Magazine with hard cover has endpapers
        if (productType === 'magazine' && selectedCoverType.includes(t('constructor.hardcover'))) return true;

        return false;
    };

    const shouldShowKalkaOption = (): boolean => {
        const productType = getProductType();
        return productType === 'photobook';
    };

    const handleContinue = () => {
        // Validate cover color — but only for photobook products that
        // have a soft material cover (velour / fabric / leatherette).
        // Journals (soft and hard-cover), travelbooks and other product
        // types either have a printed cover where the colour comes from
        // the printed design itself, or have no cover-colour palette
        // at all. Previously this check fired for every product with a
        // non-"Друкована" cover type, but the hard-cover journal's
        // "Глянцева"/"Матова" values describe the lamination finish,
        // not the cover material, so the alert popped up asking for
        // a colour the product doesn't have.
        const productType = getProductType();
        const isPhotobookProduct = productType === 'photobook';
        if (isPhotobookProduct && selectedCoverType && selectedCoverType !== t('constructor.printed') && !selectedCoverColor) {
            alert(t('book_config.choose_cover_color_alert'));
            return;
        }
        // Store configuration in sessionStorage
        const config = {
            productSlug,
            productId: product?.id,
            productName: product?.name,
            selectedSize,
            selectedCoverType,
            selectedPageCount,
            selectedCopies,
            enableEndpaper,
            enableKalka,
            kalkaText: enableKalka ? (kalkaText || null) : null,
            selectedLamination: selectedLamination || null,
            selectedPageLamination: selectedPageLamination || null,
            selectedPageColor: selectedPageColor || t('constructor.color_white_pl'),
            selectedCoverColor: selectedCoverColor || null,
            selectedDecorationType: selectedDecorationType !== 'none' ? selectedDecorationType : null,
            selectedDecorationVariant: selectedDecorationVariant || null,
            selectedDecorationColor: (selectedDecorationType !== 'none' && selectedDecorationColor) ? selectedDecorationColor : null,
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
            totalPrice: (() => {
                const computed = calculatePrice();
                if (computed && computed > 0) return computed;
                // Safety net: if local pricing couldn't resolve (e.g. designer
                // flow combos), use the price passed in the URL so the editor
                // never lands on 0 and refuses to add to cart.
                const urlPrice = parseInt(searchParams.get('price') || '0', 10);
                return urlPrice > 0 ? urlPrice : computed;
            })(),
            photoRecommendation: getPhotoRecommendation(),
            minPageCount: (() => {
                // Minimum pages varies by product type.
                //
                // For photobooks/journals/wishbooks we read it from the
                // Supabase photobook_prices table (filtered by the chosen
                // size and cover) since pricing tiers per format vary.
                //
                // For magazines and travelbooks we use the static
                // PHOTO_RECOMMENDATIONS tier list declared at the top of
                // this file — the price table in photobook_prices is
                // photobook-only, so deriving min from it would always
                // return the fallback (6) and let customers through the
                // editor with too few pages. Magazine minimum is 8,
                // travelbook minimum is 12 per the tier lists.
                const pt = getProductType();
                if (pt === 'magazine' || pt === 'travelbook') {
                    const tiers = PHOTO_RECOMMENDATIONS[pt];
                    return tiers && tiers.length > 0 ? tiers[0].pages : 8;
                }
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
        // Wishbook — uses same editor as photobooks (cover editor + layout)

        // Navigate to photo upload step (Phase 2) with all params
        const params = new URLSearchParams();
        params.set('product', productSlug);
        if (selectedSize) params.set('size', selectedSize);
        if (selectedPageCount) params.set('pages', selectedPageCount.replace(/[^\d]/g, ''));
        if (selectedCoverType) params.set('cover', selectedCoverType);
        if (selectedPageColor) params.set('page_color', selectedPageColor);
        if (enableKalka) params.set('tracing', 'with');
        if (enableKalka && kalkaText) params.set('kalka_text', encodeURIComponent(kalkaText));
        if (selectedLamination) params.set('lamination', selectedLamination);
        if (selectedDecorationType !== 'none') params.set('decoration', selectedDecorationType);
        if (selectedDecorationVariant) params.set('decoration_variant', selectedDecorationVariant);
        if (selectedDecorationType !== 'none' && selectedDecorationColor) params.set('decoration_color', selectedDecorationColor);
        // Pass through any URL params from catalog page (like text_layout)
        const textLayout = searchParams.get('text_layout');
        if (textLayout) params.set('text_layout', textLayout);
        // Forward urgent flag (magazine only — passed by ProductClient via
        // keyMap[t('constructor.urgency')]='urgent'). The editor reads it the same
        // way we did above to apply the +30% surcharge in its own price
        // display.
        const urgent = searchParams.get('urgent');
        if (urgent) params.set('urgent', urgent);
        // Wishbook/guestbook — skip photo upload, go straight to full cover editor (same as photobook editor, cover-only mode)
        if (pt === 'wishbook') {
            router.push(`/editor/book/layout?${params.toString()}`);
            return;
        }

        router.push(`/editor/book/upload?${params.toString()}`);
    };

    // Decoration types available per cover material. Mirrors the product page
    // (ProductOptionsSelector): availability is a property of the COVER, not the
    // selected size. decoration_variants only drive a type's sub-options (e.g.
    // metal-insert sizes, which currently exist for leatherette only), so the
    // type list must NOT be gated on a size/variant match — that hid every
    // decoration until a size was picked and hid velour/fabric decorations
    // entirely (they have no variant rows).
    const availableDecorationTypes = (): any[] => {
        const coverLc = (selectedCoverType || '').toLowerCase();
        const isLeatherCover = coverLc.includes('шкір') || coverLc.includes('leather');
        const isFabricCover = coverLc.includes('ткан') || coverLc.includes('fabric');
        // Leatherette: no flex print / engraving. Fabric: no engraving. Velour: all.
        const blocked = isLeatherCover
            ? [t('constructor.color_print'), t('constructor.engraving')]
            : isFabricCover
                ? [t('constructor.engraving')]
                : [];
        return decorationTypes.filter((dt: any) => !blocked.includes(dt.name));
    };

    // Whether the currently-selected decoration type has selectable variants for
    // this cover. Only then is picking a variant mandatory before continuing.
    const selectedDecorationRequiresVariant = (): boolean => {
        if (selectedDecorationType === 'none') return false;
        return decorationVariants.some((dv: any) =>
            dv.decoration_type?.name === selectedDecorationType &&
            dv.cover_type?.name === selectedCoverType
        );
    };

    const isFormValid = (): boolean => {
        const pt = getProductType();

        if (pt === 'photobook') {
            if (!selectedSize) return false;
            if (!selectedCoverType) return false;
            if (!selectedPageCount) return false;
            if (selectedCoverType === t('constructor.printed') && !selectedLamination) return false;
            if (selectedDecorationRequiresVariant() && !selectedDecorationVariant) return false;
            if (selectedCoverType !== t('constructor.printed') && !selectedCoverColor) return false;
            return true;
        }

        // Wishbook validation — same as photobook but fixed sizes
        if (pt === 'wishbook') {
            if (!selectedSize) return false;
            if (!selectedCoverType) return false;
            if (selectedCoverType !== t('constructor.printed') && !selectedCoverColor) return false;
            if (selectedCoverType === t('constructor.printed') && !selectedLamination) return false;
            if (selectedDecorationRequiresVariant() && !selectedDecorationVariant) return false;
            return true;
        }

        // Non-photobook validation
        if (product?.variants && product.variants.length > 0 && !selectedSize) return false;

        if (product?.options) {
            const options = product.options as ProductOption[];
            const requiredCoverType = options.some(o => o.name === t('constructor.cover_type'));
            if (requiredCoverType && !selectedCoverType) return false;
            const requiredPageCount = options.some(o => o.name === t('constructor.page_count'));
            if (requiredPageCount && !selectedPageCount) return false;
        }

        return true;
    };

    // Human-readable list of the still-unselected required fields. Mirrors
    // isFormValid() exactly. Used to explain WHY the continue button is greyed
    // out — previously a user who e.g. went back, changed the size (which clears
    // the page count) or re-picked the cover (which clears colour + lamination)
    // saw a dead, unexplained disabled button with no hint of what to fix.
    const missingRequirements = (): string[] => {
        const pt = getProductType();
        const out: string[] = [];
        if (pt === 'photobook') {
            if (!selectedSize) out.push(t('book_config.size_label'));
            if (!selectedCoverType) out.push(t('book_config.cover_type'));
            if (!selectedPageCount) out.push(t('book_config.page_count'));
            if (selectedCoverType === t('constructor.printed') && !selectedLamination) out.push(t('book_config.lamination_type'));
            if (selectedDecorationRequiresVariant() && !selectedDecorationVariant) out.push(t('book_config.decoration'));
            if (selectedCoverType && selectedCoverType !== t('constructor.printed') && !selectedCoverColor) out.push(t('book_config.cover_color'));
            return out;
        }
        if (pt === 'wishbook') {
            if (!selectedSize) out.push(t('book_config.size_label'));
            if (!selectedCoverType) out.push(t('book_config.cover_type'));
            if (selectedCoverType && selectedCoverType !== t('constructor.printed') && !selectedCoverColor) out.push(t('book_config.cover_color'));
            if (selectedCoverType === t('constructor.printed') && !selectedLamination) out.push(t('book_config.lamination_type'));
            if (selectedDecorationRequiresVariant() && !selectedDecorationVariant) out.push(t('book_config.decoration'));
            return out;
        }
        if (product?.variants && product.variants.length > 0 && !selectedSize) out.push(t('book_config.size_label'));
        if (product?.options) {
            const options = product.options as ProductOption[];
            if (options.some(o => o.name === t('constructor.cover_type')) && !selectedCoverType) out.push(t('book_config.cover_type'));
            if (options.some(o => o.name === t('constructor.page_count')) && !selectedPageCount) out.push(t('book_config.page_count'));
        }
        return out;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">{t('book_config.loading')}</div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-red-500">{t('book_config.product_not_found')}</div>
            </div>
        );
    }

    const totalPrice = calculatePrice();
    const photoRec = getPhotoRecommendation();
    const productType = getProductType();
    // Each photobook product is cover-type-specific: photobook-printed,
    // photobook-velour, photobook-fabric, photobook-leatherette, graduation.
    // The cover type is fixed by the product slug (resolved into
    // selectedCoverType on mount), so the cover-type *selector* must NOT be
    // shown — otherwise a customer on the printed photobook could switch to
    // velour and unlock colours/decorations that this product doesn't offer.
    const coverTypeLockedBySlug = /velour|velyur|leather|fabric|tkanina|printed|drukov|graduation|vypusk|випуск/i.test(productSlug);

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-[#1e2d7d] mb-2">
                    {(() => {
                        const localizedName = getLocalized(product, locale, 'name');
                        const fallback = productType === 'wishbook'
                            ? t('book_config.wishbook_name')
                            : t('book_config.photobook_name');
                        return localizedName || product?.name || fallback;
                    })()}
                </h1>
                <p className="text-gray-600">{t('book_config.step1_title')}</p>
            </div>

            {/* Configuration Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-8 mb-8">
                <h2 className="text-xl font-bold text-[#1e2d7d] mb-6">{t('book_config.choose_params')}</h2>

                <div className="space-y-6">

                    {/*  Wishbook: Fixed sizes (identical style to photobook)  */}
                    {productType === 'wishbook' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.size_label')} <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    { name: '20×30', w: 20, h: 30, label: t('book_config.vertical') },
                                    { name: '30×20', w: 30, h: 20, label: t('book_config.horizontal') },
                                    { name: '23×23', w: 23, h: 23, label: t('book_config.square') },
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

                    {/*  Wishbook: Cover type — identical to photobook  */}
                    {productType === 'wishbook' && (() => {
                        const types = coverTypes.length > 0 ? coverTypes : [
                            { id: 'w1', name: t('constructor.velour'), sort_order: 1 },
                            { id: 'w2', name: t('constructor.faux_leather'), sort_order: 2 },
                            { id: 'w3', name: t('constructor.fabric'), sort_order: 3 },
                            { id: 'w4', name: t('constructor.printed'), sort_order: 4 },
                        ];
                        return (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.cover_type')} <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {types.filter((c: any) => c.name !== t('constructor.graduation') && !c.name.includes('файлик')).sort((a: any, b: any) => a.sort_order - b.sort_order).map((cover: any) => (
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
                    ); })()}

                    {/*  Wishbook: Color swatches — identical to photobook  */}
                    {productType === 'wishbook' && selectedCoverType && selectedCoverType !== t('constructor.printed') && (() => {
                        const colors = selectedCoverType === t('constructor.faux_leather') ? LEATHERETTE_BOOK_COLORS
                            : selectedCoverType === t('constructor.fabric') ? FABRIC_BOOK_COLORS
                            : VELOUR_COLORS;
                        return (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    {t('book_config.cover_color')} <span className="text-red-500">*</span>
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
                                    <p className="text-sm text-gray-500 mt-2">{t('book_config.selected_label')} <strong>{selectedCoverColor}</strong></p>
                                )}
                            </div>
                        );
                    })()}

                    {/*  Wishbook: Lamination for Друкована — identical to photobook  */}
                    {productType === 'wishbook' && selectedCoverType === t('constructor.printed') && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.lamination_type')} <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {[t('constructor.glossy'), t('constructor.matte')].map(lam => (
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

                    {/*  Wishbook: Page color  */}
                    {productType === 'wishbook' && selectedCoverType && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Колір сторінок <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {([t('constructor.color_white_pl'), t('constructor.color_black_pl'), t('constructor.color_cream')] as const).map(color => (
                                    <button key={color} type="button"
                                        onClick={() => setSelectedPageColor(color)}
                                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                                            selectedPageColor === color
                                                ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                                : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                        }`}>
                                        <span className="block text-base font-bold">{color}</span>
                                        {color !== t('constructor.color_white_pl') && <span className="block text-xs text-gray-500 mt-1">+300–380 ₴</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/*  Wishbook: Decoration types — identical to photobook  */}
                    {productType === 'wishbook' && selectedCoverType && selectedCoverType !== t('constructor.printed') && decorationTypes.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.decoration')}
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <button type="button"
                                    onClick={() => { setSelectedDecorationType('none'); setSelectedDecorationVariant(''); }}
                                    className={`p-3 rounded-lg border-2 text-center transition-all text-sm ${
                                        selectedDecorationType === 'none'
                                            ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]'
                                            : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                    }`}>
                                    <span className="block font-bold">{t('book_config.no_decoration')}</span>
                                </button>
                                {availableDecorationTypes().map((dt: any) => {
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

                    {/*  Wishbook: Decoration variant — identical to photobook  */}
                    {productType === 'wishbook' && selectedDecorationType !== 'none' && selectedCoverType && selectedCoverType !== t('constructor.printed') && selectedSize && (() => {
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
                                    <option value="">{t('book_config.choose_variant')}</option>
                                    {variants.map((v: any) => (
                                        <option key={v.id} value={v.variant_name}>
                                            {v.variant_name}{Number(v.surcharge) > 0 ? ` (+${v.surcharge} ₴)` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })()}

                    {/*  Photobook: Size selector from photobook_sizes  */}
                    {productType === 'photobook' && photobookSizes.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.size_label')} <span className="text-red-500">*</span>
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
                                        {(() => {
                                            const minPrice = Math.min(...photobookPrices
                                                .filter((p: any) => p.size?.name === size.name && p.cover_type?.name === selectedCoverType)
                                                .map((p: any) => p.base_price || 0)
                                                .filter((v: number) => v > 0));
                                            return isFinite(minPrice) ? (
                                                <span className="block text-xs font-semibold text-[#1e2d7d] mt-1">від {minPrice} ₴</span>
                                            ) : null;
                                        })()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/*  Photobook: Cover type selector from cover_types  */}
                    {productType === 'photobook' && coverTypes.length > 0 && !coverTypeLockedBySlug && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.cover_type')} <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {coverTypes.filter((c: any) => c.name !== t('constructor.graduation') && !c.name.includes('файлик')).sort((a: any, b: any) => a.sort_order - b.sort_order).map((cover: any) => (
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

                    {/*  Cover color picker for soft covers  */}
                    {productType === 'photobook' && selectedCoverType && selectedCoverType !== t('constructor.printed') && (() => {
                        const colors = selectedCoverType === t('constructor.faux_leather') ? LEATHERETTE_BOOK_COLORS
                            : selectedCoverType === t('constructor.fabric') ? FABRIC_BOOK_COLORS
                            : VELOUR_COLORS;
                        return (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-3">
                                    {t('book_config.cover_color')} <span className="text-red-500">*</span>
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
                                    <p className="text-sm text-gray-500 mt-2">{t('book_config.selected_label')} <strong>{selectedCoverColor}</strong></p>
                                )}
                            </div>
                        );
                    })()}

                    {/*  Photobook: Lamination for Друкована cover  */}
                    {productType === 'photobook' && selectedCoverType === t('constructor.printed') && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.lamination_type')} <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {[t('constructor.glossy'), t('constructor.matte')].map((lam) => (
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

                    {/*  Photojournal hard cover: Lamination — always shown (cover is always printed)  */}
                    {productType === 'photojournal-hard' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.lamination_type')} <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {[t('constructor.glossy'), t('constructor.matte')].map((lam) => (
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

                    {/*  Photobook: Decoration selector (not for Друкована)  */}
                    {productType === 'photobook' && selectedCoverType && selectedCoverType !== t('constructor.printed') && decorationTypes.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                {t('book_config.decoration')}
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
                                    <span className="block font-bold">{t('book_config.no_decoration')}</span>
                                </button>
                                {availableDecorationTypes().map((dt: any) => {
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

                    {/*  Photobook: Decoration variant sub-options  */}
                    {productType === 'photobook' && selectedDecorationType !== 'none' && selectedCoverType && selectedCoverType !== t('constructor.printed') && selectedSize && (() => {
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
                                    <option value="">{t('book_config.choose_variant')}</option>
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

                    {/*  Photobook: Page count selector from photobook_prices  */}
                    {productType === 'photobook' && photobookPrices.length > 0 && selectedSize && selectedCoverType && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {t('book_config.page_count')} <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedPageCount}
                                onChange={(e) => setSelectedPageCount(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                            >
                                <option value="">{t('book_config.choose_page_count')}</option>
                                {(() => {
                                    // Filter by min_pages from product.options. The
                                    // photobook_prices table happens to contain rows
                                    // for every page count regardless of size (a
                                    // legacy of how the matrix is laid out), so
                                    // without this gate the customer would see 6
                                    // pages as an option even when they picked the
                                    // 20×30 size whose minimum is 10. Pull min_pages
                                    // off the matching size row in product.options
                                    // and drop anything below it.
                                    let minPagesForSize = 0;
                                    const sizeOpt = (product?.options as any[])?.find((o: any) => o?.name === 'Розмір');
                                    if (sizeOpt && Array.isArray(sizeOpt.options)) {
                                        const sizeNorm = (selectedSize || '').replace(/[хxX]/g, '×');
                                        const match = sizeOpt.options.find((s: any) =>
                                            s?.label === selectedSize || s?.label === sizeNorm ||
                                            s?.value === selectedSize || s?.value === sizeNorm ||
                                            (s?.label && (s.label.includes(sizeNorm) || s.label.includes(selectedSize)))
                                        );
                                        minPagesForSize = Number(match?.min_pages || 0);
                                    }
                                    const allPageCounts = [...new Set(photobookPrices
                                        .filter((p: any) => p.cover_type?.name === selectedCoverType && p.size?.name === selectedSize)
                                        .map((p: any) => p.page_count)
                                    )].sort((a: number, b: number) => a - b);
                                    const filteredPageCounts = minPagesForSize > 0
                                        ? allPageCounts.filter((pc) => pc >= minPagesForSize)
                                        : allPageCounts;
                                    return filteredPageCounts.map((pageCount) => {
                                        const priceEntry = photobookPrices.find(
                                            (p: any) => p.cover_type?.name === selectedCoverType && p.size?.name === selectedSize && p.page_count === pageCount
                                        );
                                        return (
                                            <option key={pageCount} value={`${pageCount} сторінок`}>
                                                {pageCount} сторінок — {priceEntry?.base_price || 0} ₴
                                            </option>
                                        );
                                    });
                                })()}
                            </select>
                        </div>
                    )}

                    {/*  Non-photobook: Size from product.variants  */}
                    {productType !== 'photobook' && product.variants && product.variants.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {t('book_config.size_label')} <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedSize}
                                onChange={(e) => { setSelectedSize(e.target.value); setSelectedPageCount(''); }}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                            >
                                {product.variants.map((variant) => (
                                    <option key={variant.name} value={variant.name}>
                                        {variant.name} — від {variant.price} ₴
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/*  Non-photobook: Dynamic options from product.options  */}
                    {productType !== 'photobook' && product.options && (product.options as ProductOption[]).filter((option) => HANDLED_OPTION_NAMES.includes(option.name) && getOptionValues(option).length > 0).map((option) => (
                        <div key={option.name}>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {option.name} <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={
                                    option.name === t('constructor.cover_type') ? selectedCoverType :
                                    option.name === t('constructor.page_count') ? selectedPageCount :
                                    option.name === t('constructor.copies_count') ? selectedCopies :
                                    option.name === t('constructor.page_lamination') ? selectedPageLamination :
                                    ''
                                }
                                onChange={(e) => {
                                    if (option.name === t('constructor.cover_type')) {
                                        setSelectedCoverType(e.target.value);
                                        setSelectedPageCount(''); // reset — different cover types have different min pages
                                    } else if (option.name === t('constructor.page_count')) {
                                        setSelectedPageCount(e.target.value);
                                    } else if (option.name === t('constructor.copies_count')) {
                                        setSelectedCopies(e.target.value);
                                    } else if (option.name === t('constructor.page_lamination')) {
                                        setSelectedPageLamination(e.target.value);
                                    }
                                }}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                            >
                                {getOptionValues(option).map((value) => (
                                    <option key={value.name} value={value.name}>
                                        {value.name}
                                        {option.name !== t('constructor.page_count') && value.priceModifier !== undefined && value.priceModifier !== 0 &&
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
                                        {t('book_config.kalka_label')}
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t('book_config.kalka_desc')}
                                        {t('book_config.kalka_note')}
                                    </p>
                                </div>
                            </div>
                            {enableKalka && (
                                <div style={{ marginTop: 12 }}>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                                        Що розмістити на кальці? <span className="text-gray-400 font-normal">(необов'язково)</span>
                                    </label>
                                    <textarea
                                        value={kalkaText}
                                        onChange={e => setKalkaText(e.target.value)}
                                        rows={3}
                                        placeholder="Наприклад: по центру напис «Наша історія 2024» курсивом; або легкий рослинний візерунок по краях."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none"
                                    />
                                </div>
                            )}
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
                                        {t('book_config.endpaper_label')}
                                        {productType === 'travelbook' && ' (+100 ₴)'}
                                        {productType === 'magazine' && ' (+200 ₴)'}
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t('book_config.endpaper_desc')}
                                        {t('book_config.endpaper_note')}
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
                                    {t('book_config.travelbook_cover_title')}
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                    {t('book_config.travelbook_cover_desc')}
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
                                            {t('book_config.change_btn')}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowCoverSelector(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-gray-600 hover:text-purple-700"
                                    >
                                        <ImageIcon className="w-5 h-5" />
                                        {t('book_config.choose_cover_btn')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Photo Recommendation — two columns reflect the two layout
                    strategies from the price-sheet: mix of large photos with
                    collages, vs predominantly collage layouts. Helps clients
                    pick the right page count without having to guess. */}
                {photoRec && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-blue-900 mb-2">
                                    {t('book_config.photo_rec_title')}
                                </p>
                                {photoRec.collage ? (
                                    <>
                                        <p className="text-sm text-blue-700 mb-1">
                                            Для <strong>{selectedPageCount}</strong> орієнтовно:
                                        </p>
                                        <ul className="text-sm text-blue-700 space-y-1 ml-1">
                                            <li>• <strong>{photoRec.mixed}</strong> — великі фото + колажі</li>
                                            <li>• <strong>{photoRec.collage}</strong> — багато колажів</li>
                                        </ul>
                                    </>
                                ) : (
                                    <p className="text-sm text-blue-700">
                                        Для <strong>{selectedPageCount}</strong> рекомендуємо підготувати <strong>{photoRec.mixed}</strong>
                                    </p>
                                )}
                                <p className="text-xs text-blue-600 mt-2">
                                    {t('book_config.photo_rec_note')}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Real-time Price Display */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    {/* Text layout surcharge note — uses TYPESETTING_PRICE
                        from lib/products so the displayed amount stays in
                        sync with the actual surcharge applied (magazine
                        path adds TYPESETTING_PRICE; photobook path is
                        handled separately and uses its own constant). */}
                    {(() => {
                        const tl = (searchParams.get('text_layout') || '').toLowerCase();
                        const showText = tl === 'own' || tl === 'with' ||
                                         tl === 'we' || tl === 'we-basic' || tl === 'we-premium' ||
                                         tl.includes('текстом') || tl.includes('верстк') ||
                                         tl.includes('власн') || tl.includes('пишемо');
                        if (!showText) return null;
                        return (
                            <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
                                <span className="text-sm text-blue-800 font-medium"> З версткою тексту</span>
                                <span className="text-sm font-bold text-blue-800">+{TYPESETTING_PRICE} ₴</span>
                            </div>
                        );
                    })()}
                    {/* Urgent surcharge note — same check as the price
                        calculation above. Shown only when the customer
                        actually opted into urgent production from the
                        product detail page. */}
                    {(() => {
                        // Must use the SAME check as the price calculation
                        // above, otherwise the badge and the price disagree.
                        // The product page sends 'standard' (English) for the
                        // standard term — the old check only excluded the
                        // Ukrainian 'стандартна', so 'standard' slipped through
                        // and the urgent badge showed even on standard orders.
                        const u = (searchParams.get('urgent') || '').toLowerCase();
                        const active = u !== '' && u !== '0' &&
                                       u !== 'standard' &&
                                       !u.includes('стандартна');
                        return active ? (
                            <div className="mb-4 flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-4 py-2">
                                <span className="text-sm text-orange-800 font-medium">🚀 Термінове виготовлення</span>
                                <span className="text-sm font-bold text-orange-800">+{Math.round(URGENT_MULTIPLIER * 100)}%</span>
                            </div>
                        ) : null;
                    })()}
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">{t('book_config.estimated_price')}</p>
                            <p className="text-xs text-gray-500">
                                {t('book_config.price_disclaimer')}
                            </p>
                        </div>
                        <div className="text-right">
                            {totalPrice === 0 ? (
                                <p className="text-base font-semibold text-amber-600">{t('book_config.choose_pages_warning')}</p>
                            ) : (
                                <p className="text-3xl font-bold text-[#1e2d7d]">{totalPrice} ₴</p>
                            )}
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
                    {t('book_config.cancel')}
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
                    {t('book_config.continue_upload')}
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Explain a greyed-out continue button — list the unselected
                required fields so the customer isn't stuck guessing. */}
            {!isFormValid() && missingRequirements().length > 0 && (
                <p className="mt-3 text-sm text-amber-600 text-center">
                    {t('book_config.select_to_continue')} {missingRequirements().join(', ')}
                </p>
            )}

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
