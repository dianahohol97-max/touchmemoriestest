'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Trash2, Image as ImageIcon, ShoppingCart, ZoomIn, ZoomOut, Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';

interface PhotoData {
    id: string;
    preview: string;
    width: number;
    height: number;
    name: string;
}

interface BookConfig {
    productSlug: string;
    productName: string;
    selectedSize?: string;
    selectedPageCount: string;
    totalPrice: number;
    enableKalka?: boolean;
    enableEndpaper?: boolean;
}

interface Spread {
    id: number;
    leftPage: Page;
    rightPage: Page;
    type: 'cover' | 'content' | 'endpaper';
}

interface Page {
    number: number;
    photos: PlacedPhoto[];
    texts: PlacedText[];
    isEmpty?: boolean; // For форзац pages
}

interface PlacedPhoto {
    photoId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}

interface PlacedText {
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
    width: number;
}

// Exact print dimensions in mm (from requirements)
const SPREAD_DIMENSIONS: Record<string, { width: number; height: number; bleed: { top: number; bottom: number; left: number; right: number }; safeZone: number }> = {
    '20×20': { width: 405, height: 203, bleed: { top: 2, bottom: 2, left: 3, right: 3 }, safeZone: 10 },
    '25×25': { width: 500, height: 254, bleed: { top: 2, bottom: 2, left: 2, right: 2 }, safeZone: 10 },
    '20×30': { width: 420, height: 305, bleed: { top: 9, bottom: 8, left: 4, right: 4 }, safeZone: 10 },
    '30×20': { width: 610, height: 203, bleed: { top: 4, bottom: 4, left: 10, right: 10 }, safeZone: 10 },
    '30×30': { width: 610, height: 305, bleed: { top: 9, bottom: 8, left: 10, right: 10 }, safeZone: 10 },
    'A4': { width: 420, height: 297, bleed: { top: 5, bottom: 5, left: 10, right: 5 }, safeZone: 10 }
};

export default function BookLayoutEditor() {
    const router = useRouter();
    const { addItem } = useCartStore();
    const [config, setConfig] = useState<BookConfig | null>(null);
    const [photos, setPhotos] = useState<PhotoData[]>([]);
    const [spreads, setSpreads] = useState<Spread[]>([]);
    const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [zoom, setZoom] = useState(0.5); // 50% zoom by default
    const canvasRef = useRef<HTMLDivElement>(null);

    // Text editing state
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [editingText, setEditingText] = useState<string | null>(null);
    const [textContent, setTextContent] = useState('');
    const [fontSize, setFontSize] = useState(16);
    const [fontFamily, setFontFamily] = useState('Arial');
    const [textColor, setTextColor] = useState('#000000');
    const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
    const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
    const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');

    useEffect(() => {
        // Load configuration from Phase 1
        const configJson = sessionStorage.getItem('bookConstructorConfig');
        if (configJson) {
            const loadedConfig = JSON.parse(configJson);
            setConfig(loadedConfig);
        } else {
            toast.error('Конфігурація не знайдена');
            router.push('/order/book');
            return;
        }

        // Load photos from Phase 2
        const photosJson = sessionStorage.getItem('bookConstructorPhotos');
        if (photosJson) {
            const loadedPhotos = JSON.parse(photosJson);
            setPhotos(loadedPhotos);
        } else {
            toast.error('Фото не знайдені');
            router.push('/editor/book/upload');
            return;
        }
    }, [router]);

    useEffect(() => {
        if (!config) return;

        // Initialize spreads based on page count
        const pageCountMatch = config.selectedPageCount.match(/(\d+)/);
        const totalPages = pageCountMatch ? parseInt(pageCountMatch[0]) : 20;

        const newSpreads: Spread[] = [];

        // Cover spread
        newSpreads.push({
            id: 0,
            type: 'cover',
            leftPage: { number: -2, photos: [], texts: [] }, // Back cover
            rightPage: { number: -1, photos: [], texts: [] }  // Front cover
        });

        // Endpaper spreads (if applicable)
        if (config.enableEndpaper || config.enableKalka) {
            newSpreads.push({
                id: 1,
                type: 'endpaper',
                leftPage: { number: 0, photos: [], texts: [], isEmpty: !config.enableEndpaper },
                rightPage: { number: 1, photos: [], texts: [] }
            });
        }

        // Content spreads
        const startPage = config.enableEndpaper || config.enableKalka ? 2 : 1;
        const contentPages = totalPages - (config.enableEndpaper || config.enableKalka ? 2 : 0);

        for (let i = 0; i < contentPages; i += 2) {
            newSpreads.push({
                id: newSpreads.length,
                type: 'content',
                leftPage: { number: startPage + i, photos: [], texts: [] },
                rightPage: { number: startPage + i + 1, photos: [], texts: [] }
            });
        }

        // End endpaper (if applicable)
        if (config.enableEndpaper || config.enableKalka) {
            newSpreads.push({
                id: newSpreads.length,
                type: 'endpaper',
                leftPage: { number: totalPages, photos: [], texts: [] },
                rightPage: { number: totalPages + 1, photos: [], texts: [], isEmpty: !config.enableEndpaper }
            });
        }

        setSpreads(newSpreads);
    }, [config]);

    const getSpreadDimensions = () => {
        if (!config?.selectedSize) {
            return SPREAD_DIMENSIONS['A4'];
        }
        const sizeKey = config.selectedSize.split(' ')[0];
        return SPREAD_DIMENSIONS[sizeKey] || SPREAD_DIMENSIONS['A4'];
    };

    const handlePhotoClick = (photoId: string) => {
        setSelectedPhoto(photoId);
    };

    const handleDropOnCanvas = (e: React.DragEvent, pageType: 'left' | 'right') => {
        e.preventDefault();

        if (!selectedPhoto) return;

        const photo = photos.find(p => p.id === selectedPhoto);
        if (!photo) return;

        const spread = spreads[currentSpreadIndex];
        if (!spread) return;

        // Calculate drop position relative to canvas
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Create placed photo
        const placedPhoto: PlacedPhoto = {
            photoId: selectedPhoto,
            x: x / zoom,
            y: y / zoom,
            width: 200, // Default width
            height: 200, // Default height
            rotation: 0
        };

        // Add to appropriate page
        const newSpreads = [...spreads];
        const targetSpread = newSpreads[currentSpreadIndex];

        if (pageType === 'left') {
            targetSpread.leftPage.photos.push(placedPhoto);
        } else {
            targetSpread.rightPage.photos.push(placedPhoto);
        }

        setSpreads(newSpreads);
        toast.success('Фото додано');
    };

    const handleAddText = (pageType: 'left' | 'right') => {
        const spread = spreads[currentSpreadIndex];
        if (!spread) return;

        const newText: PlacedText = {
            id: `text_${Date.now()}`,
            content: 'Введіть текст...',
            x: 100,
            y: 100,
            fontSize: fontSize,
            fontFamily: fontFamily,
            color: textColor,
            fontWeight: fontWeight,
            fontStyle: fontStyle,
            textAlign: textAlign,
            width: 200
        };

        const newSpreads = [...spreads];
        const targetSpread = newSpreads[currentSpreadIndex];

        if (pageType === 'left') {
            targetSpread.leftPage.texts.push(newText);
        } else {
            targetSpread.rightPage.texts.push(newText);
        }

        setSpreads(newSpreads);
        setSelectedText(newText.id);
        setEditingText(newText.id);
        setTextContent(newText.content);
        toast.success('Текст додано');
    };

    const handleTextClick = (textId: string, pageType: 'left' | 'right') => {
        setSelectedText(textId);

        const spread = spreads[currentSpreadIndex];
        if (!spread) return;

        const page = pageType === 'left' ? spread.leftPage : spread.rightPage;
        const text = page.texts.find(t => t.id === textId);

        if (text) {
            setFontSize(text.fontSize);
            setFontFamily(text.fontFamily);
            setTextColor(text.color);
            setFontWeight(text.fontWeight);
            setFontStyle(text.fontStyle);
            setTextAlign(text.textAlign);
        }
    };

    const handleTextDoubleClick = (textId: string, pageType: 'left' | 'right') => {
        setEditingText(textId);

        const spread = spreads[currentSpreadIndex];
        if (!spread) return;

        const page = pageType === 'left' ? spread.leftPage : spread.rightPage;
        const text = page.texts.find(t => t.id === textId);

        if (text) {
            setTextContent(text.content);
        }
    };

    const handleTextChange = (newContent: string) => {
        setTextContent(newContent);

        if (!editingText) return;

        const newSpreads = [...spreads];
        const currentSpread = newSpreads[currentSpreadIndex];

        // Update in left or right page
        let textFound = false;

        const leftText = currentSpread.leftPage.texts.find(t => t.id === editingText);
        if (leftText) {
            leftText.content = newContent;
            textFound = true;
        }

        const rightText = currentSpread.rightPage.texts.find(t => t.id === editingText);
        if (rightText) {
            rightText.content = newContent;
            textFound = true;
        }

        if (textFound) {
            setSpreads(newSpreads);
        }
    };

    const handleTextFormatChange = (property: string, value: any) => {
        if (!selectedText) return;

        const newSpreads = [...spreads];
        const currentSpread = newSpreads[currentSpreadIndex];

        // Update in left or right page
        const leftText = currentSpread.leftPage.texts.find(t => t.id === selectedText);
        if (leftText) {
            (leftText as any)[property] = value;
        }

        const rightText = currentSpread.rightPage.texts.find(t => t.id === selectedText);
        if (rightText) {
            (rightText as any)[property] = value;
        }

        setSpreads(newSpreads);
    };

    const handleDeleteText = (textId: string, pageType: 'left' | 'right') => {
        const newSpreads = [...spreads];
        const currentSpread = newSpreads[currentSpreadIndex];

        if (pageType === 'left') {
            currentSpread.leftPage.texts = currentSpread.leftPage.texts.filter(t => t.id !== textId);
        } else {
            currentSpread.rightPage.texts = currentSpread.rightPage.texts.filter(t => t.id !== textId);
        }

        setSpreads(newSpreads);
        setSelectedText(null);
        setEditingText(null);
        toast.success('Текст видалено');
    };

    const handleTextDragStart = (e: React.DragEvent, textId: string) => {
        e.dataTransfer.setData('textId', textId);
    };

    const handleTextDrop = (e: React.DragEvent, pageType: 'left' | 'right') => {
        e.preventDefault();
        const textId = e.dataTransfer.getData('textId');
        if (!textId) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        const newSpreads = [...spreads];
        const currentSpread = newSpreads[currentSpreadIndex];

        // Update position in the correct page
        const page = pageType === 'left' ? currentSpread.leftPage : currentSpread.rightPage;
        const text = page.texts.find(t => t.id === textId);

        if (text) {
            text.x = x;
            text.y = y;
            setSpreads(newSpreads);
        }
    };

    const handleAddToCart = () => {
        if (!config) return;

        // Here you would normally upload the layout data to the server
        // For now, we'll just add the base product to cart

        addItem({
            id: `book_${Date.now()}`,
            product_id: config.productSlug,
            name: config.productName,
            price: config.totalPrice,
            qty: 1,
            image: photos[0]?.preview || '',
            options: {
                'Розмір': config.selectedSize || 'A4',
                'Кількість сторінок': config.selectedPageCount,
                'Кількість фото': photos.length.toString()
            },
            slug: config.productSlug,
            personalization_note: `Макет книги з ${photos.length} фото`
        });

        toast.success('Замовлення додано до кошика');
        router.push('/cart');
    };

    const currentSpread = spreads[currentSpreadIndex];
    const dimensions = getSpreadDimensions();

    if (!config || !currentSpread) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Завантаження...</div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-[#1e2d7d]">{config.productName}</h1>
                        <p className="text-sm text-gray-600">
                            Крок 3: Розміщення фото • {photos.length} фото завантажено
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Text Formatting Controls */}
                        {selectedText && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                                <select
                                    value={fontFamily}
                                    onChange={(e) => {
                                        setFontFamily(e.target.value);
                                        handleTextFormatChange('fontFamily', e.target.value);
                                    }}
                                    className="px-2 py-1 text-sm border border-gray-300 rounded"
                                >
                                    <option value="Arial">Arial</option>
                                    <option value="Times New Roman">Times New Roman</option>
                                    <option value="Georgia">Georgia</option>
                                    <option value="Verdana">Verdana</option>
                                    <option value="Courier New">Courier New</option>
                                </select>

                                <input
                                    type="number"
                                    value={fontSize}
                                    onChange={(e) => {
                                        const newSize = parseInt(e.target.value);
                                        setFontSize(newSize);
                                        handleTextFormatChange('fontSize', newSize);
                                    }}
                                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                                    min="8"
                                    max="72"
                                />

                                <input
                                    type="color"
                                    value={textColor}
                                    onChange={(e) => {
                                        setTextColor(e.target.value);
                                        handleTextFormatChange('color', e.target.value);
                                    }}
                                    className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                                />

                                <button
                                    onClick={() => {
                                        const newWeight = fontWeight === 'normal' ? 'bold' : 'normal';
                                        setFontWeight(newWeight);
                                        handleTextFormatChange('fontWeight', newWeight);
                                    }}
                                    className={`p-2 rounded transition-colors ${
                                        fontWeight === 'bold'
                                            ? 'bg-[#1e2d7d] text-white'
                                            : 'hover:bg-gray-200'
                                    }`}
                                >
                                    <Bold className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => {
                                        const newStyle = fontStyle === 'normal' ? 'italic' : 'normal';
                                        setFontStyle(newStyle);
                                        handleTextFormatChange('fontStyle', newStyle);
                                    }}
                                    className={`p-2 rounded transition-colors ${
                                        fontStyle === 'italic'
                                            ? 'bg-[#1e2d7d] text-white'
                                            : 'hover:bg-gray-200'
                                    }`}
                                >
                                    <Italic className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => {
                                        setTextAlign('left');
                                        handleTextFormatChange('textAlign', 'left');
                                    }}
                                    className={`p-2 rounded transition-colors ${
                                        textAlign === 'left'
                                            ? 'bg-[#1e2d7d] text-white'
                                            : 'hover:bg-gray-200'
                                    }`}
                                >
                                    <AlignLeft className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => {
                                        setTextAlign('center');
                                        handleTextFormatChange('textAlign', 'center');
                                    }}
                                    className={`p-2 rounded transition-colors ${
                                        textAlign === 'center'
                                            ? 'bg-[#1e2d7d] text-white'
                                            : 'hover:bg-gray-200'
                                    }`}
                                >
                                    <AlignCenter className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => {
                                        setTextAlign('right');
                                        handleTextFormatChange('textAlign', 'right');
                                    }}
                                    className={`p-2 rounded transition-colors ${
                                        textAlign === 'right'
                                            ? 'bg-[#1e2d7d] text-white'
                                            : 'hover:bg-gray-200'
                                    }`}
                                >
                                    <AlignRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>
                            <span className="text-sm text-gray-600 min-w-[60px] text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Add to Cart */}
                        <button
                            onClick={handleAddToCart}
                            className="flex items-center gap-2 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            Додати до кошика
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Photos */}
                <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-semibold text-gray-800">Елементи</h2>
                        <p className="text-xs text-gray-500 mt-1">Додайте фото або текст</p>
                    </div>

                    {/* Add Text Buttons */}
                    <div className="p-4 border-b border-gray-200 space-y-2">
                        <button
                            onClick={() => handleAddText('left')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] transition-colors text-sm"
                        >
                            <Type className="w-4 h-4" />
                            Додати текст (ліва)
                        </button>
                        <button
                            onClick={() => handleAddText('right')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] transition-colors text-sm"
                        >
                            <Type className="w-4 h-4" />
                            Додати текст (права)
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-2 gap-3">
                            {photos.map((photo, index) => (
                                <div
                                    key={photo.id}
                                    draggable
                                    onDragStart={() => handlePhotoClick(photo.id)}
                                    onClick={() => handlePhotoClick(photo.id)}
                                    className={`relative aspect-square rounded-lg overflow-hidden cursor-move border-2 transition-colors ${
                                        selectedPhoto === photo.id
                                            ? 'border-[#1e2d7d] ring-2 ring-[#1e2d7d]/20'
                                            : 'border-gray-200 hover:border-[#1e2d7d]/50'
                                    }`}
                                >
                                    <img
                                        src={photo.preview}
                                        alt={`Photo ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-1 left-1 bg-black/70 text-white text-xs font-bold rounded px-1.5 py-0.5">
                                        {index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center - Canvas */}
                <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
                    <div
                        ref={canvasRef}
                        className="bg-white shadow-2xl relative"
                        style={{
                            width: `${dimensions.width * zoom}mm`,
                            height: `${dimensions.height * zoom}mm`,
                            transform: `scale(${zoom})`
                        }}
                    >
                        {/* Spread Container */}
                        <div className="w-full h-full flex">
                            {/* Left Page */}
                            <div
                                className="flex-1 relative border-r border-gray-300"
                                onDrop={(e) => {
                                    handleDropOnCanvas(e, 'left');
                                    handleTextDrop(e, 'left');
                                }}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                {/* Safe Zone Guide */}
                                <div
                                    className="absolute border-2 border-dashed border-blue-400 opacity-30 pointer-events-none"
                                    style={{
                                        top: `${dimensions.safeZone}mm`,
                                        left: `${dimensions.safeZone}mm`,
                                        right: `${dimensions.safeZone}mm`,
                                        bottom: `${dimensions.safeZone}mm`
                                    }}
                                />

                                {/* Page Number */}
                                <div className="absolute top-2 left-2 text-xs text-gray-400 font-mono">
                                    {currentSpread.leftPage.isEmpty ? 'Форзац' : `Стор. ${currentSpread.leftPage.number}`}
                                </div>

                                {/* Placed Photos */}
                                {currentSpread.leftPage.photos.map((placedPhoto, index) => {
                                    const photo = photos.find(p => p.id === placedPhoto.photoId);
                                    if (!photo) return null;

                                    return (
                                        <div
                                            key={index}
                                            className="absolute border-2 border-[#1e2d7d] cursor-move"
                                            style={{
                                                left: `${placedPhoto.x}px`,
                                                top: `${placedPhoto.y}px`,
                                                width: `${placedPhoto.width}px`,
                                                height: `${placedPhoto.height}px`,
                                                transform: `rotate(${placedPhoto.rotation}deg)`
                                            }}
                                        >
                                            <img
                                                src={photo.preview}
                                                alt="Placed"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    );
                                })}

                                {/* Placed Texts */}
                                {currentSpread.leftPage.texts.map((text, index) => (
                                    <div
                                        key={text.id}
                                        draggable
                                        onDragStart={(e) => handleTextDragStart(e, text.id)}
                                        onClick={() => handleTextClick(text.id, 'left')}
                                        onDoubleClick={() => handleTextDoubleClick(text.id, 'left')}
                                        className={`absolute cursor-move group ${
                                            selectedText === text.id ? 'ring-2 ring-[#1e2d7d]' : ''
                                        }`}
                                        style={{
                                            left: `${text.x}px`,
                                            top: `${text.y}px`,
                                            width: `${text.width}px`,
                                            fontSize: `${text.fontSize}px`,
                                            fontFamily: text.fontFamily,
                                            color: text.color,
                                            fontWeight: text.fontWeight,
                                            fontStyle: text.fontStyle,
                                            textAlign: text.textAlign
                                        }}
                                    >
                                        {editingText === text.id ? (
                                            <textarea
                                                value={textContent}
                                                onChange={(e) => handleTextChange(e.target.value)}
                                                onBlur={() => setEditingText(null)}
                                                autoFocus
                                                className="w-full p-2 border-2 border-[#1e2d7d] rounded resize-none bg-white"
                                                style={{
                                                    fontSize: `${text.fontSize}px`,
                                                    fontFamily: text.fontFamily,
                                                    color: text.color,
                                                    fontWeight: text.fontWeight,
                                                    fontStyle: text.fontStyle,
                                                    textAlign: text.textAlign
                                                }}
                                                rows={3}
                                            />
                                        ) : (
                                            <div className="p-2 relative">
                                                {text.content}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteText(text.id, 'left');
                                                    }}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Drop Zone Hint */}
                                {currentSpread.leftPage.photos.length === 0 && currentSpread.leftPage.texts.length === 0 && !currentSpread.leftPage.isEmpty && (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none">
                                        <div className="text-center">
                                            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">Перетягніть фото сюди</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Page */}
                            <div
                                className="flex-1 relative"
                                onDrop={(e) => {
                                    handleDropOnCanvas(e, 'right');
                                    handleTextDrop(e, 'right');
                                }}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                {/* Safe Zone Guide */}
                                <div
                                    className="absolute border-2 border-dashed border-blue-400 opacity-30 pointer-events-none"
                                    style={{
                                        top: `${dimensions.safeZone}mm`,
                                        left: `${dimensions.safeZone}mm`,
                                        right: `${dimensions.safeZone}mm`,
                                        bottom: `${dimensions.safeZone}mm`
                                    }}
                                />

                                {/* Page Number */}
                                <div className="absolute top-2 right-2 text-xs text-gray-400 font-mono">
                                    {currentSpread.rightPage.isEmpty ? 'Форзац' : `Стор. ${currentSpread.rightPage.number}`}
                                </div>

                                {/* Placed Photos */}
                                {currentSpread.rightPage.photos.map((placedPhoto, index) => {
                                    const photo = photos.find(p => p.id === placedPhoto.photoId);
                                    if (!photo) return null;

                                    return (
                                        <div
                                            key={index}
                                            className="absolute border-2 border-[#1e2d7d] cursor-move"
                                            style={{
                                                left: `${placedPhoto.x}px`,
                                                top: `${placedPhoto.y}px`,
                                                width: `${placedPhoto.width}px`,
                                                height: `${placedPhoto.height}px`,
                                                transform: `rotate(${placedPhoto.rotation}deg)`
                                            }}
                                        >
                                            <img
                                                src={photo.preview}
                                                alt="Placed"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    );
                                })}

                                {/* Placed Texts */}
                                {currentSpread.rightPage.texts.map((text, index) => (
                                    <div
                                        key={text.id}
                                        draggable
                                        onDragStart={(e) => handleTextDragStart(e, text.id)}
                                        onClick={() => handleTextClick(text.id, 'right')}
                                        onDoubleClick={() => handleTextDoubleClick(text.id, 'right')}
                                        className={`absolute cursor-move group ${
                                            selectedText === text.id ? 'ring-2 ring-[#1e2d7d]' : ''
                                        }`}
                                        style={{
                                            left: `${text.x}px`,
                                            top: `${text.y}px`,
                                            width: `${text.width}px`,
                                            fontSize: `${text.fontSize}px`,
                                            fontFamily: text.fontFamily,
                                            color: text.color,
                                            fontWeight: text.fontWeight,
                                            fontStyle: text.fontStyle,
                                            textAlign: text.textAlign
                                        }}
                                    >
                                        {editingText === text.id ? (
                                            <textarea
                                                value={textContent}
                                                onChange={(e) => handleTextChange(e.target.value)}
                                                onBlur={() => setEditingText(null)}
                                                autoFocus
                                                className="w-full p-2 border-2 border-[#1e2d7d] rounded resize-none bg-white"
                                                style={{
                                                    fontSize: `${text.fontSize}px`,
                                                    fontFamily: text.fontFamily,
                                                    color: text.color,
                                                    fontWeight: text.fontWeight,
                                                    fontStyle: text.fontStyle,
                                                    textAlign: text.textAlign
                                                }}
                                                rows={3}
                                            />
                                        ) : (
                                            <div className="p-2 relative">
                                                {text.content}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteText(text.id, 'right');
                                                    }}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Drop Zone Hint */}
                                {currentSpread.rightPage.photos.length === 0 && currentSpread.rightPage.texts.length === 0 && !currentSpread.rightPage.isEmpty && (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none">
                                        <div className="text-center">
                                            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">Перетягніть фото сюди</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Spread Type Label */}
                        <div className="absolute -top-6 left-0 text-xs text-gray-500 font-medium">
                            {currentSpread.type === 'cover' && 'Обкладинка'}
                            {currentSpread.type === 'endpaper' && 'Форзац'}
                            {currentSpread.type === 'content' && 'Розворот'}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar - Page Navigation */}
                <div className="w-48 bg-white border-l border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-semibold text-gray-800">Розвороти</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {currentSpreadIndex + 1} з {spreads.length}
                        </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-3">
                            {spreads.map((spread, index) => (
                                <button
                                    key={spread.id}
                                    onClick={() => setCurrentSpreadIndex(index)}
                                    className={`w-full aspect-[2/1] rounded-lg border-2 transition-colors relative ${
                                        currentSpreadIndex === index
                                            ? 'border-[#1e2d7d] ring-2 ring-[#1e2d7d]/20'
                                            : 'border-gray-200 hover:border-[#1e2d7d]/50'
                                    }`}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                                        {spread.type === 'cover' && '📖'}
                                        {spread.type === 'endpaper' && '📄'}
                                        {spread.type === 'content' && `${spread.leftPage.number}-${spread.rightPage.number}`}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="p-4 border-t border-gray-200">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentSpreadIndex(Math.max(0, currentSpreadIndex - 1))}
                                disabled={currentSpreadIndex === 0}
                                className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 mx-auto" />
                            </button>
                            <button
                                onClick={() => setCurrentSpreadIndex(Math.min(spreads.length - 1, currentSpreadIndex + 1))}
                                disabled={currentSpreadIndex === spreads.length - 1}
                                className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 mx-auto" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
