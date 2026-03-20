'use client';
import React, { useState, useMemo, useRef } from 'react';
import { CheckCircle2, ChevronRight, ArrowLeft, Info, Plus, Upload, X, ChevronLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { submitOrder } from '@/lib/submitOrder';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import Image from 'next/image';

type CoverType = 'printed' | 'velour' | 'leather' | 'fabric' | null;
type FormatId = '20×20' | '25×25' | '20×30' | '30×20' | '30×30' | null;
type LayoutType = 'full-spread' | 'two-photos' | 'three-photos' | 'four-photos' | 'left-page' | 'right-page';

interface PhotoFile {
  file: File;
  preview: string;
  id: string;
}

interface PhotoSlot {
  photo: PhotoFile | null;
}

interface Spread {
  index: number;
  layout: LayoutType;
  slots: PhotoSlot[];
}

const COVER_TYPES = [
  {
    key: 'printed',
    name: 'Друкована обкладинка',
    badge: 'Стандарт',
    description: 'Яскраве фото на всю обкладинку · тверда палітурка',
    price: 'від 800 ₴'
  },
  {
    key: 'velour',
    name: 'Велюрова обкладинка',
    badge: 'Популярна',
    description: 'М\'який оксамитовий велюр · тверда палітурка',
    price: 'від 950 ₴'
  },
  {
    key: 'leather',
    name: 'Шкірзамінник',
    badge: 'Преміум',
    description: 'Преміум екошкіра · тверда палітурка',
    price: 'від 950 ₴'
  },
  {
    key: 'fabric',
    name: 'Тканина',
    badge: 'Преміум',
    description: 'Елегантна тканинна текстура · тверда палітурка',
    price: 'від 950 ₴'
  }
] as const;

const FORMAT_DETAILS = [
  { id: '20×20', name: 'Квадрат 20×20 см', desc: 'Ідеально для Instagram-стилю', ratio: 'aspect-square', width: 'w-12' },
  { id: '25×25', name: 'Квадрат 25×25 см', desc: 'Збільшений квадратний формат', ratio: 'aspect-square', width: 'w-12' },
  { id: '20×30', name: 'Портрет 20×30 см', desc: 'Класичні пропорції книги', ratio: 'aspect-[2/3]', width: 'w-10' },
  { id: '30×20', name: 'Альбомна 30×20 см', desc: 'Для пейзажів та подорожей', ratio: 'aspect-[3/2]', width: 'w-14' },
  { id: '30×30', name: 'Великий квадрат 30×30 см', desc: 'Преміум фотокнига', ratio: 'aspect-square', width: 'w-14' },
] as const;

const PAGE_OPTIONS = [
  20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50,
  52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80,
  82, 84, 86, 88, 90, 92, 94, 96, 98, 100
];

const BASE_PRICES: Record<string, Record<string, number>> = {
  printed: {
    '20×20': 800,
    '25×25': 950,
    '20×30': 1115,
    '30×20': 1115,
    '30×30': 1275,
  },
  premium: {
    '20×20': 950,
    '25×25': 1100,
    '20×30': 1450,
    '30×20': 1450,
    '30×30': 1650,
  }
};

const LAYOUTS: Record<LayoutType, { name: string; icon: string; slotsCount: number }> = {
  'full-spread': { name: '1 фото', icon: '■■', slotsCount: 1 },
  'two-photos': { name: '2 фото', icon: '▪▪', slotsCount: 2 },
  'three-photos': { name: '3 фото', icon: '▪▫▫', slotsCount: 3 },
  'four-photos': { name: '4 фото', icon: '▫▫▫▫', slotsCount: 4 },
  'left-page': { name: '1 фото (лівий)', icon: '▪', slotsCount: 1 },
  'right-page': { name: '1 фото (правий)', icon: '▪', slotsCount: 1 },
};

const CANVAS_CONFIGS = {
  // PHOTOBOOKS
  '20×20': {
    label: 'Фотокнига 20×20 см',
    ratio: 1 / 1,
    spreadRatio: 2 / 1,
    orientation: 'square',
    widthCm: 20,
    heightCm: 20,
  },
  '25×25': {
    label: 'Фотокнига 25×25 см',
    ratio: 1 / 1,
    spreadRatio: 2 / 1,
    orientation: 'square',
    widthCm: 25,
    heightCm: 25,
  },
  '20×30': {
    label: 'Фотокнига 20×30 см (портрет)',
    ratio: 2 / 3,
    spreadRatio: 4 / 3,
    orientation: 'portrait',
    widthCm: 20,
    heightCm: 30,
  },
  '30×20': {
    label: 'Фотокнига 30×20 см (альбом)',
    ratio: 3 / 2,
    spreadRatio: 3 / 1,
    orientation: 'landscape',
    widthCm: 30,
    heightCm: 20,
  },
  '30×30': {
    label: 'Фотокнига 30×30 см',
    ratio: 1 / 1,
    spreadRatio: 2 / 1,
    orientation: 'square',
    widthCm: 30,
    heightCm: 30,
  },
  // MAGAZINE
  'A4': {
    label: 'Журнал A4 (21×29.7 см)',
    ratio: 21 / 29.7,
    spreadRatio: 42 / 29.7,
    orientation: 'portrait',
    widthCm: 21,
    heightCm: 29.7,
  },
} as const;

const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ₴';
};

interface ConstructorConfig {
  productType: 'photobook' | 'magazine';
  coverType?: string;
  coverTypeLabel?: string;
  size: string;
  pages: number;
  totalPrice: number;
}

export default function PhotobookConstructorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Constructor config from sessionStorage
  const [constructorConfig, setConstructorConfig] = useState<ConstructorConfig | null>(null);
  const [loadedFromSession, setLoadedFromSession] = useState(false);

  // Step tracking
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Cover Type
  const [coverType, setCoverType] = useState<CoverType>(null);

  // Step 2: Format
  const [format, setFormat] = useState<FormatId>(null);

  // Step 3: Pages & Extras
  const [pages, setPages] = useState<number>(20);
  const [lamination, setLamination] = useState<'none' | 'glossy' | 'matte'>('none');
  const [tracingPaper, setTracingPaper] = useState<boolean>(false);
  const [endpapers, setEndpapers] = useState<boolean>(false);
  const [qrCode, setQrCode] = useState<boolean>(false);
  const [customText, setCustomText] = useState<boolean>(false);

  // Step 4: Visual Editor
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [draggingPhoto, setDraggingPhoto] = useState<PhotoFile | null>(null);

  // Contact form
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<string>('Нова Пошта (відділення або кур\'єр)');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Оплата після затвердження макету (на картку)');
  const [comment, setComment] = useState('');

  // UI state
  const [showPreCheckoutModal, setShowPreCheckoutModal] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const totalSteps = 4;

  // Load constructor config from sessionStorage on mount
  React.useEffect(() => {
    const configStr = sessionStorage.getItem('constructorConfig');
    if (configStr) {
      try {
        const config: ConstructorConfig = JSON.parse(configStr);
        setConstructorConfig(config);
        setLoadedFromSession(true);

        // Pre-populate wizard fields
        if (config.productType === 'photobook' && config.coverType) {
          setCoverType(config.coverType as CoverType);
        }
        setFormat(config.size as FormatId);
        setPages(config.pages);

        // Skip wizard and go directly to editor
        initializeSpreads(config.pages);
        setStep(4);
      } catch (e) {
        console.error('Failed to load constructor config', e);
      }
    }
  }, []);

  // Initialize spreads when entering step 4
  const initializeSpreads = (pageCount = pages) => {
    const spreadCount = pageCount / 2;
    const newSpreads: Spread[] = [];
    for (let i = 0; i < spreadCount; i++) {
      newSpreads.push({
        index: i,
        layout: 'full-spread',
        slots: [{ photo: null }]
      });
    }
    setSpreads(newSpreads);
  };

  const handleNext = () => {
    if (step === 1 && coverType) setStep(2);
    else if (step === 2 && format) setStep(3);
    else if (step === 3 && pages) {
      // Save config when completing wizard
      const coverTypeLabel = COVER_TYPES.find(c => c.key === coverType)?.name || '';
      const config: ConstructorConfig = {
        productType: 'photobook',
        coverType: coverType || 'printed',
        coverTypeLabel,
        size: format || '20×20',
        pages,
        totalPrice: basePrice
      };
      setConstructorConfig(config);
      sessionStorage.setItem('constructorConfig', JSON.stringify(config));

      initializeSpreads();
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as any);
  };

  const isNextDisabled =
    (step === 1 && !coverType) ||
    (step === 2 && !format) ||
    (step === 3 && !pages);

  // Pricing calculations
  const isPremiumCover = coverType && ['velour', 'leather', 'fabric'].includes(coverType);
  const priceCategory = isPremiumCover ? 'premium' : 'printed';
  const basePrice = coverType && format ? (BASE_PRICES[priceCategory][format] || 0) : 0;

  const laminationPrice = lamination !== 'none' ? 5 * pages : 0;
  const endpapersPrice = endpapers ? 200 : 0;
  const qrCodePrice = qrCode ? 50 : 0;
  const customTextPrice = customText ? 50 : 0;

  const extrasTotal = laminationPrice + endpapersPrice + qrCodePrice + customTextPrice;
  const totalPrice = basePrice + extrasTotal;

  const minPhotos = Math.floor(pages / 2);

  // Photo handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substring(7)
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter(p => p.id !== photoId);
    });

    // Remove photo from spreads
    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot =>
        slot.photo?.id === photoId ? { photo: null } : slot
      )
    })));
  };

  const handleDragStart = (photo: PhotoFile) => {
    setDraggingPhoto(photo);
  };

  const handleDragEnd = () => {
    setDraggingPhoto(null);
  };

  const handleSlotDrop = (slotIndex: number) => {
    if (!draggingPhoto) return;

    setSpreads(prev => {
      const newSpreads = [...prev];
      const currentSpread = newSpreads[currentSpreadIndex];

      // If slot already has a photo, swap it back to gallery (just remove it)
      if (currentSpread.slots[slotIndex].photo) {
        currentSpread.slots[slotIndex] = { photo: null };
      }

      // Place the dragged photo
      currentSpread.slots[slotIndex] = { photo: draggingPhoto };

      return newSpreads;
    });

    setDraggingPhoto(null);
  };

  const handleSlotClick = (slotIndex: number) => {
    const currentSpread = spreads[currentSpreadIndex];
    if (currentSpread.slots[slotIndex].photo) {
      // Remove photo from slot
      setSpreads(prev => {
        const newSpreads = [...prev];
        newSpreads[currentSpreadIndex].slots[slotIndex] = { photo: null };
        return newSpreads;
      });
    } else {
      // Open file picker
      fileInputRef.current?.click();
    }
  };

  const changeLayout = (layout: LayoutType) => {
    setSpreads(prev => {
      const newSpreads = [...prev];
      const currentSpread = newSpreads[currentSpreadIndex];
      const oldPhotos = currentSpread.slots.map(s => s.photo).filter(Boolean);

      const slotsCount = LAYOUTS[layout].slotsCount;
      const newSlots: PhotoSlot[] = [];

      for (let i = 0; i < slotsCount; i++) {
        newSlots.push({ photo: oldPhotos[i] || null });
      }

      currentSpread.layout = layout;
      currentSpread.slots = newSlots;

      return newSpreads;
    });
  };

  const autoFillPhotos = () => {
    setSpreads(prev => {
      const newSpreads = [...prev];
      let photoIndex = 0;

      newSpreads.forEach(spread => {
        spread.slots.forEach(slot => {
          if (photoIndex < photos.length) {
            slot.photo = photos[photoIndex];
            photoIndex++;
          }
        });
      });

      return newSpreads;
    });
  };

  const handleCheckout = () => {
    // Validate all pages have at least 1 photo
    const allPagesHavePhotos = spreads.every(spread =>
      spread.slots.some(slot => slot.photo !== null)
    );

    if (!allPagesHavePhotos) {
      if (confirm('Деякі сторінки без фото. Продовжити без заповнення? Ми оберемо розташування самі.')) {
        setShowPreCheckoutModal(true);
      }
      return;
    }

    setShowPreCheckoutModal(true);
  };

  const handleGoToCatalog = () => {
    // Save to sessionStorage and navigate
    sessionStorage.setItem('pendingPhotobookOrder', JSON.stringify({
      coverType, format, pages, lamination, tracingPaper, endpapers, qrCode, customText,
      totalPrice
    }));
    window.location.href = '/catalog';
  };

  const handleShowContactForm = () => {
    setShowPreCheckoutModal(false);
    setShowContactForm(true);
  };

  const isFormValid = customerName && phone && email && city;

  const handleSubmitOrder = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);

    try {
      const coverTypeLabel = COVER_TYPES.find(c => c.key === coverType)?.name || '';

      const orderPayload = {
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        items: [{
          product_type: 'photobook',
          product_name: `Фотокнига з ${coverTypeLabel}`,
          cover_type: coverType || undefined,
          format: format || undefined,
          pages: pages,
          quantity: 1,
          unit_price: totalPrice,
          total_price: totalPrice,
          options: {
            lamination,
            tracingPaper,
            endpapers,
            qrCode,
            customText,
            photosCount: photos.length,
            spreads: spreads.map(s => ({
              spread_number: s.index,
              layout: s.layout,
              photos: s.slots.map(slot => slot.photo?.file.name || null)
            }))
          }
        }],
        subtotal: totalPrice,
        delivery_cost: 0,
        total: totalPrice,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress || undefined,
        notes: comment || undefined
      };

      const result = await submitOrder(orderPayload);

      if (result.success) {
        sessionStorage.removeItem('pendingPhotobookOrder');
        setIsSuccess(true);
        window.scrollTo(0, 0);
      } else {
        alert('Помилка при оформленні замовлення: ' + (result.error || 'Невідома помилка'));
      }
    } catch (error) {
      console.error('Order submission failed:', error);
      alert('Помилка при оформленні замовлення. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles: Record<number, string> = {
    1: 'Тип обкладинки',
    2: 'Формат',
    3: 'Сторінки та послуги',
    4: 'Фото та оформлення'
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
        <div className="bg-white p-12 rounded-3xl shadow-lg text-center max-w-xl mx-4 border border-gray-100">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-emerald-100">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" strokeWidth={2.5} />
          </div>
          <h2 className="text-4xl font-extrabold text-gray-900 mb-5">Замовлення прийнято!</h2>
          <p className="text-lg text-gray-500 mb-6">
            Ми зв'яжемось з вами на <strong>{email}</strong> або <strong>{phone}</strong> протягом 2 годин
          </p>
          <p className="text-sm text-gray-400 mb-8">Час роботи: пн–пт, 9:00–18:00</p>
          <Link href="/" className="inline-flex items-center justify-center px-10 py-4 w-full rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition">
            На головну
          </Link>
        </div>
      </div>
    );
  }

  // Visual Editor (Step 4)
  if (step === 4) {
    const currentSpread = spreads[currentSpreadIndex];

    // Get canvas configuration based on size
    const canvasSize = constructorConfig?.size || format || '20×20';
    const canvasConfig = CANVAS_CONFIGS[canvasSize as keyof typeof CANVAS_CONFIGS] || CANVAS_CONFIGS['20×20'];

    // Generate header text based on product type
    let headerText = '';
    if (constructorConfig?.productType === 'magazine') {
      headerText = `Журнал A4 · ${constructorConfig.pages} стор. · ${formatUAH(constructorConfig.totalPrice)}`;
    } else if (constructorConfig) {
      headerText = `Фотокнига · ${constructorConfig.coverTypeLabel || ''} · ${constructorConfig.size} · ${constructorConfig.pages} стор. · ${formatUAH(constructorConfig.totalPrice)}`;
    } else {
      headerText = `Фотокнига · ${format} · ${pages} стор. · Ціна: ${formatUAH(totalPrice)}`;
    }

    return (
      <>
        <Navigation />
        <div className="h-screen flex flex-col bg-gray-50 mt-16">
          {/* Header Bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => {
                if (loadedFromSession) {
                  // If came from product page, show link to change params
                  window.location.href = '/catalog';
                } else {
                  setStep(3);
                }
              }}
              className="flex items-center text-gray-600 hover:text-gray-900 font-semibold"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              {loadedFromSession ? 'Змінити параметри' : 'Назад до налаштувань'}
            </button>

            <div className="text-center">
              <span className="text-lg font-bold text-gray-900">
                {headerText}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
            >
              Оформити замовлення →
            </button>
          </div>

          {/* 3-Panel Layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT PANEL: Photo Gallery */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Ваші фото</h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Додати фото
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-sm text-gray-500 mt-3">
                  {photos.length} фото · потрібно мінімум {minPhotos}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={() => handleDragStart(photo)}
                      onDragEnd={handleDragEnd}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-move hover:border-blue-400 transition ${draggingPhoto?.id === photo.id ? 'opacity-50' : 'border-gray-200'}`}
                    >
                      <Image
                        src={photo.preview}
                        alt="Photo"
                        fill
                        className="object-cover"
                      />
                      <button
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-600 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CENTER CANVAS: Spread Preview */}
            <div className="flex-1 bg-gray-100 flex flex-col items-center justify-center p-8">
              <div className="mb-6">
                <button
                  onClick={autoFillPhotos}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition"
                >
                  Авто-заповнення
                </button>
              </div>

              {currentSpread && (
                <div className="w-full max-w-6xl">
                  {/* Canvas size label */}
                  <div className="text-center text-sm text-gray-600 mb-3">
                    {canvasConfig.widthCm} × {canvasConfig.heightCm} см · Розворот 1:1 масштаб
                  </div>

                  {/* Canvas container with dynamic aspect ratio */}
                  <div
                    className="relative bg-white shadow-2xl rounded-sm mx-auto"
                    style={{
                      aspectRatio: canvasConfig.spreadRatio,
                      maxHeight: 'calc(100vh - 240px)',
                      maxWidth: '100%',
                      width: 'auto',
                      height: 'calc(100vh - 240px)',
                    }}
                  >
                    {/* Center spine line */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300 z-10" />

                    {/* Full spread layout - single photo across both pages */}
                    {currentSpread.layout === 'full-spread' && (
                      <div
                        onDrop={() => handleSlotDrop(0)}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => handleSlotClick(0)}
                        className="absolute inset-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                        style={{ width: '100%', height: '100%' }}
                      >
                        {currentSpread.slots[0]?.photo ? (
                          <Image
                            src={currentSpread.slots[0].photo.preview}
                            alt="Spread photo"
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                            <div className="text-center text-gray-400">
                              <span className="text-4xl">📷</span>
                              <p className="text-sm mt-2">Перетягніть фото на розворот</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Two photos layout - one on each page */}
                    {currentSpread.layout === 'two-photos' && (
                      <>
                        {/* Left page photo */}
                        <div
                          onDrop={() => handleSlotDrop(0)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(0)}
                          className="absolute top-0 left-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '100%' }}
                        >
                          {currentSpread.slots[0]?.photo ? (
                            <Image
                              src={currentSpread.slots[0].photo.preview}
                              alt="Left page photo"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-2xl">📷</span>
                                <p className="text-xs mt-1">Ліва сторінка</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right page photo */}
                        <div
                          onDrop={() => handleSlotDrop(1)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(1)}
                          className="absolute top-0 right-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '100%' }}
                        >
                          {currentSpread.slots[1]?.photo ? (
                            <Image
                              src={currentSpread.slots[1].photo.preview}
                              alt="Right page photo"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-2xl">📷</span>
                                <p className="text-xs mt-1">Права сторінка</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Three photos layout - left page full, right page split top/bottom */}
                    {currentSpread.layout === 'three-photos' && (
                      <>
                        {/* Left page - full photo */}
                        <div
                          onDrop={() => handleSlotDrop(0)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(0)}
                          className="absolute top-0 left-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '100%' }}
                        >
                          {currentSpread.slots[0]?.photo ? (
                            <Image
                              src={currentSpread.slots[0].photo.preview}
                              alt="Photo 1"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-2xl">📷</span>
                                <p className="text-xs mt-1">Фото 1</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right page top - photo 2 */}
                        <div
                          onDrop={() => handleSlotDrop(1)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(1)}
                          className="absolute top-0 right-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '50%' }}
                        >
                          {currentSpread.slots[1]?.photo ? (
                            <Image
                              src={currentSpread.slots[1].photo.preview}
                              alt="Photo 2"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-xl">📷</span>
                                <p className="text-xs mt-1">Фото 2</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right page bottom - photo 3 */}
                        <div
                          onDrop={() => handleSlotDrop(2)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(2)}
                          className="absolute bottom-0 right-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '50%' }}
                        >
                          {currentSpread.slots[2]?.photo ? (
                            <Image
                              src={currentSpread.slots[2].photo.preview}
                              alt="Photo 3"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-xl">📷</span>
                                <p className="text-xs mt-1">Фото 3</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Four photos layout - 2x2 grid */}
                    {currentSpread.layout === 'four-photos' && (
                      <>
                        {/* Top-left */}
                        <div
                          onDrop={() => handleSlotDrop(0)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(0)}
                          className="absolute top-0 left-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '50%' }}
                        >
                          {currentSpread.slots[0]?.photo ? (
                            <Image
                              src={currentSpread.slots[0].photo.preview}
                              alt="Photo 1"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-xl">📷</span>
                                <p className="text-xs mt-1">Фото 1</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Top-right */}
                        <div
                          onDrop={() => handleSlotDrop(1)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(1)}
                          className="absolute top-0 right-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '50%' }}
                        >
                          {currentSpread.slots[1]?.photo ? (
                            <Image
                              src={currentSpread.slots[1].photo.preview}
                              alt="Photo 2"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-xl">📷</span>
                                <p className="text-xs mt-1">Фото 2</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom-left */}
                        <div
                          onDrop={() => handleSlotDrop(2)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(2)}
                          className="absolute bottom-0 left-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '50%' }}
                        >
                          {currentSpread.slots[2]?.photo ? (
                            <Image
                              src={currentSpread.slots[2].photo.preview}
                              alt="Photo 3"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-xl">📷</span>
                                <p className="text-xs mt-1">Фото 3</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom-right */}
                        <div
                          onDrop={() => handleSlotDrop(3)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(3)}
                          className="absolute bottom-0 right-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '50%' }}
                        >
                          {currentSpread.slots[3]?.photo ? (
                            <Image
                              src={currentSpread.slots[3].photo.preview}
                              alt="Photo 4"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-xl">📷</span>
                                <p className="text-xs mt-1">Фото 4</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Left page only layout */}
                    {currentSpread.layout === 'left-page' && (
                      <>
                        {/* Left page - active */}
                        <div
                          onDrop={() => handleSlotDrop(0)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(0)}
                          className="absolute top-0 left-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '100%' }}
                        >
                          {currentSpread.slots[0]?.photo ? (
                            <Image
                              src={currentSpread.slots[0].photo.preview}
                              alt="Left page photo"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-2xl">📷</span>
                                <p className="text-xs mt-1">Ліва сторінка</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right page - empty */}
                        <div
                          className="absolute top-0 right-0 bg-white"
                          style={{ width: '50%', height: '100%' }}
                        />
                      </>
                    )}

                    {/* Right page only layout */}
                    {currentSpread.layout === 'right-page' && (
                      <>
                        {/* Left page - empty */}
                        <div
                          className="absolute top-0 left-0 bg-white"
                          style={{ width: '50%', height: '100%' }}
                        />

                        {/* Right page - active */}
                        <div
                          onDrop={() => handleSlotDrop(0)}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleSlotClick(0)}
                          className="absolute top-0 right-0 bg-gray-50 cursor-pointer hover:bg-blue-50/30 transition overflow-hidden group"
                          style={{ width: '50%', height: '100%' }}
                        >
                          {currentSpread.slots[0]?.photo ? (
                            <Image
                              src={currentSpread.slots[0].photo.preview}
                              alt="Right page photo"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-blue-400">
                              <div className="text-center text-gray-400">
                                <span className="text-2xl">📷</span>
                                <p className="text-xs mt-1">Права сторінка</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center gap-4 mt-6">
                <button
                  onClick={() => setCurrentSpreadIndex(Math.max(0, currentSpreadIndex - 1))}
                  disabled={currentSpreadIndex === 0}
                  className="p-2 rounded-lg bg-white shadow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="flex gap-2">
                  {spreads.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSpreadIndex(idx)}
                      className={`w-3 h-3 rounded-full transition ${idx === currentSpreadIndex ? 'bg-blue-600' : 'bg-gray-300'}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setCurrentSpreadIndex(Math.min(spreads.length - 1, currentSpreadIndex + 1))}
                  disabled={currentSpreadIndex === spreads.length - 1}
                  className="p-2 rounded-lg bg-white shadow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mt-3">
                Розворот {currentSpreadIndex + 1} з {spreads.length}
              </p>
            </div>

            {/* RIGHT PANEL: Layout Selector */}
            <div className="w-72 bg-white border-l border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Макет розвороту</h3>

              <div className="space-y-3">
                {(Object.keys(LAYOUTS) as LayoutType[]).map((layoutKey) => (
                  <button
                    key={layoutKey}
                    onClick={() => changeLayout(layoutKey)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition ${
                      currentSpread?.layout === layoutKey
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">{LAYOUTS[layoutKey].name}</span>
                      <span className="text-2xl font-mono">{LAYOUTS[layoutKey].icon}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pre-checkout Modal */}
          {showPreCheckoutModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Бажаєте додати щось ще до замовлення?
                </h3>
                <p className="text-gray-600 mb-6">
                  Ви можете обрати інші товари в каталозі
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleGoToCatalog}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
                  >
                    Так, перейти до каталогу
                  </button>
                  <button
                    onClick={handleShowContactForm}
                    className="w-full py-3 bg-white text-gray-700 rounded-xl font-bold border-2 border-gray-200 hover:bg-gray-50 transition"
                  >
                    Ні, оформити замовлення
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contact Form */}
          {showContactForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Контактна інформація</h3>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Ім'я та прізвище *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Номер телефону *</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+380__"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Місто *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Спосіб доставки *</label>
                    <select
                      value={deliveryMethod}
                      onChange={(e) => setDeliveryMethod(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option>Нова Пошта (відділення або кур'єр)</option>
                      <option>Укрпошта</option>
                      <option>Самовивіз (м. Тернопіль)</option>
                    </select>
                  </div>

                  {deliveryMethod !== 'Самовивіз (м. Тернопіль)' && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Відділення / адреса</label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Відділення №5 або вул. Прикладна, 10"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Спосіб оплати *</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option>Оплата після затвердження макету (на картку)</option>
                      <option>Накладений платіж (+20 ₴)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Коментар</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder="Побажання до замовлення..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowContactForm(false)}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition"
                    >
                      Скасувати
                    </button>
                    <button
                      onClick={handleSubmitOrder}
                      disabled={!isFormValid || isSubmitting}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Обробка...' : 'Надіслати замовлення →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <Footer categories={[]} />
      </>
    );
  }

  // Steps 1-3 (Wizard)
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans mt-20">
        <div className="max-w-5xl mx-auto">

          {/* Header & Progress */}
          <div className="mb-10">
            <Link href="/catalog" className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center mb-6 transition w-max">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              До каталогу
            </Link>

            <h1 className="text-3xl font-extrabold text-gray-900 mb-6">
              Створіть свою фотокнигу
            </h1>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center text-sm font-medium text-gray-500 mb-4">
                <span className="text-gray-900 font-bold uppercase text-xs border border-gray-200 px-3.5 py-1.5 rounded-full bg-white shadow-sm">
                  Крок {step} <span className="px-1 text-gray-300">|</span> {stepTitles[step]}
                </span>
                <span className="font-semibold text-gray-400">{Math.round((step / totalSteps) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${(step / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 md:p-10">

            {/* STEP 1: Cover Type */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Оберіть тип обкладинки</h2>
                <p className="text-gray-500 mb-8 font-medium">Виберіть обкладинку для вашої фотокниги</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {COVER_TYPES.map((cover) => (
                    <button
                      key={cover.key}
                      onClick={() => setCoverType(cover.key as CoverType)}
                      className={`relative text-left p-8 rounded-2xl border-2 transition-all duration-300 flex flex-col h-full group hover:shadow-lg
                        ${coverType === cover.key
                          ? 'border-blue-600 ring-4 ring-blue-600/10 shadow-lg scale-[1.02]'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {coverType === cover.key && (
                        <div className="absolute top-5 right-5 text-blue-600">
                          <CheckCircle2 className="w-7 h-7 fill-white" />
                        </div>
                      )}
                      <span className={`inline-block px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider rounded-full mb-6 max-w-max
                        ${coverType === cover.key ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'}
                      `}>
                        {cover.badge}
                      </span>

                      <h3 className="text-2xl font-extrabold text-gray-900 mb-3">{cover.name}</h3>
                      <p className="text-gray-600 mb-10 leading-relaxed font-medium flex-grow">
                        {cover.description}
                      </p>

                      <div className="pt-2 border-t border-gray-100">
                        <div className="text-lg font-black text-gray-900">{cover.price}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Format */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Оберіть формат</h2>
                <p className="text-gray-500 mb-8 font-medium">
                  Виберіть розмір вашої фотокниги
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {FORMAT_DETAILS.map((f) => {
                    const isSelected = format === f.id;
                    const priceCategory = isPremiumCover ? 'premium' : 'printed';
                    const price = BASE_PRICES[priceCategory][f.id] || 0;

                    return (
                      <button
                        key={f.id}
                        onClick={() => setFormat(f.id as FormatId)}
                        className={`flex items-start p-6 rounded-2xl border-2 text-left transition-all group hover:shadow-lg
                          ${isSelected
                            ? 'border-blue-600 bg-blue-50/20 shadow-lg ring-4 ring-blue-600/10 scale-[1.02]'
                            : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                      >
                        <div className="mr-6 mt-1 flex flex-col items-center justify-center w-16 flex-shrink-0">
                          <div className={`${f.width} ${f.ratio} border-2 rounded-md shadow-sm transition
                            ${isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-white'}
                          `} />
                        </div>

                        <div className="flex-1 pr-2">
                          <h4 className="font-extrabold text-gray-900 text-lg mb-1.5">{f.name}</h4>
                          <p className="text-sm text-gray-500 mb-4 font-medium">{f.desc}</p>
                          <div className="text-xs font-bold uppercase text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg inline-block border border-gray-100">
                            від <span className="text-gray-900 font-extrabold ml-1">{formatUAH(price)}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex-shrink-0 text-blue-600 ml-1 mt-1">
                            <CheckCircle2 className="w-6 h-6 fill-white" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: Pages & Extras */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Сторінки та додаткові послуги</h2>
                <p className="text-gray-500 mb-8 font-medium">Оберіть кількість сторінок та додаткові опції</p>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                  <div className="lg:col-span-7 space-y-10">

                    {/* Page Count */}
                    <div>
                      <div className="flex justify-between items-end mb-4">
                        <h3 className="text-lg font-extrabold text-gray-900">Кількість сторінок</h3>
                        <span className="text-3xl font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl">{pages}</span>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mb-6">
                          {PAGE_OPTIONS.map(p => (
                            <button
                              key={p}
                              onClick={() => setPages(p)}
                              className={`py-2 rounded-xl text-sm font-bold transition-all
                                ${pages === p
                                  ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-600/20 scale-105'
                                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-blue-400 hover:text-blue-700'
                                }
                              `}
                            >
                              {p}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-start text-sm text-gray-600 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                          <Info className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-blue-500" />
                          <div>
                            <p className="font-bold text-blue-900 mb-1">Мінімум 20 сторінок · Максимум 100 сторінок · Парне число</p>
                            <p className="font-medium text-blue-800/80">Кожен розворот = 2 сторінки. {pages} сторінок ≈ {pages}–{pages * 2} фото.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Extras */}
                    <div>
                      <h3 className="text-lg font-extrabold text-gray-900 mb-4">Додаткові послуги</h3>

                      <div className="space-y-4">
                        {/* Lamination */}
                        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-extrabold text-gray-900 text-base mb-1">Ламінація</h4>
                              <p className="text-sm font-medium text-gray-500">Захист сторінок з преміум покриттям (5 ₴/стор.)</p>
                            </div>
                            {lamination !== 'none' && (
                              <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                                +{formatUAH(laminationPrice)}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-4">
                            {[
                              { value: 'none', label: 'Без ламінації' },
                              { value: 'glossy', label: 'Глянець' },
                              { value: 'matte', label: 'Матова' }
                            ].map((type) => (
                              <label key={type.value} className="flex items-center gap-2 cursor-pointer group">
                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center transition
                                  ${lamination === type.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400 bg-white'}
                                `}>
                                  {lamination === type.value && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={4} />}
                                </span>
                                <span className={`text-sm font-bold ${lamination === type.value ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {type.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Tracing Paper (only for non-printed covers) */}
                        {coverType !== 'printed' && (
                          <label className={`flex items-start p-6 rounded-2xl border transition-all cursor-pointer group shadow-sm
                            ${tracingPaper ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-600/10' : 'border-gray-200 bg-white hover:border-blue-300'}
                          `}>
                            <div className={`mt-0.5 w-6 h-6 rounded-md border flex-shrink-0 flex items-center justify-center transition
                              ${tracingPaper ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400 bg-gray-50'}
                            `}>
                              {tracingPaper && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                            </div>
                            <div className="ml-4 flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className={`font-extrabold ${tracingPaper ? 'text-blue-900' : 'text-gray-900'}`}>
                                  Калька між сторінками
                                </h4>
                                <span className="text-sm text-gray-500 italic">ціна уточнюється</span>
                              </div>
                              <p className="text-sm font-medium text-gray-500">Декоративна калька між кожною сторінкою</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={tracingPaper}
                              onChange={(e) => setTracingPaper(e.target.checked)}
                              className="hidden"
                            />
                          </label>
                        )}

                        {/* Other Extras */}
                        {[
                          { id: 'endpapers', state: endpapers, setter: setEndpapers, title: 'Форзаци', price: 200, desc: 'Декоративні внутрішні обкладинки на початку та в кінці' },
                          { id: 'qrCode', state: qrCode, setter: setQrCode, title: 'QR-код на обкладинці', price: 50, desc: 'Посилання на відео, музику або сайт у вигляді QR-коду' },
                          { id: 'customText', state: customText, setter: setCustomText, title: 'Текст на обкладинці', price: 50, desc: 'Персональний напис на обкладинці (тиснення або друк)' }
                        ].map((extra) => (
                          <label key={extra.id} className={`flex items-start p-6 rounded-2xl border transition-all cursor-pointer group shadow-sm
                            ${extra.state ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-600/10' : 'border-gray-200 bg-white hover:border-blue-300'}
                          `}>
                            <div className={`mt-0.5 w-6 h-6 rounded-md border flex-shrink-0 flex items-center justify-center transition
                              ${extra.state ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400 bg-gray-50'}
                            `}>
                              {extra.state && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                            </div>
                            <div className="ml-4 flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className={`font-extrabold ${extra.state ? 'text-blue-900' : 'text-gray-900'}`}>
                                  {extra.title}
                                </h4>
                                <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                                  +{formatUAH(extra.price)}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-gray-500">{extra.desc}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={extra.state}
                              onChange={(e) => extra.setter(e.target.checked)}
                              className="hidden"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right side Summary */}
                  <div className="lg:col-span-5">
                    <div className="bg-gray-900 rounded-3xl p-8 text-white sticky top-24 shadow-2xl">
                      <h3 className="text-xl font-bold mb-8 text-gray-300 uppercase text-center border-b border-gray-800 pb-4">
                        Підрахунок вартості
                      </h3>

                      <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-start font-medium">
                          <span className="text-gray-300">Базова ціна ({pages} стор.)</span>
                          <span className="text-white font-bold">{formatUAH(basePrice)}</span>
                        </div>

                        {lamination !== 'none' && (
                          <div className="flex justify-between items-start text-sm text-gray-400">
                            <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-gray-500" /> Ламінація</span>
                            <span>{formatUAH(laminationPrice)}</span>
                          </div>
                        )}

                        {endpapers && (
                          <div className="flex justify-between items-start text-sm text-gray-400">
                            <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-gray-500" /> Форзаци</span>
                            <span>{formatUAH(endpapersPrice)}</span>
                          </div>
                        )}

                        {qrCode && (
                          <div className="flex justify-between items-start text-sm text-gray-400">
                            <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-gray-500" /> QR-код</span>
                            <span>{formatUAH(qrCodePrice)}</span>
                          </div>
                        )}

                        {customText && (
                          <div className="flex justify-between items-start text-sm text-gray-400">
                            <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-gray-500" /> Текст на обкладинці</span>
                            <span>{formatUAH(customTextPrice)}</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-white rounded-2xl p-5 shadow-inner">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-500 font-extrabold uppercase text-xs mb-1">Разом</span>
                          <span className="text-4xl font-black text-gray-900">
                            {formatUAH(totalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {step < 4 && (
              <div className="mt-10 pt-6 border-t border-gray-100 flex items-center justify-between">
                {step > 1 ? (
                  <button
                    onClick={handleBack}
                    className="flex items-center px-5 py-3.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-bold transition"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" strokeWidth={2.5} />
                    Назад
                  </button>
                ) : <div />}

                <button
                  onClick={handleNext}
                  disabled={isNextDisabled}
                  className={`flex items-center px-10 py-4 rounded-xl font-bold transition-all shadow-sm text-lg
                    ${isNextDisabled
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg active:scale-[0.98]'}
                  `}
                >
                  Продовжити
                  <ChevronRight className="w-6 h-6 ml-1.5" strokeWidth={3} />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
      <Footer categories={[]} />
    </>
  );
}
