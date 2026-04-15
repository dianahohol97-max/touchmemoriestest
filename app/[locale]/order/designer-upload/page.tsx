'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, Suspense } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Upload } from 'lucide-react';
import { submitOrder } from '@/lib/submitOrder';
import Image from 'next/image';

interface MagazineOrder {
  pages: number;
  copies: number;
  basePrice: number;
  extras: {
    textTypesetting: boolean;
    textSource: 'own' | 'write-for-me';
    ownText: string;
    photoRetouching: boolean;
    retouchChoice: 'specify' | 'designer-decides';
    retouchCount: number;
    retouchNotes: string;
    retouchPriceTBD: boolean;
    qrCode: boolean;
    qrLink: string;
    urgentProduction: boolean;
  };
  totalPrice: number;
}

interface PhotoBookOrder {
  coverType: string;
  coverTypeLabel: string;
  size: string;
  pages: number;
  tracingPaper: boolean;
  copies: number;
  basePrice: number;
  extras: {
    photoRetouching: boolean;
    retouchChoice: 'specify' | 'designer-decides';
    retouchCount: number;
    retouchNotes: string;
    retouchPriceTBD: boolean;
    qrCode: boolean;
    qrLink: string;
    urgentProduction: boolean;
    textTypesetting: boolean;
    textSource: 'own' | 'write-for-me';
    ownText: string;
  };
  totalPrice: number;
}

interface PendingOrder extends MagazineOrder {
  name: string;
  phone: string;
  email: string;
  city: string;
  deliveryMethod: string;
  deliveryAddress: string;
  paymentMethod: string;
  designerNotes: string;
  photos: { file: File; preview: string }[];
}

function DesignerUploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orderType = searchParams.get('type'); // 'photobook' or null (magazine)

  // Order data from product page
  const [orderData, setOrderData] = useState<MagazineOrder | PhotoBookOrder | null>(null);
  const [isPhotoBook, setIsPhotoBook] = useState(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);

  // Form state
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

  // Service 1: Text typesetting
  const [textTypesetting, setTextTypesetting] = useState(false);
  const [textSource, setTextSource] = useState<'own' | 'write-for-me'>('own');
  const [ownText, setOwnText] = useState('');

  // Service 2: Photo retouching
  const [photoRetouching, setPhotoRetouching] = useState(false);
  const [retouchChoice, setRetouchChoice] = useState<'specify' | 'designer-decides'>('specify');
  const [retouchCount, setRetouchCount] = useState(1);
  const [retouchNotes, setRetouchNotes] = useState('');

  // Service 3: QR code
  const [qrCode, setQrCode] = useState(false);
  const [qrLink, setQrLink] = useState('');
  const [qrLinkError, setQrLinkError] = useState('');

  // Service 4: Urgent production
  const [urgentProduction, setUrgentProduction] = useState(false);

  const [designerNotes, setDesignerNotes] = useState('');

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');

  // Validate QR link
  const validateQrLink = (link: string) => {
    if (!link) {
      setQrLinkError('');
      return true;
    }
    if (link.startsWith('http://') || link.startsWith('https://')) {
      setQrLinkError('');
      return true;
    }
    setQrLinkError('Введіть коректне посилання, наприклад: https://yoursite.com');
    return false;
  };

  // Load order data on mount
  useEffect(() => {
    // First check for pending order (from catalog return)
    const pendingOrderStr = sessionStorage.getItem('pendingOrder');
    if (pendingOrderStr) {
      try {
        const pendingOrder: PendingOrder = JSON.parse(pendingOrderStr);

        // Restore order data
        setOrderData({
          pages: pendingOrder.pages,
          copies: pendingOrder.copies,
          basePrice: pendingOrder.basePrice,
          extras: pendingOrder.extras,
          totalPrice: pendingOrder.totalPrice
        });

        // Restore extras
        setTextTypesetting(pendingOrder.extras.textTypesetting);
        setTextSource(pendingOrder.extras.textSource);
        setOwnText(pendingOrder.extras.ownText);
        setPhotoRetouching(pendingOrder.extras.photoRetouching);
        setRetouchChoice(pendingOrder.extras.retouchChoice);
        setRetouchCount(pendingOrder.extras.retouchCount);
        setRetouchNotes(pendingOrder.extras.retouchNotes);
        setQrCode(pendingOrder.extras.qrCode);
        setQrLink(pendingOrder.extras.qrLink);
        setUrgentProduction(pendingOrder.extras.urgentProduction);

        // Restore contact info
        setName(pendingOrder.name);
        setPhone(pendingOrder.phone);
        setEmail(pendingOrder.email);
        setCity(pendingOrder.city);
        setDeliveryMethod(pendingOrder.deliveryMethod);
        setDeliveryAddress(pendingOrder.deliveryAddress);
        setPaymentMethod(pendingOrder.paymentMethod);
        setDesignerNotes(pendingOrder.designerNotes);

        setShowRestoredBanner(true);
        sessionStorage.removeItem('pendingOrder');
      } catch (e: any) {
        console.error('Failed to restore pending order', e);
      }
    } else {
      // Check for photobook order
      if (orderType === 'photobook') {
        const photoBookOrderStr = sessionStorage.getItem('photoBookOrder');
        if (photoBookOrderStr) {
          try {
            const photoBookOrder: PhotoBookOrder = JSON.parse(photoBookOrderStr);
            setOrderData(photoBookOrder);
            setIsPhotoBook(true);

            // Pre-fill extras from order
            setPhotoRetouching(photoBookOrder.extras.photoRetouching);
            setRetouchChoice(photoBookOrder.extras.retouchChoice);
            setRetouchCount(photoBookOrder.extras.retouchCount);
            setRetouchNotes(photoBookOrder.extras.retouchNotes);
            setQrCode(photoBookOrder.extras.qrCode);
            setQrLink(photoBookOrder.extras.qrLink);
            setUrgentProduction(photoBookOrder.extras.urgentProduction);
            setTextTypesetting(photoBookOrder.extras.textTypesetting);
            setTextSource(photoBookOrder.extras.textSource);
            setOwnText(photoBookOrder.extras.ownText);
          } catch (e: any) {
            console.error('Failed to load photobook order', e);
          }
        }
      } else {
        // Otherwise check for magazine order from product page
        const magazineOrderStr = sessionStorage.getItem('magazineOrder');
        if (magazineOrderStr) {
          try {
            const magazineOrder: MagazineOrder = JSON.parse(magazineOrderStr);
            setOrderData(magazineOrder);
            setIsPhotoBook(false);

            // Pre-fill extras from order
            setTextTypesetting(magazineOrder.extras.textTypesetting);
            setTextSource(magazineOrder.extras.textSource);
            setOwnText(magazineOrder.extras.ownText);
            setPhotoRetouching(magazineOrder.extras.photoRetouching);
            setRetouchChoice(magazineOrder.extras.retouchChoice);
            setRetouchCount(magazineOrder.extras.retouchCount);
            setRetouchNotes(magazineOrder.extras.retouchNotes);
            setQrCode(magazineOrder.extras.qrCode);
            setQrLink(magazineOrder.extras.qrLink);
            setUrgentProduction(magazineOrder.extras.urgentProduction);
          } catch (e: any) {
            console.error('Failed to load magazine order', e);
          }
        }
      }
    }
  }, [orderType]);

  // Recalculate total price when extras change
  const calculateTotalPrice = () => {
    if (!orderData) return 0;

    let subtotal = orderData.basePrice * orderData.copies;
    if (textTypesetting) subtotal += 175;
    if (photoRetouching && retouchChoice === 'specify') subtotal += retouchCount * 7;
    if (qrCode) subtotal += 50;
    return urgentProduction ? Math.round(subtotal * 1.3) : subtotal;
  };

  const totalPrice = calculateTotalPrice();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 50) {
      alert('Максимум 50 фото');
      return;
    }

    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file as Blob)
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = (Array.from(e.dataTransfer.files) as File[]).filter((f: File) => f.type.startsWith('image/'));
    if (files.length + photos.length > 50) {
      alert('Максимум 50 фото');
      return;
    }

    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file as Blob)
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const isFormValid = () => {
    return photos.length > 0 && name && phone && email && city;
  };

  const handleCheckoutClick = () => {
    if (!isFormValid()) return;

    // Validate QR link if QR code is selected
    if (qrCode && !validateQrLink(qrLink)) {
      return;
    }

    setShowModal(true);
  };

  const handleGoToCatalog = () => {
    // Save full form state
    const pendingOrder: PendingOrder = {
      pages: orderData?.pages || 20,
      copies: orderData?.copies || 1,
      basePrice: orderData?.basePrice || 0,
      extras: {
        textTypesetting,
        textSource,
        ownText,
        photoRetouching,
        retouchChoice,
        retouchCount: retouchChoice === 'specify' ? retouchCount : 0,
        retouchNotes,
        retouchPriceTBD: retouchChoice === 'designer-decides',
        qrCode,
        qrLink,
        urgentProduction
      },
      totalPrice,
      name,
      phone,
      email,
      city,
      deliveryMethod,
      deliveryAddress,
      paymentMethod,
      designerNotes,
      photos: [] // Can't save File objects
    };

    sessionStorage.setItem('pendingOrder', JSON.stringify(pendingOrder));
    router.push('/catalog');
  };

  const handleFinalizeOrder = async () => {
    setShowModal(false);
    setIsSubmitting(true);

    try {
      // Prepare order data based on product type
      let orderItem;

      if (isPhotoBook) {
        const photoBookData = orderData as PhotoBookOrder;
        orderItem = {
          product_type: 'photobook',
          product_name: `Фотокнига з ${photoBookData.coverTypeLabel} обкладинкою`,
          cover_type: photoBookData.coverType,
          format: photoBookData.size,
          pages: photoBookData.pages,
          quantity: photoBookData.copies,
          unit_price: totalPrice,
          total_price: totalPrice,
          options: {
            tracingPaper: photoBookData.tracingPaper,
            photoRetouching,
            retouchChoice,
            retouchCount: retouchChoice === 'specify' ? retouchCount : 0,
            retouchNotes,
            retouchPriceTBD: retouchChoice === 'designer-decides',
            qrCode,
            qrLink: qrCode ? qrLink : '',
            urgentProduction,
            textTypesetting,
            textSource,
            ownText,
            photosCount: photos.length
          }
        };
      } else {
        orderItem = {
          product_type: 'magazine-a4',
          product_name: 'Глянцевий журнал A4',
          pages: orderData?.pages || 20,
          quantity: orderData?.copies || 1,
          unit_price: totalPrice,
          total_price: totalPrice,
          options: {
            textTypesetting,
            textSource,
            ownText,
            photoRetouching,
            retouchChoice,
            retouchCount: retouchChoice === 'specify' ? retouchCount : 0,
            retouchNotes,
            retouchPriceTBD: retouchChoice === 'designer-decides',
            qrCode,
            qrLink: qrCode ? qrLink : '',
            urgentProduction,
            photosCount: photos.length
          }
        };
      }

      const orderPayload = {
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        items: [orderItem],
        subtotal: totalPrice,
        delivery_cost: 0,
        total: totalPrice,
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress || undefined,
        notes: designerNotes || undefined
      };

      const result = await submitOrder(orderPayload);

      if (result.success) {
        sessionStorage.removeItem('magazineOrder');
        sessionStorage.removeItem('photoBookOrder');
        sessionStorage.removeItem('pendingOrder');
        setSubmittedEmail(email);
        setSubmittedPhone(phone);
        setOrderSuccess(true);
      } else {
        alert('Помилка при оформленні замовлення: ' + (result.error || 'Невідома помилка'));
      }
    } catch (error: any) {
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
            <div style={{ fontSize: '64px', marginBottom: '16px' }}></div>
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
        {/* Restored banner */}
        {showRestoredBanner && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}></span>
            <p style={{ fontSize: '14px', color: '#166534', margin: 0 }}>
              Ваші дані збережені. Додайте нові товари або оформіть замовлення.
            </p>
          </div>
        )}

        {/* Page Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, marginBottom: '12px', lineHeight: 1.2 }}>
            {isPhotoBook ? 'Замовлення фотокниги з дизайнером' : 'Замовлення журналу з дизайнером'}
          </h1>
          <p style={{ fontSize: '16px', color: '#666', lineHeight: 1.6 }}>
            Завантажте фотографії та опишіть побажання — ми зробимо все інше
          </p>
        </div>

        {/* Order Summary */}
        {orderData && (
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e40af', marginBottom: '12px' }}>
              Ваше замовлення
            </h3>
            {isPhotoBook ? (
              <>
                <p style={{ fontSize: '15px', color: '#1e3a8a', marginBottom: '8px' }}>
                  <strong>Фотокнига з {(orderData as PhotoBookOrder).coverTypeLabel} обкладинкою</strong>
                </p>
                <p style={{ fontSize: '14px', color: '#1e3a8a', marginBottom: '8px' }}>
                  {(orderData as PhotoBookOrder).size} см, {orderData.pages} стор., {orderData.copies} шт.
                </p>
                {(orderData as PhotoBookOrder).tracingPaper && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ Калька перед першою сторінкою <em style={{ fontStyle: 'italic', color: '#94a3b8' }}>(ціна уточнюється)</em></p>}
                {photoRetouching && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ Ретуш ({retouchChoice === 'specify' ? `${retouchCount} фото` : 'дизайнер обере'})</p>}
                {qrCode && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ QR-код на обкладинці</p>}
                {urgentProduction && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ Термінове виготовлення</p>}
                {textTypesetting && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ Верстка тексту ({textSource === 'own' ? 'з вашим текстом' : 'дизайнер напише'})</p>}
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#1e40af', marginTop: '12px' }}>
                  Разом: ~{totalPrice} ₴
                </p>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
                  Точна ціна буде підтверджена менеджером
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '15px', color: '#1e3a8a', marginBottom: '8px' }}>
                  <strong>Журнал A4, {orderData.pages} стор. × {orderData.copies} шт.</strong>
                </p>
                {textTypesetting && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ Верстка тексту ({textSource === 'own' ? 'з вашим текстом' : 'дизайнер напише'})</p>}
                {photoRetouching && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ Ретуш ({retouchChoice === 'specify' ? `${retouchCount} фото` : 'дизайнер обере'})</p>}
                {qrCode && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ QR-код на обкладинці</p>}
                {urgentProduction && <p style={{ fontSize: '14px', color: '#3b82f6', marginBottom: '4px' }}>+ Термінове виготовлення</p>}
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#1e40af', marginTop: '12px' }}>
                  Разом: {retouchChoice === 'designer-decides' && photoRetouching ? `${totalPrice}+ ₴ (+ ретуш)` : `${totalPrice} ₴`}
                </p>
              </>
            )}
          </div>
        )}

        {/* STEP 1: Upload Photos */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#263A99', marginBottom: '16px' }}>
            1. Завантажте фотографії
          </h2>

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
              Перетягніть фото сюди або натисніть для вибору
            </p>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>
              JPG, PNG, HEIC · мінімум 300 dpi · до 200 МБ на файл · максимум 50 фото
            </p>
          </div>

          {photos.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#263A99', marginBottom: '12px' }}>
                Завантажено: {photos.length} фото
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                {photos.map((photo, index) => (
                  <div key={index} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                    <Image src={photo.preview} alt={`Photo ${index + 1}`} fill style={{ objectFit: 'cover' }} />
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
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STEP 2: Extra Services */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#263A99', marginBottom: '16px' }}>
            2. Додаткові послуги
          </h2>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
            {/* SERVICE 1: Text Typesetting */}
            <div style={{ marginBottom: '16px' }}>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                  checked={textTypesetting}
                  onChange={(e) => setTextTypesetting(e.target.checked)}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">Верстка тексту</span>
                    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">+175 ₴</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">Наш дизайнер додасть та відформатує текст у вашому журналі</p>
                </div>
              </label>

              {textTypesetting && (
                <div style={{ marginTop: '12px', marginLeft: '12px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="textSource"
                        checked={textSource === 'own'}
                        onChange={() => setTextSource('own')}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>У мене є готовий текст</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="textSource"
                        checked={textSource === 'write-for-me'}
                        onChange={() => setTextSource('write-for-me')}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>Напишіть текст для нас</span>
                    </label>
                  </div>

                  {textSource === 'own' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Вставте ваш текст:
                      </label>
                      <textarea
                        value={ownText}
                        onChange={(e) => setOwnText(e.target.value)}
                        placeholder="Введіть або вставте текст, який потрібно розмістити у журналі..."
                        rows={4}
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
                  )}

                  {textSource === 'write-for-me' && (
                    <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                      <p style={{ fontSize: '13px', color: '#1e40af', margin: 0 }}>
                        Наш дизайнер напише текст для вашого журналу. Опишіть тему та побажання в полі нижче.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SERVICE 2: Photo Retouching */}
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
                          Вкажіть номери або назви фото для ретуші:
                        </label>
                        <textarea
                          value={retouchNotes}
                          onChange={(e) => setRetouchNotes(e.target.value)}
                          placeholder="Наприклад: фото 3, 7, 12 — або опишіть які саме..."
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
                        Наш дизайнер самостійно огляне всі ваші фотографії та покращить ті, що цього потребують. Фінальна вартість буде узгоджена з вами перед оплатою.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SERVICE 3: QR Code */}
            <div style={{ marginBottom: '16px' }}>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                  checked={qrCode}
                  onChange={(e) => setQrCode(e.target.checked)}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">QR-код на обкладинці</span>
                    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">+50 ₴</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">Посилання на відео, музику або сайт у вигляді QR-коду</p>
                </div>
              </label>

              {qrCode && (
                <div style={{ marginTop: '12px', marginLeft: '12px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Посилання для QR-коду:
                  </label>
                  <input
                    type="url"
                    value={qrLink}
                    onChange={(e) => {
                      setQrLink(e.target.value);
                      validateQrLink(e.target.value);
                    }}
                    placeholder="https://..."
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: qrLinkError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '14px'
                    }}
                    className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {qrLinkError && (
                    <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{qrLinkError}</p>
                  )}
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    QR-код можна прив'язати до відео, пісні, сайту або будь-якого посилання
                  </p>
                </div>
              )}
            </div>

            {/* SERVICE 4: Urgent Production */}
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
        </div>

        {/* STEP 3: Designer Instructions */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#263A99', marginBottom: '16px' }}>
            3. Інструкції для дизайнера
          </h2>
          <textarea
            value={designerNotes}
            onChange={(e) => setDesignerNotes(e.target.value)}
            placeholder="Опишіть стиль журналу, порядок фотографій, тексти для верстки, кольорову гаму та будь-які інші побажання..."
            rows={5}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              fontSize: '15px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
            className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* STEP 4: Contact Information */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#263A99', marginBottom: '16px' }}>
            4. Контактна інформація
          </h2>

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
                  fontSize: '15px'
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
                  fontSize: '15px'
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
                  fontSize: '15px'
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
                  fontSize: '15px'
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
                    fontSize: '15px'
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
        </div>

        {/* Submit Button */}
        <button
          onClick={handleCheckoutClick}
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
            transition: 'all 0.2s'
          }}
          className={isFormValid() && !isSubmitting ? 'hover:bg-blue-700' : ''}
        >
          {isSubmitting ? 'Обробка...' : 'Перейти до оформлення →'}
        </button>

        {!isFormValid() && (
          <p style={{ fontSize: '13px', color: '#ef4444', textAlign: 'center', marginTop: '12px' }}>
            * Заповніть всі обов'язкові поля та завантажте хоча б одне фото
          </p>
        )}
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
                onClick={handleFinalizeOrder}
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

export default function DesignerUploadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"/></div>}>
      <DesignerUploadContent />
    </Suspense>
  );
}
