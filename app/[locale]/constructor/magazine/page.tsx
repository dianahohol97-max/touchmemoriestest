'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Check, ChevronRight, ChevronLeft } from 'lucide-react'
import PhotoUploader from '@/components/PhotoUploader'
import SmartModeSelector from '@/components/SmartModeSelector'
import SmartModeProcessor from '@/components/SmartModeProcessor'
import {
  getMagazinePrice,
  getBindingInfo,
  getUsageHelper,
  TYPESETTING_PRICE,
  RETOUCHING_PRICE_PER_PHOTO,
  URGENT_MULTIPLIER,
} from '@/lib/products'

interface Extras {
  typesetting: boolean
  retouching: boolean
  retouchingCount: number
  urgent: boolean
}

interface OrderData {
  name: string
  phone: string
  email: string
  delivery: 'pickup' | 'nova_poshta'
  city: string
  branch: string
  comment: string
}

export default function GlossyMagazineConstructor() {
  const router = useRouter()

  // Step management (0 = mode selector, 1-3 = existing steps)
  const [currentStep, setCurrentStep] = useState<0 | 'smart' | 1 | 2 | 3>(0)
  const [smartFiles, setSmartFiles] = useState<File[]>([])

  // Step 1: Page count
  const [pages, setPages] = useState(24)

  // Step 2: Extras
  const [extras, setExtras] = useState<Extras>({
    typesetting: false,
    retouching: false,
    retouchingCount: 5,
    urgent: false,
  })

  // Step 3: Files and order data
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([])
  const [textFile, setTextFile] = useState<File | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [orderData, setOrderData] = useState<OrderData>({
    name: '',
    phone: '',
    email: '',
    delivery: 'nova_poshta',
    city: '',
    branch: '',
    comment: '',
  })

  // Success state
  const [orderSuccess, setOrderSuccess] = useState(false)

  // Price calculation
  const basePrice = useMemo(() => getMagazinePrice(pages, extras.typesetting), [pages, extras.typesetting])
  const typesettingPrice = extras.typesetting ? TYPESETTING_PRICE : 0
  const retouchingPrice = extras.retouching ? extras.retouchingCount * RETOUCHING_PRICE_PER_PHOTO : 0
  const subtotal = basePrice + retouchingPrice
  const urgentPrice = extras.urgent ? Math.round(subtotal * URGENT_MULTIPLIER) : 0
  const totalPrice = subtotal + urgentPrice

  // Binding info (dynamic based on page count)
  const bindingInfo = useMemo(() => getBindingInfo(pages), [pages])
  const usageHelper = useMemo(() => getUsageHelper(pages), [pages])

  // Page count handlers
  const decrementPages = useCallback(() => {
    setPages(prev => Math.max(8, prev - 2))
  }, [])

  const incrementPages = useCallback(() => {
    setPages(prev => Math.min(100, prev + 2))
  }, [])

  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value)) {
      // Round to nearest even number and clamp
      let rounded = Math.round(value / 2) * 2
      rounded = Math.max(8, Math.min(100, rounded))
      setPages(rounded)
    }
  }, [])

  const handlePageInputBlur = useCallback(() => {
    // Ensure it's even and clamped
    let newPages = Math.round(pages / 2) * 2
    newPages = Math.max(8, Math.min(100, newPages))
    setPages(newPages)
  }, [pages])

  // Form validation
  const isFormValid = useCallback(() => {
    return (
      orderData.name.trim() !== '' &&
      orderData.phone.trim() !== '' &&
      orderData.email.includes('@') &&
      (orderData.delivery === 'pickup' || (orderData.city.trim() !== '' && orderData.branch.trim() !== '')) &&
      uploadedPhotos.length >= 1
    )
  }, [orderData, uploadedPhotos])

  // Navigation
  const goToStep2 = () => setCurrentStep(2)
  const goToStep3 = () => setCurrentStep(3)
  const goBackToStep1 = () => setCurrentStep(1)
  const goBackToStep2 = () => setCurrentStep(2)

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!isFormValid()) return

    // In real app, send to API
    console.log('Order submitted:', {
      pages,
      extras,
      orderData,
      totalPrice,
      photosCount: uploadedPhotos.length,
      textFile: textFile?.name,
      zipFile: zipFile?.name,
    })

    setOrderSuccess(true)
  }, [pages, extras, orderData, totalPrice, uploadedPhotos, textFile, zipFile, isFormValid])

  // Success screen
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-green-600" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-black text-[#0D0D0D] mb-3">Замовлення прийнято!</h1>
          <p className="text-gray-700 mb-2 leading-relaxed">
            Дякуємо! Ваше замовлення на глянцевий журнал прийнято.
          </p>
          <p className="text-gray-600 text-sm mb-2">
            ⏱ Час виготовлення: 4–8 робочих днів. Ми зв'яжемось для підтвердження деталей.
          </p>
          {extras.urgent && (
            <p className="text-[#E63946] text-sm font-semibold mb-6">
              ⚡ Ваше замовлення відзначено як термінове — опрацюємо в першу чергу.
            </p>
          )}
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-6 bg-[#E63946] text-white font-bold rounded-xl hover:bg-[#C0303C] transition-colors"
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
        productTitle="Глянцевий Журнал"
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
        productType="magazine"
        onComplete={(keptFiles) => {
          setUploadedPhotos(keptFiles)
          setCurrentStep(3)
        }}
        onCancel={() => setCurrentStep(0)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4]">
      {/* Hero Section */}
      <div className="relative bg-[#0D0D0D] h-60 flex items-center px-6 lg:px-12 overflow-hidden">
        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto w-full">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#E63946] text-xs font-semibold tracking-[3px] mb-3">TOUCHMEMORIES STUDIO</p>
              <h1 className="text-white text-5xl lg:text-6xl font-black leading-none mb-4">
                Глянцевий Журнал
              </h1>
              <div className="w-16 h-1 bg-[#E63946] mb-4" />
              <p className="text-gray-400 text-lg">
                Від 8 до 100 сторінок. Скоба або клейова палітурка.
              </p>
            </div>
            <div className="hidden lg:block text-gray-700 text-[120px] font-black leading-none select-none">
              A4
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Сторінки' },
              { num: 2, label: 'Послуги' },
              { num: 3, label: 'Фото та замовлення' },
            ].map((step, idx) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base transition-all ${
                      (currentStep as number) > step.num
                        ? 'bg-[#10B981] text-white'
                        : currentStep === step.num
                        ? 'bg-[#E63946] text-white'
                        : 'bg-white border-2 border-[#374151] text-[#374151]'
                    }`}
                  >
                    {(currentStep as number) > step.num ? <Check className="w-6 h-6" /> : step.num}
                  </div>
                  <p className="text-xs mt-2 text-gray-700 font-medium">{step.label}</p>
                </div>
                {idx < 2 && (
                  <div className="flex-1 h-0.5 bg-gray-300 mx-2 -mt-6" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* STEP 1: Page Count Selection */}
        {currentStep === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-black text-[#0D0D0D] text-center">
              Скільки сторінок у вашому журналі?
            </h2>

            {/* Page Count Stepper */}
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-200">
              <div className="flex items-center justify-center gap-6 mb-8">
                <button
                  onClick={decrementPages}
                  disabled={pages <= 8}
                  className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                    pages <= 8
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:border-[#E63946] hover:text-[#E63946]'
                  }`}
                >
                  <Minus className="w-6 h-6" />
                </button>

                <div className="text-center">
                  <input
                    type="number"
                    value={pages}
                    onChange={handlePageInputChange}
                    onBlur={handlePageInputBlur}
                    min={8}
                    max={100}
                    step={2}
                    className="text-8xl font-black text-[#0D0D0D] text-center w-48 focus:outline-none focus:ring-2 focus:ring-[#E63946] rounded-lg px-2"
                  />
                  <p className="text-sm text-gray-500 mt-2">сторінок</p>
                </div>

                <button
                  onClick={incrementPages}
                  disabled={pages >= 100}
                  className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                    pages >= 100
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-gray-700 hover:border-[#E63946] hover:text-[#E63946]'
                  }`}
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <p className="text-center text-sm text-gray-500">
                Введіть число від 8 до 100 (тільки парні значення)
              </p>
            </div>

            {/* Binding Type Callout */}
            <div
              className="rounded-xl p-6 border-l-4 transition-all duration-300"
              style={{
                backgroundColor: bindingInfo.backgroundColor,
                borderColor: bindingInfo.borderColor,
              }}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{bindingInfo.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{bindingInfo.title}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{bindingInfo.description}</p>
                </div>
              </div>
            </div>

            {/* Price Display */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-[#E63946]">
              <p className="text-sm text-gray-600 text-center mb-2">Вартість журналу</p>
              <p className="text-6xl font-black text-[#E63946] text-center">{basePrice} ₴</p>
              <p className="text-sm text-gray-500 text-center mt-2">
                {pages} сторінок ({bindingInfo.displayName})
              </p>
            </div>

            {/* Usage Helper */}
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
              <p className="text-sm text-blue-900 font-medium">{usageHelper}</p>
            </div>

            {/* Continue Button */}
            <button
              onClick={goToStep2}
              className="w-full h-14 bg-[#E63946] text-white font-bold text-lg rounded-xl hover:bg-[#C0303C] transition-colors shadow-lg shadow-red-500/40 flex items-center justify-center gap-2"
            >
              Продовжити
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* STEP 2: Extras & Services */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-black text-[#0D0D0D] text-center">
              Оберіть додаткові послуги
            </h2>
            <p className="text-gray-600 text-center">(необов'язково)</p>

            <div className="grid gap-6">
              {/* 1. Text Typesetting */}
              <div
                className={`bg-white rounded-xl p-6 border-2 transition-all ${
                  extras.typesetting ? 'border-[#E63946] shadow-md' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">Дизайнерська верстка тексту</h3>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                        Популярна послуга
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                      Наші дизайнери оформлять ваш текстовий контент у стилі журналу. Ви надаєте текст (.docx або .txt) — ми розміщуємо його на сторінках. Не потрібно займатися версткою самостійно.
                    </p>
                    <p className="text-base font-semibold text-[#E63946]">+{TYPESETTING_PRICE} ₴</p>
                  </div>
                  <label className="relative inline-block w-14 h-8 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={extras.typesetting}
                      onChange={(e) => setExtras({ ...extras, typesetting: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-full h-full bg-gray-200 peer-checked:bg-[#E63946] rounded-full transition-colors" />
                    <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform peer-checked:translate-x-6 shadow-sm" />
                  </label>
                </div>
                {extras.typesetting && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800 animate-in fade-in slide-in-from-top-2">
                    📎 На кроці 3 буде можливість завантажити текстовий файл
                  </div>
                )}
              </div>

              {/* 2. Photo Retouching */}
              <div
                className={`bg-white rounded-xl p-6 border-2 transition-all ${
                  extras.retouching ? 'border-[#E63946] shadow-md' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Ретуш фотографій</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                      Покращення кольору, яскравості та контрасту. Видалення дефектів шкіри та фону. Базова ретуш — {RETOUCHING_PRICE_PER_PHOTO} ₴ за фото.
                    </p>
                    {extras.retouching && (
                      <p className="text-base font-semibold text-[#E63946]">
                        {RETOUCHING_PRICE_PER_PHOTO} ₴ × {extras.retouchingCount} фото = {retouchingPrice} ₴
                      </p>
                    )}
                  </div>
                  <label className="relative inline-block w-14 h-8 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={extras.retouching}
                      onChange={(e) => setExtras({ ...extras, retouching: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-full h-full bg-gray-200 peer-checked:bg-[#E63946] rounded-full transition-colors" />
                    <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform peer-checked:translate-x-6 shadow-sm" />
                  </label>
                </div>
                {extras.retouching && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Скільки фото потребують ретуші?
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setExtras({ ...extras, retouchingCount: Math.max(1, extras.retouchingCount - 1) })}
                        className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center hover:border-[#E63946] hover:text-[#E63946] transition-colors"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <input
                        type="number"
                        value={extras.retouchingCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          if (!isNaN(val) && val >= 1 && val <= 200) {
                            setExtras({ ...extras, retouchingCount: val })
                          }
                        }}
                        min={1}
                        max={200}
                        className="w-20 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-[#E63946]"
                      />
                      <button
                        onClick={() => setExtras({ ...extras, retouchingCount: Math.min(200, extras.retouchingCount + 1) })}
                        className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center hover:border-[#E63946] hover:text-[#E63946] transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Urgent Production */}
              <div
                className={`bg-white rounded-xl p-6 border-2 transition-all ${
                  extras.urgent ? 'border-[#E63946] shadow-md' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Термінове виготовлення</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                      ⚡ Пріоритетне виконання — 2–3 робочих дні замість стандартних 4–8
                    </p>
                    {extras.urgent && (
                      <p className="text-base font-semibold text-[#E63946] mb-2">
                        Доплата: {urgentPrice} ₴ (30% від {subtotal} ₴)
                      </p>
                    )}
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                      ⚠️ Термінове замовлення оформлюється після погодження з менеджером
                    </p>
                  </div>
                  <label className="relative inline-block w-14 h-8 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={extras.urgent}
                      onChange={(e) => setExtras({ ...extras, urgent: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-full h-full bg-gray-200 peer-checked:bg-[#E63946] rounded-full transition-colors" />
                    <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform peer-checked:translate-x-6 shadow-sm" />
                  </label>
                </div>
              </div>
            </div>

            {/* Price Summary Sticky */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 sticky top-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                🧾 Вартість замовлення
              </h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-700">
                    Журнал {pages} стор. ({bindingInfo.displayName})
                  </span>
                  <span className="font-semibold text-gray-900">{basePrice} ₴</span>
                </div>
                {extras.typesetting && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Верстка тексту</span>
                    <span className="font-semibold text-gray-900">{TYPESETTING_PRICE} ₴</span>
                  </div>
                )}
                {extras.retouching && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Ретуш фото ({extras.retouchingCount} шт.)</span>
                    <span className="font-semibold text-gray-900">{retouchingPrice} ₴</span>
                  </div>
                )}
                {extras.urgent && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Терміново (+30%)</span>
                    <span className="font-semibold text-[#E63946]">{urgentPrice} ₴</span>
                  </div>
                )}
              </div>
              <div className="border-t-2 border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900">До сплати:</span>
                  <span className="text-3xl font-black text-[#E63946]">{totalPrice} ₴</span>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-4">
              <button
                onClick={goBackToStep1}
                className="flex-1 h-14 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Назад
              </button>
              <button
                onClick={goToStep3}
                className="flex-1 h-14 bg-[#E63946] text-white font-bold text-lg rounded-xl hover:bg-[#C0303C] transition-colors shadow-lg shadow-red-500/40 flex items-center justify-center gap-2"
              >
                Продовжити
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Photos & Order Form */}
        {currentStep === 3 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-black text-[#0D0D0D] text-center">
              Фото + Оформлення замовлення
            </h2>

            {/* File Requirements */}
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-3">Вимоги до файлів:</h3>
              <ul className="space-y-1.5 text-sm text-blue-800">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  Формат: JPG або PNG
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  Роздільна здатність: 300 DPI
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  Колір: sRGB (не CMYK)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  Назви файлів: тільки латиниця (cover.jpg, page01.jpg...)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-600" />
                  Максимальний розмір: 50 MB на фото
                </li>
              </ul>
            </div>

            {/* Photo Upload */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
              📷 Рекомендована кількість фото для журналу на <b>{pages}</b> сторінок: <b>{pages + 1}–{Math.round(pages * 1.3)}</b>
            </div>
            <PhotoUploader
              canvasSize={{ width: 2480, height: 3508 }}
              minFiles={1}
              maxFiles={200}
              onPhotosChange={setUploadedPhotos}
              label="Завантажте фотографії для журналу"
            />
            <p className="text-sm text-gray-600 -mt-6">
              Якщо матеріалів багато — скористайтеся ZIP-архівом нижче.
            </p>

            {/* Text File Upload (conditional) */}
            {extras.typesetting && (
              <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                <h3 className="font-bold text-gray-900 mb-3">Завантажте текст для верстки</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Підтримуються формати: .docx, .txt, .pdf — максимум 50 МБ
                </p>
                <input
                  type="file"
                  accept=".docx,.doc,.txt,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0]
                      if (file.size <= 50 * 1024 * 1024) {
                        setTextFile(file)
                      } else {
                        alert('Файл занадто великий (макс. 50 МБ)')
                      }
                    }
                  }}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#E63946] file:text-white hover:file:bg-[#C0303C] file:cursor-pointer cursor-pointer"
                />
                {textFile && (
                  <p className="mt-3 text-sm text-green-700 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    {textFile.name} завантажено
                  </p>
                )}
              </div>
            )}

            {/* ZIP Archive Upload */}
            <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
              <h3 className="font-bold text-gray-900 mb-3">Додаткові матеріали (необов'язково)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Якщо у вас багато файлів — запакуйте в ZIP. Максимум 500 МБ.
              </p>
              <input
                type="file"
                accept=".zip,.rar"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0]
                    if (file.size <= 500 * 1024 * 1024) {
                      setZipFile(file)
                    } else {
                      alert('Файл занадто великий (макс. 500 МБ)')
                    }
                  }
                }}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-700 file:cursor-pointer cursor-pointer"
              />
              {zipFile && (
                <p className="mt-3 text-sm text-green-700 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {zipFile.name} завантажено
                </p>
              )}
            </div>

            {/* Order Form */}
            <div className="bg-white rounded-xl p-8 border-2 border-gray-200 space-y-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Ваші контакти та доставка</h3>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ім'я та прізвище <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={orderData.name}
                  onChange={(e) => setOrderData({ ...orderData, name: e.target.value })}
                  placeholder="Олена Шевченко"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946] focus:border-transparent"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Телефон <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={orderData.phone}
                  onChange={(e) => setOrderData({ ...orderData, phone: e.target.value })}
                  placeholder="+38 (0__) ___-__-__"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946] focus:border-transparent"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={orderData.email}
                  onChange={(e) => setOrderData({ ...orderData, email: e.target.value })}
                  placeholder="olena@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946] focus:border-transparent"
                  required
                />
              </div>

              {/* Delivery Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Доставка <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="delivery"
                      value="pickup"
                      checked={orderData.delivery === 'pickup'}
                      onChange={() => setOrderData({ ...orderData, delivery: 'pickup', city: '', branch: '' })}
                      className="mt-1 w-4 h-4 text-[#E63946] focus:ring-[#E63946]"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Самовивіз з Тернополя</p>
                      <p className="text-sm text-gray-600">(безкоштовно)</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="delivery"
                      value="nova_poshta"
                      checked={orderData.delivery === 'nova_poshta'}
                      onChange={() => setOrderData({ ...orderData, delivery: 'nova_poshta' })}
                      className="mt-1 w-4 h-4 text-[#E63946] focus:ring-[#E63946]"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Нова Пошта</p>
                      <p className="text-sm text-gray-600">(вкажіть місто та номер відділення)</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Nova Poshta Fields */}
              {orderData.delivery === 'nova_poshta' && (
                <div className="space-y-4 pl-7 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Місто <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={orderData.city}
                      onChange={(e) => setOrderData({ ...orderData, city: e.target.value })}
                      placeholder="Київ"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946] focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Номер відділення <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={orderData.branch}
                      onChange={(e) => setOrderData({ ...orderData, branch: e.target.value })}
                      placeholder="№ 15"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946] focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Коментар (необов'язково)
                </label>
                <textarea
                  value={orderData.comment}
                  onChange={(e) => setOrderData({ ...orderData, comment: e.target.value })}
                  placeholder="Додаткові побажання до журналу..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946] focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Final Price Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-[#E63946]">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Підсумок замовлення</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-700">
                    Журнал {pages} стор. ({bindingInfo.displayName})
                  </span>
                  <span className="font-semibold text-gray-900">{basePrice} ₴</span>
                </div>
                {extras.typesetting && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Верстка тексту</span>
                    <span className="font-semibold text-gray-900">{TYPESETTING_PRICE} ₴</span>
                  </div>
                )}
                {extras.retouching && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Ретуш ({extras.retouchingCount} фото)</span>
                    <span className="font-semibold text-gray-900">{retouchingPrice} ₴</span>
                  </div>
                )}
                {extras.urgent && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Терміново (+30%)</span>
                    <span className="font-semibold text-[#E63946]">{urgentPrice} ₴</span>
                  </div>
                )}
              </div>
              <div className="border-t-2 border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">До сплати:</span>
                  <span className="text-4xl font-black text-[#E63946]">{totalPrice} ₴</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className={`w-full h-14 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                isFormValid()
                  ? 'bg-[#E63946] text-white hover:bg-[#C0303C] shadow-lg shadow-red-500/40 cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Замовити
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2 text-sm text-gray-600">
              <p>🔒 Оплата при отриманні або онлайн (Visa/Mastercard)</p>
              <p>⏱ Час виготовлення: 4–8 робочих днів</p>
            </div>

            {/* Back Button */}
            <button
              onClick={goBackToStep2}
              className="w-full h-12 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Назад до послуг
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
