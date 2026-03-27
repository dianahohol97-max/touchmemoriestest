'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
    Save,
    Plus,
    Trash2,
    Activity,
    Package,
    DollarSign,
    Edit
} from 'lucide-react';

interface Product {
    id: string;
    name: string;
    slug: string;
    price: number;
    sale_price: number | null;
    product_attributes: any;
    custom_attributes: any;
}

interface Attribute {
    key: string;
    label: string;
    type: 'select' | 'color' | 'boolean' | 'number' | 'text';
    options?: string[];
    required: boolean;
    defaultValue?: string;
}

export default function ProductsManagementPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [attributes, setAttributes] = useState<Attribute[]>([]);
    const [basePrice, setBasePrice] = useState<number>(0);
    const [salePrice, setSalePrice] = useState<number | null>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            const customAttrs = selectedProduct.custom_attributes || [];
            if (Array.isArray(customAttrs)) {
                setAttributes(customAttrs);
            } else {
                setAttributes([]);
            }
            setBasePrice(selectedProduct.price || 0);
            setSalePrice(selectedProduct.sale_price);
        }
    }, [selectedProduct]);

    async function fetchProducts() {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('products')
                .select('id, name, slug, price, sale_price, product_attributes, custom_attributes')
                .eq('is_active', true)
                .order('name');

            if (data) {
                setProducts(data);
                if (data.length > 0) {
                    setSelectedProduct(data[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Помилка завантаження продуктів');
        } finally {
            setLoading(false);
        }
    }

    function addAttribute() {
        const newAttr: Attribute = {
            key: `attr_${Date.now()}`,
            label: 'Нова властивість',
            type: 'select',
            options: ['Опція 1', 'Опція 2'],
            required: false
        };
        setAttributes([...attributes, newAttr]);
    }

    function updateAttribute(index: number, field: keyof Attribute, value: any) {
        const updated = [...attributes];
        updated[index] = { ...updated[index], [field]: value };
        setAttributes(updated);
    }

    function deleteAttribute(index: number) {
        setAttributes(attributes.filter((_, i) => i !== index));
    }

    function addOption(attrIndex: number) {
        const updated = [...attributes];
        const attr = updated[attrIndex];
        if (!attr.options) attr.options = [];
        attr.options.push(`Опція ${attr.options.length + 1}`);
        setAttributes(updated);
    }

    function updateOption(attrIndex: number, optionIndex: number, value: string) {
        const updated = [...attributes];
        if (updated[attrIndex].options) {
            updated[attrIndex].options![optionIndex] = value;
        }
        setAttributes(updated);
    }

    function deleteOption(attrIndex: number, optionIndex: number) {
        const updated = [...attributes];
        if (updated[attrIndex].options) {
            updated[attrIndex].options = updated[attrIndex].options!.filter((_, i) => i !== optionIndex);
        }
        setAttributes(updated);
    }

    async function saveProduct() {
        if (!selectedProduct) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    price: basePrice,
                    sale_price: salePrice,
                    custom_attributes: attributes
                })
                .eq('id', selectedProduct.id);

            if (error) throw error;

            toast.success('Продукт збережено');
            await fetchProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            toast.error('Помилка збереження продукту');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Activity className="animate-spin" size={48} color="#263A99" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Управління продуктами</h1>
                <p className="text-gray-600">Редагуйте властивості та ціни продуктів</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-4">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Package size={20} />
                        Продукти
                    </h2>
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                        {products.map((product) => (
                            <button
                                key={product.id}
                                onClick={() => setSelectedProduct(product)}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                                    selectedProduct?.id === product.id
                                        ? 'bg-[#1e2d7d] text-white'
                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                                }`}
                            >
                                <div className="font-medium text-sm truncate">{product.name}</div>
                                <div className="text-xs opacity-75 mt-1">{product.price} ₴</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-6">
                    {selectedProduct ? (
                        <>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h2>
                                    <p className="text-sm text-gray-500 mt-1">ID: {selectedProduct.slug}</p>
                                </div>
                                <button
                                    onClick={saveProduct}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] disabled:opacity-50 transition-colors"
                                >
                                    {saving ? (
                                        <>
                                            <Activity className="animate-spin" size={18} />
                                            Збереження...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            Зберегти
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="border-b border-gray-200 pb-6 mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <DollarSign size={20} />
                                    Базова ціна
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Звичайна ціна (₴)
                                        </label>
                                        <input
                                            type="number"
                                            value={basePrice}
                                            onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Ціна зі знижкою (₴)
                                        </label>
                                        <input
                                            type="number"
                                            value={salePrice || ''}
                                            onChange={(e) => setSalePrice(e.target.value ? parseFloat(e.target.value) : null)}
                                            placeholder="Необов'язково"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Edit size={20} />
                                        Властивості та варіанти
                                    </h3>
                                    <button
                                        onClick={addAttribute}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#162159] transition-colors text-sm"
                                    >
                                        <Plus size={16} />
                                        Додати властивість
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {attributes.map((attr, attrIndex) => (
                                        <div key={attrIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Назва властивості
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={attr.label}
                                                        onChange={(e) => updateAttribute(attrIndex, 'label', e.target.value)}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] bg-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Тип
                                                    </label>
                                                    <select
                                                        value={attr.type}
                                                        onChange={(e) => updateAttribute(attrIndex, 'type', e.target.value)}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] bg-white"
                                                    >
                                                        <option value="select">Випадаючий список</option>
                                                        <option value="color">Кольори</option>
                                                        <option value="boolean">Так/Ні</option>
                                                        <option value="number">Число</option>
                                                        <option value="text">Текст</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {(attr.type === 'select' || attr.type === 'color') && (
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Опції
                                                        </label>
                                                        <button
                                                            onClick={() => addOption(attrIndex)}
                                                            className="text-sm text-[#1e2d7d] hover:underline"
                                                        >
                                                            + Додати опцію
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {attr.options?.map((option, optIndex) => (
                                                            <div key={optIndex} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={option}
                                                                    onChange={(e) => updateOption(attrIndex, optIndex, e.target.value)}
                                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] bg-white text-sm"
                                                                />
                                                                <button
                                                                    onClick={() => deleteOption(attrIndex, optIndex)}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={attr.required}
                                                        onChange={(e) => updateAttribute(attrIndex, 'required', e.target.checked)}
                                                        className="w-4 h-4 text-[#1e2d7d] border-gray-300 rounded focus:ring-[#1e2d7d]"
                                                    />
                                                    <label className="text-sm font-medium text-gray-700">
                                                        Обов'язкове поле
                                                    </label>
                                                </div>
                                                <button
                                                    onClick={() => deleteAttribute(attrIndex)}
                                                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                                                >
                                                    <Trash2 size={16} />
                                                    Видалити властивість
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {attributes.length === 0 && (
                                        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                                            <Package size={48} className="mx-auto mb-4 opacity-50" />
                                            <p className="font-medium">Властивості не додано</p>
                                            <p className="text-sm mt-1">Натисніть "Додати властивість" для створення варіантів</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Package size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Оберіть продукт зі списку</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
