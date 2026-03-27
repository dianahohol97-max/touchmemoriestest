'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, Check, AlertTriangle, ShoppingCart, Image as ImageIcon } from 'lucide-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';

interface PhotoFile {
    id: string;
    file: File;
    preview: string;
    width: number;
    height: number;
}

interface ProductOption {
    name: string;
    values: Array<{
        name: string;
        price?: number;
        priceModifier?: number;
    }>;
}

interface PhotoPrintConstructorProps {
    productSlug: string;
}

export default function PhotoPrintConstructor({ productSlug }: PhotoPrintConstructorProps) {
    const { addItem } = useCartStore();
    const [photos, setPhotos] = useState<PhotoFile[]>([]);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [dragging, setDragging] = useState(false);
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [selectedFinish, setSelectedFinish] = useState<string>('');
    const [selectedBorder, setSelectedBorder] = useState<string>('');
    const [showSummary, setShowSummary] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        async function fetchProduct() {
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('slug', productSlug)
                .eq('is_active', true)
                .single();

            if (data) {
                setProduct(data);

                // Set default values from product options
                const options = data.options as ProductOption[] || [];

                // Set default size if available
                const sizeOption = options.find(opt => opt.name === 'Розмір');
                if (sizeOption && sizeOption.values.length > 0) {
                    setSelectedSize(sizeOption.values[0].name);
                }

                // Set default finish (покриття)
                const finishOption = options.find(opt => opt.name === 'Покриття');
                if (finishOption && finishOption.values.length > 0) {
                    setSelectedFinish(finishOption.values[0].name);
                }

                // Set default border if available
                const borderOption = options.find(opt => opt.name === 'Біла рамочка 3мм');
                if (borderOption && borderOption.values.length > 0) {
                    setSelectedBorder(borderOption.values[0].name);
                }
            }
            setLoading(false);
        }
        fetchProduct();
    }, [productSlug, supabase]);

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newPhotos: PhotoFile[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            // Check max 500 photos limit
            if (photos.length + newPhotos.length >= 500) {
                toast.error('Максимум 500 фото на проект');
                break;
            }

            const preview = URL.createObjectURL(file);

            // Get image dimensions
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
                    height: img.height
                });
            } catch (error) {
                URL.revokeObjectURL(preview);
                console.error('Error loading image:', error);
            }
        }

        setPhotos(prev => [...prev, ...newPhotos]);
        if (newPhotos.length > 0) {
            toast.success(`Завантажено ${newPhotos.length} фото`);
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
    };

    const calculatePrice = () => {
        if (!product || photos.length === 0) return 0;

        const options = product.options as ProductOption[] || [];
        const sizeOption = options.find(opt => opt.name === 'Розмір');

        let unitPrice = product.price || 0;

        if (sizeOption && selectedSize) {
            const selectedSizeOption = sizeOption.values.find(v => v.name === selectedSize);
            if (selectedSizeOption) {
                // Use absolute price if available, otherwise add priceModifier to base price
                if (selectedSizeOption.price !== undefined) {
                    unitPrice = selectedSizeOption.price;
                } else if (selectedSizeOption.priceModifier !== undefined) {
                    unitPrice = (product.price || 0) + selectedSizeOption.priceModifier;
                }
            }
        }

        return unitPrice * photos.length;
    };

    const checkPhotoQuality = (photo: PhotoFile) => {
        if (!selectedSize) return { ok: true, message: '' };

        // Parse dimensions from size string (e.g., "10×15 см" -> {width: 10, height: 15})
        const match = selectedSize.match(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)/);
        if (!match) return { ok: true, message: '' };

        const printWidth = parseFloat(match[1]);
        const printHeight = parseFloat(match[2]);

        const dpi = 300;
        const requiredWidth = (printWidth / 2.54) * dpi;
        const requiredHeight = (printHeight / 2.54) * dpi;

        if (photo.width < requiredWidth || photo.height < requiredHeight) {
            return {
                ok: false,
                message: `Низька роздільність. Рекомендовано: ${Math.round(requiredWidth)}×${Math.round(requiredHeight)}px`
            };
        }
        return { ok: true, message: 'Якість відмінна' };
    };

    const handleAddToCart = () => {
        if (photos.length === 0) {
            toast.error('Додайте хоча б одне фото');
            return;
        }

        if (!selectedSize && product?.options?.some((opt: ProductOption) => opt.name === 'Розмір')) {
            toast.error('Оберіть розмір');
            return;
        }

        // Only require finish if product has finish options
        const hasFinishOption = product?.options?.some((opt: ProductOption) => opt.name === 'Покриття');
        if (hasFinishOption && !selectedFinish) {
            toast.error('Оберіть покриття');
            return;
        }

        const totalPrice = calculatePrice();

        const options: Record<string, string> = {
            'Кількість фото': photos.length.toString()
        };

        if (selectedSize) {
            options['Розмір'] = selectedSize;
        }

        if (selectedFinish) {
            options['Покриття'] = selectedFinish;
        }

        if (selectedBorder) {
            options['Біла рамочка 3мм'] = selectedBorder;
        }

        addItem({
            id: `${product.id}_${selectedSize}_${selectedFinish}_${Date.now()}`,
            product_id: product.id,
            name: product.name,
            price: totalPrice,
            qty: 1,
            image: product.images?.[0] || '',
            options,
            slug: product.slug,
            personalization_note: `${photos.length} фото для друку`
        });

        toast.success('Замовлення додано до кошика');

        // Reset constructor
        setPhotos([]);
        setShowSummary(false);
    };

    const getSizeOptions = () => {
        if (!product) return [];
        const options = product.options as ProductOption[] || [];
        const sizeOption = options.find(opt => opt.name === 'Розмір');
        return sizeOption?.values || [];
    };

    const getFinishOptions = () => {
        if (!product) return [];
        const options = product.options as ProductOption[] || [];
        const finishOption = options.find(opt => opt.name === 'Покриття');
        return finishOption?.values || [];
    };

    const getBorderOptions = () => {
        if (!product) return [];
        const options = product.options as ProductOption[] || [];
        const borderOption = options.find(opt => opt.name === 'Біла рамочка 3мм');
        return borderOption?.values || [];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Завантаження...</div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-red-500">Продукт не знайдено</div>
            </div>
        );
    }

    const totalPrice = calculatePrice();
    const sizeOptions = getSizeOptions();
    const finishOptions = getFinishOptions();
    const borderOptions = getBorderOptions();

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-[#1e2d7d] mb-2">{product.name}</h1>
                <p className="text-gray-600">{product.short_description}</p>
            </div>

            {/* Photo Counter */}
            <div className={`mb-6 p-4 rounded-lg ${photos.length === 0 ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}>
                <p className={`font-semibold ${photos.length === 0 ? 'text-orange-800' : 'text-blue-800'}`}>
                    {photos.length}/500 Фотографій
                </p>
            </div>

            {/* Upload Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer mb-8 ${
                    dragging
                        ? 'border-[#1e2d7d] bg-[#dbeafe]'
                        : 'border-gray-300 bg-[#f8f9fc] hover:border-[#1e2d7d] hover:bg-[#f0f2f8]'
                }`}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="w-12 h-12 text-[#1e2d7d] mx-auto mb-4" />
                <p className="text-lg font-semibold text-[#1e2d7d] mb-2">
                    Перетягніть фото сюди
                </p>
                <p className="text-sm text-gray-500 mb-4">
                    або просто перетягніть фото сюди
                </p>
                <button
                    className="px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                    }}
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
                <p className="text-xs text-gray-400 mt-4">
                    JPG, PNG, HEIC — максимум 500 фото
                </p>
            </div>

            {/* Photo Thumbnail Grid */}
            {photos.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Завантажені фото ({photos.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-[400px] overflow-y-auto p-2">
                        {photos.map((photo) => {
                            const quality = checkPhotoQuality(photo);
                            return (
                                <div key={photo.id} className="relative group">
                                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200 hover:border-[#1e2d7d] transition-colors">
                                        <img
                                            src={photo.preview}
                                            alt="Photo"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {!quality.ok && (
                                        <div className="absolute top-1 left-1 bg-yellow-500 rounded-full p-1">
                                            <AlertTriangle className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removePhoto(photo.id)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Configuration Section */}
            {photos.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                    <h3 className="text-xl font-bold text-[#1e2d7d] mb-6">Налаштування друку</h3>

                    <div className="space-y-6">
                        {/* Size Selector */}
                        {sizeOptions.length > 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Розмір <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedSize}
                                    onChange={(e) => setSelectedSize(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                                >
                                    {sizeOptions.map((option) => (
                                        <option key={option.name} value={option.name}>
                                            {option.name} {option.price ? `— ${option.price} ₴` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Finish Selector */}
                        {finishOptions.length > 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Покриття <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedFinish}
                                    onChange={(e) => setSelectedFinish(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                                >
                                    {finishOptions.map((option) => (
                                        <option key={option.name} value={option.name}>
                                            {option.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Border Selector */}
                        {borderOptions.length > 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Біла рамочка 3мм
                                </label>
                                <select
                                    value={selectedBorder}
                                    onChange={(e) => setSelectedBorder(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                                >
                                    {borderOptions.map((option) => (
                                        <option key={option.name} value={option.name}>
                                            {option.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Real-time Price Display */}
                        <div className="pt-4 border-t border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-600">Кількість фото:</span>
                                <span className="font-semibold text-gray-800">{photos.length}</span>
                            </div>
                            {selectedSize && (
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-600">Ціна за 1 фото:</span>
                                    <span className="font-semibold text-gray-800">
                                        {(() => {
                                            const option = sizeOptions.find(o => o.name === selectedSize);
                                            if (option) {
                                                if (option.price !== undefined) {
                                                    return option.price;
                                                } else if (option.priceModifier !== undefined) {
                                                    return (product.price || 0) + option.priceModifier;
                                                }
                                            }
                                            return product.price;
                                        })()} ₴
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-lg pt-2 border-t">
                                <span className="font-bold text-gray-800">Загальна вартість:</span>
                                <span className="font-bold text-[#1e2d7d] text-2xl">{totalPrice} ₴</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Summary (if showSummary is true) */}
            {showSummary && photos.length > 0 && (
                <div className="bg-[#f0f2f8] rounded-xl border border-[#1e2d7d]/20 p-6 mb-8">
                    <h3 className="text-xl font-bold text-[#1e2d7d] mb-4">Підсумок замовлення</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Продукт:</span>
                            <span className="font-semibold text-gray-800">{product.name}</span>
                        </div>
                        {selectedSize && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Розмір:</span>
                                <span className="font-semibold text-gray-800">{selectedSize}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-gray-600">Покриття:</span>
                            <span className="font-semibold text-gray-800">{selectedFinish}</span>
                        </div>
                        {selectedBorder && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Біла рамочка:</span>
                                <span className="font-semibold text-gray-800">{selectedBorder}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-gray-600">Кількість фото:</span>
                            <span className="font-semibold text-gray-800">{photos.length}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t text-lg">
                            <span className="font-bold text-gray-800">Загальна вартість:</span>
                            <span className="font-bold text-[#1e2d7d] text-2xl">{totalPrice} ₴</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {photos.length > 0 && (
                <div className="flex gap-4">
                    {!showSummary ? (
                        <button
                            onClick={() => setShowSummary(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors text-lg"
                        >
                            Переглянути підсумок
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowSummary(false)}
                                className="flex-1 px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-lg"
                            >
                                Назад до редагування
                            </button>
                            <button
                                onClick={handleAddToCart}
                                className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors text-lg"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                Додати до кошика
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
