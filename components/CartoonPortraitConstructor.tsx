'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShoppingCart, Upload, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import CartoonPortraitPreview from './CartoonPortraitPreview';

interface CartoonPortraitConfig {
    // Step 1: Photo Upload
    uploadedPhoto: File | null;
    uploadedPhotoPreview: string | null;
    faceDetected: boolean | null;
    photoResolution: { width: number; height: number } | null;

    // Step 2: Style Selection
    animationStyle: 'pixar' | 'disney' | 'anime' | 'simpsons' | 'watercolor' | 'pop-art' | 'minimalist';

    // Step 3: Background
    backgroundType: 'solid' | 'gradient' | 'scene' | 'transparent';
    backgroundColor: string;
    gradientColors: [string, string];
    sceneType: 'city' | 'nature' | 'fantasy' | null;

    // Step 4: Text & Details
    captionText: string;
    fontFamily: string;
    textColor: string;
    addDate: boolean;
    addName: boolean;
    customName: string;

    // Step 5: Size & Product
    size: string;
    productType: string;
    price: number;

    // AI Generated Result
    generatedPortrait: string | null;
    isProcessing: boolean;
    processingProgress: number;
}

export default function CartoonPortraitConstructor() {
    const { addItem } = useCartStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [config, setConfig] = useState<CartoonPortraitConfig>({
        // Step 1 defaults
        uploadedPhoto: null,
        uploadedPhotoPreview: null,
        faceDetected: null,
        photoResolution: null,

        // Step 2 defaults
        animationStyle: 'pixar',

        // Step 3 defaults
        backgroundType: 'solid',
        backgroundColor: '#ffffff',
        gradientColors: ['#667eea', '#764ba2'],
        sceneType: null,

        // Step 4 defaults
        captionText: '',
        fontFamily: 'Montserrat',
        textColor: '#000000',
        addDate: false,
        addName: false,
        customName: '',

        // Step 5 defaults
        size: '30×40 см',
        productType: 'Постер',
        price: 0,

        // AI defaults
        generatedPortrait: null,
        isProcessing: false,
        processingProgress: 0
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
                .eq('slug', 'cartoon-portrait')
                .eq('is_active', true)
                .single();

            if (data) {
                setProduct(data);
                setConfig(prev => ({
                    ...prev,
                    price: data.price || 650
                }));
            }
            setLoading(false);
        }
        fetchProduct();
    }, [supabase]);

    // Animation styles with descriptions
    const animationStyles = {
        'pixar': {
            name: 'Піксар',
            description: '3D стиль Pixar',
            prompt: 'Transform this portrait photo into a Pixar 3D animation style character. Keep facial features recognizable. Clean background.'
        },
        'disney': {
            name: 'Дісней',
            description: 'Класична анімація Disney',
            prompt: 'Transform this portrait into Disney classic 2D animation style. Keep facial features recognizable.'
        },
        'anime': {
            name: 'Аніме',
            description: 'Японський аніме стиль',
            prompt: 'Transform this portrait into Japanese anime style. Keep facial features recognizable.'
        },
        'simpsons': {
            name: 'Сімпсони',
            description: 'Стиль The Simpsons',
            prompt: 'Transform this portrait into The Simpsons animation style. Yellow skin, big eyes. Keep facial features recognizable.'
        },
        'watercolor': {
            name: 'Акварель',
            description: 'Акварельний портрет',
            prompt: 'Transform this portrait into a watercolor painting style. Soft colors, artistic brush strokes. Keep facial features recognizable.'
        },
        'pop-art': {
            name: 'Поп-арт',
            description: 'Стиль Енді Воргола',
            prompt: 'Transform this portrait into Andy Warhol pop art style. Bold colors, high contrast. Keep facial features recognizable.'
        },
        'minimalist': {
            name: 'Мінімалізм',
            description: 'Мінімалістична лінія',
            prompt: 'Transform this portrait into minimalist line art style. Simple black lines on white. Keep facial features recognizable.'
        }
    };

    // Background solid colors
    const solidColors = [
        '#ffffff', '#000000', '#f0f0f0', '#ffebee', '#e3f2fd',
        '#e8f5e9', '#fff3e0', '#f3e5f5', '#fce4ec', '#e0f2f1'
    ];

    // Gradient presets
    const gradientPresets = [
        ['#667eea', '#764ba2'],
        ['#f093fb', '#f5576c'],
        ['#4facfe', '#00f2fe'],
        ['#43e97b', '#38f9d7'],
        ['#fa709a', '#fee140']
    ];

    // Font families
    const fonts = [
        'Montserrat',
        'Georgia',
        'Playfair Display',
        'Lora',
        'Roboto',
        'Open Sans',
        'Raleway',
        'Poppins'
    ];

    // Size and product type options
    const sizes = [
        { label: '30×40 см', price: 650 },
        { label: '50×70 см', price: 950 },
        { label: '60×90 см', price: 1250 }
    ];

    const productTypes = [
        { label: 'Постер', price: 0 },
        { label: 'В рамці', price: 400 },
        { label: 'На полотні', price: 600 }
    ];

    // Handle photo upload
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file type
        if (!file.type.startsWith('image/')) {
            toast.error('Будь ласка, завантажте файл зображення');
            return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Файл занадто великий. Максимальний розмір: 10MB');
            return;
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);

        // Check image resolution
        const img = new Image();
        img.onload = () => {
            const minWidth = 800;
            const minHeight = 800;

            if (img.width < minWidth || img.height < minHeight) {
                toast.error(`Мінімальна роздільна здатність: ${minWidth}×${minHeight}px`);
                URL.revokeObjectURL(previewUrl);
                return;
            }

            setConfig({
                ...config,
                uploadedPhoto: file,
                uploadedPhotoPreview: previewUrl,
                photoResolution: { width: img.width, height: img.height },
                faceDetected: true, // Simplified - in production, use face detection API
                generatedPortrait: null
            });

            toast.success('Фото завантажено успішно!');
        };

        img.onerror = () => {
            toast.error('Помилка завантаження зображення');
            URL.revokeObjectURL(previewUrl);
        };

        img.src = previewUrl;
    };

    // Handle drag & drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const fakeEvent = {
                target: { files: [file] }
            } as any;
            handlePhotoUpload(fakeEvent);
        }
    };

    // Generate AI portrait
    const handleGeneratePortrait = async () => {
        if (!config.uploadedPhoto) {
            toast.error('Будь ласка, завантажте фото');
            return;
        }

        setConfig(prev => ({ ...prev, isProcessing: true, processingProgress: 0 }));

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setConfig(prev => ({
                    ...prev,
                    processingProgress: Math.min(prev.processingProgress + 10, 90)
                }));
            }, 500);

            // TODO: Replace with actual Nano Banana API call
            // const formData = new FormData();
            // formData.append('image', config.uploadedPhoto);
            // formData.append('prompt', animationStyles[config.animationStyle].prompt);

            // const response = await fetch('YOUR_NANO_BANANA_API_ENDPOINT', {
            //     method: 'POST',
            //     headers: {
            //         'Authorization': 'Bearer YOUR_API_KEY'
            //     },
            //     body: formData
            // });

            // const result = await response.json();
            // const generatedImageUrl = result.image_url;

            // Simulate API call (3 seconds)
            await new Promise(resolve => setTimeout(resolve, 3000));

            clearInterval(progressInterval);

            // For demo: use uploaded photo as generated result
            // In production, replace with actual AI-generated image URL
            const generatedImageUrl = config.uploadedPhotoPreview;

            setConfig(prev => ({
                ...prev,
                generatedPortrait: generatedImageUrl,
                isProcessing: false,
                processingProgress: 100
            }));

            toast.success('Портрет створено успішно!');

        } catch (error) {
            console.error('Error generating portrait:', error);
            toast.error('Помилка при створенні портрету. Спробуйте ще раз.');
            setConfig(prev => ({ ...prev, isProcessing: false, processingProgress: 0 }));
        }
    };

    const calculatePrice = (): number => {
        const sizePrice = sizes.find(s => s.label === config.size)?.price || 650;
        const typePrice = productTypes.find(t => t.label === config.productType)?.price || 0;
        return sizePrice + typePrice;
    };

    const handleAddToCart = async () => {
        if (!config.generatedPortrait) {
            toast.error('Будь ласка, створіть портрет перед додаванням до кошика');
            return;
        }

        const totalPrice = calculatePrice();

        // TODO: Save generated portrait to Supabase Storage
        // const { data: uploadData } = await supabase.storage
        //     .from('generated-portraits')
        //     .upload(`${Date.now()}-portrait.png`, generatedPortraitBlob);

        addItem({
            id: `cartoon-portrait-${Date.now()}`,
            name: 'Портрет у стилі мультфільму',
            price: totalPrice,
            qty: 1,
            image: config.generatedPortrait,
            options: {
                'Розмір': config.size,
                'Тип продукту': config.productType,
                'Стиль анімації': animationStyles[config.animationStyle].name,
                'Фон': config.backgroundType === 'solid' ? 'Однотонний' :
                       config.backgroundType === 'gradient' ? 'Градієнт' :
                       config.backgroundType === 'scene' ? 'Сцена' : 'Прозорий'
            },
            personalization_note: `
Стиль: ${animationStyles[config.animationStyle].name}
Текст: ${config.captionText || '(немає)'}
Шрифт: ${config.fontFamily}
${config.addName ? `Ім'я: ${config.customName}` : ''}
${config.addDate ? `Дата: ${new Date().toLocaleDateString('uk-UA')}` : ''}
            `.trim()
        });

        toast.success('Портрет додано до кошика!');
    };

    const nextStep = () => {
        if (currentStep === 1 && !config.uploadedPhoto) {
            toast.error('Будь ласка, завантажте фото');
            return;
        }
        if (currentStep === 2 && !config.generatedPortrait) {
            toast.error('Будь ласка, створіть портрет перед переходом далі');
            return;
        }
        if (currentStep < 5) setCurrentStep(currentStep + 1);
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
                        Портрет у стилі мультфільму
                    </h1>
                    <p className="text-gray-600">
                        Перетворіть ваше фото на мультяшний портрет за допомогою AI
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-center space-x-4">
                        {[1, 2, 3, 4, 5].map((step) => (
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
                                {step < 5 && (
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
                            {currentStep === 1 && 'Крок 1: Завантаження фото'}
                            {currentStep === 2 && 'Крок 2: Вибір стилю'}
                            {currentStep === 3 && 'Крок 3: Фон'}
                            {currentStep === 4 && 'Крок 4: Текст і деталі'}
                            {currentStep === 5 && 'Крок 5: Розмір і тип'}
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel - Controls */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
                            {/* STEP 1: PHOTO UPLOAD */}
                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <Upload className="w-5 h-5 text-blue-500" />
                                        Завантажте фото
                                    </h3>

                                    {/* Upload Area */}
                                    <div
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {config.uploadedPhotoPreview ? (
                                            <div>
                                                <img
                                                    src={config.uploadedPhotoPreview}
                                                    alt="Uploaded"
                                                    className="w-full h-48 object-cover rounded-lg mb-4"
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        fileInputRef.current?.click();
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                                >
                                                    Змінити фото
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                                <p className="text-gray-700 font-medium mb-2">
                                                    Клікніть або перетягніть фото
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    JPG, PNG до 10MB
                                                </p>
                                            </>
                                        )}
                                    </div>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                    />

                                    {/* Photo Info */}
                                    {config.photoResolution && (
                                        <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                                            <p className="text-sm">
                                                <span className="font-semibold">Роздільна здатність:</span>{' '}
                                                {config.photoResolution.width}×{config.photoResolution.height}px
                                            </p>
                                            {config.faceDetected !== null && (
                                                <p className="text-sm flex items-center gap-2">
                                                    {config.faceDetected ? (
                                                        <>
                                                            <span className="text-green-600">✓</span>
                                                            <span>Обличчя виявлено</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                                                            <span className="text-orange-600">Обличчя не виявлено</span>
                                                        </>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: STYLE SELECTION */}
                            {currentStep === 2 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Оберіть стиль анімації</h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        {(Object.keys(animationStyles) as Array<keyof typeof animationStyles>).map((style) => (
                                            <button
                                                key={style}
                                                onClick={() => setConfig({ ...config, animationStyle: style, generatedPortrait: null })}
                                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                                    config.animationStyle === style
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <p className="font-medium text-sm">{animationStyles[style].name}</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {animationStyles[style].description}
                                                </p>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleGeneratePortrait}
                                        disabled={config.isProcessing || !config.uploadedPhoto}
                                        className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {config.isProcessing ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Створюємо портрет... {config.processingProgress}%
                                            </>
                                        ) : config.generatedPortrait ? (
                                            <>
                                                <RefreshCw className="w-5 h-5" />
                                                Створити ще раз
                                            </>
                                        ) : (
                                            'Створити портрет'
                                        )}
                                    </button>

                                    {/* Processing Progress */}
                                    {config.isProcessing && (
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${config.processingProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 3: BACKGROUND */}
                            {currentStep === 3 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Фон</h3>

                                    {/* Background Type Selector */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: 'solid', label: 'Однотонний' },
                                            { value: 'gradient', label: 'Градієнт' },
                                            { value: 'scene', label: 'Сцена' },
                                            { value: 'transparent', label: 'Прозорий' }
                                        ].map((type) => (
                                            <button
                                                key={type.value}
                                                onClick={() => setConfig({ ...config, backgroundType: type.value as any })}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                    config.backgroundType === type.value
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            >
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Solid Color Picker */}
                                    {config.backgroundType === 'solid' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Колір фону
                                            </label>
                                            <div className="grid grid-cols-5 gap-2 mb-3">
                                                {solidColors.map((color) => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setConfig({ ...config, backgroundColor: color })}
                                                        className={`w-full aspect-square rounded-lg border-2 transition-all ${
                                                            config.backgroundColor === color
                                                                ? 'border-blue-500 scale-110'
                                                                : 'border-gray-200'
                                                        }`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                            <input
                                                type="color"
                                                value={config.backgroundColor}
                                                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                                                className="w-full h-10 rounded border border-gray-300"
                                            />
                                        </div>
                                    )}

                                    {/* Gradient Picker */}
                                    {config.backgroundType === 'gradient' && (
                                        <div className="space-y-3">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Градієнт
                                            </label>
                                            {gradientPresets.map((gradient, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setConfig({ ...config, gradientColors: gradient as [string, string] })}
                                                    className={`w-full h-12 rounded-lg border-2 transition-all ${
                                                        JSON.stringify(config.gradientColors) === JSON.stringify(gradient)
                                                            ? 'border-blue-500'
                                                            : 'border-gray-200'
                                                    }`}
                                                    style={{
                                                        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Scene Type */}
                                    {config.backgroundType === 'scene' && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Тип сцени
                                            </label>
                                            {['city', 'nature', 'fantasy'].map((scene) => (
                                                <button
                                                    key={scene}
                                                    onClick={() => setConfig({ ...config, sceneType: scene as any })}
                                                    className={`w-full px-4 py-2 rounded-lg text-left transition-all ${
                                                        config.sceneType === scene
                                                            ? 'bg-blue-50 border-2 border-blue-500'
                                                            : 'bg-gray-50 border-2 border-gray-200'
                                                    }`}
                                                >
                                                    {scene === 'city' ? 'Місто' : scene === 'nature' ? 'Природа' : 'Фантазія'}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 4: TEXT & DETAILS */}
                            {currentStep === 4 && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900">Текст і деталі</h3>

                                    {/* Caption Text */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Підпис (опціонально)
                                        </label>
                                        <input
                                            type="text"
                                            value={config.captionText}
                                            onChange={(e) => setConfig({ ...config, captionText: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Ваш текст"
                                            maxLength={50}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {config.captionText.length}/50 символів
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

                                    {/* Text Color */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Колір тексту
                                        </label>
                                        <input
                                            type="color"
                                            value={config.textColor}
                                            onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                                            className="w-full h-10 rounded border border-gray-300"
                                        />
                                    </div>

                                    {/* Add Name */}
                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={config.addName}
                                                onChange={(e) => setConfig({ ...config, addName: e.target.checked })}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Додати ім'я</span>
                                        </label>
                                        {config.addName && (
                                            <input
                                                type="text"
                                                value={config.customName}
                                                onChange={(e) => setConfig({ ...config, customName: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2"
                                                placeholder="Ваше ім'я"
                                            />
                                        )}
                                    </div>

                                    {/* Add Date */}
                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={config.addDate}
                                                onChange={(e) => setConfig({ ...config, addDate: e.target.checked })}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Додати дату</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* STEP 5: SIZE & PRODUCT */}
                            {currentStep === 5 && (
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
                                {currentStep < 5 ? (
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
                            <CartoonPortraitPreview config={config} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
