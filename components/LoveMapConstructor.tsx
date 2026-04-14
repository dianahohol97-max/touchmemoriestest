'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Heart } from 'lucide-react';
import LoveMapPreview from './LoveMapPreview';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';

interface LoveMapConfig {
    // Step 1: Locations
    location1: string;
    latitude1: number;
    longitude1: number;
    location2: string;
    latitude2: number;
    longitude2: number;
    hasValidLocations: boolean;

    // Step 2: Personalize
    names: string; // e.g., "Anna & David"
    date: string;
    subtitle: string; // e.g., "Where we met and where we married"

    // Step 3: Design
    colorScheme: 'romantic-pink' | 'deep-blue' | 'classic-bw' | 'vintage-sepia';
    backgroundColor: string;
    mapColor: string;
    textColor: string;
    fontFamily: string;

    // Step 4: Size & Product
    size: string;
    productType: string;
    price: number;
}

export default function LoveMapConstructor() {
    const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [config, setConfig] = useState<LoveMapConfig>({
        // Step 1 defaults
        location1: 'Київ, Україна',
        latitude1: 50.4501,
        longitude1: 30.5234,
        location2: 'Львів, Україна',
        latitude2: 49.8397,
        longitude2: 24.0297,
        hasValidLocations: true,

        // Step 2 defaults
        names: '',
        date: new Date().toISOString().split('T')[0],
        subtitle: '',

        // Step 3 defaults
        colorScheme: 'romantic-pink',
        backgroundColor: '#fff0f5',
        mapColor: '#d4748c',
        textColor: '#5a2a3a',
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
                .eq('slug', 'love-map-poster')
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

    // Color schemes
    const colorSchemes = {
        'romantic-pink': { bg: '#fff0f5', map: '#d4748c', text: '#5a2a3a', name: 'Романтичний рожевий' },
        'deep-blue': { bg: '#0a1128', map: '#4a90e2', text: '#ffffff', name: 'Глибокий синій' },
        'classic-bw': { bg: '#ffffff', map: '#2c2c2c', text: '#000000', name: 'Класичний чорно-білий' },
        'vintage-sepia': { bg: '#f4e8d8', map: '#8b6f47', text: '#4a3a28', name: 'Вінтажний сепія' }
    };

    // Font families
    const fonts = [
        'Georgia',
        'Playfair Display',
        'Lora',
        'Montserrat',
        'Roboto',
        'Open Sans',
        'Raleway',
        'Cormorant Garamond'
    ];

    // Size and product type options
    const sizes = [
        { label: '30×40 см', price: 450 },
        { label: '50×70 см', price: 750 },
        { label: '60×90 см', price: 950 }
    ];

    const productTypes = [
        { label: 'Постер', price: 0 },
        { label: 'В рамці', price: 300 },
        { label: 'Метал', price: 500 }
    ];

    const handleColorSchemeChange = (scheme: keyof typeof colorSchemes) => {
        const colors = colorSchemes[scheme];
        setConfig({
            ...config,
            colorScheme: scheme,
            backgroundColor: colors.bg,
            mapColor: colors.map,
            textColor: colors.text
        });
    };

    const calculatePrice = (): number => {
        const sizePrice = sizes.find(s => s.label === config.size)?.price || 450;
        const typePrice = productTypes.find(t => t.label === config.productType)?.price || 0;
        return sizePrice + typePrice;
    };

    const handleAddToCart = () => {
        if (!config.hasValidLocations) {
            toast.error('Будь ласка, оберіть обидві локації');
            return;
        }

        const totalPrice = calculatePrice();

        addItem({
            id: `love-map-${Date.now()}`,
            name: 'Карта кохання',
            price: totalPrice,
            qty: 1,
            image: product?.image_url || '/placeholder-poster.jpg',
            options: {
                'Розмір': config.size,
                'Тип продукту': config.productType,
                'Локація 1': config.location1,
                'Локація 2': config.location2,
                'Колірна схема': colorSchemes[config.colorScheme].name,
                'Шрифт': config.fontFamily
            },
            personalization_note: `
Імена: ${config.names}
Дата: ${config.date}
Підзаголовок: ${config.subtitle}
Координати 1: ${config.latitude1.toFixed(4)}°, ${config.longitude1.toFixed(4)}°
Координати 2: ${config.latitude2.toFixed(4)}°, ${config.longitude2.toFixed(4)}°
            `.trim()
        });

        toast.success('Карту кохання додано до кошика!');
    };

    const nextStep = () => {
        if (currentStep === 1 && !config.hasValidLocations) {
            toast.error('Будь ласка, оберіть обидві локації');
            return;
        }
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
                        Карта кохання
                    </h1>
                    <p className="text-gray-600">
                        Два місця, одна історія. Створіть унікальний постер з вашими особливими локаціями.
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
                            {currentStep === 1 && 'Крок 1: Локації'}
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
                            {/* STEP 1: LOCATIONS */}
                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <Heart className="w-5 h-5 text-pink-500" />
                                        Оберіть локації
                                    </h3>

                                    {/* Location 1 */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Перша локація
                                        </label>
                                        <GooglePlacesAutocomplete
                                            value={config.location1}
                                            onChange={(location, lat, lon) => {
                                                setConfig({
                                                    ...config,
                                                    location1: location,
                                                    latitude1: lat || config.latitude1,
                                                    longitude1: lon || config.longitude1,
                                                    hasValidLocations: !!(lat && lon && config.latitude2)
                                                });
                                            }}
                                            placeholder="Київ, Україна"
                                        />
                                    </div>

                                    {/* Location 2 */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Друга локація
                                        </label>
                                        <GooglePlacesAutocomplete
                                            value={config.location2}
                                            onChange={(location, lat, lon) => {
                                                setConfig({
                                                    ...config,
                                                    location2: location,
                                                    latitude2: lat || config.latitude2,
                                                    longitude2: lon || config.longitude2,
                                                    hasValidLocations: !!(lat && lon && config.latitude1)
                                                });
                                            }}
                                            placeholder="Львів, Україна"
                                        />
                                    </div>

                                    <p className="text-xs text-gray-500">
                                        Дві локації будуть відображені в формі сердець поруч одне з одним
                                    </p>
                                </div>
                            )}

                            {/* STEP 2: PERSONALIZE */}
                            {currentStep === 2 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Персоналізація</h3>

                                    {/* Names */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Імена (макс. 25 символів)
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={25}
                                            value={config.names}
                                            onChange={(e) => setConfig({ ...config, names: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Анна & Давид"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {config.names.length}/25 символів
                                        </p>
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Дата
                                        </label>
                                        <input
                                            type="date"
                                            value={config.date}
                                            onChange={(e) => setConfig({ ...config, date: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Subtitle */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Підзаголовок (макс. 32 символи)
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={32}
                                            value={config.subtitle}
                                            onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Де ми зустрілись і де одружились"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {config.subtitle.length}/32 символи
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: DESIGN */}
                            {currentStep === 3 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Дизайн</h3>

                                    {/* Color Scheme */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Колірна схема
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {(Object.keys(colorSchemes) as Array<keyof typeof colorSchemes>).map((scheme) => (
                                                <button
                                                    key={scheme}
                                                    onClick={() => handleColorSchemeChange(scheme)}
                                                    className={`p-3 rounded-lg border-2 transition-all ${
                                                        config.colorScheme === scheme
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div
                                                        className="w-full h-12 rounded mb-2"
                                                        style={{ backgroundColor: colorSchemes[scheme].bg }}
                                                    >
                                                        <div
                                                            className="w-8 h-8 rounded-full mx-auto translate-y-2"
                                                            style={{ backgroundColor: colorSchemes[scheme].map }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-center font-medium">
                                                        {colorSchemes[scheme].name}
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
                            <LoveMapPreview config={config} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
