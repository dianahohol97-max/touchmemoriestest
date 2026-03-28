'use client';
import { useState, useEffect } from 'react';
import styles from './product-page.module.css';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ProductCard } from '@/components/ui/ProductCard';
import { CheckCircle2, Star, Loader2, Image as ImageIcon, Play } from 'lucide-react';
import Link from 'next/link'
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import React from 'react'
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { PhotobookOptions } from '@/components/ui/PhotobookOptions';
import { ProductOptionsSelector, areAllRequiredOptionsFilled } from '@/components/ui/ProductOptionsSelector';

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
  // Guest book
  if (s.includes('guestbook') || s.includes('wishbook') || s.includes('vishbuk') || s.includes('pobazhan'))
    return '/order/guest-book';
  // Photo albums
  if (s.includes('photoalbum') || s.includes('photoalbom') || s.includes('fotoalbom'))
    return `/order/book?product=${slug}`;
  // Calendar
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
  // Posters → use getConstructorUrl which has the full poster mapping
  if (slug.includes('poster')) {
    return getConstructorUrl(slug);
  }

  // For photoprint and photomagnet products, build order URL with selected options
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
    const resolvedParams = React.use(params);
    const router = useRouter();
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

    const getProductionTime = (categorySlug: string = '') => {
        const s = categorySlug.toLowerCase();
        if (s.includes('photobook')) return '14 робочих днів';
        if (s.includes('magazine')) return '4–8 робочих днів';
        if (s.includes('guestbook') || s.includes('photoalbum')) return '10 робочих днів';
        if (s.includes('print')) return '2–3 робочих дні';
        return '7–14 робочих днів';
    };

    // Store selected options -> mapping from option Name to selected value (index or value)
    const [selectedOptions, setSelectedOptions] = useState<Record<string, any>>({});
    const [customProductOptions, setCustomProductOptions] = useState<Record<string, string | number>>({});
    const [dynamicPrice, setDynamicPrice] = useState<number | null>(null);
    const [personalizationNote, setPersonalizationNote] = useState('');
    const [showPersonalizationInput, setShowPersonalizationInput] = useState(false);
    const { addItem } = useCartStore();

    useEffect(() => {
        const fetchProduct = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*, categories(name, slug)')
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
                if (data.options && Array.isArray(data.options)) {
                    data.options.forEach((opt: any) => {
                        const items = opt.options || opt.values;
                        if (items && items.length > 0) {
                            // Use the value field if available, else index 0
                            defaultOptions[opt.name] = items[0].value ?? items[0].name ?? 0;
                        }
                    });
                }
                setCustomProductOptions(defaultOptions);

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

    const isPhotobook = product.slug?.includes('photobook');

    // Calculate final price — priority: photobook table > dynamicPrice > generic modifiers
    let finalPrice = product.price || 0;

    // Source 1: Photobook prices table lookup (ALL photobooks use this when data available)
    if (isPhotobook && photobookPricesData.length > 0) {
        const sizeVal = String(customProductOptions['Розмір'] || '');
        const pagesVal = String(customProductOptions['Кількість сторінок'] || '');
        const kalkaVal = String(customProductOptions['Калька перед першою сторінкою'] || '');

        const pageCount = Number(String(pagesVal).replace(/[^\d]/g, '')) || 0;
        const sizeNorm = sizeVal.replace(/[хxX]/g, '×');

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
        // Names already handled by ProductOptionsSelector (hardcoded PRODUCT_OPTIONS)
        const hardcodedNames = new Set(['Розмір', 'Кількість сторінок', 'Тип обкладинки',
            'Калька перед першою сторінкою', 'Тип ламінації']);

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

        toast.success('Товар додано до кошика');
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
                    ← Назад
                </button>

                {/* Breadcrumbs */}
                <div className={styles.breadcrumbs} style={{ fontSize: '14px', color: '#888', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <Link href="/" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', whiteSpace: 'nowrap' }} className="hover:text-slate-600">Головна</Link>
                    <span>→</span>
                    <Link href="/catalog" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', whiteSpace: 'nowrap' }} className="hover:text-slate-600">Каталог</Link>
                    <span>→</span>
                    {product.categories && (
                        <>
                            <Link href={`/catalog?category=${product.categories.slug}`} style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', whiteSpace: 'nowrap' }} className="hover:text-slate-600">{product.categories.name}</Link>
                            <span>→</span>
                        </>
                    )}
                    <span style={{ color: '#263A99', fontWeight: 600 }}>{product.name}</span>
                </div>

                {/* Two Column Layout */}
                <div className={styles.productLayout} style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(300px, 450px)', gap: '60px', marginBottom: '80px' }}>

                    {/* Left Column: Images */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className={styles.mainImageContainer} style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: "3px", overflow: 'hidden', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {mainVideo ? (
                                <video
                                    src={mainVideo}
                                    controls
                                    autoPlay
                                    muted
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            ) : mainImage ? (
                                <Image
                                    src={mainImage}
                                    alt={product.name}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                />
                            ) : (
                                <ImageIcon size={64} className="text-slate-300" />
                            )}
                        </div>
                        {(thumbnails.length > 1 || product.video_url) && (
                            <div className={`${styles.thumbnailContainer} ${styles.customScrollbar}`} style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                                {thumbnails.map((src: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setMainImage(src);
                                            setMainVideo('');
                                        }}
                                        style={{
                                            position: 'relative',
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: "3px",
                                            overflow: 'hidden',
                                            border: mainImage === src && !mainVideo ? '2px solid var(--primary)' : '2px solid transparent',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            backgroundColor: '#f8f9fa'
                                        }}
                                    >
                                        <Image src={src} alt={`${product.name} thumbnail ${idx}`} fill style={{ objectFit: 'cover' }} />
                                    </button>
                                ))}
                                {product.video_url && (
                                    <button
                                        onClick={() => setMainVideo(product.video_url)}
                                        style={{
                                            position: 'relative',
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: "3px",
                                            overflow: 'hidden',
                                            border: mainVideo === product.video_url ? '2px solid var(--primary)' : '2px solid transparent',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            backgroundColor: 'black'
                                        }}
                                    >
                                        <video src={product.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Play size={20} color="white" />
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Details */}
                    <div>
                        <h1 className={styles.productTitleMain} style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, marginBottom: '16px', lineHeight: 1.2 }}>
                            {product.name}
                        </h1>
                        {product.short_description && (
                            <p style={{ fontSize: '16px', color: '#666', lineHeight: 1.6, marginBottom: '24px' }}>
                                {product.short_description}
                            </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                            <div className={styles.priceContainer} style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)' }}>
                                {`${product.price_from ? 'від ' : ''}${finalPrice} ₴`}
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
                                Виготовляється під замовлення
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
                                    {/* Custom Product Options Selector */}
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
                                            'Варіант тиснення', 'Варіант гравірування', 'Корінець']);
                                        return product.options
                                            .filter((opt: any) => !hardcodedNames.has(opt.name) && (opt.options?.length > 0 || opt.values?.length > 0))
                                            .map((opt: any) => {
                                                const items = opt.options || opt.values || [];
                                                return (
                                                    <div key={opt.name}>
                                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e2d7d' }}>
                                                            {opt.name}
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
                                                                return (
                                                                    <option key={idx} value={value}>
                                                                        {label}{price > 0 ? ` (+${price} ₴)` : ''}
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
                                                                        {label}{price > 0 ? ` (+${price} ₴)` : ''}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                    })()}

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
                                </>
                            )}
                        </div>

                        {/* Special CTA for photoprint, poster, and photomagnet products */}
                        {(product.slug?.includes('photoprint') || product.slug?.includes('polaroid') || product.slug?.includes('полароїд') || product.slug?.includes('поляроїд') || product.slug?.includes('poster') || product.slug?.includes('magnet')) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                                <Link
                                    href={getOrderUrl(product.slug, selectedOptions, product)}
                                    className="rounded-md hover:bg-[#1a2966]"
                                    style={{
                                        width: '100%',
                                        padding: '18px',
                                        backgroundColor: '#263a99',
                                        color: 'white',
                                        textDecoration: 'none',
                                        fontSize: '16px',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        transition: 'background-color 0.2s',
                                        display: 'block'
                                    }}
                                >
                                    Замовити →
                                </Link>
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
                                        <Link
                                            href={(() => {
                                                const slug = product.slug || resolvedParams.slug;
                                                const base = getConstructorUrl(slug);
                                                // Append selected options as English-key query params
                                                if (base.includes('/order/book') && Object.keys(customProductOptions).length > 0) {
                                                    const keyMap: Record<string, string> = {
                                                        'Розмір': 'size',
                                                        'Кількість сторінок': 'pages',
                                                        'Тип ламінації': 'lamination',
                                                        'Калька перед першою сторінкою': 'tracing',
                                                        'Тип обкладинки': 'cover',
                                                        'Корінець': 'spine',
                                                        'Оздоблення': 'decoration',
                                                        'Верстка тексту': 'text_layout',
                                                    };
                                                    const url = new URL(base, 'http://x');
                                                    Object.entries(customProductOptions).forEach(([key, val]) => {
                                                        if (val !== undefined && val !== '') {
                                                            url.searchParams.set(keyMap[key] || key, String(val));
                                                        }
                                                    });
                                                    return url.pathname + '?' + url.searchParams.toString();
                                                }
                                                return base;
                                            })()}
                                            style={{
                                                flex: 1,
                                                padding: '18px',
                                                backgroundColor: '#263a99',
                                                color: 'white',
                                                textDecoration: 'none',
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                transition: 'background-color 0.2s',
                                                opacity: 1,
                                                pointerEvents: 'auto',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            className="hover:bg-[#1a2966] rounded-md"
                                        >
                                            Відкрити редактор
                                        </Link>
                                        <Link
                                            href="/order"
                                            style={{
                                                flex: 1,
                                                padding: '18px',
                                                backgroundColor: 'white',
                                                color: '#263a99',
                                                textDecoration: 'none',
                                                border: '2px solid #263a99',
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                transition: 'background-color 0.2s'
                                            }}
                                            className="hover:bg-[#f0f3ff] rounded-md"
                                        >
                                            Оформити з дизайнером
                                        </Link>
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
                                        Замовити відразу
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
                                        Додати персоналізацію та замовити
                                    </button>
                                </div>

                                {showPersonalizationInput && (
                                    <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: "3px", backgroundColor: '#f8fafc' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#263A99' }}>Опишіть вашу персоналізацію:</label>
                                        <textarea
                                            value={personalizationNote}
                                            onChange={(e) => setPersonalizationNote(e.target.value)}
                                            placeholder="напр. Напис 'Keep Memories' на обкладинці..."
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
                                                    toast.error('Будь ласка, введіть опис персоналізації');
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
                                            Додати до замовлення
                                        </button>
                                    </div>
                                )}

                                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: 0 }}>
                                    Персоналізація — це індивідуальний надпис або оформлення на ваш вибір                                </p>
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
                                    Замовити відразу
                                </button>
                                {/* Show "Order with designer" button for products with options (TravelBook, magazines, etc.) */}
                                {(product.options && Array.isArray(product.options) && product.options.length > 0) && (
                                    <Link
                                        href="https://t.me/touchmemories"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            width: '100%',
                                            padding: '18px',
                                            backgroundColor: 'white',
                                            color: 'var(--primary)',
                                            textDecoration: 'none',
                                            border: '2px solid var(--primary)',
                                            borderRadius: "3px",
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            textAlign: 'center',
                                            transition: 'background-color 0.2s',
                                            display: 'block'
                                        }}
                                        className="hover:bg-blue-50"
                                    >
                                        Замовити з дизайнером
                                    </Link>
                                )}
                                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: 0 }}>
                                    {(product.options && Array.isArray(product.options) && product.options.length > 0)
                                        ? 'Потрібна допомога з оформленням? Зв\'яжіться з нашим дизайнером'
                                        : 'Швидке оформлення замовлення без зайвих кліків'
                                    }
                                </p>
                            </div>
                        )}

                        {/* Delivery Info */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: "3px", display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: "3px" }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                Швидка та безпечна доставка Новою Поштою
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: "3px" }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                Оплата при отриманні або онлайн (Apple Pay/Google Pay)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: "3px" }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                Термін виготовлення: {getProductionTime(product.categories?.slug || product.category_id)}
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
                            Докладний опис
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
                                Характеристики
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
                            Відгуки
                        </button>
                    </div>

                    <div>
                        {activeTab === 'description' && (
                            product.description ? (
                                <div style={{ maxWidth: '800px', lineHeight: 1.8, fontSize: '16px', color: '#475569' }} dangerouslySetInnerHTML={{ __html: product.description }} />
                            ) : (
                                <div className="text-slate-500 py-8">Детальний опис для цього товару ще не додано.</div>
                            )
                        )}

                        {activeTab === 'specs' && product.specs && product.specs.length > 0 && (
                            <table style={{ width: '100%', maxWidth: '700px', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {product.specs.map((spec: any, idx: number) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: '16px 0', color: '#64748b', width: '50%' }}>{spec.key}</td>
                                            <td style={{ padding: '16px 0', fontWeight: 600, color: '#263A99' }}>{spec.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'reviews' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ backgroundColor: '#f8f9fa', padding: '24px', borderRadius: "3px", border: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} fill="#fbbf24" color="#fbbf24" />)}
                                        </div>
                                        <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, marginBottom: '16px' }}>«Неймовірна якість! Перевершило всі мої очікування. Замовила на подарунок батькам, вони просто в захваті.»</p>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#263A99' }}>Клієнт Touch Memories</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <div style={{ paddingTop: '60px' }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 900, marginBottom: '40px', textAlign: 'center' }}>
                            Вам також може сподобатись
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }} className={styles.relatedGrid}>
                            {relatedProducts.map((p) => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </div>
                    </div>
                )}

            </main>

            <Footer categories={[]} />

        </div>
    );
}
