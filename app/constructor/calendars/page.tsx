'use client';
import { Navigation } from '@/components/ui/Navigation';
import React, { useState, useRef } from 'react';
import { useCartStore } from '@/store/cart-store';
import { CheckCircle2, Calendar as CalendarIcon, Upload, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import PhotoUploader from '@/components/PhotoUploader';
import { submitOrder } from '@/lib/submitOrder';

const formatUAH = (amount: number) => amount + ' UAH';

const CALENDAR_TYPES = [
  { id: 'desk', name: 'Desk calendar on stand', format: '12 cards 10×15 cm on wooden easel' },
  { id: 'wall_a3', name: 'Wall flip calendar A3', format: '13 pages, 12–26 photos, 6 cover options', price: 840 },
  { id: 'wall_a4', name: 'Wall flip calendar A4', format: '13 pages, 12–26 photos, 6 cover options', price: 740 }
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CalendarConstructor() {
  const addItem = useCartStore((state) => state.addItem);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [deskEasel, setDeskEasel] = useState<boolean>(true);
  const [dateCircling, setDateCircling] = useState(false);
  
  const [monthPhotos, setMonthPhotos] = useState<Record<number, {file: File, url: string}>>({});
  const [wallPhotos, setWallPhotos] = useState<File[]>([]);
  
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMonthInput, setActiveMonthInput] = useState<number | null>(null);

  const selectedType = CALENDAR_TYPES.find(s => s.id === selectedTypeId);
  const isDesk = selectedTypeId === 'desk';
  const completedGridCount = Object.keys(monthPhotos).length;
  
  let basePrice = 0;
  if (selectedType) {
    if (isDesk) basePrice = deskEasel ? 299 : 249;
    else basePrice = selectedType.price || 0;
  }
  const addonsPrice = dateCircling ? 10 : 0;
  const totalPrice = basePrice + addonsPrice;

  const isPhotosValid = isDesk ? completedGridCount === 12 : (wallPhotos.length >= 12 && wallPhotos.length <= 26);
  const isFormValid = customerName.trim() !== '' && phone.trim().length >= 10 && email.includes('@') && (deliveryMethod === 'pickup' || npAddress.trim() !== '');

  const handleNext = () => {
    if (step === 1 && selectedType) setStep(2);
    else if (step === 2 && isPhotosValid) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3);
  };

  const triggerUploadForMonth = (index: number) => {
    setActiveMonthInput(index);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activeMonthInput !== null) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setMonthPhotos(prev => ({ ...prev, [activeMonthInput]: { file, url } }));
      setActiveMonthInput(null);
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setMonthPhotos(prev => {
      const copy = { ...prev };
      URL.revokeObjectURL(copy[index].url);
      delete copy[index];
      return copy;
    });
  };

  const handlePlaceOrder = async () => {
    if (isPhotosValid && isFormValid) {
      setIsSubmitting(true);
      setFormError('');
      
      const result = await submitOrder({
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'nova_poshta' ? { city: npAddress.split(',')[0] || npAddress, branch: npAddress } : undefined,
        items: [{
          product_type: 'calendar',
          product_name: `Calendar - ${selectedType?.name}`,
          format: selectedType?.name || '',
          quantity: 1,
          unit_price: totalPrice,
          total_price: totalPrice,
          options: {
            date_circling: dateCircling ? 'Yes' : 'No',
            ...(isDesk ? { easel: deskEasel ? 'Included' : 'None' } : {})
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
          name: `Calendar - ${selectedType?.name}`,
          price: totalPrice,
          qty: 1,
          options: [
            { label: 'Type', value: selectedType?.name || '' },
            ...(isDesk ? [{ label: 'Easel', value: deskEasel ? 'Included' : 'None' }] : []),
            { label: 'Date Circling', value: dateCircling ? 'Yes' : 'No' }
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
        <div className="min-h-[85vh] bg-blue-50 flex flex-col items-center justify-center font-sans mt-20">
        <div className="bg-white p-12 rounded-[2rem] max-w-lg mx-4 text-center shadow-lg border border-blue-200 mt-20">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200 mt-20">
            <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Дякуємо за замовлення!</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8 inline-block w-full mt-20">
             <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Номер замовлення</p>
             <p className="text-2xl font-black text-gray-900 tracking-tight">{orderNumber}</p>
          </div>
          <p className="text-lg text-gray-600 mb-8 font-medium">
            Ми зв'яжемося з вами найближчим часом
          </p>
          <button onClick={() => window.location.href = '/'} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-5 rounded-2xl transition-all active:scale-95 shadow-lg">
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
      <div className="min-h-screen bg-[#FDFDFD] text-gray-900 font-sans pb-32 tracking-tight mt-20">
       
       <div className="bg-white border-b border-gray-100 py-16 px-6 relative overflow-hidden mt-20">
          <div className="max-w-5xl mx-auto text-center mt-20">
             <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 mb-6 border border-blue-100 font-bold uppercase tracking-widest text-[10px] mt-20">
               12-Month Mapping
             </div>
             <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-gray-900">
               Photo Calendars
             </h1>
             <p className="text-gray-500 font-medium max-w-xl mx-auto text-lg leading-relaxed">
               Assign a unique memory to each month of the year.
             </p>
          </div>
       </div>

       <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12 mt-20">
          
          <div className="lg:col-span-8 flex flex-col gap-8 mt-20">
             
             <div className="flex items-center justify-between mb-2 mt-20">
                <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mt-20">
                  <span className={step >= 1 ? 'text-gray-900' : ''}>1. Type</span>
                  <span>/</span>
                  <span className={step >= 2 ? 'text-gray-900' : ''}>2. Photos</span>
                  <span>/</span>
                  <span className={step >= 3 ? 'text-gray-900' : ''}>3. Delivery</span>
                </div>
                {step > 1 && (
                  <button onClick={handleBack} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 flex items-center">
                    <ArrowLeft className="w-3 h-3 mr-1.5" /> Back
                  </button>
                )}
             </div>

             {/* STEP 1 */}
             {step === 1 && (
                <div className="animate-in fade-in duration-500 mt-20">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Select Calendar Format</h2>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
                      {CALENDAR_TYPES.map(type => {
                        const isSelected = selectedTypeId === type.id;
                        return (
                          <div 
                            key={type.id} 
                            onClick={() => setSelectedTypeId(type.id)}
                            className={`cursor-pointer rounded-[2rem] p-8 border transition-all flex flex-col items-center text-center relative
                              ${isSelected ? 'border-gray-900 bg-white shadow-xl ring-1 ring-gray-900 scale-100' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'}
                            `}
                          >
                             <div className={`w-16 h-16 rounded-full mb-6 flex items-center justify-center transition-colors ${isSelected ? 'bg-gray-100 text-gray-900' : 'bg-white border border-gray-200 text-gray-400'}`}>
                                <CalendarIcon className="w-8 h-8" />
                             </div>
                             <h3 className={`font-black tracking-tight mb-2 text-xl ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{type.name}</h3>
                             <p className="text-xs font-medium text-gray-500 mb-6 leading-relaxed flex-1">{type.format}</p>
                             
                             {type.id === 'desk' && isSelected ? (
                               <div className="w-full text-left bg-gray-50 border border-gray-200 rounded-xl p-3 mt-20" onClick={e => e.stopPropagation()}>
                                 <label className="flex items-center text-sm font-bold mb-2 cursor-pointer">
                                   <input type="radio" checked={deskEasel} onChange={() => setDeskEasel(true)} className="mr-2 text-gray-900" /> With easel: 299 ₴
                                 </label>
                                 <label className="flex items-center text-sm font-bold cursor-pointer">
                                   <input type="radio" checked={!deskEasel} onChange={() => setDeskEasel(false)} className="mr-2 text-gray-900" /> Without easel: 249 ₴
                                 </label>
                               </div>
                             ) : (
                               <div className="mt-auto w-full pt-4 border-t border-gray-100 mt-20">
                                  <span className={`font-extrabold text-2xl tracking-tighter ${isSelected ? 'text-gray-900' : 'text-gray-900'}`}>
                                    {type.price || "249-299"} ₴
                                  </span>
                               </div>
                             )}

                             {isSelected && (
                               <div className="absolute top-4 right-4 text-gray-900 mt-20">
                                  <CheckCircle2 className="w-6 h-6 bg-white rounded-full" strokeWidth={2.5} />
                               </div>
                             )}
                          </div>
                        );
                      })}
                   </div>

                   {selectedTypeId && (
                     <div className="mt-8 bg-blue-50/50 border border-blue-100 p-6 rounded-2xl flex items-center justify-between cursor-pointer mt-20" onClick={() => setDateCircling(!dateCircling)}>
                        <div className="flex items-center mt-20">
                          <input type="checkbox" checked={dateCircling} onChange={() => setDateCircling(!dateCircling)} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-600 mr-4" />
                          <div>
                            <span className="block font-bold text-blue-900 text-sm">Date circling (обведення дати)</span>
                            <span className="text-xs text-blue-700 font-medium">Highlight important days</span>
                          </div>
                        </div>
                        <span className="font-black text-blue-900">+10 UAH</span>
                     </div>
                   )}
                </div>
             )}

             {/* STEP 2 */}
             {step === 2 && selectedType && (
                <div className="animate-in slide-in-from-right-8 duration-500 mt-20">
                   
                   {isDesk ? (
                     <>
                       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 mt-20">
                         <div>
                           <h2 className="text-2xl font-bold tracking-tight mb-2">12-Month Assignment</h2>
                           <p className="text-gray-500 font-medium text-sm">Upload exactly 12 photos.</p>
                         </div>
                         <div className="bg-white border text-xs font-bold uppercase tracking-widest border-gray-200 px-5 py-3 rounded-xl flex items-center shadow-sm text-gray-600 mt-20">
                           <CheckCircle2 className={`w-4 h-4 mr-2 ${isPhotosValid ? 'text-green-500' : 'text-gray-300'}`} />
                           {completedGridCount} / 12 months assigned
                         </div>
                       </div>

                       <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleFileChange} />

                       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-20">
                         {MONTHS.map((month, idx) => {
                           const assigned = monthPhotos[idx];
                           return (
                             <div key={idx} className={`relative bg-gray-50 border-2 rounded-2xl overflow-hidden transition-all flex flex-col aspect-[4/5]
                               ${assigned ? 'border-gray-900 shadow-lg ring-1 ring-gray-900 scale-100' : 'border-dashed border-gray-200 hover:border-gray-300'}
                             `}>
                                <div className={`text-center py-2 text-[10px] font-bold uppercase tracking-[0.2em] z-10 
                                  ${assigned ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 border-b border-gray-200'}`}>
                                  {month}
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center relative p-2 mt-20">
                                   {assigned ? (
                                     <>
                                       <img src={assigned.url} alt={`Assigned to ${month}`} className="absolute top-0 left-0 w-full h-full object-cover z-0" />
                                       <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center gap-3 mt-20">
                                         <button onClick={() => triggerUploadForMonth(idx)} className="bg-white text-gray-900 p-2 rounded-full shadow-lg hover:scale-110 transition-transform"><Upload className="w-4 h-4" /></button>
                                         <button onClick={() => removePhoto(idx)} className="bg-red-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"><Trash2 className="w-4 h-4" /></button>
                                       </div>
                                     </>
                                   ) : (
                                     <button onClick={() => triggerUploadForMonth(idx)} className="w-full h-full flex flex-col items-center justify-center group focus:outline-none">
                                        <div className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform group-hover:border-gray-400 mt-20">
                                          <Upload className="w-4 h-4" />
                                        </div>
                                     </button>
                                   )}
                                </div>
                             </div>
                           );
                         })}
                       </div>
                     </>
                   ) : (
                     <>
                        <h2 className="text-2xl font-bold tracking-tight mb-2">Upload Wall Photos</h2>
                        <p className="text-gray-500 font-medium text-sm mb-8">Upload 12–26 photos depending on your layout preferences.</p>
                        
                        <div className="bg-white border border-gray-200 rounded-[2rem] p-4 md:p-8 shadow-sm mt-20">
                           <div className="mb-6 flex justify-between items-center bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 mt-20">
                              <div className="font-bold text-gray-500 text-sm mt-20">Assets Loaded:<br/><span className={`text-2xl font-black ${isPhotosValid ? 'text-green-600' : 'text-gray-900'}`}>{wallPhotos.length}</span> / 12-26</div>
                           </div>
                           <PhotoUploader minFiles={12} maxFiles={26} canvasSize={{ width: 2480, height: 3508 }} onPhotosChange={setWallPhotos} />
                        </div>
                     </>
                   )}
                </div>
             )}

             {/* STEP 3 */}
             {step === 3 && selectedType && (
                <div className="animate-in slide-in-from-right-8 duration-500 mt-20">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Delivery Details</h2>

                   <div className="bg-white rounded-[2rem] border border-gray-200 p-8 shadow-sm space-y-6 mt-20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-20">
                         <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Full Name *</label>
                            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-x-0 border-t-0 border-gray-200 rounded-none p-3 focus:border-gray-900 focus:ring-0 transition-colors text-sm" placeholder="John Doe" />
                         </div>
                         <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Phone *</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-x-0 border-t-0 border-gray-200 rounded-none p-3 focus:border-gray-900 focus:ring-0 transition-colors text-sm" placeholder="+380..." />
                         </div>
                      </div>
                      
                      <div>
                         <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Email Address *</label>
                         <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-x-0 border-t-0 border-gray-200 rounded-none p-3 focus:border-gray-900 focus:ring-0 transition-colors text-sm" placeholder="hello@example.com" />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 mt-20">
                         <label className={`flex-1 border-2 rounded-xl p-4 flex items-center cursor-pointer transition-colors ${deliveryMethod === 'pickup' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                            <input type="radio" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} className="sr-only" />
                            <span className="font-bold text-sm">Self-pickup or Courier</span>
                         </label>
                             <label className={`flex-1 border-2 rounded-xl p-4 flex items-center cursor-pointer transition-colors ${deliveryMethod === 'nova_poshta' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                                <input type="radio" checked={deliveryMethod === 'nova_poshta'} onChange={() => setDeliveryMethod('nova_poshta')} className="sr-only" />
                                <span className="font-bold text-sm">Nova Poshta</span>
                             </label>
                          </div>

                      {deliveryMethod === 'nova_poshta' && (
                        <div>
                           <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">City & Branch Number *</label>
                           <input type="text" value={npAddress} onChange={e => setNpAddress(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="e.g. Kyiv, Branch #64" />
                        </div>
                      )}
                   </div>
                </div>
             )}
          </div>

          <div className="lg:col-span-4 mt-20">
             <div className={`sticky top-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] p-8 lg:p-10 shadow-xl transition-all duration-300 ${selectedType ? 'opacity-100' : 'opacity-40 pointer-events-none translate-y-4'}`}>
                <h3 className="text-xl font-bold mb-8 border-b border-gray-200 pb-4 text-gray-900">Checkout Card</h3>
                
                {selectedType && (
                  <div className="space-y-6 mt-20">
                    <div className="flex justify-between font-medium items-center mt-20">
                       <span className="text-gray-500 text-sm">Type</span>
                       <span className="bg-white px-3 py-1 rounded-lg text-sm shadow-sm border border-gray-100 font-bold">{isDesk ? "Desk" : "Wall"}</span>
                    </div>
                    
                    <div className="h-px bg-gray-200 my-6 mt-20" />

                    {dateCircling && (
                       <div className="flex justify-between items-center text-sm font-bold text-blue-600 mb-4 mt-20">
                          <span>+ Date Circling</span>
                          <span>10 ₴</span>
                       </div>
                    )}

                    <div className="flex justify-between items-center text-gray-900 mt-20">
                       <span className="font-bold text-lg">Total</span>
                       <div className="text-3xl font-black tracking-tighter mt-20">{formatUAH(totalPrice)}</div>
                    </div>

                    {step < 3 ? (
                      <button 
                        onClick={handleNext}
                        disabled={step === 2 && !isPhotosValid}
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
                          disabled={!isFormValid || isSubmitting}
                          className="w-full mt-6 bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-5 rounded-xl uppercase tracking-widest text-[11px] transition-all flex items-center justify-center disabled:cursor-not-allowed shadow-xl active:scale-95"
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
                    <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest px-4 mt-6 leading-relaxed">
                      Production time: <br/><strong className="text-gray-500">2–4 business days</strong>
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
