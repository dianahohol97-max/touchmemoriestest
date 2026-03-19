'use client';
import { Navigation } from '@/components/ui/Navigation';
import { useCartStore } from '@/store/cart-store';

import React, { useState, useMemo } from 'react';
import { TRAVEL_BOOK } from '@/lib/products';
import { CheckCircle2, ChevronRight, ArrowLeft, Info, Plus, Truck, Store, MapPin, Compass, Globe } from 'lucide-react';
import Link from 'next/link';
import PhotoUploader from '@/components/PhotoUploader';
import OrderSummary from '@/components/OrderSummary';
import { submitOrder } from '@/lib/submitOrder';

const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount) + ' UAH';
};

export default function TravelbookConstructorPage() {
  const addItem = useCartStore((state) => state.addItem);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [pages, setPages] = useState<number>(12);
  const [lamination, setLamination] = useState<'none' | 'glossy' | 'matte'>('none');
  const [endpapers, setEndpapers] = useState<boolean>(false);
  const [qrCode, setQrCode] = useState<boolean>(false);
  const [customCover, setCustomCover] = useState<boolean>(false);

  // Step 2
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

  const totalSteps = 2;

  const handleNext = () => {
    if (step === 1 && pages) setStep(2);
  };

  const handleBack = () => {
    if (step > 1) setStep(1);
  };

  // Pricing calculations
  const basePrice = TRAVEL_BOOK.prices[pages] || 0;
  const laminationPrice = lamination !== 'none' ? 5 * pages : 0;
  const endpapersPrice = endpapers ? 100 : 0;
  const qrCodePrice = qrCode ? 50 : 0;
  const customCoverPrice = customCover ? 50 : 0;

  const extrasTotal = laminationPrice + endpapersPrice + qrCodePrice + customCoverPrice;
  const totalPrice = basePrice + extrasTotal;

  const minPhotos = Math.floor(pages / 2);
  const maxPhotos = pages;

  // Step 2 requirements mapping
  const orderOptions = useMemo(() => {
    const opts = [];
    opts.push({ label: 'Format', value: 'A4 (21×29.7 cm)' });
    opts.push({ label: 'Pages', value: pages.toString() });
    
    if (lamination !== 'none') opts.push({ label: 'Lamination', value: `${lamination} finish`, price: laminationPrice });
    if (endpapers) opts.push({ label: 'Endpapers', value: 'Included', price: endpapersPrice });
    if (qrCode) opts.push({ label: 'QR Code', value: 'Included', price: qrCodePrice });
    if (customCover) opts.push({ label: 'Custom Cover', value: 'Included', price: customCoverPrice });
    
    return opts;
  }, [pages, lamination, endpapers, qrCode, customCover, laminationPrice, endpapersPrice, qrCodePrice, customCoverPrice]);

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
          product_type: 'travelbook',
          product_name: "Travel Book",
          format: 'A4 (21×29.7 cm)',
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
        addItem({ id: Date.now().toString(), name: "Travel Book", price: totalPrice, qty: 1 });
        setIsSuccess(true);
        window.scrollTo(0,0);
      } else {
        setFormError('❌ Щось пішло не так. Спробуйте ще раз.');
        console.error('Order submission failed:', result.error);
      }
    }
  };

  const stepTitles: Record<number, string> = {
    1: 'Configure Travel Book',
    2: 'Upload & Review'
  };

  if (isSuccess) {
    return (
      <>
        <Navigation />
        <div className="min-h-[85vh] bg-[#FDFBF7] flex flex-col items-center justify-center font-sans mt-20">
        <div className="bg-white p-12 rounded-[2.5rem] shadow-xl text-center max-w-xl mx-4 border border-[#E9E4DB] animate-in zoom-in-95 duration-500 mt-20">
          <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-amber-100 mt-20">
             <Globe className="w-12 h-12 text-amber-600" strokeWidth={2} />
          </div>
          <h2 className="text-4xl font-extrabold text-stone-900 mb-5 tracking-tight">Дякуємо за замовлення!</h2>
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-6 mb-8 inline-block shadow-inner w-full mt-20">
             <p className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-1">Номер замовлення</p>
             <p className="text-2xl font-black text-amber-600 tracking-tight">{orderNumber}</p>
          </div>
          <p className="text-lg text-stone-600 mb-6 leading-relaxed font-medium">
            Ми зв'яжемося з вами найближчим часом
          </p>
          <div className="bg-stone-50 rounded-2xl p-6 text-sm text-stone-600 font-medium mb-10 text-left flex flex-col gap-2 mt-20">
            <div className="flex justify-between mt-20"><span className="text-stone-500">Кількість фото:</span> <span className="text-stone-900">{photos.length}</span></div>
            <div className="flex justify-between mt-20"><span className="text-stone-500">До сплати:</span> <span className="text-stone-900 font-bold">{formatUAH(totalPrice)}</span></div>
            <div className="flex justify-between mt-20"><span className="text-stone-500">Доставка:</span> <span className="text-stone-900 capitalize">{deliveryMethod.replace('_', ' ')}</span></div>
          </div>
          <Link href="/" className="inline-flex items-center justify-center px-10 py-4 w-full rounded-2xl font-bold bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
             На головну
          </Link>
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-[#FDFBF7] font-sans pb-20 mt-20">
      
      {/* Travel-themed Hero Header */}
      <div className="relative h-[240px] md:h-[300px] w-full overflow-hidden bg-stone-900 mt-20">
         <img 
           src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop" 
           alt="Travel vibes map"
           className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-[#FDFBF7] to-transparent mt-20" />
         
         <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 mt-20">
            <h1 className="text-4xl md:text-5xl font-black text-stone-900 tracking-tight mb-3 flex items-center shadow-sm">
                <Compass className="w-8 h-8 md:w-10 md:h-10 mr-3 text-amber-600 drop-shadow-sm" strokeWidth={2.5} />
                Travel Book
            </h1>
            <p className="text-stone-700 font-bold text-sm md:text-base tracking-widest uppercase bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/50">
               Capture Your Adventures
            </p>
         </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10 mt-20">
        
        {/* Header Navigation & Progress */}
        <div className="mb-8 max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-20">
          <Link href="/products/travelbooks" className="text-sm font-bold text-stone-500 hover:text-amber-700 flex items-center transition-colors w-max bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-stone-200">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to products
          </Link>
          
          <div className="flex items-center justify-end flex-1 max-w-xs mt-20">
            <div className="w-full mt-20">
              <div className="flex justify-between items-center text-xs font-bold text-stone-500 mb-2 uppercase tracking-widest mt-20">
                <span className="text-amber-700">Step {step}</span>
                <span>{stepTitles[step]}</span>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden flex mt-20">
                <div 
                  className="bg-amber-500 h-2 rounded-full transition-all duration-700 ease-in-out"
                  style={{ width: `${(step / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Wrapper */}
        <div className={`bg-white rounded-[2rem] shadow-xl border border-stone-100 ${step === 2 ? 'p-0 sm:p-6 lg:p-10 bg-transparent sm:bg-white border-none sm:border-solid shadow-none sm:shadow-xl' : 'p-6 md:p-10'} relative overflow-hidden max-w-5xl mx-auto`}>
          
          {/* STEP 1: Configuration */}
          {step === 1 && (
             <div className="animate-in fade-in slide-in-from-right-4 duration-500 mt-20">
              
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between mb-8 pb-6 border-b border-stone-100 mt-20">
                <div>
                   <h2 className="text-2xl font-black text-stone-900 mb-1">Book Specifications</h2>
                   <p className="text-stone-500 font-medium">Choose your pages and custom finishes.</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex items-center shadow-inner mt-20">
                   <div className="w-8 h-10 border-2 border-stone-300 rounded bg-white mr-3 flex items-center justify-center shadow-sm mt-20">
                      <span className="text-[10px] font-black text-stone-400">A4</span>
                   </div>
                   <div>
                       <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mt-20">Fixed Format</div>
                       <div className="font-extrabold text-stone-800 mt-20">A4 (21×29.7 cm)</div>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mt-20">
                <div className="lg:col-span-7 space-y-10 mt-20">
                  
                  {/* Page Count */}
                  <div>
                    <div className="flex justify-between items-end mb-4 mt-20">
                      <h3 className="text-lg font-extrabold text-stone-900">Number of Pages</h3>
                      <span className="text-3xl font-black text-amber-600 tracking-tight leading-none bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 shadow-sm">{pages}</span>
                    </div>
                    
                    <div className="bg-white p-6 rounded-[1.5rem] border border-stone-200 shadow-sm mt-20">
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-6 mt-20">
                        {TRAVEL_BOOK.pagesAvailable.map(p => (
                          <button
                            key={p}
                            onClick={() => setPages(p)}
                            className={`py-2 rounded-xl text-sm font-bold transition-all duration-200
                              ${pages === p 
                                ? 'bg-stone-900 text-white shadow-md scale-105 ring-2 ring-stone-900/20' 
                                : 'bg-stone-50 text-stone-600 border border-stone-200 hover:border-amber-400 hover:text-amber-700'
                              }
                            `}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      
                      <div className="flex items-start text-sm text-amber-900 bg-amber-50/70 p-4 rounded-xl border border-amber-100 mt-20">
                        <Info className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-amber-600" />
                        <div>
                          <p className="font-bold mb-1">Standard 170g glossy inner pages.</p>
                          <p className="font-medium text-amber-800/80">You will need to upload between <strong className="text-stone-900">{Math.floor(pages / 2)}</strong> and <strong className="text-stone-900">{pages}</strong> photos.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Extras */}
                  <div>
                    <h3 className="text-lg font-extrabold text-stone-900 mb-4">Optional Enhancements</h3>
                    
                    <div className="space-y-4 mt-20">
                      <div className="p-6 rounded-[1.5rem] border border-stone-200 bg-white shadow-sm flex flex-col sm:flex-row gap-5 hover:border-amber-200 transition-colors mt-20">
                          <div className="flex-1 mt-20">
                            <h4 className="font-extrabold text-stone-900 text-base mb-1">Lamination</h4>
                            <p className="text-[13px] font-medium text-stone-500 mb-4">Protect pages with a premium finish (5 UAH/page)</p>
                            
                            <div className="flex flex-wrap gap-4 mt-20">
                              {['none', 'glossy', 'matte'].map((type) => (
                                <label key={type} className="flex items-center gap-2 cursor-pointer group">
                                  <span className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors shadow-inner
                                    ${lamination === type ? 'border-amber-500 bg-amber-500' : 'border-stone-300 group-hover:border-amber-400 bg-white'}
                                  `}>
                                    {lamination === type && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={4} />}
                                  </span>
                                  <span className={`text-sm font-bold capitalize pt-0.5 ${lamination === type ? 'text-stone-900' : 'text-stone-500'}`}>{type}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="text-sm font-black text-stone-900 bg-stone-100 border border-stone-200 px-4 py-2 rounded-xl flex items-center justify-center h-min shadow-sm whitespace-nowrap mt-20">
                            +{5 * pages} UAH
                          </div>
                      </div>

                      {([
                        { id: 'endpapers', state: endpapers, setter: setEndpapers, title: 'Endpapers (Форзаці)', price: 100, desc: 'Decorative inner covers giving a premium feel' },
                        { id: 'qrCode', state: qrCode, setter: setQrCode, title: 'QR code on cover', price: 50, desc: 'Link to a travel video/map scanned by phone' },
                        { id: 'customCover', state: customCover, setter: setCustomCover, title: 'Custom cover text', price: 50, desc: 'Add personalized trip title on the cover' }
                      ] as const).map((extra) => (
                         <label key={extra.id} className={`flex items-start p-6 rounded-[1.5rem] border transition-all cursor-pointer group shadow-sm
                           ${extra.state ? 'border-amber-500 bg-amber-50/30 shadow-md ring-2 ring-amber-500/10' : 'border-stone-200 bg-white hover:border-amber-300'}
                         `}>
                           <div className={`mt-0.5 w-[22px] h-[22px] rounded-md border flex-shrink-0 flex items-center justify-center transition-colors shadow-inner
                             ${extra.state ? 'border-amber-500 bg-amber-500' : 'border-stone-300 group-hover:border-amber-400 bg-stone-50'}
                           `}>
                             {extra.state && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                           </div>
                           <div className="ml-4 flex-1 mt-20">
                             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-1 mt-20">
                               <h4 className={`font-extrabold ${extra.state ? 'text-amber-900' : 'text-stone-900'}`}>{extra.title}</h4>
                               <span className="text-sm font-black text-stone-900 bg-stone-100 border border-stone-200 px-3 py-1 rounded-lg self-start sm:self-auto">
                                 +{extra.price} UAH
                               </span>
                             </div>
                             <p className="text-[13px] font-medium text-stone-500">{extra.desc}</p>
                           </div>
                         </label>
                      ))}

                    </div>
                  </div>
                </div>

                {/* Right side Summary Tracker */}
                <div className="lg:col-span-5 hidden sm:block mt-20">
                  <div className="bg-[#1f1a17] rounded-[2rem] p-8 text-stone-100 sticky top-24 shadow-2xl overflow-hidden border border-stone-800 mt-20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-600/10 blur-[80px] rounded-full pointer-events-none mt-20" />
                    
                    <div className="flex items-center justify-center mb-8 border-b border-stone-800 pb-5 mt-20">
                       <Globe className="text-amber-500 w-5 h-5 mr-2 opacity-80" />
                       <h3 className="text-lg font-bold tracking-widest text-stone-300 uppercase">Live Estimate</h3>
                    </div>
                    
                    <div className="space-y-4 mb-8 mt-20">
                      <div className="flex justify-between items-start font-medium text-[15px] mt-20">
                        <span className="text-stone-400">Base price (A4, {pages}p)</span>
                        <span className="text-white font-bold">{formatUAH(basePrice)}</span>
                      </div>
                      
                      {lamination !== 'none' && (
                        <div className="flex justify-between items-start text-[14px] text-stone-500 mt-20">
                          <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-stone-600" /> Lam. (<span className="capitalize">{lamination}</span>)</span>
                          <span>{formatUAH(laminationPrice)}</span>
                        </div>
                      )}
                      
                      {endpapers && (
                        <div className="flex justify-between items-start text-[14px] text-stone-500 mt-20">
                          <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-stone-600" /> Endpapers</span>
                          <span>{formatUAH(endpapersPrice)}</span>
                        </div>
                      )}

                      {qrCode && (
                        <div className="flex justify-between items-start text-[14px] text-stone-500 mt-20">
                          <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-stone-600" /> QR Code</span>
                          <span>{formatUAH(qrCodePrice)}</span>
                        </div>
                      )}

                      {customCover && (
                        <div className="flex justify-between items-start text-[14px] text-stone-500 mt-20">
                          <span className="flex items-center"><Plus className="w-3.5 h-3.5 mr-1 text-stone-600" /> Custom Cover</span>
                          <span>{formatUAH(customCoverPrice)}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#FAF8F5] rounded-2xl p-5 shadow-inner mt-20">
                      <div className="flex flex-col items-center mt-20">
                        <span className="text-stone-500 font-extrabold uppercase tracking-widest text-[11px] mb-1">Total Journey</span>
                        <span className="text-[2.5rem] leading-tight font-black tracking-tighter text-stone-900">
                          {formatUAH(totalPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STEP 2: Checkout / Upload */}
          {step === 2 && (
            <div className="animate-in fade-in zoom-in-95 duration-500 mt-20">
              <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 mt-20">
                
                {/* Left Side */}
                <div className="lg:col-span-7 space-y-12 bg-white sm:rounded-[2rem] sm:p-1 p-0 mt-20">
                  
                  {/* Info Box */}
                  <div className="bg-stone-50 border border-stone-200 p-6 rounded-[1.5rem] shadow-sm mt-20">
                      <h4 className="font-extrabold text-stone-900 mb-4 flex items-center text-lg tracking-tight">
                        <Info className="w-5 h-5 mr-2.5 text-stone-600" strokeWidth={2.5} /> File Requirements
                      </h4>
                      <ul className="space-y-3 sm:space-y-2 text-sm font-medium text-stone-600">
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-amber-500 flex-shrink-0" strokeWidth={3} /> JPG or PNG formats only</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-amber-500 flex-shrink-0" strokeWidth={3} /> Resolution: 300 DPI recommended (min. 150 DPI)</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-amber-500 flex-shrink-0" strokeWidth={3} /> Color mode: sRGB</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-amber-500 flex-shrink-0" strokeWidth={3} /> Filename: Latin letters only (e.g. bali_trip1.jpg)</li>
                        <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 text-amber-500 flex-shrink-0" strokeWidth={3} /> Maximum file size: 50 MB per photo</li>
                      </ul>
                  </div>

                  {/* Photo Uploader */}
                  <div>
                    <h2 className="text-2xl font-black text-stone-900 mb-6 flex items-center">
                       1. Upload Adventures
                       <span className="ml-3 px-3 py-1 bg-stone-100 rounded-full text-xs font-bold text-stone-500 uppercase tracking-widest">{photos.length} embedded</span>
                    </h2>
                    <PhotoUploader
                        maxFiles={maxPhotos}
                        minFiles={minPhotos}
                        canvasSize={{ width: 2480, height: 3508 }}
                        onPhotosChange={setPhotos}
                    />
                  </div>

                  {/* Delivery Form */}
                  <div>
                    <h2 className="text-2xl font-black text-stone-900 mb-8 flex items-center border-t border-stone-100 pt-10">
                       2. Delivery & Passenger Info
                    </h2>
                    
                    <div className="space-y-6 mt-20">
                        <div>
                          <label className="block text-sm font-bold text-stone-700 mb-2">Full Name *</label>
                          <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jane Doe" className="w-full rounded-xl border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-3.5 px-4 border font-medium bg-stone-50 focus:bg-white transition-colors" required />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-20">
                          <div>
                              <label className="block text-sm font-bold text-stone-700 mb-2">Phone Number *</label>
                              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380..." className="w-full rounded-xl border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-3.5 px-4 border font-medium bg-stone-50 focus:bg-white transition-colors" required />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-stone-700 mb-2">Email *</label>
                              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="explorer@example.com" className="w-full rounded-xl border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-3.5 px-4 border font-medium bg-stone-50 focus:bg-white transition-colors" required />
                          </div>
                        </div>

                        <div className="pt-4 mt-20">
                          <label className="block text-sm font-bold text-stone-700 mb-3">Delivery Method *</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-20">
                              <label className={`border-2 rounded-2xl p-4 flex flex-col cursor-pointer transition-all ${deliveryMethod === 'pickup' ? 'border-amber-600 bg-amber-50/50 shadow-md ring-4 ring-amber-600/10' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'}`}>
                                <div className="flex items-center justify-between mb-2 mt-20">
                                  <Store className={`w-6 h-6 ${deliveryMethod === 'pickup' ? 'text-amber-600' : 'text-stone-400'}`} />
                                  <input type="radio" name="delivery" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} className="text-amber-600 focus:ring-amber-500 h-5 w-5" />
                                </div>
                                <span className={`font-bold mt-1 ${deliveryMethod === 'pickup' ? 'text-amber-900' : 'text-stone-900'}`}>Self-pickup in Ternopil</span>
                                <span className="text-xs font-medium text-stone-500 mt-1">Free</span>
                              </label>

                              <label className={`border-2 rounded-2xl p-4 flex flex-col cursor-pointer transition-all ${deliveryMethod === 'nova_poshta' ? 'border-amber-600 bg-amber-50/50 shadow-md ring-4 ring-amber-600/10' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'}`}>
                                <div className="flex items-center justify-between mb-2 mt-20">
                                  <Truck className={`w-6 h-6 ${deliveryMethod === 'nova_poshta' ? 'text-amber-600' : 'text-stone-400'}`} />
                                  <input type="radio" name="delivery" checked={deliveryMethod === 'nova_poshta'} onChange={() => setDeliveryMethod('nova_poshta')} className="text-amber-600 focus:ring-amber-500 h-5 w-5" />
                                </div>
                                <span className={`font-bold mt-1 ${deliveryMethod === 'nova_poshta' ? 'text-amber-900' : 'text-stone-900'}`}>Nova Poshta Delivery</span>
                                <span className="text-xs font-medium text-stone-500 mt-1">Standard carrier tariff</span>
                              </label>
                          </div>
                        </div>

                        {deliveryMethod === 'nova_poshta' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-stone-50 rounded-2xl border border-stone-200 animate-in slide-in-from-top-4 fade-in mt-20">
                            <div>
                                <label className="block text-sm font-bold text-stone-700 mb-2 flex items-center"><MapPin className="w-4 h-4 mr-1 text-stone-400" /> City *</label>
                                <input type="text" value={npCity} onChange={e => setNpCity(e.target.value)} placeholder="Kyiv" className="w-full rounded-xl border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-3 px-3 border font-medium" required />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-stone-700 mb-2">Branch Number *</label>
                                <input type="text" value={npBranch} onChange={e => setNpBranch(e.target.value)} placeholder="e.g. 15" className="w-full rounded-xl border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-3 px-3 border font-medium" required />
                            </div>
                          </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-stone-700 mb-2">Travel Notes / Comments (optional)</label>
                            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Any special instructions..." rows={3} className="w-full rounded-xl border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 py-3 px-4 border font-medium bg-stone-50 focus:bg-white transition-colors" />
                        </div>
                    </div>
                  </div>

                </div>

                {/* Right side: Final Order Summary Tracker */}
                <div className="lg:col-span-5 relative mt-20">
                   <div className="sticky top-10 w-full z-10 hidden sm:block mt-20">
                     <OrderSummary 
                       productName={`Travel Book`}
                       basePrice={basePrice}
                       totalPrice={totalPrice}
                       selectedOptions={orderOptions}
                       isReady={isReadyToOrder}
                       isSubmitting={isSubmitting}
                       errorMessage={formError}
                       onAddToCart={handlePlaceOrder}
                       productionTime="5–7 business days after payment confirmation"
                     />
                   </div>
                </div>

              </div>              
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-10 pt-6 border-t border-stone-200 flex items-center justify-between z-20 relative bg-white mt-20">
            {step === 2 ? (
              <button 
                onClick={handleBack}
                className="flex items-center px-5 py-3.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl font-bold transition-all"
              >
                <ArrowLeft className="w-5 h-5 mr-2" strokeWidth={2.5} />
                Back
              </button>
            ) : <div />}

            {step === 1 && (
              <button
                onClick={handleNext}
                className="flex items-center px-10 py-4 rounded-xl font-bold transition-all shadow-sm text-lg bg-stone-900 text-white hover:bg-stone-800 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Continue
                <ChevronRight className="w-6 h-6 ml-1.5" strokeWidth={3} />
              </button>
            )}
          </div>

          {/* Mobile sticky cart */}
          {step === 2 && (
            <div className="block sm:hidden border-t border-stone-100 mt-10 pt-6 mt-20">
               <OrderSummary 
                 productName={`Travel Book`}
                 basePrice={basePrice}
                 totalPrice={totalPrice}
                 selectedOptions={orderOptions}
                 isReady={isReadyToOrder}
                 isSubmitting={isSubmitting}
                 errorMessage={formError}
                 onAddToCart={handlePlaceOrder}
                 productionTime="5–7 business days after payment confirmation"
               />
            </div>
          )}

        </div>
      </div>
      </div>
    </>
  );
}
