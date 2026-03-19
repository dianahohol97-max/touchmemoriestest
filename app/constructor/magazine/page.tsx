'use client';
import { useCartStore } from '@/store/cart-store';

import React, { useState, useMemo, useRef } from 'react';
import { PHOTO_JOURNAL_SOFT, PHOTO_JOURNAL_HARD } from '@/lib/products';
import { ChevronRight, ArrowLeft, Upload, Paperclip, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { submitOrder } from '@/lib/submitOrder';

const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount) + ' UAH';
};

export default function MagazineConstructorPage() {
  const addItem = useCartStore((state) => state.addItem);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [coverType, setCoverType] = useState<'soft' | 'hard' | null>(null);
  const [pages, setPages] = useState<number | null>(null);

  // Extras State
  const [endpapers, setEndpapers] = useState(false);
  const [lamination, setLamination] = useState(false); // hard cover only
  const [retouchCount, setRetouchCount] = useState<number>(0);
  const [urgent, setUrgent] = useState(false);
  const [typesetting, setTypesetting] = useState(false);

  // Order Details State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [contentFile, setContentFile] = useState<File | null>(null);
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product References mapping
  const currentProduct = coverType === 'soft' ? PHOTO_JOURNAL_SOFT : PHOTO_JOURNAL_HARD;
  const availablePages = currentProduct.pagesAvailable;

  // Enforce page selection validity on cover swap
  const handleCoverSelect = (type: 'soft' | 'hard') => {
    setCoverType(type);
    const newProduct = type === 'soft' ? PHOTO_JOURNAL_SOFT : PHOTO_JOURNAL_HARD;
    if (pages !== null && !newProduct.pagesAvailable.includes(pages)) {
      setPages(null);
    }
    if (type === 'soft') {
      setEndpapers(false);
      setLamination(false);
    }
  };

  // Pricing calculations
  const rawBasePrice = (coverType && pages && currentProduct.prices[pages]) || 0;
  const basePrice = rawBasePrice;

  const endpapersPrice = (coverType === 'hard' && endpapers) ? 200 : 0;
  const laminationPrice = (coverType === 'hard' && lamination && pages) ? 5 * pages : 0;
  const retouchingPrice = retouchCount * 7;
  const urgentPrice = urgent ? Math.round(basePrice * 0.3) : 0;
  const typesettingPrice = typesetting ? 175 : 0;

  const extrasTotal = endpapersPrice + laminationPrice + retouchingPrice + urgentPrice + typesettingPrice;
  const totalPrice = basePrice + extrasTotal;

  // Binding description
  const bindingType = pages && pages <= 44 ? '📎 Staple binding (saddle-stitch)' : '📖 Perfect binding (glue spine)';

  const handleNext = () => {
    if (step === 1 && coverType) setStep(2);
    else if (step === 2 && pages) setStep(3);
    else if (step === 3) setStep(4);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
  };

  const isFormValid = customerName.trim() !== '' && phone.trim().length >= 10 && email.includes('@');

  const handlePlaceOrder = async () => {
    if (isFormValid) {
      setIsSubmitting(true);
      setFormError('');
      
      const orderOptions: { label: string; value: string; price?: number }[] = [
        { label: 'Cover Type', value: coverType === 'hard' ? 'Hard Cover' : 'Soft Cover' },
        { label: 'Pages', value: pages ? pages.toString() : '0' }
      ];
      if (endpapers) orderOptions.push({ label: 'Endpapers', value: 'Yes', price: endpapersPrice });
      if (lamination) orderOptions.push({ label: 'Lamination', value: 'Yes', price: laminationPrice });
      if (retouchCount > 0) orderOptions.push({ label: 'Retouching', value: `${retouchCount} photos`, price: retouchingPrice });
      if (typesetting) orderOptions.push({ label: 'Typesetting', value: 'Yes', price: typesettingPrice });
      if (urgent) orderOptions.push({ label: 'Urgent', value: 'Yes', price: urgentPrice });

      const result = await submitOrder({
        customer_name: customerName,
        customer_phone: phone,
        customer_email: email,
        delivery_method: 'pickup', // Defaulting to pickup for magazine
        items: [{
          product_type: 'magazine',
          product_name: "Photo Journal",
          format: coverType === 'hard' ? 'Hard Cover' : 'Soft Cover',
          pages: pages || 0,
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
        notes: description + (contentFile ? `\n\nAttached File: ${contentFile.name}` : '')
      });

      setIsSubmitting(false);

      if (result.success) {
        setOrderNumber(result.order_number!);
        addItem({ id: Date.now().toString(), name: "Magazine", price: totalPrice, qty: 1 });
        setIsSuccess(true);
        window.scrollTo(0, 0);
      } else {
        setFormError('❌ Щось пішло не так. Спробуйте ще раз.');
        console.error('Order submission failed:', result.error);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 500 * 1024 * 1024) {
        alert('File is too large! Maximum 500MB.');
        return;
      }
      setContentFile(file);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[85vh] bg-white flex flex-col items-center justify-center font-sans">
        <div className="p-12 text-center max-w-2xl mx-4 border-2 border-black animate-in fade-in duration-700">
          <h2 className="text-5xl font-black text-black tracking-tighter uppercase mb-6">Дякуємо за замовлення!</h2>
          <div className="bg-gray-50 border border-gray-200 p-6 mb-8 inline-block">
             <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Номер замовлення</p>
             <p className="text-2xl font-black text-black tracking-tight">{orderNumber}</p>
          </div>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Ми зв'яжемося з вами найближчим часом
          </p>
          <div className="bg-gray-50 p-6 mb-10 text-left flex flex-col gap-3 font-mono text-sm border border-gray-200">
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500 uppercase tracking-wider">Format</span> 
              <span className="text-black font-bold text-right">{coverType === 'soft' ? 'Soft Cover' : 'Hard Cover'} / {pages} pages</span>
            </div>
            {contentFile && (
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500 uppercase tracking-wider">Files Attached</span> 
                <span className="text-black font-bold text-right">{contentFile.name}</span>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <span className="text-gray-500 uppercase tracking-wider">Total Est.</span> 
              <span className="text-black font-bold text-lg">{formatUAH(totalPrice)}</span>
            </div>
          </div>
          <Link href="/" className="inline-block px-10 py-4 font-bold tracking-widest uppercase bg-black text-white hover:bg-gray-900 transition-colors border-2 border-black hover:-translate-y-1">
             Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-black selection:bg-black selection:text-white pb-24">
      
      {/* Editorial Header */}
      <header className="border-b-2 border-black py-16 px-4 md:px-12 bg-white relative overflow-hidden">
         <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
         <div className="max-w-7xl mx-auto relative z-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-4 text-gray-500">TouchMemories Editorial</p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9]">
               Photo Journal
            </h1>
         </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* Main Content Area */}
        <div className="lg:col-span-8">
          
          <div className="flex items-center justify-between mb-12 border-b-2 border-black pb-4">
            <div className="flex gap-2 text-xs font-bold uppercase tracking-widest">
              <span className="text-gray-400">Step {step} of 4</span>
              <span className="text-black">— {
                step === 1 ? 'Cover Edition' :
                step === 2 ? 'Volume' :
                step === 3 ? 'Enhancements' :
                'Finalize'
              }</span>
            </div>
            {step > 1 && (
              <button onClick={handleBack} className="text-xs font-bold uppercase tracking-widest hover:underline flex items-center">
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </button>
            )}
          </div>

          <div className="min-h-[400px]">
            {/* STEP 1: COVER TYPE */}
            {step === 1 && (
              <div className="animate-in fade-in duration-500">
                <h2 className="text-3xl font-black uppercase tracking-tight mb-8">Select Edition</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Soft Cover */}
                  <div 
                    onClick={() => handleCoverSelect('soft')}
                    className={`cursor-pointer border-2 transition-all p-8 flex flex-col h-full
                      ${coverType === 'soft' ? 'border-black bg-black text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]' : 'border-gray-200 hover:border-black'}
                    `}
                  >
                    <div className="flex-1">
                      <h3 className="text-2xl font-black uppercase mb-2">Soft Cover</h3>
                      <p className={`text-sm font-medium mb-4 ${coverType === 'soft' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-widest text-[#888]`}>Фотожурнал</p>
                      <ul className={`text-sm space-y-3 mb-8 ${coverType === 'soft' ? 'text-gray-200' : 'text-gray-600'}`}>
                        <li className="flex items-start">— A4 Format</li>
                        <li className="flex items-start">— 115g glossy inner pages</li>
                        <li className="flex items-start">— Soft cover 130g</li>
                        <li className="flex items-start">— Staple binding (≤44p) or Glue (&gt;44p)</li>
                        <li className="flex items-start">— 8 to 100 pages</li>
                      </ul>
                    </div>
                    <div className={`mt-auto pt-6 border-t ${coverType === 'soft' ? 'border-gray-800' : 'border-gray-100'}`}>
                      <p className="font-mono text-sm uppercase tracking-wider">From 425 UAH</p>
                    </div>
                  </div>

                  {/* Hard Cover */}
                  <div 
                    onClick={() => handleCoverSelect('hard')}
                    className={`cursor-pointer border-2 transition-all p-8 flex flex-col h-full
                      ${coverType === 'hard' ? 'border-black bg-black text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]' : 'border-gray-200 hover:border-black'}
                    `}
                  >
                    <div className="flex-1">
                      <h3 className="text-2xl font-black uppercase mb-2">Hard Cover</h3>
                      <p className={`text-sm font-medium mb-4 ${coverType === 'hard' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-widest text-[#888]`}>З твердою обкладинкою</p>
                      <ul className={`text-sm space-y-3 mb-8 ${coverType === 'hard' ? 'text-gray-200' : 'text-gray-600'}`}>
                        <li className="flex items-start">— A4 Format</li>
                        <li className="flex items-start">— Glossy coated paper</li>
                        <li className="flex items-start">— Premium hard cover</li>
                        <li className="flex items-start">— Endpapers & lamination options</li>
                        <li className="flex items-start">— 12 to 80 pages</li>
                      </ul>
                    </div>
                    <div className={`mt-auto pt-6 border-t ${coverType === 'hard' ? 'border-gray-800' : 'border-gray-100'}`}>
                      <p className="font-mono text-sm uppercase tracking-wider">From 600 UAH</p>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* STEP 2: PAGE COUNT */}
            {step === 2 && (
              <div className="animate-in slide-in-from-right-8 duration-500">
                <div className="flex justify-between items-end mb-8">
                  <h2 className="text-3xl font-black uppercase tracking-tight">Volume Configuration</h2>
                  <div className="text-right">
                     <span className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1">Canvas Size</span>
                     <span className="font-mono text-sm">2480×3508 px @ 300 DPI</span>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 p-8 mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6">Select Page Count</h3>
                  <div className="flex flex-wrap gap-3">
                    {availablePages.map(p => (
                      <button
                        key={p}
                        onClick={() => setPages(p)}
                        className={`w-14 h-14 flex items-center justify-center font-mono text-lg transition-all border
                          ${pages === p 
                            ? 'bg-black text-white border-black scale-110 shadow-lg' 
                            : 'bg-white text-black border-gray-300 hover:border-black hover:bg-gray-100'}
                        `}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {pages && (
                  <div className="border-l-4 border-black pl-6 py-2 animate-in fade-in">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Binding Method Applied</p>
                    <p className="text-xl font-bold">{bindingType}</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: EXTRAS */}
            {step === 3 && (
              <div className="animate-in slide-in-from-right-8 duration-500">
                <h2 className="text-3xl font-black uppercase tracking-tight mb-8">Editorial Enhancements</h2>
                
                <div className="space-y-4">
                  
                  {/* Hard Cover Only Options */}
                  {coverType === 'hard' && (
                    <>
                      <label className={`block border-2 p-6 cursor-pointer transition-colors ${endpapers ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-black'}`}>
                        <div className="flex items-start">
                          <div className={`w-6 h-6 border-2 flex items-center justify-center mr-4 mt-0.5 ${endpapers ? 'border-black bg-black' : 'border-gray-300'}`}>
                            {endpapers && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-lg uppercase tracking-tight">Endpapers (Форзаці)</span>
                              <span className="font-mono text-sm">+200 UAH</span>
                            </div>
                            <p className="text-sm text-gray-500">Decorative inner covers.</p>
                          </div>
                        </div>
                      </label>

                      <label className={`block border-2 p-6 cursor-pointer transition-colors ${lamination ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-black'}`}>
                        <div className="flex items-start">
                          <div className={`w-6 h-6 border-2 flex items-center justify-center mr-4 mt-0.5 ${lamination ? 'border-black bg-black' : 'border-gray-300'}`}>
                            {lamination && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-lg uppercase tracking-tight">Lamination</span>
                              <span className="font-mono text-sm">+{5 * (pages || 0)} UAH</span>
                            </div>
                            <p className="text-sm text-gray-500">5 UAH per page.</p>
                          </div>
                        </div>
                      </label>
                    </>
                  )}

                  {/* Standard Options */}
                  <label className={`block border-2 p-6 cursor-pointer transition-colors ${typesetting ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-black'}`}>
                    <div className="flex items-start">
                      <div className={`w-6 h-6 border-2 flex items-center justify-center mr-4 mt-0.5 ${typesetting ? 'border-black bg-black' : 'border-gray-300'}`}>
                        {typesetting && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-lg uppercase tracking-tight">Text Typesetting</span>
                          <span className="font-mono text-sm">+175 UAH</span>
                        </div>
                        <p className="text-sm text-gray-500">Professional editorial typesetting service.</p>
                      </div>
                    </div>
                  </label>

                  <label className={`block border-2 p-6 cursor-pointer transition-colors ${urgent ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-black'}`}>
                    <div className="flex items-start">
                      <div className={`w-6 h-6 border-2 flex items-center justify-center mr-4 mt-0.5 ${urgent ? 'border-black bg-black' : 'border-gray-300'}`}>
                        {urgent && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-lg uppercase tracking-tight">Urgent Production</span>
                          <span className="font-mono text-sm">+{Math.round(basePrice * 0.3)} UAH</span>
                        </div>
                        <p className="text-sm text-gray-500">+30% of base price.</p>
                      </div>
                    </div>
                  </label>

                  <div className={`block border-2 p-6 transition-colors ${retouchCount > 0 ? 'border-black' : 'border-gray-200'}`}>
                    <div className="flex items-start flex-col sm:flex-row sm:items-center justify-between">
                      <div className="mb-4 sm:mb-0">
                        <span className="font-bold text-lg uppercase tracking-tight block mb-1">Photo Retouching</span>
                        <p className="text-sm text-gray-500">7 UAH per photo.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Qty:</label>
                        <input 
                          type="number" 
                          min="0" 
                          className="w-24 border-2 border-gray-300 focus:border-black focus:ring-0 text-center font-mono text-lg py-2" 
                          value={retouchCount === 0 ? '' : retouchCount}
                          onChange={(e) => setRetouchCount(parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <span className="font-mono text-sm w-20 text-right">+{retouchingPrice} UAH</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* STEP 4: ORDER FORM */}
            {step === 4 && (
              <div className="animate-in slide-in-from-right-8 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                  <h2 className="text-3xl font-black uppercase tracking-tight leading-none">Checkout & Upload</h2>
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500 border border-gray-200 px-3 py-1 bg-gray-50">
                     Time: 4–8 business days after design approval
                  </span>
                </div>

                <div className="border-2 border-black p-6 md:p-10 mb-8 bg-gray-50">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-black mb-6">File Assets</h3>
                   
                   {!contentFile ? (
                     <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-400 p-10 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-gray-100 transition-colors bg-white group"
                     >
                       <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-colors">
                          <Upload className="w-6 h-6" />
                       </div>
                       <p className="font-bold uppercase tracking-widest mb-2">Upload Content Files</p>
                       <p className="text-sm text-gray-500">.ZIP or .PDF format up to 500MB (Optional)</p>
                       <input 
                         type="file" 
                         ref={fileInputRef} 
                         onChange={handleFileChange}
                         accept=".zip,.pdf,application/zip,application/pdf"
                         className="hidden" 
                       />
                     </div>
                   ) : (
                     <div className="border-2 border-black p-6 flex items-center justify-between bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-center">
                           <div className="w-12 h-12 bg-black text-white flex items-center justify-center mr-4">
                             <Paperclip className="w-5 h-5" />
                           </div>
                           <div>
                             <p className="font-bold">{contentFile.name}</p>
                             <p className="text-xs text-gray-500 font-mono mt-1">{(contentFile.size / (1024*1024)).toFixed(2)} MB</p>
                           </div>
                        </div>
                        <button onClick={() => setContentFile(null)} className="p-2 hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors">
                           <X className="w-5 h-5" />
                        </button>
                     </div>
                   )}
                </div>

                <div className="space-y-6">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-black border-b-2 border-black pb-2">Client Details</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col">
                        <label className="text-xs font-bold uppercase tracking-widest mb-2 text-gray-600">Full Name *</label>
                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="border-2 border-gray-300 focus:border-black focus:ring-0 p-4 font-medium" placeholder="Jane Doe" required />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs font-bold uppercase tracking-widest mb-2 text-gray-600">Phone Number *</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="border-2 border-gray-300 focus:border-black focus:ring-0 p-4 font-medium" placeholder="+380..." required />
                      </div>
                   </div>
                   <div className="flex flex-col">
                        <label className="text-xs font-bold uppercase tracking-widest mb-2 text-gray-600">Email Address *</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border-2 border-gray-300 focus:border-black focus:ring-0 p-4 font-medium" placeholder="client@agency.com" required />
                   </div>
                   <div className="flex flex-col">
                        <label className="text-xs font-bold uppercase tracking-widest mb-2 text-gray-600">Magazine Purpose / Notes</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="border-2 border-gray-300 focus:border-black focus:ring-0 p-4 font-medium" placeholder="E.g., Lookbook for Spring collection, event documentation..." />
                   </div>
                </div>

              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-12 flex justify-end">
            {step < 4 ? (
              <button 
                onClick={handleNext}
                disabled={(step === 1 && !coverType) || (step === 2 && !pages)}
                className="group flex items-center bg-black text-white px-8 py-4 font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900 transition-all border-2 border-black hover:-translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
              >
                Proceed <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : null}
          </div>

        </div>

        {/* Right Sidebar: Dynamic Invoice Style Summary */}
        <div className="lg:col-span-4">
           <div className="sticky top-12 border-2 border-black p-6 md:p-8 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col">
              <h3 className="text-2xl font-black uppercase tracking-tight mb-6 border-b-2 border-black pb-4">Estimate</h3>
              
              <div className="space-y-4 mb-8 flex-1">
                 <div className="flex justify-between items-start">
                   <span className="text-sm font-bold uppercase tracking-wide text-gray-600">Edition Base</span>
                   <span className="font-mono text-sm">{formatUAH(basePrice)}</span>
                 </div>
                 {coverType && <p className="text-xs text-gray-400 uppercase tracking-widest mt-[-10px]">{coverType} / {pages || 0}p</p>}

                 {endpapersPrice > 0 && (
                   <div className="flex justify-between items-start mt-4">
                     <span className="text-sm font-bold uppercase tracking-wide text-gray-600">Endpapers</span>
                     <span className="font-mono text-sm">+{formatUAH(endpapersPrice)}</span>
                   </div>
                 )}

                 {laminationPrice > 0 && (
                   <div className="flex justify-between items-start mt-4">
                     <span className="text-sm font-bold uppercase tracking-wide text-gray-600">Lamination</span>
                     <span className="font-mono text-sm">+{formatUAH(laminationPrice)}</span>
                   </div>
                 )}

                 {retouchingPrice > 0 && (
                   <div className="flex justify-between items-start mt-4">
                     <span className="text-sm font-bold uppercase tracking-wide text-gray-600">Retouching ✕{retouchCount}</span>
                     <span className="font-mono text-sm">+{formatUAH(retouchingPrice)}</span>
                   </div>
                 )}

                 {typesettingPrice > 0 && (
                   <div className="flex justify-between items-start mt-4">
                     <span className="text-sm font-bold uppercase tracking-wide text-gray-600">Typesetting</span>
                     <span className="font-mono text-sm">+{formatUAH(typesettingPrice)}</span>
                   </div>
                 )}

                 {urgentPrice > 0 && (
                   <div className="flex justify-between items-start mt-4">
                     <span className="text-sm font-bold uppercase tracking-wide text-gray-600">Urgent (+30%)</span>
                     <span className="font-mono text-sm">+{formatUAH(urgentPrice)}</span>
                   </div>
                 )}
              </div>

              <div className="border-t-2 border-black pt-6 mb-8 mt-auto">
                 <div className="flex justify-between items-end">
                   <span className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">Total Due</span>
                   <span className="text-3xl font-black font-mono tracking-tighter">{formatUAH(totalPrice)}</span>
                 </div>
              </div>

              {step === 4 && (
                <div className="flex flex-col gap-2">
                  {formError && (
                    <p className="text-center text-xs text-red-600 font-bold mb-2">
                      {formError}
                    </p>
                  )}
                  <button 
                    onClick={handlePlaceOrder}
                    disabled={!isFormValid || isSubmitting}
                    className="w-full bg-black text-white font-bold uppercase tracking-widest py-5 border-2 border-black hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
                      isFormValid ? 'Place Order' : 'Fill Form to Continue'
                    )}
                  </button>
                </div>
              )}
           </div>
        </div>

      </div>

    </div>
  );
}
