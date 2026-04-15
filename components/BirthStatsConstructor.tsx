'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Baby } from 'lucide-react';
import BirthStatsPreview from './BirthStatsPreview';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';
import { useT } from '@/lib/i18n/context';

interface BirthStatsConfig {
    // Step 1: Baby Info
    babyName: string;
    birthDate: string;
    birthTime: string;
    weight: string; // in kg
    height: string; // in cm

    // Step 2: Design
    templateStyle: 'typographic-bw' | 'pastel-illustrated' | 'minimal-modern';
    zodiacSign: string; // Auto-calculated
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: string;

    // Step 3: Size & Product
    size: string;
    productType: string;
    price: number;
}

export default function BirthStatsConstructor() {
    
    const t = useT();
const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [config, setConfig] = useState<BirthStatsConfig>({
        // Step 1 defaults
        babyName: '',
        birthDate: new Date().toISOString().split('T')[0],
        birthTime: '12:00',
        weight: '',
        height: '',

        // Step 2 defaults
        templateStyle: 'pastel-illustrated',
        zodiacSign: '',
        backgroundColor: '#fff5f7',
        textColor: '#2c2c2c',
        accentColor: '#ffa5c0',
        fontFamily: 'Montserrat',

        // Step 3 defaults
        size: '30×40 см',
        productType: 'Постер',
        price: 0
    });

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        async function fetchProduct() {
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('slug', 'birth-stats-poster')
                .eq('is_active', true)
                .single();

            if (data) {
                setProduct(data);
                setConfig(prev => ({
                    ...prev,
                    price: data.price || 450
                }));
            }
            setLoading(false);
        }
        fetchProduct();
    }, [supabase]);

    // Calculate zodiac sign from birth date
    useEffect(() => {
        if (config.birthDate) {
            const zodiac = calculateZodiacSign(config.birthDate);
            setConfig(prev => ({ ...prev, zodiacSign: zodiac }));
        }
    }, [config.birthDate]);

    const calculateZodiacSign = (dateString: string): string => {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();

        if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Овен ';
        if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Телець ';
        if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Близнюки ';
        if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Рак ';
        if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Лев ';
        if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Діва ';
        if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Терези ';
        if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Скорпіон ';
        if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Стрілець ';
        if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Козеріг ';
        if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Водолій ';
        return 'Риби ';
    };

    // Template styles
    const templateStyles = {
        'typographic-bw': {
            name: 'Типографічний Ч/Б',
            bg: '#ffffff',
            text: '#000000',
            accent: '#2c2c2c'
        },
        'pastel-illustrated': {
            name: 'Пастельний ілюстрований',
            bg: '#fff5f7',
            text: '#2c2c2c',
            accent: '#ffa5c0'
        },
        'minimal-modern': {
            name: 'Мінімалістичний сучасний',
            bg: '#f8f9fa',
            text: '#1a1a1a',
            accent: '#4a90e2'
        }
    };

    // Font families
    const fonts = [
        'Montserrat',
        'Georgia',
        'Playfair Display',
        'Lora',
        'Roboto',
        'Open Sans',
        'Raleway'
    ];

    // Size and product type options
    const sizes = [
        { label: '30×40 см', price: 450 },
        { label: '50×70 см', price: 750 }
    ];

    const productTypes = [
        { label: 'Постер', price: 0 },
        { label: 'В рамці', price: 300 },
        { label: 'Метал', price: 500 }
    ];

    const handleTemplateChange = (template: keyof typeof templateStyles) => {
        const style = templateStyles[template];
        setConfig({
            ...config,
            templateStyle: template,
            backgroundColor: style.bg,
            textColor: style.text,
            accentColor: style.accent
        });
    };

    const calculatePrice = (): number => {
        const sizePrice = sizes.find(s => s.label === config.size)?.price || 450;
        const typePrice = productTypes.find(t => t.label === config.productType)?.price || 0;
        return sizePrice + typePrice;
    };

    const handleAddToCart = () => {
        if (!config.babyName || !config.weight || !config.height) {
            toast.error('Будь ласка, заповніть всі обов\'язкові поля');
            return;
        }

        const totalPrice = calculatePrice();

        addItem({
            id: `birth-stats-${Date.now()}`,
            name: t('birthstats.header_title'),
            price: totalPrice,
            qty: 1,
            image: product?.image_url || '/placeholder-poster.jpg',
            options: {
                'Розмір': config.size,
                'Тип продукту': config.productType,
                'Стиль': templateStyles[config.templateStyle].name,
                'Шрифт': config.fontFamily
            },
            personalization_note: `
Ім'я дитини: ${config.babyName}
Дата народження: ${config.birthDate}
Час народження: ${config.birthTime}
Вага: ${config.weight} кг
Зріст: ${config.height} см
Знак зодіаку: ${config.zodiacSign}
            `.trim()
        });

        toast.success(t('birthstats.birthstats_added'));
    };

    const nextStep = () => {
        if (currentStep === 1 && (!config.babyName || !config.weight || !config.height)) {
            toast.error('Будь ласка, заповніть всі обов\'язкові поля');
            return;
        }
        if (currentStep < 3) setCurrentStep(currentStep + 1);
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Завантаження конструктора...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                        Метрика народження
                    </h1>
                    <p className="text-gray-600">
                        Створіть унікальний постер з найважливішими даними про народження вашої дитини
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-center space-x-4">
                        {[1, 2, 3].map((step) => (
                            <div key={step} className="flex items-center">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                                        step === currentStep
                                            ? 'bg-blue-600 text-white'
                                            : step < currentStep
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-300 text-gray-600'
                                    }`}
                                >
                                    {step}
                                </div>
                                {step < 3 && (
                                    <div
                                        className={`w-16 h-1 ${
                                            step < currentStep ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-center mt-2">
                        <p className="text-sm text-gray-600">
                            {currentStep === 1 && t('birthstats.step_1')}
                            {currentStep === 2 && t('birthstats.step_2')}
                            {currentStep === 3 && t('birthstats.step_3')}
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel - Controls */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
                            {/* STEP 1: BABY INFO */}
                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <Baby className="w-5 h-5 text-pink-500" />
                                        Дані про дитину
                                    </h3>

                                    {/* Baby Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Ім'я дитини <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={config.babyName}
                                            onChange={(e) => setConfig({ ...config, babyName: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Софія"
                                        />
                                    </div>

                                    {/* Birth Date */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Дата народження <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={config.birthDate}
                                            onChange={(e) => setConfig({ ...config, birthDate: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Birth Time */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Час народження
                                        </label>
                                        <input
                                            type="time"
                                            value={config.birthTime}
                                            onChange={(e) => setConfig({ ...config, birthTime: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Weight */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Вага (кг) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={config.weight}
                                            onChange={(e) => setConfig({ ...config, weight: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="3.4"
                                        />
                                    </div>

                                    {/* Height */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Зріст (см) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={config.height}
                                            onChange={(e) => setConfig({ ...config, height: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="52"
                                        />
                                    </div>

                                    {/* Zodiac Sign (auto-calculated) */}
                                    {config.zodiacSign && (
                                        <div className="p-4 bg-blue-50 rounded-lg">
                                            <p className="text-sm text-gray-700">
                                                <span className="font-semibold">Знак зодіаку:</span> {config.zodiacSign}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: DESIGN */}
                            {currentStep === 2 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Дизайн</h3>

                                    {/* Template Style */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Стиль шаблону
                                        </label>
                                        <div className="space-y-3">
                                            {(Object.keys(templateStyles) as Array<keyof typeof templateStyles>).map((template) => (
                                                <button
                                                    key={template}
                                                    onClick={() => handleTemplateChange(template)}
                                                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                                        config.templateStyle === template
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium">{templateStyles[template].name}</p>
                                                        </div>
                                                        <div
                                                            className="w-12 h-12 rounded"
                                                            style={{ backgroundColor: templateStyles[template].bg }}
                                                        >
                                                            <div
                                                                className="w-full h-full flex items-center justify-center text-2xl"
                                                                style={{ color: templateStyles[template].accent }}
                                                            >
                                                                
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Font Family */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Шрифт
                                        </label>
                                        <select
                                            value={config.fontFamily}
                                            onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            {fonts.map((font) => (
                                                <option key={font} value={font}>
                                                    {font}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: SIZE & PRODUCT */}
                            {currentStep === 3 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Розмір і тип продукту</h3>

                                    {/* Size Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Розмір
                                        </label>
                                        <div className="space-y-2">
                                            {sizes.map((size) => (
                                                <button
                                                    key={size.label}
                                                    onClick={() => setConfig({ ...config, size: size.label })}
                                                    className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                                                        config.size === size.label
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-medium">{size.label}</span>
                                                        <span className="text-gray-600">{size.price} ₴</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Product Type Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Тип продукту
                                        </label>
                                        <div className="space-y-2">
                                            {productTypes.map((type) => (
                                                <button
                                                    key={type.label}
                                                    onClick={() => setConfig({ ...config, productType: type.label })}
                                                    className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                                                        config.productType === type.label
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-medium">{type.label}</span>
                                                        <span className="text-gray-600">
                                                            {type.price > 0 ? `+${type.price} ₴` : 'Базова ціна'}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Total Price */}
                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex justify-between items-center text-lg font-bold">
                                            <span>Загальна вартість:</span>
                                            <span className="text-blue-600">{calculatePrice()} ₴</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* QR Code Generator */}
                        <div style={{ marginBottom: 16 }}>
                          <QRCodeGenerator compact label="Додати QR-код до замовлення" />
                        </div>

                        {/* Navigation Buttons */}
                            <div className="flex gap-3 mt-6">
                                {currentStep > 1 && (
                                    <button
                                        onClick={prevStep}
                                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Назад
                                    </button>
                                )}
                                {currentStep < 3 ? (
                                    <button
                                        onClick={nextStep}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        Далі
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleAddToCart}
                                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ShoppingCart className="w-4 h-4" />
                                        Додати до кошика
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Preview */}
                    <div className="lg:col-span-2 order-1 lg:order-2">
                        <div className="bg-white rounded-lg shadow-lg p-8 sticky top-24">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Попередній перегляд</h3>
                            <BirthStatsPreview config={config} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
