'use client';
import { Navigation } from '@/components/ui/Navigation';
import React, { useState } from 'react';
import { useCartStore } from '@/store/cart-store';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, ShoppingBag, Truck, Check, MapPin } from 'lucide-react';
import PhotoUploader from '@/components/PhotoUploader';
import { submitOrder } from '@/lib/submitOrder';

const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount) + ' UAH';
};

const MAGNET_SETS = [
  { id: '5x7.5', size: '5×7.5 cm', count: 12, price: 215, w: 5, h: 7.5 },
  { id: '6x9', size: '6×9 cm', count: 10, price: 215, w: 6, h: 9 },
  { id: '7.5x10', size: '7.5×10 cm', count: 8, price: 215, w: 7.5, h: 10 },
  { id: '9x9', size: '9×9 cm', count: 6, price: 215, w: 9, h: 9 },
  { id: '10x10', size: '10×10 cm', count: 6, price: 215, w: 10, h: 10 },
  { id: 'pol_7.6x10.1', size: 'Polaroid 7.6×10.1 cm', count: 8, price: 215, w: 7.6, h: 10.1, isPolaroid: true },
  { id: 'pol_mini', size: 'Polaroid mini 8.6×5.4 cm', count: 10, price: 215, w: 5.4, h: 8.6, isPolaroid: true },
  { id: 'strip', size: 'Photo Strips 6×20 cm', count: 15, price: 215, w: 6, h: 20, desc: '5 strips of 3 photos each', isStrip: true }
];

export default function PhotoMagnetsConstructor() {
  const addItem = useCartStore((state) => state.addItem);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Selections
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [setsQuantity, setSetsQuantity] = useState<number>(1);
  const [photos, setPhotos] = useState<File[]>([]);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paperFinish, setPaperFinish] = useState<'Matte' | 'Glossy'>('Matte');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'nova_poshta'>('pickup');
  const [npAddress, setNpAddress] = useState('');
  const [comment, setComment] = useState('');
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [formError, setFormError] = useState('');

  // Derived logic
  const selectedSet = MAGNET_SETS.find(s => s.id === selectedSetId);
  const requiredPhotosCount = selectedSet ? selectedSet.count * setsQuantity : 0;
  const totalPrice = setsQuantity * 215;
  const uploadedCount = photos.length;
  
  const isUploadComplete = uploadedCount === requiredPhotosCount;
  const isFormValid = customerName.trim() !== '' && phone.trim().length >= 10 && email.includes('@') && (deliveryMethod === 'pickup' || npAddress.trim() !== '');

  const handleNext = () => {
    if (step === 1 && selectedSet) setStep(2);
    else if (step === 2 && isUploadComplete) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3);
  };

  const handleSelectSet = (id: string) => {
    setSelectedSetId(id);
    setSetsQuantity(1);
    setPhotos([]);
  };

  const handlePlaceOrder = async () => {
    if (isFormValid && isUploadComplete) {
      setIsSubmitting(true);
      setFormError('');
      
      const result = await submitOrder({
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'nova_poshta' ? { city: npAddress.split(',')[0] || npAddress, branch: npAddress } : undefined,
        items: [{
          product_type: 'magnets',
          product_name: `Magnets - ${selectedSet?.size}`,
          format: selectedSet?.size || '',
          quantity: setsQuantity,
          unit_price: selectedSet?.price || 0,
          total_price: totalPrice,
          options: {
            finish: paperFinish
          }
        }],
        subtotal: totalPrice,
        delivery_cost: 0,
        total: totalPrice,
        notes: comment
      });

      setIsSubmitting(false);

      if (result.success) {
        setOrderNumber(result.order_number!);
        addItem({
          id: Date.now().toString(),
          name: `Magnets - ${selectedSet?.size}`,
          price: totalPrice,
          qty: 1,
          options: [
            { label: 'Set Size', value: selectedSet?.size || '' },
            { label: 'Quantity', value: `${setsQuantity} ${setsQuantity === 1 ? 'set' : 'sets'}` },
            { label: 'Finish', value: paperFinish }
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
      <>
        <Navigation />
        <div className="min-h-[85vh] bg-rose-50 flex flex-col items-center justify-center font-sans tracking-tight mt-20">
        <div className="bg-white p-12 rounded-[2.5rem] max-w-lg mx-4 text-center shadow-2xl border border-rose-100 mt-20">
          <div className="w-24 h-24 bg-rose-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-rose-200 mt-20">
            <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Дякуємо за замовлення!</h2>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 mb-8 inline-block w-full mt-20">
             <p className="text-sm font-bold text-rose-500 uppercase tracking-widest mb-1">Номер замовлення</p>
             <p className="text-2xl font-black text-rose-600 tracking-tight">{orderNumber}</p>
          </div>
          <p className="text-lg text-gray-500 mb-10 font-medium leading-relaxed">
            Ми зв'яжемося з вами найближчим часом
          </p>
          <button 
             onClick={() => window.location.href = '/'}
             className="w-full bg-gray-900 hover:bg-black text-white font-bold py-5 rounded-2xl transition-colors shadow-lg active:scale-95"
          >
             На головну
          </button>
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-32 tracking-tight mt-20">
       
       {/* Header */}
       <div className="bg-white border-b border-gray-100 py-16 px-6 relative overflow-hidden mt-20">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-rose-50 to-transparent pointer-events-none mt-20" />
          <div className="max-w-5xl mx-auto text-center relative z-10 mt-20">
             <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-gray-100 text-gray-600 font-bold text-xs uppercase tracking-widest mb-6 mt-20">
               215 UAH / set
             </div>
             <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-gray-900">
               Photo Magnets
               <span className="text-xl md:text-2xl text-gray-500 font-bold ml-4 border-l-2 border-gray-200 pl-4">Фотомагніти</span>
             </h1>
             <p className="text-gray-500 font-medium max-w-xl mx-auto text-lg leading-relaxed">
               Magnetic film with premium Fuji Crystal Archive print. Turn your favorite memories into tactile art for the fridge.
             </p>
          </div>
       </div>

       <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12 mt-20">
          
          <div className="lg:col-span-8 flex flex-col gap-8 mt-20">
             
             {/* Dynamic Step Navigation */}
             <div className="flex items-center justify-between mb-2 mt-20">
                <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mt-20">
                  <span className={step >= 1 ? 'text-gray-900' : ''}>1. Format</span>
                  <span>/</span>
                  <span className={step >= 2 ? 'text-gray-900' : ''}>2. Photos</span>
                  <span>/</span>
                  <span className={step >= 3 ? 'text-gray-900' : ''}>3. Delivery</span>
                </div>
                {step > 1 && (
                  <button onClick={handleBack} className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center">
                    <ArrowLeft className="w-3 h-3 mr-2" /> Back
                  </button>
                )}
             </div>

             {/* STEP 1: SET TYPE */}
             {step === 1 && (
                <div className="animate-in fade-in duration-500 mt-20">
                   <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-2xl mb-8 flex items-start shadow-sm mt-20">
                      <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 text-rose-500 mt-0.5" />
                      <div>
                        <strong className="block mb-1 text-rose-900">Important Details</strong>
                        <span className="font-medium text-sm text-rose-700/80">Every magnet has a mandatory 3mm white border built into the final cut. This protects the edges. Produced in 1–3 business days.</span>
                      </div>
                   </div>

                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Choose Shape & Size</h2>
                   
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-20">
                      {MAGNET_SETS.map(set => {
                        const isSelected = selectedSetId === set.id;
                        return (
                          <div 
                            key={set.id} 
                            onClick={() => handleSelectSet(set.id)}
                            className={`cursor-pointer rounded-[2rem] p-6 border transition-all flex flex-col relative overflow-hidden
                              ${isSelected ? 'border-gray-900 bg-white shadow-xl ring-1 ring-gray-900 scale-100' : 'border-gray-200 bg-white/50 hover:border-gray-300 hover:bg-white'}
                            `}
                          >
                             <div className="flex-1 flex flex-col items-center justify-center mb-6 min-h-[140px] mt-20">
                                <div 
                                  className={`shadow-inner flex items-center justify-center overflow-hidden transition-all
                                    ${isSelected ? 'shadow-gray-200/50' : 'shadow-gray-200/50'}
                                    ${set.isPolaroid ? 'bg-white p-1 border-b-[12px] border-x border-t border-gray-200 rounded-sm' : 'bg-gray-100 border-2 border-white rounded-md'}
                                  `}
                                  style={{ 
                                    width: set.w > set.h ? '100px' : `${(set.w/set.h)*100}px`,
                                    height: set.w > set.h ? `${(set.h/set.w)*100}px` : '100px',
                                  }}
                                >
                                   {set.isStrip && (
                                     <div className="w-full h-full p-0.5 flex flex-col gap-0.5 opacity-50 bg-white mt-20">
                                        <div className="flex-1 bg-gray-300 mt-20" />
                                        <div className="flex-1 bg-gray-300 mt-20" />
                                        <div className="flex-1 bg-gray-300 mt-20" />
                                     </div>
                                   )}
                                   {!set.isStrip && !set.isPolaroid && (
                                     <div className="w-[calc(100%-8px)] h-[calc(100%-8px)] bg-gray-200 rounded-sm mt-20" />
                                   )}
                                   {set.isPolaroid && (
                                     <div className="w-full h-full bg-gray-200 mt-20" />
                                   )}
                                </div>
                             </div>
                             
                             <div className="text-center mt-auto mt-20">
                                <h3 className={`font-black tracking-tight mb-2 text-lg ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{set.size}</h3>
                                <div className="inline-flex items-center justify-center bg-gray-50 border border-gray-100 px-3 py-1 rounded-lg mb-4 text-xs mt-20">
                                  <span className="font-bold text-gray-900 border-r border-gray-200 pr-2 mr-2">{set.count} <span className="text-gray-500 font-medium lowercase">magnets</span></span>
                                  <span className="font-bold text-gray-900">215 ₴</span>
                                </div>
                                {set.desc && <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{set.desc}</p>}
                                {set.isPolaroid && <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">White Polaroid Effect</p>}
                             </div>

                             {isSelected && (
                               <div className="absolute top-4 right-4 text-gray-900 mt-20">
                                  <CheckCircle2 className="w-6 h-6 bg-white rounded-full" strokeWidth={2.5} />
                               </div>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>
             )}

             {/* STEP 2: QUANTITY & UPLOAD */}
             {step === 2 && selectedSet && (
                <div className="animate-in slide-in-from-right-8 duration-500 mt-20">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Quantity & Assets</h2>
                   
                   <div className="bg-white border text-center border-gray-200 rounded-[2rem] p-8 mb-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 mt-20">
                      <div className="text-left w-full mt-20">
                         <h3 className="font-bold text-gray-900 text-lg mb-1">How many sets?</h3>
                         <p className="text-sm font-medium text-gray-500">Total running price: <strong className="text-gray-900 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 ml-1">{setsQuantity} sets × 215 UAH = {formatUAH(totalPrice)}</strong></p>
                      </div>
                      
                      <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-200 w-full md:w-auto overflow-hidden mt-20">
                         <button 
                           onClick={() => setSetsQuantity(Math.max(1, setsQuantity - 1))}
                           className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl font-bold text-xl hover:bg-gray-100 text-gray-700 disabled:opacity-50"
                           disabled={setsQuantity <= 1}
                         >-</button>
                         <span className="w-12 text-center font-black text-2xl">{setsQuantity}</span>
                         <button 
                           onClick={() => setSetsQuantity(setsQuantity + 1)}
                           className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl font-bold text-xl hover:bg-gray-100 text-gray-700"
                         >+</button>
                      </div>
                   </div>

                   <div className="bg-white border border-gray-200 rounded-[2rem] p-4 md:p-8 shadow-sm mt-20">
                      <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-[1.5rem] mb-8 text-center shadow-sm mt-20">
                         <h3 className="text-2xl font-black text-rose-900 mb-2 tracking-tight">Upload exactly {requiredPhotosCount} photos</h3>
                         <p className="text-rose-700 font-medium text-sm mb-4">
                           ({setsQuantity} {setsQuantity === 1 ? 'set' : 'sets'} × {selectedSet.count} photos)
                         </p>
                         <div className="bg-white border border-rose-100 rounded-xl p-5 text-left text-sm text-gray-600 space-y-3 inline-block shadow-sm mt-20">
                           <p className="flex items-start"><Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" /> Each photo becomes one magnet. You can upload different photos or repeat the same photo.</p>
                           <p className="flex items-start"><Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" /> A 3mm white border will be added automatically around every magnet.</p>
                         </div>
                      </div>

                      <div className="mb-6 flex justify-between items-center bg-gray-50 px-5 py-3 rounded-2xl border border-gray-200 mt-20">
                         <div className="font-bold text-gray-500 text-sm tracking-wide mt-20">Assets Loaded:<br/><span className={`text-2xl font-black tracking-tight ${isUploadComplete ? 'text-green-600' : 'text-gray-900'}`}>{uploadedCount}</span> <span className="text-gray-400">/ {requiredPhotosCount}</span></div>
                         <div className="text-right mt-20">
                           {isUploadComplete ? (
                             <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-100 text-green-800 font-bold text-xs uppercase tracking-widest shadow-sm border border-green-200">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Ready
                             </span>
                           ) : (
                             <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Awaiting {requiredPhotosCount - uploadedCount}</span>
                           )}
                         </div>
                      </div>

                      <PhotoUploader
                            maxFiles={requiredPhotosCount}
                            minFiles={requiredPhotosCount}
                            canvasSize={{ width: 1000, height: 1000 }} // Generic bounds
                            onPhotosChange={setPhotos}
                      />

                      <div className="mt-8 border-t border-gray-100 pt-6 mt-20">
                         <h4 className="font-bold text-gray-900 flex items-center text-[10px] mb-4 uppercase tracking-[0.15em]"><AlertCircle className="w-4 h-4 mr-2 text-gray-400" /> File Requirements</h4>
                         <div className="flex flex-wrap gap-2 mt-20">
                            <span className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase">JPG or PNG</span>
                            <span className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase">Min 150 DPI</span>
                            <span className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase">sRGB Color</span>
                         </div>
                      </div>
                   </div>
                </div>
             )}

             {/* STEP 3: ORDER FORM */}
             {step === 3 && selectedSet && isUploadComplete && (
                <div className="animate-in slide-in-from-right-8 duration-500 mt-20">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight flex items-center">
                     Delivery Details
                   </h2>

                   <div className="bg-white rounded-[2rem] border border-gray-200 p-8 shadow-sm space-y-8 mt-20">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-20">
                         <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Full Name *</label>
                            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="Emma Swan" />
                         </div>
                         <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Phone *</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="+380..." />
                         </div>
                      </div>
                      
                      <div>
                         <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Email Address *</label>
                         <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="hello@example.com" />
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Paper Finish *</label>
                         <div className="flex flex-col sm:flex-row gap-4 mb-2 mt-20">
                            <label className={`flex-1 border rounded-xl p-5 flex items-center justify-center cursor-pointer transition-colors ${paperFinish === 'Matte' ? 'border-gray-900 bg-gray-900 text-white shadow-xl' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                               <input type="radio" checked={paperFinish === 'Matte'} onChange={() => setPaperFinish('Matte')} className="sr-only" />
                               <span className="font-bold text-sm tracking-wide">Matte Finish</span>
                            </label>
                            <label className={`flex-1 border rounded-xl p-5 flex items-center justify-center cursor-pointer transition-colors ${paperFinish === 'Glossy' ? 'border-gray-900 bg-gray-900 text-white shadow-xl' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                               <input type="radio" checked={paperFinish === 'Glossy'} onChange={() => setPaperFinish('Glossy')} className="sr-only" />
                               <span className="font-bold text-sm tracking-wide">Glossy Finish</span>
                            </label>
                         </div>
                          <div>
                         <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Delivery Options *</label>
                         <div className="flex flex-col sm:flex-row gap-4 mt-20">
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
                      </div>

                      {deliveryMethod === 'nova_poshta' && (
                        <div>
                           <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">City & Branch Number *</label>
                           <input type="text" value={npAddress} onChange={e => setNpAddress(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="e.g. Kyiv, Branch #64" />
                        </div>
                      )}                     </div>

                      <div>
                         <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Comment (Optional)</label>
                         <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors resize-none" placeholder="Any special notes for us..." />
                      </div>

                   </div>
                </div>
             )}
          </div>

          <div className="lg:col-span-4 transition-opacity duration-300 mt-20">
             <div className={`sticky top-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] p-8 lg:p-10 text-gray-900 shadow-xl ${selectedSet ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <h3 className="text-xl font-bold mb-6 border-b border-gray-200 pb-4 flex items-center justify-between tracking-tight">
                   Checkout
                </h3>
                
                {!selectedSet ? (
                  <div className="text-gray-400 font-medium text-sm text-center py-10 opacity-60 mt-20">Select a set configuration to begin</div>
                ) : (
                  <div className="space-y-6 mt-20">
                    <div className="flex justify-between font-medium items-center mt-20">
                       <span className="text-gray-500 text-sm">Design</span>
                       <span className="bg-white border border-gray-200 px-3 py-1 rounded-lg text-sm font-bold shadow-sm">{selectedSet.size}</span>
                    </div>
                    
                    <div className="flex justify-between font-medium items-center mt-20">
                       <span className="text-gray-500 text-sm">Multiplier</span>
                       <span className="text-gray-900 text-sm font-bold">{setsQuantity}x {selectedSet.count} items</span>
                    </div>

                    <div className="flex justify-between font-medium items-center mt-20">
                       <span className="text-gray-500 text-sm">Finish</span>
                       <span className="text-gray-900 text-sm font-bold">{paperFinish}</span>
                    </div>
                    
                    <div className="h-px bg-gray-200 my-6 mt-20" />

                    <div className="flex justify-between items-center text-gray-900 border-gray-100 mt-20">
                       <span className="font-bold text-lg">Total</span>
                       <div className="text-3xl font-black tracking-tighter mt-20">{formatUAH(totalPrice)}</div>
                    </div>

                    {step < 3 ? (
                      <button 
                        onClick={handleNext}
                        disabled={step === 2 && !isUploadComplete}
                        className="w-full mt-6 bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-5 rounded-xl uppercase tracking-widest text-[11px] transition-all flex items-center justify-center disabled:cursor-not-allowed group shadow-md"
                      >
                         Proceed <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <>
                        {formError && (
                          <div className="mt-2 mb-2 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg text-center border border-red-200 mt-20">
                            {formError}
                          </div>
                        )}
                        <button 
                          onClick={handlePlaceOrder}
                          disabled={!isFormValid || !isUploadComplete || isSubmitting}
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

                    <p className="text-center text-[11px] text-gray-400 font-bold uppercase tracking-widest px-4 mt-6">
                      Production time: <br/><strong className="text-gray-500">1–3 business days</strong>
                    </p>
                  </div>
                )}
             </div>
          </div>

       </div>
      </div>
    </>
  );
}
