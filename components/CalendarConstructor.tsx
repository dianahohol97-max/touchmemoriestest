'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Calendar as CalendarIcon, Image as ImageIcon, Type, Settings } from 'lucide-react';
import ExportProgressModal from './ExportProgressModal';
import { uploadOrderFile } from '@/lib/export-utils';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';

interface CalendarConfig {
    productType: 'wall' | 'desk';
    template: string;
    size: string;
    orientation: 'portrait' | 'landscape';
    startingMonth: number; // 1-12 (1=January)
    language: 'uk' | 'en';
    year: number;
    price: number;
}

interface CalendarPage {
    id: string;
    type: 'cover' | 'month';
    month?: number; // For monthly pages
    photo?: string;
    layout: string;
    texts: Array<{
        id: string;
        content: string;
        x: number;
        y: number;
        fontSize: number;
        fontFamily: string;
        color: string;
        fontWeight: string;
        fontStyle: string;
    }>;
}

interface CalendarConstructorProps {
    productType: 'wall' | 'desk';
}

export default function CalendarConstructor({ productType }: CalendarConstructorProps) {
    const { addItem } = useCartStore();
    const [step, setStep] = useState<'config' | 'editor'>('config');
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [exportDone, setExportDone] = useState(false);

    const [config, setConfig] = useState<CalendarConfig>({
        productType,
        template: 'classic',
        size: productType === 'wall' ? '21×30 см' : '10×15 см',
        orientation: 'portrait',
        startingMonth: 1, // January
        language: 'uk',
        year: 2026,
        price: 0
    });

    const [pages, setPages] = useState<CalendarPage[]>([]);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        async function fetchProduct() {
            const slug = productType === 'wall' ? 'wall-calendar' : 'desk-calendar';
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('slug', slug)
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
    }, [supabase, productType]);

    // Initialize 13 pages (1 cover + 12 months) when entering editor
    useEffect(() => {
        if (step === 'editor' && pages.length === 0) {
            const newPages: CalendarPage[] = [];

            // Cover page
            newPages.push({
                id: 'cover',
                type: 'cover',
                layout: 'full',
                texts: []
            });

            // 12 monthly pages
            for (let i = 0; i < 12; i++) {
                const monthIndex = (config.startingMonth - 1 + i) % 12;
                newPages.push({
                    id: `month_${i}`,
                    type: 'month',
                    month: monthIndex + 1, // 1-12
                    layout: 'full',
                    texts: []
                });
            }

            setPages(newPages);
        }
    }, [step, config.startingMonth]);

    const handleCreateCalendar = () => {
        if (!config.template || !config.size) {
            toast.error('Будь ласка, оберіть шаблон та розмір');
            return;
        }
        setStep('editor');
    };

    const handleAddToCart = async () => {
        if (!product) {
            toast.error('Продукт не знайдено');
            return;
        }

        const cartItemId = `calendar_${Date.now()}`;
        const totalFiles = pages.length || 13; // 1 cover + 12 months

        try {
            setExporting(true);
            setExportDone(false);

            // Export each page's config as a JSON file
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const pageLabel = page.type === 'cover' ? 'cover' : `month_${String(page.month).padStart(2, '0')}`;
                const blob = new Blob([JSON.stringify({ page, config }, null, 2)], { type: 'application/json' });
                await uploadOrderFile('calendar-uploads', `pending/${cartItemId}/${pageLabel}.json`, blob);
            }

            sessionStorage.setItem(`export_${cartItemId}`, JSON.stringify({
                bucket: 'calendar-uploads',
                path: `pending/${cartItemId}/`,
                fileName: 'calendar_pages.json',
                fileCategory: 'calendar-config',
                pageCount: pages.length,
            }));

            setExportDone(true);
            await new Promise(r => setTimeout(r, 800));
        } catch (err) {
            console.error('Calendar export failed (non-blocking):', err);
        } finally {
            setExporting(false);
            setExportDone(false);
        }

        addItem({
            id: cartItemId,
            product_id: product.slug,
            name: product.name,
            price: config.price,
            qty: 1,
            image: '',
            options: {
                'Тип': productType === 'wall' ? 'Настінний' : 'Настільний',
                'Розмір': config.size,
                'Шаблон': config.template,
                'Початковий місяць': getMonthName(config.startingMonth, config.language),
                'Мова': config.language === 'uk' ? 'Українська' : 'English',
                'Рік': config.year.toString()
            },
            slug: product.slug,
            personalization_note: `Календар на ${config.year} рік, починаючи з ${getMonthName(config.startingMonth, config.language)}`
        });

        toast.success('Календар додано до кошика');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-gray-500">Завантаження...</div>
            </div>
        );
    }

    if (step === 'config') {
        return (
            <>
                <ExportProgressModal open={exporting} current={1} total={pages.length || 13} done={exportDone} label="Збереження конфігурації…" />
                <ConfigurationStep
                    config={config}
                    setConfig={setConfig}
                    productType={productType}
                    onCreateCalendar={handleCreateCalendar}
                />
            </>
        );
    }

    return (
        <>
            <ExportProgressModal open={exporting} current={1} total={pages.length || 13} done={exportDone} label="Збереження конфігурації…" />
            <EditorStep
                config={config}
                pages={pages}
                setPages={setPages}
                currentPageIndex={currentPageIndex}
                setCurrentPageIndex={setCurrentPageIndex}
                {/* QR Code Generator */}
                <div style={{ marginBottom: 12 }}><QRCodeGenerator compact label="QR-код до замовлення" /></div>

                onAddToCart={handleAddToCart}
                onBack={() => setStep('config')}
            />
        </>
    );
}

// Step 1: Configuration
function ConfigurationStep({
    config,
    setConfig,
    productType,
    onCreateCalendar
}: {
    config: CalendarConfig;
    setConfig: React.Dispatch<React.SetStateAction<CalendarConfig>>;
    productType: 'wall' | 'desk';
    onCreateCalendar: () => void;
}) {
    const templates = productType === 'wall'
        ? ['classic', 'modern', 'minimal', 'vintage', 'colorful', 'nature', 'urban', 'family', 'travel', 'business']
        : ['classic', 'modern', 'minimal', 'elegant', 'bright', 'wood', 'professional', 'photo'];

    const sizes = productType === 'wall'
        ? ['21×30 см', '30×21 см', '30×40 см', '40×30 см']
        : ['10×15 см', '15×21 см'];

    const months = [
        { value: 11, label: 'Листопад (поточний рік)' },
        { value: 12, label: 'Грудень (поточний рік)' },
        { value: 1, label: 'Січень' },
        { value: 2, label: 'Лютий' },
        { value: 3, label: 'Березень' },
        { value: 4, label: 'Квітень' }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-[#1e2d7d]">
                        {productType === 'wall' ? 'Настінний календар' : 'Настільний календар'}
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Крок 1: Конфігурація календаря</p>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
                    {/* Template Selection */}
                    <div>
                        <label className="block text-lg font-semibold text-gray-900 mb-4">
                            Оберіть шаблон <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {templates.map((template) => {
                                const templateStyles: Record<string, { bg: string; accent: string; label: string; icon: string }> = {
                                    classic:      { bg: '#f8f5f0', accent: '#2c3e7a', label: 'Classic',      icon: '📅' },
                                    modern:       { bg: '#f0f4ff', accent: '#1a1a2e', label: 'Modern',       icon: '🗓️' },
                                    minimal:      { bg: '#fafafa', accent: '#888888', label: 'Minimal',      icon: '◽' },
                                    vintage:      { bg: '#f5ede0', accent: '#8b4513', label: 'Vintage',      icon: '🍂' },
                                    colorful:     { bg: '#fff0f5', accent: '#e91e8c', label: 'Colorful',     icon: '🎨' },
                                    nature:       { bg: '#f0f7f0', accent: '#2e7d32', label: 'Nature',       icon: '🌿' },
                                    urban:        { bg: '#f0f0f0', accent: '#37474f', label: 'Urban',        icon: '🏙️' },
                                    family:       { bg: '#fff8f0', accent: '#e65100', label: 'Family',       icon: '🏡' },
                                    travel:       { bg: '#e8f4fd', accent: '#0277bd', label: 'Travel',       icon: '✈️' },
                                    business:     { bg: '#f5f5f5', accent: '#212121', label: 'Business',     icon: '💼' },
                                    elegant:      { bg: '#fdf5e6', accent: '#8d6e63', label: 'Elegant',      icon: '✨' },
                                    bright:       { bg: '#fffde7', accent: '#f57f17', label: 'Bright',       icon: '☀️' },
                                    wood:         { bg: '#efebe9', accent: '#5d4037', label: 'Wood',         icon: '🌲' },
                                    professional: { bg: '#eceff1', accent: '#546e7a', label: 'Professional', icon: '📊' },
                                    photo:        { bg: '#f3e5f5', accent: '#7b1fa2', label: 'Photo',        icon: '📷' },
                                };
                                const s = templateStyles[template] || { bg: '#f5f5f5', accent: '#1e2d7d', label: template, icon: '📅' };
                                const isSelected = config.template === template;
                                return (
                                    <button
                                        key={template}
                                        onClick={() => setConfig({ ...config, template })}
                                        className={`p-2 border-2 rounded-lg transition-all ${
                                            isSelected ? 'border-[#1e2d7d] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="aspect-[3/4] rounded mb-2 overflow-hidden relative" style={{ background: s.bg }}>
                                            {/* Header bar */}
                                            <div style={{ background: s.accent, height: '22%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: 1, opacity: 0.9 }}>
                                                    {new Date().toLocaleString('uk', { month: 'short' }).toUpperCase()} {new Date().getFullYear()}
                                                </span>
                                            </div>
                                            {/* Photo area */}
                                            <div style={{ height: '46%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', opacity: 0.7 }}>
                                                {s.icon}
                                            </div>
                                            {/* Grid days */}
                                            <div style={{ padding: '2px 4px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                                                {Array.from({ length: 21 }).map((_, i) => (
                                                    <div key={i} style={{ height: 5, borderRadius: 1, background: i % 7 === 6 ? s.accent : (s.bg === '#fafafa' ? '#ddd' : s.accent + '30'), opacity: i < 2 ? 0 : 1 }}/>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-xs font-medium text-gray-900 capitalize text-center">{s.label}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Size Selection */}
                    <div>
                        <label className="block text-lg font-semibold text-gray-900 mb-4">
                            Розмір <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {sizes.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setConfig({ ...config, size })}
                                    className={`p-4 border-2 rounded-lg text-center transition-all ${
                                        config.size === size
                                            ? 'border-[#1e2d7d] bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="text-sm font-semibold text-gray-900">{size}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Starting Month */}
                    <div>
                        <label className="block text-lg font-semibold text-gray-900 mb-4">
                            Початковий місяць <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={config.startingMonth}
                            onChange={(e) => setConfig({ ...config, startingMonth: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                        >
                            {months.map((month) => (
                                <option key={month.value} value={month.value}>
                                    {month.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Language */}
                    <div>
                        <label className="block text-lg font-semibold text-gray-900 mb-4">
                            Мова календарної сітки
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setConfig({ ...config, language: 'uk' })}
                                className={`p-4 border-2 rounded-lg text-center transition-all ${
                                    config.language === 'uk'
                                        ? 'border-[#1e2d7d] bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="text-sm font-semibold text-gray-900">Українська</div>
                            </button>
                            <button
                                onClick={() => setConfig({ ...config, language: 'en' })}
                                className={`p-4 border-2 rounded-lg text-center transition-all ${
                                    config.language === 'en'
                                        ? 'border-[#1e2d7d] bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="text-sm font-semibold text-gray-900">English</div>
                            </button>
                        </div>
                    </div>

                    {/* Year */}
                    <div>
                        <label className="block text-lg font-semibold text-gray-900 mb-4">
                            Рік календаря <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setConfig({ ...config, year: 2026 })}
                                className={`p-4 border-2 rounded-lg text-center transition-all ${
                                    config.year === 2026
                                        ? 'border-[#1e2d7d] bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="text-lg font-bold text-gray-900">2026</div>
                            </button>
                            <button
                                onClick={() => setConfig({ ...config, year: 2027 })}
                                className={`p-4 border-2 rounded-lg text-center transition-all ${
                                    config.year === 2027
                                        ? 'border-[#1e2d7d] bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="text-lg font-bold text-gray-900">2027</div>
                            </button>
                        </div>
                    </div>

                    {/* Price Display */}
                    <div className="bg-gray-50 p-6 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div className="text-lg font-semibold text-gray-900">Вартість:</div>
                            <div className="text-3xl font-bold text-[#1e2d7d]">{config.price} ₴</div>
                        </div>
                    </div>

                    {/* Create Button */}
                    <button
                        onClick={onCreateCalendar}
                        className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-[#1e2d7d] text-white rounded-lg font-semibold text-lg hover:bg-[#263a99] transition-colors"
                    >
                        Створити календар
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Step 2: Editor
function EditorStep({
    config,
    pages,
    setPages,
    currentPageIndex,
    setCurrentPageIndex,
    onAddToCart,
    onBack
}: {
    config: CalendarConfig;
    pages: CalendarPage[];
    setPages: React.Dispatch<React.SetStateAction<CalendarPage[]>>;
    currentPageIndex: number;
    setCurrentPageIndex: React.Dispatch<React.SetStateAction<number>>;
    onAddToCart: () => void;
    onBack: () => void;
}) {
    const currentPage = pages[currentPageIndex];

    if (!currentPage) {
        return <div className="flex items-center justify-center py-24">Завантаження...</div>;
    }

    const getPageLabel = (page: CalendarPage) => {
        if (page.type === 'cover') return 'Обкладинка';
        if (page.month) return getMonthName(page.month, config.language);
        return 'Сторінка';
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col">
            {/* Top Bar */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            Назад
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-white">
                                {config.productType === 'wall' ? 'Настінний календар' : 'Настільний календар'} {config.year}
                            </h1>
                            <p className="text-sm text-gray-400">{getPageLabel(currentPage)}</p>
                        </div>
                    </div>
                    <button
                        onClick={onAddToCart}
                        className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors"
                    >
                        <ShoppingCart className="w-5 h-5" />
                        Замовити ({config.price} ₴)
                    </button>
                </div>
            </div>

            {/* Main Editor */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Tools */}
                <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
                    <div className="space-y-4">
                        <EditorTool icon={<ImageIcon className="w-5 h-5" />} title="Зображення" />
                        <EditorTool icon={<Type className="w-5 h-5" />} title="Текст" />
                        <EditorTool icon={<CalendarIcon className="w-5 h-5" />} title="Шаблон" />
                        <EditorTool icon={<Settings className="w-5 h-5" />} title="Налаштування" />
                    </div>
                </div>

                {/* Center Canvas */}
                <div className="flex-1 flex items-center justify-center p-8 bg-gray-900">
                    <div className="bg-white shadow-2xl relative" style={{ width: '600px', height: '800px' }}>
                        <PageCanvas page={currentPage} config={config} />
                    </div>
                </div>

                {/* Right Sidebar - Properties */}
                <div className="w-64 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-gray-400 mb-4">ВЛАСТИВОСТІ</h3>
                    <div className="text-sm text-gray-500">
                        Оберіть елемент для редагування
                    </div>
                </div>
            </div>

            {/* Bottom Filmstrip */}
            <div className="bg-gray-800 border-t border-gray-700 p-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                        disabled={currentPageIndex === 0}
                        className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex-1 flex gap-2 overflow-x-auto">
                        {pages.map((page, index) => (
                            <button
                                key={page.id}
                                onClick={() => setCurrentPageIndex(index)}
                                className={`flex-shrink-0 relative ${
                                    currentPageIndex === index ? 'ring-2 ring-[#1e2d7d]' : ''
                                }`}
                            >
                                <div className="w-16 h-20 bg-white border border-gray-600 rounded flex items-center justify-center">
                                    <CalendarIcon className="w-8 h-8 text-gray-400" />
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-[10px] text-center py-0.5 rounded-b">
                                    {getPageLabel(page)}
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                        disabled={currentPageIndex === pages.length - 1}
                        className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditorTool({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <button className="w-full flex items-center gap-3 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
            {icon}
            <span className="text-sm font-medium">{title}</span>
        </button>
    );
}

function PageCanvas({ page, config }: { page: CalendarPage; config: CalendarConfig }) {
    if (page.type === 'cover') {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <CalendarIcon className="w-24 h-24 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-2xl font-bold text-gray-700">Обкладинка</h3>
                    <p className="text-gray-500 mt-2">Додайте фото або текст</p>
                </div>
            </div>
        );
    }

    // Monthly page with calendar grid
    return (
        <div className="w-full h-full flex flex-col">
            {/* Photo Area (70%) */}
            <div className="h-[70%] bg-gray-100 flex items-center justify-center border-b border-gray-300">
                <ImageIcon className="w-16 h-16 text-gray-300" />
            </div>

            {/* Calendar Grid (30%) */}
            <div className="h-[30%] p-4">
                <CalendarGrid month={page.month!} year={config.year} language={config.language} />
            </div>
        </div>
    );
}

function CalendarGrid({ month, year, language }: { month: number; year: number; language: 'uk' | 'en' }) {
    const dayNames = language === 'uk'
        ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="text-center">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-lg font-bold">{getMonthName(month, language)}</h4>
                <span className="text-lg font-bold">{year}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
                {dayNames.map((day, i) => (
                    <div key={i} className="font-semibold text-gray-600">{day}</div>
                ))}
                {/* Placeholder for calendar dates */}
                {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="text-gray-400 py-1">{i < 28 ? i + 1 : ''}</div>
                ))}
            </div>
        </div>
    );
}

function getMonthName(month: number, language: 'uk' | 'en'): string {
    const monthsUk = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return language === 'uk' ? monthsUk[month - 1] : monthsEn[month - 1];
}
