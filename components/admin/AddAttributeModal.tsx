'use client';
import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CustomAttribute, AttributeType } from '@/lib/types/product';

interface AddAttributeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (attribute: CustomAttribute, priceModifier?: number | Record<string, number>) => void;
    editingAttribute?: CustomAttribute;
    existingPriceModifier?: number | Record<string, number>;
}

export default function AddAttributeModal({
    isOpen,
    onClose,
    onSave,
    editingAttribute,
    existingPriceModifier
}: AddAttributeModalProps) {
    const [label, setLabel] = useState('');
    const [key, setKey] = useState('');
    const [type, setType] = useState<AttributeType>('boolean');
    const [options, setOptions] = useState<string[]>([]);
    const [optionInput, setOptionInput] = useState('');
    const [required, setRequired] = useState(false);
    const [priceModifier, setPriceModifier] = useState<number>(0);
    const [optionPrices, setOptionPrices] = useState<Record<string, number>>({});
    const [min, setMin] = useState<number | undefined>();
    const [max, setMax] = useState<number | undefined>();
    const [placeholder, setPlaceholder] = useState('');

    useEffect(() => {
        if (editingAttribute) {
            setLabel(editingAttribute.label);
            setKey(editingAttribute.key);
            setType(editingAttribute.type);
            setOptions(editingAttribute.options || []);
            setRequired(editingAttribute.required || false);
            setMin(editingAttribute.min);
            setMax(editingAttribute.max);
            setPlaceholder(editingAttribute.placeholder || '');

            if (editingAttribute.type === 'select' && existingPriceModifier && typeof existingPriceModifier === 'object') {
                setOptionPrices(existingPriceModifier);
            } else if (typeof existingPriceModifier === 'number') {
                setPriceModifier(existingPriceModifier);
            }
        }
    }, [editingAttribute, existingPriceModifier]);

    const generateKey = (text: string) => {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .replace(/-+/g, '_')
            .replace(/^_+|_+$/g, '');
    };

    const handleLabelChange = (value: string) => {
        setLabel(value);
        if (!editingAttribute) {
            setKey(generateKey(value));
        }
    };

    const handleAddOption = () => {
        if (optionInput.trim() && !options.includes(optionInput.trim())) {
            setOptions([...options, optionInput.trim()]);
            setOptionInput('');
        }
    };

    const handleRemoveOption = (index: number) => {
        const newOptions = options.filter((_, i) => i !== index);
        setOptions(newOptions);

        // Remove price for this option if exists
        const removedOption = options[index];
        const newPrices = { ...optionPrices };
        delete newPrices[removedOption];
        setOptionPrices(newPrices);
    };

    const handleOptionPriceChange = (option: string, price: number) => {
        setOptionPrices({ ...optionPrices, [option]: price });
    };

    const handleSave = () => {
        if (!label.trim() || !key.trim()) return;
        if (type === 'select' && options.length === 0) return;

        const attribute: CustomAttribute = {
            key,
            label,
            type,
            required,
            ...(type === 'select' && { options }),
            ...(type === 'number' && { min, max }),
            ...(placeholder && { placeholder })
        };

        let priceData: number | Record<string, number> | undefined;
        if (type === 'select') {
            priceData = Object.keys(optionPrices).length > 0 ? optionPrices : undefined;
        } else if (type === 'boolean') {
            priceData = priceModifier > 0 ? priceModifier : undefined;
        }

        onSave(attribute, priceData);
        handleClose();
    };

    const handleClose = () => {
        setLabel('');
        setKey('');
        setType('boolean');
        setOptions([]);
        setOptionInput('');
        setRequired(false);
        setPriceModifier(0);
        setOptionPrices({});
        setMin(undefined);
        setMax(undefined);
        setPlaceholder('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={handleClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h3 style={titleStyle}>
                        {editingAttribute ? 'Редагувати характеристику' : 'Додати характеристику'}
                    </h3>
                    <button onClick={handleClose} style={closeBtnStyle}>
                        <X size={20} />
                    </button>
                </div>

                <div style={contentStyle}>
                    {/* Label */}
                    <div>
                        <label style={labelStyle}>Назва характеристики</label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => handleLabelChange(e.target.value)}
                            placeholder="Гравіювання, Тип паперу..."
                            style={inputStyle}
                        />
                    </div>

                    {/* Key (auto-generated) */}
                    <div>
                        <label style={labelStyle}>Ключ (для системи)</label>
                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="engraving, paper_type..."
                            style={{ ...inputStyle, backgroundColor: '#f8fafc' }}
                            disabled={!!editingAttribute}
                        />
                        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                            Автоматично згенерований ключ
                        </p>
                    </div>

                    {/* Type */}
                    <div>
                        <label style={labelStyle}>Тип поля</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as AttributeType)}
                            style={selectStyle}
                        >
                            <option value="boolean">Так/Ні (checkbox)</option>
                            <option value="select">Вибір зі спиsku (dropdown)</option>
                            <option value="number">Число</option>
                            <option value="text">Текст</option>
                        </select>
                    </div>

                    {/* Options for select type */}
                    {type === 'select' && (
                        <div>
                            <label style={labelStyle}>Опції вибору</label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <input
                                    type="text"
                                    value={optionInput}
                                    onChange={(e) => setOptionInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                                    placeholder="Введіть опцію і натисніть Enter"
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <button type="button" onClick={handleAddOption} style={addOptionBtnStyle}>
                                    <Plus size={18} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {options.map((option, index) => (
                                    <div key={index} style={optionItemStyle}>
                                        <span style={{ flex: 1 }}>{option}</span>
                                        <input
                                            type="number"
                                            placeholder="+0 грн"
                                            value={optionPrices[option] || ''}
                                            onChange={(e) => handleOptionPriceChange(option, Number(e.target.value))}
                                            style={{ ...inputStyle, width: '100px', padding: '6px 10px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveOption(index)}
                                            style={removeOptionBtnStyle}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Number type settings */}
                    {type === 'number' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Мін. значення</label>
                                <input
                                    type="number"
                                    value={min || ''}
                                    onChange={(e) => setMin(e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="0"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Макс. значення</label>
                                <input
                                    type="number"
                                    value={max || ''}
                                    onChange={(e) => setMax(e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="1000"
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    )}

                    {/* Placeholder for text/number */}
                    {(type === 'text' || type === 'number') && (
                        <div>
                            <label style={labelStyle}>Підказка (placeholder)</label>
                            <input
                                type="text"
                                value={placeholder}
                                onChange={(e) => setPlaceholder(e.target.value)}
                                placeholder="Введіть текст..."
                                style={inputStyle}
                            />
                        </div>
                    )}

                    {/* Price modifier for boolean */}
                    {type === 'boolean' && (
                        <div>
                            <label style={labelStyle}>Цінова надбавка (грн)</label>
                            <input
                                type="number"
                                value={priceModifier}
                                onChange={(e) => setPriceModifier(Number(e.target.value))}
                                placeholder="0"
                                style={inputStyle}
                            />
                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                                Додаткова вартість, якщо увімкнено
                            </p>
                        </div>
                    )}

                    {/* Required checkbox */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                            type="checkbox"
                            id="required"
                            checked={required}
                            onChange={(e) => setRequired(e.target.checked)}
                            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                        />
                        <label htmlFor="required" style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                            Обов'язкове поле
                        </label>
                    </div>
                </div>

                <div style={footerStyle}>
                    <button type="button" onClick={handleClose} style={cancelBtnStyle}>
                        Скасувати
                    </button>
                    <button type="button" onClick={handleSave} style={saveBtnStyle}>
                        Зберегти
                    </button>
                </div>
            </div>
        </div>
    );
}

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
};

const modalStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '24px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px',
    borderBottom: '1px solid #f1f5f9'
};

const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 800,
    color: '#1e293b'
};

const closeBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    cursor: 'pointer'
};

const contentStyle: React.CSSProperties = {
    padding: '32px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
};

const footerStyle: React.CSSProperties = {
    padding: '20px 32px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#64748b',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1.5px solid #e2e8f0',
    outline: 'none',
    fontSize: '14px'
};

const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1.5px solid #e2e8f0',
    outline: 'none',
    fontSize: '14px',
    backgroundColor: 'white'
};

const addOptionBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: 'white',
    cursor: 'pointer'
};

const optionItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0'
};

const removeOptionBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    cursor: 'pointer'
};

const cancelBtnStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '12px',
    border: '1.5px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#64748b',
    fontWeight: 600,
    cursor: 'pointer'
};

const saveBtnStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer'
};
