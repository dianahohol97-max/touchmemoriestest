'use client';
import { useSearchParams } from 'next/navigation';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import StarMapPreview from './StarMapPreview';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
import ExportProgressModal from './ExportProgressModal';
import { exportCanvasAt300DPI, uploadOrderFile } from '@/lib/export-utils';
import { FONT_GROUPS, GOOGLE_FONTS_URL } from '@/lib/editor/constants';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';
import { useT } from '@/lib/i18n/context';

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
    style: 'classic-dark' | 'light-minimal' | 'circular' | 'full-bleed' | 'with-horizon' | 'heart-dark' | 'heart-light' | 'forest-peak';
    showGrid?: boolean;
    showConstellations?: boolean;
    showMilkyWay?: boolean;
    constellationLang?: 'uk' | 'en' | 'pl' | 'ro' | 'de';
    showStarNames?: boolean;
    backgroundColor: string;
    skyColor?: string;
    starColor: string;
    textColor: string;
    fontFamily: string;

    // Step 4: Size & Product
    size: string;
    productType: string;
    price: number;

    // QR Code (optional, +50 ₴ when added)
    qrUrl?: string;
    qrValue?: string;
    qrX?: number;
    qrY?: number;
    qrSize?: number;
    qrBgColor?: string;
}

export default function StarMapConstructor() {
    const t = useT();
    const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportDone, setExportDone] = useState(false);
    const previewAreaRef = useRef<HTMLDivElement>(null);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlSize = searchParams?.get('size')?.toUpperCase() || '';
    const initialStarMapSize = urlSize.includes('A3') ? 'A3 (29.7×42 см)'
        : urlSize.includes('30') ? '30×40 см'
        : 'A4 (21×29.7 см)';

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
        backgroundColor: '#050a18',
        skyColor: '#050a18',
        starColor: '#ffffff',
        textColor: '#ffffff',
        fontFamily: 'Georgia',
        showStarNames: true,

        // Step 4 defaults
        size: initialStarMapSize,
        productType: 'Постер',
        price: 0,

        // QR defaults
        qrX: 50,
        qrY: 90,
        qrSize: 12,
        qrBgColor: '#ffffff'
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
                .eq('slug', 'poster-star-map')
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

    // Price calculation: base price by size + QR surcharge
    useEffect(() => {
        const sizes: Record<string, number> = {
            'A4 (21×29.7 см)': 350,
            'A3 (29.7×42 см)': 450,
            '30×40 см': 450,
        };
        const basePrice = sizes[config.size] ?? 450;
        const qrSurcharge = config.qrUrl ? 50 : 0;
        setConfig(prev => ({ ...prev, price: basePrice + qrSurcharge }));
    }, [config.size, config.qrUrl]);

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

    const handleAddToCart = async () => {
        if (!product) {
            toast.error(t('starmap.product_not_found'));
            return;
        }

        // Find the canvas inside the preview area
        const canvas = previewAreaRef.current?.querySelector('canvas') as HTMLCanvasElement | null;

        const cartItemId = `starmap_${Date.now()}`;

        // Export canvas at 300 DPI if available
        if (canvas && canvas.width > 0) {
            try {
                setExporting(true);
                setExportDone(false);

                const blob = await exportCanvasAt300DPI(canvas);
                const filePath = `pending/${cartItemId}/starmap_300dpi.png`;
                await uploadOrderFile('poster-exports', filePath, blob);

                // Store for checkout to link to real order_id later
                sessionStorage.setItem(`export_${cartItemId}`, JSON.stringify({
                    bucket: 'poster-exports',
                    path: filePath,
                    fileName: 'starmap_300dpi.png',
                    fileCategory: 'star-map',
                    size: blob.size,
                }));

                setExportDone(true);
                await new Promise(r => setTimeout(r, 800));
            } catch (err) {
                console.error('Export failed (non-blocking):', err);
            } finally {
                setExporting(false);
                setExportDone(false);
            }
        }

        addItem({
            id: cartItemId,
            product_id: product.slug,
            name: product.name,
            price: config.price,
            qty: 1,
            image: canvas ? canvas.toDataURL('image/jpeg', 0.7) : '',
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

        toast.success(t('starmap.add_to_cart_success'));
    };

    const nextStep = () => {
        if (currentStep < 3) setCurrentStep(currentStep + 1);
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-gray-500">{t('starmap.loading')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <ExportProgressModal open={exporting} current={1} total={1} done={exportDone} />
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-20 z-10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[#1e2d7d]">{t('starmap.product_name')}</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Крок {currentStep} з 3: {
                                    currentStep === 1 ? 'Момент' :
                                    currentStep === 2 ? 'Персоналізація' :
                                    'Дизайн'
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm text-gray-600">{t('starmap.cost_label')}</div>
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

                    {/* Step Tabs — clickable */}
                    <div className="flex gap-1 mt-4">
                        {[
                            { n: 1, label: 'Момент' },
                            { n: 2, label: 'Текст' },
                            { n: 3, label: 'Дизайн' },
                        ].map(({ n, label }) => (
                            <button
                                key={n}
                                onClick={() => setCurrentStep(n)}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${
                                    n === currentStep
                                        ? 'bg-[#1e2d7d] text-white'
                                        : n < currentStep
                                        ? 'bg-[#1e2d7d]/20 text-[#1e2d7d] hover:bg-[#1e2d7d]/30'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                            >
                                {n}. {label}
                            </button>
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

                        {/* QR Code Generator — wired to config (adds +50 ₴ when enabled) */}
                        <div style={{ marginBottom: 16 }}>
                          <QRCodeGenerator
                            compact
                            label="Додати QR-код до замовлення (+50 ₴)"
                            defaultValue={config.qrValue || ''}
                            onQRUrlChange={(url) => {
                              setConfig(prev => ({ ...prev, qrUrl: url, qrValue: url ? prev.qrValue : '' }));
                            }}
                          />
                          {config.qrUrl && (
                            <div style={{ marginTop: 10, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e2d7d' }}>QR на макеті</div>
                              <div>
                                <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11, color:'#64748b', marginBottom: 4 }}>
                                  <span>Розмір</span><span>{config.qrSize ?? 12}%</span>
                                </div>
                                <input type="range" min={5} max={40} value={config.qrSize ?? 12}
                                  onChange={e => setConfig(p => ({ ...p, qrSize: +e.target.value }))}
                                  style={{ width:'100%', accentColor:'#1e2d7d' }}/>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, color:'#64748b', marginBottom: 4 }}>Колір фону QR</div>
                                <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
                                  <input type="color" value={config.qrBgColor || '#ffffff'}
                                    onChange={e => setConfig(p => ({ ...p, qrBgColor: e.target.value }))}
                                    style={{ width: 40, height: 32, padding: 2, border:'1px solid #e2e8f0', borderRadius: 6, cursor:'pointer' }}/>
                                  <button type="button" onClick={() => setConfig(p => ({ ...p, qrBgColor: 'transparent' }))}
                                    style={{ padding:'6px 10px', fontSize: 11, fontWeight: 600, border:'1px solid #e2e8f0', borderRadius: 6, background:'#fff', cursor:'pointer', color:'#64748b' }}>
                                    Прозорий
                                  </button>
                                  <span style={{ fontSize: 10, color:'#94a3b8' }}>Тягни QR на макеті щоб посунути</span>
                                </div>
                              </div>
                              <button type="button"
                                onClick={() => setConfig(p => ({ ...p, qrUrl: undefined, qrValue: undefined }))}
                                style={{ alignSelf:'flex-start', padding:'4px 10px', fontSize: 10, fontWeight: 600, border:'1px solid #fee2e2', borderRadius: 6, background:'#fff7f7', color:'#ef4444', cursor:'pointer' }}>
                                ✕ Прибрати QR (-50 ₴)
                              </button>
                            </div>
                          )}
                        </div>

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
                            {currentStep < 3 ? (
                                <button
                                    onClick={nextStep}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] transition-colors"
                                >
                                    Далі
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleAddToCart}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors"
                                >
                                    <ShoppingCart className="w-5 h-5" />
                                    Додати до кошика
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Preview */}
                    <div className="lg:sticky lg:top-24 lg:self-start" ref={previewAreaRef}>
                        <StarMapPreview config={config} onConfigChange={(cfg) => setConfig(cfg as StarMapConfig)} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Step 1: Moment
function Step1Moment({ config, setConfig }: { config: StarMapConfig; setConfig: React.Dispatch<React.SetStateAction<StarMapConfig>> }) {
    const t = useT();
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
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('starmap.select_moment')}</h2>
                <p className="text-gray-600 text-sm">{t('starmap.moment_desc')}</p>
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
                    placeholder={t('starmap.default_location')}
                />
                <p className="text-xs text-gray-500 mt-1">{t('starmap.location_placeholder')}</p>
            </div>
        </div>
    );
}

// Step 2: Personalize
function Step2Personalize({ config, setConfig }: { config: StarMapConfig; setConfig: React.Dispatch<React.SetStateAction<StarMapConfig>> }) {
    const t = useT();
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
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('starmap.personalization_title')}</h2>
                <p className="text-gray-600 text-sm">{t('starmap.personalization_desc')}</p>
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
                    placeholder={t('starmap.sky_name')}
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
                    placeholder={t('starmap.example_date')}
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
                    placeholder={t('starmap.dedication_placeholder')}
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
    const t = useT();
    const styles = [
        { id: 'classic-dark',  name: 'Чорний класик',   bg: '#050a18', star: '#ffffff', text: '#ffffff', preview: '#050a18' },
        { id: 'light-minimal', name: 'Білий мінімалізм', bg: '#f5f5f0', star: '#0a0e1a', text: '#0a0e1a', preview: '#f5f5f0' },
        { id: 'circular',      name: 'Синій нічний',    bg: '#08122e', star: '#dce8ff', text: '#ffffff', preview: '#08122e' },
        { id: 'full-bleed',    name: 'На весь постер',  bg: '#030810', star: '#ffffff', text: '#ffffff', preview: '#030810' },
        { id: 'heart-dark',    name: 'Серце темне',     bg: '#050a18', star: '#ffffff', text: '#ffffff', preview: '#050a18' },
        { id: 'heart-light',   name: 'Серце світле',    bg: '#f5f5f0', star: '#0a0e1a', text: '#0a0e1a', preview: '#f5f5f0' },
        { id: 'forest-peak',   name: 'Ліс і гори',      bg: '#060d1f', star: '#ffffff', text: '#ffffff', preview: '#060d1f' },
    ];

    // Full font list from photobook editor (FONT_GROUPS)

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
                <h2 className="text-xl font-bold text-gray-900 mb-1">{t('starmap.design_title')}</h2>
                <p className="text-gray-500 text-sm">{t('starmap.design_subtitle')}</p>
            </div>

            {/* Style Selector */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">{t('starmap.style_label')}</label>
                <div className="grid grid-cols-2 gap-2">
                    {styles.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => setConfig({
                                ...config,
                                style: style.id as any,
                                backgroundColor: style.bg,
                                skyColor: style.bg,
                                starColor: style.star,
                                textColor: style.text
                            })}
                            className={`border-2 rounded-xl text-left transition-all overflow-hidden ${
                                config.style === style.id
                                    ? 'border-[#1e2d7d] ring-2 ring-[#1e2d7d]/20'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            {/* Mini preview */}
                            <div className="relative overflow-hidden" style={{ backgroundColor: style.bg, height: 80 }}>
                                {/* Stars — more, varied sizes */}
                                {[
                                    [8,10,3],[18,25,1.5],[32,8,2],[47,18,3],[58,12,1.5],
                                    [70,22,2],[82,8,2.5],[92,18,1],[15,45,1.5],[28,38,2],
                                    [42,50,1],[55,35,2.5],[67,48,1.5],[78,40,2],[90,55,1],
                                    [5,65,2],[20,72,1.5],[35,60,2],[50,68,1],[65,75,1.5],
                                    [80,62,2],[95,70,1],[12,85,1.5],[45,82,2],[75,88,1],
                                ].map(([x,y,r],i) => (
                                    <div key={i} style={{
                                        position:'absolute', left:`${x}%`, top:`${y}%`,
                                        width: r*2, height: r*2, borderRadius:'50%',
                                        background: style.star,
                                        opacity: 0.5 + (i%4)*0.12,
                                        transform:'translate(-50%,-50%)',
                                        boxShadow: r > 2 ? `0 0 ${r*3}px ${style.star}88` : 'none',
                                    }}/>
                                ))}
                                {/* Shape indicator */}
                                {style.id.includes('heart') ? (
                                    <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',fontSize:22,opacity:0.4}}>
                                        {style.bg.includes('f5') ? '' : ''}
                                    </div>
                                ) : style.id === 'full-bleed' ? null : (
                                    <div style={{
                                        position:'absolute', left:'50%', top:'50%',
                                        width:48, height:48, borderRadius:'50%',
                                        border: `1.5px solid ${style.star}50`,
                                        transform:'translate(-50%,-50%)',
                                    }}/>
                                )}
                                {/* Checkmark */}
                                {config.style === style.id && (
                                    <div style={{ position:'absolute',top:6,right:6,width:18,height:18,borderRadius:'50%',background:'#1e2d7d',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff' }}></div>
                                )}
                            </div>
                            <div className={`px-2 py-1.5 text-xs font-semibold ${config.style === style.id ? 'text-[#1e2d7d] bg-[#f0f3ff]' : 'text-gray-700 bg-white'}`}>
                                {style.name}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Color Scheme */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('starmap.color_scheme_label')}</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">{t('starmap.background_color_label')}</label>
                        <input
                            type="color"
                            value={config.backgroundColor}
                            onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">{t('starmap.sky_color_label')}</label>
                        <input
                            type="color"
                            value={(config as any).skyColor || config.backgroundColor}
                            onChange={(e) => setConfig({ ...config, skyColor: e.target.value } as any)}
                            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">{t('starmap.stars_color_label')}</label>
                        <input
                            type="color"
                            value={config.starColor}
                            onChange={(e) => setConfig({ ...config, starColor: e.target.value })}
                            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">{t('starmap.text_label')}</label>
                        <input
                            type="color"
                            value={config.textColor}
                            onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Font Selector — dropdown */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('starmap.font_label')}</label>
                <select
                    value={config.fontFamily}
                    onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
                    style={{ width:'100%', padding:'10px 14px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, cursor:'pointer', background:'#fff', color:'#1e2d7d', fontWeight:600 }}
                >
                    {FONT_GROUPS.map(group => (
                        <optgroup key={group.group} label={group.group}>
                            {group.fonts.map(font => (
                                <option key={font} value={font}>{font}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                <div style={{ marginTop:8, padding:'8px 14px', background:'#f0f3ff', borderRadius:8, fontFamily: config.fontFamily, fontSize:20, color:'#1e2d7d', textAlign:'center' }}>
                    Зоряне небо  Starry Sky
                </div>
            </div>

            {/* Elements Toggles */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('starmap.map_elements_label')}</label>
                <div className="flex flex-col gap-2">
                    {[
                        { key: 'showConstellations', label: "Лінії сузір'їв", default: true },
                        { key: 'showMilkyWay',      label: 'Чумацький Шлях', default: true },
                        { key: 'showStarNames',     label: 'Назви зірок', default: true },
                        { key: 'showGrid',           label: 'Координатна сітка', default: false },
                    ].map(({ key, label }) => {
                        const val = (config as any)[key] !== false;
                        return (
                            <label key={key} className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                                <span className="text-sm font-medium text-gray-700">{label}</span>
                                <button
                                    type="button"
                                    onClick={() => setConfig({ ...config, [key]: !val } as any)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${val ? 'bg-[#1e2d7d]' : 'bg-gray-200'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${val ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Constellation language selector */}
            {(config as any).showConstellations !== false && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">{t('starmap.constellation_lang_label')}</label>
                    <div className="flex flex-wrap gap-2">
                        {([
                            { value: 'uk', label: ' Українська' },
                            { value: 'en', label: ' English' },
                            { value: 'pl', label: ' Polski' },
                            { value: 'ro', label: ' Română' },
                            { value: 'de', label: ' Deutsch' },
                        ] as const).map(({ value, label }) => {
                            const current = (config as any).constellationLang || 'uk';
                            const isActive = current === value;
                            return (
                                <button key={value} type="button"
                                    onClick={() => setConfig({ ...config, constellationLang: value } as any)}
                                    className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                                        isActive
                                            ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#1e2d7d] hover:text-[#1e2d7d]'
                                    }`}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// Step 4: Size & Product
function Step4SizeProduct({ config, setConfig, product }: { config: StarMapConfig; setConfig: React.Dispatch<React.SetStateAction<StarMapConfig>>; product: any }) {
    const t = useT();
    const sizes = [
        { name: 'A4 (21×29.7 см)', price: 350 },
        { name: 'A3 (29.7×42 см)', price: 450 },
    ];

    const productTypes = [
        { name: 'Постер', priceModifier: 0 }
    ];

    useEffect(() => {
        const sizeData = sizes.find(s => s.name === config.size);
        const typeData = productTypes.find(t => t.name === config.productType);

        const basePrice = sizeData?.price || 450;
        const modifier = typeData?.priceModifier || 0;

        setConfig(prev => ({ ...prev, price: basePrice + modifier }));
    }, [config.size, config.productType]);

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
                <h2 className="text-xl font-bold text-gray-900 mb-1">{t('starmap.size_product_title')}</h2>
                <p className="text-gray-500 text-sm">{t('starmap.size_format_label')}</p>
            </div>

            {/* Size Selector */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">{t('starmap.size_label')}</label>
                <div className="grid grid-cols-2 gap-2">
                    {sizes.map((size) => {
                        const isA4 = size.name.includes('A4');
                        const isA3 = size.name.includes('A3');
                        // aspect ratio for visual preview
                        const dims: Record<string,[number,number]> = {
                            'A4 (21×29.7 см)': [21,29.7],
                            'A3 (29.7×42 см)': [29.7,42],
                            '30×40 см': [30,40],
                            '50×70 см': [50,70],
                            '60×90 см': [60,90],
                        };
                        const [pw,ph] = dims[size.name] || [30,40];
                        const maxH = 48; const maxW = 56;
                        const scale = Math.min(maxH/ph, maxW/pw);
                        const vw = Math.round(pw*scale); const vh = Math.round(ph*scale);
                        const isSelected = config.size === size.name;
                        return (
                            <button
                                key={size.name}
                                onClick={() => setConfig({ ...config, size: size.name })}
                                className={`p-3 border-2 rounded-xl text-left transition-all ${
                                    isSelected
                                        ? 'border-[#1e2d7d] bg-[#f0f3ff]'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Proportional size visual */}
                                    <div className="flex items-end justify-center" style={{width:56,height:52,flexShrink:0}}>
                                        <div style={{
                                            width:vw, height:vh,
                                            background: isSelected ? '#1e2d7d' : '#d1d5db',
                                            borderRadius:2,
                                            transition:'all 0.15s',
                                        }}/>
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${isSelected ? 'text-[#1e2d7d]' : 'text-gray-900'}`}>
                                            {size.name}
                                            {(isA4||isA3) && <span className="ml-1.5 text-xs font-normal px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{t('starmap.popular_badge')}</span>}
                                        </div>
                                        <div className={`text-sm font-semibold mt-0.5 ${isSelected ? 'text-[#1e2d7d]' : 'text-gray-500'}`}>{size.price} ₴</div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Product Type Selector — hidden (only Poster available) */}
        </div>
    );
}
