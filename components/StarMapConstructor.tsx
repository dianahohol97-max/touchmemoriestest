'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import StarMapPreview from './StarMapPreview';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';

interface StarMapConfig {
    // Step 1: Moment
    date: string;
    time: string;
    location: string;
    latitude: number;
    longitude: number;

    // Step 2: Personalize
    headline: string;
    subtitle: string;
    dedication: string;

    // Step 3: Design
    style: 'classic-dark' | 'light-minimal' | 'circular' | 'full-bleed' | 'with-horizon';
    backgroundColor: string;
    starColor: string;
    textColor: string;
    fontFamily: string;

    // Step 4: Size & Product
    size: string;
    productType: string;
    price: number;
}

export default function StarMapConstructor() {
    const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [config, setConfig] = useState<StarMapConfig>({
        // Step 1 defaults
        date: new Date().toISOString().split('T')[0],
        time: '00:00',
        location: 'Київ, Україна',
        latitude: 50.4501,
        longitude: 30.5234,

        // Step 2 defaults
        headline: 'Ніч, коли ми зустрілись',
        subtitle: '',
        dedication: '',

        // Step 3 defaults
        style: 'classic-dark',
        backgroundColor: '#0a1128',
        starColor: '#ffffff',
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
                .eq('slug', 'star-map-poster')
                .eq('is_active', true)
                .single();

            if (data) {
                setProduct(data);
                setConfig(prev => ({
                    ...prev,
                    price: data.price || 0
                }));
            }
            setLoading(false);
        }
        fetchProduct();
    }, [supabase]);

    // Update subtitle when date/time/location changes
    useEffect(() => {
        if (config.date && config.location) {
            const dateObj = new Date(config.date);
            const formattedDate = dateObj.toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            setConfig(prev => ({
                ...prev,
                subtitle: `${formattedDate}, ${config.location.split(',')[0]}`
            }));
        }
    }, [config.date, config.location]);

    const handleAddToCart = () => {
        if (!product) {
            toast.error('Продукт не знайдено');
            return;
        }

        addItem({
            id: `starmap_${Date.now()}`,
            product_id: product.slug,
            name: product.name,
            price: config.price,
            qty: 1,
            image: '', // Will be generated from canvas
            options: {
                'Дата': config.date,
                'Час': config.time,
                'Локація': config.location,
                'Розмір': config.size,
                'Тип': config.productType,
                'Стиль': config.style
            },
            slug: product.slug,
            personalization_note: `Заголовок: ${config.headline}\nПідзаголовок: ${config.subtitle}\nДедикація: ${config.dedication}`
        });

        toast.success('Постер додано до кошика');
    };

    const nextStep = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-gray-500">Завантаження...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[#1e2d7d]">Постер зоряного неба</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Крок {currentStep} з 4: {
                                    currentStep === 1 ? 'Момент' :
                                    currentStep === 2 ? 'Персоналізація' :
                                    currentStep === 3 ? 'Дизайн' :
                                    'Розмір та продукт'
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm text-gray-600">Вартість:</div>
                                <div className="text-2xl font-bold text-[#1e2d7d]">{config.price} ₴</div>
                            </div>
                            <button
                                onClick={handleAddToCart}
                                className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                Додати до кошика
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex gap-2 mt-4">
                        {[1, 2, 3, 4].map((step) => (
                            <div
                                key={step}
                                className={`flex-1 h-2 rounded-full transition-colors ${
                                    step <= currentStep ? 'bg-[#1e2d7d]' : 'bg-gray-200'
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Left: Controls */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        {currentStep === 1 && (
                            <Step1Moment config={config} setConfig={setConfig} />
                        )}
                        {currentStep === 2 && (
                            <Step2Personalize config={config} setConfig={setConfig} />
                        )}
                        {currentStep === 3 && (
                            <Step3Design config={config} setConfig={setConfig} />
                        )}
                        {currentStep === 4 && (
                            <Step4SizeProduct config={config} setConfig={setConfig} product={product} />
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                            <button
                                onClick={prevStep}
                                disabled={currentStep === 1}
                                className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Назад
                            </button>
                            <button
                                onClick={nextStep}
                                disabled={currentStep === 4}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Далі
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div className="lg:sticky lg:top-24 lg:self-start">
                        <StarMapPreview config={config} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Step 1: Moment
function Step1Moment({ config, setConfig }: { config: StarMapConfig; setConfig: React.Dispatch<React.SetStateAction<StarMapConfig>> }) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Оберіть момент</h2>
                <p className="text-gray-600 text-sm">Вкажіть дату, час та місце для вашого зоряного неба</p>
            </div>

            {/* Date Picker */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дата <span className="text-red-500">*</span>
                </label>
                <input
                    type="date"
                    value={config.date}
                    onChange={(e) => setConfig({ ...config, date: e.target.value })}
                    min="1901-01-01"
                    max="2026-12-31"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                />
            </div>

            {/* Time Picker */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Час (необов'язково)
                </label>
                <input
                    type="time"
                    value={config.time}
                    onChange={(e) => setConfig({ ...config, time: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                />
            </div>

            {/* Location Input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Локація <span className="text-red-500">*</span>
                </label>
                <GooglePlacesAutocomplete
                    value={config.location}
                    onChange={(location, lat, lon) => {
                        setConfig({
                            ...config,
                            location,
                            latitude: lat || config.latitude,
                            longitude: lon || config.longitude
                        });
                    }}
                    placeholder="Київ, Україна"
                />
                <p className="text-xs text-gray-500 mt-1">Почніть вводити адресу для автодоповнення</p>
            </div>
        </div>
    );
}

// Step 2: Personalize
function Step2Personalize({ config, setConfig }: { config: StarMapConfig; setConfig: React.Dispatch<React.SetStateAction<StarMapConfig>> }) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Персоналізація</h2>
                <p className="text-gray-600 text-sm">Додайте особистий текст до вашого постера</p>
            </div>

            {/* Headline */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Заголовок
                </label>
                <input
                    type="text"
                    value={config.headline}
                    onChange={(e) => setConfig({ ...config, headline: e.target.value })}
                    placeholder="Ніч, коли ми зустрілись"
                    maxLength={50}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">{config.headline.length}/50 символів</p>
            </div>

            {/* Subtitle */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Підзаголовок / Дата
                </label>
                <input
                    type="text"
                    value={config.subtitle}
                    onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                    placeholder="15 грудня 2018, Київ"
                    maxLength={60}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">{config.subtitle.length}/60 символів</p>
            </div>

            {/* Dedication */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дедикація (необов'язково)
                </label>
                <textarea
                    value={config.dedication}
                    onChange={(e) => setConfig({ ...config, dedication: e.target.value })}
                    placeholder="Додайте особливе послання... Підтримуються емодзі ❤️"
                    maxLength={200}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">{config.dedication.length}/200 символів</p>
            </div>
        </div>
    );
}

// Step 3: Design
function Step3Design({ config, setConfig }: { config: StarMapConfig; setConfig: React.Dispatch<React.SetStateAction<StarMapConfig>> }) {
    const styles = [
        { id: 'classic-dark', name: 'Класичний темний', bg: '#0a1128', star: '#ffffff', text: '#ffffff' },
        { id: 'light-minimal', name: 'Світлий мінімалізм', bg: '#f5f5f0', star: '#1a1a1a', text: '#1a1a1a' },
        { id: 'circular', name: 'Кругова карта', bg: '#0a1128', star: '#ffffff', text: '#ffffff' },
        { id: 'full-bleed', name: 'На весь постер', bg: '#0a1128', star: '#ffffff', text: '#ffffff' },
        { id: 'with-horizon', name: 'З горизонтом', bg: '#0a1128', star: '#ffffff', text: '#ffffff' }
    ];

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

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Дизайн</h2>
                <p className="text-gray-600 text-sm">Оберіть стиль та кольорову схему</p>
            </div>

            {/* Style Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Стиль постера</label>
                <div className="grid grid-cols-2 gap-3">
                    {styles.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => setConfig({
                                ...config,
                                style: style.id as any,
                                backgroundColor: style.bg,
                                starColor: style.star,
                                textColor: style.text
                            })}
                            className={`p-4 border-2 rounded-lg text-left transition-all ${
                                config.style === style.id
                                    ? 'border-[#1e2d7d] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div
                                className="w-full h-16 rounded mb-2"
                                style={{ backgroundColor: style.bg }}
                            />
                            <div className="text-sm font-medium text-gray-900">{style.name}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Color Scheme */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Кольорова схема</label>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Фон</label>
                        <input
                            type="color"
                            value={config.backgroundColor}
                            onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Зірки</label>
                        <input
                            type="color"
                            value={config.starColor}
                            onChange={(e) => setConfig({ ...config, starColor: e.target.value })}
                            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Текст</label>
                        <input
                            type="color"
                            value={config.textColor}
                            onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Font Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Шрифт</label>
                <select
                    value={config.fontFamily}
                    onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                >
                    {fonts.map((font) => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                            {font}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

// Step 4: Size & Product
function Step4SizeProduct({ config, setConfig, product }: { config: StarMapConfig; setConfig: React.Dispatch<React.SetStateAction<StarMapConfig>>; product: any }) {
    const sizes = [
        { name: '30×40 см', price: 450 },
        { name: '50×70 см', price: 750 },
        { name: '60×90 см', price: 950 }
    ];

    const productTypes = [
        { name: 'Постер', priceModifier: 0 },
        { name: 'В рамці', priceModifier: 300 },
        { name: 'Метал', priceModifier: 500 }
    ];

    useEffect(() => {
        const sizeData = sizes.find(s => s.name === config.size);
        const typeData = productTypes.find(t => t.name === config.productType);

        const basePrice = sizeData?.price || 450;
        const modifier = typeData?.priceModifier || 0;

        setConfig(prev => ({ ...prev, price: basePrice + modifier }));
    }, [config.size, config.productType]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Розмір та продукт</h2>
                <p className="text-gray-600 text-sm">Оберіть розмір та тип продукту</p>
            </div>

            {/* Size Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Розмір</label>
                <div className="grid grid-cols-3 gap-3">
                    {sizes.map((size) => (
                        <button
                            key={size.name}
                            onClick={() => setConfig({ ...config, size: size.name })}
                            className={`p-4 border-2 rounded-lg text-center transition-all ${
                                config.size === size.name
                                    ? 'border-[#1e2d7d] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="text-sm font-semibold text-gray-900">{size.name}</div>
                            <div className="text-xs text-gray-600 mt-1">{size.price} ₴</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Type Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Тип продукту</label>
                <div className="space-y-3">
                    {productTypes.map((type) => (
                        <button
                            key={type.name}
                            onClick={() => setConfig({ ...config, productType: type.name })}
                            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                                config.productType === type.name
                                    ? 'border-[#1e2d7d] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-900">{type.name}</div>
                                <div className="text-sm text-gray-600">
                                    {type.priceModifier > 0 ? `+${type.priceModifier} ₴` : 'базова ціна'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
