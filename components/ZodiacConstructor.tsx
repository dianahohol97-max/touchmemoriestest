'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Star } from 'lucide-react';
import ZodiacPreview from './ZodiacPreview';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';

interface ZodiacConfig {
    // Step 1: Zodiac Selection
    zodiacSign: string;
    zodiacSymbol: string;
    autoDetect: boolean;
    birthDate: string;

    // Step 2: Personalize
    name: string;
    dateText: string; // Display date text

    // Step 3: Design
    style: 'constellation' | 'illustrated-symbol' | 'aura-gradient';
    backgroundColor: string;
    zodiacColor: string;
    textColor: string;
    fontFamily: string;

    // Step 4: Size & Product
    size: string;
    productType: string;
    price: number;
}

export default function ZodiacConstructor() {
    const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [config, setConfig] = useState<ZodiacConfig>({
        // Step 1 defaults
        zodiacSign: 'Лев',
        zodiacSymbol: '♌',
        autoDetect: false,
        birthDate: '',

        // Step 2 defaults
        name: '',
        dateText: '',

        // Step 3 defaults
        style: 'constellation',
        backgroundColor: '#0a1128',
        zodiacColor: '#ffd700',
        textColor: '#ffffff',
        fontFamily: 'Georgia',

        // Step 4 defaults
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
                .eq('slug', 'zodiac-poster')
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

    // Zodiac signs with symbols
    const zodiacSigns = [
        { name: 'Овен', symbol: '♈', dates: '21.03 - 19.04', element: 'Вогонь' },
        { name: 'Телець', symbol: '♉', dates: '20.04 - 20.05', element: 'Земля' },
        { name: 'Близнюки', symbol: '♊', dates: '21.05 - 20.06', element: 'Повітря' },
        { name: 'Рак', symbol: '♋', dates: '21.06 - 22.07', element: 'Вода' },
        { name: 'Лев', symbol: '♌', dates: '23.07 - 22.08', element: 'Вогонь' },
        { name: 'Діва', symbol: '♍', dates: '23.08 - 22.09', element: 'Земля' },
        { name: 'Терези', symbol: '♎', dates: '23.09 - 22.10', element: 'Повітря' },
        { name: 'Скорпіон', symbol: '♏', dates: '23.10 - 21.11', element: 'Вода' },
        { name: 'Стрілець', symbol: '♐', dates: '22.11 - 21.12', element: 'Вогонь' },
        { name: 'Козеріг', symbol: '♑', dates: '22.12 - 19.01', element: 'Земля' },
        { name: 'Водолій', symbol: '♒', dates: '20.01 - 18.02', element: 'Повітря' },
        { name: 'Риби', symbol: '♓', dates: '19.02 - 20.03', element: 'Вода' }
    ];

    // Calculate zodiac sign from birth date
    const calculateZodiacFromDate = (dateString: string): { name: string; symbol: string } => {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();

        if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return { name: 'Овен', symbol: '♈' };
        if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return { name: 'Телець', symbol: '♉' };
        if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return { name: 'Близнюки', symbol: '♊' };
        if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return { name: 'Рак', symbol: '♋' };
        if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return { name: 'Лев', symbol: '♌' };
        if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return { name: 'Діва', symbol: '♍' };
        if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return { name: 'Терези', symbol: '♎' };
        if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return { name: 'Скорпіон', symbol: '♏' };
        if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return { name: 'Стрілець', symbol: '♐' };
        if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return { name: 'Козеріг', symbol: '♑' };
        if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return { name: 'Водолій', symbol: '♒' };
        return { name: 'Риби', symbol: '♓' };
    };

    // Auto-detect zodiac sign when birth date changes
    useEffect(() => {
        if (config.autoDetect && config.birthDate) {
            const zodiac = calculateZodiacFromDate(config.birthDate);
            const zodiacInfo = zodiacSigns.find(z => z.name === zodiac.name);

            setConfig(prev => ({
                ...prev,
                zodiacSign: zodiac.name,
                zodiacSymbol: zodiac.symbol,
                dateText: zodiacInfo?.dates || ''
            }));
        }
    }, [config.birthDate, config.autoDetect]);

    // Style presets
    const stylePresets = {
        'constellation': {
            name: 'Карта сузір\'я',
            bg: '#0a1128',
            zodiac: '#ffd700',
            text: '#ffffff',
            description: 'Зоряна карта сузір\'я'
        },
        'illustrated-symbol': {
            name: 'Ілюстрований символ',
            bg: '#fff9f0',
            zodiac: '#d4a574',
            text: '#2c2c2c',
            description: 'Художня ілюстрація символу'
        },
        'aura-gradient': {
            name: 'Аура/градієнт',
            bg: '#1a0a2e',
            zodiac: '#7b2cbf',
            text: '#e0aaff',
            description: 'Містичний градієнт'
        }
    };

    // Font families
    const fonts = [
        'Georgia',
        'Playfair Display',
        'Lora',
        'Montserrat',
        'Cinzel',
        'Cormorant Garamond'
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
            zodiacColor: preset.zodiac,
            textColor: preset.text
        });
    };

    const handleZodiacSelect = (zodiac: typeof zodiacSigns[0]) => {
        setConfig({
            ...config,
            zodiacSign: zodiac.name,
            zodiacSymbol: zodiac.symbol,
            dateText: zodiac.dates,
            autoDetect: false,
            birthDate: ''
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
            id: `zodiac-${Date.now()}`,
            name: 'Постер знаку зодіаку',
            price: totalPrice,
            qty: 1,
            image: product?.image_url || '/placeholder-poster.jpg',
            options: {
                'Розмір': config.size,
                'Тип продукту': config.productType,
                'Знак зодіаку': `${config.zodiacSign} ${config.zodiacSymbol}`,
                'Стиль': stylePresets[config.style].name,
                'Шрифт': config.fontFamily
            },
            personalization_note: `
Знак зодіаку: ${config.zodiacSign} ${config.zodiacSymbol}
Ім'я: ${config.name || '(не вказано)'}
Дата: ${config.dateText || config.birthDate || '(не вказано)'}
Стиль: ${stylePresets[config.style].name}
            `.trim()
        });

        toast.success('Постер знаку зодіаку додано до кошика!');
    };

    const nextStep = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
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
                        Постер знаку зодіаку
                    </h1>
                    <p className="text-gray-600">
                        Створіть унікальний постер з вашим знаком зодіаку
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-center space-x-4">
                        {[1, 2, 3, 4].map((step) => (
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
                                {step < 4 && (
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
                            {currentStep === 1 && 'Крок 1: Вибір знаку'}
                            {currentStep === 2 && 'Крок 2: Персоналізація'}
                            {currentStep === 3 && 'Крок 3: Дизайн'}
                            {currentStep === 4 && 'Крок 4: Розмір і тип'}
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel - Controls */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
                            {/* STEP 1: ZODIAC SELECTION */}
                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <Star className="w-5 h-5 text-yellow-500" />
                                        Оберіть знак зодіаку
                                    </h3>

                                    {/* Auto-detect toggle */}
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={config.autoDetect}
                                                onChange={(e) => setConfig({ ...config, autoDetect: e.target.checked })}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm font-medium text-gray-700">
                                                Визначити автоматично з дати народження
                                            </span>
                                        </label>
                                        {config.autoDetect && (
                                            <div className="mt-3">
                                                <input
                                                    type="date"
                                                    value={config.birthDate}
                                                    onChange={(e) => setConfig({ ...config, birthDate: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Zodiac Grid */}
                                    {!config.autoDetect && (
                                        <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                                            {zodiacSigns.map((zodiac) => (
                                                <button
                                                    key={zodiac.name}
                                                    onClick={() => handleZodiacSelect(zodiac)}
                                                    className={`p-3 rounded-lg border-2 transition-all ${
                                                        config.zodiacSign === zodiac.name
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="text-3xl mb-1">{zodiac.symbol}</div>
                                                    <p className="text-xs font-medium">{zodiac.name}</p>
                                                    <p className="text-xs text-gray-500">{zodiac.dates}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Selected zodiac info */}
                                    {config.zodiacSign && (
                                        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                                            <p className="text-sm text-gray-700">
                                                <span className="font-semibold">Обраний знак:</span>
                                            </p>
                                            <p className="text-2xl font-bold text-purple-700 mt-1">
                                                {config.zodiacSymbol} {config.zodiacSign}
                                            </p>
                                            {config.dateText && (
                                                <p className="text-xs text-gray-600 mt-1">{config.dateText}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: PERSONALIZE */}
                            {currentStep === 2 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Персоналізація</h3>

                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Ім'я (опціонально)
                                        </label>
                                        <input
                                            type="text"
                                            value={config.name}
                                            onChange={(e) => setConfig({ ...config, name: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Ваше ім'я"
                                            maxLength={30}
                                        />
                                    </div>

                                    {/* Date text (if not auto-detected) */}
                                    {!config.autoDetect && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Дата народження (опціонально)
                                            </label>
                                            <input
                                                type="date"
                                                value={config.birthDate}
                                                onChange={(e) => setConfig({ ...config, birthDate: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 3: DESIGN */}
                            {currentStep === 3 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Дизайн</h3>

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
                                                            className="w-12 h-12 rounded"
                                                            style={{ backgroundColor: stylePresets[style].bg }}
                                                        >
                                                            <div
                                                                className="w-full h-full flex items-center justify-center text-xl"
                                                                style={{ color: stylePresets[style].zodiac }}
                                                            >
                                                                ★
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-600">
                                                        {stylePresets[style].description}
                                                    </p>
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

                            {/* STEP 4: SIZE & PRODUCT */}
                            {currentStep === 4 && (
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
                                {currentStep < 4 ? (
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
                            <ZodiacPreview config={config} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
