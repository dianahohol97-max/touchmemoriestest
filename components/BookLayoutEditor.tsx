'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Trash2, Image as ImageIcon, ShoppingCart, ZoomIn, ZoomOut } from 'lucide-react';
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
            leftPage: { number: -2, photos: [] }, // Back cover
            rightPage: { number: -1, photos: [] }  // Front cover
        });

        // Endpaper spreads (if applicable)
        if (config.enableEndpaper || config.enableKalka) {
            newSpreads.push({
                id: 1,
                type: 'endpaper',
                leftPage: { number: 0, photos: [], isEmpty: !config.enableEndpaper },
                rightPage: { number: 1, photos: [] }
            });
        }

        // Content spreads
        const startPage = config.enableEndpaper || config.enableKalka ? 2 : 1;
        const contentPages = totalPages - (config.enableEndpaper || config.enableKalka ? 2 : 0);

        for (let i = 0; i < contentPages; i += 2) {
            newSpreads.push({
                id: newSpreads.length,
                type: 'content',
                leftPage: { number: startPage + i, photos: [] },
                rightPage: { number: startPage + i + 1, photos: [] }
            });
        }

        // End endpaper (if applicable)
        if (config.enableEndpaper || config.enableKalka) {
            newSpreads.push({
                id: newSpreads.length,
                type: 'endpaper',
                leftPage: { number: totalPages, photos: [] },
                rightPage: { number: totalPages + 1, photos: [], isEmpty: !config.enableEndpaper }
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
                        <h2 className="font-semibold text-gray-800">Фотографії</h2>
                        <p className="text-xs text-gray-500 mt-1">Перетягніть на розворот</p>
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
                                onDrop={(e) => handleDropOnCanvas(e, 'left')}
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

                                {/* Drop Zone Hint */}
                                {currentSpread.leftPage.photos.length === 0 && !currentSpread.leftPage.isEmpty && (
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
                                onDrop={(e) => handleDropOnCanvas(e, 'right')}
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

                                {/* Drop Zone Hint */}
                                {currentSpread.rightPage.photos.length === 0 && !currentSpread.rightPage.isEmpty && (
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
