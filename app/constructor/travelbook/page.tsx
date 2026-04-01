'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import SmartModeSelector from '@/components/SmartModeSelector'
import SmartModeProcessor from '@/components/SmartModeProcessor'

// Travel Book pricing
const TRAVEL_BOOK_PRICES: Record<number, number> = {
  12: 550,
  16: 700,
  20: 850,
  24: 1000,
  28: 1150,
  32: 1300,
  36: 1450,
  40: 1600,
  44: 1750,
  48: 1900,
  52: 2025,
  60: 2225,
  72: 2525,
  80: 2775,
}

const PAGE_OPTIONS = [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80]

interface Extras {
  lamination: boolean
  laminationType: 'glossy' | 'matte'
  endpapers: boolean
  qrCode: boolean
  coverText: boolean
  coverTextContent: string
}

interface OrderData {
  name: string
  phone: string
  email: string
  delivery: 'pickup' | 'nova_poshta'
  city: string
  branch: string
  comment: string
  promoCode: string
}

export default function TravelBookConstructor() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<0 | 'smart' | 1 | 2 | 3>(0)
  const [smartFiles, setSmartFiles] = useState<File[]>([])
  const [selectedPages, setSelectedPages] = useState(24)
  const [extras, setExtras] = useState<Extras>({
    lamination: false,
    laminationType: 'glossy',
    endpapers: false,
    qrCode: false,
    coverText: false,
    coverTextContent: '',
  })
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([])
  const [orderData, setOrderData] = useState<OrderData>({
    name: '',
    phone: '',
    email: '',
    delivery: 'pickup',
    city: '',
    branch: '',
    comment: '',
    promoCode: '',
  })
  const [orderSuccess, setOrderSuccess] = useState(false)

  // Calculate prices
  const basePrice = TRAVEL_BOOK_PRICES[selectedPages] || 0
  const laminationPrice = extras.lamination ? selectedPages * 5 : 0
  const endpapersPrice = extras.endpapers ? 100 : 0
  const qrCodePrice = extras.qrCode ? 50 : 0
  const coverTextPrice = extras.coverText ? 50 : 0
  const totalPrice = basePrice + laminationPrice + endpapersPrice + qrCodePrice + coverTextPrice

  const minFiles = Math.ceil(selectedPages / 2)
  const maxFiles = selectedPages

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedPhotos(prev => [...prev, ...files].slice(0, maxFiles))
  }, [maxFiles])

  const removePhoto = useCallback((index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmitOrder = async () => {
    // Here you would send the order to your backend
    console.log('Order submitted:', {
      pages: selectedPages,
      extras,
      photos: uploadedPhotos.length,
      orderData,
      totalPrice,
    })
    setOrderSuccess(true)
  }

  const isFormValid = () => {
    return (
      orderData.name.trim() !== '' &&
      orderData.phone.trim() !== '' &&
      orderData.email.includes('@') &&
      (orderData.delivery === 'pickup' || (orderData.city.trim() !== '' && orderData.branch.trim() !== '')) &&
      uploadedPhotos.length >= minFiles &&
      uploadedPhotos.length <= maxFiles
    )
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#2D4A3E] to-[#C4704F] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">🌍</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-3">
            Дякуємо! Ваше замовлення прийнято.
          </h2>
          <p className="text-gray-600 mb-2">
            Менеджер зв'яжеться з вами протягом 1 години для підтвердження.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            ⏱ Час виготовлення: 10–14 робочих днів після підтвердження оплати.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-[#C4704F] text-white font-semibold rounded-lg hover:bg-[#b36445] transition-colors"
          >
            Повернутись на головну
          </button>
        </div>
      </div>
    )
  }

  // Step 0: Mode selection
  if (currentStep === 0) {
    return (
      <SmartModeSelector
        productTitle="Тревел Бук"
        onSmartUpload={(files) => {
          setSmartFiles(files)
          setCurrentStep('smart')
        }}
        onManualSelect={() => setCurrentStep(1)}
      />
    )
  }

  // Smart mode: AI processing pipeline
  if (currentStep === 'smart') {
    return (
      <SmartModeProcessor
        files={smartFiles}
        productType="travelbook"
        onComplete={(keptFiles) => {
          setUploadedPhotos(keptFiles)
          setCurrentStep(3)
        }}
        onCancel={() => setCurrentStep(0)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Hero Banner */}
      <div
        className="relative h-[220px] flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #2D4A3E 0%, #6B4226 50%, #C4704F 100%)',
        }}
      >
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10" />
        <div className="relative z-10 text-center text-white px-4">
          <h1 className="text-4xl font-extrabold mb-2">Тревел Бук</h1>
          <p className="text-white/70 text-base mb-3">
            Ваша подорож — у форматі книги з твердою обкладинкою
          </p>
          <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-4 py-1 text-sm">
            🌍 A4 · Тверда обкладинка · 170g глянець
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Сторінки' },
              { num: 2, label: 'Опції' },
              { num: 3, label: 'Фото та замовлення' },
            ].map((step, idx) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      (currentStep as number) > step.num
                        ? 'bg-[#2D4A3E] text-white'
                        : currentStep === step.num
                        ? 'bg-[#C4704F] text-white'
                        : 'border-2 border-gray-300 text-gray-400'
                    }`}
                  >
                    {(currentStep as number) > step.num ? <Check className="w-5 h-5" /> : step.num}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      (currentStep as number) >= step.num ? 'text-[#1A1A1A]' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < 2 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors ${
                      (currentStep as number) > step.num ? 'bg-[#2D4A3E]' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* STEP 1: Page Selection */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-[#1A1A1A] text-center mb-6">
              Скільки сторінок у вашій книзі?
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {PAGE_OPTIONS.map(pages => (
                <button
                  key={pages}
                  onClick={() => setSelectedPages(pages)}
                  className={`p-4 rounded-xl text-center transition-all duration-150 ${
                    selectedPages === pages
                      ? 'border-2 border-[#C4704F] bg-[#FDF0EB] text-[#C4704F]'
                      : 'border-2 border-gray-200 bg-white hover:border-[#C4704F]'
                  }`}
                >
                  <div className="text-2xl font-bold mb-1">{pages}</div>
                  <div className="text-sm font-semibold mb-1">
                    {TRAVEL_BOOK_PRICES[pages]} ₴
                  </div>
                  <div className="text-xs text-gray-500">
                    ≈ {Math.ceil(pages / 2)}–{pages} фото
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                📖 <strong>Порада:</strong> 1 сторінка = 1 аркуш. 24 сторінки — це 12
                розворотів, ідеально для 20–30 найкращих кадрів вашої подорожі.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-8 py-3 bg-[#C4704F] text-white font-semibold rounded-lg hover:bg-[#b36445] transition-colors"
              >
                Продовжити →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Extras & Live Price */}
        {currentStep === 2 && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-3xl font-bold text-[#1A1A1A] mb-6">
                Оберіть додаткові опції
              </h2>

              {/* Lamination */}
              <div className="bg-white rounded-xl p-5 border-l-4 border-[#C4704F]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">Ламінування</h3>
                    <p className="text-sm text-gray-600">
                      Захищає сторінки від вологи та подряпин
                    </p>
                  </div>
                  <label className="relative inline-block w-12 h-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extras.lamination}
                      onChange={e =>
                        setExtras({ ...extras, lamination: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-full h-full bg-gray-200 peer-checked:bg-[#C4704F] rounded-full transition-colors"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                  </label>
                </div>
                {extras.lamination && (
                  <div className="flex gap-3 mt-3">
                    {['glossy', 'matte'].map(type => (
                      <label
                        key={type}
                        className="flex-1 flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="laminationType"
                          checked={extras.laminationType === type}
                          onChange={() =>
                            setExtras({
                              ...extras,
                              laminationType: type as 'glossy' | 'matte',
                            })
                          }
                          className="w-4 h-4 text-[#C4704F]"
                        />
                        <span className="text-sm">
                          {type === 'glossy' ? 'Глянцеве' : 'Матове'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {extras.lamination && (
                  <div className="mt-2 text-sm font-semibold text-[#C4704F]">
                    +{laminationPrice} ₴ (5 ₴ × {selectedPages})
                  </div>
                )}
              </div>

              {/* Endpapers */}
              <div className="bg-white rounded-xl p-5 border-l-4 border-[#C4704F]">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">Форзаци</h3>
                    <p className="text-sm text-gray-600">
                      Декоративні внутрішні обкладинки — бархатиста текстура, завершений
                      вигляд
                    </p>
                    {extras.endpapers && (
                      <div className="mt-2 text-sm font-semibold text-[#C4704F]">
                        +100 ₴
                      </div>
                    )}
                  </div>
                  <label className="relative inline-block w-12 h-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extras.endpapers}
                      onChange={e => setExtras({ ...extras, endpapers: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-full h-full bg-gray-200 peer-checked:bg-[#C4704F] rounded-full transition-colors"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                  </label>
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-white rounded-xl p-5 border-l-4 border-[#C4704F]">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">
                      QR-код на обкладинці
                    </h3>
                    <p className="text-sm text-gray-600">
                      Посилання на плейлист, відео або слайд-шоу — скануй і повертайся у
                      подорож
                    </p>
                    {extras.qrCode && (
                      <div className="mt-2 text-sm font-semibold text-[#C4704F]">+50 ₴</div>
                    )}
                  </div>
                  <label className="relative inline-block w-12 h-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extras.qrCode}
                      onChange={e => setExtras({ ...extras, qrCode: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-full h-full bg-gray-200 peer-checked:bg-[#C4704F] rounded-full transition-colors"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                  </label>
                </div>
              </div>

              {/* Cover Text */}
              <div className="bg-white rounded-xl p-5 border-l-4 border-[#C4704F]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">
                      Текст на обкладинці
                    </h3>
                    <p className="text-sm text-gray-600">
                      Назва книги, дата або підпис — друкується тисненням на обкладинці
                    </p>
                  </div>
                  <label className="relative inline-block w-12 h-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extras.coverText}
                      onChange={e => setExtras({ ...extras, coverText: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-full h-full bg-gray-200 peer-checked:bg-[#C4704F] rounded-full transition-colors"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                  </label>
                </div>
                {extras.coverText && (
                  <>
                    <input
                      type="text"
                      maxLength={60}
                      value={extras.coverTextContent}
                      onChange={e =>
                        setExtras({ ...extras, coverTextContent: e.target.value })
                      }
                      placeholder="Наприклад: Греція 2024 · Наша перша подорож"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C4704F] focus:border-transparent"
                    />
                    <div className="mt-2 text-sm font-semibold text-[#C4704F]">+50 ₴</div>
                  </>
                )}
              </div>
            </div>

            {/* Price Summary - Sticky on Desktop */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-5 border-2 border-[#C4704F] sticky top-4">
                <h3 className="font-bold text-lg mb-4 text-[#1A1A1A]">🧾 Ваше замовлення</h3>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Тревел бук, {selectedPages} стор.
                    </span>
                    <span className="font-semibold">{basePrice} ₴</span>
                  </div>
                  {extras.lamination && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ламінування</span>
                      <span className="font-semibold">{laminationPrice} ₴</span>
                    </div>
                  )}
                  {extras.endpapers && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Форзаци</span>
                      <span className="font-semibold">100 ₴</span>
                    </div>
                  )}
                  {extras.qrCode && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">QR-код</span>
                      <span className="font-semibold">50 ₴</span>
                    </div>
                  )}
                  {extras.coverText && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Текст на обкл.</span>
                      <span className="font-semibold">50 ₴</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 pt-3 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">РАЗОМ:</span>
                    <span className="font-bold text-2xl text-[#C4704F]">
                      {totalPrice} ₴
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  ⏱ Час виготовлення: 10–14 робочих днів
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="lg:col-span-3 flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Назад
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-8 py-3 bg-[#C4704F] text-white font-semibold rounded-lg hover:bg-[#b36445] transition-colors"
              >
                Продовжити →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Photos & Order Form */}
        {currentStep === 3 && (
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-[#1A1A1A] text-center">
              Фото та оформлення замовлення
            </h2>

            {/* File Requirements */}
            <div className="bg-white rounded-xl p-6 border-l-4 border-[#2D4A3E]">
              <h3 className="font-bold text-lg mb-3">Вимоги до файлів</h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Формат: JPG або PNG</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Роздільна здатність: 300 DPI (мінімум 150 DPI)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Колір: sRGB (не CMYK)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Назви файлів: тільки латинські літери</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Максимальний розмір: 50 MB на фото</span>
                </div>
              </div>
            </div>

            {/* Photo Upload */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-bold text-lg mb-3">
                📷 Завантажте від {minFiles} до {maxFiles} фотографій
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Менше фото — більше простору на кожній сторінці. Більше — насиченіша книга.
              </p>

              <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#C4704F] transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <div className="text-4xl mb-3">📁</div>
                <div className="font-semibold text-gray-700 mb-1">
                  Натисніть або перетягніть фото
                </div>
                <div className="text-sm text-gray-500">JPG або PNG, до 50 MB</div>
              </label>

              {uploadedPhotos.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold">
                      Завантажено: {uploadedPhotos.length} із {minFiles} необхідних
                    </span>
                    <span className="text-sm text-gray-500">
                      Макс: {maxFiles} фото
                    </span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {uploadedPhotos.map((file, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Фото ${idx + 1}`}
                          className="w-full aspect-square object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="bg-[#FDF0EB] rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">Ваше замовлення</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span>Тревел бук, {selectedPages} сторінок</span>
                  <span className="font-semibold">{basePrice} ₴</span>
                </div>
                {extras.lamination && (
                  <div className="flex justify-between">
                    <span>
                      Ламінування ({extras.laminationType === 'glossy' ? 'глянцеве' : 'матове'})
                    </span>
                    <span className="font-semibold">{laminationPrice} ₴</span>
                  </div>
                )}
                {extras.endpapers && (
                  <div className="flex justify-between">
                    <span>Форзаци</span>
                    <span className="font-semibold">100 ₴</span>
                  </div>
                )}
                {extras.qrCode && (
                  <div className="flex justify-between">
                    <span>QR-код</span>
                    <span className="font-semibold">50 ₴</span>
                  </div>
                )}
                {extras.coverText && (
                  <div className="flex justify-between">
                    <span>Текст: "{extras.coverTextContent}"</span>
                    <span className="font-semibold">50 ₴</span>
                  </div>
                )}
                <div className="border-t border-[#C4704F]/30 pt-2 mt-2 flex justify-between text-lg font-bold">
                  <span>РАЗОМ:</span>
                  <span className="text-[#C4704F]">{totalPrice} ₴</span>
                </div>
              </div>
            </div>

            {/* Order Form */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">Контактні дані</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Ім'я та прізвище <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={orderData.name}
                    onChange={e => setOrderData({ ...orderData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4704F] focus:border-transparent"
                    placeholder="Іван Петренко"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Телефон <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={orderData.phone}
                    onChange={e => setOrderData({ ...orderData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4704F] focus:border-transparent"
                    placeholder="+38 (0__) ___-__-__"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={orderData.email}
                    onChange={e => setOrderData({ ...orderData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4704F] focus:border-transparent"
                    placeholder="example@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Доставка <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="delivery"
                        checked={orderData.delivery === 'pickup'}
                        onChange={() => setOrderData({ ...orderData, delivery: 'pickup' })}
                        className="w-4 h-4 text-[#C4704F]"
                      />
                      <span>Самовивіз з Тернополя (безкоштовно)</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="delivery"
                        checked={orderData.delivery === 'nova_poshta'}
                        onChange={() => setOrderData({ ...orderData, delivery: 'nova_poshta' })}
                        className="w-4 h-4 text-[#C4704F]"
                      />
                      <span>Нова Пошта (вкажіть місто та номер відділення)</span>
                    </label>
                  </div>
                </div>

                {orderData.delivery === 'nova_poshta' && (
                  <div className="grid md:grid-cols-2 gap-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium mb-1">Місто</label>
                      <input
                        type="text"
                        value={orderData.city}
                        onChange={e => setOrderData({ ...orderData, city: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4704F] focus:border-transparent"
                        placeholder="Київ"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Номер відділення
                      </label>
                      <input
                        type="text"
                        value={orderData.branch}
                        onChange={e => setOrderData({ ...orderData, branch: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4704F] focus:border-transparent"
                        placeholder="№ 5"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Коментар (необов'язково)
                  </label>
                  <textarea
                    value={orderData.comment}
                    onChange={e => setOrderData({ ...orderData, comment: e.target.value })}
                    maxLength={400}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4704F] focus:border-transparent resize-none"
                    placeholder="Побажання до оформлення..."
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {orderData.comment.length}/400
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Промокод (необов'язково)
                  </label>
                  <input
                    type="text"
                    value={orderData.promoCode}
                    onChange={e => setOrderData({ ...orderData, promoCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C4704F] focus:border-transparent"
                    placeholder="PROMO2024"
                  />
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Назад
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={!isFormValid()}
                className="px-8 py-3 bg-[#C4704F] text-white font-semibold rounded-lg hover:bg-[#b36445] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Підтвердити замовлення →
              </button>
            </div>

            {!isFormValid() && uploadedPhotos.length < minFiles && (
              <div className="text-center text-sm text-red-600">
                Завантажено {uploadedPhotos.length} із {minFiles} необхідних фото
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
