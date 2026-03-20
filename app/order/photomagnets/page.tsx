'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ChevronLeft, ChevronRight, Check, X, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/store/cart';
import { toast } from 'sonner';

interface PhotoFile {
  file: File;
  preview: string;
  width: number;
  height: number;
}

interface MagnetDimensions {
  width: number; // in cm
  height: number; // in cm
}

// Magnet size dimensions (in cm)
const MAGNET_SIZES: Record<string, MagnetDimensions> = {
  '5×7.5 см': { width: 5, height: 7.5 },
  '7×10 см': { width: 7, height: 10 },
  '9×13 см': { width: 9, height: 13 },
  '10×15 см': { width: 10, height: 15 },
  '13×18 см': { width: 13, height: 18 },
};

// Price mapping (base 15₴ + modifier)
const MAGNET_PRICES: Record<string, number> = {
  '5×7.5 см': 15,
  '7×10 см': 20,
  '9×13 см': 25,
  '10×15 см': 30,
  '13×18 см': 40,
};

function PhotomagnetsOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { addItem } = useCartStore();

  // Get URL params
  const selectedSize = searchParams.get('розмір') || searchParams.get('size') || '10×15 см';

  // State
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Get magnet dimensions
  const getMagnetDimensions = (): MagnetDimensions => {
    return MAGNET_SIZES[selectedSize] || MAGNET_SIZES['10×15 см'];
  };

  // Get price per magnet
  const getPricePerMagnet = (): number => {
    return MAGNET_PRICES[selectedSize] || 30;
  };

  // Calculate total price
  const totalPrice = getPricePerMagnet() * Math.max(photos.length, quantity);

  // Handle file selection
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
        height: img.height,
      });
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  // Handle drag and drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;

    // Create a fake event
    const fakeEvent = {
      target: { files },
    } as any;

    await handleFileSelect(fakeEvent);
  };

  // Remove photo
  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (currentPhotoIndex >= photos.length - 1) {
      setCurrentPhotoIndex(Math.max(0, photos.length - 2));
    }
  };

  // Check photo quality for magnet
  const checkPhotoQuality = (photo: PhotoFile) => {
    const magnetDims = getMagnetDimensions();
    const dpi = 300; // Required DPI for good quality
    const requiredWidth = (magnetDims.width / 2.54) * dpi; // Convert cm to pixels at 300 DPI
    const requiredHeight = (magnetDims.height / 2.54) * dpi;

    if (photo.width < requiredWidth || photo.height < requiredHeight) {
      return {
        ok: false,
        message: `Низька роздільність. Рекомендовано: ${Math.round(requiredWidth)}×${Math.round(requiredHeight)}px`,
      };
    }
    return { ok: true, message: 'Якість відмінна' };
  };

  // Navigate photos
  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => Math.min(prev + 1, photos.length - 1));
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => Math.max(prev - 1, 0));
  };

  // Handle order confirmation
  const handleConfirmOrder = () => {
    const cartItem = {
      id: `photomagnets-${Date.now()}`,
      productId: 'photomagnets',
      name: 'Фотомагніти',
      price: totalPrice,
      quantity: 1,
      image: photos[0]?.preview || 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
      options: {
        'Розмір': selectedSize,
        'Кількість фото': `${photos.length} шт`,
      },
      metadata: {
        photos: photos.map((p) => p.preview),
        magnetSize: selectedSize,
        photoCount: photos.length,
      },
    };

    addItem(cartItem);
    toast.success('Фотомагніти додано до кошика');
    router.push('/cart');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Назад до продукту
          </button>
          <h1 className="text-3xl font-bold text-stone-900">Замовлення фотомагнітів</h1>
          <p className="text-stone-600 mt-2">Розмір: {selectedSize}</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    step >= s
                      ? 'bg-[#1e3a8a] text-white'
                      : 'bg-stone-200 text-stone-400'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-16 h-1 transition-all ${
                      step > s ? 'bg-[#1e3a8a]' : 'bg-stone-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 - Upload Photos */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 shadow-sm border border-stone-200"
          >
            <h2 className="text-2xl font-bold text-stone-900 mb-6">Крок 1: Завантажте фото</h2>

            {/* Upload Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-stone-300 rounded-xl p-12 text-center hover:border-[#1e3a8a] transition-colors cursor-pointer"
            >
              <Upload className="w-12 h-12 text-stone-400 mx-auto mb-4" />
              <p className="text-lg text-stone-700 mb-2">
                Перетягніть фото сюди або натисніть для вибору
              </p>
              <p className="text-sm text-stone-500">Підтримуються JPG, PNG, WEBP</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="inline-block mt-4 px-6 py-3 bg-[#1e3a8a] text-white rounded-full font-medium cursor-pointer hover:bg-[#1e40af] transition-colors"
              >
                Обрати файли
              </label>
            </div>

            {/* Photo Grid */}
            {photos.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-stone-900 mb-4">
                  Завантажено фото: {photos.length}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo.preview}
                        alt={`Photo ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Button */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={photos.length === 0}
                className="px-8 py-3 bg-[#1e3a8a] text-white rounded-full font-medium hover:bg-[#1e40af] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Далі: Перегляд
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2 - Visualization */}
        {step === 2 && photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 shadow-sm border border-stone-200"
          >
            <h2 className="text-2xl font-bold text-stone-900 mb-6">
              Крок 2: Перегляд магнітів
            </h2>

            {/* Photo Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevPhoto}
                disabled={currentPhotoIndex === 0}
                className="p-2 rounded-full hover:bg-stone-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-sm text-stone-600">
                Фото {currentPhotoIndex + 1} з {photos.length}
              </span>
              <button
                onClick={nextPhoto}
                disabled={currentPhotoIndex === photos.length - 1}
                className="p-2 rounded-full hover:bg-stone-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Magnet Preview */}
            <div className="bg-stone-100 rounded-xl p-8 flex items-center justify-center min-h-[400px]">
              <div className="relative">
                {/* Magnet frame */}
                <div
                  className="bg-white rounded-lg shadow-2xl overflow-hidden border-4 border-stone-300"
                  style={{
                    aspectRatio: `${getMagnetDimensions().width} / ${getMagnetDimensions().height}`,
                    maxWidth: '400px',
                    width: '100%',
                  }}
                >
                  <img
                    src={photos[currentPhotoIndex].preview}
                    alt={`Magnet preview ${currentPhotoIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Size label */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-4 py-2 rounded-full text-sm whitespace-nowrap">
                  {selectedSize}
                </div>
              </div>
            </div>

            {/* Quality Check */}
            <div className="mt-8">
              {(() => {
                const quality = checkPhotoQuality(photos[currentPhotoIndex]);
                return (
                  <div
                    className={`p-4 rounded-lg flex items-start gap-3 ${
                      quality.ok ? 'bg-green-50' : 'bg-yellow-50'
                    }`}
                  >
                    {quality.ok ? (
                      <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div
                        className={`font-medium ${
                          quality.ok ? 'text-green-900' : 'text-yellow-900'
                        }`}
                      >
                        {quality.message}
                      </div>
                      <div
                        className={`text-sm mt-1 ${
                          quality.ok ? 'text-green-700' : 'text-yellow-700'
                        }`}
                      >
                        Поточна роздільність: {photos[currentPhotoIndex].width}×
                        {photos[currentPhotoIndex].height}px
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border border-stone-200 rounded-full font-medium hover:bg-stone-50 transition-colors"
              >
                Назад
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-8 py-3 bg-[#1e3a8a] text-white rounded-full font-medium hover:bg-[#1e40af] transition-colors flex items-center gap-2"
              >
                Підтвердити замовлення
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3 - Confirmation */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 shadow-sm border border-stone-200"
          >
            <h2 className="text-2xl font-bold text-stone-900 mb-6">Крок 3: Підтвердження</h2>

            {/* Order Summary */}
            <div className="bg-stone-50 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-stone-900 mb-4">Деталі замовлення</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-stone-600">Продукт:</span>
                  <span className="font-medium text-stone-900">Фотомагніти</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Розмір:</span>
                  <span className="font-medium text-stone-900">{selectedSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Кількість фото:</span>
                  <span className="font-medium text-stone-900">{photos.length} шт</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Ціна за штуку:</span>
                  <span className="font-medium text-stone-900">{getPricePerMagnet()} ₴</span>
                </div>
                <div className="border-t border-stone-200 pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold text-stone-900">Загальна вартість:</span>
                  <span className="text-2xl font-bold text-[#1e3a8a]">{totalPrice} ₴</span>
                </div>
              </div>
            </div>

            {/* Photo Grid Preview */}
            <div className="mb-6">
              <h3 className="font-semibold text-stone-900 mb-4">Ваші фото ({photos.length})</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo.preview}
                    alt={`Photo ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-stone-200 rounded-full font-medium hover:bg-stone-50 transition-colors"
              >
                Назад
              </button>
              <button
                onClick={handleConfirmOrder}
                className="px-8 py-3 bg-[#1e3a8a] text-white rounded-full font-medium hover:bg-[#1e40af] transition-colors flex items-center gap-2"
              >
                <Check className="w-5 h-5" />
                Оформити замовлення
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function PhotomagnetsOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a8a]"></div>
        </div>
      }
    >
      <PhotomagnetsOrderContent />
    </Suspense>
  );
}
