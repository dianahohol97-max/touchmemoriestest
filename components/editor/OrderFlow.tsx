'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronRight, ChevronLeft, Check, Package, Truck, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EditorProject } from '@/lib/editor-types'

interface OrderFlowProps {
  project: EditorProject
  onClose: () => void
}

interface OrderData {
  name: string
  phone: string
  email: string
  deliveryMethod: 'pickup' | 'nova_poshta' | ''
  city: string
  branch: string
  comment: string
  promoCode: string
}

interface ExtrasData {
  lamination: boolean
  endpapers: string
  qrCode: boolean
}

export default function OrderFlow({ project, onClose }: OrderFlowProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')

  // Form data
  const [orderData, setOrderData] = useState<OrderData>({
    name: '',
    phone: '+380',
    email: '',
    deliveryMethod: '',
    city: '',
    branch: '',
    comment: '',
    promoCode: '',
  })

  const [extras, setExtras] = useState<ExtrasData>({
    lamination: false,
    endpapers: 'white',
    qrCode: false,
  })

  // Calculate pricing
  const getBasePrice = () => {
    // Base price calculation based on product type, format, pages
    if (project.productType === 'photobook') {
      if (project.format === '20x20') return 1050 + (project.totalPages - 20) * 25
      if (project.format === '25x25') return 1290 + (project.totalPages - 20) * 30
      if (project.format === '30x30') return 1700 + (project.totalPages - 20) * 35
    } else if (project.productType === 'travelbook') {
      return 550 + (project.totalPages - 12) * 30
    } else if (project.productType === 'magazine') {
      return 475 + (project.totalPages - 12) * 28
    }
    return 1050
  }

  const getExtrasPrice = () => {
    let total = 0
    if (extras.lamination) total += 150
    if (extras.endpapers !== 'white') total += 100
    if (extras.qrCode) total += 50
    return total
  }

  const basePrice = getBasePrice()
  const extrasPrice = getExtrasPrice()
  const totalPrice = basePrice + extrasPrice

  // Validation
  const canProceed = () => {
    if (currentStep === 1) return true
    if (currentStep === 2) return true
    if (currentStep === 3) {
      return (
        orderData.name.trim() !== '' &&
        orderData.phone.length >= 13 &&
        orderData.email.includes('@') &&
        orderData.deliveryMethod !== '' &&
        (orderData.deliveryMethod === 'pickup' ||
         (orderData.city.trim() !== '' && orderData.branch.trim() !== ''))
      )
    }
    return true
  }

  const handleSubmitOrder = async () => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // 1. Save final project snapshot
      const { error: projectError } = await supabase
        .from('projects')
        .upsert({
          id: project.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          product_type: project.productType,
          format: project.format,
          total_pages: project.totalPages,
          cover_data: project.coverPage,
          pages_data: project.pages,
          uploaded_photos: project.uploadedPhotos || [],
          status: 'ordered',
          updated_at: new Date().toISOString(),
        })

      if (projectError) throw projectError

      // 2. Create order
      const orderNumber = `TM-${Date.now()}`
      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name: orderData.name,
          customer_phone: orderData.phone,
          customer_email: orderData.email,
          delivery_method: orderData.deliveryMethod,
          delivery_city: orderData.city,
          delivery_branch: orderData.branch,
          comment: orderData.comment,
          promo_code: orderData.promoCode,
          product_type: project.productType,
          product_format: project.format,
          total_pages: project.totalPages,
          cover_color: project.coverPage.background.type === 'color'
            ? project.coverPage.background.value
            : '#ffffff',
          extras: extras,
          base_price: basePrice,
          extras_price: extrasPrice,
          total_price: totalPrice,
          project_id: project.id,
          project_snapshot: project,
          status: 'pending',
          created_at: new Date().toISOString(),
        })

      if (orderError) throw orderError

      setOrderNumber(orderNumber)
      setOrderSuccess(true)
    } catch (error) {
      console.error('Order submission error:', error)
      alert('Помилка при оформленні замовлення. Спробуйте ще раз.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (orderSuccess) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Замовлення прийнято!</h2>
          <p className="text-gray-600 mb-1">Номер замовлення: <span className="font-semibold">{orderNumber}</span></p>
          <p className="text-gray-600 mb-6">Менеджер зв'яжеться з вами протягом 1 години</p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-4 py-3 border-2 border-[#1e2d7d] text-[#1e2d7d] rounded-lg font-semibold hover:bg-[#f0f2f8] transition-colors"
            >
              На головну
            </button>
            <button
              onClick={() => router.push('/catalog')}
              className="flex-1 px-4 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors"
            >
              До каталогу
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-2xl md:rounded-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Оформлення замовлення</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step === currentStep
                      ? 'bg-[#1e2d7d] text-white'
                      : step < currentStep
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < currentStep ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 4 && (
                  <div
                    className={`w-12 md:w-20 h-1 mx-1 ${
                      step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Деталі</span>
            <span>Додатково</span>
            <span>Контакти</span>
            <span>Підтвердження</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* STEP 1 - Summary */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {project.coverPage.background.type === 'image' ? (
                    <img
                      src={project.coverPage.background.value}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: project.coverPage.background.value }}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">
                    {project.productType === 'photobook'
                      ? 'Фотокнига Преміум'
                      : project.productType === 'travelbook'
                      ? 'Travel Book'
                      : 'Глянцевий журнал'}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {project.format} см • {project.totalPages} сторінок
                  </p>
                  {project.coverType && (
                    <p className="text-gray-600 text-sm">Обкладинка: {project.coverType}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Базова вартість</span>
                  <span className="font-semibold">{basePrice} ₴</span>
                </div>
                {extrasPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Додаткові опції</span>
                    <span className="font-semibold">{extrasPrice} ₴</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between">
                  <span className="font-bold text-gray-900">Всього</span>
                  <span className="font-bold text-[#1e2d7d] text-lg">{totalPrice} ₴</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <Package className="w-4 h-4 inline mr-2" />
                  Ваш проект збережено. Ви можете повернутись до редагування в будь-який час.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2 - Extras */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-gray-900 mb-4">Додаткові опції</h3>

              <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={extras.lamination}
                  onChange={(e) => setExtras({ ...extras, lamination: e.target.checked })}
                  className="mt-1 w-5 h-5 text-[#1e2d7d] rounded"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Ламінація обкладинки</div>
                  <div className="text-sm text-gray-600">Захист від подряпин та вологи</div>
                  <div className="text-sm font-semibold text-[#1e2d7d] mt-1">+150 ₴</div>
                </div>
              </label>

              <div className="p-4 border border-gray-200 rounded-lg">
                <label className="font-semibold text-gray-900 mb-3 block">Форзаци</label>
                <div className="space-y-2">
                  {[
                    { value: 'white', label: 'Білі (стандарт)', price: 0 },
                    { value: 'black', label: 'Чорні', price: 100 },
                    { value: 'custom', label: 'З дизайном', price: 100 },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="endpapers"
                        checked={extras.endpapers === option.value}
                        onChange={() => setExtras({ ...extras, endpapers: option.value })}
                        className="w-4 h-4 text-[#1e2d7d]"
                      />
                      <span className="flex-1 text-sm text-gray-700">{option.label}</span>
                      {option.price > 0 && (
                        <span className="text-sm font-semibold text-[#1e2d7d]">
                          +{option.price} ₴
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={extras.qrCode}
                  onChange={(e) => setExtras({ ...extras, qrCode: e.target.checked })}
                  className="mt-1 w-5 h-5 text-[#1e2d7d] rounded"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">QR-код на обкладинці</div>
                  <div className="text-sm text-gray-600">
                    Посилання на відео або галерею
                  </div>
                  <div className="text-sm font-semibold text-[#1e2d7d] mt-1">+50 ₴</div>
                </div>
              </label>
            </div>
          )}

          {/* STEP 3 - Contact & Delivery */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-gray-900 mb-4">Контактні дані</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ім'я <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={orderData.name}
                  onChange={(e) => setOrderData({ ...orderData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                  placeholder="Ваше ім'я"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={orderData.phone}
                  onChange={(e) => setOrderData({ ...orderData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                  placeholder="+380 XX XXX XX XX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={orderData.email}
                  onChange={(e) => setOrderData({ ...orderData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-bold text-lg text-gray-900 mb-4">Доставка</h3>

                <div className="space-y-3">
                  <label
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      orderData.deliveryMethod === 'pickup'
                        ? 'border-[#1e2d7d] bg-[#f0f2f8]'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      checked={orderData.deliveryMethod === 'pickup'}
                      onChange={() => setOrderData({ ...orderData, deliveryMethod: 'pickup' })}
                      className="mt-1 w-5 h-5 text-[#1e2d7d]"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Самовивіз з Тернополя</div>
                      <div className="text-sm text-gray-600">вул. Київська 2, Тернопіль</div>
                      <div className="text-sm font-semibold text-green-600 mt-1">Безкоштовно</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      orderData.deliveryMethod === 'nova_poshta'
                        ? 'border-[#1e2d7d] bg-[#f0f2f8]'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      checked={orderData.deliveryMethod === 'nova_poshta'}
                      onChange={() =>
                        setOrderData({ ...orderData, deliveryMethod: 'nova_poshta' })
                      }
                      className="mt-1 w-5 h-5 text-[#1e2d7d]"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Нова Пошта</div>
                      <div className="text-sm text-gray-600">Доставка на відділення</div>
                    </div>
                  </label>

                  {orderData.deliveryMethod === 'nova_poshta' && (
                    <div className="ml-11 space-y-3 pt-2">
                      <input
                        type="text"
                        value={orderData.city}
                        onChange={(e) => setOrderData({ ...orderData, city: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                        placeholder="Місто"
                      />
                      <input
                        type="text"
                        value={orderData.branch}
                        onChange={(e) => setOrderData({ ...orderData, branch: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                        placeholder="Номер відділення (наприклад, 5)"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Коментар (необов'язково)
                </label>
                <textarea
                  value={orderData.comment}
                  onChange={(e) => setOrderData({ ...orderData, comment: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Побажання до замовлення"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Промокод
                </label>
                <input
                  type="text"
                  value={orderData.promoCode}
                  onChange={(e) => setOrderData({ ...orderData, promoCode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
                  placeholder="Введіть промокод"
                />
              </div>
            </div>
          )}

          {/* STEP 4 - Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4">Підтвердження замовлення</h3>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-sm text-gray-600">Продукт</div>
                  <div className="font-semibold text-gray-900">
                    {project.productType === 'photobook'
                      ? 'Фотокнига Преміум'
                      : project.productType === 'travelbook'
                      ? 'Travel Book'
                      : 'Глянцевий журнал'}{' '}
                    • {project.format} • {project.totalPages} сторінок
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600">Контакти</div>
                  <div className="font-semibold text-gray-900">{orderData.name}</div>
                  <div className="text-sm text-gray-700">
                    {orderData.phone} • {orderData.email}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600">Доставка</div>
                  <div className="font-semibold text-gray-900">
                    {orderData.deliveryMethod === 'pickup'
                      ? 'Самовивіз (Тернопіль, вул. Київська 2)'
                      : `Нова Пошта (${orderData.city}, відділення ${orderData.branch})`}
                  </div>
                </div>

                {(extras.lamination || extras.endpapers !== 'white' || extras.qrCode) && (
                  <div>
                    <div className="text-sm text-gray-600">Додаткові опції</div>
                    <ul className="text-sm text-gray-700 list-disc list-inside">
                      {extras.lamination && <li>Ламінація обкладинки</li>}
                      {extras.endpapers !== 'white' && (
                        <li>
                          Форзаци:{' '}
                          {extras.endpapers === 'black' ? 'чорні' : 'з дизайном'}
                        </li>
                      )}
                      {extras.qrCode && <li>QR-код на обкладинці</li>}
                    </ul>
                  </div>
                )}
              </div>

              <div className="bg-[#1e2d7d] text-white rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm opacity-90">Базова вартість</span>
                  <span className="font-semibold">{basePrice} ₴</span>
                </div>
                {extrasPrice > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm opacity-90">Додаткові опції</span>
                    <span className="font-semibold">{extrasPrice} ₴</span>
                  </div>
                )}
                <div className="border-t border-white/20 pt-2 flex justify-between items-center">
                  <span className="font-bold text-lg">Всього до оплати</span>
                  <span className="font-bold text-2xl">{totalPrice} ₴</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900">
                  <CreditCard className="w-4 h-4 inline mr-2" />
                  Оплата здійснюється після підтвердження замовлення менеджером. Ми приймаємо
                  готівку, картку або Monobank.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад
          </button>

          <div className="text-sm text-gray-500">
            Крок {currentStep} з 4
          </div>

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Далі
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Обробка...' : 'Підтвердити замовлення'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
