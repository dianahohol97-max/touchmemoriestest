'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from './PriceCalculator.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Image from 'next/image';
import { Product, CustomAttribute } from '@/lib/types/product';
import { useT } from '@/lib/i18n/context';

function AnimatedNumber({ value }: { value: number }) {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDisplayValue(value);
        }, 50);
        return () => clearTimeout(timeout);
    }, [value]);

    return (
        <span>{Math.round(displayValue).toLocaleString('uk-UA')}</span>
    );
}

export default function PriceCalculator() {
    const t = useT();
    const supabase = createClient();
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1); // 1: Select, 2: Configure
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selections, setSelections] = useState<Record<string, any>>({});

    useEffect(() => {
        async function fetchProducts() {
            setLoading(true);
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (data) {
                // Filter products that are configurable
                const configurable = data.filter((p: Product) => {
                    const hasVariants = p.variants && p.variants.length > 0;
                    const hasOptions = p.options && Array.isArray(p.options) && p.options.length > 0;
                    const hasCustomAttributes = p.custom_attributes && Array.isArray(p.custom_attributes) && p.custom_attributes.length > 0;
                    const hasCharacteristics = p.characteristics && Array.isArray(p.characteristics) && p.characteristics.length > 0;

                    return p.is_personalized || hasVariants || hasOptions || hasCustomAttributes || hasCharacteristics;
                });
                setAllProducts(configurable);
            }
            setLoading(false);
        }
        fetchProducts();
    }, [supabase]);

    const handleProductSelect = (product: Product) => {
        setSelectedProduct(product);
        setSelections({});
        setStep(2);

        // Auto-select first options if available
        const initialSelections: Record<string, any> = {};
        const attributes = [
            ...(Array.isArray(product.custom_attributes) ? product.custom_attributes : []),
            ...(Array.isArray(product.characteristics) ? product.characteristics : [])
        ];

        attributes.forEach((attr: any) => {
            if (attr.type === 'select' && attr.options && attr.options.length > 0) {
                initialSelections[attr.key] = attr.options[0];
            } else if (attr.type === 'boolean') {
                initialSelections[attr.key] = false;
            }
        });

        setSelections(initialSelections);
    };

    const finalPrice = useMemo(() => {
        if (!selectedProduct) return 0;
        let price = selectedProduct.price || 0;

        // Apply attribute modifiers
        const modifiers = selectedProduct.attribute_price_modifiers || {};
        Object.entries(selections).forEach(([key, value]) => {
            if (typeof value === 'boolean') {
                if (value && modifiers[key]) {
                    price += modifiers[key];
                }
            } else if (typeof value === 'string') {
                const modifierKey = `${key}_${value}`;
                if (modifiers[modifierKey]) {
                    price += modifiers[modifierKey];
                }
            }
        });

        return price;
    }, [selectedProduct, selections]);

    const isStep2Complete = useMemo(() => {
        if (!selectedProduct) return false;
        const requiredAttributes = [
            ...(Array.isArray(selectedProduct.custom_attributes) ? selectedProduct.custom_attributes : []),
            ...(Array.isArray(selectedProduct.characteristics) ? selectedProduct.characteristics : [])
        ].filter(a => a.required);

        return requiredAttributes.every(attr => selections[attr.key] !== undefined && selections[attr.key] !== '');
    }, [selectedProduct, selections]);

    if (loading) return (
        <section className={styles.calculatorSection} style={{ padding: '80px 0' }}>
            <div style={{ textAlign: 'center' }}>{t('price_calc.loading')}</div>
        </section>
    );

    return (
        <section className={`${styles.calculatorSection} section-padding`}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h2 className="section-title">{t('price_calc.title')}</h2>
                </div>

                <div className={styles.configCard}>
                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className={styles.stepHeader}>
                                    <div className={styles.stepNumber}>1</div>
                                    <h3 className={styles.stepTitle}>{t('price_calc.choose_product')}</h3>
                                </div>

                                <div className={styles.productGrid}>
                                    {allProducts.map((p) => (
                                        <div
                                            key={p.id}
                                            className={styles.productCard}
                                            onClick={() => handleProductSelect(p)}
                                        >
                                            <div className={styles.productImageWrapper}>
                                                {p.images && p.images[0] && (
                                                    <Image
                                                        src={p.images[0]}
                                                        alt={p.name}
                                                        fill
                                                        style={{ objectFit: 'cover' }}
                                                        sizes="(max-width: 768px) 100vw, 33vw"
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <div className={styles.productName}>{p.name}</div>
                                                <div style={{ fontSize: '14px', opacity: 0.6, marginTop: '4px' }}>
                                                    {p.price > 0 ? `${t('price_calc.from_price')} ${p.price} ₴` : t('price_calc.price_on_request')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {allProducts.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                                        {t('price_calc.no_products')}
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <button className={styles.backButton} onClick={() => setStep(1)}>
                                    <ArrowLeft size={16} /> {t('price_calc.back')}
                                </button>

                                <div className={styles.stepHeader}>
                                    <div className={styles.stepNumber}>2</div>
                                    <h3 className={styles.stepTitle}>{t('price_calc.customize')}</h3>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', paddingBottom: '32px', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                                            <Image src={selectedProduct?.images?.[0] || ''} alt="" fill style={{ objectFit: 'cover' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--primary)' }}>{selectedProduct?.name}</div>
                                            <div style={{ opacity: 0.6, fontSize: '14px' }}>{t('price_calc.personalization')}</div>
                                        </div>
                                    </div>

                                    <div>
                                        {[
                                            ...(Array.isArray(selectedProduct?.custom_attributes) ? selectedProduct!.custom_attributes! : []),
                                            ...(Array.isArray(selectedProduct?.characteristics) ? selectedProduct!.characteristics! : [])
                                        ].map((attr, idx) => (
                                            <div key={idx} className={styles.attributeGroup}>
                                                <label className={styles.attributeLabel}>{attr.label}</label>

                                                {attr.type === 'select' && (
                                                    <div className={styles.optionGrid}>
                                                        {attr.options?.map((opt: string) => (
                                                            <button
                                                                key={opt}
                                                                className={`${styles.optionButton} ${selections[attr.key] === opt ? styles.optionButtonActive : ''}`}
                                                                onClick={() => setSelections(prev => ({ ...prev, [attr.key]: opt }))}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {attr.type === 'boolean' && (
                                                    <div className={styles.optionGrid}>
                                                        <button
                                                            className={`${styles.optionButton} ${selections[attr.key] === true ? styles.optionButtonActive : ''}`}
                                                            onClick={() => setSelections(prev => ({ ...prev, [attr.key]: true }))}
                                                        >
                                                            {t('price_calc.yes')}
                                                        </button>
                                                        <button
                                                            className={`${styles.optionButton} ${selections[attr.key] === false ? styles.optionButtonActive : ''}`}
                                                            onClick={() => setSelections(prev => ({ ...prev, [attr.key]: false }))}
                                                        >
                                                            {t('price_calc.no')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Fallback if no attributes but is_personalized */}
                                        {selectedProduct?.is_personalized &&
                                            !(selectedProduct.custom_attributes?.length || selectedProduct.characteristics?.length) && (
                                                <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '3px', marginBottom: '32px' }}>
                                                    {t('price_calc.custom_note')}
                                                </div>
                                            )}
                                    </div>

                                    <div className={styles.summaryBlock}>
                                        <div className={styles.priceDisplay}>
                                            <span className={styles.priceLabel}>{t('price_calc.estimated_price')}</span>
                                            <div className={styles.priceValue}>
                                                <AnimatedNumber value={finalPrice} /> ₴
                                            </div>
                                        </div>

                                        <button
                                            className={styles.orderButton}
                                            disabled={!isStep2Complete}
                                            onClick={() => window.location.href = `/catalog/${selectedProduct?.slug}`}
                                        >
                                            {t('price_calc.order_btn')} <ArrowRight size={20} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
}
