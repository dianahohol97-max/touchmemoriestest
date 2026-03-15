'use client';
import { useState, useEffect } from 'react';
import { CustomAttribute, AttributePriceModifiers, SelectedAttributes } from '@/lib/types/product';

interface ProductAttributeSelectorProps {
    attributes: CustomAttribute[];
    priceModifiers: AttributePriceModifiers;
    onSelectionChange: (selected: SelectedAttributes, totalModifier: number) => void;
}

export default function ProductAttributeSelector({
    attributes,
    priceModifiers,
    onSelectionChange
}: ProductAttributeSelectorProps) {
    const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttributes>({});

    useEffect(() => {
        // Initialize default values
        const defaults: SelectedAttributes = {};
        attributes.forEach(attr => {
            if (attr.type === 'boolean') {
                defaults[attr.key] = false;
            } else if (attr.type === 'select' && attr.options && attr.options.length > 0) {
                defaults[attr.key] = attr.options[0];
            } else if (attr.type === 'number') {
                defaults[attr.key] = attr.min || 0;
            } else if (attr.type === 'text') {
                defaults[attr.key] = '';
            }
        });
        setSelectedAttributes(defaults);
    }, [attributes]);

    useEffect(() => {
        // Calculate total price modifier
        let totalModifier = 0;

        Object.entries(selectedAttributes).forEach(([key, value]) => {
            const attr = attributes.find(a => a.key === key);
            if (!attr) return;

            if (attr.type === 'boolean' && value === true) {
                // Boolean: add price if true
                totalModifier += priceModifiers[key] || 0;
            } else if (attr.type === 'select' && typeof value === 'string') {
                // Select: add price for specific option
                const modifierKey = `${key}_${value}`;
                totalModifier += priceModifiers[modifierKey] || 0;
            }
        });

        onSelectionChange(selectedAttributes, totalModifier);
    }, [selectedAttributes, attributes, priceModifiers, onSelectionChange]);

    const handleChange = (key: string, value: boolean | string | number) => {
        setSelectedAttributes(prev => ({ ...prev, [key]: value }));
    };

    const getPriceLabel = (attr: CustomAttribute, value?: string) => {
        if (attr.type === 'boolean') {
            const price = priceModifiers[attr.key];
            return price ? `+${price} ₴` : '';
        } else if (attr.type === 'select' && value) {
            const modifierKey = `${attr.key}_${value}`;
            const price = priceModifiers[modifierKey];
            return price ? `+${price} ₴` : '';
        }
        return '';
    };

    if (attributes.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {attributes.map((attr) => (
                <div key={attr.key}>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/30 mb-5 flex items-center gap-2">
                        {attr.label}
                        {attr.required && <span className="text-red-500">*</span>}
                        <div className="h-[1px] flex-1 bg-primary/5" />
                    </h4>

                    {attr.type === 'boolean' && (
                        <label className="flex items-center justify-between p-6 bg-white rounded-brand border border-primary/10 shadow-[var(--shadow-premium)] cursor-pointer transition-all hover:border-primary/30 group">
                            <div className="flex items-center gap-5 flex-1">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedAttributes[attr.key] ? 'bg-primary border-primary' : 'bg-transparent border-primary/20'}`}>
                                    {selectedAttributes[attr.key] && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={selectedAttributes[attr.key] as boolean || false}
                                    onChange={(e) => handleChange(attr.key, e.target.checked)}
                                />
                                <span className="text-[15px] font-bold text-primary tracking-tight">
                                    {attr.label}
                                </span>
                            </div>
                            {getPriceLabel(attr) && (
                                <span className="bg-primary/5 text-primary text-[12px] font-black px-4 py-2 rounded-full border border-primary/10">
                                    {getPriceLabel(attr)}
                                </span>
                            )}
                        </label>
                    )}

                    {attr.type === 'select' && attr.options && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {attr.options.map((option) => {
                                const isSelected = selectedAttributes[attr.key] === option;
                                const priceLabel = getPriceLabel(attr, option);

                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => handleChange(attr.key, option)}
                                        className={`flex flex-col items-start p-5 rounded-brand border-2 transition-all text-left group ${isSelected
                                                ? 'border-primary bg-primary/[0.02] shadow-[var(--shadow-hover)] translate-y-[-2px]'
                                                : 'border-primary/5 bg-white shadow-[var(--shadow-premium)] hover:border-primary/20'
                                            }`}
                                    >
                                        <span className={`text-[14px] font-black tracking-tight ${isSelected ? 'text-primary' : 'text-primary/60'}`}>
                                            {option}
                                        </span>
                                        {priceLabel && (
                                            <span className={`text-[11px] font-black mt-2 px-2 py-1 rounded-sm ${isSelected ? 'bg-primary text-white' : 'bg-primary/5 text-primary/40'}`}>
                                                {priceLabel}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {attr.type === 'number' && (
                        <input
                            type="number"
                            value={selectedAttributes[attr.key] as number || attr.min || 0}
                            onChange={(e) => handleChange(attr.key, Number(e.target.value))}
                            min={attr.min}
                            max={attr.max}
                            placeholder={attr.placeholder}
                            style={inputStyle}
                            required={attr.required}
                        />
                    )}

                    {attr.type === 'text' && (
                        <input
                            type="text"
                            value={selectedAttributes[attr.key] as string || ''}
                            onChange={(e) => handleChange(attr.key, e.target.value)}
                            placeholder={attr.placeholder}
                            style={inputStyle}
                            required={attr.required}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#888',
    marginBottom: '16px'
};

const toggleContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    backgroundColor: '#f8fafc',
    borderRadius: "3px",
    border: '2px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const checkboxStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    accentColor: 'var(--primary)',
    cursor: 'pointer'
};

const priceTagStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: '#10b981',
    backgroundColor: '#d1fae5',
    padding: '6px 12px',
    borderRadius: "3px"
};

const optionBtnStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: "3px",
    border: '2px solid',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: "3px",
    border: '2px solid #e2e8f0',
    fontSize: '15px',
    fontWeight: 500,
    outline: 'none',
    transition: 'all 0.2s'
};
