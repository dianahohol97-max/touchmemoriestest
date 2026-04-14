'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import CityMapPreview from './CityMapPreview';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';

interface CityMapConfig {
    // Step 1: Location
    location: string;
    latitude: number;
    longitude: number;
    zoom: number;
    hasValidLocation: boolean;

    // Step 2: Personalize
    title: string;
    subtitle: string;
    textNote: string;
    coordinates: string; // Auto-generated, display-only

    // Step 3: Design
    mapStyle: string;
    textColor: 'light' | 'dark';
    layout: 'original' | 'modern' | 'no-text' | 'circle' | 'heart' | 'square-border';
    border: 'simple-frame' | 'white-mat' | 'no-border';
    orientation: 'portrait' | 'landscape';
    fontFamily: string;

    // Step 4: Size & Product
    size: string;
    productType: string;
    price: number;
}

export default function CityMapConstructor() {
    const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [config, setConfig] = useState<CityMapConfig>({
        // Step 1 defaults - Kyiv
        location: 'Київ, Україна',
        latitude: 50.4501,
        longitude: 30.5234,
        zoom: 12,
        hasValidLocation: true,

        // Step 2 defaults
        title: 'Київ',
        subtitle: 'Україна',
        textNote: '',
        coordinates: '50.4501° N, 30.5234° E',

        // Step 3 defaults
        mapStyle: 'classic-bw',
        textColor: 'light',
        layout: 'original',
        border: 'simple-frame',
        orientation: 'portrait',
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
                .eq('slug', 'poster-city-map')
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

    // Auto-generate coordinates string
    useEffect(() => {
        const latDir = config.latitude >= 0 ? 'N' : 'S';
        const lonDir = config.longitude >= 0 ? 'E' : 'W';
        setConfig(prev => ({
            ...prev,
            coordinates: `${Math.abs(config.latitude).toFixed(4)}° ${latDir}, ${Math.abs(config.longitude).toFixed(4)}° ${lonDir}`
        }));
    }, [config.latitude, config.longitude]);

    // Auto-switch text color based on map style
    useEffect(() => {
        if (config.mapStyle === 'dark-mode' || config.mapStyle === 'blueprint') {
            setConfig(prev => ({ ...prev, textColor: 'dark' }));
        } else {
            setConfig(prev => ({ ...prev, textColor: 'light' }));
        }
    }, [config.mapStyle]);

    const handleAddToCart = () => {
        if (!product) {
            toast.error('Продукт не знайдено');
            return;
        }

        if (!config.hasValidLocation) {
            toast.error('Будь ласка, оберіть локацію');
            return;
        }

        addItem({
            id: `citymap_${Date.now()}`,
            product_id: product.slug,
            name: product.name,
            price: config.price,
            qty: 1,
            image: '', // Will be generated from map
            options: {
                'Локація': config.location,
                'Розмір': config.size,
                'Тип': config.productType,
                'Стиль': config.mapStyle,
                'Макет': config.layout,
                'Орієнтація': config.orientation
            },
            slug: product.slug,
            personalization_note: `Заголовок: ${config.title}\nПідзаголовок: ${config.subtitle}\nНотатка: ${config.textNote}\nКоординати: ${config.coordinates}`
        });

        toast.success('Постер додано до кошика');
    };

    const nextStep = () => {
        if (currentStep === 1 && !config.hasValidLocation) {
            toast.error('Будь ласка, оберіть локацію');
            return;
        }
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
                            <h1 className="text-2xl font-bold text-[#1e2d7d]">Постер мапи міста</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Крок {currentStep} з 4: {
                                    currentStep === 1 ? 'Локація' :
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
                                disabled={!config.hasValidLocation}
                                className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="grid lg:grid-cols-[69%_31%] gap-6">
                    {/* Left: Map Preview */}
                    <div className="lg:sticky lg:top-24 lg:self-start order-1 lg:order-1">
                        <CityMapPreview config={config} setConfig={setConfig} />
                    </div>

                    {/* Right: Controls */}
                    <div className="bg-white rounded-lg shadow-lg p-6 order-2 lg:order-2">
                        {currentStep === 1 && (
                            <Step1Location config={config} setConfig={setConfig} />
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
                                disabled={currentStep === 4 || (currentStep === 1 && !config.hasValidLocation)}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Далі
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Step 1: Location
function Step1Location({ config, setConfig }: { config: CityMapConfig; setConfig: React.Dispatch<React.SetStateAction<CityMapConfig>> }) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Оберіть локацію</h2>
                <p className="text-gray-600 text-sm">Знайдіть своє улюблене місто або локацію</p>
            </div>

            {/* Location Search */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Пошук міста <span className="text-red-500">*</span>
                </label>
                <GooglePlacesAutocomplete
                    value={config.location}
                    onChange={(location, lat, lon) => {
                        if (lat && lon) {
                            // Extract city name and country for title/subtitle
                            const parts = location.split(',');
                            const cityName = parts[0]?.trim() || location;
                            const country = parts[parts.length - 1]?.trim() || '';

                            setConfig({
                                ...config,
                                location,
                                latitude: lat,
                                longitude: lon,
                                title: cityName,
                                subtitle: country,
                                hasValidLocation: true
                            });
                        } else {
                            setConfig({
                                ...config,
                                location
                            });
                        }
                    }}
                    placeholder="Почніть вводити назву міста..."
                />
                <p className="text-xs text-gray-500 mt-1">
                    Після вибору ви можете налаштувати вигляд на карті
                </p>
            </div>

            {/* Zoom Level */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Масштаб
                </label>
                <input
                    type="range"
                    min="5"
                    max="18"
                    value={config.zoom}
                    onChange={(e) => setConfig({ ...config, zoom: parseInt(e.target.value) })}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Віддалений</span>
                    <span>Zoom: {config.zoom}</span>
                    <span>Близький</span>
                </div>
            </div>

            {/* Coordinates Display */}
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs font-medium text-gray-600 mb-1">Координати (автоматично):</div>
                <div className="text-sm font-mono text-gray-900">{config.coordinates}</div>
            </div>

            {!config.hasValidLocation && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-800">
                        Будь ласка, оберіть локацію зі списку автодоповнення
                    </p>
                </div>
            )}
        </div>
    );
}

// Step 2: Personalize
function Step2Personalize({ config, setConfig }: { config: CityMapConfig; setConfig: React.Dispatch<React.SetStateAction<CityMapConfig>> }) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Персоналізація</h2>
                <p className="text-gray-600 text-sm">Додайте текст до вашого постера</p>
            </div>

            {/* Title */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Заголовок
                </label>
                <input
                    type="text"
                    value={config.title}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    placeholder="Київ"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                />
            </div>

            {/* Subtitle */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Підзаголовок
                </label>
                <input
                    type="text"
                    value={config.subtitle}
                    onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                    placeholder="Україна"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                />
            </div>

            {/* Text Note */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Додаткова нотатка (необов'язково)
                </label>
                <textarea
                    value={config.textNote}
                    onChange={(e) => setConfig({ ...config, textNote: e.target.value })}
                    placeholder="Наприклад: 'Наш улюблений куточок світу'"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent resize-none"
                />
            </div>

            {/* Coordinates Display */}
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs font-medium text-gray-600 mb-1">Координати (автоматично):</div>
                <div className="text-sm font-mono text-gray-900">{config.coordinates}</div>
            </div>
        </div>
    );
}

// Step 3: Design
function Step3Design({ config, setConfig }: { config: CityMapConfig; setConfig: React.Dispatch<React.SetStateAction<CityMapConfig>> }) {
    const mapStyles = [
        { id: 'classic-bw',    name: 'Simple',   bg: '#ffffff', roads: '#333333', water: '#c8d8e8', park: '#e0e8d8' },
        { id: 'smooth-light',  name: 'Modern',   bg: '#f5f5f5', roads: '#888888', water: '#b8cfe0', park: '#d4e4cc' },
        { id: 'dark-mode',     name: 'Black',    bg: '#1a1a2e', roads: '#e0e0e0', water: '#16213e', park: '#0f3460' },
        { id: 'color-outdoors',name: 'Blue',     bg: '#ddeeff', roads: '#3366cc', water: '#aaccff', park: '#99cc88' },
        { id: 'vintage-sepia', name: 'Tender',   bg: '#f9f0e0', roads: '#c8a87a', water: '#d4c4a0', park: '#e0d4b0' },
        { id: 'blueprint',     name: 'Blueprint',bg: '#1a3a5c', roads: '#ffffff', water: '#0d2540', park: '#1a4a3c' },
        { id: 'vintage-red',   name: 'Red',      bg: '#fff5f5', roads: '#cc3333', water: '#ffcccc', park: '#ffeeee' },
        { id: 'forest-green',  name: 'Leaf',     bg: '#f0f5ec', roads: '#4a7c59', water: '#b8d4c8', park: '#c8e0b8' },
        { id: 'harvest',       name: 'Harvest',  bg: '#fdf0e0', roads: '#c8742a', water: '#e8c898', park: '#d4b870' },
        { id: 'bayside',       name: 'Bayside',  bg: '#e0f5f5', roads: '#008888', water: '#80d4d4', park: '#b0e8d8' },
        { id: 'plum',          name: 'Plum',     bg: '#f5e8f5', roads: '#6a1a7a', water: '#d0a8e0', park: '#e0c8e8' },
        { id: 'paste',         name: 'Paste',    bg: '#fafaf0', roads: '#a0b890', water: '#c8e0d0', park: '#d0e8c0' },
    ];

    const layouts = [
        { id: 'original', name: 'Оригінальний', desc: 'Карта 75%, текст знизу' },
        { id: 'modern', name: 'Сучасний', desc: 'Повна карта, текст поверх' },
        { id: 'no-text', name: 'Без тексту', desc: 'Тільки карта' },
        { id: 'circle', name: 'Круг', desc: 'Карта в колі' },
        { id: 'heart', name: 'Серце', desc: 'Карта у формі серця' },
        { id: 'square-border', name: 'Квадрат з рамкою', desc: 'З внутрішньою рамкою' }
    ];

    const borders = [
        { id: 'simple-frame', name: 'Проста рамка' },
        { id: 'white-mat', name: 'Біле паспарту' },
        { id: 'no-border', name: 'Без рамки' }
    ];

    const fonts = ['Georgia', 'Playfair Display', 'Lora', 'Montserrat', 'Roboto', 'Open Sans', 'Raleway', 'Cormorant Garamond'];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Дизайн</h2>
                <p className="text-gray-600 text-sm">Оберіть стиль та макет</p>
            </div>

            {/* Map Style — circular swatches */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Стиль карти</label>
                <div className="grid grid-cols-4 gap-4">
                    {mapStyles.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => setConfig({ ...config, mapStyle: style.id as any })}
                            className="flex flex-col items-center gap-1.5 group"
                        >
                            <div className={`w-14 h-14 rounded-full overflow-hidden transition-all relative ${
                                config.mapStyle === style.id
                                    ? 'ring-3 ring-[#1e2d7d] ring-offset-2 scale-110'
                                    : 'ring-2 ring-gray-200 hover:ring-gray-400 hover:scale-105'
                            }`} style={{ background: style.bg }}>
                                {/* Mini map preview */}
                                <svg viewBox="0 0 56 56" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
                                    {/* Water */}
                                    <ellipse cx="38" cy="12" rx="14" ry="8" fill={style.water} opacity="0.8"/>
                                    {/* Park */}
                                    <rect x="4" y="28" width="18" height="14" rx="2" fill={style.park} opacity="0.7"/>
                                    {/* Roads */}
                                    <line x1="0" y1="28" x2="56" y2="28" stroke={style.roads} strokeWidth="1.5"/>
                                    <line x1="28" y1="0" x2="28" y2="56" stroke={style.roads} strokeWidth="1.5"/>
                                    <line x1="0" y1="38" x2="56" y2="18" stroke={style.roads} strokeWidth="0.8" opacity="0.6"/>
                                    <line x1="10" y1="0" x2="10" y2="56" stroke={style.roads} strokeWidth="0.8" opacity="0.5"/>
                                    <line x1="44" y1="0" x2="44" y2="56" stroke={style.roads} strokeWidth="0.8" opacity="0.5"/>
                                </svg>
                                {config.mapStyle === style.id && (
                                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                        <div style={{ width:16, height:16, borderRadius:'50%', background:'#1e2d7d', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <span className={`text-xs font-medium ${config.mapStyle === style.id ? 'text-[#1e2d7d]' : 'text-gray-600'}`}>
                                {style.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Layout */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Макет</label>
                <div className="space-y-2">
                    {layouts.map((layout) => (
                        <button
                            key={layout.id}
                            onClick={() => setConfig({ ...config, layout: layout.id as any })}
                            className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                                config.layout === layout.id
                                    ? 'border-[#1e2d7d] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">{layout.name}</div>
                                    <div className="text-xs text-gray-500">{layout.desc}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Border */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Рамка</label>
                <div className="grid grid-cols-3 gap-2">
                    {borders.map((border) => (
                        <button
                            key={border.id}
                            onClick={() => setConfig({ ...config, border: border.id as any })}
                            className={`p-3 border-2 rounded-lg text-center transition-all ${
                                config.border === border.id
                                    ? 'border-[#1e2d7d] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="text-xs font-medium text-gray-900">{border.name}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Orientation */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Орієнтація</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setConfig({ ...config, orientation: 'portrait' })}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                            config.orientation === 'portrait'
                                ? 'border-[#1e2d7d] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold text-gray-900">Вертикальна</div>
                    </button>
                    <button
                        onClick={() => setConfig({ ...config, orientation: 'landscape' })}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                            config.orientation === 'landscape'
                                ? 'border-[#1e2d7d] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold text-gray-900">Горизонтальна</div>
                    </button>
                </div>
            </div>

            {/* Font */}
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

            {/* Text Color Override */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Колір тексту</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setConfig({ ...config, textColor: 'light' })}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                            config.textColor === 'light'
                                ? 'border-[#1e2d7d] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold text-gray-900">Темний текст</div>
                        <div className="text-xs text-gray-500">На світлому фоні</div>
                    </button>
                    <button
                        onClick={() => setConfig({ ...config, textColor: 'dark' })}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                            config.textColor === 'dark'
                                ? 'border-[#1e2d7d] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold text-gray-900">Світлий текст</div>
                        <div className="text-xs text-gray-500">На темному фоні</div>
                    </button>
                </div>
            </div>
        </div>
    );
}

// Step 4: Size & Product
function Step4SizeProduct({ config, setConfig, product }: { config: CityMapConfig; setConfig: React.Dispatch<React.SetStateAction<CityMapConfig>>; product: any }) {
    const sizes = [
        { name: '30×40 см', price: 450 },
        { name: '50×70 см', price: 750 },
        { name: '60×90 см', price: 950 }
    ];

    const productTypes = [
        { name: 'Постер', priceModifier: 0 },
        { name: 'В рамці', priceModifier: 300 },
        { name: 'Полотно', priceModifier: 500 }
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
