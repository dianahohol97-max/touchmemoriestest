'use client';
import { useState, useEffect, useMemo } from 'react';
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
    const { content } = useTheme();
    const supabase = createClient();

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
        // Fallback to initial state if no config
        if (product) return [{ ...product, name: 'Класична фотокнига' }];

        // Hard fallback to prevent section from disappearing entirely
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

    if (activeProducts.length === 0 || !pricing) return null;

    return (
        <section className="calculator-section" style={{ padding: '40px 20px 80px', background: 'white' }}>
            <div style={containerStyle}>
                <div className="calculator-grid" style={gridStyle}>

                    {/* Controls */}
                    <div style={controlsCardStyle}>
                        <div style={{ marginBottom: '32px' }}>
                            <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {content['calc_title'] || 'Калькулятор'} <Sparkles size={24} color="var(--primary)" />
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '15px' }}>{content['calc_subtitle'] || 'Налаштуйте параметри та миттєво дізнайтесь ціну вашої майбутньої книги.'}</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                            {/* Product selection (only if more than 1) */}
                            {activeProducts.length > 1 && (
                                <div>
                                    <label style={labelStyle}>Оберіть продукт</label>
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

                            {/* Format Dropdown */}
                            <div>
                                <label style={labelStyle}>Формат книги</label>
                                <div style={selectWrapperStyle}>
                                    <select
                                        value={format}
                                        onChange={(e) => setFormat(e.target.value)}
                                        style={selectStyle}
                                    >
                                        {FORMATS.map(f => <option key={f} value={f}>{f} см</option>)}
                                    </select>
                                    <ChevronDown size={18} style={selectIconStyle} />
                                </div>
                            </div>

                            {/* Cover Toggles */}
                            <div>
                                <label style={labelStyle}>Обкладинка</label>
                                <div style={toggleGridStyle}>
                                    {COVERS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setCover(c)}
                                            style={{
                                                ...toggleButtonStyle,
                                                backgroundColor: cover === c ? '#1e293b' : 'white',
                                                color: cover === c ? 'white' : '#64748b',
                                                borderColor: cover === c ? '#1e293b' : '#e2e8f0',
                                            }}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Pages Slider */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label style={labelStyle}>Кількість сторінок</label>
                                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary)' }}>{pages}</span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    step="2"
                                    value={pages}
                                    onChange={(e) => setPages(Number(e.target.value))}
                                    style={sliderStyle}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
                                    <span>20 стор.</span>
                                    <span>100 стор.</span>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div>
                                <label style={labelStyle}>ПРИМІРНИКІВ</label>
                                <div style={qtyWrapperStyle}>
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={qtyBtnStyle}><Minus size={16} /></button>
                                    <span style={qtyValueStyle}>{quantity}</span>
                                    <button onClick={() => setQuantity(quantity + 1)} style={qtyBtnStyle}><Plus size={16} /></button>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Result Display */}
                    <div style={resultCardStyle}>
                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <div style={priceLabelStyle}>ВАРТІСТЬ ЗАМОВЛЕННЯ</div>
                            <div style={priceValueStyle}>
                                <AnimatedNumber value={pricing.total} /> <span style={{ fontSize: '32px' }}>₴</span>
                            </div>
                        </div>

                        <div style={breakdownListStyle}>
                            <div style={breakdownRowStyle}>
                                <span style={{ color: '#94a3b8' }}>Базова ціна</span>
                                <span style={{ fontWeight: 700 }}>{pricing.breakdown.base} ₴</span>
                            </div>
                            <div style={breakdownRowStyle}>
                                <span style={{ color: '#94a3b8' }}>Додаткові сторінки ({pricing.breakdown.pages})</span>
                                <span style={{ fontWeight: 700 }}>+ {pricing.breakdown.pagesTotal} ₴</span>
                            </div>
                            {pricing.breakdown.cover !== 0 && (
                                <div style={breakdownRowStyle}>
                                    <span style={{ color: '#94a3b8' }}>Обкладинка ({cover})</span>
                                    <span style={{ fontWeight: 700 }}>{pricing.breakdown.cover > 0 ? '+' : ''} {pricing.breakdown.cover} ₴</span>
                                </div>
                            )}
                            {quantity > 1 && (
                                <div style={breakdownRowStyle}>
                                    <span style={{ color: '#94a3b8' }}>Кількість</span>
                                    <span style={{ fontWeight: 700 }}>× {quantity}</span>
                                </div>
                            )}
                        </div>

                        <div style={deliveryNoteStyle}>
                            <Calendar size={16} />
                            Готово за 5-7 робочих днів
                        </div>

                        <button
                            onClick={() => window.location.href = `/constructor?format=${format}&cover=${cover}&pages=${pages}`}
                            style={ctaButtonStyle}
                        >
                            Створити таку книгу
                            <Wand2 size={20} />
                        </button>
                    </div>

                </div>
            </div>

            <style jsx>{`
                .calculator-section {
                    position: relative;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 24px;
                    width: 24px;
                    border-radius: 50%;
                    background: #1e293b;
                    cursor: pointer;
                    border: 4px solid white;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    margin-top: -10px;
                }
                 input[type=range]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 4px;
                    background: #f1f5f9;
                    border-radius: 2px;
                }
                @media (max-width: 900px) {
                    .calculator-grid {
                        grid-template-columns: 1fr !important;
                        gap: 30px !important;
                    }
                    .calculator-grid > div {
                        padding: 32px !important;
                    }
                }
            `}</style>
        </section>
    );
}

const containerStyle = { maxWidth: '1200px', margin: '0 auto' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 1fr', gap: '40px', alignItems: 'stretch' };
const controlsCardStyle = { backgroundColor: '#f8fafc', padding: '48px', borderRadius: '48px', border: '1px solid #f1f5f9' };
const resultCardStyle = { backgroundColor: '#1e293b', padding: '64px 48px', borderRadius: '48px', color: 'white', display: 'flex', flexDirection: 'column' as any, justifyContent: 'center', boxShadow: '0 32px 64px -16px rgba(30, 41, 59, 0.25)' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.1em', marginBottom: '12px' };
const selectWrapperStyle = { position: 'relative' as any };
const selectStyle = { width: '100%', padding: '16px 20px', borderRadius: '16px', border: '2px solid #e2e8f0', appearance: 'none' as any, outline: 'none', fontSize: '15px', fontWeight: 700, cursor: 'pointer', backgroundColor: 'white' };
const selectIconStyle = { position: 'absolute' as any, right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' as any, color: '#94a3b8' };
const toggleGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' };
const toggleButtonStyle = { padding: '14px', borderRadius: '16px', border: '2px solid', fontSize: '14px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' };
const sliderStyle = { width: '100%', appearance: 'none' as any, height: '4px', background: '#f1f5f9', borderRadius: '2px', outline: 'none', cursor: 'pointer' };
const qtyWrapperStyle = { display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: 'white', padding: '8px', borderRadius: '16px', width: 'fit-content', border: '2px solid #e2e8f0' };
const qtyBtnStyle = { width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: '#f8fafc', color: '#1e293b', cursor: 'pointer', transition: 'all 0.2s' };
const qtyValueStyle = { fontSize: '18px', fontWeight: 900, minWidth: '30px', textAlign: 'center' as any, color: '#1e293b' };
const priceLabelStyle = { fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' };
const priceValueStyle = { fontSize: '80px', fontWeight: 900, lineHeight: 1 };
const breakdownListStyle = { display: 'flex', flexDirection: 'column' as any, gap: '12px', marginBottom: '40px', padding: '32px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', backgroundColor: 'rgba(0,0,0,0.1)' };
const breakdownRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '14px' };
const deliveryNoteStyle = { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '32px' };
const ctaButtonStyle = { width: '100%', padding: '24px', borderRadius: '20px', backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 900, fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: 'all 0.3s', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.3)' };
