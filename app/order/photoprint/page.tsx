'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Upload, Image as ImageIcon, Check, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import Image from 'next/image';

interface PhotoFile {
    file: File;
    preview: string;
    width: number;
    height: number;
    crop?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

function PhotoprintOrderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { addItem } = useCartStore();

    const productSlug = searchParams.get('product') || 'photoprint-standard';
    const selectedSize = searchParams.get('size') || '10×15 см';
    const selectedFinish = searchParams.get('finish') || 'Глянцеве';
    const selectedBorder = searchParams.get('border') || 'Ні';

    const [step, setStep] = useState(1); // 1: Upload, 2: Visualization, 3: Confirmation
    const [photos, setPhotos] = useState<PhotoFile[]>([]);
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

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
                .single();

            if (data) {
                setProduct(data);
            }
            setLoading(false);
        }
        fetchProduct();
    }, [productSlug, supabase]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const newPhotos: PhotoFile[] = [];

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            const preview = URL.createObjectURL(file);

            // Get image dimensions
            const img = await new Promise<HTMLImageElement>((resolve) => {
                const image = new window.Image();
                image.onload = () => resolve(image);
                image.src = preview;
            });

            newPhotos.push({
                file,
                preview,
                width: img.width,
                height: img.height
            });
        }

        setPhotos(prev => [...prev, ...newPhotos]);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;

        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        input.files = dataTransfer.files;

        const event = { target: input } as any;
        await handleFileSelect(event);
    };

    const removePhoto = (index: number) => {
        const newPhotos = [...photos];
        URL.revokeObjectURL(newPhotos[index].preview);
        newPhotos.splice(index, 1);
        setPhotos(newPhotos);
    };

    const getPrintDimensions = () => {
        // Parse dimensions from size string (e.g., "10×15 см" -> {width: 10, height: 15})
        const match = selectedSize.match(/(\d+)×(\d+)/);
        if (match) {
            return { width: parseInt(match[1]), height: parseInt(match[2]) };
        }
        return { width: 10, height: 15 }; // default
    };

    const checkPhotoQuality = (photo: PhotoFile) => {
        const printDims = getPrintDimensions();
        const dpi = 300; // Required DPI for good quality
        const requiredWidth = (printDims.width / 2.54) * dpi; // Convert cm to pixels at 300 DPI
        const requiredHeight = (printDims.height / 2.54) * dpi;

        if (photo.width < requiredWidth || photo.height < requiredHeight) {
            return { ok: false, message: `Низька роздільність. Рекомендовано: ${Math.round(requiredWidth)}×${Math.round(requiredHeight)}px` };
        }
        return { ok: true, message: 'Якість відмінна' };
    };

    const handleConfirmOrder = () => {
        if (photos.length === 0) {
            toast.error('Додайте хоча б одне фото');
            return;
        }

        // Calculate price
        const sizeOption = product?.options?.find((opt: any) => opt.name === 'Розмір');
        const selectedSizeOption = sizeOption?.values?.find((val: any) => val.name === selectedSize);
        const pricePerPrint = selectedSizeOption?.price || product?.price || 8;
        const totalPrice = pricePerPrint * photos.length;

        // Add to cart
        addItem({
            id: `${product.id}_${selectedSize}_${selectedFinish}_${Date.now()}`,
            product_id: product.id,
            name: product.name,
            price: totalPrice,
            qty: 1,
            image: product.images?.[0] || '',
            options: {
                'Розмір': selectedSize,
                'Покриття': selectedFinish,
                'Біла рамочка 3мм': selectedBorder,
                'Кількість фото': photos.length.toString()
            },
            slug: product.slug,
            personalization_note: `${photos.length} фото для друку`
        });

        toast.success('Замовлення додано до кошика');
        router.push('/cart');
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="animate-spin">Завантаження...</div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />

            <main className="max-w-5xl mx-auto px-4 py-24">
                {/* Progress Steps */}
                <div className="mb-12">
                    <div className="flex items-center justify-center gap-4">
                        {[1, 2, 3].map(stepNum => (
                            <div key={stepNum} className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                    step >= stepNum ? 'bg-[#263A99] text-white' : 'bg-gray-200 text-gray-500'
                                }`}>
                                    {stepNum}
                                </div>
                                {stepNum < 3 && (
                                    <div className={`w-16 h-1 ${step > stepNum ? 'bg-[#263A99]' : 'bg-gray-200'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-4 text-sm text-gray-600 max-w-md mx-auto">
                        <span>Завантаження</span>
                        <span>Перегляд</span>
                        <span>Підтвердження</span>
                    </div>
                </div>

                {/* Step 1: Upload Photos */}
                {step === 1 && (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Завантажте ваші фото</h1>
                            <p className="text-gray-600">
                                Формат: {selectedSize} | Покриття: {selectedFinish}
                            </p>
                        </div>

                        {/* Drag and Drop Zone */}
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-[#263A99] transition-colors cursor-pointer"
                            onClick={() => document.getElementById('fileInput')?.click()}
                        >
                            <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-semibold mb-2">Перетягніть фото сюди</p>
                            <p className="text-sm text-gray-500 mb-4">або натисніть, щоб обрати файли</p>
                            <input
                                id="fileInput"
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </div>

                        {/* Photo Thumbnails */}
                        {photos.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Завантажено фото: {photos.length}</h3>
                                <div className="grid grid-cols-4 gap-4">
                                    {photos.map((photo, index) => (
                                        <div key={index} className="relative group">
                                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                                <img
                                                    src={photo.preview}
                                                    alt={`Photo ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <button
                                                onClick={() => removePhoto(index)}
                                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Next Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setStep(2)}
                                disabled={photos.length === 0}
                                className="flex items-center gap-2 px-8 py-3 bg-[#263A99] text-white rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                            >
                                Далі <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Visualization */}
                {step === 2 && (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Перегляд фото</h1>
                            <p className="text-gray-600">
                                Перевірте, як виглядатимуть ваші фото у форматі {selectedSize}
                            </p>
                        </div>

                        {/* Photo Navigation */}
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={() => setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1))}
                                disabled={currentPhotoIndex === 0}
                                className="p-2 rounded-full bg-gray-200 disabled:opacity-50 hover:bg-gray-300"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <span className="text-gray-600">
                                Фото {currentPhotoIndex + 1} з {photos.length}
                            </span>
                            <button
                                onClick={() => setCurrentPhotoIndex(Math.min(photos.length - 1, currentPhotoIndex + 1))}
                                disabled={currentPhotoIndex === photos.length - 1}
                                className="p-2 rounded-full bg-gray-200 disabled:opacity-50 hover:bg-gray-300"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </div>

                        {/* Current Photo Preview */}
                        {photos[currentPhotoIndex] && (
                            <div className="max-w-2xl mx-auto">
                                <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: `${getPrintDimensions().width}/${getPrintDimensions().height}` }}>
                                    <img
                                        src={photos[currentPhotoIndex].preview}
                                        alt={`Preview ${currentPhotoIndex + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Quality Warning */}
                                {(() => {
                                    const quality = checkPhotoQuality(photos[currentPhotoIndex]);
                                    return (
                                        <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
                                            quality.ok ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
                                        }`}>
                                            {quality.ok ? <Check size={20} /> : <AlertTriangle size={20} />}
                                            <div>
                                                <p className="font-semibold">{quality.ok ? 'Відмінна якість' : 'Попередження'}</p>
                                                <p className="text-sm">{quality.message}</p>
                                                <p className="text-xs mt-1">
                                                    Розмір фото: {photos[currentPhotoIndex].width}×{photos[currentPhotoIndex].height}px
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between">
                            <button
                                onClick={() => setStep(1)}
                                className="flex items-center gap-2 px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-full font-semibold hover:bg-gray-50 transition-colors"
                            >
                                <ChevronLeft size={20} /> Назад
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                className="flex items-center gap-2 px-8 py-3 bg-[#263A99] text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
                            >
                                Підтвердити замовлення <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirmation */}
                {step === 3 && (
                    <div className="space-y-8 max-w-2xl mx-auto">
                        <div className="text-center">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Підтвердження замовлення</h1>
                            <p className="text-gray-600">Перевірте деталі перед оформленням</p>
                        </div>

                        {/* Order Summary */}
                        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Продукт:</span>
                                <span className="font-semibold">{product?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Розмір:</span>
                                <span className="font-semibold">{selectedSize}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Покриття:</span>
                                <span className="font-semibold">{selectedFinish}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Біла рамочка:</span>
                                <span className="font-semibold">{selectedBorder}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Кількість фото:</span>
                                <span className="font-semibold">{photos.length}</span>
                            </div>
                            <div className="border-t pt-4 flex justify-between text-lg">
                                <span className="font-bold">Загальна вартість:</span>
                                <span className="font-bold text-[#263A99]">
                                    {(() => {
                                        const sizeOption = product?.options?.find((opt: any) => opt.name === 'Розмір');
                                        const selectedSizeOption = sizeOption?.values?.find((val: any) => val.name === selectedSize);
                                        const pricePerPrint = selectedSizeOption?.price || product?.price || 8;
                                        return pricePerPrint * photos.length;
                                    })()} ₴
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => setStep(2)}
                                className="flex-1 px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-full font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Назад
                            </button>
                            <button
                                onClick={handleConfirmOrder}
                                className="flex-1 px-8 py-3 bg-[#263A99] text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
                            >
                                Оформити замовлення
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <Footer categories={[]} />
        </div>
    );
}

export default function PhotoprintOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <PhotoprintOrderContent />
        </Suspense>
    );
}
