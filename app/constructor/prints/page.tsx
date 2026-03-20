'use client';
import { Navigation } from '@/components/ui/Navigation';
import { useCartStore } from '@/store/cart-store';

import React, { useState, useMemo } from 'react';
import { PHOTO_PRINTS } from '@/lib/products';
import { Camera, CheckCircle2, AlertCircle, MapPin, Store, Truck, Info } from 'lucide-react';
import PhotoUploader from '@/components/PhotoUploader';
import { submitOrder } from '@/lib/submitOrder';

const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount) + ' UAH';
};

type SizeCategory = 'classic' | 'non_standard' | 'polaroid' | 'strip';

interface PrintSize {
  id: string;
  category: SizeCategory;
  size: string;
  price: number;
  multipleOf: number;
  mandatoryFrame: boolean;
  notes?: string;
  w?: number;
  h?: number;
}

export default function PhotoPrintsConstructor() {
  // 1. Compile unified list of sizes from PHOTO_PRINTS
  const allSizes: PrintSize[] = useMemo(() => {
    const parseDim = (str: string) => {
      const match = str.match(/(\d+(?:\.\d+)?)(?:×|x)(\d+(?:\.\d+)?)/i);
      return match ? [parseFloat(match[1]), parseFloat(match[2])] : [1, 1];
    };

    const classic = PHOTO_PRINTS.classicSizes.map((p: any) => {
      const [w, h] = parseDim(p.size);
      return { id: `classic_${p.size}`, category: 'classic' as SizeCategory, size: p.size, price: p.price, multipleOf: 1, mandatoryFrame: false, notes: p.notes, w, h };
    });

    const nonStandard = PHOTO_PRINTS.nonStandardSizes.map((p: any) => {
      const [w, h] = parseDim(p.size);
      return { id: `non_${p.size}`, category: 'non_standard' as SizeCategory, size: p.size, price: p.price, multipleOf: p.multipleOf || 1, mandatoryFrame: true, notes: p.notes, w, h };
    });

    const polaroid = PHOTO_PRINTS.polaroid.map((p: any) => {
      const [w, h] = parseDim(p.size);
      return { id: `pol_${p.size}`, category: 'polaroid' as SizeCategory, size: p.size, price: p.price, multipleOf: p.multipleOf || 1, mandatoryFrame: false, notes: p.notes, w, h };
    });

    const strip = {
      id: 'strip_set',
      category: 'strip' as SizeCategory,
      size: '6×20 cm (Set of 5 strips)',
      price: PHOTO_PRINTS.photoStrips.pricePerSet || 125,
      multipleOf: 1,
      mandatoryFrame: false,
      notes: PHOTO_PRINTS.photoStrips.description || '3 identical photos per strip',
      w: 6,
      h: 20
    };

    return [...classic, ...nonStandard, ...polaroid, strip];
  }, []);

  // UI State
  const addItem = useCartStore((state) => state.addItem);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [whiteFrame, setWhiteFrame] = useState(false);
  const [stripSets, setStripSets] = useState<number>(1);
  const [photos, setPhotos] = useState<File[]>([]);
  
  // Checkout State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paperFinish, setPaperFinish] = useState<'matte' | 'glossy'>('matte');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'nova_poshta'>('pickup');
  const [npCity, setNpCity] = useState('');
  const [npBranch, setNpBranch] = useState('');
  const [comment, setComment] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [formError, setFormError] = useState('');

  // Derived Selection Validation
  const selectedSize = allSizes.find(s => s.id === selectedSizeId);
  
  const minFiles = selectedSize 
    ? (selectedSize.category === 'classic' ? PHOTO_PRINTS.minimumOrder || 20 : (selectedSize.category === 'strip' ? stripSets : selectedSize.multipleOf))
    : 20;

  const maxFiles = 200; // Cap at 200 per upload batch for performance/UI safety, though discount applies to 200+
  const qty = photos.length;

  const isMultipleValid = selectedSize && selectedSize.category !== 'strip' 
    ? (qty === 0 || qty % selectedSize.multipleOf === 0) 
    : true;
    
  const isMinimumReached = qty >= minFiles;
  const isPhotosReady = isMinimumReached && isMultipleValid && qty <= maxFiles;

  const handleSizeSelect = (id: string) => {
    setSelectedSizeId(id);
    setPhotos([]); // clear photos if format drastically changes to prevent weird states
    setWhiteFrame(false);
    setStripSets(1);
  };

  // Pricing Logic
  let basePriceTotal = 0;
  let bulkDiscount = 0;
  let finalTotal = 0;

  if (selectedSize) {
    if (selectedSize.category === 'strip') {
      basePriceTotal = stripSets * selectedSize.price;
      finalTotal = basePriceTotal; // no bulk discount typically on sets unless specified
    } else {
      basePriceTotal = qty * selectedSize.price;
      if (qty >= 200) {
        bulkDiscount = basePriceTotal * 0.07; // 7% off
      }
      finalTotal = basePriceTotal - bulkDiscount;
    }
  }

  const isFormValid = 
    customerName.trim() !== '' && 
    phone.trim().length >= 10 && 
    email.includes('@') &&
    (deliveryMethod === 'pickup' || (npCity.trim() !== '' && npBranch.trim() !== ''));

  const isCartReady = selectedSize && isPhotosReady && isFormValid && finalTotal > 0;

  const handlePlaceOrder = async () => {
    if (isCartReady) {
      setIsSubmitting(true);
      setFormError('');
      
      const orderOptions: { label: string; value: string; price?: number }[] = [
        { label: 'Size', value: selectedSize!.size },
        { label: 'Paper Finish', value: paperFinish === 'glossy' ? 'Glossy' : 'Matte' }
      ];
      
      if (whiteFrame) {
        orderOptions.push({ label: 'Border', value: '3mm White Border' });
      }

      const result = await submitOrder({
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        delivery_method: deliveryMethod,
        delivery_address: deliveryMethod === 'nova_poshta' ? { city: npCity, branch: npBranch } : undefined,
        items: [{
          product_type: selectedSize!.category === 'strip' ? 'photo_strips' : 'photo_prints',
          product_name: `Photo Prints ${selectedSize!.category === 'strip' ? '(Photo Strips)' : ''}`,
          format: selectedSize!.size,
          quantity: selectedSize!.category === 'strip' ? stripSets : qty,
          unit_price: selectedSize!.price,
          total_price: finalTotal,
          options: orderOptions.reduce((acc, opt) => {
            acc[opt.label] = opt.value;
            return acc;
          }, {} as Record<string, string>)
        }],
        subtotal: finalTotal,
        delivery_cost: 0,
        total: finalTotal,
        notes: comment
      });

      setIsSubmitting(false);

      if (result.success) {
        setOrderNumber(result.order_number!);
        addItem({ id: Date.now().toString(), name: "Prints", price: finalTotal, qty: 1 });
        setIsSuccess(true);
        window.scrollTo(0, 0);
      } else {
        setFormError('❌ Щось пішло не так. Спробуйте ще раз.');
        console.error('Order submission failed:', result.error);
      }
    }
  };

  const categories = [
    { id: 'classic', title: 'Classic Sizes' },
    { id: 'non_standard', title: 'Non-Standard Sizes' },
    { id: 'polaroid', title: 'Polaroid Formats' },
    { id: 'strip', title: 'Photo Strips' }
  ];

  if (isSuccess) {
    return (
      <>
        <Navigation />
        <div className="min-h-[80vh] bg-neutral-50 flex items-center justify-center p-4 font-sans mt-20">
          <div className="bg-white max-w-lg w-full p-8 md:p-12 rounded-[2rem] shadow-xl text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Дякуємо за замовлення!</h2>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-8 inline-block w-full">
               <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Номер замовлення</p>
               <p className="text-2xl font-black text-blue-600 tracking-tight">{orderNumber}</p>
            </div>
            <p className="text-gray-600 mb-8 font-medium text-lg leading-relaxed">
               Ми зв'яжемося з вами найближчим часом
            </p>
            <button onClick={() => window.location.href = '/'} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-colors shadow-md">
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
      <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900 mt-20">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-12 px-4 shadow-sm relative overflow-hidden">
         <div className="max-w-6xl mx-auto relative z-10">
            <span className="text-blue-600 font-extrabold uppercase tracking-widest text-xs mb-3 block">Professional Printing</span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 flex items-center">
               <Camera className="w-10 h-10 mr-4 text-gray-900" strokeWidth={2.5} />
               Photo Prints
            </h1>
            <p className="text-gray-500 font-medium max-w-2xl text-base md:text-lg">
               Printed on high-quality {PHOTO_PRINTS.equipment}. 
               <br />Choose your sizes below to get started.
            </p>
         </div>
         <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-blue-50 to-transparent pointer-events-none" />
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pl-4 md:pl-8">
        
        {/* Main Content */}
        <div className="lg:col-span-8 flex flex-col gap-10">
          
          {/* STEP 1: SIZE SELECTION */}
          <section>
            <h2 className="text-2xl font-extrabold mb-6 flex items-center">
               <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-3 border border-blue-200">1</span>
               Select Print Size
            </h2>
            
            <div className="space-y-10">
               {categories.map(cat => {
                 const catSizes = allSizes.filter(s => s.category === cat.id);
                 if (catSizes.length === 0) return null;

                 return (
                   <div key={cat.id} className="animate-in fade-in">
                      <h3 className="text-sm font-extrabold uppercase tracking-widest text-gray-400 mb-4">{cat.title}</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                         {catSizes.map(size => {
                           const isSelected = selectedSizeId === size.id;
                           return (
                             <div 
                               key={size.id} 
                               onClick={() => handleSizeSelect(size.id)}
                               className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all duration-200 flex flex-col
                                 ${isSelected ? 'border-blue-600 bg-blue-50/30 shadow-md ring-4 ring-blue-600/10' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'}
                               `}
                             >
                                <div className="flex-1 flex flex-col items-center justify-center mb-6">
                                   <div 
                                     className={`border-4 shadow-inner transition-colors ${isSelected ? 'border-blue-200 bg-white' : 'border-gray-100 bg-gray-50'}`}
                                     style={{ 
                                       width: size.w && size.h ? (size.w > size.h ? '80px' : `${(size.w/size.h)*80}px`) : '60px',
                                       height: size.w && size.h ? (size.w > size.h ? `${(size.h/size.w)*80}px` : '80px') : '80px',
                                       maxHeight: '100px',
                                       backgroundColor: size.category === 'strip' ? '#f8fafc' : 'white'
                                     }}
                                   >
                                      {size.category === 'strip' && (
                                        <div className="w-full h-full flex flex-col justify-between p-1 opacity-50">
                                           <div className="flex-1 bg-gray-200 border border-gray-300 mb-1" />
                                           <div className="flex-1 bg-gray-200 border border-gray-300 mb-1" />
                                           <div className="flex-1 bg-gray-200 border border-gray-300" />
                                        </div>
                                      )}
                                   </div>
                                </div>
                                <div className="mt-auto text-center">
                                   <div className={`font-black tracking-tight mb-1 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>{size.size}</div>
                                   <div className={`font-mono text-sm font-bold ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                                      {size.price} UAH <span className="text-[10px] text-gray-400 font-sans uppercase">/{size.category === 'strip' ? 'set' : 'ea'}</span>
                                   </div>
                                </div>
                                {isSelected && <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                                   <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                                </div>}
                             </div>
                           );
                         })}
                      </div>
                   </div>
                 );
               })}
            </div>

            {/* Contextual Options for Selected Size */}
            {selectedSize && (
              <div className="mt-8 bg-blue-50/50 border border-blue-100 rounded-[1.5rem] p-6 animate-in slide-in-from-top-4">
                 {selectedSize.category === 'classic' && (
                   <label className="flex items-center cursor-pointer group">
                     <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center transition-colors ${whiteFrame ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 group-hover:border-blue-400'}`}>
                        {whiteFrame && <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                     </div>
                     <span className="font-bold text-blue-900">Add 3mm white border to prints</span>
                   </label>
                 )}

                 {selectedSize.category === 'strip' && (
                   <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-blue-900 block mb-1">How many sets?</span>
                        <p className="text-sm text-blue-700/70 font-medium">1 set = 5 strips (15 photos total)</p>
                      </div>
                      <input 
                        type="number" 
                        min="1" 
                        max="50"
                        value={stripSets} 
                        onChange={(e) => setStripSets(Math.max(1, parseInt(e.target.value) || 1))} 
                        className="w-24 text-center font-bold text-lg rounded-xl border-blue-200 focus:border-blue-500 focus:ring-blue-500 shadow-sm py-2"
                      />
                   </div>
                 )}

                 {selectedSize.mandatoryFrame && (
                   <div className="flex items-start text-blue-800">
                     <Info className="w-5 h-5 mr-2 flex-shrink-0" />
                     <p className="text-sm font-medium">A white frame is <strong>mandatory</strong> for this non-standard size. The quantity must be a multiple of <strong>{selectedSize.multipleOf}</strong>.</p>
                   </div>
                 )}
              </div>
            )}
          </section>

          {/* STEP 2: UPLOAD */}
          {selectedSize && (
             <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
               <h2 className="text-2xl font-extrabold mb-6 flex items-center">
                 <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-3 border border-blue-200">2</span>
                 Upload Photos
               </h2>

               {/* Requirements Warning Box */}
               <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-2xl mb-8 shadow-sm">
                  <h4 className="font-bold text-amber-900 flex items-center mb-3">
                     <AlertCircle className="w-5 h-5 mr-2" strokeWidth={2.5} /> IMPORTANT — File Requirements
                  </h4>
                  <ul className="text-sm space-y-2 text-amber-800 font-medium">
                     {PHOTO_PRINTS.fileRequirements.map((req, i) => (
                       <li key={i} className="flex"><span className="text-amber-500 mr-2">✓</span> {req}</li>
                     ))}
                  </ul>
               </div>

               <div className="bg-white rounded-[2rem] border border-gray-200 p-2 sm:p-6 shadow-sm">
                  <div className="mb-6 flex justify-between items-end px-2">
                     <p className="font-bold text-gray-700">Photos uploaded: <span className="text-blue-600 text-xl font-black">{qty}</span></p>
                     <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Min: {minFiles} • Max: {maxFiles}</p>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 h-2.5 rounded-full mb-8 overflow-hidden mx-2 shadow-inner">
                     <div 
                        className={`h-full transition-all duration-500 rounded-full ${isMinimumReached ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min((qty / minFiles) * 100, 100)}%` }}
                     />
                  </div>

                  {/* Quantity Issue Warning */}
                  {!isMultipleValid && selectedSize.category !== 'strip' && (
                    <div className="mx-2 mb-6 bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-200 text-sm font-bold flex items-center animate-in fade-in">
                       <AlertCircle className="w-4 h-4 mr-2" strokeWidth={3} />
                       For {selectedSize.size}, quantity must be a multiple of {selectedSize.multipleOf} (e.g. {selectedSize.multipleOf}, {selectedSize.multipleOf * 2}, {selectedSize.multipleOf * 3}...).
                    </div>
                  )}

                  <PhotoUploader
                        maxFiles={maxFiles}
                        minFiles={minFiles}
                        canvasSize={{ width: 1500, height: 1000 }} // Generic placeholder req since sizes vary dynamically
                        onPhotosChange={setPhotos}
                  />
               </div>
             </section>
          )}

          {/* STEP 3: CHECKOUT FORM */}
          {selectedSize && (
             <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
               <h2 className="text-2xl font-extrabold mb-6 flex items-center">
                 <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-3 border border-blue-200">3</span>
                 Order Details
               </h2>

               <div className="bg-white rounded-[2rem] border border-gray-200 p-6 md:p-8 shadow-sm space-y-8">
                  
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 block">Paper Finish</span>
                    <div className="flex gap-4">
                       <label className={`flex-1 flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-colors ${paperFinish === 'matte' ? 'border-blue-600 bg-blue-50/50 font-bold text-blue-900' : 'border-gray-200 hover:border-blue-300 font-medium text-gray-600'}`}>
                          <input type="radio" checked={paperFinish === 'matte'} onChange={() => setPaperFinish('matte')} className="sr-only" /> Matte
                       </label>
                       <label className={`flex-1 flex items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-colors ${paperFinish === 'glossy' ? 'border-blue-600 bg-blue-50/50 font-bold text-blue-900' : 'border-gray-200 hover:border-blue-300 font-medium text-gray-600'}`}>
                          <input type="radio" checked={paperFinish === 'glossy'} onChange={() => setPaperFinish('glossy')} className="sr-only" /> Glossy
                       </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Full Name *</label>
                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="John Doe" />
                     </div>
                     <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Phone *</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="+380..." />
                     </div>
                  </div>
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Email *</label>
                     <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="email@example.com" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Delivery Method *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className={`border-2 rounded-xl p-4 flex items-center cursor-pointer transition-colors ${deliveryMethod === 'pickup' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                           <Store className={`w-5 h-5 mr-3 ${deliveryMethod === 'pickup' ? 'text-blue-600' : 'text-gray-400'}`} />
                           <span className={`font-bold ${deliveryMethod === 'pickup' ? 'text-blue-900' : 'text-gray-700'}`}>Self-pickup in Ternopil</span>
                        </label>
                        <label className={`border-2 rounded-xl p-4 flex items-center cursor-pointer transition-colors ${deliveryMethod === 'nova_poshta' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                           <Truck className={`w-5 h-5 mr-3 ${deliveryMethod === 'nova_poshta' ? 'text-blue-600' : 'text-gray-400'}`} />
                           <span className={`font-bold ${deliveryMethod === 'nova_poshta' ? 'text-blue-900' : 'text-gray-700'}`}>Nova Poshta</span>
                        </label>
                    </div>
                  </div>

                  {deliveryMethod === 'nova_poshta' && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-blue-50/30 p-5 rounded-xl border border-blue-100">
                        <div>
                           <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" /> City</label>
                           <input type="text" value={npCity} onChange={e => setNpCity(e.target.value)} required className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm" placeholder="e.g. Kyiv" />
                        </div>
                        <div>
                           <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 border-transparent">Branch / Locker</label>
                           <input type="text" value={npBranch} onChange={e => setNpBranch(e.target.value)} required className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm" placeholder="e.g. 15" />
                        </div>
                     </div>
                  )}

                  <div>
                     <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Comment (Optional)</label>
                     <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors" placeholder="Any special requests..." />
                  </div>
               </div>
             </section>
          )}

        </div>

        {/* Sticky Sidebar Right */}
        <div className="lg:col-span-4 transition-opacity duration-300 block">
           <div className={`sticky top-8 bg-black rounded-[2rem] p-8 text-white shadow-2xl overflow-hidden ${selectedSize ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <h3 className="text-xl font-bold mb-6 border-b border-gray-800 pb-4">YOUR ORDER</h3>
              
              {!selectedSize ? (
                <div className="text-gray-500 font-medium text-sm text-center py-10">Select a print size first</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between font-medium">
                     <span className="text-gray-400">Size</span>
                     <span className="text-white text-right">{selectedSize.size}</span>
                  </div>
                  {whiteFrame && (
                    <div className="flex justify-between font-medium">
                       <span className="text-gray-400">Modifier</span>
                       <span className="text-white text-right">3mm White Border</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium">
                     <span className="text-gray-400">Finish</span>
                     <span className="text-white capitalize">{paperFinish}</span>
                  </div>
                  
                  <div className="h-px bg-gray-800 my-4" />

                  {selectedSize.category === 'strip' ? (
                     <div className="flex justify-between font-bold text-lg">
                        <span>{stripSets} sets × {selectedSize.price} ₴</span>
                        <span>{formatUAH(basePriceTotal)}</span>
                     </div>
                  ) : (
                     <div className="flex justify-between font-bold text-lg">
                        <span>{qty} photos × {selectedSize.price} ₴</span>
                        <span>{formatUAH(basePriceTotal)}</span>
                     </div>
                  )}

                  {bulkDiscount > 0 && (
                     <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl text-sm font-bold flex flex-col mt-4 animate-in slide-in-from-right-4">
                       <span className="uppercase tracking-widest text-[10px] mb-1">7% Bulk Discount Applied</span>
                       <div className="flex justify-between items-center">
                          <span>Savings</span>
                          <span>- {formatUAH(bulkDiscount)}</span>
                       </div>
                     </div>
                  )}

                  <div className="bg-gray-900 rounded-2xl p-6 mt-6 border border-gray-800">
                     <span className="text-xs uppercase tracking-widest text-gray-500 block mb-1">Total Due</span>
                     <div className="text-3xl font-black">{formatUAH(finalTotal)}</div>
                  </div>

                  {formError && (
                    <div className="mt-6 p-3 bg-red-50 text-red-700 text-sm font-bold rounded-lg text-center border border-red-200">
                      {formError}
                    </div>
                  )}
                  <button 
                     onClick={handlePlaceOrder}
                     disabled={!isCartReady || isSubmitting}
                     className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold py-5 rounded-xl uppercase tracking-widest transition-colors shadow-lg shadow-blue-900/20 flex justify-center items-center"
                  >
                     {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Placing...
                        </>
                     ) : (
                        isCartReady ? 'Add to Cart' : (isMinimumReached ? 'Fill Form to Order' : 'Upload Photos First')
                     )}
                  </button>
                  
                  <p className="text-center text-xs text-gray-500 mt-4 font-medium px-4">
                    Production time: {PHOTO_PRINTS.productionTime}.
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
