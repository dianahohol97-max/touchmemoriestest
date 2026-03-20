'use client';
import { useState, useMemo } from 'react';
import { Check } from 'lucide-react';

interface PhotobookOptionsProps {
    product: {
        id: string;
        name: string;
        slug: string;
        price: number;
        variants?: Array<{ name: string; price: number }>;
    };
    onPriceChange?: (price: number) => void;
    onOptionsChange?: (options: {
        size: string;
        pages: number;
        calca: boolean;
        sizePrice: number;
        pagesPrice: number;
        calcaPrice: number;
    }) => void;
}

const PAGE_OPTIONS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50];
const CALCA_PRICE = 280;

// Pricing per page based on cover type
const PAGE_PRICING: Record<string, number> = {
    'photobook-velour': 50,      // Velour cover
    'photobook-printed': 25,     // Printed cover
    'photobook-leatherette': 50, // Leatherette cover
    'photobook-fabric': 50       // Fabric cover
};

export function PhotobookOptions({ product, onPriceChange, onOptionsChange }: PhotobookOptionsProps) {
    const variants = product.variants || [];

    // State
    const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
    const [selectedPages, setSelectedPages] = useState(6);
    const [calcaChecked, setCalcaChecked] = useState(false);

    // Get price per page for this product
    const pricePerPage = PAGE_PRICING[product.slug] || 25;

    // Calculate prices
    const sizePrice = variants[selectedSizeIndex]?.price || product.price;
    const pagesPrice = selectedPages > 6 ? (selectedPages - 6) * pricePerPage : 0;
    const calcaPrice = calcaChecked ? CALCA_PRICE : 0;

    const totalPrice = useMemo(() => {
        const total = sizePrice + pagesPrice + calcaPrice;

        // Notify parent component
        if (onPriceChange) {
            onPriceChange(total);
        }
        if (onOptionsChange) {
            onOptionsChange({
                size: variants[selectedSizeIndex]?.name || '',
                pages: selectedPages,
                calca: calcaChecked,
                sizePrice,
                pagesPrice,
                calcaPrice
            });
        }

        return total;
    }, [sizePrice, pagesPrice, calcaPrice, selectedSizeIndex, selectedPages, calcaChecked, onPriceChange, onOptionsChange, variants]);

    const handleSizeChange = (index: number) => {
        setSelectedSizeIndex(index);
    };

    const handlePagesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedPages(parseInt(e.target.value));
    };

    const handleCalcaToggle = () => {
        setCalcaChecked(!calcaChecked);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* SIZE SELECTION */}
            {variants.length > 0 && (
                <div>
                    <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 700,
                        marginBottom: '12px',
                        color: '#263A99',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Розмір
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {variants.map((variant, index) => {
                            const isSelected = selectedSizeIndex === index;
                            return (
                                <button
                                    key={index}
                                    onClick={() => handleSizeChange(index)}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '3px',
                                        border: isSelected ? '2px solid #263A99' : '1px solid #e2e8f0',
                                        background: isSelected ? '#f8fafc' : 'white',
                                        color: isSelected ? '#263A99' : '#475569',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                    className="hover:border-primary/50"
                                >
                                    {variant.name}
                                    {variant.price !== product.price && (
                                        <span style={{ opacity: 0.7, fontSize: '13px', fontWeight: 500 }}>
                                            {variant.price} ₴
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* PAGES SELECTION */}
            <div>
                <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 700,
                    marginBottom: '12px',
                    color: '#263A99',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    Кількість сторінок
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <select
                        value={selectedPages}
                        onChange={handlePagesChange}
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            borderRadius: '3px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white',
                            color: '#263A99',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                        className="focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                        {PAGE_OPTIONS.map(pages => (
                            <option key={pages} value={pages}>
                                {pages} сторінок
                                {pages > 6 ? ` (+${(pages - 6) * pricePerPage} ₴)` : ''}
                            </option>
                        ))}
                    </select>
                    <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '3px',
                        fontSize: '13px',
                        color: '#64748b',
                        fontWeight: 500,
                        whiteSpace: 'nowrap'
                    }}>
                        {pricePerPage} ₴ / стор
                    </div>
                </div>
                {selectedPages > 6 && (
                    <div style={{
                        marginTop: '8px',
                        fontSize: '13px',
                        color: '#64748b',
                        padding: '8px 12px',
                        backgroundColor: '#f0f9ff',
                        borderRadius: '3px'
                    }}>
                        Додаткові сторінки: {selectedPages - 6} × {pricePerPage} ₴ = <strong style={{ color: '#263A99' }}>{pagesPrice} ₴</strong>
                    </div>
                )}
            </div>

            {/* CALCA OPTION */}
            <div>
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '3px',
                        border: calcaChecked ? '2px solid #263A99' : '1px solid #e2e8f0',
                        backgroundColor: calcaChecked ? '#f8fafc' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    className="hover:border-primary/50"
                >
                    <input
                        type="checkbox"
                        checked={calcaChecked}
                        onChange={handleCalcaToggle}
                        style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            accentColor: '#263A99'
                        }}
                    />
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#263A99',
                            marginBottom: '4px'
                        }}>
                            Додати кальку (+{CALCA_PRICE} ₴)
                        </div>
                        <div style={{
                            fontSize: '13px',
                            color: '#64748b',
                            lineHeight: 1.4
                        }}>
                            Напівпрозора перша сторінка з надписом або фото
                        </div>
                    </div>
                    {calcaChecked && (
                        <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#263A99',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <Check size={14} strokeWidth={3} />
                        </div>
                    )}
                </label>
            </div>

            {/* PRICE BREAKDOWN */}
            <div style={{
                padding: '20px',
                backgroundColor: '#fafaf9',
                borderRadius: '3px',
                border: '1px solid #e7e5e4'
            }}>
                <div style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#78716c',
                    marginBottom: '12px'
                }}>
                    Розрахунок вартості
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#57534e' }}>
                        <span>Базова ціна ({variants[selectedSizeIndex]?.name || 'стандарт'})</span>
                        <span style={{ fontWeight: 600 }}>{sizePrice} ₴</span>
                    </div>
                    {pagesPrice > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#57534e' }}>
                            <span>Додаткові сторінки ({selectedPages - 6} × {pricePerPage} ₴)</span>
                            <span style={{ fontWeight: 600 }}>+{pagesPrice} ₴</span>
                        </div>
                    )}
                    {calcaPrice > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#57534e' }}>
                            <span>Калька</span>
                            <span style={{ fontWeight: 600 }}>+{calcaPrice} ₴</span>
                        </div>
                    )}
                </div>
                <div style={{
                    paddingTop: '12px',
                    borderTop: '2px solid #d6d3d1',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#44403c' }}>
                        Загальна вартість
                    </span>
                    <span style={{ fontSize: '28px', fontWeight: 900, color: '#263A99' }}>
                        {totalPrice} ₴
                    </span>
                </div>
            </div>
        </div>
    );
}
