'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import CityMapPreview from './CityMapPreview';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
import { FONT_GROUPS, GOOGLE_FONTS_URL } from '@/lib/editor/constants';
import { useT } from '@/lib/i18n/context';

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
    layout: 'original' | 'modern' | 'no-text' | 'circle' | 'heart' | 'square-border' | 'title-bottom' | 'title-top';
    border: 'simple-frame' | 'white-mat' | 'no-border';
    orientation: 'portrait' | 'landscape';
    fontFamily: string;
    mapLang?: string;

    // Step 4: Size & Product
    size: string;
    productType: string;
    price: number;
}

export default function CityMapConstructor() {
    const t = useT();
    const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const initialCityMapSize = (() => {
        if (typeof window === 'undefined') return '30×40 см';
        const s = new URLSearchParams(window.location.search).get('size')?.toUpperCase() || '';
        if (s.includes('A4') || s === 'A4') return 'A4 (21×29.7 см)';
        if (s.includes('A3') || s === 'A3') return 'A3 (29.7×42 см)';
        if (s.includes('50') || s.includes('50X70')) return '50×70 см';
        return '30×40 см';
    })();

    const [config, setConfig] = useState<CityMapConfig>({
        // Step 1 defaults - Kyiv
        location: 'Київ, Україна',
        latitude: 50.4501,
        longitude: 30.5234,
        zoom: 14,
        hasValidLocation: true,

        // Step 2 defaults
        title: 'Київ',
        subtitle: 'Україна',
        textNote: '',
        coordinates: '50.4501° N, 30.5234° E',

        // Step 3 defaults
        mapStyle: 'stamen-toner',
        textColor: 'light',
        layout: 'title-bottom',
        border: 'simple-frame',
        orientation: 'portrait',
        fontFamily: 'Georgia',
        mapLang: 'uk',

        // Step 4 defaults
        size: initialCityMapSize,
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
            toast.error(t('citymap.product_not_found'));
            return;
        }

        if (!config.hasValidLocation) {
            toast.error(t('citymap.location_select_reminder'));
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

        toast.success(t('citymap.add_to_cart_success'));
    };

    const nextStep = () => {
        if (currentStep === 1 && !config.hasValidLocation) {
            toast.error(t('citymap.location_select_reminder'));
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
                <div className="text-gray-500">{t('citymap.loading')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-20 z-10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[#1e2d7d]">{t('citymap.main_title')}</h1>
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
                                <div className="text-sm text-gray-600">{t('citymap.cost_label')}</div>
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
                    <div className="lg:sticky lg:top-52 lg:self-start order-1 lg:order-1">
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
    const t = useT();
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('citymap.location_header')}</h2>
                <p className="text-gray-600 text-sm">{t('citymap.main_desc')}</p>
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
                    placeholder={t('citymap.location_placeholder')}
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
                    <span>{t('citymap.zoom_far')}</span>
                    <span>Zoom: {config.zoom}</span>
                    <span>{t('citymap.zoom_close')}</span>
                </div>
            </div>

            {/* Coordinates Display */}
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs font-medium text-gray-600 mb-1">{t('citymap.coordinates_label')}</div>
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
    const t = useT();
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('citymap.personalization_title')}</h2>
                <p className="text-gray-600 text-sm">{t('citymap.note_placeholder')}</p>
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
                    placeholder={t('citymap.location_city_name')}
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
                    placeholder={t('citymap.location_country')}
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
                <div className="text-xs font-medium text-gray-600 mb-1">{t('citymap.coordinates_label')}</div>
                <div className="text-sm font-mono text-gray-900">{config.coordinates}</div>
            </div>
        </div>
    );
}

// Step 3: Design
function Step3Design({ config, setConfig }: { config: CityMapConfig; setConfig: React.Dispatch<React.SetStateAction<CityMapConfig>> }) {
    const t = useT();
    const mapStyles = [
        // Poster-quality minimal styles (like Etsy bestsellers)
        { id: 'stamen-toner',  name: 'Toner',    bg: '#ffffff', roads: '#000000', water: '#cccccc', park: '#eeeeee' },
        { id: 'classic-bw',   name: 'Simple',   bg: '#ffffff', roads: '#222222', water: '#dddddd', park: '#eeeeee' },
        { id: 'stamen-toner-lite', name: 'Lite', bg: '#ffffff', roads: '#555555', water: '#dddddd', park: '#eeeeee' },
        { id: 'smooth-light', name: 'Soft',     bg: '#f5f5f0', roads: '#888888', water: '#d0d8e0', park: '#e0e4d8' },
        // Dark styles
        { id: 'dark-mode',    name: 'Black',    bg: '#111111', roads: '#ffffff', water: '#1a2030', park: '#1a2018' },
        { id: 'blueprint',    name: 'Blueprint',bg: '#0d2440', roads: '#ffffff', water: '#061828', park: '#0d2830' },
        // Warm & color styles
        { id: 'vintage-sepia',name: 'Sepia',    bg: '#f5ede0', roads: '#8b6040', water: '#d4c4a0', park: '#d8d0b0' },
        { id: 'harvest',      name: 'Harvest',  bg: '#fdf0e0', roads: '#c8742a', water: '#e8c898', park: '#d4b870' },
        { id: 'color-outdoors',name:'Blue',     bg: '#ddeeff', roads: '#3366cc', water: '#aaccff', park: '#99cc88' },
        { id: 'forest-green', name: 'Green',    bg: '#f0f5ec', roads: '#4a7c59', water: '#b8d4c8', park: '#c8e0b8' },
        { id: 'bayside',      name: 'Bayside',  bg: '#e0f5f5', roads: '#008888', water: '#80d4d4', park: '#b0e8d8' },
        { id: 'plum',         name: 'Plum',     bg: '#f5e8f5', roads: '#6a1a7a', water: '#d0a8e0', park: '#e0c8e8' },
    ];

    const layouts = [
        { id: 'title-bottom', name: 'Класичний', desc: 'Карта + назва знизу', icon: ' МІСТО' },
        { id: 'title-top', name: 'Заголовок зверху', desc: 'Назва + карта + координати', icon: 'МІСТО ' },
        { id: 'modern', name: 'Мінімалізм', desc: 'Карта на весь постер, текст поверх', icon: '' },
        { id: 'no-text', name: 'Без тексту', desc: 'Тільки карта', icon: '' },
        { id: 'circle', name: 'Круг', desc: 'Карта в колі', icon: '' },
        { id: 'heart', name: 'Серце', desc: 'Карта у формі серця', icon: '' },
    ];

    const borders = [
        { id: 'simple-frame', name: 'Проста рамка' },
        { id: 'white-mat', name: 'Біле паспарту' },
        { id: 'no-border', name: 'Без рамки' }
    ];

    // Full font list from photobook editor

    // Load Google Fonts
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = GOOGLE_FONTS_URL;
        document.head.appendChild(link);
        return () => { try { document.head.removeChild(link); } catch {} };
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('citymap.design_title')}</h2>
                <p className="text-gray-600 text-sm">{t('citymap.design_subtitle')}</p>
            </div>

            {/* Map Style — circular swatches */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.map_style_label')}</label>
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

            {/* Layout — visual mini previews */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.layout_label')}</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {layouts.map((layout) => {
                        const isActive = config.layout === layout.id;
                        return (
                            <button key={layout.id}
                                onClick={() => setConfig({ ...config, layout: layout.id as any })}
                                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'8px 4px',
                                    border: isActive ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                                    borderRadius:10, background: isActive ? '#f0f3ff' : '#fff',
                                    cursor:'pointer', transition:'all 0.15s' }}>
                                {/* Mini layout sketch */}
                                <svg viewBox="0 0 60 80" style={{ width:48, height:64 }} xmlns="http://www.w3.org/2000/svg">
                                    <rect x="0" y="0" width="60" height="80" rx="3" fill={isActive?'#e8ecff':'#f8fafc'} stroke={isActive?'#1e2d7d':'#cbd5e1'} strokeWidth="1.5"/>
                                    {layout.id === 'title-bottom' && <>
                                        {/* Map top 70% */}
                                        <rect x="3" y="3" width="54" height="54" rx="2" fill={isActive?'#c7d2fe':'#e2e8f0'}/>
                                        <line x1="3" y1="25" x2="57" y2="25" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.8"/>
                                        <line x1="20" y1="3" x2="20" y2="57" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.8"/>
                                        <line x1="40" y1="3" x2="30" y2="57" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.5" opacity="0.6"/>
                                        {/* Title bottom */}
                                        <rect x="8" y="61" width="44" height="5" rx="1" fill={isActive?'#1e2d7d':'#374151'} opacity="0.7"/>
                                        <rect x="15" y="69" width="30" height="3" rx="1" fill={isActive?'#3b52d4':'#94a3b8'} opacity="0.5"/>
                                        <rect x="20" y="74" width="20" height="2" rx="1" fill={isActive?'#3b52d4':'#94a3b8'} opacity="0.3"/>
                                    </>}
                                    {layout.id === 'title-top' && <>
                                        {/* Title top */}
                                        <rect x="8" y="5" width="44" height="5" rx="1" fill={isActive?'#1e2d7d':'#374151'} opacity="0.7"/>
                                        <rect x="15" y="12" width="30" height="3" rx="1" fill={isActive?'#3b52d4':'#94a3b8'} opacity="0.5"/>
                                        {/* Map bottom 70% */}
                                        <rect x="3" y="18" width="54" height="54" rx="2" fill={isActive?'#c7d2fe':'#e2e8f0'}/>
                                        <line x1="3" y1="38" x2="57" y2="38" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.8"/>
                                        <line x1="25" y1="18" x2="25" y2="72" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.8"/>
                                        <line x1="45" y1="18" x2="35" y2="72" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.5" opacity="0.6"/>
                                        <rect x="12" y="74" width="36" height="2" rx="1" fill={isActive?'#3b52d4':'#94a3b8'} opacity="0.3"/>
                                    </>}
                                    {layout.id === 'modern' && <>
                                        <rect x="3" y="3" width="54" height="74" rx="2" fill={isActive?'#c7d2fe':'#e2e8f0'}/>
                                        <line x1="3" y1="30" x2="57" y2="30" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.8"/>
                                        <line x1="20" y1="3" x2="20" y2="77" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.8"/>
                                        <rect x="6" y="58" width="36" height="4" rx="1" fill="#fff" opacity="0.7"/>
                                        <rect x="6" y="64" width="24" height="3" rx="1" fill="#fff" opacity="0.5"/>
                                    </>}
                                    {layout.id === 'no-text' && <>
                                        <rect x="3" y="3" width="54" height="74" rx="2" fill={isActive?'#c7d2fe':'#e2e8f0'}/>
                                        <line x1="3" y1="28" x2="57" y2="28" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.8"/>
                                        <line x1="22" y1="3" x2="22" y2="77" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.8"/>
                                        <line x1="42" y1="3" x2="35" y2="77" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.5" opacity="0.5"/>
                                    </>}
                                    {layout.id === 'circle' && <>
                                        <circle cx="30" cy="34" r="26" fill={isActive?'#c7d2fe':'#e2e8f0'} stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="1"/>
                                        <line x1="10" y1="34" x2="50" y2="34" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.7"/>
                                        <line x1="30" y1="10" x2="30" y2="58" stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="0.7"/>
                                        <rect x="10" y="66" width="40" height="4" rx="1" fill={isActive?'#1e2d7d':'#374151'} opacity="0.6"/>
                                        <rect x="18" y="72" width="24" height="3" rx="1" fill={isActive?'#3b52d4':'#94a3b8'} opacity="0.4"/>
                                    </>}
                                    {layout.id === 'heart' && <>
                                        <path d="M30 58 C30 58 6 42 6 26 C6 16 14 10 22 14 C26 16 30 20 30 20 C30 20 34 16 38 14 C46 10 54 16 54 26 C54 42 30 58 30 58Z"
                                            fill={isActive?'#c7d2fe':'#e2e8f0'} stroke={isActive?'#818cf8':'#94a3b8'} strokeWidth="1"/>
                                        <rect x="10" y="64" width="40" height="4" rx="1" fill={isActive?'#1e2d7d':'#374151'} opacity="0.6"/>
                                        <rect x="18" y="71" width="24" height="3" rx="1" fill={isActive?'#3b52d4':'#94a3b8'} opacity="0.4"/>
                                    </>}
                                </svg>
                                <span style={{ fontSize:10, fontWeight:700, color: isActive?'#1e2d7d':'#374151', textAlign:'center', lineHeight:1.3 }}>
                                    {layout.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Border */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.border_label')}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.orientation_label')}</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setConfig({ ...config, orientation: 'portrait' })}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                            config.orientation === 'portrait'
                                ? 'border-[#1e2d7d] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold text-gray-900">{t('citymap.orientation_portrait')}</div>
                    </button>
                    <button
                        onClick={() => setConfig({ ...config, orientation: 'landscape' })}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                            config.orientation === 'landscape'
                                ? 'border-[#1e2d7d] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold text-gray-900">{t('citymap.orientation_landscape')}</div>
                    </button>
                </div>
            </div>

            {/* Font — grouped visual picker */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.font_label')}</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto', paddingRight:4 }}>
                    {FONT_GROUPS.map(group => (
                        <div key={group.group}>
                            <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{group.group}</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                                {group.fonts.map(font => {
                                    const isActive = config.fontFamily === font;
                                    return (
                                        <button key={font} type="button"
                                            onClick={() => setConfig({ ...config, fontFamily: font })}
                                            style={{
                                                padding:'4px 9px', borderRadius:7, cursor:'pointer', fontSize:12,
                                                fontFamily: font,
                                                border: isActive ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                                                background: isActive ? '#f0f3ff' : '#fff',
                                                color: isActive ? '#1e2d7d' : '#374151',
                                                fontWeight: isActive ? 700 : 400,
                                            }}>
                                            {font}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Map language — city/street names on map tiles */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.map_lang_label')}</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {([
                        { code: 'uk', label: ' Укр' },
                        { code: 'en', label: ' Eng' },
                        
                        { code: 'de', label: ' Deu' },
                        { code: 'fr', label: ' Fra' },
                        { code: 'es', label: ' Esp' },
                        { code: 'it', label: ' Ita' },
                        { code: 'pl', label: ' Pol' },
                        { code: 'pt', label: ' Por' },
                        { code: 'ro', label: ' Rom' },
                        { code: 'nl', label: ' Nld' },
                        { code: 'cs', label: ' Ces' },
                        { code: 'sk', label: ' Slk' },
                        { code: 'hu', label: ' Hun' },
                        { code: 'tr', label: ' Tur' },
                        { code: 'ar', label: ' Ara' },
                        { code: 'zh', label: ' Zho' },
                        { code: 'ja', label: ' Jpn' },
                        { code: 'ko', label: ' Kor' },
                        { code: 'he', label: ' Heb' },
                        { code: 'fa', label: ' Per' },
                        { code: 'sv', label: ' Swe' },
                        { code: 'fi', label: ' Fin' },
                        { code: 'no', label: ' Nor' },
                        { code: 'da', label: ' Dan' },
                        { code: 'el', label: ' Ell' },
                        { code: 'bg', label: ' Bul' },
                        { code: 'hr', label: ' Hrv' },
                        { code: 'sr', label: ' Srp' },
                        { code: 'lt', label: ' Lit' },
                        { code: 'lv', label: ' Lav' },
                        { code: 'et', label: ' Est' },
                        { code: 'ka', label: ' Geo' },
                        { code: 'hy', label: ' Arm' },
                        { code: 'az', label: ' Aze' },
                        { code: 'kk', label: ' Kaz' },
                        { code: 'be', label: ' Bel' },
                        { code: 'vi', label: ' Vie' },
                        { code: 'th', label: ' Tha' },
                        { code: 'id', label: ' Ind' },
                        { code: 'ms', label: ' Msa' },
                    ] as const).map(({ code, label }) => {
                        const isActive = ((config as any).mapLang || 'uk') === code;
                        return (
                            <button key={code} type="button"
                                onClick={() => setConfig({ ...config, mapLang: code } as any)}
                                style={{
                                    padding:'4px 8px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight: isActive ? 700 : 400,
                                    border: isActive ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                                    background: isActive ? '#f0f3ff' : '#fff',
                                    color: isActive ? '#1e2d7d' : '#374151',
                                }}>
                                {label}
                            </button>
                        );
                    })}
                </div>
                <p style={{ fontSize:10, color:'#94a3b8', marginTop:6 }}>
                    * Написи на карті залежать від даних OpenStreetMap — деякі міста можуть мати обмежений переклад
                </p>
            </div>

            {/* Text Color Override */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.text_color_label')}</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setConfig({ ...config, textColor: 'light' })}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                            config.textColor === 'light'
                                ? 'border-[#1e2d7d] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold text-gray-900">{t('citymap.text_color_dark')}</div>
                        <div className="text-xs text-gray-500">{t('citymap.map_style_light')}</div>
                    </button>
                    <button
                        onClick={() => setConfig({ ...config, textColor: 'dark' })}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                            config.textColor === 'dark'
                                ? 'border-[#1e2d7d] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="text-sm font-semibold text-gray-900">{t('citymap.text_color_light')}</div>
                        <div className="text-xs text-gray-500">{t('citymap.map_style_dark')}</div>
                    </button>
                </div>
            </div>
        </div>
    );
}

// Step 4: Size & Product
function Step4SizeProduct({ config, setConfig, product }: { config: CityMapConfig; setConfig: React.Dispatch<React.SetStateAction<CityMapConfig>>; product: any }) {
    const t = useT();
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
                <p className="text-gray-600 text-sm">{t('citymap.size_product_title')}</p>
            </div>

            {/* Size Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.size_label')}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('citymap.product_type_label')}</label>
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
