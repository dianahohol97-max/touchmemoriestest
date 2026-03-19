'use client';

import React, { useState } from 'react';
import { useCartStore } from '@/store/cart-store';
import { ArrowLeft, ArrowRight, CheckCircle2, Image as ImageIcon, Map, MessageSquareText, ShieldCheck, MapPin, Truck } from 'lucide-react';
import PhotoUploader from '@/components/PhotoUploader';
import { submitOrder } from '@/lib/submitOrder';

const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount) + ' UAH';
};

const POSTER_SIZES = [
  { id: 'A4', title: 'A4', size: '21×29.7 cm', price: 350 },
  { id: 'A3', title: 'A3', size: '29.7×42 cm', price: 450 }
];

const DESIGN_TYPES = [
  { 
    id: 'star_map', 
    title: 'Star Map', 
    titleUk: 'Карта зірок',
    desc: 'Shows the exact night sky from any location on any date — perfect for birthdays, anniversaries, the night you met.'
  },
  { 
    id: 'custom_text', 
    title: 'Custom Text Poster', 
    titleUk: 'Постер з написом',
    desc: 'Your own quote, names, or special message in beautiful typography.' 
  }
];

export default function PostersConstructorPage() {
  const addItem = useCartStore((state) => state.addItem);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Size
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);

  // Design
  const [designType, setDesignType] = useState<string | null>(null);

  // Star Map Form
  const [starMapDate, setStarMapDate] = useState('');
  const [starMapCity, setStarMapCity] = useState('');
  const [starMapHeadline, setStarMapHeadline] = useState('');
  const [starMapSubtext, setStarMapSubtext] = useState('');

  // Custom Text Form
  const [customMainText, setCustomMainText] = useState('');
  const [customSubtext, setCustomSubtext] = useState('');
  const [textStyle, setTextStyle] = useState<'minimal' | 'classic' | 'bold'>('minimal');
  const [customPhoto, setCustomPhoto] = useState<File[]>([]);

  // Checkout Form
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'nova_poshta'>('pickup');
  const [npAddress, setNpAddress] = useState('');
  const [comment, setComment] = useState('');

  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [formError, setFormError] = useState('');

  const selectedSize = POSTER_SIZES.find(s => s.id === selectedSizeId);
  const totalPrice = selectedSize?.price || 0;

  // Validations
  const isStarMapValid = starMapDate !== '' && starMapCity.trim() !== '';
  const isCustomTextValid = customMainText.trim() !== '';
  const isDetailsValid = designType === 'star_map' ? isStarMapValid : isCustomTextValid;
  const isFormValid = customerName.trim() !== '' && phone.trim().length >= 10 && email.includes('@') && (deliveryMethod === 'pickup' || npAddress.trim() !== '');

  const handleNext = () => {
    if (step === 1 && selectedSizeId) setStep(2);
    else if (step === 2 && designType) setStep(3);
    else if (step === 3 && isDetailsValid) setStep(4);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
  };

  const handlePlaceOrder = async () => {
    if (isFormValid) {
      setIsSubmitting(true);
      setFormError('');

      let designNotes = '';
      if (designType === 'star_map') {
        designNotes = `Star Map Details:\nDate: ${starMapDate}\nCity: ${starMapCity}\nHeadline: ${starMapHeadline}\nSubtext: ${starMapSubtext}`;
      } else {
        designNotes = `Custom Text Details:\nMain Text: ${customMainText}\nSubtext: ${customSubtext}\nStyle: ${textStyle}`;
      }

      const result = await submitOrder({
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'nova_poshta' ? { city: npAddress.split(',')[0] || npAddress, branch: npAddress } : undefined,
        items: [{
          product_type: 'poster',
          product_name: `Poster - ${selectedSize?.title} (${designType === 'star_map' ? 'Star Map' : 'Custom Text'})`,
          format: selectedSize?.title || '',
          quantity: 1,
          unit_price: totalPrice,
          total_price: totalPrice,
          options: {
            design: designType === 'star_map' ? 'Star Map' : 'Custom Text'
          }
        }],
        subtotal: totalPrice,
        delivery_cost: 0,
        total: totalPrice,
        notes: `${designNotes}\n\nClient Comment: ${comment}`
      });

      setIsSubmitting(false);

      if (result.success) {
        setOrderNumber(result.order_number!);
        addItem({
          id: Date.now().toString(),
          name: `Poster - ${selectedSize?.title} (${designType === 'star_map' ? 'Star Map' : 'Custom Text'})`,
          price: totalPrice,
          qty: 1,
          options: [
            { label: 'Size', value: selectedSize?.title || '' },
            { label: 'Design', value: designType === 'star_map' ? 'Star Map' : 'Custom Text' }
          ]
        });
        setIsSuccess(true);
        window.scrollTo(0, 0);
      } else {
        setFormError('❌ Щось пішло не так. Спробуйте ще раз.');
        console.error('Order submission failed:', result.error);
      }
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[85vh] bg-gray-50 flex flex-col items-center justify-center font-sans tracking-tight">
        <div className="bg-white p-12 md:p-16 rounded-[2rem] max-w-lg mx-4 text-center shadow-2xl border border-gray-100">
          <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-gray-200">
            <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">Дякуємо за замовлення!</h2>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-8 inline-block w-full">
             <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Номер замовлення</p>
             <p className="text-2xl font-black text-blue-600 tracking-tight">{orderNumber}</p>
          </div>
          <p className="text-lg text-gray-500 mb-10 font-medium leading-relaxed">
            Ми зв'яжемося з вами найближчим часом
          </p>
          <button onClick={() => window.location.href = '/'} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-5 rounded-xl transition-all shadow-md active:scale-95">
             На головну
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-gray-900 font-sans pb-32">
       
       <div className="bg-white border-b border-gray-100 py-20 px-6">
          <div className="max-w-5xl mx-auto text-center">
             <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-gray-100 text-gray-600 font-bold text-[10px] uppercase tracking-widest mb-6">
               Frame Included
             </div>
             <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 text-gray-900">
               Premium Posters
             </h1>
             <p className="text-gray-500 font-medium max-w-xl mx-auto text-lg leading-relaxed">
               Scandinavian minimalism meets your most cherished memories. Delivered meticulously framed and ready to hang.
             </p>
          </div>
       </div>

       <div className="max-w-5xl mx-auto px-6 mt-16 grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-10">
             
             {/* Progress Tabs */}
             <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                  <span className={step >= 1 ? 'text-gray-900' : ''}>1. Size</span>
                  <span>/</span>
                  <span className={step >= 2 ? 'text-gray-900' : ''}>2. Design</span>
                  <span>/</span>
                  <span className={step >= 3 ? 'text-gray-900' : ''}>3. Input</span>
                  <span>/</span>
                  <span className={step >= 4 ? 'text-gray-900' : ''}>4. Review</span>
                </div>
                {step > 1 && (
                  <button onClick={handleBack} className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center">
                    <ArrowLeft className="w-3 h-3 mr-2" /> Back
                  </button>
                )}
             </div>

             {/* STEP 1: SIZE */}
             {step === 1 && (
                <div className="animate-in fade-in duration-500">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Choose Format</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {POSTER_SIZES.map(s => {
                        const isSelected = selectedSizeId === s.id;
                        return (
                          <div 
                            key={s.id} 
                            onClick={() => setSelectedSizeId(s.id)}
                            className={`cursor-pointer rounded-2xl p-8 border hover:shadow-xl transition-all flex flex-col relative
                              ${isSelected ? 'border-gray-900 bg-white shadow-xl ring-1 ring-gray-900' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'}
                            `}
                          >
                             <div className="flex-1 flex flex-col items-center justify-center mb-8 h-32">
                                <div className={`border-4 border-gray-900 bg-white ${s.id === 'A3' ? 'w-24 h-[33.9px] scale-[1.3]' : 'w-24 h-32'} flex items-center justify-center`}>
                                   <ImageIcon className="w-6 h-6 text-gray-200" />
                                </div>
                             </div>
                             <div className="text-center">
                                <h3 className={`font-black tracking-tight text-2xl mb-1 ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>{s.title}</h3>
                                <p className="text-sm font-medium text-gray-500 mb-6">{s.size}</p>
                                <span className="font-bold text-gray-900 text-xl tracking-tight">{s.price} ₴</span>
                             </div>

                             {/* Badge */}
                             <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-1 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-md whitespace-nowrap">
                                🖼 Black frame included
                             </div>

                             {isSelected && (
                               <div className="absolute top-4 right-4 text-gray-900">
                                  <CheckCircle2 className="w-6 h-6 bg-white rounded-full" strokeWidth={2.5} />
                               </div>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>
             )}

             {/* STEP 2: DESIGN TYPE */}
             {step === 2 && (
                <div className="animate-in slide-in-from-right-8 duration-500">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Select Design Type</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {DESIGN_TYPES.map(type => {
                        const isSelected = designType === type.id;
                        return (
                          <div 
                            key={type.id} 
                            onClick={() => setDesignType(type.id)}
                            className={`cursor-pointer rounded-2xl p-8 border transition-all flex flex-col
                              ${isSelected ? 'border-gray-900 bg-white shadow-xl ring-1 ring-gray-900' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:shadow-lg'}
                            `}
                          >
                             <div className="mb-6 flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-900">
                               {type.id === 'star_map' ? <Map className="w-5 h-5" /> : <MessageSquareText className="w-5 h-5" />}
                             </div>
                             <h3 className="font-bold tracking-tight text-xl text-gray-900 mb-1">{type.title}</h3>
                             <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">{type.titleUk}</p>
                             <p className="text-sm text-gray-600 leading-relaxed font-medium">{type.desc}</p>
                             
                             {isSelected && (
                               <div className="mt-6 flex justify-end text-gray-900">
                                  <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
                               </div>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>
             )}

             {/* STEP 3: DETAILS FORM */}
             {step === 3 && designType === 'star_map' && (
                <div className="animate-in slide-in-from-right-8 duration-500">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Configure Star Map</h2>
                   <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-8">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                         <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Date *</label>
                            <input type="date" value={starMapDate} onChange={e => setStarMapDate(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:bg-white transition-colors text-sm" />
                         </div>
                         <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">City / Location *</label>
                            <input type="text" value={starMapCity} onChange={e => setStarMapCity(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:bg-white transition-colors text-sm" placeholder="Kyiv, Ukraine" />
                         </div>
                      </div>
                      
                      <div>
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Headline Text (Optional)</label>
                         <input type="text" value={starMapHeadline} onChange={e => setStarMapHeadline(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:bg-white transition-colors text-sm" placeholder="e.g. The night everything changed" />
                      </div>

                      <div>
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Sub-Text (Optional)</label>
                         <input type="text" value={starMapSubtext} onChange={e => setStarMapSubtext(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:bg-white transition-colors text-sm" placeholder="e.g. Roman & Diana" />
                      </div>
                   </div>
                </div>
             )}

             {step === 3 && designType === 'custom_text' && (
                <div className="animate-in slide-in-from-right-8 duration-500">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Configure Typography</h2>
                   <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-8">
                      <div>
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Main text *</label>
                         <textarea value={customMainText} onChange={e => setCustomMainText(e.target.value)} required rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-2 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:bg-white transition-colors text-sm" placeholder="Your favorite quote..." />
                      </div>
                      
                      <div>
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Sub-Text (Optional)</label>
                         <input type="text" value={customSubtext} onChange={e => setCustomSubtext(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 focus:bg-white transition-colors text-sm" placeholder="e.g. Author or date" />
                      </div>

                      <div>
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-4">Text Style Base</label>
                         <div className="grid grid-cols-3 gap-4">
                            {(['minimal', 'classic', 'bold'] as const).map(style => (
                               <label key={style} className={`border rounded-xl p-4 text-center cursor-pointer transition-colors ${textStyle === style ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                                 <input type="radio" checked={textStyle === style} onChange={() => setTextStyle(style)} className="sr-only" />
                                 <span className="font-bold text-sm tracking-wide capitalize">{style}</span>
                               </label>
                            ))}
                         </div>
                      </div>

                      <div className="border-t border-gray-100 pt-8 mt-8">
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-4">Background Photography (Optional)</label>
                         <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                           <PhotoUploader minFiles={0} maxFiles={1} canvasSize={{ width: 2480, height: 3508 }} onPhotosChange={setCustomPhoto} />
                         </div>
                      </div>
                   </div>
                </div>
             )}

             {/* STEP 4: CHECKOUT FORM */}
             {step === 4 && (
                <div className="animate-in slide-in-from-right-8 duration-500">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Delivery Details</h2>

                   <div className="bg-white rounded-[2rem] border border-gray-200 p-8 shadow-sm space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Name *</label>
                            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="Emma Swan" />
                         </div>
                         <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Phone *</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="+380..." />
                         </div>
                      </div>
                      
                      <div>
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Email *</label>
                         <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="hello@mail.com" />
                      </div>

                      <div>
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-4">Delivery Method *</label>
                         <div className="flex flex-col sm:flex-row gap-4 mb-4">
                            <label className={`flex-1 border rounded-xl p-5 flex items-center cursor-pointer transition-colors ${deliveryMethod === 'pickup' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                               <input type="radio" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} className="sr-only" />
                               <MapPin className={`w-5 h-5 mr-3 ${deliveryMethod === 'pickup' ? 'text-gray-900' : 'text-gray-400'}`} />
                               <span className={`font-bold text-sm ${deliveryMethod === 'pickup' ? 'text-gray-900' : 'text-gray-600'}`}>Self-pickup in Ternopil</span>
                            </label>
                            <label className={`flex-1 border rounded-xl p-5 flex items-center cursor-pointer transition-colors ${deliveryMethod === 'nova_poshta' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                               <input type="radio" checked={deliveryMethod === 'nova_poshta'} onChange={() => setDeliveryMethod('nova_poshta')} className="sr-only" />
                               <Truck className={`w-5 h-5 mr-3 ${deliveryMethod === 'nova_poshta' ? 'text-gray-900' : 'text-gray-400'}`} />
                               <span className={`font-bold text-sm ${deliveryMethod === 'nova_poshta' ? 'text-gray-900' : 'text-gray-600'}`}>Nova Poshta</span>
                            </label>
                         </div>
                         {deliveryMethod === 'nova_poshta' && (
                           <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mt-2">
                             <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">City & Branch Number *</label>
                             <input type="text" value={npAddress} onChange={e => setNpAddress(e.target.value)} required className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors" placeholder="e.g. Kyiv, Branch #102" />
                           </div>
                         )}
                      </div>

                      <div>
                         <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Comment (Optional)</label>
                         <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors resize-none" placeholder="Notes for our designer..." />
                      </div>
                   </div>
                </div>
             )}
          </div>

          {/* Sticky Summary */}
          <div className="lg:col-span-5 xl:col-span-4">
             <div className={`sticky top-8 bg-gray-50 rounded-[2rem] p-8 lg:p-10 border border-gray-100 shadow-xl transition-all duration-500 ${selectedSize ? 'opacity-100 transform-none' : 'opacity-40 pointer-events-none translate-y-4'}`}>
                <h3 className="text-xl font-bold mb-8 text-gray-900 tracking-tight flex items-center justify-between border-b border-gray-200 pb-6">
                   Order Summary
                </h3>
                
                {selectedSize && (
                  <div className="space-y-6">
                    <div className="flex justify-between font-medium items-center">
                       <span className="text-gray-500 text-sm">Size</span>
                       <span className="bg-white border border-gray-200 px-3 py-1 rounded-lg text-sm font-bold shadow-sm">{selectedSize.title}</span>
                    </div>
                    {designType && (
                      <div className="flex justify-between font-medium items-center">
                         <span className="text-gray-500 text-sm">Theme</span>
                         <span className="text-gray-900 text-sm font-bold">{designType === 'star_map' ? 'Star Map' : 'Custom Typography'}</span>
                      </div>
                    )}
                    
                    <div className="h-px bg-gray-200 my-6" />

                    <div className="flex justify-between font-bold text-lg items-center text-gray-900">
                       <span>Total</span>
                       <span className="text-2xl">{formatUAH(totalPrice)}</span>
                    </div>

                    {step === 4 && (
                      <div className="mt-8 mb-6 py-4 px-5 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-4">
                         <ShieldCheck className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
                         <p className="text-xs font-semibold text-blue-900 leading-relaxed font-sans">
                            ✏️ Our designer will send you a preview within 24 hours for your approval — nothing is printed until you confirm.
                         </p>
                      </div>
                    )}

                    {step < 4 ? (
                      <button 
                        onClick={handleNext}
                        disabled={(step === 2 && !designType) || (step === 3 && !isDetailsValid)}
                        className="w-full mt-2 bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-5 rounded-xl uppercase tracking-widest text-[11px] transition-all flex items-center justify-center disabled:cursor-not-allowed group shadow-md"
                      >
                         Continue <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <>
                        {formError && (
                          <div className="mt-2 mb-2 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg text-center border border-red-200">
                            {formError}
                          </div>
                        )}
                        <button 
                          onClick={handlePlaceOrder}
                          disabled={!isFormValid || isSubmitting}
                          className="w-full mt-2 bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-5 rounded-xl uppercase tracking-widest text-[11px] transition-all disabled:cursor-not-allowed shadow-xl active:scale-95 flex justify-center items-center"
                        >
                           {isSubmitting ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                           ) : (
                              'Place Order'
                           )}
                        </button>
                      </>
                    )}

                    <p className="text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-6">
                      Production: 3–5 business days <br/><span className="lowercase font-medium tracking-normal text-[11px] text-gray-500">(after your design approval)</span>
                    </p>
                  </div>
                )}
             </div>
          </div>

       </div>
    </div>
  );
}
