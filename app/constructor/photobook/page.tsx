'use client';
import { useCartStore } from '@/store/cart-store';

import React, { useState, useMemo } from 'react';
import { PHOTO_BOOKS } from '@/lib/products';
import { CheckCircle2, ChevronRight, ArrowLeft, Info, Plus, Truck, Store, MapPin } from 'lucide-react';
import Link from 'next/link';
import PhotoUploader from '@/components/PhotoUploader';
import OrderSummary from '@/components/OrderSummary';
import { submitOrder } from '@/lib/submitOrder';

type Tier = 'standard' | 'premium' | null;
type FormatId = '20x20' | '20x30' | '30x20' | '30x30' | null;

const FORMAT_DETAILS = [
  { id: '20x20', name: 'Square 20×20 cm', desc: 'Perfect for Instagram-style layouts', ratio: 'aspect-square', width: 'w-12' },
  { id: '20x30', name: 'Portrait 20×30 cm', desc: 'Classic book proportions', ratio: 'aspect-[2/3]', width: 'w-10' },
  { id: '30x20', name: 'Landscape 30×20 cm', desc: 'Great for travel and landscape photos', ratio: 'aspect-[3/2]', width: 'w-14' },
  { id: '30x30', name: 'Large Square 30×30 cm', desc: 'Premium coffee table book', ratio: 'aspect-square', width: 'w-14' },
] as const;

const PAGE_OPTIONS = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50];

const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount) + ' UAH';
};

const getCanvasSize = (format: FormatId) => {
  switch (format) {
    case '20x20': return { width: 2362, height: 2362 };
    case '20x30': return { width: 2362, height: 3543 };
    case '30x20': return { width: 3543, height: 2362 };
    case '30x30': return { width: 3543, height: 3543 };
    default: return { width: 2362, height: 2362 };
  }
};

export default function PhotobookConstructorPage() {
  const addItem = useCartStore((state) => state.addItem);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [tier, setTier] = useState<Tier>(null);
  
  // Step 2
  const [format, setFormat] = useState<FormatId>(null);

  // Step 3
  const [pages, setPages] = useState<number>(20);
  const [lamination, setLamination] = useState<'none' | 'glossy' | 'matte'>('none');
  const [endpapers, setEndpapers] = useState<boolean>(false);
  const [qrCode, setQrCode] = useState<boolean>(false);
  const [customText, setCustomText] = useState<boolean>(false);

  // Step 4
  const [photos, setPhotos] = useState<File[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'nova_poshta'>('pickup');
  const [npCity, setNpCity] = useState('');
  const [npBranch, setNpBranch] = useState('');
  const [comment, setComment] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [formError, setFormError] = useState('');

  const totalSteps = 4;

  const handleNext = () => {
    if (step === 1 && tier) setStep(2);
    else if (step === 2 && format) setStep(3);
    else if (step === 3 && pages) setStep(4);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as any);
  };

  const isNextDisabled = 
    (step === 1 && !tier) || 
    (step === 2 && !format) || 
    (step === 3 && !pages);

  // Pricing calculations
  const selectedFormatObj = FORMAT_DETAILS.find(f => f.id === format);
  
  const getStartingPrice = (t: NonNullable<Tier>, fId: NonNullable<FormatId>) => {
    const fKey = PHOTO_BOOKS.formats.find(f => f.id === fId)?.priceKey;
    if (!fKey) return 0;
    return PHOTO_BOOKS.tiers[t].prices[20]?.[fKey] ?? 0;
  };

  const priceKey = PHOTO_BOOKS.formats.find(f => f.id === format)?.priceKey;
  const rawBasePrice = tier && priceKey && pages ? PHOTO_BOOKS.tiers[tier].prices[pages]?.[priceKey] : 0;
  const basePrice = rawBasePrice || 0;

  const laminationPrice = lamination !== 'none' ? 5 * pages : 0;
  const endpapersPrice = endpapers ? 200 : 0;
  const qrCodePrice = qrCode ? 50 : 0;
  const customTextPrice = customText ? 50 : 0;

  const extrasTotal = laminationPrice + endpapersPrice + qrCodePrice + customTextPrice;
  const totalPrice = basePrice + extrasTotal;

  const minPhotos = Math.floor(pages / 2);
  const maxPhotos = pages * 2;

  // Step 4 requirements mapping
  const orderOptions = useMemo(() => {
    const opts = [];
    if (tier) opts.push({ label: 'Tier', value: tier === 'standard' ? 'Standard' : 'Premium' });
    if (format) opts.push({ label: 'Format', value: FORMAT_DETAILS.find(f => f.id === format)?.name || format });
    if (pages) opts.push({ label: 'Pages', value: pages.toString() });
    
    if (lamination !== 'none') opts.push({ label: 'Lamination', value: `${lamination} finish`, price: laminationPrice });
    if (endpapers) opts.push({ label: 'Endpapers', value: 'Included', price: endpapersPrice });
    if (qrCode) opts.push({ label: 'QR Code', value: 'Included', price: qrCodePrice });
    if (customText) opts.push({ label: 'Custom Text', value: 'Included', price: customTextPrice });
    
    return opts;
  }, [tier, format, pages, lamination, endpapers, qrCode, customText, laminationPrice, endpapersPrice, qrCodePrice, customTextPrice]);

  const isPhotosReady = photos.length >= minPhotos && photos.length <= maxPhotos;
  
  // Basic Form Validation
  const isFormValid = 
    customerName.trim() !== '' && 
    phone.trim().length >= 10 && 
    email.includes('@') &&
    (deliveryMethod === 'pickup' || (npCity.trim() !== '' && npBranch.trim() !== ''));

  const isReadyToOrder = isPhotosReady && isFormValid;

  const handlePlaceOrder = async () => {
    if (isReadyToOrder) {
      setIsSubmitting(true);
      setFormError('');
      
      const orderData = {
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'nova_poshta' ? { city: npCity, branch: npBranch } : undefined,
        items: [{
          product_type: 'photobook',
          product_name: `Photo Book ${tier === 'standard' ? 'Standard' : 'Premium'}`,
          format: format ? String(format) : undefined,
          pages: pages,
          quantity: 1,
          unit_price: totalPrice,
          total_price: totalPrice,
          options: orderOptions.reduce((acc, opt) => {
            acc[opt.label] = opt.value;
            return acc;
          }, {} as Record<string, string>)
        }],
        subtotal: totalPrice,
        delivery_cost: 0,
        total: totalPrice,
        notes: comment
      };

      const result = await submitOrder(orderData);
      
      setIsSubmitting(false);
      
      if (result.success) {
        setOrderNumber(result.order_number!);
        addItem({ id: Date.now().toString(), name: "Photobook", price: totalPrice, qty: 1 });
        setIsSuccess(true);
        window.scrollTo(0,0);
      } else {
        setFormError('❌ Щось пішло не так. Спробуйте ще раз.');
        console.error('Order submission failed:', result.error);
      }
    }
  };

  const stepTitles: Record<number, string> = {
    1: 'Оберіть рівень',
    2: 'Оберіть формат',
    3: 'Сторінки та опції',
    4: 'Завантаження та огляд'
  };

  if (isSuccess) {
    return (
      <div className="min-h-[85vh] bg-gray-50 flex flex-col items-center justify-center font-sans">
        <div className="bg-white p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center max-w-xl mx-4 border border-gray-100 animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-emerald-100">
             <CheckCircle2 className="w-12 h-12 text-emerald-500" strokeWidth={2.5} />
          </div>
          <h2 className="text-4xl font-extrabold text-gray-900 mb-5 tracking-tight">Дякуємо за замовлення!</h2>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-8 inline-block shadow-inner w-full">
             <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Номер замовлення</p>
             <p className="text-2xl font-black text-blue-600 tracking-tight">{orderNumber}</p>
          </div>
          <p className="text-lg text-gray-500 mb-6 leading-relaxed font-medium">
            Ми зв'яжемося з вами найближчим часом
          </p>
          <div className="bg-gray-50 rounded-2xl p-6 text-sm text-gray-600 font-medium mb-10 text-left flex flex-col gap-2">
            <div className="flex justify-between"><span className="text-gray-500">Кількість фото:</span> <span className="text-gray-900">{photos.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">До сплати:</span> <span className="text-gray-900 font-bold">{formatUAH(totalPrice)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Доставка:</span> <span className="text-gray-900 capitalize">{deliveryMethod.replace('_', ' ')}</span></div>
          </div>
          <Link href="/" className="inline-flex items-center justify-center px-10 py-4 w-full rounded-2xl font-bold bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
             На головну
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-[1200px] mx-auto">
        
        {/* Header & Progress */}
        <div className="mb-10 max-w-5xl mx-auto">
          <Link href="/products/photobooks" className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center mb-6 transition-colors w-max">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            {(step === 4) ? 'Назад до редактора' : '← До товарів'}
          </Link>

          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-6">
            Створіть свою фотокнигу
          </h1>
          
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center text-sm font-medium text-gray-500 mb-4">
              <span className="text-gray-900 font-bold tracking-wide uppercase text-xs border border-gray-200 px-3.5 py-1.5 rounded-full bg-white shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
                Крок {step} <span className="px-1 text-gray-300">|</span> {stepTitles[step]}
              </span>
              <span className="font-semibold text-gray-400">{Math.round((step / totalSteps) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200/80 rounded-full h-2.5 overflow-hidden shadow-inner flex">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-700 ease-in-out"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step Content wrapper */}
        <div className={`bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 ${step === 4 ? 'p-0 sm:p-6 lg:p-10 bg-transparent sm:bg-white border-none sm:border-solid shadow-none sm:shadow-[0_8px_30px_rgb(0,0,0,0.04)]' : 'p-6 md:p-10'} relative overflow-hidden max-w-5xl mx-auto`}>
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Оберіть рівень якості</h2>
              <p className="text-gray-500 mb-8 font-medium">Виберіть рівень якості, який найкраще підходить для ваших спогадів.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <button 
                  onClick={() => setTier('standard')}
                  className={`relative text-left p-8 rounded-[1.5rem] border-2 transition-all duration-300 flex flex-col h-full bg-white group hover:shadow-lg
                    ${tier === 'standard' 
                      ? 'border-blue-600 ring-4 ring-blue-600/10 shadow-lg scale-[1.02]' 
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {tier === 'standard' && (
                    <div className="absolute top-5 right-5 text-blue-600 scale-in animate-in zoom-in duration-200">
                      <CheckCircle2 className="w-7 h-7 fill-white" />
                    </div>
                  )}
                  <span className={`inline-block px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest rounded-full mb-6 max-w-max transition-colors
                    ${tier === 'standard' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'}
                  `}>
                    Вигідна ціна
                  </span>

                  <h3 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">Стандарт</h3>
                  <p className="text-gray-600 mb-10 leading-relaxed font-medium flex-grow pr-8">
                    Глянцева або матова обкладинка, внутрішні сторінки 170г, яскравий якісний друк.
                    Класичний вибір для повсякденних спогадів.
                  </p>

                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">від</div>
                    <div className="text-2xl font-black text-gray-900 tracking-tight">{formatUAH(450)}</div>
                  </div>
                </button>

                <button 
                  onClick={() => setTier('premium')}
                  className={`relative text-left p-8 rounded-[1.5rem] border-2 transition-all duration-300 flex flex-col h-full bg-white group hover:shadow-lg mt-6 md:mt-0
                    ${tier === 'premium' 
                      ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg scale-[1.02]' 
                      : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[11px] font-extrabold rounded-full shadow-lg uppercase tracking-widest whitespace-nowrap z-10">
                    Найпопулярніше
                  </div>

                  {tier === 'premium' && (
                    <div className="absolute top-5 right-5 text-emerald-500 scale-in animate-in zoom-in duration-200">
                      <CheckCircle2 className="w-7 h-7 fill-white" />
                    </div>
                  )}

                  <span className={`inline-block mt-1 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest rounded-full mb-6 max-w-max transition-colors
                    ${tier === 'premium' ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100'}
                  `}>
                    Преміум якість
                  </span>

                  <h3 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">Преміум</h3>
                  <p className="text-gray-600 mb-10 leading-relaxed font-medium flex-grow pr-8">
                    Обкладинка під шкіру, товсті сторінки 200г, надзвичайно яскраві кольори, розгортання на 180°.
                    Створено для подій, які залишаються на все життя.
                  </p>

                  <div className="pt-2 border-t border-gray-50">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">від</div>
                    <div className="text-2xl font-black text-gray-900">{formatUAH(950)}</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Оберіть формат</h2>
              <p className="text-gray-500 mb-8 flex justify-between items-center gap-4 flex-wrap font-medium">
                <span>Виберіть розміри вашої фотокниги.</span>
                <span className="text-[13px] px-4 py-1.5 bg-blue-50/50 border border-blue-100 rounded-full font-bold text-blue-900 whitespace-nowrap">
                  Рівень: <span className="capitalize text-blue-600 ml-1">{tier === 'standard' ? 'Стандарт' : 'Преміум'}</span>
                </span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {FORMAT_DETAILS.map((f) => {
                  const isSelected = format === f.id;
                  const price = tier ? getStartingPrice(tier, f.id as NonNullable<FormatId>) : 0;
                  
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id as FormatId)}
                      className={`flex items-start p-6 rounded-[1.5rem] border-2 text-left transition-all group duration-300 hover:shadow-lg
                        ${isSelected 
                          ? 'border-blue-600 bg-blue-50/20 shadow-lg ring-4 ring-blue-600/10 scale-[1.02]' 
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                        }`}
                    >
                      <div className="mr-6 mt-1 flex flex-col items-center justify-center w-16 flex-shrink-0">
                        <div className={`${f.width} ${f.ratio} border-2 rounded-md shadow-sm opacity-90 transition-colors duration-300
                          ${isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-white group-hover:border-blue-300'}
                        `} />
                      </div>
                      
                      <div className="flex-1 pr-2">
                        <h4 className="font-extrabold text-gray-900 text-lg mb-1.5 leading-tight">{f.name}</h4>
                        <p className="text-sm text-gray-500 mb-4 font-medium">{f.desc}</p>
                        <div className="text-[12px] font-bold uppercase tracking-wide text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg inline-block border border-gray-100">
                          від <span className="text-gray-900 font-extrabold ml-1">{formatUAH(price)}</span>
                        </div>
                      </div>
                      
                      {isSelected ? (
                         <div className="flex-shrink-0 text-blue-600 ml-1 mt-1 animate-in zoom-in duration-200">
                           <CheckCircle2 className="w-6 h-6 fill-white" />
                         </div>
                      ) : (
                         <div className="w-6 h-6 rounded-full border-2 border-gray-200 ml-1 mt-1 flex-shrink-0 group-hover:border-blue-300 transition-colors" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Сторінки та опції</h2>
              <p className="text-gray-500 mb-8 font-medium">Виберіть кількість сторінок та додаткові опції оздоблення.</p>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-7 space-y-10">
                  
                  {/* Page Count */}
                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <h3 className="text-lg font-extrabold text-gray-900">Кількість сторінок</h3>
                      <span className="text-3xl font-black text-blue-600 font-sans tracking-tight leading-none bg-blue-50 px-4 py-2 rounded-xl">{pages}</span>
                    </div>
                    
                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm">
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mb-6">
                        {PAGE_OPTIONS.map(p => (
                          <button
                            key={p}
                            onClick={() => setPages(p)}
                            className={`py-2 rounded-xl text-sm font-bold transition-all duration-200
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
                          <p className="font-bold text-blue-900 mb-1">Мінімум 20 сторінок · Максимум 50 сторінок · Тільки парні числа</p>
                          <p className="font-medium text-blue-800/80">Кожен розворот = 2 сторінки. {pages} сторінок = приблизно <strong className="text-blue-900">{pages}–{pages * 2} фото.</strong></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Extras */}
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900 mb-4">Додаткові опції</h3>
                    
                    <div className="space-y-4">
                      <div className="p-6 rounded-[1.5rem] border border-gray-200 bg-white shadow-sm flex flex-col sm:flex-row gap-5">
                          <div className="flex-1">
                            <h4 className="font-extrabold text-gray-900 text-base mb-1">Ламінація</h4>
                            <p className="text-[13px] font-medium text-gray-500 mb-4">Захистіть сторінки преміум покриттям (5 грн/сторінка)</p>

                            <div className="flex flex-wrap gap-4">
                              {[
                                { value: 'none', label: 'немає' },
                                { value: 'glossy', label: 'глянець' },
                                { value: 'matte', label: 'матова' }
                              ].map((type) => (
                                <label key={type.value} className="flex items-center gap-2 cursor-pointer group">
                                  <span className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors shadow-inner
                                    ${lamination === type.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400 bg-white'}
                                  `}>
                                    {lamination === type.value && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={4} />}
                                  </span>
                                  <span className={`text-sm font-bold pt-0.5 ${lamination === type.value ? 'text-gray-900' : 'text-gray-500'}`}>{type.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="text-sm font-black text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl flex items-center justify-center h-min shadow-sm whitespace-nowrap">
                            +{5 * pages} UAH
                          </div>
                      </div>

                      {([
                        { id: 'endpapers', state: endpapers, setter: setEndpapers, title: 'Форзаци', price: 200, desc: 'Декоративні внутрішні обкладинки на початку та в кінці' },
                        { id: 'qrCode', state: qrCode, setter: setQrCode, title: 'QR-код', price: 50, desc: 'Додайте QR-код з посиланням на відео або музику на обкладинці' },
                        { id: 'customText', state: customText, setter: setCustomText, title: 'Текст на обкладинці', price: 50, desc: 'Персоналізований друк або тиснення фольгою на обкладинці' }
                      ] as const).map((extra) => (
                         <label key={extra.id} className={`flex items-start p-6 rounded-[1.5rem] border transition-all cursor-pointer group shadow-sm
                           ${extra.state ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-600/10' : 'border-gray-200 bg-white hover:border-blue-300'}
                         `}>
                           <div className={`mt-0.5 w-[22px] h-[22px] rounded-md border flex-shrink-0 flex items-center justify-center transition-colors shadow-inner
                             ${extra.state ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400 bg-gray-50'}
                           `}>
                             {extra.state && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                           </div>
                           <div className="ml-4 flex-1">
                             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-1">
                               <h4 className={`font-extrabold ${extra.state ? 'text-blue-900' : 'text-gray-900'}`}>{extra.title}</h4>
                               <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg self-start sm:self-auto">
                                 +{extra.price} UAH
                               </span>
                             </div>
                             <p className="text-[13px] font-medium text-gray-500">{extra.desc}</p>
                           </div>
                         </label>
                      ))}

                    </div>
                  </div>
                </div>

                {/* Right side Summary */}
                <div className="lg:col-span-5 hidden sm:block">
                  <div className="bg-gray-900 rounded-[2rem] p-8 text-white sticky top-24 shadow-2xl overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full pointer-events-none" />
                    
                    <h3 className="text-xl font-bold mb-8 tracking-wide text-gray-300 uppercase text-center border-b border-gray-800 pb-4">Підсумок</h3>

                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-start font-medium text-[15px]">
                        <span className="text-gray-300">Базова ціна ({pages}p)</span>
                        <span className="text-white font-bold">{formatUAH(basePrice)}</span>
                      </div>

                      {lamination !== 'none' && (
                        <div className="flex justify-between items-start text-[14px] text-gray-400">
                          <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-gray-500" /> Ламін. (<span className="capitalize">{lamination === 'glossy' ? 'глянець' : 'матова'}</span>)</span>
                          <span>{formatUAH(laminationPrice)}</span>
                        </div>
                      )}
                      
                      {endpapers && (
                        <div className="flex justify-between items-start text-[14px] text-gray-400">
                          <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-gray-500" /> Форзаци</span>
                          <span>{formatUAH(endpapersPrice)}</span>
                        </div>
                      )}

                      {qrCode && (
                        <div className="flex justify-between items-start text-[14px] text-gray-400">
                          <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-gray-500" /> QR-код</span>
                          <span>{formatUAH(qrCodePrice)}</span>
                        </div>
                      )}

                      {customText && (
                        <div className="flex justify-between items-start text-[14px] text-gray-400">
                          <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-gray-500" /> Текст на обкладинці</span>
                          <span>{formatUAH(customTextPrice)}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-inner">
                      <div className="flex flex-col items-center">
                        <span className="text-gray-500 font-extrabold uppercase tracking-widest text-xs mb-1">Сума до оплати</span>
                        <span className="text-[2.5rem] leading-tight font-black tracking-tighter text-gray-900">
                          {formatUAH(totalPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STEP 4: Checkout */}
          {step === 4 && (
            <div className="animate-in fade-in zoom-in-95 duration-500">
              {/* If on mobile, add padding around since container lost it for edges, but keep inside grid padded */}
              <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* Left Side: Forms */}
                <div className="lg:col-span-7 space-y-12 bg-white sm:rounded-[2rem] sm:p-1 p-0">
                  
                  {/* Info Box */}
                  <div className="bg-blue-50/70 border border-blue-100 p-6 rounded-[1.5rem] shadow-sm">
                      <h4 className="font-extrabold text-blue-900 mb-4 flex items-center text-lg tracking-tight">
                        <Info className="w-5 h-5 mr-2.5 text-blue-600" strokeWidth={2.5} /> Вимоги до файлів
                      </h4>
                      <ul className="space-y-3 sm:space-y-2 text-sm font-medium text-blue-800/80">
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-emerald-500 flex-shrink-0" strokeWidth={3} /> Формат файлу: JPG або PNG</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-emerald-500 flex-shrink-0" strokeWidth={3} /> Роздільність: 300 DPI рекомендовано (мін. 150 DPI)</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-emerald-500 flex-shrink-0" strokeWidth={3} /> Колірний режим: sRGB</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-emerald-500 flex-shrink-0" strokeWidth={3} /> Ім'я файлу: тільки латинські літери (напр. photo1.jpg)</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-emerald-500 flex-shrink-0" strokeWidth={3} /> Максимальний розмір файлу: 50 МБ на фото</li>
                      </ul>
                  </div>

                  {/* Photo Uploader */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                       1. Завантажте фото
                       <span className="ml-3 px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500 uppercase tracking-widest">{photos.length} завантажено</span>
                    </h2>
                    <PhotoUploader
                        maxFiles={maxPhotos}
                        minFiles={minPhotos}
                        canvasSize={getCanvasSize(format)}
                        onPhotosChange={setPhotos}
                    />
                  </div>

                  {/* Delivery Form */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center border-t border-gray-100 pt-10">
                       2. Доставка та контакти
                    </h2>
                    
                    <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Повне ім'я *</label>
                          <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Іван Франко" className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3.5 px-4 border font-medium bg-gray-50 focus:bg-white transition-colors" required />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Номер телефону *</label>
                              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380..." className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3.5 px-4 border font-medium bg-gray-50 focus:bg-white transition-colors" required />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">Email *</label>
                              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3.5 px-4 border font-medium bg-gray-50 focus:bg-white transition-colors" required />
                          </div>
                        </div>

                        <div className="pt-4">
                          <label className="block text-sm font-bold text-gray-700 mb-3">Спосіб доставки *</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <label className={`border-2 rounded-2xl p-4 flex flex-col cursor-pointer transition-all ${deliveryMethod === 'pickup' ? 'border-blue-600 bg-blue-50/50 shadow-md ring-4 ring-blue-600/10' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <Store className={`w-6 h-6 ${deliveryMethod === 'pickup' ? 'text-blue-600' : 'text-gray-400'}`} />
                                  <input type="radio" name="delivery" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} className="text-blue-600 focus:ring-blue-500 h-5 w-5" />
                                </div>
                                <span className={`font-bold mt-1 ${deliveryMethod === 'pickup' ? 'text-blue-900' : 'text-gray-900'}`}>Самовивіз у Тернополі</span>
                                <span className="text-xs font-medium text-gray-500 mt-1">Безкоштовно</span>
                              </label>

                              <label className={`border-2 rounded-2xl p-4 flex flex-col cursor-pointer transition-all ${deliveryMethod === 'nova_poshta' ? 'border-blue-600 bg-blue-50/50 shadow-md ring-4 ring-blue-600/10' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <Truck className={`w-6 h-6 ${deliveryMethod === 'nova_poshta' ? 'text-blue-600' : 'text-gray-400'}`} />
                                  <input type="radio" name="delivery" checked={deliveryMethod === 'nova_poshta'} onChange={() => setDeliveryMethod('nova_poshta')} className="text-blue-600 focus:ring-blue-500 h-5 w-5" />
                                </div>
                                <span className={`font-bold mt-1 ${deliveryMethod === 'nova_poshta' ? 'text-blue-900' : 'text-gray-900'}`}>Доставка Новою Поштою</span>
                                <span className="text-xs font-medium text-gray-500 mt-1">Стандартні тарифи</span>
                              </label>
                          </div>
                        </div>

                        {deliveryMethod === 'nova_poshta' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-2xl border border-gray-100 animate-in slide-in-from-top-4 fade-in">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-400" /> Місто *</label>
                                <input type="text" value={npCity} onChange={e => setNpCity(e.target.value)} placeholder="Київ" className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 px-3 border font-medium" required />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Номер відділення *</label>
                                <input type="text" value={npBranch} onChange={e => setNpBranch(e.target.value)} placeholder="напр. 15" className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 px-3 border font-medium" required />
                            </div>
                          </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Коментар (необов'язково)</label>
                            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Будь-які особливі побажання..." rows={3} className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 px-4 border font-medium bg-gray-50 focus:bg-white transition-colors" />
                        </div>
                    </div>
                  </div>

                </div>

                {/* Right side: Final Order Summary Tracker */}
                <div className="lg:col-span-5 relative">
                   <div className="sticky top-10 w-full z-10 hidden sm:block">
                     <OrderSummary
                       productName={`Фотокнига ${tier === 'standard' ? 'Стандарт' : 'Преміум'}`}
                       basePrice={basePrice}
                       totalPrice={totalPrice}
                       selectedOptions={orderOptions}
                       isReady={isReadyToOrder}
                       onAddToCart={handlePlaceOrder}
                       productionTime={tier === 'standard' ? '14–18 робочих днів' : '14 робочих днів'}
                       isSubmitting={isSubmitting}
                       errorMessage={formError}
                     />
                   </div>
                </div>

              </div>              
            </div>
          )}

          {/* Navigation Buttons for step 1-3 */}
          {step < 4 && (
            <div className={`mt-10 pt-6 border-t border-gray-100 flex items-center justify-between z-20 relative bg-white`}>
              {step > 1 ? (
                <button 
                  onClick={handleBack}
                  className="flex items-center px-5 py-3.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-bold transition-all"
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
                    : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] focus:ring-8 focus:ring-gray-200'}
                `}
              >
                Продовжити
                <ChevronRight className="w-6 h-6 ml-1.5" strokeWidth={3} />
              </button>
            </div>
          )}

          {/* Special Nav purely for mobile step 4 floating bar */}
          {step === 4 && (
            <div className="block sm:hidden border-t border-gray-100 mt-10 pt-6">
               <OrderSummary
                 productName={`Фотокнига ${tier === 'standard' ? 'Стандарт' : 'Преміум'}`}
                 basePrice={basePrice}
                 totalPrice={totalPrice}
                 selectedOptions={orderOptions}
                 isReady={isReadyToOrder}
                 onAddToCart={handlePlaceOrder}
                 productionTime={tier === 'standard' ? '14–18 робочих днів' : '14 робочих днів'}
               />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
