'use client';
import { useState } from 'react';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { CustomAttribute, AttributePriceModifiers } from '@/lib/types/product';
import AddAttributeModal from './AddAttributeModal';

interface CustomAttributeManagerProps {
    attributes: CustomAttribute[];
    priceModifiers: AttributePriceModifiers;
    onChange: (attributes: CustomAttribute[], priceModifiers: AttributePriceModifiers) => void;
}

export default function CustomAttributeManager({
    attributes,
    priceModifiers,
    onChange
}: CustomAttributeManagerProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const handleAddAttribute = (attribute: CustomAttribute, priceData?: number | Record<string, number>) => {
        const newAttributes = [...attributes, attribute];
        const newModifiers = { ...priceModifiers };

        if (priceData !== undefined) {
            if (attribute.type === 'select' && typeof priceData === 'object') {
                Object.entries(priceData).forEach(([option, price]) => {
                    if (price > 0) {
                        newModifiers[`${attribute.key}_${option}`] = price;
                    }
                });
            } else if (attribute.type === 'boolean' && typeof priceData === 'number') {
                if (priceData > 0) {
                    newModifiers[attribute.key] = priceData;
                }
            }
        }

        onChange(newAttributes, newModifiers);
        toast.success('Характеристику додано');
    };

    const handleEditAttribute = (attribute: CustomAttribute, priceData?: number | Record<string, number>) => {
        if (editingIndex === null) return;

        const oldAttribute = attributes[editingIndex];
        const newAttributes = [...attributes];
        newAttributes[editingIndex] = attribute;

        const newModifiers = { ...priceModifiers };

        // Remove old price modifiers
        if (oldAttribute.type === 'select') {
            Object.keys(newModifiers).forEach(key => {
                if (key.startsWith(`${oldAttribute.key}_`)) {
                    delete newModifiers[key];
                }
            });
        } else {
            delete newModifiers[oldAttribute.key];
        }

        // Add new price modifiers
        if (priceData !== undefined) {
            if (attribute.type === 'select' && typeof priceData === 'object') {
                Object.entries(priceData).forEach(([option, price]) => {
                    if (price > 0) {
                        newModifiers[`${attribute.key}_${option}`] = price;
                    }
                });
            } else if (attribute.type === 'boolean' && typeof priceData === 'number') {
                if (priceData > 0) {
                    newModifiers[attribute.key] = priceData;
                }
            }
        }

        onChange(newAttributes, newModifiers);
        setEditingIndex(null);
        toast.success('Характеристику оновлено');
    };

    const handleDeleteAttribute = (index: number) => {
        const attribute = attributes[index];
        const newAttributes = attributes.filter((_, i) => i !== index);
        const newModifiers = { ...priceModifiers };

        if (attribute.type === 'select') {
            Object.keys(newModifiers).forEach(key => {
                if (key.startsWith(`${attribute.key}_`)) {
                    delete newModifiers[key];
                }
            });
        } else {
            delete newModifiers[attribute.key];
        }

        onChange(newAttributes, newModifiers);
        toast.success('Характеристику видалено');
    };

    const getAttributePriceInfo = (attribute: CustomAttribute) => {
        if (attribute.type === 'boolean') {
            const price = priceModifiers[attribute.key];
            return price ? `+${price} грн` : '';
        } else if (attribute.type === 'select') {
            const prices = Object.entries(priceModifiers)
                .filter(([key]) => key.startsWith(`${attribute.key}_`))
                .map(([key, value]) => {
                    const option = key.replace(`${attribute.key}_`, '');
                    return `${option}: +${value} грн`;
                });
            return prices.length > 0 ? prices.join(', ') : '';
        }
        return '';
    };

    const getEditingPriceModifier = (attribute: CustomAttribute) => {
        if (attribute.type === 'boolean') {
            return priceModifiers[attribute.key] || 0;
        } else if (attribute.type === 'select') {
            const prices: Record<string, number> = {};
            Object.entries(priceModifiers).forEach(([key, value]) => {
                if (key.startsWith(`${attribute.key}_`)) {
                    const option = key.replace(`${attribute.key}_`, '');
                    prices[option] = value;
                }
            });
            return prices;
        }
        return undefined;
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'boolean': return 'Так/Ні';
            case 'select': return 'Вибір';
            case 'number': return 'Число';
            case 'text': return 'Текст';
            default: return type;
        }
    };

    return (
        <div style={containerStyle}>
            <div style={headerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Tag size={18} color="#64748b" />
                    <h3 style={titleStyle}>Додаткові характеристики</h3>
                </div>
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    style={addBtnStyle}
                >
                    <Plus size={18} /> Додати характеристику
                </button>
            </div>

            {attributes.length === 0 ? (
                <div style={emptyStateStyle}>
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                        Ще немає додаткових характеристик. Додайте перший!
                    </p>
                </div>
            ) : (
                <div style={listStyle}>
                    {attributes.map((attr, index) => (
                        <div key={index} style={cardStyle}>
                            <div style={{ flex: 1 }}>
                                <div style={attrHeaderStyle}>
                                    <span style={attrNameStyle}>{attr.label}</span>
                                    <span style={attrTypeStyle}>{getTypeLabel(attr.type)}</span>
                                </div>
                                {attr.type === 'select' && attr.options && (
                                    <div style={optionsStyle}>
                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Опції:</span>
                                        <span style={{ fontSize: '13px', color: '#475569' }}>
                                            {attr.options.join(', ')}
                                        </span>
                                    </div>
                                )}
                                {attr.required && (
                                    <span style={requiredBadgeStyle}>Обов'язкове</span>
                                )}
                                {getAttributePriceInfo(attr) && (
                                    <div style={priceInfoStyle}>
                                        💰 {getAttributePriceInfo(attr)}
                                    </div>
                                )}
                            </div>
                            <div style={actionsStyle}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingIndex(index);
                                        setIsModalOpen(true);
                                    }}
                                    style={editBtnStyle}
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteAttribute(index)}
                                    style={deleteBtnStyle}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AddAttributeModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingIndex(null);
                }}
                onSave={editingIndex !== null ? handleEditAttribute : handleAddAttribute}
                editingAttribute={editingIndex !== null ? attributes[editingIndex] : undefined}
                existingPriceModifier={
                    editingIndex !== null ? getEditingPriceModifier(attributes[editingIndex]) : undefined
                }
            />
        </div>
    );
}

const containerStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '3px',
    boxShadow: '0 4px 25px rgba(0,0,0,0.02)',
    border: '1px solid #f1f5f9'
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
};

const titleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 800,
    color: '#263A99',
    margin: 0
};

const addBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '3px',
    border: 'none',
    backgroundColor: 'var(--primary)',
    color: 'white',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
};

const emptyStateStyle: React.CSSProperties = {
    padding: '40px',
    textAlign: 'center',
    border: '2px dashed #e2e8f0',
    borderRadius: '3px'
};

const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
};

const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '3px',
    border: '1px solid #e2e8f0'
};

const attrHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
};

const attrNameStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 700,
    color: '#263A99'
};

const attrTypeStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    backgroundColor: 'white',
    padding: '4px 10px',
    borderRadius: '3px'
};

const optionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '4px'
};

const requiredBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: '4px 8px',
    borderRadius: '3px',
    marginTop: '8px'
};

const priceInfoStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#10b981',
    marginTop: '8px'
};

const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px'
};

const editBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    borderRadius: '3px',
    border: 'none',
    backgroundColor: 'white',
    color: '#64748b',
    cursor: 'pointer'
};

const deleteBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    borderRadius: '3px',
    border: 'none',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    cursor: 'pointer'
};
