'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Type, Image as ImageIcon, QrCode, Layers, Plus } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import ExportProgressModal from './ExportProgressModal';
import { uploadOrderFile } from '@/lib/export-utils';
import { QRCodeGenerator } from '@/components/ui/QRCodeGenerator';

interface GuestBookConfig {
    // Step 1: Design
    template: string;
    theme: 'wedding' | 'birthday' | 'baby-shower' | 'universal' | '';
    style: 'floral' | 'minimal' | 'typographic' | 'illustrated' | '';
    color: string;

    // Step 2 & 3: Cover customization
    frontCover: CoverElements;
    backCover: CoverElements;

    // Step 4: Interior
    interiorType: 'blank' | 'lined' | 'prompted';
    pageCount: number;

    // Step 5: Product
    size: string;
    price: number;
}

interface CoverElements {
    texts: TextElement[];
    images: ImageElement[];
    qrCodes: QRElement[];
}

interface TextElement {
    id: string;
    content: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    textAlign: 'left' | 'center' | 'right';
    letterSpacing: number;
    lineHeight: number;
}

interface ImageElement {
    id: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface QRElement {
    id: string;
    url: string;
    x: number;
    y: number;
    size: number;
}

const DESIGN_TEMPLATES = [
    // Весілля (Wedding)
    { id: 'wedding-floral-1', name: 'Наше весілля', theme: 'wedding', style: 'floral', color: 'зелений' },
    { id: 'wedding-floral-2', name: 'Mr & Mrs', theme: 'wedding', style: 'floral', color: 'рожевий' },
    { id: 'wedding-minimal-1', name: 'Наш особливий день', theme: 'wedding', style: 'minimal', color: 'білий' },
    { id: 'wedding-typographic-1', name: 'Монограма', theme: 'wedding', style: 'typographic', color: 'золотий' },
    { id: 'wedding-greenery-1', name: 'Зелень і евкаліпт', theme: 'wedding', style: 'floral', color: 'зелений' },

    // День народження (Birthday)
    { id: 'birthday-colorful-1', name: 'З днем народження', theme: 'birthday', style: 'illustrated', color: 'рожевий' },
    { id: 'birthday-modern-1', name: '30 і прекрасна', theme: 'birthday', style: 'minimal', color: 'синій' },

    // Baby Shower
    { id: 'baby-soft-1', name: 'Baby Shower', theme: 'baby-shower', style: 'illustrated', color: 'рожевий' },
    { id: 'baby-soft-2', name: 'Ласкаво просимо, малюк', theme: 'baby-shower', style: 'illustrated', color: 'синій' },

    // Універсальний (Universal)
    { id: 'universal-minimal-1', name: 'Книга побажань', theme: 'universal', style: 'minimal', color: 'білий' },
    { id: 'universal-nature-1', name: 'Наші гості', theme: 'universal', style: 'floral', color: 'зелений' },
];

export default function GuestBookConstructor() {
    const t = useT();
    const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [coverView, setCoverView] = useState<'front' | 'back'>('front');
    const [exporting, setExporting] = useState(false);
    const [exportDone, setExportDone] = useState(false);

    const [config, setConfig] = useState<GuestBookConfig>({
        template: '',
        theme: '',
        style: '',
        color: '',
        frontCover: { texts: [], images: [], qrCodes: [] },
        backCover: { texts: [], images: [], qrCodes: [] },
        interiorType: 'blank',
        pageCount: 48,
        size: '',
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
                .eq('slug', 'guest-book')
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

    // Initialize front cover with default template texts when design is selected
    useEffect(() => {
        if (config.template && config.frontCover.texts.length === 0) {
            const defaultTexts: TextElement[] = [
                {
                    id: 'name1',
                    content: 'КАТЕРИНА',
                    x: 200,
                    y: 150,
                    fontSize: 48,
                    fontFamily: 'Playfair Display',
                    color: '#1a1a1a',
                    fontWeight: 'normal',
                    fontStyle: 'normal',
                    textAlign: 'center',
                    letterSpacing: 2,
                    lineHeight: 1.2
                },
                {
                    id: 'connector',
                    content: '&',
                    x: 200,
                    y: 220,
                    fontSize: 36,
                    fontFamily: 'Georgia',
                    color: '#1a1a1a',
                    fontWeight: 'normal',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    letterSpacing: 0,
                    lineHeight: 1.2
                },
                {
                    id: 'name2',
                    content: 'ОЛЕКСАНДР',
                    x: 200,
                    y: 280,
                    fontSize: 48,
                    fontFamily: 'Playfair Display',
                    color: '#1a1a1a',
                    fontWeight: 'normal',
                    fontStyle: 'normal',
                    textAlign: 'center',
                    letterSpacing: 2,
                    lineHeight: 1.2
                },
                {
                    id: 'date',
                    content: '14 серпня 2026',
                    x: 200,
                    y: 360,
                    fontSize: 24,
                    fontFamily: 'Lora',
                    color: '#666666',
                    fontWeight: 'normal',
                    fontStyle: 'normal',
                    textAlign: 'center',
                    letterSpacing: 1,
                    lineHeight: 1.4
                }
            ];

            setConfig(prev => ({
                ...prev,
                frontCover: { ...prev.frontCover, texts: defaultTexts }
            }));
        }
    }, [config.template]);

    const handleSelectTemplate = (templateId: string) => {
        const template = DESIGN_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            setConfig({
                ...config,
                template: templateId,
                theme: template.theme as any,
                style: template.style as any,
                color: template.color
            });
            setCurrentStep(2);
        }
    };

    const handleAddToCart = async () => {
        if (!product) {
            toast.error(t('guestbook.notFound'));
            return;
        }

        if (!config.template) {
            toast.error(t('guestbook.selectDesign'));
            return;
        }

        const cartItemId = `guestbook_${Date.now()}`;

        // Upload config JSON as print-service blueprint
        try {
            setExporting(true);
            setExportDone(false);

            const configBlob = new Blob([JSON.stringify({ config, product_slug: product.slug }, null, 2)], {
                type: 'application/json'
            });
            const filePath = `pending/${cartItemId}/guestbook_config.json`;
            await uploadOrderFile('guestbook-exports', filePath, configBlob);

            sessionStorage.setItem(`export_${cartItemId}`, JSON.stringify({
                bucket: 'guestbook-exports',
                path: filePath,
                fileName: 'guestbook_config.json',
                fileCategory: 'guestbook-config',
                size: configBlob.size,
                mimeType: 'application/json',
            }));

            setExportDone(true);
            await new Promise(r => setTimeout(r, 600));
        } catch (err) {
            console.error('GuestBook config export failed (non-blocking):', err);
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
                'Дизайн': config.template,
                'Тема': config.theme,
                'Кількість сторінок': config.pageCount.toString(),
                'Тип сторінок': config.interiorType,
                'Розмір': config.size
            },
            slug: product.slug,
            personalization_note: `Гостьова книга з ${config.pageCount} сторінками, дизайн: ${config.template}`
        });

        toast.success(t('guestbook.success'));
    };

    const nextStep = () => {
        if (currentStep < 5) setCurrentStep(currentStep + 1);
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-gray-500">{t('guestbook.loading')}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <ExportProgressModal open={exporting} current={1} total={1} done={exportDone} label="Збереження конфігурації…" />
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[#1e2d7d]">{t('guestbook.title')}</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                {t('guestbook.step').replace('{step}', String(currentStep))} {
                                    currentStep === 1 ? t('guestbook.step1') :
                                    currentStep === 2 ? t('guestbook.step2') :
                                    currentStep === 3 ? t('guestbook.backCover') :
                                    currentStep === 4 ? t('guestbook.step4') :
                                    t('guestbook.step5')
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm text-gray-600">{t('guestbook.cost')}</div>
                                <div className="text-2xl font-bold text-[#1e2d7d]">{config.price} ₴</div>
                            </div>
                            <button
                                onClick={handleAddToCart}
                                disabled={!config.template}
                                className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                {t('guestbook.addToCart')}
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex gap-2 mt-4">
                        {[1, 2, 3, 4, 5].map((step) => (
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
            {currentStep === 1 && (
                <Step1DesignSelection
                    templates={DESIGN_TEMPLATES}
                    selectedTemplate={config.template}
                    onSelectTemplate={handleSelectTemplate}
                />
            )}

            {currentStep === 2 && (
                <Step2CoverCustomization
                    config={config}
                    setConfig={setConfig}
                    coverType="front"
                    onNext={nextStep}
                    onBack={prevStep}
                />
            )}

            {currentStep === 3 && (
                <Step2CoverCustomization
                    config={config}
                    setConfig={setConfig}
                    coverType="back"
                    onNext={nextStep}
                    onBack={prevStep}
                />
            )}

            {currentStep === 4 && (
                <Step4InteriorOptions
                    config={config}
                    setConfig={setConfig}
                    onNext={nextStep}
                    onBack={prevStep}
                />
            )}

            {currentStep === 5 && (
                <>
                    {/* QR Code Generator */}
                    <div style={{ marginBottom: 12 }}><QRCodeGenerator compact label="QR-код на обкладинку" /></div>
                    <Step5SizeAndProduct
                        config={config}
                        setConfig={setConfig}
                        product={product}
                        onAddToCart={handleAddToCart}
                        onBack={prevStep}
                    />
                </>
            )}
        </div>
    );
}

// Step 1: Design Selection
function Step1DesignSelection({
    templates,
    selectedTemplate,
    onSelectTemplate
}: {
    templates: typeof DESIGN_TEMPLATES;
    selectedTemplate: string;
    onSelectTemplate: (id: string) => void;
}) {
    const t = useT();
    const [themeFilter, setThemeFilter] = useState<string>('');
    const [styleFilter, setStyleFilter] = useState<string>('');
    const [colorFilter, setColorFilter] = useState<string>('');

    const filteredTemplates = templates.filter(t => {
        if (themeFilter && t.theme !== themeFilter) return false;
        if (styleFilter && t.style !== styleFilter) return false;
        if (colorFilter && t.color !== colorFilter) return false;
        return true;
    });

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-7xl mx-auto">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4">{t('guestbook.filters')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestbook.theme')}</label>
                            <select
                                value={themeFilter}
                                onChange={(e) => setThemeFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="">{t('guestbook.allThemes')}</option>
                                <option value="wedding">{t('guestbook.wedding')}</option>
                                <option value="birthday">{t('guestbook.birthday')}</option>
                                <option value="baby-shower">Baby Shower</option>
                                <option value="universal">{t('guestbook.universal')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestbook.style')}</label>
                            <select
                                value={styleFilter}
                                onChange={(e) => setStyleFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="">{t('guestbook.allStyles')}</option>
                                <option value="floral">{t('guestbook.floral')}</option>
                                <option value="minimal">{t('guestbook.minimal')}</option>
                                <option value="typographic">{t('guestbook.typographic')}</option>
                                <option value="illustrated">{t('guestbook.illustrated')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestbook.color')}</label>
                            <select
                                value={colorFilter}
                                onChange={(e) => setColorFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="">{t('guestbook.allColors')}</option>
                                <option value="зелений">{t('guestbook.green')}</option>
                                <option value="рожевий">{t('guestbook.pink')}</option>
                                <option value="білий">{t('guestbook.white')}</option>
                                <option value="синій">{t('guestbook.blue')}</option>
                                <option value="золотий">{t('guestbook.gold')}</option>
                                <option value="чорний">{t('guestbook.black')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredTemplates.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => onSelectTemplate(template.id)}
                            className={`group relative bg-white rounded-lg shadow-lg overflow-hidden transition-all hover:shadow-xl ${
                                selectedTemplate === template.id ? 'ring-4 ring-[#1e2d7d]' : ''
                            }`}
                        >
                            <div className="aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                <div className="text-center p-4">
                                    <div className="text-2xl font-serif mb-2">{template.name}</div>
                                    <div className="text-sm text-gray-500">
                                        {template.theme} • {template.style}
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 border-t border-gray-200">
                                <h4 className="font-semibold text-sm text-gray-900">{template.name}</h4>
                                <p className="text-xs text-gray-500 mt-1">{template.color}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Step 2 & 3: Cover Customization (used for both front and back)
function Step2CoverCustomization({
    config,
    setConfig,
    coverType,
    onNext,
    onBack
}: {
    config: GuestBookConfig;
    setConfig: React.Dispatch<React.SetStateAction<GuestBookConfig>>;
    coverType: 'front' | 'back';
    onNext: () => void;
    onBack: () => void;
}) {
    const t = useT();
    const cover = coverType === 'front' ? config.frontCover : config.backCover;
    const [selectedElement, setSelectedElement] = useState<string | null>(null);

    const addText = () => {
        const newText: TextElement = {
            id: `text_${Date.now()}`,
            content: t('guestbook.newText'),
            x: 200,
            y: 200,
            fontSize: 24,
            fontFamily: 'Georgia',
            color: '#000000',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: 'center',
            letterSpacing: 0,
            lineHeight: 1.2
        };

        const updatedCover = { ...cover, texts: [...cover.texts, newText] };
        if (coverType === 'front') {
            setConfig({ ...config, frontCover: updatedCover });
        } else {
            setConfig({ ...config, backCover: updatedCover });
        }
        setSelectedElement(newText.id);
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-[1fr_400px] gap-6">
                {/* Preview */}
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <h3 className="text-lg font-semibold mb-4">
                        {coverType === 'front' ? t('guestbook.frontCover') : t('guestbook.backCover')}
                    </h3>
                    <div className="aspect-[3/4] bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-lg relative overflow-hidden">
                        {/* Render texts */}
                        {cover.texts.map((text) => (
                            <div
                                key={text.id}
                                onClick={() => setSelectedElement(text.id)}
                                className={`absolute cursor-pointer ${
                                    selectedElement === text.id ? 'ring-2 ring-[#1e2d7d]' : ''
                                }`}
                                style={{
                                    left: `${text.x}px`,
                                    top: `${text.y}px`,
                                    fontSize: `${text.fontSize}px`,
                                    fontFamily: text.fontFamily,
                                    color: text.color,
                                    fontWeight: text.fontWeight,
                                    fontStyle: text.fontStyle,
                                    textAlign: text.textAlign,
                                    letterSpacing: `${text.letterSpacing}px`,
                                    lineHeight: text.lineHeight
                                }}
                            >
                                {text.content}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tools */}
                <div className="space-y-4">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold mb-4">{t('guestbook.addElement')}</h3>
                        <div className="space-y-2">
                            <button
                                onClick={addText}
                                className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                <Type className="w-5 h-5" />
                                {t('guestbook.addText')}
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                <ImageIcon className="w-5 h-5" />
                                {t('guestbook.addImage')}
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                <QrCode className="w-5 h-5" />
                                {t('guestbook.addQRCode')}
                            </button>
                        </div>
                    </div>

                    {selectedElement && (
                        <TextPropertiesPanel
                            text={cover.texts.find(t => t.id === selectedElement)!}
                            onChange={(updatedText) => {
                                const updatedTexts = cover.texts.map(t =>
                                    t.id === selectedElement ? updatedText : t
                                );
                                const updatedCover = { ...cover, texts: updatedTexts };
                                if (coverType === 'front') {
                                    setConfig({ ...config, frontCover: updatedCover });
                                } else {
                                    setConfig({ ...config, backCover: updatedCover });
                                }
                            }}
                        />
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onBack}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            {t('guestbook.back')}
                        </button>
                        <button
                            onClick={onNext}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] transition-colors"
                        >
                            {t('guestbook.next')}
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TextPropertiesPanel({
    text,
    onChange
}: {
    text: TextElement;
    onChange: (text: TextElement) => void;
}) {
    const t = useT();
    const fonts = ['Georgia', 'Playfair Display', 'Lora', 'Montserrat', 'Roboto', 'Open Sans', 'Raleway', 'Cormorant Garamond'];

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{t('guestbook.textProperties')}</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestbook.text')}</label>
                    <input
                        type="text"
                        value={text.content}
                        onChange={(e) => onChange({ ...text, content: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestbook.font')}</label>
                    <select
                        value={text.fontFamily}
                        onChange={(e) => onChange({ ...text, fontFamily: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                        {fonts.map(font => (
                            <option key={font} value={font}>{font}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('guestbook.size')}</label>
                    <input
                        type="number"
                        value={text.fontSize}
                        onChange={(e) => onChange({ ...text, fontSize: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="8"
                        max="96"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Колір</label>
                    <input
                        type="color"
                        value={text.color}
                        onChange={(e) => onChange({ ...text, color: e.target.value })}
                        className="w-full h-10 border border-gray-300 rounded-lg"
                    />
                </div>
            </div>
        </div>
    );
}

// Step 4: Interior Options
function Step4InteriorOptions({
    config,
    setConfig,
    onNext,
    onBack
}: {
    config: GuestBookConfig;
    setConfig: React.Dispatch<React.SetStateAction<GuestBookConfig>>;
    onNext: () => void;
    onBack: () => void;
}) {
    const t = useT();
    const pageCountOptions = [48, 64, 96];

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
                <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-4">{t('guestbook.pageType')}</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setConfig({ ...config, interiorType: 'blank' })}
                            className={`p-6 border-2 rounded-lg transition-all ${
                                config.interiorType === 'blank'
                                    ? 'border-[#1e2d7d] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <h4 className="font-semibold text-gray-900 mb-2">{t('guestbook.blank')}</h4>
                            <p className="text-sm text-gray-600">{t('guestbook.blankDesc')}</p>
                        </button>
                        <button
                            onClick={() => setConfig({ ...config, interiorType: 'lined' })}
                            className={`p-6 border-2 rounded-lg transition-all ${
                                config.interiorType === 'lined'
                                    ? 'border-[#1e2d7d] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <h4 className="font-semibold text-gray-900 mb-2">{t('guestbook.lined')}</h4>
                            <p className="text-sm text-gray-600">{t('guestbook.linedDesc')}</p>
                        </button>
                        <button
                            onClick={() => setConfig({ ...config, interiorType: 'prompted' })}
                            className={`p-6 border-2 rounded-lg transition-all ${
                                config.interiorType === 'prompted'
                                    ? 'border-[#1e2d7d] bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <h4 className="font-semibold text-gray-900 mb-2">{t('guestbook.prompted')}</h4>
                            <p className="text-sm text-gray-600">{t('guestbook.promptedDesc')}</p>
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-4">{t('guestbook.pageCount')}</label>
                    <div className="grid grid-cols-3 gap-4">
                        {pageCountOptions.map((count) => (
                            <button
                                key={count}
                                onClick={() => setConfig({ ...config, pageCount: count })}
                                className={`p-4 border-2 rounded-lg text-center transition-all ${
                                    config.pageCount === count
                                        ? 'border-[#1e2d7d] bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="text-2xl font-bold text-gray-900">{count}</div>
                                <div className="text-sm text-gray-600 mt-1">{t('guestbook.pages')}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 pt-6">
                    <button
                        onClick={onBack}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        {t('guestbook.back')}
                    </button>
                    <button
                        onClick={onNext}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] transition-colors"
                    >
                        {t('guestbook.next')}
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Step 5: Size & Product
function Step5SizeAndProduct({
    config,
    setConfig,
    product,
    onAddToCart,
    onBack
}: {
    config: GuestBookConfig;
    setConfig: React.Dispatch<React.SetStateAction<GuestBookConfig>>;
    product: any;
    onAddToCart: () => void;
    onBack: () => void;
}) {
    const t = useT();
    const sizes = ['20×20 см', '25×25 см', '30×30 см'];

    useEffect(() => {
        if (!config.size && sizes.length > 0) {
            setConfig(prev => ({ ...prev, size: sizes[0] }));
        }
    }, []);

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="bg-white rounded-lg shadow-lg p-8 space-y-8">
                <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-4">{t('guestbook.selectSize')}</label>
                    <div className="grid grid-cols-3 gap-4">
                        {sizes.map((size) => (
                            <button
                                key={size}
                                onClick={() => setConfig({ ...config, size })}
                                className={`p-6 border-2 rounded-lg text-center transition-all ${
                                    config.size === size
                                        ? 'border-[#1e2d7d] bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="text-lg font-semibold text-gray-900">{size}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold text-gray-900">{t('guestbook.totalCost')}</div>
                        <div className="text-3xl font-bold text-[#1e2d7d]">{config.price} ₴</div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onBack}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        {t('guestbook.back')}
                    </button>
                    <button
                        onClick={onAddToCart}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] transition-colors text-lg font-semibold"
                    >
                        <ShoppingCart className="w-5 h-5" />
                        {t('guestbook.addToCart')}
                    </button>
                </div>
            </div>
        </div>
    );
}
