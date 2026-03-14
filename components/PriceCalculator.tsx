'use client';
import { useState, useEffect, useMemo } from 'react';
import styles from './PriceCalculator.module.css';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, Plus, Minus, Wand2, Calendar, Sparkles } from 'lucide-react';
import { calculatePrice } from '@/lib/pricing';
import { useTheme } from '@/components/providers/ThemeProvider';

const FORMATS = ['15×15', '20×20', '21×29', '30×30'];
const COVERS = ['М\'яка', 'Тверда', 'Преміум'];

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

    const [product, setProduct] = useState<any>(null);
    const [format, setFormat] = useState('20×20');
    const [cover, setCover] = useState('Тверда');
    const [pages, setPages] = useState(24);
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        async function fetchPriceBase() {
            const { data } = await supabase
                .from('products')
                .select('price, price_per_page')
                .eq('slug', 'classic-photobook-20x20')
                .limit(1)
                .single();

            if (data) setProduct(data);
        }
        fetchPriceBase();
    }, []);

    const calcConfig = useMemo(() => {
        if (content['calculator_config']) {
            try {
                return JSON.parse(content['calculator_config']);
            } catch (e) {
                console.error('Failed to parse calculator config', e);
            }
        }
        return { products: [] };
    }, [content['calculator_config']]);

    const activeProducts = useMemo(() => {
        if (calcConfig.products && calcConfig.products.length > 0) {
            return calcConfig.products;
        }
        if (product) return [{ ...product, name: 'Класична фотокнига' }];
        return [{
            name: 'Класична фотокнига',
            price: 800,
            price_per_page: 25,
            base_price: 800,
            page_price: 25
        }];
    }, [calcConfig, product]);

    const [selectedProductIdx, setSelectedProductIdx] = useState(0);

    const pricing = useMemo(() => {
        const currentProd = activeProducts[selectedProductIdx];
        if (!currentProd) return null;

        return calculatePrice({
            basePrice: Number(currentProd.base_price || currentProd.price),
            pricePerPage: Number(currentProd.page_price || currentProd.price_per_page),
            pages,
            format,
            cover,
            quantity
        });
    }, [activeProducts, selectedProductIdx, pages, format, cover, quantity]);

    if (!pricing) return null;

    return (
        <section className={styles.calculatorSection}>
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
                    padding: style.card_padding || '32px',
                    boxShadow: style.card_shadow || '0 20px 50px rgba(0,0,0,0.05)',
                    border: '1px solid rgba(0,0,0,0.03)',
                    color: style.text_color || 'inherit'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Step 1: Product */}
                        {activeProducts.length > 1 && (
                            <div>
                                <label style={labelStyle}>1. Оберіть продукт</label>
                                <div style={selectWrapperStyle}>
                                    <select
                                        value={selectedProductIdx}
                                        onChange={(e) => setSelectedProductIdx(Number(e.target.value))}
                                        style={selectStyle}
                                    >
                                        {activeProducts.map((p: any, i: number) => (
                                            <option key={i} value={i}>{p.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={18} style={selectIconStyle} />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Format */}
                        <div>
                            <label style={labelStyle}>{activeProducts.length > 1 ? '2.' : '1.'} Формат</label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {FORMATS.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFormat(f)}
                                        style={{
                                            ...toggleButtonStyle,
                                            flex: 1,
                                            minWidth: '70px',
                                            backgroundColor: format === f ? 'var(--color-primary)' : 'white',
                                            color: format === f ? 'white' : 'inherit',
                                            borderColor: format === f ? 'var(--color-primary)' : '#eee',
                                        }}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step 3: Cover & Pages */}
                        <div className={styles.calcRow}>
                            <div>
                                <label style={labelStyle}>Обкладинка</label>
                                <div style={selectWrapperStyle}>
                                    <select
                                        value={cover}
                                        onChange={(e) => setCover(e.target.value)}
                                        style={selectStyle}
                                    >
                                        {COVERS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDown size={18} style={selectIconStyle} />
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Сторінок: {pages}</label>
                                <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    step="2"
                                    value={pages}
                                    onChange={(e) => setPages(Number(e.target.value))}
                                    style={sliderStyle}
                                    className={styles.slider}
                                />
                            </div>
                        </div>

                        {/* Result Block - Integrated */}
                        <div style={{
                            marginTop: '12px',
                            padding: '24px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '20px'
                        }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Підсумок</div>
                                <div style={{ fontSize: '32px', fontWeight: 900 }}>
                                    <AnimatedNumber value={pricing.total} /> ₴
                                </div>
                            </div>

                            <button
                                onClick={() => window.location.href = `/book-constructor?format=${format}&cover=${cover}&pages=${pages}`}
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
                                <Wand2 size={20} />
                                В конструктор
                            </button>
                        </div>

                        {content['calc_embed'] && (
                            <div
                                style={{ width: '100%', marginTop: '24px' }}
                                dangerouslySetInnerHTML={{ __html: content['calc_embed'] }}
                            />
                        )}

                    </div>
                </div>
            </div>

        </section>
    );
}

const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', opacity: 0.8 };
const selectWrapperStyle = { position: 'relative' as any };
const selectStyle = { width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #eee', appearance: 'none' as any, outline: 'none', fontSize: '15px', fontWeight: 600, cursor: 'pointer', backgroundColor: 'white' };
const selectIconStyle = { position: 'absolute' as any, right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' as any, opacity: 0.3 };
const toggleButtonStyle = { padding: '12px', borderRadius: '12px', border: '1px solid', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' };
const sliderStyle = { width: '100%', appearance: 'none' as any, height: '4px', background: '#eee', borderRadius: '2px', outline: 'none', cursor: 'pointer', marginTop: '12px' };
