'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, Check, AlertTriangle, ShoppingCart, ZoomIn, ZoomOut, RotateCw, FlipHorizontal, FlipVertical, Eye, EyeOff, Image as ImageIcon, Grid3x3 } from 'lucide-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import ExportProgressModal from './ExportProgressModal';
import { exportCanvasAt300DPI, uploadOrderFile, mmToPixels300dpi } from '@/lib/export-utils';

interface PhotoFile {
    id: string;
    file: File;
    preview: string;
    width: number;
    height: number;
    x: number;
    y: number;
    zoom: number;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
}

interface PuzzleSize {
    name: string;
    pieces: number;
    width: number;
    height: number;
    price?: number;
    priceModifier?: number;
}

interface LayoutType {
    id: string;
    name: string;
    cells: number;
}

export default function PhotoPuzzleConstructor() {
    const { addItem } = useCartStore();
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(1);
    const [exporting, setExporting] = useState(false);
    const [exportDone, setExportDone] = useState(false);

    // Step 1: Size selection
    const [selectedSize, setSelectedSize] = useState<PuzzleSize | null>(null);

    // Step 2: Photo upload
    const [photos, setPhotos] = useState<PhotoFile[]>([]);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step 3: Layout (if multiple photos)
    const [layoutType, setLayoutType] = useState<string>('single');

    // Step 4: Preview
    const [showPuzzleLines, setShowPuzzleLines] = useState(true);
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const puzzleOverlayRef = useRef<SVGSVGElement>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const LAYOUTS: LayoutType[] = [
        { id: 'single', name: 'Одне фото', cells: 1 },
        { id: 'grid-2x2', name: 'Сітка 2×2', cells: 4 },
        { id: 'grid-3x3', name: 'Сітка 3×3', cells: 9 },
        { id: 'collage-dominant', name: 'Домінантне фото', cells: 4 },
        { id: 'split-half', name: 'Половинки', cells: 2 },
    ];

    useEffect(() => {
        async function fetchProduct() {
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('slug', 'photopuzzle')
                .eq('is_active', true)
                .single();

            if (data) {
                setProduct(data);

                // Parse puzzle sizes from product options
                const options = data.options as Array<{ name: string; values: Array<{ name: string; price?: number; priceModifier?: number }> }> || [];
                const sizeOption = options.find(opt => opt.name === 'Розмір');

                if (sizeOption && sizeOption.values.length > 0) {
                    // Parse first size as default
                    const firstSize = parsePuzzleSize(sizeOption.values[0].name, sizeOption.values[0].price, sizeOption.values[0].priceModifier);
                    setSelectedSize(firstSize);
                }
            }
            setLoading(false);
        }
        fetchProduct();
    }, [supabase]);

    function parsePuzzleSize(sizeName: string, price?: number, priceModifier?: number): PuzzleSize {
        // Parse strings like "120 шт (29×20 см)" or "500 pieces (47×33 cm)"
        const piecesMatch = sizeName.match(/(\d+)\s*(?:шт|pieces)/i);
        const dimensionsMatch = sizeName.match(/(\d+)\s*[×x]\s*(\d+)\s*см/i);

        return {
            name: sizeName,
            pieces: piecesMatch ? parseInt(piecesMatch[1]) : 120,
            width: dimensionsMatch ? parseInt(dimensionsMatch[1]) : 29,
            height: dimensionsMatch ? parseInt(dimensionsMatch[2]) : 20,
            price,
            priceModifier
        };
    }

    function getPuzzleGridDimensions(pieces: number): { cols: number; rows: number } {
        // Calculate grid dimensions based on piece count
        // Maintain aspect ratio close to standard puzzle ratios
        const aspectRatio = selectedSize ? selectedSize.width / selectedSize.height : 1.45;
        const rows = Math.round(Math.sqrt(pieces / aspectRatio));
        const cols = Math.round(pieces / rows);

        return { cols, rows };
    }

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newPhotos: PhotoFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            if (photos.length + newPhotos.length >= 9) {
                toast.error('Максимум 9 фото для колажу');
                break;
            }

            const preview = URL.createObjectURL(file);

            try {
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new window.Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    image.src = preview;
                });

                newPhotos.push({
                    id: Math.random().toString(36).substring(7),
                    file,
                    preview,
                    width: img.width,
                    height: img.height,
                    x: 0,
                    y: 0,
                    zoom: 1,
                    rotation: 0,
                    flipH: false,
                    flipV: false
                });
            } catch (error) {
                URL.revokeObjectURL(preview);
                console.error('Error loading image:', error);
            }
        }

        setPhotos(prev => [...prev, ...newPhotos]);
        if (newPhotos.length > 0) {
            toast.success(`Завантажено ${newPhotos.length} фото`);
            setSelectedPhotoId(newPhotos[0].id);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        await handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => {
        setDragging(false);
    };

    const removePhoto = (id: string) => {
        const photo = photos.find(p => p.id === id);
        if (photo) {
            URL.revokeObjectURL(photo.preview);
        }
        setPhotos(photos.filter(p => p.id !== id));
        if (selectedPhotoId === id) {
            setSelectedPhotoId(photos.length > 1 ? photos[0].id : null);
        }
    };

    function checkImageResolution(photo: PhotoFile): { status: 'excellent' | 'acceptable' | 'poor'; message: string } {
        if (!selectedSize) return { status: 'excellent', message: '' };

        const puzzleWidthCm = selectedSize.width;
        const puzzleHeightCm = selectedSize.height;

        // Convert cm to inches (1 inch = 2.54 cm)
        const puzzleWidthInches = puzzleWidthCm / 2.54;
        const puzzleHeightInches = puzzleHeightCm / 2.54;

        // Calculate required pixels at 300 DPI (optimal) and 150 DPI (acceptable)
        const optimalWidth = Math.round(puzzleWidthInches * 300);
        const optimalHeight = Math.round(puzzleHeightInches * 300);
        const acceptableWidth = Math.round(puzzleWidthInches * 150);
        const acceptableHeight = Math.round(puzzleHeightInches * 150);

        if (photo.width >= optimalWidth && photo.height >= optimalHeight) {
            return { status: 'excellent', message: 'Якість зображення відмінна' };
        } else if (photo.width >= acceptableWidth && photo.height >= acceptableHeight) {
            return { status: 'acceptable', message: 'Якість зображення прийнятна' };
        } else {
            return { status: 'poor', message: 'Увага: якість зображення може бути недостатньою для цього розміру пазла' };
        }
    }

    function updatePhotoProperty(id: string, property: keyof PhotoFile, value: any) {
        setPhotos(photos.map(p => p.id === id ? { ...p, [property]: value } : p));
    }

    function handleZoomChange(id: string, delta: number) {
        const photo = photos.find(p => p.id === id);
        if (!photo) return;
        const newZoom = Math.max(0.5, Math.min(3, photo.zoom + delta));
        updatePhotoProperty(id, 'zoom', newZoom);
    }

    function handleRotate(id: string) {
        const photo = photos.find(p => p.id === id);
        if (!photo) return;
        updatePhotoProperty(id, 'rotation', (photo.rotation + 90) % 360);
    }

    function handleFlipH(id: string) {
        const photo = photos.find(p => p.id === id);
        if (!photo) return;
        updatePhotoProperty(id, 'flipH', !photo.flipH);
    }

    function handleFlipV(id: string) {
        const photo = photos.find(p => p.id === id);
        if (!photo) return;
        updatePhotoProperty(id, 'flipV', !photo.flipV);
    }

    // Generate SVG puzzle piece overlay
    function generatePuzzleOverlay() {
        if (!selectedSize || !showPuzzleLines) return null;

        const { cols, rows } = getPuzzleGridDimensions(selectedSize.pieces);
        const cellWidth = 100 / cols;
        const cellHeight = 100 / rows;

        const paths: React.ReactElement[] = [];

        // Generate interlocking puzzle piece paths
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * cellWidth;
                const y = row * cellHeight;

                // Deterministic random seed for tab/blank pattern
                const seed = row * cols + col;
                const hasTopTab = (seed % 2 === 0) && row > 0;
                const hasRightTab = ((seed + 1) % 2 === 0) && col < cols - 1;
                const hasBottomTab = ((seed + 2) % 2 === 0) && row < rows - 1;
                const hasLeftTab = ((seed + 3) % 2 === 0) && col > 0;

                // Build path for this piece
                let pathData = `M ${x} ${y}`;

                // Top edge
                if (row === 0) {
                    pathData += ` L ${x + cellWidth} ${y}`;
                } else {
                    pathData += drawEdge(x, y, x + cellWidth, y, hasTopTab, 'horizontal');
                }

                // Right edge
                if (col === cols - 1) {
                    pathData += ` L ${x + cellWidth} ${y + cellHeight}`;
                } else {
                    pathData += drawEdge(x + cellWidth, y, x + cellWidth, y + cellHeight, hasRightTab, 'vertical');
                }

                // Bottom edge
                if (row === rows - 1) {
                    pathData += ` L ${x} ${y + cellHeight}`;
                } else {
                    pathData += drawEdge(x + cellWidth, y + cellHeight, x, y + cellHeight, hasBottomTab, 'horizontal-reverse');
                }

                // Left edge
                if (col === 0) {
                    pathData += ` L ${x} ${y}`;
                } else {
                    pathData += drawEdge(x, y + cellHeight, x, y, hasLeftTab, 'vertical-reverse');
                }

                pathData += ' Z';

                paths.push(
                    <path
                        key={`piece-${row}-${col}`}
                        d={pathData}
                        fill="none"
                        stroke="rgba(0,0,0,0.15)"
                        strokeWidth="0.2"
                        vectorEffect="non-scaling-stroke"
                    />
                );
            }
        }

        return paths;
    }

    function drawEdge(x1: number, y1: number, x2: number, y2: number, hasTab: boolean, direction: string): string {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const tabSize = direction.includes('horizontal') ? 1.5 : 1.5;

        if (!hasTab) {
            // Blank (inward curve)
            if (direction === 'horizontal') {
                return ` Q ${midX} ${midY - tabSize} ${x2} ${y2}`;
            } else if (direction === 'horizontal-reverse') {
                return ` Q ${midX} ${midY + tabSize} ${x2} ${y2}`;
            } else if (direction === 'vertical') {
                return ` Q ${midX + tabSize} ${midY} ${x2} ${y2}`;
            } else {
                return ` Q ${midX - tabSize} ${midY} ${x2} ${y2}`;
            }
        } else {
            // Tab (outward curve)
            if (direction === 'horizontal') {
                return ` Q ${midX} ${midY + tabSize} ${x2} ${y2}`;
            } else if (direction === 'horizontal-reverse') {
                return ` Q ${midX} ${midY - tabSize} ${x2} ${y2}`;
            } else if (direction === 'vertical') {
                return ` Q ${midX - tabSize} ${midY} ${x2} ${y2}`;
            } else {
                return ` Q ${midX + tabSize} ${midY} ${x2} ${y2}`;
            }
        }
    }

    // Render preview canvas
    useEffect(() => {
        if (!canvasRef.current || photos.length === 0 || !selectedSize) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to puzzle aspect ratio
        const aspectRatio = selectedSize.width / selectedSize.height;
        const canvasWidth = 800;
        const canvasHeight = canvasWidth / aspectRatio;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Clear canvas
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw photo(s)
        if (layoutType === 'single' && photos.length > 0) {
            const photo = photos[0];
            drawPhoto(ctx, photo, 0, 0, canvasWidth, canvasHeight);
        } else if (layoutType === 'grid-2x2' && photos.length > 0) {
            const cellW = canvasWidth / 2;
            const cellH = canvasHeight / 2;
            photos.slice(0, 4).forEach((photo, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                drawPhoto(ctx, photo, col * cellW, row * cellH, cellW, cellH);
            });
        } else if (layoutType === 'grid-3x3' && photos.length > 0) {
            const cellW = canvasWidth / 3;
            const cellH = canvasHeight / 3;
            photos.slice(0, 9).forEach((photo, i) => {
                const col = i % 3;
                const row = Math.floor(i / 3);
                drawPhoto(ctx, photo, col * cellW, row * cellH, cellW, cellH);
            });
        } else if (layoutType === 'split-half' && photos.length > 0) {
            const cellW = canvasWidth / 2;
            photos.slice(0, 2).forEach((photo, i) => {
                drawPhoto(ctx, photo, i * cellW, 0, cellW, canvasHeight);
            });
        } else if (layoutType === 'collage-dominant' && photos.length > 0) {
            // Large photo on left (60%), 3 small on right (20% each)
            if (photos[0]) drawPhoto(ctx, photos[0], 0, 0, canvasWidth * 0.6, canvasHeight);
            const smallW = canvasWidth * 0.4;
            const smallH = canvasHeight / 3;
            photos.slice(1, 4).forEach((photo, i) => {
                drawPhoto(ctx, photo, canvasWidth * 0.6, i * smallH, smallW, smallH);
            });
        }

    }, [photos, selectedSize, layoutType, showPuzzleLines]);

    function drawPhoto(ctx: CanvasRenderingContext2D, photo: PhotoFile, x: number, y: number, w: number, h: number) {
        const img = new window.Image();
        img.src = photo.preview;

        ctx.save();

        // Set clipping region
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        // Apply transformations
        const centerX = x + w / 2;
        const centerY = y + h / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate((photo.rotation * Math.PI) / 180);
        ctx.scale(photo.flipH ? -1 : 1, photo.flipV ? -1 : 1);
        ctx.scale(photo.zoom, photo.zoom);
        ctx.translate(-centerX + photo.x, -centerY + photo.y);

        // Draw image
        const scale = Math.max(w / photo.width, h / photo.height);
        const drawWidth = photo.width * scale;
        const drawHeight = photo.height * scale;
        const drawX = x + (w - drawWidth) / 2;
        const drawY = y + (h - drawHeight) / 2;

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        ctx.restore();
    }

    function calculatePrice(): number {
        if (!product || !selectedSize) return 0;

        const basePrice = product.price || 0;
        const sizePrice = selectedSize.price || 0;
        const sizeModifier = selectedSize.priceModifier || 0;

        if (sizePrice > 0) return sizePrice;
        return basePrice + sizeModifier;
    }

    async function handleAddToCart() {
        if (!product || !selectedSize || photos.length === 0) {
            toast.error('Виберіть розмір та завантажте фото');
            return;
        }

        const price = calculatePrice();
        const cartItemId = `${product.id}-${Date.now()}`;

        // Export canvas at 300 DPI
        if (canvasRef.current && canvasRef.current.width > 0) {
            try {
                setExporting(true);
                setExportDone(false);

                // Calculate print dimensions
                const wPx = mmToPixels300dpi(selectedSize.width * 10); // cm -> mm
                const hPx = mmToPixels300dpi(selectedSize.height * 10);
                const blob = await exportCanvasAt300DPI(canvasRef.current, wPx, hPx);
                const filePath = `pending/${cartItemId}/puzzle_300dpi.png`;
                await uploadOrderFile('puzzle-uploads', filePath, blob);

                sessionStorage.setItem(`export_${cartItemId}`, JSON.stringify({
                    bucket: 'puzzle-uploads',
                    path: filePath,
                    fileName: 'puzzle_300dpi.png',
                    fileCategory: 'puzzle',
                    size: blob.size,
                }));

                setExportDone(true);
                await new Promise(r => setTimeout(r, 800));
            } catch (err) {
                console.error('Puzzle export failed (non-blocking):', err);
            } finally {
                setExporting(false);
                setExportDone(false);
            }
        }

        addItem({
            id: cartItemId,
            product_id: product.id,
            name: product.name,
            price,
            qty: 1,
            image: canvasRef.current ? canvasRef.current.toDataURL('image/jpeg', 0.7) : photos[0].preview,
            options: {
                'Розмір': selectedSize.name,
                'Кількість елементів': selectedSize.pieces.toString(),
                'Розміри': `${selectedSize.width}×${selectedSize.height} см`,
                'Тип': layoutType === 'single' ? 'Одне фото' : 'Колаж',
                'Кількість фото': photos.length.toString()
            },
            personalization_note: `Пазл ${selectedSize.pieces} шт, ${selectedSize.width}×${selectedSize.height} см. Фото: ${photos.length} шт.`
        });

        toast.success('Пазл додано в кошик');
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e2d7d] mx-auto mb-4"></div>
                    <p className="text-gray-600">Завантаження конструктора...</p>
                </div>
            </div>
        );
    }

    const selectedPhoto = photos.find(p => p.id === selectedPhotoId);
    const resolutionCheck = selectedPhoto ? checkImageResolution(selectedPhoto) : null;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <ExportProgressModal open={exporting} current={1} total={1} done={exportDone} />
            <div className="max-w-7xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Конструктор фотопазлів</h1>
                    <p className="text-gray-600">Створіть унікальний пазл зі своїх фото</p>
                </div>

                {/* Progress bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Крок {currentStep} з 4</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-[#1e2d7d] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(currentStep / 4) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-600">
                        <span className={currentStep >= 1 ? 'text-[#1e2d7d] font-medium' : ''}>Розмір</span>
                        <span className={currentStep >= 2 ? 'text-[#1e2d7d] font-medium' : ''}>Фото</span>
                        <span className={currentStep >= 3 ? 'text-[#1e2d7d] font-medium' : ''}>Позиціонування</span>
                        <span className={currentStep >= 4 ? 'text-[#1e2d7d] font-medium' : ''}>Попередній перегляд</span>
                    </div>
                </div>

                {/* Main content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Controls panel */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Step 1: Size selection */}
                        {currentStep === 1 && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <Grid3x3 className="w-5 h-5" />
                                    Виберіть розмір пазла
                                </h2>

                                <div className="space-y-3">
                                    {product?.options?.find((opt: any) => opt.name === 'Розмір')?.values?.map((sizeValue: any) => {
                                        const puzzleSize = parsePuzzleSize(sizeValue.name, sizeValue.price, sizeValue.priceModifier);
                                        const isSelected = selectedSize?.name === puzzleSize.name;

                                        return (
                                            <button
                                                key={sizeValue.name}
                                                onClick={() => setSelectedSize(puzzleSize)}
                                                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                                                    isSelected
                                                        ? 'border-[#1e2d7d] bg-blue-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="font-semibold text-lg">{puzzleSize.pieces} елементів</div>
                                                        <div className="text-sm text-gray-600">{puzzleSize.width}×{puzzleSize.height} см</div>
                                                    </div>
                                                    {isSelected && <Check className="w-5 h-5 text-[#1e2d7d]" />}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    Складність: {puzzleSize.pieces < 200 ? 'Легка' : puzzleSize.pieces < 500 ? 'Середня' : 'Висока'}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => {
                                        if (selectedSize) setCurrentStep(2);
                                        else toast.error('Виберіть розмір пазла');
                                    }}
                                    className="w-full mt-6 bg-[#1e2d7d] text-white py-3 rounded-lg font-medium hover:bg-[#162159] transition-colors"
                                >
                                    Далі
                                </button>
                            </div>
                        )}

                        {/* Step 2: Photo upload */}
                        {currentStep === 2 && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <ImageIcon className="w-5 h-5" />
                                    Завантажте фото
                                </h2>

                                {/* Upload zone */}
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                        dragging ? 'border-[#1e2d7d] bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                >
                                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                    <p className="text-gray-700 mb-2">Перетягніть фото сюди</p>
                                    <p className="text-sm text-gray-500 mb-4">або просто перетягніть фото сюди</p>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Мої пристрої
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleFileSelect(e.target.files)}
                                        className="hidden"
                                    />
                                    <p className="text-xs text-gray-500 mt-3">До 9 фото для колажу</p>
                                </div>

                                {/* Photo thumbnails */}
                                {photos.length > 0 && (
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-700">
                                                Завантажено: {photos.length} {photos.length === 1 ? 'фото' : 'фото'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {photos.map((photo) => {
                                                const check = checkImageResolution(photo);
                                                return (
                                                    <div key={photo.id} className="relative group">
                                                        <img
                                                            src={photo.preview}
                                                            alt=""
                                                            className="w-full h-24 object-cover rounded-lg"
                                                        />
                                                        <button
                                                            onClick={() => removePhoto(photo.id)}
                                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                        {check.status === 'excellent' && (
                                                            <div className="absolute bottom-1 left-1 bg-green-500 text-white p-1 rounded-full">
                                                                <Check className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                        {check.status === 'poor' && (
                                                            <div className="absolute bottom-1 left-1 bg-yellow-500 text-white p-1 rounded-full">
                                                                <AlertTriangle className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Resolution warning/success */}
                                        {resolutionCheck && (
                                            <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 ${
                                                resolutionCheck.status === 'excellent' ? 'bg-green-50 text-green-800' :
                                                resolutionCheck.status === 'acceptable' ? 'bg-blue-50 text-blue-800' :
                                                'bg-yellow-50 text-yellow-800'
                                            }`}>
                                                {resolutionCheck.status === 'excellent' && <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                                                {resolutionCheck.status === 'poor' && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                                                <p className="text-sm">{resolutionCheck.message}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Layout selector (if multiple photos) */}
                                {photos.length > 1 && (
                                    <div className="mt-6">
                                        <h3 className="text-sm font-medium text-gray-700 mb-3">Виберіть макет</h3>
                                        <div className="space-y-2">
                                            {LAYOUTS.filter(layout => layout.cells <= photos.length).map((layout) => (
                                                <button
                                                    key={layout.id}
                                                    onClick={() => setLayoutType(layout.id)}
                                                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                                                        layoutType === layout.id
                                                            ? 'border-[#1e2d7d] bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{layout.name}</span>
                                                        {layoutType === layout.id && <Check className="w-4 h-4 text-[#1e2d7d]" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setCurrentStep(1)}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Назад
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (photos.length > 0) setCurrentStep(3);
                                            else toast.error('Завантажте хоча б одне фото');
                                        }}
                                        className="flex-1 bg-[#1e2d7d] text-white py-3 rounded-lg font-medium hover:bg-[#162159] transition-colors"
                                    >
                                        Далі
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Position controls */}
                        {currentStep === 3 && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold mb-4">Позиціонування</h2>

                                {/* Photo selector */}
                                {photos.length > 1 && (
                                    <div className="mb-4">
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Виберіть фото для редагування</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {photos.map((photo) => (
                                                <button
                                                    key={photo.id}
                                                    onClick={() => setSelectedPhotoId(photo.id)}
                                                    className={`border-2 rounded-lg overflow-hidden ${
                                                        selectedPhotoId === photo.id ? 'border-[#1e2d7d]' : 'border-gray-200'
                                                    }`}
                                                >
                                                    <img src={photo.preview} alt="" className="w-full h-16 object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedPhoto && (
                                    <div className="space-y-4">
                                        {/* Zoom controls */}
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-2 block">Масштаб</label>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleZoomChange(selectedPhoto.id, -0.1)}
                                                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                                >
                                                    <ZoomOut className="w-4 h-4" />
                                                </button>
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="3"
                                                    step="0.1"
                                                    value={selectedPhoto.zoom}
                                                    onChange={(e) => updatePhotoProperty(selectedPhoto.id, 'zoom', parseFloat(e.target.value))}
                                                    className="flex-1"
                                                />
                                                <button
                                                    onClick={() => handleZoomChange(selectedPhoto.id, 0.1)}
                                                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                                >
                                                    <ZoomIn className="w-4 h-4" />
                                                </button>
                                                <span className="text-sm text-gray-600 w-12 text-right">{Math.round(selectedPhoto.zoom * 100)}%</span>
                                            </div>
                                        </div>

                                        {/* Position controls */}
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-2 block">Позиція X</label>
                                            <input
                                                type="range"
                                                min="-200"
                                                max="200"
                                                step="5"
                                                value={selectedPhoto.x}
                                                onChange={(e) => updatePhotoProperty(selectedPhoto.id, 'x', parseInt(e.target.value))}
                                                className="w-full"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-2 block">Позиція Y</label>
                                            <input
                                                type="range"
                                                min="-200"
                                                max="200"
                                                step="5"
                                                value={selectedPhoto.y}
                                                onChange={(e) => updatePhotoProperty(selectedPhoto.id, 'y', parseInt(e.target.value))}
                                                className="w-full"
                                            />
                                        </div>

                                        {/* Transform controls */}
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-2 block">Трансформація</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleRotate(selectedPhoto.id)}
                                                    className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                                                >
                                                    <RotateCw className="w-4 h-4" />
                                                    <span className="text-sm">Повернути</span>
                                                </button>
                                                <button
                                                    onClick={() => handleFlipH(selectedPhoto.id)}
                                                    className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                                                >
                                                    <FlipHorizontal className="w-4 h-4" />
                                                    <span className="text-sm">↔</span>
                                                </button>
                                                <button
                                                    onClick={() => handleFlipV(selectedPhoto.id)}
                                                    className="flex-1 p-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                                                >
                                                    <FlipVertical className="w-4 h-4" />
                                                    <span className="text-sm">↕</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Назад
                                    </button>
                                    <button
                                        onClick={() => setCurrentStep(4)}
                                        className="flex-1 bg-[#1e2d7d] text-white py-3 rounded-lg font-medium hover:bg-[#162159] transition-colors"
                                    >
                                        Далі
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Preview & Add to cart */}
                        {currentStep === 4 && (
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold mb-4">Підсумок замовлення</h2>

                                {/* Puzzle info */}
                                {selectedSize && (
                                    <div className="space-y-3 mb-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Розмір:</span>
                                            <span className="font-medium">{selectedSize.name}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Елементів:</span>
                                            <span className="font-medium">{selectedSize.pieces} шт</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Фізичний розмір:</span>
                                            <span className="font-medium">{selectedSize.width}×{selectedSize.height} см</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Тип:</span>
                                            <span className="font-medium">{layoutType === 'single' ? 'Одне фото' : 'Колаж'}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Кількість фото:</span>
                                            <span className="font-medium">{photos.length}</span>
                                        </div>
                                        <div className="border-t pt-3 mt-3">
                                            <div className="flex justify-between items-baseline">
                                                <span className="font-semibold">Ціна:</span>
                                                <span className="text-2xl font-bold text-[#1e2d7d]">{calculatePrice()} ₴</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Puzzle lines toggle */}
                                <div className="mb-6">
                                    <button
                                        onClick={() => setShowPuzzleLines(!showPuzzleLines)}
                                        className="w-full flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        {showPuzzleLines ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        <span className="text-sm font-medium">
                                            {showPuzzleLines ? 'Приховати лінії пазла' : 'Показати лінії пазла'}
                                        </span>
                                    </button>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setCurrentStep(3)}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Назад
                                    </button>
                                    <button
                                        onClick={handleAddToCart}
                                        className="flex-1 bg-[#1e2d7d] text-white py-3 rounded-lg font-medium hover:bg-[#162159] transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ShoppingCart className="w-4 h-4" />
                                        Додати в кошик
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview panel */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
                            <h2 className="text-xl font-semibold mb-4">Попередній перегляд</h2>

                            {selectedSize && (
                                <div className="mb-3 text-sm text-gray-600">
                                    {selectedSize.pieces} елементів, {selectedSize.width}×{selectedSize.height} см
                                </div>
                            )}

                            <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: selectedSize ? `${selectedSize.width} / ${selectedSize.height}` : '1.45' }}>
                                {photos.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                        <div className="text-center">
                                            <ImageIcon className="w-16 h-16 mx-auto mb-2 opacity-50" />
                                            <p>Завантажте фото для попереднього перегляду</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Canvas for photo */}
                                        <canvas
                                            ref={canvasRef}
                                            className="w-full h-full object-contain"
                                        />

                                        {/* SVG overlay for puzzle pieces */}
                                        {showPuzzleLines && selectedSize && (
                                            <svg
                                                ref={puzzleOverlayRef}
                                                className="absolute inset-0 w-full h-full pointer-events-none"
                                                viewBox="0 0 100 100"
                                                preserveAspectRatio="none"
                                            >
                                                {generatePuzzleOverlay()}
                                            </svg>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
