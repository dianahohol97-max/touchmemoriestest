'use client';
import { useT, useLocale } from '@/lib/i18n/context';
import { getLocalized } from '@/lib/i18n/localize';
import { useState, useEffect } from 'react';
import styles from './product-page.module.css';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import ReviewForm from '@/components/ReviewForm';
import { notFound, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ProductCard } from '@/components/ui/ProductCard';
import { SizeVisualizer } from '@/components/ui/SizeVisualizer';
import { ProductFeaturesBlock } from '@/components/ui/ProductFeaturesBlock';
import { ProductDetailsTabs } from '@/components/product/ProductDetailsTabs';
import { CheckCircle2, Star, Loader2, Image as ImageIcon, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import React from 'react'
import { useCartStore } from '@/store/cart-store';
import { trackViewItem, trackAddToCart } from '@/components/providers/AnalyticsProvider';
import { toast } from 'sonner';
import { PhotobookOptions } from '@/components/ui/PhotobookOptions';
import { ProductOptionsSelector, areAllRequiredOptionsFilled } from '@/components/ui/ProductOptionsSelector';
import WishlistButton from '@/components/WishlistButton';
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
  // Wedding newspaper — dedicated questionnaire (design choice + per-design
  // fields + photo upload), answers ride on the order for the designer.
  if (s.includes('newspaper') || s.includes('газет'))
    return '/order/wedding-newspaper';
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

const getOrderUrl = (slug: string, selectedOptions: Record<string, number>, product: any, customOpts: Record<string, string | number> = {}): string => {
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

    // The visual size picker writes its choice (the option `value`) into
    // customProductOptions — under 'Розмір' for photoprint, 'Формат' for
    // polaroid. The order page reads ?size= and matches it back to a real
    // option, so forward whichever one is set — otherwise the size is lost
    // and the constructor falls back to its first size.
    const sizeVal = customOpts['Розмір'] ?? customOpts['Формат'];
    if (sizeVal !== undefined && sizeVal !== '') params.set('size', String(sizeVal));

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

export default function ProductPage({ params, initialProduct, initialReviews }: { params: Promise<{ slug: string }>; initialProduct?: any; initialReviews?: any[] }) {
  const t = useT();
    const locale = useLocale();
    const optLabel = (name: string) => { const k = t('option_labels.' + name); return k !== 'option_labels.' + name ? k : name; };
    const optValueLabel = (label: string) => {
        // First try full-string translation
        const kFull = t('option_value_labels.' + label);
        if (kFull !== 'option_value_labels.' + label) return kFull;
        // If label has a price suffix like "З калькою (+300 грн)", translate the base part only
        const m = label.match(/^(.+?)\s*(\(.+\))\s*$/);
        if (m) {
            const base = m[1].trim();
            const suffix = m[2];
            const kBase = t('option_value_labels.' + base);
            if (kBase !== 'option_value_labels.' + base) return `${kBase} ${suffix}`;
        }
        return label;
    };
    const resolvedParams = React.use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [product, setProduct] = useState<any>(initialProduct ?? null);
    const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(!initialProduct);
    const [isNotFound, setIsNotFound] = useState(false);

    const [mainImage, setMainImage] = useState<string>(
        (initialProduct?.images && initialProduct.images[0]) || ''
    );
    const [mainVideo, setMainVideo] = useState<string>(
        (initialProduct && !(initialProduct.images && initialProduct.images.length) && initialProduct.video_url) || ''
    );
    // Graduation photo books are ordered as class sets — start at 5 copies
    // (and the stepper won't go below 5); everything else starts at 1.
    const [quantity, setQuantity] = useState(() => (product?.slug?.includes('graduation') ? 5 : 1));
    const [activeTab, setActiveTab] = useState('description');

    // Photobook-specific state
    const [photobookPrice, setPhotobookPrice] = useState(0);
    const [photobookOptions, setPhotobookOptions] = useState<any>(null);
    const [photobookPricesData, setPhotobookPricesData] = useState<any[]>([]);

    const getProductionTime = (categorySlug: string = '', productSlug: string = '') => {
        const s = (categorySlug || '').toLowerCase();
        const ps = (productSlug || '').toLowerCase();
        if (s.includes('photobook') || s.includes('фотокниг')) return t('product_page.production_10_14');
        if (s.includes('travelbook') || s.includes('travel')) return t('product_page.production_upto_10');
        // Hard cover journal: 10–14 days
        if (ps.includes('tverd') || ps.includes('hard') || s.includes('tverd') || s.includes('hard-cover')) return t('product_page.production_10_14');
        if (s.includes('magazine') || s.includes('journal') || s.includes('журнал') || s.includes('hlyantsevi') || s.includes('glyantsevy')) return t('product_page.production_5_8');
        if (s.includes('guestbook') || s.includes('photoalbum') || s.includes('wishbook')) return t('product_page.production_10');
        if (s.includes('print') || s.includes('photo-print') || s.includes('magnet')) return t('product_page.production_2_3');
        if (s.includes('puzzle') || s.includes('canvas')) return t('product_page.production_5_7');
        // Posters: 2–4 working days
        if (ps.includes('poster') || s.includes('poster') || ps.includes('зодіак') || ps.includes('монограм') || ps.includes('диплом') || ps.includes('portrait') || ps.includes('birth')) return t('product_page.production_2_4');
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

    // Sync selected options to sessionStorage so back-navigation restores state
    useEffect(() => {
        if (typeof window === 'undefined' || Object.keys(customProductOptions).length === 0) return;
        const key = `product_options_${window.location.pathname}`;
        sessionStorage.setItem(key, JSON.stringify(customProductOptions));
    }, [customProductOptions]);

    // Recalculate price when customProductOptions change for travelbook
    useEffect(() => {
        if (!product) return;
        const slugLower = (product.slug || '').toLowerCase();
        if (!slugLower.includes('travel') && !slugLower.includes('travelbook')) return;

        const TRAVELBOOK_PRICES: Record<number, number> = {
            12: 675, 16: 825, 20: 975, 24: 1125, 28: 1275, 32: 1425,
            36: 1575, 40: 1725, 44: 1875, 48: 2025, 52: 2150,
            60: 2350, 72: 2650, 80: 2900,
        };

        const pages = Number(customProductOptions['Кількість сторінок']) || 0;
        if (!pages) return;

        let total = TRAVELBOOK_PRICES[pages] || 0;
        if (!total) return;
        if (customProductOptions['Ламінація сторінок'] === 'З ламінацією сторінок') total += pages * 7;

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
            let data: any = initialProduct || null;
            let error: any = null;
            if (!data) {
                setIsLoading(true);
                ({ data, error } = await supabase
                    .from('products')
                    .select('*, categories(name, slug, translations)')
                    .eq('slug', resolvedParams.slug)
                    .eq('is_active', true)
                    .single());
            }

            if (error || !data) {
                setIsNotFound(true);
            } else {
                setProduct(data);
                trackViewItem(data);
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
                    // First pass: find default size to know min_pages
                    const sizeOpt = data.options.find((o: any) => o.name === 'Розмір');
                    const defaultSizeValue = sizeOpt?.options?.[0]?.value || '';
                    const defaultMinPages = sizeOpt?.options?.[0]?.min_pages || 6;

                    data.options.forEach((opt: any) => {
                        const items = opt.options || opt.values;
                        if (items && items.length > 0) {
                            const s = (data.slug || '').toLowerCase();
                            const isPhotoprint = s.includes('photoprint') || s.includes('polaroid');
                            if (isPhotoprint && opt.name !== 'Розмір') {
                                defaultOptions[opt.name] = items[0].value ?? items[0].name ?? 0;
                            } else if (!isPhotoprint) {
                                if (opt.name === 'Кількість сторінок') {
                                    // Find first item that meets min_pages for default size
                                    const firstValid = items.find((item: any) => {
                                        const pageNum = Number(item.value || item.label?.match(/\d+/)?.[0] || 0);
                                        return pageNum >= defaultMinPages;
                                    });
                                    defaultOptions[opt.name] = firstValid?.value ?? items[0].value ?? items[0].name ?? 0;
                                } else {
                                    defaultOptions[opt.name] = items[0].value ?? items[0].name ?? 0;
                                }
                            }
                        }
                    });
                }
                // For travelbook/photojournal/wishbook — also init ProductOptionsSelector defaults
                // so dynamicPrice gets calculated on first render
                const slugLower = (data.slug || '').toLowerCase();
                if (slugLower.includes('travel') || slugLower.includes('travelbook')) {
                    if (!defaultOptions['Кількість сторінок']) defaultOptions['Кількість сторінок'] = 12;
                    if (!defaultOptions['Ламінація сторінок']) defaultOptions['Ламінація сторінок'] = 'Без ламінації';
                }

                // Restore options from sessionStorage if present (back-navigation)
                const storageKey = `product_options_${window.location.pathname}`;
                const saved = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null;
                const savedOptions = saved ? JSON.parse(saved) : {};
                if (Object.keys(savedOptions).length > 0) {
                    // Validate saved pages against min_pages of saved size
                    const mergedOpts = { ...defaultOptions, ...savedOptions };
                    const savedSize = mergedOpts['Розмір'];
                    const sizeOptForValidation = data.options?.find((o: any) => o.name === 'Розмір');
                    // Normalize the × / х / x separator before matching. The
                    // SizeVisualizer stores the size using whatever spelling is
                    // in PRODUCT_OPTIONS (Cyrillic 'х' — '20х30'), while the DB
                    // option values use Latin 'x' ('20x30'). A strict === miss
                    // here meant savedMinPages fell back to 6 and a 20×30 book
                    // (min 10) shipped 6 pages to the constructor. Normalizing
                    // both sides to Latin 'x' fixes the lookup.
                    const normSize = (v: any) => String(v ?? '').toLowerCase().replace(/[х×]/g, 'x').replace(/\s*см.*$/, '').trim();
                    const savedSizeNorm = normSize(savedSize);
                    const savedSizeItem = sizeOptForValidation?.options?.find((s: any) =>
                        normSize(s.value) === savedSizeNorm || normSize(s.label) === savedSizeNorm
                    );
                    const savedMinPages = savedSizeItem?.min_pages || 6;
                    const savedPages = Number(mergedOpts['Кількість сторінок'] || 0);
                    if (savedPages > 0 && savedPages < savedMinPages) {
                        mergedOpts['Кількість сторінок'] = String(savedMinPages);
                    }
                    // Normalize verbatim labels back to canonical values. The
                    // selector's toggle UI for «Терміновість» stores the full
                    // label (e.g. 'Термінова 1–3 дні (+30%)'), which on a
                    // second visit re-hydrates as the selected value. The
                    // surcharge_pct gate already matches both label and
                    // value, but the toggle UI's `isActive` check is strict
                    // equality, so the urgent button silently stays selected
                    // across sessions even though the user never clicked it.
                    // Map any saved label back to its DB value when the
                    // product's options list provides a match.
                    if (Array.isArray(data.options)) {
                        data.options.forEach((opt: any) => {
                            const savedVal = mergedOpts[opt.name];
                            if (typeof savedVal !== 'string') return;
                            const items = opt.options || [];
                            const exactValue = items.find((i: any) => String(i.value) === savedVal);
                            if (exactValue) return; // already canonical
                            const byLabel = items.find((i: any) => i.label === savedVal);
                            if (byLabel && byLabel.value !== undefined) {
                                mergedOpts[opt.name] = byLabel.value;
                            }
                        });
                    }
                    setCustomProductOptions(mergedOpts);
                } else {
                    setCustomProductOptions(defaultOptions);
                }

                // Fetch Related Products
                const { data: relatedData } = await supabase
                    .from('products')
                    .select('id, name, slug, price, price_from, short_description, images, is_popular, popular_order, created_at, category_id, translations')
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

    const isPhotobook = product.slug?.includes('photobook') || product.slug?.includes('graduation');
    const minQuantity = product.slug?.includes('graduation') ? 5 : 1;
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
        else if (sl.includes('graduation')) coverName = 'Випускна';

        if (sizeNorm && pageCount) {
            const entry = photobookPricesData.find((p: any) =>
                p.cover_type?.name === coverName && p.size?.name === sizeNorm && p.page_count === pageCount
            );
            if (entry) {
                finalPrice = Number(entry.base_price) || 0;
                // Калька / tracing paper surcharge
                if (String(kalkaVal).includes('калькою') || String(kalkaVal).includes('Так') || kalkaVal === 'with') {
                    finalPrice += Number(entry.kalka_surcharge) || 300;
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
        // Photoprint / polaroid / photomagnet are "size IS the price" products:
        // each size in product.options carries the FULL per-unit price (7.5 or
        // 8 ₴), not a surcharge over product.price. If we let Source 3 below
        // treat it as a modifier we'd add 8 on top of the 7.5 base → 15.5 ₴,
        // which is exactly what was shown on the nonstandard page. Detect
        // these products by slug and overwrite finalPrice with the matching
        // size's price instead of adding to it.
        const slugLower = (product.slug || '').toLowerCase();
        const isPhotoprintLike =
            slugLower.includes('photoprint') ||
            slugLower.includes('polaroid') ||
            slugLower.includes('photomagnet');
        if (isPhotoprintLike) {
            const sizeOpt = product.options.find((o: any) => o.name === 'Розмір' || o.name === 'Формат');
            if (sizeOpt) {
                const sel = customProductOptions[sizeOpt.name];
                if (sel !== undefined) {
                    const items = sizeOpt.options || sizeOpt.values || [];
                    const match = items.find((i: any) =>
                        i === sel || String(i.value) === String(sel) ||
                        i.label === sel || i.name === sel
                    );
                    if (match && typeof match === 'object' && match.price != null) {
                        finalPrice = Number(match.price) || finalPrice;
                    }
                }
            }
        }
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
            'Терміновість',
            // Note: 'Верстка тексту' is INTENTIONALLY NOT excluded here.
            // The ProductOptionsSelector returns the BASE magazine price
            // without the typesetting surcharge, so the +195 ₴ has to be
            // added by this Source 3 modifier loop. That way the
            // surcharge × 1.3 (urgency) multiplies the base price only,
            // and the flat typesetting fee rides on top — matching how
            // the editor BookLayoutEditor and the catalog magazine-a4
            // page calculate it. See lib/products.ts getMagazinePrice.
            //
            // Exclude 'Розмір' only when already handled by ProductOptionsSelector or photobook lookup
            ...(dynamicPrice !== null || isPhotobook || isPhotoprintLike ? ['Розмір', 'Формат'] : []),
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

        // Apply percentage surcharges (e.g. Терміновість +30%) BEFORE
        // adding the flat-rate extras. Урgency multiplies the base
        // production price; typesetting / inscription / kalka are flat
        // labour fees that don't compound with the rush. So:
        //   525 base × 1.3 urgent + 195 typesetting = 878 ✅
        // not the previous order which gave
        //   (525 + 195) × 1.3 = 936 ❌
        if (product.options && Array.isArray(product.options)) {
            product.options.forEach((opt: any) => {
                if (!opt.options) return;
                const selected = customProductOptions[opt.name];
                if (!selected) return;
                const match = opt.options.find((i: any) =>
                    String(i.value) === String(selected) || i.label === selected
                );
                if (match && match.surcharge_pct && Number(match.surcharge_pct) > 0) {
                    finalPrice = Math.round(finalPrice * (1 + Number(match.surcharge_pct) / 100));
                }
            });
        }
        // Flat extras (typesetting, retouching, QR, etc.) ride on top
        // of the rush-inflated baseline, not below it.
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
            // Pull every selected option from BOTH state shapes so the cart
            // shows the full configuration to the customer and the manager.
            //
            // Two state buckets exist for historical reasons:
            //   selectedOptions      — legacy numeric-index map, used by
            //                          old `opt.values` array products
            //   customProductOptions — newer string-value map used by
            //                          modern `opt.options` array products
            //                          (the format DB-driven products like
            //                          the glossy magazine use today)
            //
            // Previously this only read selectedOptions, so all the
            // magazine's "Верстка тексту" / "Терміновість" choices etc.
            // never made it into the cart line — the customer just saw
            // "8 сторінок" with no other context.
            product.options.forEach((opt: any) => {
                // Modern shape: opt.options with {value,label}
                if (opt.options && Array.isArray(opt.options)) {
                    const selectedVal = customProductOptions[opt.name];
                    if (selectedVal !== undefined && selectedVal !== '' && selectedVal !== 'none') {
                        const match = opt.options.find((i: any) =>
                            String(i.value) === String(selectedVal) ||
                            i.label === selectedVal
                        );
                        if (match) {
                            // Show the human label, not the slug value
                            itemOptions[opt.name] = match.label || String(selectedVal);
                        } else if (typeof selectedVal === 'string' || typeof selectedVal === 'number') {
                            itemOptions[opt.name] = String(selectedVal);
                        }
                    }
                    return;
                }
                // Legacy shape: opt.values with index from selectedOptions
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
            personalization_note: personalizationNote,
            payment_mode: (product as any).payment_mode, // for split payment eligibility at checkout
        });

        trackAddToCart(product, quantity);
        toast.success(t('product_page.added_to_cart'));
    };

    // "Buy certificate" for THIS product: the customer must pick the product's
    // characteristics first (same as ordering it). If any option group is left
    // unchosen we block and tell them which; otherwise we stash the product +
    // chosen options + price and send them to the certificate page in product
    // mode (a product certificate is valid 3 months).
    const handleBuyCertificate = () => {
        const itemOptions: Record<string, string> = {};
        const missing: string[] = [];

        if (isPhotobook) {
            if (photobookOptions && photobookOptions.size && photobookOptions.pages) {
                itemOptions['Розмір'] = photobookOptions.size;
                itemOptions['Кількість сторінок'] = `${photobookOptions.pages} сторінок`;
                if (photobookOptions.calca) itemOptions['Калька'] = 'Так';
            } else {
                missing.push('розмір та кількість сторінок');
            }
        } else if (product.options && Array.isArray(product.options)) {
            product.options.forEach((opt: any) => {
                if (opt.options && Array.isArray(opt.options) && opt.options.length > 0) {
                    const selectedVal = customProductOptions[opt.name];
                    if (selectedVal === undefined || selectedVal === '' || selectedVal === 'none') {
                        missing.push(opt.name);
                    } else {
                        const match = opt.options.find((i: any) =>
                            String(i.value) === String(selectedVal) || i.label === selectedVal);
                        itemOptions[opt.name] = match?.label || String(selectedVal);
                    }
                    return;
                }
                if (opt.values && Array.isArray(opt.values) && opt.values.length > 0) {
                    const idx = selectedOptions[opt.name];
                    if (idx === undefined || !opt.values[idx]) missing.push(opt.name);
                    else itemOptions[opt.name] = opt.values[idx].name;
                }
            });
        }

        if (missing.length > 0) {
            toast.error(t('product_page.certificate_select_options').replace('{options}', missing.join(', ')));
            return;
        }

        const optionsSummary = Object.entries(itemOptions).map(([k, v]) => `${k}: ${v}`).join(', ');
        try {
            sessionStorage.setItem('productCert', JSON.stringify({
                productId: product.id,
                slug: product.slug,
                productName: product.name,
                price: finalPrice,
                options: itemOptions,
                optionsSummary,
            }));
        } catch { /* sessionStorage unavailable — page falls back to money mode */ }
        router.push('/catalog/gift-certificate?mode=product');
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
                        <div className={styles.mainImageContainer} style={{ position: 'relative', width: '100%', aspectRatio: '4/5', maxHeight: 720, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

                        {/* Desktop placement: tabs under the gallery in the left column.
                            Hidden on mobile (≤900px) — mobile uses the .tabsMobile copy below. */}
                        <div className={styles.tabsDesktop}>
                            <ProductDetailsTabs
                                product={product}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                locale={locale}
                                t={t}
                                showTopBorder={false}
                            />
                        </div>
                    </div>

                    {/* Right Column: Details */}
                    <div>
                        {/* Title row with wishlist button — h1 takes available
                            width, heart sits in top-right of the column.
                            Using the same store-backed WishlistButton as
                            ProductCard so the state is consistent between
                            list and detail views. */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: '16px' }}>
                            <h1 className={styles.productTitleMain} style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, marginBottom: 0, lineHeight: 1.2, flex: 1 }}>
                                {getLocalized(product, locale, "name")}
                            </h1>
                            <div style={{ flexShrink: 0, marginTop: 4 }}>
                                <WishlistButton productId={product.id} />
                            </div>
                        </div>
                        {product.short_description && (
                            <p style={{ fontSize: '16px', color: '#666', lineHeight: 1.6, marginBottom: '24px' }}>
                                {getLocalized(product, locale, 'short_description')}
                            </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                            <div className={styles.priceContainer} style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)' }}>
                                {product.slug?.includes('polaroid') || product.slug?.includes('поляроїд') || product.slug?.includes('полароїд')
                                    ? `від ${product.price} ₴/шт`
                                    : product.slug?.includes('photoprint')
                                        ? `${finalPrice} ₴`
                                        : `${product.price_from ? t('product_page.from_price') + ' ' : ''}${finalPrice} ₴`}
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
                                            .filter((opt: any) => (opt.options?.length > 0 || opt.values?.length > 0) && !['Покриття', 'Біла рамочка 3мм', 'Матеріал', 'Рамка', 'Вид'].includes(opt.name))
                                            .map((opt: any) => {
                                                const items = opt.options || opt.values || [];
                                                return (
                                                    <div key={opt.name}>
                                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e2d7d' }}>
                                                            {optLabel(opt.name)} {opt.required !== false ? <span style={{color:'#e53e3e'}}>*</span> : null}
                                                        </label>
                                                        {(opt.name === 'Розмір' || opt.name === 'Формат') && (() => {
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
                                                                    onSelect={(size) => {
                                                                    // Page-reset only applies to photobook 'Розмір' (min_pages).
                                                                    // Polaroid 'Формат' has no page count — just store the value.
                                                                    if (opt.name === 'Розмір') {
                                                                        const sizeItem = opt.options?.find((s: any) => s.value === size);
                                                                        const minPages = sizeItem?.min_pages || 6;
                                                                        setCustomProductOptions(prev => {
                                                                            const currentPages = Number(prev['Кількість сторінок'] || 0);
                                                                            const newPages = currentPages < minPages ? String(minPages) : prev['Кількість сторінок'];
                                                                            return { ...prev, [opt.name]: size, 'Кількість сторінок': newPages };
                                                                        });
                                                                    } else {
                                                                        setCustomProductOptions(prev => ({ ...prev, [opt.name]: size }));
                                                                    }
                                                                }}
                                                                    prices={prices}
                                                                    wrap={sizeValues.length > 5}
                                                                    forcePortrait={!!(product.slug && (product.slug.includes('photoprint') || product.slug.includes('polaroid') || product.slug.includes('полароїд') || product.slug.includes('поляроїд')))}
                                                                />
                                                            );
                                                        })()}
                                                        {opt.name !== 'Розмір' && opt.name !== 'Формат' && <select
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
                                                            {items.filter((item: any) => {
                                                                // Filter pages by min_pages of selected size
                                                                if (opt.name === 'Кількість сторінок') {
                                                                    const selectedSizeVal = String(customProductOptions['Розмір'] || '');
                                                                    if (selectedSizeVal) {
                                                                        // Find min_pages from the size option
                                                                        const sizeOpt = product.options?.find((o: any) => o.name === 'Розмір');
                                                                        const sizeItem = sizeOpt?.options?.find((s: any) => s.value === selectedSizeVal);
                                                                        const minPages = sizeItem?.min_pages || 6;
                                                                        const pageNum = Number(item.value || item.label?.match(/\d+/)?.[0] || 0);
                                                                        if (pageNum > 0 && pageNum < minPages) return false;
                                                                    }
                                                                }
                                                                return true;
                                                            }).map((item: any, idx: number) => {
                                                                const label = item.label || item.name || String(item);
                                                                const value = item.value || item.name || String(item);
                                                                const price = Number(item.price || 0);
                                                                // Don't show (+X ₴) if label already contains price (грн/₴)
                                                                const labelHasPrice = /\d+\s*(грн|₴)/.test(label);
                                                                const basePrice = Number(product.price || 0);
                                                                return (
                                                                    <option key={idx} value={value}>
                                                                        {optValueLabel(label)}{price > 0 && !labelHasPrice ? ` — ${basePrice + price} ₴` : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>}
                                                        {(() => {
                                                            // Level-1 cover inscription: when the selected value of
                                                            // this DB option signals a custom inscription, show a
                                                            // free-text field. Primary trigger is item.allows_text
                                                            // (toggle in admin); the legacy value/label heuristics
                                                            // (custom-text / напис / індивідуальн / engrav) stay as
                                                            // fallback so existing data keeps working without
                                                            // requiring re-edits in admin.
                                                            const sel = customProductOptions[opt.name];
                                                            if (sel === undefined || sel === null || sel === '') return null;
                                                            const selStr = String(sel).toLowerCase();
                                                            const match = items.find((it: any) =>
                                                                String(it.value ?? it.name ?? it) === String(sel));
                                                            const lbl = String(match?.label || match?.name || sel).toLowerCase();
                                                            const isInscription =
                                                                match?.allows_text === true ||
                                                                selStr.includes('custom-text') || selStr.includes('custom_text') ||
                                                                lbl.includes('напис') || lbl.includes('індивідуальн') || lbl.includes('engrav');
                                                            if (!isInscription) return null;
                                                            const KEY = 'Напис на обкладинці';
                                                            return (
                                                                <div style={{ marginTop: 10 }}>
                                                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e2d7d', marginBottom: 6 }}>
                                                                        Текст напису на обкладинці <span style={{ color: '#e53e3e' }}>*</span>
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={String(customProductOptions[KEY] ?? '')}
                                                                        maxLength={60}
                                                                        placeholder="Напр.: Родина Петренків · 2026"
                                                                        onChange={(e) => setCustomProductOptions(prev => ({ ...prev, [KEY]: e.target.value }))}
                                                                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                                                                    />
                                                                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>
                                                                        До 60 символів. Напис буде нанесено на обкладинку.
                                                                    </p>
                                                                </div>
                                                            );
                                                        })()}
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
                                        const slugL = (product.slug || '').toLowerCase();
                                        // "Magazine-like" products that get their Кількість сторінок,
                                        // Верстка тексту and Терміновість rendered by ProductOptionsSelector
                                        // above — so the DB-driven fallback must NOT show them a second
                                        // time. We catch both the English `magazine` slug and the
                                        // Ukrainian `zhurnal` / `fotozhurnal` / `journal` slugs that the
                                        // hard-cover journal product uses.
                                        const isPhotobookOrMagazine =
                                            slugL.includes('photobook') ||
                                            slugL.includes('magazine') ||
                                            slugL.includes('zhurnal') ||
                                            slugL.includes('fotozhurnal') ||
                                            slugL.includes('journal') ||
                                            slugL.includes('graduation');
                                        const isTravelbook = slugL.includes('travelbook') || slugL.includes('travel');
                                        const hardcodedNames = new Set(['Розмір', ...(isPhotobookOrMagazine || isTravelbook ? ['Кількість сторінок'] : []), 'Тип обкладинки',
                                            'Калька перед першою сторінкою', 'Тип ламінації', 'Текст', 'Оздоблення',
                                            'Варіант акрилу', 'Варіант фотовставки', 'Варіант металевої вставки',
                                            'Варіант тиснення', 'Варіант гравірування', 'Корінець',
                                            'Рамка', 'Вид', 'Покриття', 'Біла рамочка 3мм', 'Матеріал',
                                            'Матеріал обкладинки', 'Колір сторінок',
                                            'Верстка тексту', 'Терміновість', 'Ламінація сторінок', 'Ламінування сторінок',
                                            // The hard-cover journal (fotozhurnal-tverd) carries a DB option
                                            // "Ламінація обкладинки" (Глянцева/Матова) that is the SAME thing as
                                            // the hardcoded "Тип обкладинки" rendered by ProductOptionsSelector
                                            // — so it was showing up twice. Exclude it for the magazine/journal
                                            // family as well, not only travelbook.
                                            ...(isTravelbook || isPhotobookOrMagazine ? ['Ламінація обкладинки', 'Ламінація', 'Індивідуальна обкладинка'] : []),
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
                                                            {items.filter((item: any) => item?.stock == null || Number(item.stock) > 0).map((item: any, idx: number) => {
                                                                const label = item.label || item.name || item;
                                                                const value = item.value || item.name || item;
                                                                const price = Number(item.price || 0);
                                                                const labelHasPrice = /\d+\s*(грн|₴)/.test(String(label));
                                                                const basePr = Number(product.price || 0);
                                                                return (
                                                                    <option key={idx} value={value}>
                                                                        {optValueLabel(label)}{price > 0 && !labelHasPrice ? ` — ${basePr + price} ₴` : ''}
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
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>{t('product_page.quantity_label')}</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <button
                                                onClick={() => setQuantity(Math.max(minQuantity, quantity - 1))}
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
                                        () => router.push(getOrderUrl(product.slug, selectedOptions, product, customProductOptions)),
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
                                    {t('product_page.upload_order_hint')}
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
                                        {t('product_page.select_required_options')}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                                    {(() => {
                                        // When the customer chose "Ми пишемо" (we write the
                                        // text), the flow is a single path: go to the brief
                                        // questionnaire. There's no editor and no separate
                                        // designer option, so collapse the two-button row
                                        // into one "Замовити" button that routes to the brief.
                                        const isWeWriteText = String(customProductOptions['Верстка тексту'] || '') === 'we'
                                            || String(customProductOptions['Верстка тексту'] || '') === 'we-basic'
                                            || String(customProductOptions['Верстка тексту'] || '') === 'we-premium';
                                        if (isWeWriteText) {
                                            return (
                                                <button
                                                    onClick={() => {
                                                        const slug = product.slug || resolvedParams.slug;
                                                        const textLayout = String(customProductOptions['Верстка тексту'] || '');
                                                        const briefUrl = textLayout === 'we'
                                                            ? `/order/magazine-text-brief?product=${slug}`
                                                            : `/order/magazine-text-brief?product=${slug}&package=${textLayout === 'we-premium' ? 'premium' : 'basic'}`;
                                                        const url = new URL(briefUrl, 'http://x');
                                                        // Carry the other selected options (pages, urgency)
                                                        // so the brief page can show an accurate total.
                                                        Object.entries(customProductOptions).forEach(([key, val]) => {
                                                            if (val !== undefined && val !== '' && key !== 'Верстка тексту') {
                                                                url.searchParams.set(key, String(val));
                                                            }
                                                        });
                                                        const finalUrl = url.pathname + '?' + url.searchParams.toString();
                                                        requireAuth(() => router.push(finalUrl), 'Щоб замовити журнал з нашим текстом — увійдіть в акаунт');
                                                    }}
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
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        borderRadius: '6px',
                                                    }}
                                                    className="hover:bg-[#1a2966]"
                                                >
                                                    Замовити
                                                </button>
                                            );
                                        }
                                        return (
                                    <div className={styles.flexResponsive} style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            onClick={() => {
                                                const slug = product.slug || resolvedParams.slug;
                                                const base = getConstructorUrl(slug);
                                                // Magazine "we write the text" packages bypass the
                                                // constructor entirely and go to the questionnaire
                                                // flow at /order/magazine-text-brief, which
                                                // collects the briefing answers, photos and the
                                                // cover inscription, then submits an order with
                                                // text_brief jsonb attached.
                                                const textLayout = String(customProductOptions['Верстка тексту'] || '');
                                                // 'we' (and legacy we-basic/we-premium) means "we write the
                                                // text" → go to the brief questionnaire instead of the editor.
                                                // The package (basic/premium) is now chosen ON the brief page,
                                                // so for the new 'we' value we don't preselect one. Legacy
                                                // values still pass their package through for back-compat.
                                                if (textLayout === 'we' || textLayout === 'we-basic' || textLayout === 'we-premium') {
                                                    const briefUrl = textLayout === 'we'
                                                        ? `/order/magazine-text-brief?product=${slug}`
                                                        : `/order/magazine-text-brief?product=${slug}&package=${textLayout === 'we-premium' ? 'premium' : 'basic'}`;
                                                    // Carry over the other options so the brief page can
                                                    // show the final price in the summary.
                                                    const url = new URL(briefUrl, 'http://x');
                                                    Object.entries(customProductOptions).forEach(([key, val]) => {
                                                        if (val !== undefined && val !== '' && key !== 'Верстка тексту') {
                                                            url.searchParams.set(key, String(val));
                                                        }
                                                    });
                                                    requireAuth(() => router.push(url.pathname + '?' + url.searchParams.toString()), 'Щоб оформити замовлення з нашим текстом — увійдіть в акаунт');
                                                    return;
                                                }
                                                let constructorUrl = base;
                                                if (base.includes('/order/book') && (Object.keys(customProductOptions).length > 0 || photobookOptions)) {
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
                                                        'Терміновість': 'urgent',
                                                    };
                                                    const url = new URL(base, 'http://x');
                                                    // For photobook products, size and pages live in
                                                    // photobookOptions (not customProductOptions) because
                                                    // they're rendered by the dedicated PhotobookOptions
                                                    // component. Merge them in first so the constructor
                                                    // URL carries the customer's actual selection
                                                    // instead of the constructor's defaults (which was
                                                    // sending the customer to 6-page / 20×20 even when
                                                    // they picked 10 pages / 20×30 on the product page).
                                                    if (isPhotobook && photobookOptions) {
                                                        if (photobookOptions.size) url.searchParams.set('size', photobookOptions.size);
                                                        if (photobookOptions.pages) url.searchParams.set('pages', String(photobookOptions.pages));
                                                        if (photobookOptions.calca) url.searchParams.set('tracing', 'with');
                                                    }
                                                    Object.entries(customProductOptions).forEach(([key, val]) => {
                                                        if (val !== undefined && val !== '') {
                                                            // Normalize the size separator to Latin 'x' so the
                                                            // constructor's photobook_sizes lookup matches
                                                            // regardless of whether the value was stored with
                                                            // Cyrillic 'х' (from SizeVisualizer) or '×'.
                                                            let outVal = String(val);
                                                            if (key === 'Розмір') {
                                                                outVal = outVal.toLowerCase().replace(/[х×]/g, 'x').replace(/\s*см.*$/, '').trim();
                                                            }
                                                            url.searchParams.set(keyMap[key] || key, outVal);
                                                        }
                                                    });
                                                    // Final guard: make sure the pages param respects the
                                                    // selected size's min_pages, in case state somehow still
                                                    // holds a stale value below the minimum (e.g. size came
                                                    // from sessionStorage without a fresh change event). This
                                                    // is the last line of defense before navigation so the
                                                    // customer never lands in the constructor with an invalid
                                                    // size/pages pair.
                                                    {
                                                        const sizeRaw = String(customProductOptions['Розмір'] || '');
                                                        const sizeNorm = sizeRaw.toLowerCase().replace(/[х×]/g, 'x').replace(/\s*см.*$/, '').trim();
                                                        const sizeOpt = (product.options as any[])?.find((o: any) => o?.name === 'Розмір');
                                                        const sizeItem = sizeOpt?.options?.find((s: any) =>
                                                            String(s.value || '').toLowerCase().replace(/[х×]/g, 'x').trim() === sizeNorm
                                                        );
                                                        const minP = Number(sizeItem?.min_pages || 0);
                                                        const curP = Number(String(customProductOptions['Кількість сторінок'] || '').replace(/[^\d]/g, '')) || 0;
                                                        if (minP > 0 && curP > 0 && curP < minP) {
                                                            url.searchParams.set('pages', String(minP));
                                                        }
                                                    }
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
                                            {t('product_page.open_editor')}
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
                                                () => {
                                                    // Carry the chosen product + options into the
                                                    // designer flow so /order can show the right
                                                    // photo recommendation, cover block, etc.
                                                    // Without this the designer page had no product
                                                    // context (the bug Diana hit: 94 photos, no
                                                    // limits, no cover block).
                                                    try {
                                                        sessionStorage.setItem('designerOrderConfig', JSON.stringify({
                                                            slug: product.slug || resolvedParams.slug,
                                                            productName: product.name || '',
                                                            config: customProductOptions,
                                                        }));
                                                    } catch {}
                                                    router.push('/order');
                                                },
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
                                        );
                                    })()}
                                    {!(String(customProductOptions['Верстка тексту'] || '').startsWith('we')) && (
                                        <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
                                            {t('product_page.designer_order_hint')}
                                        </p>
                                    )}
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
                                        {t('product_page.select_required_options')}
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
                                        {t('product_page.select_required_options')}
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
                                 {t('product_page.hint_as_gift')}
                            </button>
                            <button
                                onClick={handleBuyCertificate}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                    padding: '12px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                                    background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151',
                                    transition: 'all 0.15s' }}
                                onMouseOver={(e: any) => (e.currentTarget.style.background = '#fefce8', e.currentTarget.style.borderColor = '#facc15')}
                                onMouseOut={(e: any) => (e.currentTarget.style.background = '#fff', e.currentTarget.style.borderColor = '#e2e8f0')}
                            >
                                 {t('product_page.buy_certificate')}
                            </button>
                        </div>

                        {/* Gift Hint Modal */}
                        {showGiftHint && (
                            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                                onClick={e => e.target === e.currentTarget && setShowGiftHint(false)}>
                                <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                                    {giftHintSent ? (
                                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                            <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                                            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>{t('product_page.hint_sent_title')}</h3>
                                            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>{t('product_page.hint_sent_description')}</p>
                                            <button onClick={() => { setShowGiftHint(false); setGiftHintSent(false); setGiftHintForm({ senderName: '', recipientName: '', recipientEmail: '', message: '' }); }}
                                                style={{ padding: '12px 32px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                                                {t('product_page.hint_close')}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: 0 }}> {t('product_page.hint_as_gift')}</h3>
                                                <button onClick={() => setShowGiftHint(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>×</button>
                                            </div>
                                            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                                                {t('product_page.hint_modal_description')}
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                <input
                                                    placeholder={t('product_page.hint_your_name')}
                                                    value={giftHintForm.senderName}
                                                    onChange={e => setGiftHintForm(p => ({ ...p, senderName: e.target.value }))}
                                                    style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                                />
                                                <input
                                                    placeholder={t('product_page.hint_recipient_name')}
                                                    value={giftHintForm.recipientName}
                                                    onChange={e => setGiftHintForm(p => ({ ...p, recipientName: e.target.value }))}
                                                    style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                                />
                                                <input
                                                    type="email"
                                                    placeholder={t('product_page.hint_recipient_email')}
                                                    value={giftHintForm.recipientEmail}
                                                    onChange={e => setGiftHintForm(p => ({ ...p, recipientEmail: e.target.value }))}
                                                    style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                                />
                                                <textarea
                                                    placeholder={t('product_page.hint_personal_message')}
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
                                                            else { toast.error(t('product_page.hint_error_retry')); }
                                                        } catch { toast.error(t('product_page.hint_error_network')); }
                                                        finally { setGiftHintSending(false); }
                                                    }}
                                                    style={{ padding: '13px', background: giftHintForm.recipientEmail ? '#1e2d7d' : '#e2e8f0',
                                                        color: giftHintForm.recipientEmail ? '#fff' : '#94a3b8',
                                                        border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
                                                        cursor: giftHintForm.recipientEmail ? 'pointer' : 'not-allowed',
                                                        transition: 'all 0.15s' }}
                                                >
                                                    {giftHintSending ? t('product_page.hint_sending') : t('product_page.hint_send')}
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
                                {(() => {
                                    const inStock = product.fulfillment_type === 'in_stock';
                                    const label = inStock ? t('product_page.shipping_time_label') : t('product_page.production_time_label');
                                    const value = (product.production_time && String(product.production_time).trim())
                                        ? product.production_time
                                        : (inStock ? t('product_page.shipping_default') : getProductionTime(product.categories?.slug || product.category_id, product.slug || ''));
                                    return `${label}: ${value}`;
                                })()}
                                {isJournalProduct(product.slug, product.categories?.slug || '') && (
                                    <span style={{ marginLeft: 8, fontSize: 12, color: '#f59e0b', fontWeight: 700, background: '#fffbeb', padding: '2px 8px', borderRadius: 4, border: '1px solid #fde68a' }}>
                                        {t('product_page.urgent_order')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile placement: tabs after the two-column grid.
                    Hidden on desktop (≥901px) — desktop uses the .tabsDesktop copy
                    inside the left gallery column. */}
                <div className={styles.tabsMobile}>
                    <ProductDetailsTabs
                        product={product}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        locale={locale}
                        t={t}
                    />
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

                {/* Product reviews + submission form. Listed reviews back the
                    AggregateRating schema; the form feeds the moderation queue. */}
                <div style={{ paddingTop: '60px' }}>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '32px', textAlign: 'center' }}>
                        Відгуки
                    </h2>
                    {Array.isArray(initialReviews) && initialReviews.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginBottom: 40 }}>
                            {initialReviews.map((r: any) => (
                                <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
                                    {r.image_url && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={r.image_url} alt={r.author || 'Відгук'} loading="lazy" style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
                                    )}
                                    <div style={{ padding: '12px 14px' }}>
                                        {r.rating ? (
                                            <div style={{ color: '#f0a500', fontSize: 14, letterSpacing: 2, marginBottom: 4 }}>
                                                {'★'.repeat(Math.round(r.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(r.rating)))}
                                            </div>
                                        ) : null}
                                        {r.caption && <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '0 0 6px' }}>{r.caption}</p>}
                                        {r.author && <div style={{ fontSize: 12, fontWeight: 600, color: '#1e2d7d' }}>{r.author}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <ReviewForm productId={product?.id} />
                </div>

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
