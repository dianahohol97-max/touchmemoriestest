'use client';

import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function OrderPage() {
  const searchParams = useSearchParams();
  const productSlug = searchParams.get('product');
  const productSize = searchParams.get('size');
  const productPages = searchParams.get('pages');

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Step 1: Photo upload method
  const [photoMethod, setPhotoMethod] = useState<'telegram' | 'instagram' | 'email' | ''>('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Step 2: Comment
  const [orderComment, setOrderComment] = useState('');
  const [trustDesigner, setTrustDesigner] = useState(false);

  // Step 3: Delivery
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'novaposhta' | 'ukrposhta' | 'international' | ''>('');
  const [npCity, setNpCity] = useState('');
  const [npBranch, setNpBranch] = useState('');
  const [ukrposhtaIndex, setUkrposhtaIndex] = useState('');
  const [ukrposhtaAddress, setUkrposhtaAddress] = useState('');
  const [intlCountry, setIntlCountry] = useState('');
  const [intlPostalCode, setIntlPostalCode] = useState('');
  const [intlAddress, setIntlAddress] = useState('');

  // Step 4: Contact info
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [preferredContact, setPreferredContact] = useState<'telegram' | 'viber' | 'whatsapp' | 'call'>('telegram');

  const steps = [
    { number: 1, label: 'Фото' },
    { number: 2, label: 'Коментар' },
    { number: 3, label: 'Доставка' },
    { number: 4, label: 'Контакти' },
    { number: 5, label: 'Підтвердження' }
  ];

  const canProceedStep1 = photoMethod !== '';
  const canProceedStep2 = true; // Comment is optional
  const canProceedStep3 = deliveryMethod !== '' && (
    deliveryMethod === 'pickup' ||
    (deliveryMethod === 'novaposhta' && npCity && npBranch) ||
    (deliveryMethod === 'ukrposhta' && ukrposhtaIndex && ukrposhtaAddress) ||
    (deliveryMethod === 'international' && intlCountry && intlPostalCode && intlAddress)
  );
  const canProceedStep4 = contactName.trim() !== '' && contactPhone.trim().length >= 10;

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    const orderData = {
      product: {
        slug: productSlug,
        size: productSize,
        pages: productPages
      },
      photoMethod,
      customerEmail: photoMethod === 'email' ? customerEmail : undefined,
      comment: trustDesigner ? 'Довіряю вибір дизайну дизайнеру' : orderComment,
      delivery: {
        method: deliveryMethod,
        ...(deliveryMethod === 'novaposhta' && { city: npCity, branch: npBranch }),
        ...(deliveryMethod === 'ukrposhta' && { index: ukrposhtaIndex, address: ukrposhtaAddress }),
        ...(deliveryMethod === 'international' && { country: intlCountry, postalCode: intlPostalCode, address: intlAddress })
      },
      contact: {
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
        preferredMethod: preferredContact
      }
    };

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        setIsSubmitted(true);
        window.scrollTo(0, 0);
      }
    } catch (error) {
      console.error('Order submission failed:', error);
      alert('Помилка при відправці заявки. Спробуйте ще раз.');
    }
  };

  if (isSubmitted) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
        <Navigation />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div style={{ maxWidth: '500px', width: '100%', backgroundColor: 'white', padding: '48px 32px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={32} color="#16a34a" strokeWidth={2.5} />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e2d7d', marginBottom: '16px' }}>
              Дякуємо! Заявку отримано.
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: '1.6', marginBottom: '32px' }}>
              Наш менеджер зв'яжеться з вами протягом 2–4 годин у робочий час (пн–сб, 9:00–20:00).
            </p>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                backgroundColor: '#1e2d7d',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '16px',
                transition: 'background-color 0.2s'
              }}
              className="hover:bg-[#263a99]"
            >
              На головну
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
      <Navigation />

      <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#1e2d7d', marginBottom: '12px', textAlign: 'center' }}>
          Оформлення замовлення з дизайнером
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '40px', textAlign: 'center' }}>
          Заповніть форму, і наш дизайнер підготує для вас індивідуальний макет
        </p>

        {/* Product info if provided */}
        {productSlug && (
          <div style={{ padding: '16px', backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '8px', marginBottom: '32px' }}>
            <p style={{ fontSize: '14px', color: '#1e40af', fontWeight: 600 }}>
              Продукт: {productSlug}
              {productSize && ` • Розмір: ${productSize}`}
              {productPages && ` • Сторінок: ${productPages}`}
            </p>
          </div>
        )}

        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
          {steps.map((step, index) => (
            <div key={step.number} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1 }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: step.number < currentStep ? '#1e2d7d' : step.number === currentStep ? '#1e2d7d' : '#e5e7eb',
                  color: step.number <= currentStep ? 'white' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '16px',
                  marginBottom: '8px',
                  position: 'relative',
                  zIndex: 2
                }}
              >
                {step.number < currentStep ? <CheckCircle2 size={20} strokeWidth={3} /> : step.number}
              </div>
              <span style={{ fontSize: '12px', color: step.number === currentStep ? '#1e2d7d' : '#6b7280', fontWeight: step.number === currentStep ? 600 : 400, textAlign: 'center' }}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    width: '100%',
                    height: '2px',
                    backgroundColor: step.number < currentStep ? '#1e2d7d' : '#e5e7eb',
                    zIndex: 1
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

          {/* STEP 1: Photo Upload Method */}
          {currentStep === 1 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                Крок 1: Завантажте ваші фотографії
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
                Ми приймаємо фото через зручний для вас канал. Виберіть спосіб:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {/* Telegram Option */}
                <label
                  style={{
                    padding: '16px',
                    border: `2px solid ${photoMethod === 'telegram' ? '#1e2d7d' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: photoMethod === 'telegram' ? '#f0f3ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="photoMethod"
                    value="telegram"
                    checked={photoMethod === 'telegram'}
                    onChange={(e) => setPhotoMethod(e.target.value as 'telegram')}
                    style={{ marginRight: '12px' }}
                  />
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>Telegram</span>
                  <span style={{ fontSize: '14px', color: '#6b7280', display: 'block', marginLeft: '28px', marginTop: '4px' }}>
                    Надішліть фото у наш Telegram{' '}
                    <a href="https://t.me/touchmemories" target="_blank" rel="noopener noreferrer" style={{ color: '#1e2d7d', textDecoration: 'underline' }}>
                      @touchmemories
                    </a>
                  </span>
                </label>

                {/* Instagram Option */}
                <label
                  style={{
                    padding: '16px',
                    border: `2px solid ${photoMethod === 'instagram' ? '#1e2d7d' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: photoMethod === 'instagram' ? '#f0f3ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="photoMethod"
                    value="instagram"
                    checked={photoMethod === 'instagram'}
                    onChange={(e) => setPhotoMethod(e.target.value as 'instagram')}
                    style={{ marginRight: '12px' }}
                  />
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>Instagram</span>
                  <span style={{ fontSize: '14px', color: '#6b7280', display: 'block', marginLeft: '28px', marginTop: '4px' }}>
                    Надішліть фото у Direct Instagram{' '}
                    <a href="https://instagram.com/touch.memories" target="_blank" rel="noopener noreferrer" style={{ color: '#1e2d7d', textDecoration: 'underline' }}>
                      @touch.memories
                    </a>
                  </span>
                </label>

                {/* Email Option */}
                <label
                  style={{
                    padding: '16px',
                    border: `2px solid ${photoMethod === 'email' ? '#1e2d7d' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: photoMethod === 'email' ? '#f0f3ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="photoMethod"
                    value="email"
                    checked={photoMethod === 'email'}
                    onChange={(e) => setPhotoMethod(e.target.value as 'email')}
                    style={{ marginRight: '12px' }}
                  />
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>Email</span>
                  <span style={{ fontSize: '14px', color: '#6b7280', display: 'block', marginLeft: '28px', marginTop: '4px' }}>
                    Надішліть фото на touch.memories3@gmail.com
                  </span>
                  {photoMethod === 'email' && (
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Ваша email адреса для зворотного зв'язку"
                      style={{
                        marginTop: '12px',
                        marginLeft: '28px',
                        width: 'calc(100% - 28px)',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      className="focus:border-[#1e2d7d] focus:outline-none"
                    />
                  )}
                </label>
              </div>

              <p style={{ fontSize: '13px', color: '#6b7280', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', lineHeight: '1.5' }}>
                Мінімальна роздільна здатність фото: 300 dpi. Якщо маєте питання щодо підготовки фото — запитайте менеджера.
              </p>
            </div>
          )}

          {/* STEP 2: Order Comment */}
          {currentStep === 2 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                Крок 2: Коментар до замовлення
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
                Розкажіть нам про ваше замовлення — що важливо, які побажання є до дизайну.
              </p>

              <textarea
                value={orderComment}
                onChange={(e) => setOrderComment(e.target.value)}
                disabled={trustDesigner}
                placeholder="Наприклад: весільна фотокнига, стиль мінімалізм, основна тема — природа, хочу щоб перший розворот був з портретом нареченої..."
                rows={6}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  opacity: trustDesigner ? 0.5 : 1
                }}
                className="focus:border-[#1e2d7d] focus:outline-none"
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                  {orderComment.length} символів
                </span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={trustDesigner}
                  onChange={(e) => setTrustDesigner(e.target.checked)}
                  style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  Я довіряю вибір дизайну дизайнеру (без коментарів)
                </span>
              </label>
            </div>
          )}

          {/* STEP 3: Delivery Details */}
          {currentStep === 3 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                Крок 3: Деталі доставки
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
                Оберіть спосіб доставки
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {/* Pickup */}
                <label
                  style={{
                    padding: '16px',
                    border: `2px solid ${deliveryMethod === 'pickup' ? '#1e2d7d' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: deliveryMethod === 'pickup' ? '#f0f3ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value="pickup"
                    checked={deliveryMethod === 'pickup'}
                    onChange={(e) => setDeliveryMethod(e.target.value as 'pickup')}
                    style={{ marginRight: '12px' }}
                  />
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>Самовивіз</span>
                  <span style={{ fontSize: '14px', color: '#6b7280', display: 'block', marginLeft: '28px', marginTop: '4px' }}>
                    Тернопіль, вул. Київська 2. Безкоштовно.
                  </span>
                </label>

                {/* Nova Poshta */}
                <label
                  style={{
                    padding: '16px',
                    border: `2px solid ${deliveryMethod === 'novaposhta' ? '#1e2d7d' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: deliveryMethod === 'novaposhta' ? '#f0f3ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value="novaposhta"
                    checked={deliveryMethod === 'novaposhta'}
                    onChange={(e) => setDeliveryMethod(e.target.value as 'novaposhta')}
                    style={{ marginRight: '12px' }}
                  />
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>Нова Пошта</span>
                  {deliveryMethod === 'novaposhta' && (
                    <div style={{ marginTop: '12px', marginLeft: '28px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        value={npCity}
                        onChange={(e) => setNpCity(e.target.value)}
                        placeholder="Місто"
                        style={{
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          width: '100%'
                        }}
                        className="focus:border-[#1e2d7d] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={npBranch}
                        onChange={(e) => setNpBranch(e.target.value)}
                        placeholder="Відділення НП або адреса"
                        style={{
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          width: '100%'
                        }}
                        className="focus:border-[#1e2d7d] focus:outline-none"
                      />
                    </div>
                  )}
                </label>

                {/* Ukrposhta */}
                <label
                  style={{
                    padding: '16px',
                    border: `2px solid ${deliveryMethod === 'ukrposhta' ? '#1e2d7d' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: deliveryMethod === 'ukrposhta' ? '#f0f3ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value="ukrposhta"
                    checked={deliveryMethod === 'ukrposhta'}
                    onChange={(e) => setDeliveryMethod(e.target.value as 'ukrposhta')}
                    style={{ marginRight: '12px' }}
                  />
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>Укрпошта</span>
                  {deliveryMethod === 'ukrposhta' && (
                    <div style={{ marginTop: '12px', marginLeft: '28px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        value={ukrposhtaIndex}
                        onChange={(e) => setUkrposhtaIndex(e.target.value)}
                        placeholder="Поштовий індекс"
                        style={{
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          width: '100%'
                        }}
                        className="focus:border-[#1e2d7d] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={ukrposhtaAddress}
                        onChange={(e) => setUkrposhtaAddress(e.target.value)}
                        placeholder="Адреса"
                        style={{
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          width: '100%'
                        }}
                        className="focus:border-[#1e2d7d] focus:outline-none"
                      />
                    </div>
                  )}
                </label>

                {/* International */}
                <label
                  style={{
                    padding: '16px',
                    border: `2px solid ${deliveryMethod === 'international' ? '#1e2d7d' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: deliveryMethod === 'international' ? '#f0f3ff' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value="international"
                    checked={deliveryMethod === 'international'}
                    onChange={(e) => setDeliveryMethod(e.target.value as 'international')}
                    style={{ marginRight: '12px' }}
                  />
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>Міжнародна доставка</span>
                  {deliveryMethod === 'international' && (
                    <div style={{ marginTop: '12px', marginLeft: '28px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        value={intlCountry}
                        onChange={(e) => setIntlCountry(e.target.value)}
                        placeholder="Країна"
                        style={{
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          width: '100%'
                        }}
                        className="focus:border-[#1e2d7d] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={intlPostalCode}
                        onChange={(e) => setIntlPostalCode(e.target.value)}
                        placeholder="Поштовий індекс"
                        style={{
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          width: '100%'
                        }}
                        className="focus:border-[#1e2d7d] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={intlAddress}
                        onChange={(e) => setIntlAddress(e.target.value)}
                        placeholder="Адреса"
                        style={{
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          width: '100%'
                        }}
                        className="focus:border-[#1e2d7d] focus:outline-none"
                      />
                    </div>
                  )}
                </label>
              </div>

              <p style={{ fontSize: '13px', color: '#6b7280', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                Вартість та терміни доставки залежать від перевізника та регіону.
              </p>
            </div>
          )}

          {/* STEP 4: Contact Info */}
          {currentStep === 4 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                Крок 4: Ваші контактні дані
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
                Як з вами зв'язатися?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Ім'я <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ваше ім'я"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    className="focus:border-[#1e2d7d] focus:outline-none"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Телефон <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+380..."
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    className="focus:border-[#1e2d7d] focus:outline-none"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Email (необов'язково)
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="email@example.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    className="focus:border-[#1e2d7d] focus:outline-none"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
                    Зручний спосіб зв'язку
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {(['telegram', 'viber', 'whatsapp', 'call'] as const).map((method) => (
                      <label
                        key={method}
                        style={{
                          padding: '12px',
                          border: `2px solid ${preferredContact === method ? '#1e2d7d' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          backgroundColor: preferredContact === method ? '#f0f3ff' : 'white',
                          fontWeight: 600,
                          fontSize: '14px',
                          color: '#1f2937',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="radio"
                          name="preferredContact"
                          value={method}
                          checked={preferredContact === method}
                          onChange={(e) => setPreferredContact(e.target.value as typeof method)}
                          style={{ display: 'none' }}
                        />
                        {method === 'telegram' && 'Telegram'}
                        {method === 'viber' && 'Viber'}
                        {method === 'whatsapp' && 'WhatsApp'}
                        {method === 'call' && 'Дзвінок'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Confirmation */}
          {currentStep === 5 && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                Крок 5: Оплата та підтвердження
              </h2>

              <div style={{ padding: '16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: '#1e40af', lineHeight: '1.6', marginBottom: '8px' }}>
                  Ми працюємо тільки за передоплатою, оскільки кожне замовлення є індивідуальним.
                </p>
                <p style={{ fontSize: '14px', color: '#1e40af', lineHeight: '1.6' }}>
                  Оплата на рахунок ФОП у Monobank. Реквізити надсилаються менеджером після підтвердження замовлення.
                </p>
              </div>

              <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '12px' }}>
                  Підсумок замовлення:
                </h3>
                <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.8' }}>
                  <p><strong>Спосіб завантаження фото:</strong> {photoMethod === 'telegram' ? 'Telegram' : photoMethod === 'instagram' ? 'Instagram' : 'Email'}</p>
                  <p><strong>Доставка:</strong> {deliveryMethod === 'pickup' ? 'Самовивіз (Тернопіль)' : deliveryMethod === 'novaposhta' ? `Нова Пошта (${npCity}, ${npBranch})` : deliveryMethod === 'ukrposhta' ? 'Укрпошта' : 'Міжнародна доставка'}</p>
                  <p><strong>Контакт:</strong> {contactName}, {contactPhone}</p>
                  {orderComment && !trustDesigner && (
                    <p><strong>Коментар:</strong> {orderComment.substring(0, 100)}{orderComment.length > 100 ? '...' : ''}</p>
                  )}
                  {trustDesigner && (
                    <p><strong>Коментар:</strong> Довіряю вибір дизайну дизайнеру</p>
                  )}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#1e2d7d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                className="hover:bg-[#263a99]"
              >
                Надіслати заявку
              </button>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                style={{
                  padding: '12px 24px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s'
                }}
                className="hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
                Назад
              </button>
            )}

            {currentStep < 5 && (
              <button
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !canProceedStep1) ||
                  (currentStep === 3 && !canProceedStep3) ||
                  (currentStep === 4 && !canProceedStep4)
                }
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#1e2d7d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginLeft: 'auto',
                  opacity: (currentStep === 1 && !canProceedStep1) || (currentStep === 3 && !canProceedStep3) || (currentStep === 4 && !canProceedStep4) ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
                className="hover:bg-[#263a99]"
              >
                Далі
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
