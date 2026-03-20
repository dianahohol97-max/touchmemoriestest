'use client';
import { useState, useRef } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { useRouter } from 'next/navigation';
import { X, Upload, CheckCircle2 } from 'lucide-react';
import { submitOrder } from '@/lib/submitOrder';
import Image from 'next/image';
import Link from 'next/link';
import { getProductSEO } from '@/lib/seoContent';

const PRINT_TYPES = [
  { key: 'standard', label: 'Стандартні розміри' },
  { key: 'nonstandard', label: 'Нестандартні розміри' },
  { key: 'polaroid', label: 'Полароїд' },
];

const SIZES = {
  standard: [
    { size: '9×13', price: 8 },
    { size: '10×15', price: 8 },
    { size: '13×15', price: 8 },
    { size: '15×20', price: 8 },
    { size: '20×30', price: 8 },
  ],
  nonstandard: [
    { size: '5×7.5', price: 7.5 },
    { size: '6×9', price: 7.5 },
    { size: '7.5×10', price: 7.5 },
    { size: '9×9', price: 7.5 },
    { size: '10×10', price: 7.5 },
  ],
  polaroid: [
    { size: '7.6×10.1', price: 7.5, label: 'Класичний полароїд' },
    { size: '8.6×5.4', price: 7.5, label: 'Міні полароїд' },
  ],
};

interface Photo {
  file: File;
  name: string;
  preview: string;
  quantity: number;
}

export default function PhotoPrintsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productInfo = getProductSEO('photoPrints')!;

  // Basic options
  const [printType, setPrintType] = useState<'standard' | 'nonstandard' | 'polaroid'>('standard');
  const [printSize, setPrintSize] = useState('10×15');
  const [pricePerPrint, setPricePerPrint] = useState(8);
  const [paperFinish, setPaperFinish] = useState<'matte' | 'glossy'>('matte');
  const [whiteBorder, setWhiteBorder] = useState(true);

  // Photos
  const [photos, setPhotos] = useState<Photo[]>([]);

  // Extra services
  const [photoRetouching, setPhotoRetouching] = useState(false);
  const [retouchChoice, setRetouchChoice] = useState<'specify' | 'designer-decides'>('specify');
  const [retouchCount, setRetouchCount] = useState(1);
  const [retouchNotes, setRetouchNotes] = useState('');
  const [urgentProduction, setUrgentProduction] = useState(false);

  // Contact info
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Нова Пошта (відділення або кур\'єр)');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Оплата після затвердження макету (на картку)');

  // UI state
  const [showModal, setShowModal] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');

  // Handle print type change
  const handlePrintTypeChange = (type: 'standard' | 'nonstandard' | 'polaroid') => {
    setPrintType(type);
    const sizes = SIZES[type];
    setPrintSize(sizes[0].size);
    setPricePerPrint(sizes[0].price);
  };

  // Handle size change
  const handleSizeChange = (size: string, price: number) => {
    setPrintSize(size);
    setPricePerPrint(price);
  };

  // Calculate totals
  const totalQuantity = photos.reduce((sum, p) => sum + p.quantity, 0);
  let subtotal = totalQuantity * pricePerPrint;
  if (photoRetouching && retouchChoice === 'specify') subtotal += retouchCount * 7;
  const totalPrice = urgentProduction ? Math.round(subtotal * 1.3) : subtotal;

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({
      file,
      name: file.name,
      preview: URL.createObjectURL(file),
      quantity: 1
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      URL.revokeObjectURL(newPhotos[index].preview);
      newPhotos.splice(index, 1);
      return newPhotos;
    });
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      newPhotos[index].quantity = Math.max(1, quantity);
      return newPhotos;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    const newPhotos = files.map(file => ({
      file,
      name: file.name,
      preview: URL.createObjectURL(file),
      quantity: 1
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const isFormValid = () => {
    return photos.length > 0 && name && phone && email && city;
  };

  const handleCheckoutClick = () => {
    if (photos.length === 0) return;
    setShowModal(true);
  };

  const handleGoToCatalog = () => {
    // Save to sessionStorage
    sessionStorage.setItem('pendingPrintsOrder', JSON.stringify({
      printType,
      printSize,
      pricePerPrint,
      paperFinish,
      whiteBorder,
      photos: photos.map(p => ({ name: p.name, quantity: p.quantity })),
      extras: {
        photoRetouching,
        retouchChoice,
        retouchCount,
        retouchNotes,
        urgentProduction
      },
      totalPrice
    }));
    router.push('/catalog');
  };

  const handleShowContactForm = () => {
    setShowModal(false);
    setShowContactForm(true);
  };

  const handleSubmitOrder = async () => {
    if (!isFormValid()) return;
    setIsSubmitting(true);

    try {
      const orderPayload = {
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        items: photos.map(p => ({
          product_type: 'photo-prints',
          product_name: `Фотодрук ${printSize} см`,
          file_name: p.name,
          quantity: p.quantity,
          unit_price: pricePerPrint,
          total_price: p.quantity * pricePerPrint,
          options: {
            print_type: printType,
            print_size: printSize,
            paper_finish: printType === 'polaroid' ? null : paperFinish,
            white_border: printType === 'standard' ? whiteBorder : null
          }
        })),
        subtotal: totalPrice,
        delivery_cost: 0,
        total: totalPrice,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress || undefined,
        notes: photoRetouching ? `Ретуш: ${retouchChoice === 'specify' ? `${retouchCount} фото - ${retouchNotes}` : 'дизайнер обере'}` : undefined
      };

      const result = await submitOrder(orderPayload);

      if (result.success) {
        sessionStorage.removeItem('pendingPrintsOrder');
        setSubmittedEmail(email);
        setSubmittedPhone(phone);
        setOrderSuccess(true);
        setShowContactForm(false);
      } else {
        alert('Помилка при оформленні замовлення: ' + (result.error || 'Невідома помилка'));
      }
    } catch (error) {
      console.error('Order submission failed:', error);
      alert('Помилка при оформленні замовлення. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
        <Navigation />
        <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '600px', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #86efac', borderRadius: '16px', padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#166534', marginBottom: '12px' }}>
              Замовлення прийнято!
            </h1>
            <p style={{ fontSize: '16px', color: '#15803d', marginBottom: '8px' }}>
              Ми зв'яжемось з вами на <strong>{submittedEmail}</strong> або <strong>{submittedPhone}</strong> протягом 2 годин
            </p>
            <p style={{ fontSize: '14px', color: '#16a34a', marginBottom: '32px' }}>
              Час роботи: пн–пт, 9:00–18:00
            </p>
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '14px 32px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              className="hover:bg-blue-700 transition"
            >
              На головну
            </button>
          </div>
        </main>
        <Footer categories={[]} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
      <Navigation />

      <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {/* Breadcrumbs */}
        <div style={{ fontSize: '14px', color: '#888', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', whiteSpace: 'nowrap' }} className="hover:text-slate-600">Головна</Link>
          <span>→</span>
          <Link href="/catalog" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', whiteSpace: 'nowrap' }} className="hover:text-slate-600">Каталог</Link>
          <span>→</span>
          <span style={{ color: '#263A99', fontWeight: 600 }}>Фотодрук</span>
        </div>

        {/* Product Header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'inline-block', padding: '6px 14px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '9999px', fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
            від {productInfo.startingPrice}
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, marginBottom: '12px', lineHeight: 1.2 }}>
            {productInfo.nameUk}
          </h1>
          <p style={{ fontSize: '18px', color: '#263A99', lineHeight: 1.4, fontWeight: 600, marginBottom: '16px' }}>
            {productInfo.tagline}
          </p>
          <p style={{ fontSize: '16px', color: '#666', lineHeight: 1.6 }}>
            {productInfo.shortDescription}
          </p>
        </div>

        {/* Product Description Section */}
        <div style={{ marginBottom: '48px', padding: '32px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#263A99', marginBottom: '16px' }}>
            Про продукт
          </h2>
          <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.7, marginBottom: '24px' }}>
            {productInfo.fullDescription}
          </p>

          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#263A99', marginBottom: '12px' }}>
            Характеристики:
          </h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '0', listStyle: 'none' }}>
            {productInfo.specs.map((spec, index) => (
              <li key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#475569' }}>
                <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{spec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* STEP 1: Print Type */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>
            Тип фотодруку
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PRINT_TYPES.map((type) => {
              const isSelected = printType === type.key;
              return (
                <button
                  key={type.key}
                  onClick={() => handlePrintTypeChange(type.key as any)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : 'white',
                    color: isSelected ? '#2563eb' : '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '14px'
                  }}
                  className="hover:border-blue-400"
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Size */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>
            Розмір
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SIZES[printType].map((option) => {
              const isSelected = printSize === option.size;
              return (
                <button
                  key={option.size}
                  onClick={() => handleSizeChange(option.size, option.price)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : 'white',
                    color: isSelected ? '#2563eb' : '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  className="hover:border-blue-400"
                >
                  <span>{'label' in option ? option.label : `${option.size} см`}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{option.price} ₴/шт</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 3: Paper Finish (not for polaroid) */}
        {printType !== 'polaroid' && (
          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>
              Поверхня
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="paperFinish"
                  checked={paperFinish === 'matte'}
                  onChange={() => setPaperFinish('matte')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px', fontWeight: 500, color: '#374151' }}>Матові</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="paperFinish"
                  checked={paperFinish === 'glossy'}
                  onChange={() => setPaperFinish('glossy')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px', fontWeight: 500, color: '#374151' }}>Глянцеві</span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 4: White Border (only for standard) */}
        {printType === 'standard' && (
          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>
              Рамка
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="whiteBorder"
                  checked={whiteBorder}
                  onChange={() => setWhiteBorder(true)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px', fontWeight: 500, color: '#374151' }}>З білою рамкою</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="whiteBorder"
                  checked={!whiteBorder}
                  onChange={() => setWhiteBorder(false)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px', fontWeight: 500, color: '#374151' }}>Без білої рамки</span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 5: Upload Photos */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>
            Завантажте фотографії
          </label>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: '#fafafa',
              transition: 'all 0.2s'
            }}
            className="hover:border-blue-400 hover:bg-blue-50"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Upload size={48} className="mx-auto mb-4 text-gray-400" />
            <p style={{ fontWeight: 600, color: '#374151', fontSize: '16px', marginBottom: '8px' }}>
              Перетягніть фото або натисніть для вибору
            </p>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>
              JPG, PNG, HEIC · мінімум 300 dpi · до 200 МБ на файл
            </p>
          </div>

          {photos.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '12px' }}>
                Завантажено: {photos.length} фото
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
                {photos.map((photo, index) => (
                  <div key={index} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', backgroundColor: 'white' }}>
                    <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#f1f5f9', marginBottom: '8px' }}>
                      <Image src={photo.preview} alt={photo.name} fill style={{ objectFit: 'cover' }} />
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        className="hover:bg-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {photo.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>Кількість:</label>
                      <input
                        type="number"
                        min="1"
                        value={photo.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STEP 6: Extra Services */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#263A99' }}>
            Додаткові послуги
          </h3>

          {/* SERVICE 1: Photo Retouching */}
          <div style={{ marginBottom: '16px' }}>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 text-blue-600 rounded"
                checked={photoRetouching}
                onChange={(e) => setPhotoRetouching(e.target.checked)}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Покращення фото (ретуш)</span>
                  <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">+7 ₴ / фото</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Корекція кольору, яскравості та різкості фотографій</p>
              </div>
            </label>

            {photoRetouching && (
              <div style={{ marginTop: '12px', marginLeft: '12px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="retouchChoice"
                      checked={retouchChoice === 'specify'}
                      onChange={() => setRetouchChoice('specify')}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>Я вкажу які фото потребують ретуші</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="retouchChoice"
                      checked={retouchChoice === 'designer-decides'}
                      onChange={() => setRetouchChoice('designer-decides')}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>Дизайнер обере самостійно</span>
                  </label>
                </div>

                {retouchChoice === 'specify' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Вкажіть номери або назви фото:
                      </label>
                      <textarea
                        value={retouchNotes}
                        onChange={(e) => setRetouchNotes(e.target.value)}
                        placeholder="Наприклад: IMG_001.jpg, IMG_005.jpg..."
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Кількість фото для обробки:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={retouchCount}
                        onChange={(e) => setRetouchCount(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                          width: '120px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px'
                        }}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>+7 ₴ за кожне фото</p>
                    </div>
                  </div>
                )}

                {retouchChoice === 'designer-decides' && (
                  <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                    <p style={{ fontSize: '13px', color: '#1e40af', margin: 0, lineHeight: 1.5 }}>
                      Фінальна вартість буде узгоджена з вами перед оплатою.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SERVICE 2: Urgent Production */}
          <div>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 text-blue-600 rounded"
                checked={urgentProduction}
                onChange={(e) => setUrgentProduction(e.target.checked)}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Термінове виготовлення</span>
                  <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">+30%</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Виготовлення за 1–2 робочих дні замість стандартних 4–8</p>
              </div>
            </label>
          </div>
        </div>

        {/* STEP 7: Price Summary */}
        <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
            <span>{totalQuantity} відбитків × {pricePerPrint} ₴</span>
            <span>{totalQuantity * pricePerPrint} ₴</span>
          </div>

          {photoRetouching && retouchChoice === 'specify' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <span>Ретуш ({retouchCount} фото)</span>
              <span>+{retouchCount * 7} ₴</span>
            </div>
          )}

          {photoRetouching && retouchChoice === 'designer-decides' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <span>Ретуш фото</span>
              <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>уточнюється</span>
            </div>
          )}

          {urgentProduction && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <span>Термінове виготовлення (+30%)</span>
              <span>+{Math.round(subtotal * 0.3)} ₴</span>
            </div>
          )}

          <div style={{ borderTop: '1px solid #cbd5e1', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#263A99', fontSize: '18px' }}>
            <span>Разом</span>
            <span>{totalPrice} ₴</span>
          </div>
        </div>

        {/* STEP 8: Action Button */}
        {!showContactForm && (
          <button
            onClick={handleCheckoutClick}
            disabled={photos.length === 0}
            style={{
              width: '100%',
              padding: '18px',
              backgroundColor: photos.length > 0 ? '#2563eb' : '#cbd5e1',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 700,
              cursor: photos.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              marginBottom: '16px'
            }}
            className={photos.length > 0 ? 'hover:bg-blue-700' : ''}
          >
            Перейти до оформлення →
          </button>
        )}

        {/* STEP 9: Contact Form (shown after modal) */}
        {showContactForm && (
          <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#263A99', marginBottom: '20px' }}>
              Контактна інформація
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ім'я та прізвище <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '15px',
                    backgroundColor: 'white'
                  }}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Номер телефону <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380__"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '15px',
                    backgroundColor: 'white'
                  }}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '15px',
                    backgroundColor: 'white'
                  }}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Місто <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '15px',
                    backgroundColor: 'white'
                  }}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Спосіб доставки <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '15px',
                    backgroundColor: 'white'
                  }}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>Нова Пошта (відділення або кур'єр)</option>
                  <option>Укрпошта</option>
                  <option>Самовивіз (м. Тернопіль)</option>
                </select>
              </div>

              {deliveryMethod !== 'Самовивіз (м. Тернопіль)' && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Відділення / адреса
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Відділення №5 або вул. Прикладна, 10"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '15px',
                      backgroundColor: 'white'
                    }}
                    className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Спосіб оплати <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '15px',
                    backgroundColor: 'white'
                  }}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option>Оплата після затвердження макету (на картку)</option>
                  <option>Накладений платіж (+20 ₴)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSubmitOrder}
              disabled={!isFormValid() || isSubmitting}
              style={{
                width: '100%',
                padding: '18px',
                backgroundColor: isFormValid() && !isSubmitting ? '#2563eb' : '#cbd5e1',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: 700,
                cursor: isFormValid() && !isSubmitting ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                marginTop: '20px'
              }}
              className={isFormValid() && !isSubmitting ? 'hover:bg-blue-700' : ''}
            >
              {isSubmitting ? 'Обробка...' : 'Надіслати замовлення →'}
            </button>

            {!isFormValid() && (
              <p style={{ fontSize: '13px', color: '#ef4444', textAlign: 'center', marginTop: '12px' }}>
                * Заповніть всі обов'язкові поля
              </p>
            )}
          </div>
        )}

        {/* Delivery Info */}
        <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
            <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '6px' }}>
              <CheckCircle2 size={16} color="#16a34a" />
            </div>
            Швидка та безпечна доставка Новою Поштою
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
            <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '6px' }}>
              <CheckCircle2 size={16} color="#16a34a" />
            </div>
            Оплата при отриманні або онлайн (Apple Pay/Google Pay)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
            <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '6px' }}>
              <CheckCircle2 size={16} color="#16a34a" />
            </div>
            Швидке виготовлення 2–3 робочих дні
          </div>
        </div>
      </main>

      {/* Pre-checkout Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px'
          }}
        >
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
              Бажаєте додати щось ще до замовлення?
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
              Ви можете обрати інші товари в каталозі
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleGoToCatalog}
                style={{
                  width: '100%',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontWeight: 600,
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '15px'
                }}
                className="hover:bg-blue-700 transition"
              >
                Так, перейти до каталогу
              </button>
              <button
                onClick={handleShowContactForm}
                style={{
                  width: '100%',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontWeight: 600,
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                  fontSize: '15px'
                }}
                className="hover:bg-gray-50 transition"
              >
                Ні, оформити замовлення
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer categories={[]} />
    </div>
  );
}
