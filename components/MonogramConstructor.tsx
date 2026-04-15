'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Type } from 'lucide-react';
import MonogramPreview from './MonogramPreview';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';
import { useT } from '@/lib/i18n/context';

interface MonogramConfig {
    // Step 1: Letter Selection
    letter: string;
    language: 'uk' | 'en';

    // Step 2: Style & Personalize
    style: 'botanical' | 'kids-animal' | 'classic-serif' | 'modern-sans';
    customText: string; // Name or custom text below letter
    backgroundColor: string;
    letterColor: string;
    accentColor: string;
    fontFamily: string;

    // Step 3: Size & Product
    size: string;
    productType: string;
    price: number;
}

export default function MonogramConstructor() {
    
    const t = useT();
const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [config, setConfig] = useState<MonogramConfig>({
        // Step 1 defaults
        letter: 'А',
        language: 'uk',

        // Step 2 defaults
        style: 'botanical',
        customText: '',
        backgroundColor: '#ffffff',
        letterColor: '#2c5f2d',
        accentColor: '#97bc62',
        fontFamily: 'Georgia',

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
                .eq('slug', 'monogram-poster')
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

    // Ukrainian and English alphabets
    const ukrainianAlphabet = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЮЯ'.split('');
    const englishAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    const currentAlphabet = config.language === 'uk' ? ukrainianAlphabet : englishAlphabet;

    // Style presets
    const stylePresets = {
        'botanical': {
            name: t('monogram.botanical'),
            bg: '#ffffff',
            letter: '#2c5f2d',
            accent: '#97bc62',
            description: 'Листя та квіти навколо літери'
        },
        'kids-animal': {
            name: 'Дитяча з тваринкою',
            bg: '#fff9f0',
            letter: '#ff9b50',
            accent: '#ffcc80',
            description: 'Тваринка що відповідає літері'
        },
        'classic-serif': {
            name: 'Класична серифна',
            bg: '#f8f8f8',
            letter: '#1a1a1a',
            accent: '#8b7355',
            description: 'Елегантна серифна типографіка'
        },
        'modern-sans': {
            name: 'Сучасна без засічок',
            bg: '#ffffff',
            letter: '#4a90e2',
            accent: '#7ab8f5',
            description: 'Мінімалістичний сучасний стиль'
        }
    };

    // Font families
    const fonts = [
        'Georgia',
        'Playfair Display',
        'Lora',
        'Montserrat',
        'Roboto',
        'Open Sans'
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

    const handleStyleChange = (style: keyof typeof stylePresets) => {
        const preset = stylePresets[style];
        setConfig({
            ...config,
            style,
            backgroundColor: preset.bg,
            letterColor: preset.letter,
            accentColor: preset.accent
        });
    };

    const handleLanguageChange = (lang: 'uk' | 'en') => {
        setConfig({
            ...config,
            language: lang,
            letter: lang === 'uk' ? 'А' : 'A'
        });
    };

    const calculatePrice = (): number => {
        const sizePrice = sizes.find(s => s.label === config.size)?.price || 450;
        const typePrice = productTypes.find(t => t.label === config.productType)?.price || 0;
        return sizePrice + typePrice;
    };

    const handleAddToCart = () => {
        const totalPrice = calculatePrice();

        addItem({
            id: `monogram-${Date.now()}`,
            name: t('monogram.header_title'),
            price: totalPrice,
            qty: 1,
            image: product?.image_url || '/placeholder-poster.jpg',
            options: {
                'Розмір': config.size,
                'Тип продукту': config.productType,
                'Літера': config.letter,
                'Мова': config.language === 'uk' ? t('monogram.ukrainian') : t('monogram.english'),
                'Стиль': stylePresets[config.style].name,
                'Шрифт': config.fontFamily
            },
            personalization_note: `
Літера: ${config.letter}
Текст: ${config.customText || '(не вказано)'}
Стиль: ${stylePresets[config.style].name}
            `.trim()
        });

        toast.success(t('monogram.monogram_added'));
    };

    const nextStep = () => {
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
                        Постер з ініціалом
                    </h1>
                    <p className="text-gray-600">
                        Створіть стильний постер з вашою улюбленою літерою
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
                            {currentStep === 1 && t('monogram.step_1')}
                            {currentStep === 2 && t('monogram.step_2')}
                            {currentStep === 3 && t('monogram.step_3')}
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel - Controls */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
                            {/* STEP 1: LETTER SELECTION */}
                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <Type className="w-5 h-5 text-blue-500" />
                                        Оберіть літеру
                                    </h3>

                                    {/* Language Toggle */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleLanguageChange('uk')}
                                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                                                config.language === 'uk'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            Українська
                                        </button>
                                        <button
                                            onClick={() => handleLanguageChange('en')}
                                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                                                config.language === 'en'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            English
                                        </button>
                                    </div>

                                    {/* Letter Grid */}
                                    <div className="grid grid-cols-5 gap-2 max-h-96 overflow-y-auto">
                                        {currentAlphabet.map((letter) => (
                                            <button
                                                key={letter}
                                                onClick={() => setConfig({ ...config, letter })}
                                                className={`aspect-square rounded-lg font-bold text-xl transition-all ${
                                                    config.letter === letter
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            >
                                                {letter}
                                            </button>
                                        ))}
                                    </div>

                                    <p className="text-sm text-gray-500">
                                        Обрана літера: <span className="font-bold text-lg">{config.letter}</span>
                                    </p>
                                </div>
                            )}

                            {/* STEP 2: STYLE & PERSONALIZE */}
                            {currentStep === 2 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Стиль і персоналізація</h3>

                                    {/* Style Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Оберіть стиль
                                        </label>
                                        <div className="space-y-3">
                                            {(Object.keys(stylePresets) as Array<keyof typeof stylePresets>).map((style) => (
                                                <button
                                                    key={style}
                                                    onClick={() => handleStyleChange(style)}
                                                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                                        config.style === style
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="font-medium">{stylePresets[style].name}</p>
                                                        <div
                                                            className="w-8 h-8 rounded"
                                                            style={{ backgroundColor: stylePresets[style].accent }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-gray-600">
                                                        {stylePresets[style].description}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom Text */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Текст під літерою (опціонально)
                                        </label>
                                        <input
                                            type="text"
                                            value={config.customText}
                                            onChange={(e) => setConfig({ ...config, customText: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Ім'я або текст"
                                            maxLength={20}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {config.customText.length}/20 символів
                                        </p>
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
                            <MonogramPreview config={config} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
