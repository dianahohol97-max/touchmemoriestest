'use client';
import { useT, useLocale } from '@/lib/i18n/context';
import { getLocalized } from '@/lib/i18n/localize';
import { useState, useEffect } from 'react';
import styles from './product-page.module.css';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { notFound, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ProductCard } from '@/components/ui/ProductCard';
import { SizeVisualizer } from '@/components/ui/SizeVisualizer';
import { ProductFeaturesBlock } from '@/components/ui/ProductFeaturesBlock';
import { CheckCircle2, Star, Loader2, Image as ImageIcon, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import React from 'react'
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { PhotobookOptions } from '@/components/ui/PhotobookOptions';
import { ProductOptionsSelector, areAllRequiredOptionsFilled } from '@/components/ui/ProductOptionsSelector';
import GuestBookConfigModal from '@/components/GuestBookConfigModal';
import { useAuthModal } from '@/lib/auth-modal-context';

const getConstructorUrl = (slug: string): string => {
  const s = slug.toLowerCase();
  // Photobooks → new book constructor
  if (s.includes('photobook') || s.includes('fotokniga') || s.includes('velyur') || s.includes('velour') || s.includes('tkanina') || s.includes('fabric') || s.includes('leatherette'))
    return `/order/book?product=${slug}`;
  // Magazines → new book constructor
  if (s.includes('magazine') || s.includes('zhurnal') || s.includes('journal') || s.includes('fotozhurnal'))
    return `/order/book?product=${slug}`;
  // Travel Book → new book constructor
  if (s.includes('travelbook') || s.includes('travel'))
    return `/order/book?product=${slug}`;
  // Книга побажань (wishbook, guestbook) → BookLayoutEditor in cover-only mode
  if (s.includes('wishbook') || s.includes('pobazhan') || s.includes('guestbook') || s.includes('knyha-pobazhan') || s.includes('vishbuk'))
    return `/order/book?product=${slug}`;
  // Альбоми для вклейки фото (scrapbook) — same flow as wishbook (cover-only,
  // fixed page count) but without cover templates (handled in BookLayoutEditor)
  if (s.includes('scrapbook'))
    return `/order/book?product=${slug}`;
  // Photo albums
  if (s.includes('photoalbum') || s.includes('photoalbom') || s.includes('fotoalbom'))
    return `/order/book?product=${slug}`;
  // Calendar — desk first (before generic wall check)
  if (s.includes('desk-calendar') || s.includes('desk_calendar') || s.startsWith('calendar-table'))
    return '/order/desk-calendar';
  if (s.includes('calendar') || s.includes('kalendar'))
    return '/order/wall-calendar';
  // Posters → dedicated editor pages
  const posterMap: Record<string, string> = {
    'poster-star-map': '/order/starmap',
    'poster-city-map': '/order/citymap',
    'poster-love-map': '/order/lovemap',
    'poster-birth-stats': '/order/birthstats',
    'poster-monogram': '/order/monogram',
    'poster-zodiac': '/order/zodiac',
    'poster-cartoon-portrait': '/order/cartoon-portrait',
    'poster': '/order/poster',
    'poster-diploma': '/order/diploma',
  };
  if (posterMap[slug]) return posterMap[slug];
  if (s.includes('poster')) return '/order/poster';
  // Wedding newspaper — goes to designer order flow
  if (s.includes('newspaper') || s.includes('газет'))
    return '/brief';
  // Canvas print
  if (s.includes('polotni') || s.includes('canvas') || s.includes('полотн'))
    return '/order/canvas';
  // Puzzles
  if (s.includes('puzzle') || s.includes('pazl'))
    return `/order/puzzles?product=${slug}`;
  // Photo prints
  if (s.includes('photoprint') || s.includes('polaroid') || s.includes('полароїд') || s.includes('поляроїд'))
    return '/order/photoprint';
  // Magnets
  if (s.includes('magnet'))
    return '/order/photomagnets';
  // Puzzles
  if (s.includes('puzzle') || s.includes('pazl'))
    return '/order/puzzles';
  // Default → book constructor
  return `/order/book?product=${slug}`;
};

const getOrderUrl = (slug: string, selectedOptions: Record<string, number>, product: any): string => {
  // Posters → pass selected size to constructor
  if (slug.includes('poster')) {
    const base = getConstructorUrl(slug);
    const params = new URLSearchParams();
    // Pass selected size if available
    const selectedSize = product?.options?.find((o: any) => o.name === 'Розмір')
      ?.options?.find((o: any) => o.value === selectedOptions['Розмір'])?.label || selectedOptions['Розмір'];
    if (selectedSize) params.set('size', String(selectedOptions['Розмір'] || selectedSize));
    // Pass other selected options
    const otherOpts = Object.entries(selectedOptions)
      .filter(([k]) => k !== 'Розмір')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    const query = params.toString() + (otherOpts.length ? '&' + otherOpts.join('&') : '');
    return query ? `${base}?${query}` : base;
  }

  // For photoprint and photomagnet products, build order URL with selected options
  if (slug.includes('polotni') || slug.includes('canvas') || slug.includes('полотн')) {
    return `/order/canvas`;
  }
  if (slug.includes('calendar') || slug.includes('kalendar')) {
    // Pass size if selected
    const sizeOpt = product?.options?.find((o: any) => o.name === 'Розмір');
    const selectedIdx = selectedOptions['Розмір'];
    const sizeVal = sizeOpt?.options?.[selectedIdx]?.value || sizeOpt?.values?.[selectedIdx]?.name || '';
    return sizeVal ? `/order/wall-calendar?size=${sizeVal}` : '/order/wall-calendar';
  }
  if (slug.includes('puzzle') || slug.includes('pazl')) {
    return `/order/puzzles?product=${slug}`;
  }
  if (slug.includes('photoprint') || slug.includes('polaroid') || slug.includes('полароїд') || slug.includes('поляроїд') || slug.includes('magnet')) {
    const params = new URLSearchParams();
    params.set('product', slug);

    if (product.options && Array.isArray(product.options)) {
      product.options.forEach((opt: any) => {
        const selectedIdx = selectedOptions[opt.name];
        if (selectedIdx !== undefined && opt.values && opt.values[selectedIdx]) {
          params.set(opt.name.toLowerCase(), opt.values[selectedIdx].name);
        }
      });
    }

    if (slug.includes('magnet')) {
      return `/order/photomagnets?${params.toString()}`;
    }
    return `/order/photoprint?${params.toString()}`;
  }

  return getConstructorUrl(slug);
};

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = useT();
    const locale = useLocale();
    const optLabel = (name: string) => { const k = t('option_labels.' + name); return k !== 'option_labels.' + name ? k : name; };
    const optValueLabel = (label: string) => { const k = t('option_value_labels.' + label); return k !== 'option_value_labels.' + label ? k : label; };
    const resolvedParams = React.use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [product, setProduct] = useState<any>(null);
    const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNotFound, setIsNotFound] = useState(false);

    const [mainImage, setMainImage] = useState<string>('');
    const [mainVideo, setMainVideo] = useState<string>('');
    const [quantity, setQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState('description');

    // Photobook-specific state
    const [photobookPrice, setPhotobookPrice] = useState(0);
    const [photobookOptions, setPhotobookOptions] = useState<any>(null);
    const [photobookPricesData, setPhotobookPricesData] = useState<any[]>([]);

    const getProductionTime = (categorySlug: string = '', productSlug: string = '') => {
        const s = (categorySlug || '').toLowerCase();
        const ps = (productSlug || '').toLowerCase();
        if (s.includes('photobook') || s.includes('фотокниг')) return '14 робочих днів';
        if (s.includes('travelbook') || s.includes('travel')) return 'до 10 робочих днів';
        // Hard cover journal: 7–10 days (heavier binding process)
        if (ps.includes('tverd') || ps.includes('hard') || s.includes('tverd') || s.includes('hard-cover')) return '7–10 робочих днів';
        if (s.includes('magazine') || s.includes('journal') || s.includes('журнал') || s.includes('hlyantsevi') || s.includes('glyantsevy')) return '4–8 робочих днів';
        if (s.includes('guestbook') || s.includes('photoalbum') || s.includes('wishbook')) return '10 робочих днів';
        if (s.includes('print') || s.includes('photo-print') || s.includes('magnet')) return '2–3 робочих дні';
        if (s.includes('puzzle') || s.includes('canvas')) return '5–7 робочих днів';
        // Posters: 2–4 working days
        if (ps.includes('poster') || s.includes('poster') || ps.includes('зодіак') || ps.includes('монограм') || ps.includes('диплом') || ps.includes('portrait') || ps.includes('birth')) return '2–4 робочих дні';
        return t('product_page.production_days');
    };

    const isJournalProduct = (slug: string = '', categorySlug: string = '') => {
        const s = (slug + ' ' + categorySlug).toLowerCase();
        return s.includes('magazine') || s.includes('journal') || s.includes('журнал') || s.includes('hlyantsevi') || s.includes('glyantsevy');
    };

    // Store selected options -> mapping from option Name to selected value (index or value)
    const [selectedOptions, setSelectedOptions] = useState<Record<string, any>>({});
    const [customProductOptions, setCustomProductOptions] = useState<Record<string, string | number>>({});
    const [dynamicPrice, setDynamicPrice] = useState<number | null>(null);

    // Sync selected options to URL so back-navigation restores state
    useEffect(() => {
        if (typeof window === 'undefined' || Object.keys(customProductOptions).length === 0) return;
        const url = new URL(window.location.href);
        Object.entries(customProductOptions).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
        });
        window.history.replaceState(null, '', url.toString());
    }, [customProductOptions]);

    // Recalculate price when customProductOptions change for travelbook
    useEffect(() => {
        if (!product) return;
        const slugLower = (product.slug || '').toLowerCase();
        if (!slugLower.includes('travel') && !slugLower.includes('travelbook')) return;

        const TRAVELBOOK_PRICES: Record<number, number> = {
            12: 550, 16: 700, 20: 850, 24: 1000, 28: 1150, 32: 1300,
            36: 1450, 40: 1600, 44: 1750, 48: 1900, 52: 2025,
            56: 2125, 60: 2225, 64: 2325, 68: 2425, 72: 2525,
            76: 2650, 80: 2775,
        };

        const pages = Number(customProductOptions['Кількість сторінок']) || 0;
        if (!pages) return;

        let total = TRAVELBOOK_PRICES[pages] || 0;
        if (!total) return;
        if (customProductOptions['Ламінація'] === 'З ламінацією сторінок') total += pages * 5;
        if (customProductOptions['Індивідуальна обкладинка'] === 'Індивідуальна (+50 ₴)') total += 50;

        setDynamicPrice(total);
    }, [customProductOptions, product]);
    const [personalizationNote, setPersonalizationNote] = useState('');
    const [showPersonalizationInput, setShowPersonalizationInput] = useState(false);
    const [guestbookModalOpen, setGuestbookModalOpen] = useState(false);
    const [showGiftHint, setShowGiftHint] = useState(false);
    const [giftHintForm, setGiftHintForm] = useState({ senderName: '', recipientName: '', recipientEmail: '', message: '' });
    const [giftHintSending, setGiftHintSending] = useState(false);
    const [giftHintSent, setGiftHintSent] = useState(false);
    const { addItem } = useCartStore();
    const { requireAuth } = useAuthModal();

    // Helper: is this product a wishbook/guestbook?
    const isWishbookProduct = (slug: string) => {
        const s = (slug || '').toLowerCase();
        return s.includes('wishbook') || s.includes('pobazhan') || s.includes('guestbook') || s.includes('vishbuk') || s.includes('knyha-pobazhan');
    };

    useEffect(() => {
        const fetchProduct = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*, categories(name, slug, translations)')
                .eq('slug', resolvedParams.slug)
                .eq('is_active', true)
                .single();

            if (error || !data) {
                setIsNotFound(true);
            } else {
                setProduct(data);
                if (data.images && data.images.length > 0) {
                    setMainImage(data.images[0]);
                    setMainVideo('');
                } else if (data.video_url) {
                    setMainVideo(data.video_url);
                    setMainImage('');
                }


                // Initialize default options (first value of each option group)
                const defaultOptions: Record<string, any> = {};
                const isWishbookSlug = (data.slug || '').toLowerCase().includes('wish') ||
                    (data.slug || '').toLowerCase().includes('guestbook') ||
                    (data.slug || '').toLowerCase().includes('pobazhan');

                if (data.options && Array.isArray(data.options) && !isWishbookSlug) {
                    data.options.forEach((opt: any) => {
                        const items = opt.options || opt.values;
                        if (items && items.length > 0) {
                            const s = (data.slug || '').toLowerCase();
                            const isPhotoprint = s.includes('photoprint') || s.includes('polaroid');
                            // For photoprint: auto-select first value for non-size options
                            if (isPhotoprint && opt.name !== 'Розмір') {
                                defaultOptions[opt.name] = items[0].value ?? items[0].name ?? 0;
                            } else if (!isPhotoprint) {
                                defaultOptions[opt.name] = items[0].value ?? items[0].name ?? 0;
                            }
                        }
                    });
                }
                // For travelbook/photojournal/wishbook — also init ProductOptionsSelector defaults
                // so dynamicPrice gets calculated on first render
                const slugLower = (data.slug || '').toLowerCase();
                if (slugLower.includes('travel') || slugLower.includes('travelbook')) {
                    if (!defaultOptions['Кількість сторінок']) defaultOptions['Кількість сторінок'] = 12;
                    if (!defaultOptions['Ламінація']) defaultOptions['Ламінація'] = 'Без ламінації';
                    if (!defaultOptions['Індивідуальна обкладинка']) defaultOptions['Індивідуальна обкладинка'] = 'Стандартна';
                }

                // Restore options from URL params if present
                const urlOptions: Record<string, string> = {};
                searchParams.forEach((val, key) => {
                    if (key !== 'slug' && key !== 'locale') urlOptions[key] = val;
                });
                setCustomProductOptions(Object.keys(urlOptions).length > 0
                    ? { ...defaultOptions, ...urlOptions }
                    : defaultOptions);

                // Fetch Related Products
                const { data: relatedData } = await supabase
                    .from('products')
                    .select('id, name, slug, price, price_from, short_description, images, is_popular, popular_order, created_at, category_id')
                    .eq('is_active', true)
                    .neq('id', data.id)
                    .limit(4);

                if (relatedData) setRelatedProducts(relatedData);

                // Fetch photobook_prices for photobook products
                if (data.slug?.includes('photobook')) {
                    const { data: pricesData } = await supabase
                        .from('photobook_prices')
                        .select('*, cover_type:cover_types(id, name), size:photobook_sizes(id, name)')
                        .order('page_count', { ascending: true });
                    if (pricesData) {
                        setPhotobookPricesData(pricesData);
                    }
                }
            }
            setIsLoading(false);
        };

        fetchProduct();
    }, [resolvedParams.slug, supabase]);

    if (isNotFound) {
        notFound();
    }

    if (isLoading || !product) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navigation />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Loader2 size={48} className="animate-spin text-slate-300" />
                </div>
            </div>
        );
    }

    const thumbnails = product.images && product.images.length > 0
        ? product.images
        : [];

    // Gallery navigation
    const allMedia = [...thumbnails, ...(product.video_url ? [product.video_url] : [])];
    const currentMediaIdx = mainVideo
        ? allMedia.indexOf(product.video_url)
        : allMedia.indexOf(mainImage);
    const goNext = () => {
        const next = (currentMediaIdx + 1) % allMedia.length;
        const url = allMedia[next];
        if (url === product.video_url) { setMainVideo(url); setMainImage(''); }
        else { setMainImage(url); setMainVideo(''); }
    };
    const goPrev = () => {
        const prev = (currentMediaIdx - 1 + allMedia.length) % allMedia.length;
        const url = allMedia[prev];
        if (url === product.video_url) { setMainVideo(url); setMainImage(''); }
        else { setMainImage(url); setMainVideo(''); }
    };

    const isPhotobook = product.slug?.includes('photobook');
    const isPhotobookProduct = isPhotobook || product.slug?.includes('fotokniga') || 
        product.slug?.includes('velyur') || product.slug?.includes('velour') || 
        product.slug?.includes('leatherette') || product.slug?.includes('tkanina') || 
        product.slug?.includes('shkir') || product.slug?.includes('printed') ||
        (product.categories?.slug || '').includes('photobook');
    const isJournalSlug = product.slug?.includes('magazine') || product.slug?.includes('journal') || 
        product.slug?.includes('zhurnal') || product.slug?.includes('fotozhurnal') ||
        (product.categories?.slug || '').includes('zhurnal');

    // Calculate final price — priority: photobook table > dynamicPrice > generic modifiers
    let finalPrice = product.price || 0;

    // Source 1: Photobook prices table lookup (ALL photobooks use this when data available)
    if (isPhotobook && photobookPricesData.length > 0) {
        const sizeVal = String(customProductOptions['Розмір'] || '');
        const pagesVal = String(customProductOptions['Кількість сторінок'] || '');
        const kalkaVal = String(customProductOptions['Калька перед першою сторінкою'] || '');

        const pageCount = Number(String(pagesVal).replace(/[^\d]/g, '')) || 0;
        const sizeNorm = sizeVal.replace(/[хxX]/g, '×').replace(/\s*см$/i, '').trim();

        let coverName = 'Друкована';
        const sl = product.slug || '';
        if (sl.includes('velour') || sl.includes('velyur')) coverName = 'Велюр';
        else if (sl.includes('leather')) coverName = 'Шкірзамінник';
        else if (sl.includes('fabric') || sl.includes('tkanina')) coverName = 'Тканина';

        if (sizeNorm && pageCount) {
            const entry = photobookPricesData.find((p: any) =>
                p.cover_type?.name === coverName && p.size?.name === sizeNorm && p.page_count === pageCount
            );
            if (entry) {
                finalPrice = Number(entry.base_price) || 0;
                // Калька / tracing paper surcharge
                if (String(kalkaVal).includes('калькою') || String(kalkaVal).includes('Так') || kalkaVal === 'with') {
                    finalPrice += Number(entry.kalka_surcharge) || 150;
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
        // Names already handled by ProductOptionsSelector (hardcoded PRODUCT_OPTIONS).
        // 'Розмір' is only excluded when dynamicPrice is set (ProductOptionsSelector already priced it)
        // or for photobooks (priced via Source 1). For pure DB products (posters, maps etc.)
        // 'Розмір' carries a price modifier and must be included here.
        const hardcodedNames = new Set([
            'Кількість сторінок', 'Тип обкладинки',
            'Калька перед першою сторінкою', 'Тип ламінації',
            'Рамка', 'Вид', 'Покриття', 'Біла рамочка 3мм', 'Матеріал',
            'Матеріал обкладинки', 'Колір сторінок',
            'Ламінація', 'Ламінація сторінок', 'Ламінування сторінок', 'Індивідуальна обкладинка',
            // Exclude 'Розмір' only when already handled by ProductOptionsSelector or photobook lookup
            ...(dynamicPrice !== null || isPhotobook ? ['Розмір'] : []),
        ]);

        let extraModifiers = 0;
        product.options.forEach((opt: any) => {
            // Skip options already accounted for in dynamicPrice or photobook lookup
            if (hardcodedNames.has(opt.name)) return;

            const selected = customProductOptions[opt.name];
            if (selected === undefined) return;
            const items = opt.options || opt.values || [];
            const match = items.find((i: any) =>
                i === selected || String(i.value) === String(selected) ||
                i.label === selected || i.name === selected
            );
            if (match && typeof match === 'object') {
                extraModifiers += Number(match.price || match.priceModifier || 0);
            }
        });
        finalPrice += extraModifiers;
    }

    const handleAddToCart = () => {
        const itemOptions: Record<string, string> = {};

        // For photobook products with PhotobookOptions component
        if (isPhotobook && photobookOptions) {
            itemOptions['Розмір'] = photobookOptions.size;
            itemOptions['Кількість сторінок'] = `${photobookOptions.pages} сторінок`;
            if (photobookOptions.calca) {
                itemOptions['Калька'] = 'Так';
            }
        } else if (product.options && Array.isArray(product.options)) {
            // For other products with standard options
            product.options.forEach((opt: any) => {
                const idx = selectedOptions[opt.name];
                if (idx !== undefined && opt.values && opt.values[idx]) {
                    itemOptions[opt.name] = opt.values[idx].name;
                }
            });
        }

        // Generate unique ID based on product ID and selected options
        const optionsKey = Object.entries(itemOptions)
            .map(([k, v]) => `${k}:${v}`)
            .sort()
            .join('|');
        const cartItemId = optionsKey ? `${product.id}_${optionsKey}` : product.id;

        addItem({
            id: cartItemId,
            product_id: product.id,
            name: product.name,
            price: finalPrice,
            qty: quantity,
            image: mainImage,
            options: itemOptions,
            slug: product.slug,
            personalization_note: personalizationNote
        });

        toast.success(t('product_page.added_to_cart'));
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
            <Navigation />

            <main className={styles.mainContainer} style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    style={{
                        fontSize: '14px',
                        color: '#263A99',
                        marginBottom: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: '8px 0',
                        transition: 'color 0.2s'
                    }}
                    className="hover:text-[#1e2d7d]"
                >
                    {t('product_page.back')}
                </button>

                {/* Breadcrumbs */}
                <div className={styles.breadcrumbs} style={{ fontSize: '14px', color: '#888', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <Link href="/" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', whiteSpace: 'nowrap' }} className="hover:text-slate-600">{t('product_page.home')}</Link>
                    <span>→</span>
                    <Link href="/catalog" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', whiteSpace: 'nowrap' }} className="hover:text-slate-600">{t('product_page.catalog')}</Link>
                    <span>→</span>
                    {product.categories && (
                        <>
                            <Link href={`/catalog?category=${product.categories.slug}`} style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', whiteSpace: 'nowrap' }} className="hover:text-slate-600">{getLocalized(product.categories, locale, 'name')}</Link>
                            <span>→</span>
                        </>
                    )}
                    <span style={{ color: '#263A99', fontWeight: 600 }}>{getLocalized(product, locale, "name")}</span>
                </div>

                {/* Two Column Layout */}
                <div className={styles.productLayout} style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(280px, 420px)', gap: '40px', marginBottom: '80px', alignItems: 'start' }}>

                    {/* Left Column: Images — main photo + horizontal thumbnails below */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                        {/* Main image */}
                        <div className={styles.mainImageContainer} style={{ position: 'relative', width: '100%', aspectRatio: '1/1', maxHeight: 480, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {mainVideo ? (
                                <video src={mainVideo} controls autoPlay muted playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : mainImage ? (
                                <Image src={mainImage} alt={getLocalized(product, locale, 'name')} fill
                                    style={{ objectFit: 'cover' }} />
                            ) : (
                                <ImageIcon size={64} className="text-slate-300" />
                            )}

                            {/* Arrow navigation */}
                            {allMedia.length > 1 && (<>
                                <button onClick={goPrev}
                                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                                        width: 36, height: 36, borderRadius: '50%', border: 'none',
                                        background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 2 }}>
                                    <ChevronLeft size={20} color="#374151" />
                                </button>
                                <button onClick={goNext}
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        width: 36, height: 36, borderRadius: '50%', border: 'none',
                                        background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 2 }}>
                                    <ChevronRight size={20} color="#374151" />
                                </button>
                                {/* Dot indicator */}
                                <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                                    display: 'flex', gap: 5, zIndex: 2 }}>
                                    {allMedia.map((_: string, i: number) => (
                                        <div key={i} style={{
                                            width: currentMediaIdx === i ? 18 : 6,
                                            height: 6, borderRadius: 3,
                                            background: currentMediaIdx === i ? '#1e2d7d' : 'rgba(255,255,255,0.7)',
                                            transition: 'all 0.2s', cursor: 'pointer',
                                        }} onClick={() => {
                                            const url = allMedia[i];
                                            if (url === product.video_url) { setMainVideo(url); setMainImage(''); }
                                            else { setMainImage(url); setMainVideo(''); }
                                        }} />
                                    ))}
                                </div>
                            </>)}
                        </div>

                        {/* Horizontal thumbnail strip below main image */}
                        {allMedia.length > 1 && (
                            <div className={styles.thumbnailContainer} style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
                                {thumbnails.map((src: string, idx: number) => (
                                    <button key={idx}
                                        onClick={() => { setMainImage(src); setMainVideo(''); }}
                                        style={{
                                            position: 'relative', width: 72, height: 72, flexShrink: 0,
                                            borderRadius: 8, overflow: 'hidden',
                                            border: mainImage === src && !mainVideo ? '2.5px solid #1e2d7d' : '2px solid #e2e8f0',
                                            cursor: 'pointer', background: '#f8fafc', padding: 0, transition: 'border-color 0.15s',
                                        }}>
                                        <Image src={src} alt={`фото ${idx + 1}`} fill style={{ objectFit: 'cover' }} />
                                    </button>
                                ))}
                                {product.video_url && (
                                    <button onClick={() => { setMainVideo(product.video_url); setMainImage(''); }}
                                        style={{
                                            position: 'relative', width: 72, height: 72, flexShrink: 0,
                                            borderRadius: 8, overflow: 'hidden',
                                            border: mainVideo ? '2.5px solid #1e2d7d' : '2px solid #e2e8f0',
                                            cursor: 'pointer', background: '#000', padding: 0,
                                        }}>
                                        <video src={product.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Play size={18} color="white" />
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Details */}
                    <div>
                        <h1 className={styles.productTitleMain} style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, marginBottom: '16px', lineHeight: 1.2 }}>
                            {getLocalized(product, locale, "name")}
                        </h1>
                        {product.short_description && (
                            <p style={{ fontSize: '16px', color: '#666', lineHeight: 1.6, marginBottom: '24px' }}>
                                {getLocalized(product, locale, 'short_description')}
                            </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                            <div className={styles.priceContainer} style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)' }}>
                                {`${product.price_from ? t('product_page.from_price') + ' ' : ''}${finalPrice} ₴`}
                            </div>
                            {product.sale_price && (
                                <div style={{ fontSize: '20px', fontWeight: 600, color: '#94a3b8', textDecoration: 'line-through' }}>
                                    {product.sale_price} ₴
                                </div>
                            )}
                        </div>

                        {product.is_personalized && (
                            <div className="inline-flex items-center gap-2 bg-[#dbeafe] text-[#1e2d7d] text-sm font-medium px-3 py-1 rounded-full" style={{ marginBottom: '24px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1e2d7d' }}></span>
                                {t('product_page.made_to_order')}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
                            {/* Photobook products with variants */}
                            {(product.slug?.includes('photobook') && product.variants && Array.isArray(product.variants) && product.variants.length > 0) ? (
                                <PhotobookOptions
                                    product={product}
                                    onPriceChange={setPhotobookPrice}
                                    onOptionsChange={setPhotobookOptions}
                                />
                            ) : (
                                <>
                                    {/* Photoprint + Poster: render options from DB */}
                                    {(product.slug?.includes('photoprint') || product.slug?.includes('polaroid') || product.slug?.includes('поляроїд') || product.slug?.includes('полароїд') || product.slug?.includes('poster')) ? (
                                        <>
                                        {product.options && Array.isArray(product.options) && product.options
                                            .filter((opt: any) => opt.options?.length > 0 || opt.values?.length > 0)
                                            .map((opt: any) => {
                                                const items = opt.options || opt.values || [];
                                                return (
                                                    <div key={opt.name}>
                                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e2d7d' }}>
                                                            {optLabel(opt.name)} {opt.required !== false ? <span style={{color:'#e53e3e'}}>*</span> : null}
                                                        </label>
                                                        {opt.name === 'Розмір' && (() => {
                                                            const sizeValues = items.map((it: any) => it.value || it.name || String(it));
                                                            const prices: Record<string, number> = {};
                                                            items.forEach((it: any) => {
                                                                const v = it.value || it.name || String(it);
                                                                if (it.price) prices[v] = Number(it.price);
                                                            });
                                                            return (
                                                                <SizeVisualizer
                                                                    sizes={sizeValues}
                                                                    selected={customProductOptions[opt.name] || null}
                                                                    onSelect={(size) => setCustomProductOptions(prev => ({ ...prev, [opt.name]: size }))}
                                                                    prices={prices}
                                                                    wrap={sizeValues.length > 5}
                                                                />
                                                            );
                                                        })()}
                                                        {opt.name !== 'Розмір' && <select
                                                            value={customProductOptions[opt.name] || ''}
                                                            onChange={(e) => setCustomProductOptions(prev => ({ ...prev, [opt.name]: e.target.value }))}
                                                            style={{
                                                                width: '100%', padding: '10px 14px',
                                                                border: customProductOptions[opt.name] ? '2px solid #1e2d7d' : '1px solid #d1d5db',
                                                                borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
                                                                backgroundColor: customProductOptions[opt.name] ? '#f0f3ff' : 'white',
                                                                color: customProductOptions[opt.name] ? '#1e2d7d' : '#64748b',
                                                                fontWeight: customProductOptions[opt.name] ? 700 : 400,
                                                            }}
                                                        >
                                                            {opt.required !== false && <option value="" disabled>{t('product_page.choose_option')} {opt.name.toLowerCase()}</option>}
                                                            {items.map((item: any, idx: number) => {
                                                                const label = item.label || item.name || String(item);
                                                                const value = item.value || item.name || String(item);
                                                                const price = Number(item.price || 0);
                                                                // Don't show (+X ₴) if label already contains price (грн/₴)
                                                                const labelHasPrice = /\d+\s*(грн|₴)/.test(label);
                                                                return (
                                                                    <option key={idx} value={value}>
                                                                        {optValueLabel(label)}{price > 0 && !labelHasPrice ? ` (+${price} ₴)` : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>}
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                    <>
                                    {/* Custom Product Options Selector (non-photoprint products) */}
                                    <ProductOptionsSelector
                                        slug={product.slug || ''}
                                        selectedOptions={customProductOptions}
                                        onChange={(options, calculatedPrice) => {
                                            setCustomProductOptions(prev => ({ ...prev, ...options }));
                                            setDynamicPrice(calculatedPrice ?? null);
                                        }}
                                    />

                                    {/* DB-only options not rendered by ProductOptionsSelector */}
                                    {product.options && Array.isArray(product.options) && (() => {
                                        const hardcodedNames = new Set(['Розмір', 'Кількість сторінок', 'Тип обкладинки',
                                            'Калька перед першою сторінкою', 'Тип ламінації', 'Текст', 'Оздоблення',
                                            'Варіант акрилу', 'Варіант фотовставки', 'Варіант металевої вставки',
                                            'Варіант тиснення', 'Варіант гравірування', 'Корінець',
                                            'Рамка', 'Вид', 'Покриття', 'Біла рамочка 3мм', 'Матеріал',
                                            'Матеріал обкладинки', 'Колір сторінок',
                                            'Ламінація', 'Ламінація сторінок', 'Ламінування сторінок', 'Індивідуальна обкладинка']);
                                        return product.options
                                            .filter((opt: any) => !hardcodedNames.has(opt.name) && (opt.options?.length > 0 || opt.values?.length > 0))
                                            .map((opt: any) => {
                                                const items = opt.options || opt.values || [];
                                                return (
                                                    <div key={opt.name}>
                                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e2d7d' }}>
                                                            {optLabel(opt.name)}
                                                        </label>
                                                        <select
                                                            value={customProductOptions[opt.name] || ''}
                                                            onChange={(e) => setCustomProductOptions(prev => ({ ...prev, [opt.name]: e.target.value }))}
                                                            style={{
                                                                width: '100%', padding: '10px 14px',
                                                                border: customProductOptions[opt.name] ? '2px solid #1e2d7d' : '1px solid #d1d5db',
                                                                borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
                                                                backgroundColor: customProductOptions[opt.name] ? '#f0f3ff' : 'white',
                                                                color: customProductOptions[opt.name] ? '#1e2d7d' : '#64748b',
                                                                fontWeight: customProductOptions[opt.name] ? 700 : 400,
                                                            }}
                                                        >
                                                            {items.map((item: any, idx: number) => {
                                                                const label = item.label || item.name || item;
                                                                const value = item.value || item.name || item;
                                                                const price = Number(item.price || 0);
                                                                const labelHasPrice = /\d+\s*(грн|₴)/.test(String(label));
                                                                return (
                                                                    <option key={idx} value={value}>
                                                                        {optValueLabel(label)}{price > 0 && !labelHasPrice ? ` (+${price} ₴)` : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>
                                                );
                                            });
                                    })()}

                                    {/* Conditional decoration sub-options from product.options JSON */}
                                    {product.options && Array.isArray(product.options) && (() => {
                                        // Map: sub-option name → which decoration values trigger it
                                        const SUBTYPE_MAP: Record<string, string[]> = {
                                            'Варіант акрилу': ['acryl', 'Акрил'],
                                            'Варіант фотовставки': ['photovstavka', 'Фотовставка'],
                                        };
                                        // ProductOptionsSelector writes 'Тип оздоблення' with label
                                        // product.options JSON uses 'Оздоблення' with value
                                        const ozValue = customProductOptions['Тип оздоблення']
                                            || customProductOptions['Оздоблення'] || '';

                                        return product.options
                                            .filter((opt: any) => {
                                                const triggers = SUBTYPE_MAP[opt.name];
                                                if (!triggers) return false;
                                                return triggers.some(t => ozValue === t);
                                            })
                                            .map((opt: any) => {
                                                const items = opt.options || opt.values || [];
                                                if (!items.length) return null;
                                                // Auto-select first item if only 1 option and nothing selected yet
                                                const firstVal = items[0]?.value || items[0]?.name || items[0];
                                                if (items.length === 1 && !customProductOptions[opt.name]) {
                                                    setTimeout(() => setCustomProductOptions(prev => ({ ...prev, [opt.name]: firstVal })), 0);
                                                }
                                                return (
                                                    <div key={opt.name}>
                                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e2d7d' }}>
                                                            {opt.name}
                                                        </label>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                            {items.map((item: any, i: number) => {
                                                                const label = item.label || item.name || item;
                                                                const value = item.value || item.name || item;
                                                                const price = item.price || 0;
                                                                const isSelected = customProductOptions[opt.name] === value;
                                                                const labelHasPrice2 = /\d+\s*(грн|₴)/.test(String(label));
                                                                return (
                                                                    <button key={i} type="button"
                                                                        onClick={() => {
                                                                            setCustomProductOptions(prev => ({ ...prev, [opt.name]: value }));
                                                                        }}
                                                                        className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                                                                            isSelected
                                                                                ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d] hover:text-[#1e2d7d]'
                                                                        }`}>
                                                                        {optValueLabel(label)}{price > 0 && !labelHasPrice2 ? ` (+${price} ₴)` : ''}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                    })()}

                                    {/* Quantity: hidden for photoprint (determined by uploaded photo count) */}
                                    {!(product.slug?.includes('photoprint') || product.slug?.includes('polaroid') || product.slug?.includes('поляроїд') || product.slug?.includes('полароїд')) && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>Кількість</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <button
                                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                className="rounded-md hover:bg-[#f0f3ff] transition"
                                                style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--primary)', background: 'white', cursor: 'pointer', fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}
                                            >−</button>
                                            <span style={{ fontWeight: 800, fontSize: '18px', minWidth: '40px', textAlign: 'center', color: '#263A99' }}>{quantity}</span>
                                            <button
                                                onClick={() => setQuantity(quantity + 1)}
                                                className="rounded-md hover:bg-[#f0f3ff] transition"
                                                style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--primary)', background: 'white', cursor: 'pointer', fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}
                                            >+</button>
                                        </div>
                                    </div>
                                    )}
                                    </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Special CTA for photoprint, poster, and photomagnet products */}
                        {(product.slug?.includes('photoprint') || product.slug?.includes('polaroid') || product.slug?.includes('полароїд') || product.slug?.includes('поляроїд') || product.slug?.includes('poster') || product.slug?.includes('magnet') || product.slug?.includes('polotni') || product.slug?.includes('canvas') || product.slug?.includes('puzzle') || product.slug?.includes('pazl')) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                                <button
                                    onClick={() => requireAuth(
                                        () => router.push(getOrderUrl(product.slug, selectedOptions, product)),
                                        'Щоб створити замовлення та зберегти дизайн — увійдіть в акаунт'
                                    )}
                                    className="rounded-md hover:bg-[#1a2966]"
                                    style={{
                                        width: '100%',
                                        padding: '18px',
                                        backgroundColor: '#263a99',
                                        color: 'white',
                                        border: 'none',
                                        fontSize: '16px',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        transition: 'background-color 0.2s',
                                        display: 'block',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t('product.order_now_arrow')}
                                </button>
                                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: 0 }}>
                                    Завантажте фото та оформіть замовлення за 3 кроки
                                </p>
                            </div>
                        ) : product.is_personalized ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                {/* Warning if required options not selected */}
                                {!areAllRequiredOptionsFilled(product.slug || '', customProductOptions) && (
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: '#dbeafe',
                                        border: '1px solid rgba(30, 45, 125, 0.2)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        color: '#1e2d7d',
                                        textAlign: 'center'
                                    }}>
                                        Оберіть всі обов'язкові опції перед замовленням
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                                    <div className={styles.flexResponsive} style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            onClick={() => {
                                                const slug = product.slug || resolvedParams.slug;
                                                const base = getConstructorUrl(slug);
                                                let constructorUrl = base;
                                                if (base.includes('/order/book') && Object.keys(customProductOptions).length > 0) {
                                                    const keyMap: Record<string, string> = {
                                                        'Розмір': 'size',
                                                        'Кількість сторінок': 'pages',
                                                        'Тип ламінації': 'lamination',
                                                        'Калька перед першою сторінкою': 'tracing',
                                                        'Тип обкладинки': 'cover',
                                                        'Матеріал обкладинки': 'cover',
                                                        'Корінець': 'spine',
                                                        'Оздоблення': 'decoration',
                                                        'Тип оздоблення': 'decoration',
                                                        'Тип оздоблення обкладинки': 'decoration',
                                                        'Варіант оздоблення': 'decoration_variant',
                                                        'Колір велюру': 'cover_color',
                                                        'Колір тканини': 'cover_color',
                                                        'Колір шкірзаміннику': 'cover_color',
                                                        'Колір шкіри': 'cover_color',
                                                        'Колір сторінок': 'page_color',
                                                        'Верстка тексту': 'text_layout',
                                                    };
                                                    const url = new URL(base, 'http://x');
                                                    Object.entries(customProductOptions).forEach(([key, val]) => {
                                                        if (val !== undefined && val !== '') {
                                                            url.searchParams.set(keyMap[key] || key, String(val));
                                                        }
                                                    });
                                                    constructorUrl = url.pathname + '?' + url.searchParams.toString();
                                                }
                                                requireAuth(() => router.push(constructorUrl), 'Щоб відкрити редактор та зберегти ваш дизайн — увійдіть в акаунт');
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '18px',
                                                backgroundColor: '#263a99',
                                                color: 'white',
                                                border: 'none',
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                transition: 'background-color 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                borderRadius: '6px',
                                            }}
                                            className="hover:bg-[#1a2966]"
                                        >
                                            Відкрити редактор
                                        </button>
                                        {isWishbookProduct(product.slug || resolvedParams.slug) ? (
                                            <button
                                                onClick={() => requireAuth(
                                                    () => setGuestbookModalOpen(true),
                                                    'Щоб замовити з дизайнером — увійдіть в акаунт'
                                                )}
                                                style={{
                                                    flex: 1,
                                                    padding: '18px',
                                                    backgroundColor: 'white',
                                                    color: '#263a99',
                                                    border: '2px solid #263a99',
                                                    fontSize: '16px',
                                                    fontWeight: 700,
                                                    textAlign: 'center',
                                                    transition: 'background-color 0.2s',
                                                    cursor: 'pointer',
                                                    borderRadius: '6px',
                                                }}
                                                className="hover:bg-[#f0f3ff]"
                                            >
                                                {t('product_page.order_with_designer')}
                                            </button>
                                        ) : (
                                        <button
                                            onClick={() => requireAuth(
                                                () => router.push('/order'),
                                                'Щоб замовити з дизайнером — увійдіть в акаунт'
                                            )}
                                            style={{
                                                flex: 1,
                                                padding: '18px',
                                                backgroundColor: 'white',
                                                color: '#263a99',
                                                border: '2px solid #263a99',
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                transition: 'background-color 0.2s',
                                                cursor: 'pointer',
                                                borderRadius: '6px',
                                            }}
                                            className="hover:bg-[#f0f3ff]"
                                        >
                                            {t('product_page.order_with_designer')}
                                        </button>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
                                        Не знаєте як оформити? Наш дизайнер допоможе вам створити ідеальний продукт                                    </p>
                                </div>
                            </div>
                        ) : product.is_partially_personalized ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                {/* Warning if required options not selected */}
                                {!areAllRequiredOptionsFilled(product.slug || '', customProductOptions) && (
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: '#dbeafe',
                                        border: '1px solid rgba(30, 45, 125, 0.2)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        color: '#1e2d7d',
                                        textAlign: 'center'
                                    }}>
                                        Оберіть всі обов'язкові опції перед замовленням
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '12px' }} className={styles.flexResponsive}>
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={!areAllRequiredOptionsFilled(product.slug || '', customProductOptions)}
                                        className="rounded-md hover:bg-[#f0f3ff]"
                                        style={{
                                            flex: 1,
                                            padding: '18px',
                                            backgroundColor: 'white',
                                            color: '#263a99',
                                            border: '2px solid #263a99',
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            cursor: areAllRequiredOptionsFilled(product.slug || '', customProductOptions) ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.2s',
                                            opacity: areAllRequiredOptionsFilled(product.slug || '', customProductOptions) ? 1 : 0.5
                                        }}
                                    >
                                        {t('product.order_now')}
                                    </button>
                                    <button
                                        onClick={() => setShowPersonalizationInput(!showPersonalizationInput)}
                                        className="rounded-md hover:bg-[#1a2966]"
                                        style={{
                                            flex: 1.2,
                                            padding: '18px',
                                            backgroundColor: '#263a99',
                                            color: 'white',
                                            border: 'none',
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        {t('product_page.add_personalization')}
                                    </button>
                                </div>

                                {showPersonalizationInput && (
                                    <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: "3px", backgroundColor: '#f8fafc' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#263A99' }}>{t('product_page.describe_personalization')}</label>
                                        <textarea
                                            value={personalizationNote}
                                            onChange={(e) => setPersonalizationNote(e.target.value)}
                                            placeholder={t("product_page.personalization_placeholder")}
                                            style={{
                                                width: '100%',
                                                minHeight: '100px',
                                                padding: '12px',
                                                borderRadius: "3px",
                                                border: '1px solid #cbd5e1',
                                                fontSize: '14px',
                                                fontFamily: 'inherit',
                                                marginBottom: '12px'
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                if (!personalizationNote.trim()) {
                                                    toast.error(t('product_page.enter_personalization'));
                                                    return;
                                                }
                                                handleAddToCart();
                                            }}
                                            disabled={!areAllRequiredOptionsFilled(product.slug || '', customProductOptions)}
                                            className="rounded-md hover:bg-[#1a2966]"
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                backgroundColor: '#263a99',
                                                color: 'white',
                                                border: 'none',
                                                fontSize: '14px',
                                                fontWeight: 700,
                                                cursor: areAllRequiredOptionsFilled(product.slug || '', customProductOptions) ? 'pointer' : 'not-allowed',
                                                transition: 'background-color 0.2s',
                                                opacity: areAllRequiredOptionsFilled(product.slug || '', customProductOptions) ? 1 : 0.5
                                            }}
                                        >
                                            {t('product_page.add_to_order')}
                                        </button>
                                    </div>
                                )}

                                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: 0 }}>
                                    {t('product_page.personalization_note')}                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                                {/* Warning if required options not selected */}
                                {!areAllRequiredOptionsFilled(product.slug || '', customProductOptions) && (
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: '#dbeafe',
                                        border: '1px solid rgba(30, 45, 125, 0.2)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        color: '#1e2d7d',
                                        textAlign: 'center'
                                    }}>
                                        Оберіть всі обов'язкові опції перед замовленням
                                    </div>
                                )}
                                <button
                                    onClick={handleAddToCart}
                                    disabled={!areAllRequiredOptionsFilled(product.slug || '', customProductOptions)}
                                    className="rounded-md hover:bg-[#1a2966]"
                                    style={{
                                        width: '100%',
                                        padding: '18px',
                                        backgroundColor: '#263a99',
                                        color: 'white',
                                        border: 'none',
                                        opacity: areAllRequiredOptionsFilled(product.slug || '', customProductOptions) ? 1 : 0.5,
                                        cursor: areAllRequiredOptionsFilled(product.slug || '', customProductOptions) ? 'pointer' : 'not-allowed',
                                        fontSize: '16px',
                                        fontWeight: 700,
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    {t('product.order_now')}
                                </button>
                                {/* Show "Order with designer" button for products with options (TravelBook, magazines, etc.) */}
                                {(product.options && Array.isArray(product.options) && product.options.length > 0) && (
                                    <button
                                        onClick={() => requireAuth(
                                            () => window.open('https://t.me/touchmemories', '_blank'),
                                            'Щоб замовити з дизайнером — увійдіть в акаунт'
                                        )}
                                        style={{
                                            width: '100%',
                                            padding: '18px',
                                            backgroundColor: 'white',
                                            color: 'var(--primary)',
                                            border: '2px solid var(--primary)',
                                            borderRadius: "3px",
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            textAlign: 'center',
                                            transition: 'background-color 0.2s',
                                            display: 'block',
                                            cursor: 'pointer',
                                        }}
                                        className="hover:bg-blue-50"
                                    >
                                        {t('product.order_with_designer')}
                                    </button>
                                )}
                                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: 0 }}>
                                    {(product.options && Array.isArray(product.options) && product.options.length > 0)
                                        ? t('product_page.designer_help')
                                        : t('product_page.quick_order')
                                    }
                                </p>
                            </div>
                        )}

                        {/*  Gift Hint + Certificate buttons */}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                            <button
                                onClick={() => setShowGiftHint(true)}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                    padding: '12px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                                    background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151',
                                    transition: 'all 0.15s' }}
                                onMouseOver={e => (e.currentTarget.style.background = '#fdf4ff', e.currentTarget.style.borderColor = '#e879f9')}
                                onMouseOut={e => (e.currentTarget.style.background = '#fff', e.currentTarget.style.borderColor = '#e2e8f0')}
                            >
                                 Натякнути на подарунок
                            </button>
                            <Link
                                href="/catalog/gift-certificate"
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                    padding: '12px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                                    background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151',
                                    textDecoration: 'none', transition: 'all 0.15s' }}
                                onMouseOver={(e: any) => (e.currentTarget.style.background = '#fefce8', e.currentTarget.style.borderColor = '#facc15')}
                                onMouseOut={(e: any) => (e.currentTarget.style.background = '#fff', e.currentTarget.style.borderColor = '#e2e8f0')}
                            >
                                 Придбати сертифікат
                            </Link>
                        </div>

                        {/* Gift Hint Modal */}
                        {showGiftHint && (
                            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                                onClick={e => e.target === e.currentTarget && setShowGiftHint(false)}>
                                <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                                    {giftHintSent ? (
                                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                            <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                                            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>Натяк відправлено!</h3>
                                            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Отримувач отримає листа з посиланням на цей товар</p>
                                            <button onClick={() => { setShowGiftHint(false); setGiftHintSent(false); setGiftHintForm({ senderName: '', recipientName: '', recipientEmail: '', message: '' }); }}
                                                style={{ padding: '12px 32px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                                                Закрити
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: 0 }}> Натякнути на подарунок</h3>
                                                <button onClick={() => setShowGiftHint(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>×</button>
                                            </div>
                                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                                                Відправимо листа людині, яку хочете порадувати, з посиланням на цей товар 
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                <input
                                                    placeholder="Ваше ім'я"
                                                    value={giftHintForm.senderName}
                                                    onChange={e => setGiftHintForm(p => ({ ...p, senderName: e.target.value }))}
                                                    style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                                />
                                                <input
                                                    placeholder="Ім'я отримувача"
                                                    value={giftHintForm.recipientName}
                                                    onChange={e => setGiftHintForm(p => ({ ...p, recipientName: e.target.value }))}
                                                    style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                                />
                                                <input
                                                    type="email"
                                                    placeholder="Email отримувача *"
                                                    value={giftHintForm.recipientEmail}
                                                    onChange={e => setGiftHintForm(p => ({ ...p, recipientEmail: e.target.value }))}
                                                    style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                                />
                                                <textarea
                                                    placeholder="Особисте повідомлення (необов'язково)"
                                                    value={giftHintForm.message}
                                                    onChange={e => setGiftHintForm(p => ({ ...p, message: e.target.value }))}
                                                    rows={3}
                                                    style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                                                />
                                                <button
                                                    disabled={!giftHintForm.recipientEmail || giftHintSending}
                                                    onClick={async () => {
                                                        if (!giftHintForm.recipientEmail) return;
                                                        setGiftHintSending(true);
                                                        try {
                                                            const res = await fetch('/api/gift-hint', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    product_id: product.id,
                                                                    sender_name: giftHintForm.senderName,
                                                                    recipient_name: giftHintForm.recipientName,
                                                                    recipient_email: giftHintForm.recipientEmail,
                                                                    message: giftHintForm.message,
                                                                }),
                                                            });
                                                            if (res.ok) { setGiftHintSent(true); }
                                                            else { toast.error('Помилка. Спробуйте пізніше.'); }
                                                        } catch { toast.error('Помилка мережі'); }
                                                        finally { setGiftHintSending(false); }
                                                    }}
                                                    style={{ padding: '13px', background: giftHintForm.recipientEmail ? '#1e2d7d' : '#e2e8f0',
                                                        color: giftHintForm.recipientEmail ? '#fff' : '#94a3b8',
                                                        border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
                                                        cursor: giftHintForm.recipientEmail ? 'pointer' : 'not-allowed',
                                                        transition: 'all 0.15s' }}
                                                >
                                                    {giftHintSending ? 'Відправляємо...' : ' Відправити натяк'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Delivery Info */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: "3px", display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: "3px" }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                {t('product_page.shipping_info')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: "3px" }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                {t('product_page.payment_info')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: "3px" }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                Термін виготовлення: {getProductionTime(product.categories?.slug || product.category_id, product.slug || '')}
                                {isJournalProduct(product.slug, product.categories?.slug || '') && (
                                    <span style={{ marginLeft: 8, fontSize: 12, color: '#f59e0b', fontWeight: 700, background: '#fffbeb', padding: '2px 8px', borderRadius: 4, border: '1px solid #fde68a' }}>
                                        {t('product_page.urgent_order')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Area */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '60px', marginBottom: '80px' }}>
                    <div style={{ display: 'flex', gap: '40px', borderBottom: '1px solid #e2e8f0', marginBottom: '40px', overflowX: 'auto' }} className={styles.customScrollbar}>
                        <button
                            onClick={() => setActiveTab('description')}
                            className={styles.tabBtn}
                            style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'description' ? '3px solid var(--primary)' : '3px solid transparent',
                                paddingBottom: '16px',
                                fontSize: '18px',
                                fontWeight: activeTab === 'description' ? 800 : 500,
                                color: activeTab === 'description' ? '#263A99' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {t('product_page.description_tab')}
                        </button>
                        {product.specs && product.specs.length > 0 && (
                            <button
                                onClick={() => setActiveTab('specs')}
                                className={styles.tabBtn}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'specs' ? '3px solid var(--primary)' : '3px solid transparent',
                                    paddingBottom: '16px',
                                    fontSize: '18px',
                                    fontWeight: activeTab === 'specs' ? 800 : 500,
                                    color: activeTab === 'specs' ? '#263A99' : '#64748b',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {t('product_page.specs_tab')}
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('reviews')}
                            className={styles.tabBtn}
                            style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'reviews' ? '3px solid var(--primary)' : '3px solid transparent',
                                paddingBottom: '16px',
                                fontSize: '18px',
                                fontWeight: activeTab === 'reviews' ? 800 : 500,
                                color: activeTab === 'reviews' ? '#263A99' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {t('product_page.reviews_tab')}
                        </button>
                    </div>

                    <div>
                        {activeTab === 'description' && (
                            product.description ? (
                                <div style={{ maxWidth: '800px', lineHeight: 1.8, fontSize: '16px', color: '#475569' }} dangerouslySetInnerHTML={{ __html: product.description }} />
                            ) : (
                                <div className="text-slate-500 py-8">{t('product_page.no_description')}</div>
                            )
                        )}

                        {activeTab === 'specs' && product.specs && product.specs.length > 0 && (
                            <div style={{ maxWidth: 600 }}>
                                {product.specs.map((spec: any, idx: number) => (
                                    <div key={idx} style={{
                                        display: 'flex', alignItems: 'baseline', gap: 16,
                                        padding: '14px 0',
                                        borderBottom: idx < product.specs.length - 1 ? '1px solid #f1f5f9' : 'none'
                                    }}>
                                        <div style={{ minWidth: 160, fontSize: 14, color: '#64748b', fontWeight: 500, flexShrink: 0 }}>
                                            {spec.label || spec.key || spec.name}
                                        </div>
                                        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#1e2d7d' }}>
                                            {spec.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'reviews' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ backgroundColor: '#f8f9fa', padding: '24px', borderRadius: "3px", border: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} fill="#fbbf24" color="#fbbf24" />)}
                                        </div>
                                        <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, marginBottom: '16px' }}>{t('product_page.review_text')}</p>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#263A99' }}>{t('product_page.review_author')}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Features + Covers Block */}
                {(product.features?.length > 0 || isPhotobookProduct || isJournalSlug) && (
                    <ProductFeaturesBlock
                        features={product.features || []}
                        isPhotobook={isPhotobookProduct}
                        isJournal={isJournalSlug}
                    />
                )}

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <div style={{ paddingTop: '60px' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '40px', textAlign: 'center' }}>
                            {t('product_page.you_may_like')}
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }} className={styles.relatedGrid}>
                            {relatedProducts.map((p) => (
                            // @ts-ignore
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </div>
                    </div>
                )}

            </main>

            <Footer categories={[]} />

            <GuestBookConfigModal
                isOpen={guestbookModalOpen}
                onClose={() => setGuestbookModalOpen(false)}
                initialConfig={{
                    size: String(customProductOptions['Розмір'] || ''),
                    pageColor: String(customProductOptions['Колір сторінок'] || ''),
                    coverType: String(customProductOptions['Вид обкладинки'] || customProductOptions['Тип обкладинки'] || ''),
                    coverColor: String(customProductOptions['Колір обкладинки'] || ''),
                }}
            />

        </div>
    );
}
