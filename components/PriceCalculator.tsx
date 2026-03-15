'use client';
import { useState, useEffect, useMemo } from 'react';
import styles from './PriceCalculator.module.css';
import { motion, useSpring, useTransform } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import Image from 'next/image';

function AnimatedNumber({ value }: { value: number }) {
    const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
    const display = useTransform(spring, (current) =>
        Math.round(current).toLocaleString('uk-UA')
    );

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    return <motion.span>{display}</motion.span>;
}

export default function PriceCalculator() {
    const { content, blocks } = useTheme();
    const supabase = createClient();
    const block = blocks.find(b => b.block_name === 'price_calculator');
    const style = block?.style_metadata || {};

    const [allProducts, setAllProducts] = useState<any[]>([]);

    useEffect(() => {
        async function fetchProducts() {
            const { data } = await supabase
                .from('products')
                .select('id, name, slug, price, price_from, options, images')
                .eq('is_personalized', true)
                .eq('is_active', true)
                .order('name');

            if (data) setAllProducts(data);
        }
        fetchProducts();
    }, [supabase]);

    const calcConfig = useMemo(() => {
        if (content['calculator_config']) {
            try {
                return JSON.parse(content['calculator_config']);
            } catch (e) {
                console.error('Failed to parse calculator config', e);
            }
        }
        return { products: [] };
    }, [content]);

    const activeProducts = useMemo(() => {
        const configProducts = Array.isArray(calcConfig?.products) ? calcConfig.products : [];
        const enabledConfigs = configProducts.filter((p: any) => p.isActive);

        if (enabledConfigs.length > 0) {
            // map and preserve config data
            return enabledConfigs.map((cp: any) => {
                const prod = allProducts.find(p => p.id === cp.id);
                if (prod) return { ...prod, productionTime: cp.productionTime };
                return null;
            }).filter(Boolean);
        }
        return allProducts;
    }, [calcConfig, allProducts]);

    const [selectedProductIdx, setSelectedProductIdx] = useState(0);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});

    // Ensure valid index if activeProducts shrinks
    const currentIdx = selectedProductIdx >= activeProducts.length ? 0 : selectedProductIdx;
    const currentProd = activeProducts[currentIdx];

    // Reset selected options when product changes
    useEffect(() => {
        if (currentProd?.options && Array.isArray(currentProd.options)) {
            const defaultOptions: Record<string, number> = {};
            currentProd.options.forEach((opt: any) => {
                if (opt.values && opt.values.length > 0) {
                    defaultOptions[opt.name] = 0;
                }
            });
            setSelectedOptions(defaultOptions);
        } else {
            setSelectedOptions({});
        }
    }, [currentProd]);

    const finalPrice = useMemo(() => {
        if (!currentProd) return 0;
        let p = currentProd.price || 0;
        if (currentProd.options && Array.isArray(currentProd.options)) {
            currentProd.options.forEach((opt: any) => {
                const selectedIdx = selectedOptions[opt.name];
                if (selectedIdx !== undefined && opt.values[selectedIdx]) {
                    p += (opt.values[selectedIdx].priceModifier || 0);
                }
            });
        }
        return p;
    }, [currentProd, selectedOptions]);

    if (activeProducts.length === 0) return null;

    return (
        <section className={styles.calculatorSection} style={{ backgroundColor: style.bg_color || 'transparent', paddingTop: style.padding_top || '80px', paddingBottom: style.padding_bottom || '80px' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'clamp(28px, 5vw, 40px)',
                        fontWeight: 900,
                        marginBottom: '16px',
                        color: 'var(--section-heading-color)'
                    }}>
                        {content['calc_title'] || 'Розрахуйте вартість'}
                    </h2>
                    <p style={{ opacity: 0.7, maxWidth: '500px', margin: '0 auto' }}>
                        {content['calc_subtitle'] || 'Оберіть параметри вашої ідеальної фотокниги'}
                    </p>
                </div>

                <div style={{
                    backgroundColor: style.card_bg || 'white',
                    borderRadius: style.card_radius || '32px',
                    padding: '32px',
                    boxShadow: style.card_shadow || '0 20px 50px rgba(0,0,0,0.05)',
                    border: '1px solid rgba(0,0,0,0.03)',
                    color: style.text_color || 'inherit'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                        {/* Step 1: Product Selector */}
                        <div>
                            <div style={stepHeaderStyle}>
                                <div style={stepCircleStyle}>1</div>
                                <h3 style={stepTitleStyle}>Оберіть продукт</h3>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                {activeProducts.map((p: any, i: number) => {
                                    const isSelected = i === currentIdx;
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => setSelectedProductIdx(i)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '12px',
                                                borderRadius: '16px',
                                                border: isSelected ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                                                backgroundColor: isSelected ? '#f8fafc' : 'white',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, position: 'relative', backgroundColor: '#f1f5f9' }}>
                                                {p.images && p.images.length > 0 && (
                                                    <Image src={p.images[0]} alt={p.name} fill style={{ objectFit: 'cover' }} />
                                                )}
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? 'var(--primary)' : '#1e293b', lineHeight: 1.2 }}>
                                                {p.name}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <hr style={{ borderColor: '#f1f5f9', margin: '0' }} />

                        {/* Step 2: Characteristics */}
                        {currentProd?.options && currentProd.options.length > 0 && (
                            <div>
                                <div style={stepHeaderStyle}>
                                    <div style={stepCircleStyle}>2</div>
                                    <h3 style={stepTitleStyle}>Характеристики</h3>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {currentProd.options.map((opt: any, optIdx: number) => (
                                        <div key={optIdx}>
                                            <label style={labelStyle}>{opt.name}</label>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {opt.values.map((val: any, valIdx: number) => {
                                                    const isSelected = selectedOptions[opt.name] === valIdx;
                                                    return (
                                                        <button
                                                            key={valIdx}
                                                            onClick={() => setSelectedOptions(prev => ({ ...prev, [opt.name]: valIdx }))}
                                                            style={{
                                                                padding: '10px 16px',
                                                                borderRadius: '12px',
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
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <hr style={{ borderColor: '#f1f5f9', margin: '0' }} />

                        {/* Step 3: Result */}
                        <div>
                            <div style={stepHeaderStyle}>
                                <div style={stepCircleStyle}>3</div>
                                <h3 style={stepTitleStyle}>Підсумок</h3>
                            </div>

                            <div style={{
                                padding: '24px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '20px',
                                border: '1px solid #f1f5f9'
                            }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                                        Вартість:
                                    </div>
                                    <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary)' }}>
                                        {currentProd?.price_from ? 'від ' : ''}<AnimatedNumber value={finalPrice} /> ₴
                                    </div>
                                    {currentProd?.productionTime && (
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#16a34a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></div>
                                            Виготовлення: {currentProd.productionTime}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => window.location.href = `/catalog/${currentProd?.slug}`}
                                    style={{
                                        height: '56px',
                                        padding: '0 32px',
                                        backgroundColor: 'var(--section-button-bg)',
                                        color: 'var(--section-button-text)',
                                        borderRadius: 'var(--button-radius)',
                                        boxShadow: 'var(--button-shadow)',
                                        border: 'none',
                                        fontWeight: 700,
                                        fontSize: '16px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'transform 0.2s'
                                    }}
                                    className={styles.hoverLift}
                                >
                                    Замовити
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </section>
    );
}

const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1e293b' };
const stepHeaderStyle = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' };
const stepCircleStyle = { width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' };
const stepTitleStyle = { fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' };
