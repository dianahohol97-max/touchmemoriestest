'use client';
import { Navigation } from '@/components/ui/Navigation';
import React, { useState } from 'react';
import { useCartStore } from '@/store/cart-store';
import { ArrowLeft, ArrowRight, BookHeart, CheckCircle2, Gift } from 'lucide-react';
import PhotoUploader from '@/components/PhotoUploader';
import { submitOrder } from '@/lib/submitOrder';

const formatUAH = (amount: number) => amount + ' UAH';

const SIZES = [
  { id: '23x23', name: '23×23 cm' },
  { id: '20x30', name: '20×30 cm (portrait)' },
  { id: '30x20', name: '30×20 cm (landscape)' }
];

const COVERS = [
  { id: 'printed', name: 'Printed cover', nameUk: 'Друкована обкладинка' },
  { id: 'velour', name: 'Velour / Leatherette', nameUk: 'Велюр, Шкірзам, Тканина' }
];

const PAGES = [
  { id: 'white', name: 'White pages', nameUk: 'Білі сторінки' },
  { id: 'black', name: 'Black pages', nameUk: 'Чорні сторінки' }
];

const ACCESSORIES = [
  { id: 'marker_white', name: 'White marker', price: 45 },
  { id: 'marker_silver_gold', name: 'Silver/gold marker', price: 45 },
  { id: 'marker_black', name: 'Black marker', price: 35 },
  { id: 'corners', name: 'Photo corners', price: 45 },
  { id: 'tape', name: 'Double-sided tape', price: 30 },
  { id: 'stickers', name: 'Stickers', price: 115 },
  { id: 'print_kit', name: 'Hand & foot print kit', price: 185 },
  { id: 'month_cards', name: 'Month cards (baby)', price: 109 }
];

export default function WishBookConstructor() {
  const addItem = useCartStore((state) => state.addItem);
  const [mode, setMode] = useState<'wishbook' | 'photoalbum'>('wishbook');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [sz, setSz] = useState<string | null>(null);
  const [cov, setCov] = useState<string | null>(null);
  const [pag, setPag] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [selectedAccs, setSelectedAccs] = useState<string[]>([]);
  
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'nova_poshta'>('pickup');
  const [npAddress, setNpAddress] = useState('');
  const [comment, setComment] = useState('');

  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [formError, setFormError] = useState('');

  // Pricing Matrix
  let basePrice = 0;
  if (sz && cov && pag) {
    if (cov === 'printed') {
      if (sz === '23x23') basePrice = pag === 'white' ? 559 : 859;
      else basePrice = pag === 'white' ? 599 : 899; // 20x30 or 30x20
    } else if (cov === 'velour') {
      if (sz === '23x23') basePrice = pag === 'white' ? 999 : 1299;
      else basePrice = pag === 'white' ? 1059 : 1359;
    }
  }

  const accsTotal = selectedAccs.reduce((sum, accId) => sum + (ACCESSORIES.find(a => a.id === accId)?.price || 0), 0);
  const totalPrice = basePrice + accsTotal;

  const handleToggleAcc = (id: string) => {
    setSelectedAccs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const isFormValid = customerName.trim() !== '' && phone.trim().length >= 10 && email.includes('@') && (deliveryMethod === 'pickup' || npAddress.trim() !== '');
  
  const handleNext = () => {
    if (step === 1 && sz) setStep(2);
    else if (step === 2 && cov) setStep(3);
    else if (step === 3 && pag) setStep(4);
  };

  const handlePlaceOrder = async () => {
    if (isFormValid && photos.length === 1) {
      setIsSubmitting(true);
      setFormError('');
      
      const accessoriesList = selectedAccs.map(id => ACCESSORIES.find(a => a.id === id)?.name).filter(Boolean).join(', ');
      
      const result = await submitOrder({
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'nova_poshta' ? { city: npAddress.split(',')[0] || npAddress, branch: npAddress } : undefined,
        items: [{
          product_type: mode === 'wishbook' ? 'wishbook' : 'photo_album',
          product_name: mode === 'wishbook' ? 'Wish Book' : 'Photo Album',
          format: SIZES.find(s => s.id === sz)?.name || '',
          cover_type: COVERS.find(c => c.id === cov)?.name || '',
          pages: PAGES.find(p => p.id === pag)?.name ? parseInt((PAGES.find(p => p.id === pag)?.name || '0').split(' ')[0]) : undefined,
          quantity: 1,
          unit_price: totalPrice,
          total_price: totalPrice,
          options: {
            ...(selectedAccs.length > 0 ? { accessories: accessoriesList } : {})
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
          name: mode === 'wishbook' ? 'Wish Book' : 'Photo Album',
          price: totalPrice,
          qty: 1,
          options: [
            { label: 'Size', value: SIZES.find(s => s.id === sz)?.name || '' },
            { label: 'Cover', value: COVERS.find(c => c.id === cov)?.name || '' },
            { label: 'Pages', value: PAGES.find(p => p.id === pag)?.name || '' },
            ...(selectedAccs.length > 0 ? [{ label: 'Accessories', value: accessoriesList }] : [])
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

  let cvW = 5858, cvH = 3071;
  if (sz === '20x30') { cvW = 5551; cvH = 3874; }
  else if (sz === '30x20') { cvW = 7630; cvH = 2870; }

  if (isSuccess) {
    return (
      <>
        <Navigation />
        <div className="min-h-[85vh] bg-[#FDF9F7] flex flex-col items-center justify-center font-serif text-[#4A403A] mt-20">
        <div className="bg-white p-12 md:p-16 rounded-[2rem] max-w-lg mx-4 text-center shadow-xl border border-[#F4EBE6] mt-20">
          <BookHeart className="w-16 h-16 text-[#C8B4A6] mx-auto mb-6" strokeWidth={1.5} />
          <h2 className="text-4xl font-normal mb-4 tracking-tight">Дякуємо за замовлення!</h2>
          <div className="bg-[#F9F5F2] border border-[#ECE2DB] rounded-2xl p-6 mb-8 inline-block w-full mt-20">
             <p className="text-sm font-bold text-[#A3968C] uppercase tracking-widest mb-1">Номер замовлення</p>
             <p className="text-2xl font-bold text-[#4A403A] tracking-tight">{orderNumber}</p>
          </div>
          <p className="text-lg text-[#8C7A6B] mb-10 leading-relaxed font-sans">
            Ми зв'яжемося з вами найближчим часом
          </p>
          <button onClick={() => window.location.href = '/'} className="w-full bg-[#4A403A] hover:bg-[#322B27] text-[#FDF9F7] font-sans font-bold py-5 rounded-2xl transition-all shadow-md">
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
      <div className="min-h-screen bg-[#FDF9F7] text-[#4A403A] font-sans pb-32 mt-20">
       
       <div className="bg-white border-b border-[#F4EBE6] py-16 px-6 mt-20">
          <div className="max-w-4xl mx-auto text-center mt-20">
             
             <div className="inline-flex items-center justify-center p-1.5 bg-[#F9F5F2] rounded-2xl border border-[#ECE2DB] mb-10 shadow-sm mx-auto mt-20">
               <button onClick={() => setMode('wishbook')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === 'wishbook' ? 'bg-white shadow border border-[#E8DCC] text-[#4A403A]' : 'text-[#A3968C] hover:text-[#4A403A]'}`}>
                 Wish Book (Книга побажань)
               </button>
               <button onClick={() => setMode('photoalbum')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === 'photoalbum' ? 'bg-white shadow border border-[#E8DCC] text-[#4A403A]' : 'text-[#A3968C] hover:text-[#4A403A]'}`}>
                 Photo Album (Альбом)
               </button>
             </div>

             <h1 className="text-4xl md:text-5xl font-serif mb-4 text-[#322B27]">
               Create your {mode === 'wishbook' ? 'Wish Book' : 'Photo Album'}
             </h1>
          </div>
       </div>

       <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12 mt-20">
          
          <div className="lg:col-span-8 flex flex-col gap-8 mt-20">
             
             <div className="flex justify-between mb-4 border-b border-[#F4EBE6] pb-4 mt-20">
                <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C8B4A6] mt-20">
                  <span className={step >= 1 ? 'text-[#4A403A]' : ''}>1. Size</span><span>/</span>
                  <span className={step >= 2 ? 'text-[#4A403A]' : ''}>2. Cover</span><span>/</span>
                  <span className={step >= 3 ? 'text-[#4A403A]' : ''}>3. Pages</span><span>/</span>
                  <span className={step >= 4 ? 'text-[#4A403A]' : ''}>4. Upload</span>
                </div>
                {step > 1 && (
                  <button onClick={() => setStep(step - 1 as any)} className="text-[10px] font-bold uppercase tracking-widest text-[#8C7A6B] hover:text-[#4A403A] flex items-center">
                    <ArrowLeft className="w-3 h-3 mr-1" /> Back
                  </button>
                )}
             </div>

             {/* STEP 1: SIZE */}
             {step === 1 && (
                <div className="animate-in fade-in duration-500 mt-20">
                   <h2 className="text-2xl font-serif mb-6 text-[#322B27]">Select Format</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20">
                      {SIZES.map(s => (
                        <div key={s.id} onClick={() => setSz(s.id)} className={`cursor-pointer rounded-2xl p-6 border transition-all text-center flex flex-col items-center
                          ${sz === s.id ? 'border-[#4A403A] bg-white shadow-xl ring-1 ring-[#4A403A]' : 'border-[#E8DCC] bg-white/50 hover:bg-white'}
                        `}>
                           <div className={`border-2 border-[#4A403A] mb-4 
                             ${s.id==='23x23' ? 'w-16 h-16' : s.id==='20x30' ? 'w-12 h-16' : 'w-16 h-12'}
                           `} />
                           <span className="font-bold text-sm tracking-tight">{s.name}</span>
                        </div>
                      ))}
                   </div>
                </div>
             )}

             {/* STEP 2: COVER */}
             {step === 2 && (
                <div className="animate-in slide-in-from-right-8 duration-500 mt-20">
                   <h2 className="text-2xl font-serif mb-6 text-[#322B27]">Select Cover Material</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-20">
                      {COVERS.map(c => (
                        <div key={c.id} onClick={() => setCov(c.id)} className={`cursor-pointer rounded-2xl p-6 border transition-all
                          ${cov === c.id ? 'border-[#4A403A] bg-white shadow-xl ring-1 ring-[#4A403A]' : 'border-[#E8DCC] bg-white/50 hover:bg-white'}
                        `}>
                           <div className="font-bold text-lg mb-1 mt-20">{c.name}</div>
                           <div className="text-xs text-[#8C7A6B] mt-20">{c.nameUk}</div>
                        </div>
                      ))}
                   </div>
                </div>
             )}

             {/* STEP 3: PAGES */}
             {step === 3 && (
                <div className="animate-in slide-in-from-right-8 duration-500 mt-20">
                   <h2 className="text-2xl font-serif mb-6 text-[#322B27]">Select Page Color</h2>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 mt-20">
                      {PAGES.map(p => (
                        <div key={p.id} onClick={() => setPag(p.id)} className={`cursor-pointer border rounded-2xl p-6 flex items-center shadow-sm
                          ${pag === p.id ? 'border-[#4A403A] bg-white ring-1 ring-[#4A403A]' : 'border-[#E8DCC] bg-white/50 hover:bg-white'}
                        `}>
                           <div className={`w-8 h-8 rounded-full border border-gray-300 mr-4 ${p.id==='black'?'bg-gray-900':'bg-white'}`} />
                           <div>
                             <div className="font-bold text-sm mt-20">{p.name}</div>
                             <div className="text-xs text-[#8C7A6B] mt-20">{p.nameUk}</div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             )}

             {/* STEP 4: UPLOAD & CHECKOUT */}
             {step === 4 && (
                <div className="animate-in slide-in-from-right-8 duration-500 mt-20">
                   <h2 className="text-2xl font-serif mb-6 text-[#322B27]">Cover Photo & Details</h2>

                   <div className="bg-[#4A403A] text-[#FDF9F7] p-5 rounded-xl mb-8 flex justify-between items-center shadow-lg mt-20">
                      <div className="flex items-center mt-20">
                         <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mr-4 mt-20"><Gift className="w-5 h-5 text-[#FDF9F7]" /></div>
                         <span className="font-serif italic text-lg tracking-wide">Cover design is included FREE</span>
                      </div>
                   </div>

                   <div className="bg-white rounded-2xl border border-[#F4EBE6] p-6 mb-8 mt-20">
                      <h4 className="font-bold text-sm mb-4">1. Provide your cover photo</h4>
                      <PhotoUploader minFiles={1} maxFiles={1} canvasSize={{ width: cvW, height: cvH }} onPhotosChange={setPhotos} />
                   </div>

                   <div className="bg-white rounded-2xl border border-[#F4EBE6] p-6 mb-8 mt-20">
                      <h4 className="font-bold text-sm mb-4">2. Optional Accessories</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-20">
                         {ACCESSORIES.map(acc => (
                           <label key={acc.id} className="flex items-center p-3 border border-[#F4EBE6] rounded-xl hover:bg-[#F9F5F2] cursor-pointer transition-colors">
                             <input type="checkbox" checked={selectedAccs.includes(acc.id)} onChange={() => handleToggleAcc(acc.id)} className="w-4 h-4 rounded text-[#4A403A] focus:ring-[#4A403A] mr-3 border-gray-300" />
                             <span className="text-sm font-medium flex-1">{acc.name}</span>
                             <span className="text-xs font-bold text-[#8C7A6B]">+{acc.price} ₴</span>
                           </label>
                         ))}
                      </div>
                   </div>

                   <div className="bg-white rounded-2xl border border-[#F4EBE6] p-6 mb-4 space-y-4 mt-20">
                      <h4 className="font-bold text-sm mb-2">3. Shipping Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-20">
                         <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full Name *" required className="bg-[#FDF9F7] border border-[#ECE2DB] rounded-xl p-3 text-sm focus:border-[#4A403A] focus:ring-1 focus:ring-[#4A403A]" />
                         <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone +380... *" required className="bg-[#FDF9F7] border border-[#ECE2DB] rounded-xl p-3 text-sm focus:border-[#4A403A] focus:ring-1 focus:ring-[#4A403A]" />
                      </div>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email *" required className="w-full bg-[#FDF9F7] border border-[#ECE2DB] rounded-xl p-3 text-sm focus:border-[#4A403A] focus:ring-1 focus:ring-[#4A403A]" />
                      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full bg-[#FDF9F7] border border-[#ECE2DB] rounded-xl p-3 text-sm focus:border-[#4A403A] focus:ring-1 focus:ring-[#4A403A]" />
                      
                      <select value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value as any)} className="w-full bg-[#FDF9F7] border border-[#ECE2DB] rounded-xl p-3 text-sm focus:border-[#4A403A] focus:ring-1 focus:ring-[#4A403A]">
                        <option value="pickup">Self-pickup or Courier</option>
                        <option value="nova_poshta">Nova Poshta</option>
                      </select>

                      {deliveryMethod === 'nova_poshta' && (
                        <input type="text" value={npAddress} onChange={e => setNpAddress(e.target.value)} placeholder="City & Branch Number *" required className="w-full bg-[#FDF9F7] border border-[#ECE2DB] rounded-xl p-3 text-sm focus:border-[#4A403A] focus:ring-1 focus:ring-[#4A403A]" />
                      )}

                      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comments..." rows={2} className="w-full bg-[#FDF9F7] border border-[#ECE2DB] rounded-xl p-3 text-sm focus:border-[#4A403A] focus:ring-1 focus:ring-[#4A403A] resize-none" />
                   </div>

                </div>
             )}
          </div>

          <div className="lg:col-span-4 mt-20">
             <div className="sticky top-8 bg-white border border-[#F4EBE6] rounded-[2rem] p-8 shadow-xl mt-20">
                <h3 className="text-xl font-serif text-[#322B27] mb-6">Order Status</h3>
                
                {(!sz || !cov || !pag) ? (
                  <div className="text-[#A3968C] text-sm py-4 border-t border-[#F4EBE6] mt-20">Make your selections to verify pricing...</div>
                ) : (
                  <div className="space-y-4 text-sm mt-4 border-t border-[#F4EBE6] pt-6 mt-20">
                    <div className="flex justify-between font-bold mt-20"><span>Base Album:</span> <span>{basePrice} ₴</span></div>
                    {selectedAccs.length > 0 && (
                      <div className="flex justify-between text-[#8C7A6B] mt-20"><span>Accessories ({selectedAccs.length}):</span> <span>+{accsTotal} ₴</span></div>
                    )}
                    
                    <div className="h-px bg-[#ECE2DB] my-4 mt-20" />
                    
                    <div className="flex justify-between items-center mb-6 mt-20">
                       <span className="font-bold text-[#322B27] text-lg">Total</span>
                       <span className="text-2xl font-black text-[#322B27] tracking-tight">{formatUAH(totalPrice)}</span>
                    </div>

                    {step < 4 ? (
                      <button onClick={handleNext} className="w-full bg-[#4A403A] hover:bg-[#322B27] text-white font-bold py-4 rounded-xl text-sm transition-colors shadow-md">
                         Proceed to Next Step
                      </button>
                    ) : (
                      <>
                        {formError && (
                          <div className="mt-2 mb-2 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg text-center border border-red-200 mt-20">
                            {formError}
                          </div>
                        )}
                        <button onClick={handlePlaceOrder} disabled={!isFormValid || photos.length !== 1 || isSubmitting} className="w-full flex items-center justify-center bg-[#4A403A] hover:bg-[#322B27] disabled:bg-[#ECE2DB] disabled:text-[#A3968C] text-white font-bold py-4 rounded-xl text-sm transition-colors shadow-lg active:scale-95 disabled:cursor-not-allowed">
                           {isSubmitting ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                    
                    <div className="text-center text-[10px] text-[#8C7A6B] font-bold uppercase tracking-widest mt-6 mt-20">
                      Production: <br/>10 business days
                    </div>
                  </div>
                )}
             </div>
          </div>

       </div>
      </div>
    </>
  );
}
