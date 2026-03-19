'use client';
import { Navigation } from '@/components/ui/Navigation';
import React, { useState } from 'react';
import { useCartStore } from '@/store/cart-store';
import { ArrowLeft, ArrowRight, Puzzle, CheckCircle2, AlertCircle, ShoppingBag, Truck } from 'lucide-react';
import PhotoUploader from '@/components/PhotoUploader';
import { submitOrder } from '@/lib/submitOrder';

const formatUAH = (amount: number) => amount + ' UAH';

const PUZZLE_SIZES = [
  { id: 'A4', name: 'A4', size: '21×29.7 cm', pieces: 120, price: 290 },
  { id: 'A3', name: 'A3', size: '29.7×42 cm', pieces: 252, price: 390 },
  { id: '30x40', name: 'Medium Layout', size: '30×40 cm', pieces: 252, price: 420 },
  { id: '40x60', name: 'Large Poster', size: '40×60 cm', pieces: 500, price: 590 }
];

export default function PhotoPuzzleConstructor() {
  const addItem = useCartStore((state) => state.addItem);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);

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

  const selectedSize = PUZZLE_SIZES.find(s => s.id === selectedSizeId);
  const isFormValid = customerName.trim() !== '' && phone.trim().length >= 10 && email.includes('@') && (deliveryMethod === 'pickup' || npAddress.trim() !== '');
  const isReadyToOrder = selectedSize && photos.length === 1 && isFormValid;

  const handleNext = () => {
    if (step === 1 && selectedSize) setStep(2);
    else if (step === 2 && photos.length === 1) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3);
  };

  const handlePlaceOrder = async () => {
    if (isReadyToOrder) {
      setIsSubmitting(true);
      setFormError('');
      
      const result = await submitOrder({
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'nova_poshta' ? { city: npAddress.split(',')[0] || npAddress, branch: npAddress } : undefined,
        items: [{
          product_type: 'puzzle',
          product_name: `Puzzle - ${selectedSize!.name}`,
          format: selectedSize!.size,
          quantity: 1,
          unit_price: selectedSize!.price,
          total_price: selectedSize!.price,
          options: {
            complexity: `${selectedSize!.pieces} pieces`
          }
        }],
        subtotal: selectedSize!.price,
        delivery_cost: 0,
        total: selectedSize!.price,
        notes: comment
      });

      setIsSubmitting(false);

      if (result.success) {
        setOrderNumber(result.order_number!);
        addItem({
          id: Date.now().toString(),
          name: `Puzzle - ${selectedSize!.name}`,
          price: selectedSize!.price,
          qty: 1,
          options: [
            { label: 'Size', value: selectedSize!.size },
            { label: 'Complexity', value: `${selectedSize!.pieces} pieces` }
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
        <div className="min-h-[85vh] bg-yellow-50 flex flex-col items-center justify-center font-sans mt-20">
        <div className="bg-white p-12 rounded-[2rem] max-w-lg mx-4 text-center shadow-lg border border-yellow-200 mt-20">
          <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-yellow-200 mt-20">
            <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Дякуємо за замовлення!</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-8 inline-block w-full mt-20">
             <p className="text-sm font-bold text-yellow-600 uppercase tracking-widest mb-1">Номер замовлення</p>
             <p className="text-2xl font-black text-gray-900 tracking-tight">{orderNumber}</p>
          </div>
          <p className="text-lg text-gray-600 mb-8 font-medium">
            Ми зв'яжемося з вами найближчим часом
          </p>
          <button onClick={() => window.location.href = '/'} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-5 rounded-2xl transition-all shadow-md active:scale-95">
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
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-yellow-50 to-transparent pointer-events-none mt-20" />
          <div className="max-w-5xl mx-auto text-center relative z-10 mt-20">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-yellow-100 text-yellow-600 mb-6 border border-yellow-200 shadow-sm rotate-12 mt-20">
               <Puzzle className="w-8 h-8" strokeWidth={2.5} />
             </div>
             <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-gray-900">
               Photo Puzzles
             </h1>
             <p className="text-gray-500 font-medium max-w-2xl mx-auto text-lg leading-relaxed">
               Piece together your favorite memories. A highly interactive and memorable gift.
             </p>
          </div>
       </div>

       <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-12 mt-20">
          
          <div className="lg:col-span-8 flex flex-col gap-8 mt-20">
             
             {/* Dynamic Step Navigation */}
             <div className="flex items-center justify-between mb-2 mt-20">
                <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mt-20">
                  <span className={step >= 1 ? 'text-gray-900' : ''}>1. Size</span>
                  <span>/</span>
                  <span className={step >= 2 ? 'text-gray-900' : ''}>2. Image</span>
                  <span>/</span>
                  <span className={step >= 3 ? 'text-gray-900' : ''}>3. Checkout</span>
                </div>
                {step > 1 && (
                  <button onClick={handleBack} className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 flex items-center">
                    <ArrowLeft className="w-3 h-3 mr-2" /> Back
                  </button>
                )}
             </div>

             {/* STEP 1: SIZE */}
             {step === 1 && (
                <div className="animate-in fade-in duration-500 mt-20">
                   <h2 className="text-2xl font-bold mb-8 tracking-tight">Select Puzzle Size</h2>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-20">
                      {PUZZLE_SIZES.map(size => {
                        const isSelected = selectedSizeId === size.id;
                        return (
                          <div 
                            key={size.id} 
                            onClick={() => setSelectedSizeId(size.id)}
                            className={`cursor-pointer rounded-[2rem] p-6 border transition-all flex flex-col relative overflow-hidden
                              ${isSelected ? 'border-gray-900 bg-white shadow-xl ring-1 ring-gray-900 scale-100' : 'border-gray-200 bg-white/50 hover:border-gray-300 hover:bg-white'}
                            `}
                          >
                             <div className="flex justify-between items-start mb-6 mt-20">
                                <div>
                                   <div className={`font-black tracking-tight text-xl mb-1 ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>{size.name}</div>
                                   <div className="text-sm font-bold text-gray-500 mt-20">{size.size}</div>
                                </div>
                                <div className="text-right mt-20">
                                   <div className="font-extrabold text-2xl tracking-tighter text-gray-900 mt-20">{size.price} ₴</div>
                                </div>
                             </div>
                             
                             <div className="flex-1 flex justify-center items-center py-6 mt-20">
                               <div 
                                  className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-md relative flex items-center justify-center opacity-80"
                                  style={{
                                    width: size.id.includes('40x60') ? '90px' : size.id.includes('30x40') ? '80px' : '70px',
                                    height: size.id.includes('40x60') ? '120px' : size.id.includes('A4') ? '100px' : '90px'
                                  }}
                               >
                                  <Puzzle className={`w-6 h-6 ${isSelected ? 'text-yellow-500' : 'text-gray-400'}`} />
                               </div>
                             </div>

                             <div className="mt-auto flex items-center pt-4 border-t border-gray-100 uppercase tracking-widest text-[10px] mt-20">
                                <span className={`font-bold ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>{size.pieces} Pieces</span>
                             </div>

                             {isSelected && (
                               <div className="absolute top-6 right-6 text-gray-900 mt-20">
                                  <CheckCircle2 className="w-6 h-6 bg-white rounded-full" strokeWidth={2.5} />
                               </div>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>
             )}

             {/* STEP 2: UPLOAD */}
             {step === 2 && selectedSize && (
                <div className="animate-in slide-in-from-right-8 duration-500 mt-20">
                   <h2 className="text-2xl font-bold mb-6 tracking-tight">Upload Your Photo</h2>
                   
                   <div className="bg-blue-50/50 border border-blue-100 text-blue-900 p-6 rounded-[1.5rem] mb-8 flex items-start shadow-sm mt-20">
                      <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 text-blue-500 mt-0.5" />
                      <div>
                        <strong className="block mb-2 font-bold tracking-tight">File Guidance</strong>
                        <span className="font-medium text-sm leading-relaxed block text-blue-800/80">The higher the resolution, the sharper the puzzle. Your image will be printed across the entire surface of the puzzle board.</span>
                      </div>
                   </div>

                   <div className="bg-white rounded-[2rem] border border-gray-200 p-4 md:p-8 shadow-sm mt-20">
                      <div className="mb-6 flex justify-between items-center bg-gray-50 px-5 py-3 rounded-2xl border border-gray-100 mt-20">
                         <div className="font-bold text-gray-500 text-sm tracking-wide mt-20">Image Loaded:<br/><span className={`text-2xl font-black tracking-tight ${photos.length === 1 ? 'text-green-600' : 'text-gray-900'}`}>{photos.length}</span> <span className="text-gray-400">/ 1</span></div>
                         <div className="text-right mt-20">
                           {photos.length === 1 && (
                             <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-100 text-green-800 font-bold text-xs uppercase tracking-widest shadow-sm border border-green-200">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Ready
                             </span>
                           )}
                         </div>
                      </div>

                      <PhotoUploader
                            maxFiles={1}
                            minFiles={1}
                            canvasSize={{ width: 3500, height: 2500 }}
                            onPhotosChange={setPhotos}
                      />

                      <div className="mt-8 pt-6 border-t border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] flex flex-wrap gap-2 justify-center mt-20">
                         <span className="bg-gray-100 px-3 py-1.5 rounded-lg">JPG / PNG</span>
                         <span className="bg-gray-100 px-3 py-1.5 rounded-lg">sRGB Color</span>
                         <span className="bg-gray-100 px-3 py-1.5 rounded-lg">Min 150 DPI</span>
                      </div>
                   </div>
                </div>
             )}

             {/* STEP 3: ORDER FORM */}
             {step === 3 && selectedSize && photos.length === 1 && (
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
                         <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors" placeholder="hello@mail.com" />
                      </div>

                      <div>
                         <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Delivery Option *</label>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-20">
                            <label className={`border rounded-xl p-5 flex items-center cursor-pointer transition-colors ${deliveryMethod === 'pickup' ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                               <input type="radio" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} className="sr-only" />
                               <ShoppingBag className={`w-5 h-5 mr-3 ${deliveryMethod === 'pickup' ? 'text-gray-900' : 'text-gray-400'}`} />
                               <span className={`font-bold text-sm ${deliveryMethod === 'pickup' ? 'text-gray-900' : 'text-gray-600'}`}>Self pickup</span>
                            </label>
                            <label className={`border rounded-xl p-5 flex items-center cursor-pointer transition-colors ${deliveryMethod === 'nova_poshta' ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
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
                      )}

                      <div>
                         <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Comment (Optional)</label>
                         <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="w-full bg-gray-50 border-b-2 border-t-0 border-x-0 border-gray-200 focus:border-gray-900 focus:ring-0 py-3 text-sm px-0 transition-colors resize-none" placeholder="Any special notes..." />
                      </div>
                   </div>
                </div>
             )}
          </div>

          {/* Sticky Sidebar */}
          <div className="lg:col-span-4 transition-opacity duration-300 mt-20">
             <div className={`sticky top-8 bg-gray-50 border border-gray-100 rounded-[2.5rem] p-8 lg:p-10 text-gray-900 shadow-xl ${selectedSize ? 'opacity-100' : 'opacity-40 pointer-events-none translate-y-4'}`}>
                <h3 className="text-xl font-bold mb-6 border-b border-gray-200 pb-4 flex justify-between items-center tracking-tight">
                   Order Summary
                </h3>
                
                {selectedSize && (
                  <div className="space-y-6 mt-20">
                    <div className="flex justify-between font-medium items-center mt-20">
                       <span className="text-gray-500 text-sm">Size</span>
                       <span className="bg-white border border-gray-200 px-3 py-1 rounded-lg text-sm font-bold shadow-sm">{selectedSize.size}</span>
                    </div>
                    <div className="flex justify-between font-medium items-center mt-20">
                       <span className="text-gray-500 text-sm">Pieces</span>
                       <span className="text-gray-900 text-sm font-bold">{selectedSize.pieces} items</span>
                    </div>
                    
                    <div className="h-px bg-gray-200 my-6 mt-20" />

                    <div className="flex justify-between font-bold text-lg items-center mt-20">
                       <span>Total</span>
                       <span className="text-2xl font-black tracking-tighter">{formatUAH(selectedSize.price)}</span>
                    </div>

                    {step < 3 ? (
                      <button 
                        onClick={handleNext}
                        disabled={step === 2 && photos.length !== 1}
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
                          disabled={!isReadyToOrder || isSubmitting}
                          className="w-full mt-6 bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-5 rounded-xl uppercase tracking-widest text-[11px] transition-all disabled:cursor-not-allowed shadow-xl active:scale-95 flex items-center justify-center"
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
                      Production: <br/><strong className="text-gray-500">3–5 business days</strong>
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
