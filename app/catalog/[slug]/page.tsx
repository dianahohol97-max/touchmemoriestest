'use client';
import { useState, useEffect } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ProductCard } from '@/components/ui/ProductCard';
import { CheckCircle2, Star, Loader2, Image as ImageIcon, Play } from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import React from 'react';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = React.use(params);
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

    // Store selected options -> mapping from option Name to selected value index
    const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
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


                // Initialize default options (first available value for each option)
                const defaultOptions: Record<string, number> = {};
                if (data.options && Array.isArray(data.options)) {
                    data.options.forEach((opt: any) => {
                        if (opt.values && opt.values.length > 0) {
                            defaultOptions[opt.name] = 0; // index zero is default
                        }
                    });
                }
                setSelectedOptions(defaultOptions);

                // Fetch Related Products
                const { data: relatedData } = await supabase
                    .from('products')
                    .select('id, name, slug, price, price_from, short_description, images, is_popular, popular_order, created_at, category_id')
                    .eq('is_active', true)
                    .neq('id', data.id)
                    .limit(4);

                if (relatedData) setRelatedProducts(relatedData);
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

    // Calculate final price based on selected options
    let finalPrice = product.price;
    if (product.options && Array.isArray(product.options)) {
        product.options.forEach((opt: any) => {
            const selectedIdx = selectedOptions[opt.name];
            if (selectedIdx !== undefined && opt.values[selectedIdx]) {
                finalPrice += (opt.values[selectedIdx].priceModifier || 0);
            }
        });
    }

    const handleAddToCart = () => {
        const itemOptions: Record<string, string> = {};
        if (product.options && Array.isArray(product.options)) {
            product.options.forEach((opt: any) => {
                const idx = selectedOptions[opt.name];
                if (idx !== undefined && opt.values[idx]) {
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
            slug: product.slug
        });

        toast.success('Товар додано до кошика');
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
            <Navigation />

            <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                {/* Breadcrumbs */}
                <div style={{ fontSize: '14px', color: '#888', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                    <span style={{ color: '#1e293b', fontWeight: 600 }}>{product.name}</span>
                </div>

                {/* Two Column Layout */}
                <div className="product-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(300px, 450px)', gap: '60px', marginBottom: '80px' }}>

                    {/* Left Column: Images */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }} className="custom-scrollbar">
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
                                            borderRadius: '8px',
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
                                            borderRadius: '8px',
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
                        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, marginBottom: '16px', lineHeight: 1.2 }}>
                            {product.name}
                        </h1>
                        {product.short_description && (
                            <p style={{ fontSize: '16px', color: '#666', lineHeight: 1.6, marginBottom: '24px' }}>
                                {product.short_description}
                            </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)' }}>
                                {product.price_from ? 'від ' : ''}{finalPrice} ₴
                            </div>
                            {product.sale_price && (
                                <div style={{ fontSize: '20px', fontWeight: 600, color: '#94a3b8', textDecoration: 'line-through' }}>
                                    {product.sale_price} ₴
                                </div>
                            )}
                        </div>

                        {product.is_personalized && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 14px',
                                backgroundColor: '#fff7ed',
                                color: '#c2410c',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: 800,
                                marginBottom: '24px',
                                border: '1px solid #ffedd5'
                            }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f97316' }}></span>
                                Виготовляється під замовлення
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
                            {/* Dynamic Options */}
                            {product.options && Array.isArray(product.options) && product.options.map((opt: any, optIdx: number) => (
                                <div key={optIdx}>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                                        {opt.name}
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {opt.values.map((val: any, valIdx: number) => {
                                            const isSelected = selectedOptions[opt.name] === valIdx;
                                            return (
                                                <button
                                                    key={valIdx}
                                                    onClick={() => setSelectedOptions(prev => ({ ...prev, [opt.name]: valIdx }))}
                                                    style={{
                                                        padding: '10px 16px',
                                                        borderRadius: '8px',
                                                        border: isSelected ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                                                        background: isSelected ? '#f8fafc' : 'white',
                                                        color: isSelected ? 'var(--primary)' : '#475569',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        fontSize: '14px'
                                                    }}
                                                >
                                                    {val.name}
                                                    {val.priceModifier > 0 && <span style={{ opacity: 0.7, marginLeft: '4px', fontWeight: 500 }}>(+{val.priceModifier} ₴)</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1e293b' }}>Кількість</label>
                                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '12px', width: 'fit-content', backgroundColor: 'white' }}>
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        style={{ padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}
                                        className="hover:bg-slate-50 transition"
                                    >-</button>
                                    <span style={{ padding: '0 16px', fontWeight: 800, fontSize: '16px', minWidth: '40px', textAlign: 'center', color: '#1e293b' }}>{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        style={{ padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}
                                        className="hover:bg-slate-50 transition"
                                    >+</button>
                                </div>
                            </div>
                        </div>

                        {product.is_personalized ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                                    <div className="flex-responsive">
                                        <Link
                                            href="/constructor"
                                            style={{
                                                flex: 1,
                                                padding: '18px',
                                                backgroundColor: 'var(--primary)',
                                                color: 'white',
                                                textDecoration: 'none',
                                                borderRadius: '12px',
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                transition: 'background-color 0.2s'
                                            }}
                                            className="hover:bg-blue-700"
                                        >
                                            Створити у конструкторі
                                        </Link>
                                        <Link
                                            href="/kontakty"
                                            style={{
                                                flex: 1,
                                                padding: '18px',
                                                backgroundColor: 'white',
                                                color: 'var(--primary)',
                                                textDecoration: 'none',
                                                border: '2px solid var(--primary)',
                                                borderRadius: '12px',
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                transition: 'background-color 0.2s'
                                            }}
                                            className="hover:bg-blue-50"
                                        >
                                            Оформити з дизайнером
                                        </Link>
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
                                        Не знаєте як оформити? Наш дизайнер допоможе вам створити ідеальний продукт 💛
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                                <button
                                    onClick={handleAddToCart}
                                    style={{ width: '100%', padding: '18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.2s' }}
                                    className="hover:bg-blue-700"
                                >
                                    В кошик — {finalPrice * quantity} ₴
                                </button>
                                <button style={{ width: '100%', padding: '18px', backgroundColor: 'white', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.2s' }} className="hover:bg-slate-50">
                                    Замовити в 1 клік
                                </button>
                            </div>
                        )}

                        {/* Delivery Info */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '50%' }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                Швидка та безпечна доставка Новою Поштою
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '50%' }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                Оплата при отриманні або онлайн (Apple Pay/Google Pay)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                                <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '50%' }}>
                                    <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                Швидке виготовлення 3–5 робочих днів
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Area */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '60px', marginBottom: '80px' }}>
                    <div style={{ display: 'flex', gap: '40px', borderBottom: '1px solid #e2e8f0', marginBottom: '40px', overflowX: 'auto' }} className="custom-scrollbar">
                        <button
                            onClick={() => setActiveTab('description')}
                            style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'description' ? '3px solid var(--primary)' : '3px solid transparent',
                                paddingBottom: '16px',
                                fontSize: '18px',
                                fontWeight: activeTab === 'description' ? 800 : 500,
                                color: activeTab === 'description' ? '#1e293b' : '#64748b',
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
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === 'specs' ? '3px solid var(--primary)' : '3px solid transparent',
                                    paddingBottom: '16px',
                                    fontSize: '18px',
                                    fontWeight: activeTab === 'specs' ? 800 : 500,
                                    color: activeTab === 'specs' ? '#1e293b' : '#64748b',
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
                            style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'reviews' ? '3px solid var(--primary)' : '3px solid transparent',
                                paddingBottom: '16px',
                                fontSize: '18px',
                                fontWeight: activeTab === 'reviews' ? 800 : 500,
                                color: activeTab === 'reviews' ? '#1e293b' : '#64748b',
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
                                            <td style={{ padding: '16px 0', fontWeight: 600, color: '#1e293b' }}>{spec.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'reviews' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ backgroundColor: '#f8f9fa', padding: '24px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} fill="#fbbf24" color="#fbbf24" />)}
                                        </div>
                                        <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6, marginBottom: '16px' }}>«Неймовірна якість! Перевершило всі мої очікування. Замовила на подарунок батькам, вони просто в захваті.»</p>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>Клієнт Touch Memories</div>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }} className="related-grid">
                            {relatedProducts.map((p) => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </div>
                    </div>
                )}

            </main>

            <Footer categories={[]} />

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
            `}</style>
            <style jsx>{`
                @media (max-width: 900px) {
                    .product-layout {
                        grid-template-columns: 1fr !important;
                    }
                }
                @media (max-width: 1200px) {
                    .related-grid {
                        grid-template-columns: repeat(3, 1fr) !important;
                    }
                }
                @media (max-width: 800px) {
                    .related-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                @media (max-width: 500px) {
                    .related-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}
