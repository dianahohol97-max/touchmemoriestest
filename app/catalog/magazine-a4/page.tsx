'use client';
import { useState } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const PAGE_PRICES: Record<number, number> = {
  8: 425, 12: 475, 16: 625, 20: 775, 24: 925, 28: 1075,
  32: 1225, 36: 1375, 40: 1525, 44: 1675, 48: 1825, 52: 1950,
  60: 2150, 72: 2450, 80: 2700, 92: 2850, 100: 3050
};

const PAGE_OPTIONS = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80, 92, 100];

export default function MagazineA4Page() {
  const router = useRouter();

  // Basic options
  const [pages, setPages] = useState(20);
  const [copies, setCopies] = useState(1);

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

  // Calculate prices
  const basePrice = PAGE_PRICES[pages] || 0;

  let subtotal = basePrice * copies;
  if (textTypesetting) subtotal += 175;
  if (photoRetouching && retouchChoice === 'specify') subtotal += retouchCount * 7;
  if (qrCode) subtotal += 50;
  const totalPrice = urgentProduction ? Math.round(subtotal * 1.3) : subtotal;

  const handleConstructor = () => {
    // Save configuration for constructor
    sessionStorage.setItem('constructorConfig', JSON.stringify({
      productType: 'magazine',
      size: 'A4',
      pages,
      totalPrice: basePrice
    }));

    router.push('/constructor/photobook');
  };

  const handleDesigner = () => {
    // Validate QR link if QR code is selected
    if (qrCode && !validateQrLink(qrLink)) {
      return;
    }

    sessionStorage.setItem('magazineOrder', JSON.stringify({
      pages,
      copies,
      basePrice,
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
      totalPrice
    }));
    router.push('/order/designer-upload');
  };

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
          <span style={{ color: '#263A99', fontWeight: 600 }}>Глянцевий журнал A4</span>
        </div>

        {/* Product Header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'inline-block', padding: '6px 14px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '9999px', fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
            від 425 ₴
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 900, marginBottom: '12px', lineHeight: 1.2 }}>
            Глянцевий журнал A4
          </h1>
          <p style={{ fontSize: '16px', color: '#666', lineHeight: 1.6 }}>
            М'яка обкладинка 130г, папір 115г глянець, формат 21×29.7 см
          </p>
        </div>

        {/* Number of Pages Selector */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>
            Кількість сторінок
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {PAGE_OPTIONS.map((pageCount) => {
              const isSelected = pages === pageCount;
              return (
                <button
                  key={pageCount}
                  onClick={() => setPages(pageCount)}
                  style={{
                    padding: '10px 16px',
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
                  {pageCount}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
            Мінімум 8 сторінок
          </p>
        </div>

        {/* Number of Copies */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#263A99' }}>
            Кількість примірників
          </label>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', width: 'fit-content', backgroundColor: 'white' }}>
            <button
              onClick={() => setCopies(Math.max(1, copies - 1))}
              style={{ padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}
              className="hover:bg-slate-50 transition"
            >-</button>
            <span style={{ padding: '0 16px', fontWeight: 800, fontSize: '16px', minWidth: '40px', textAlign: 'center', color: '#263A99' }}>{copies}</span>
            <button
              onClick={() => setCopies(copies + 1)}
              style={{ padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#64748b' }}
              className="hover:bg-slate-50 transition"
            >+</button>
          </div>
        </div>

        {/* Extra Services */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#263A99' }}>
            Додаткові послуги
          </h3>

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

        {/* Price Summary */}
        <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
            <span>Журнал ({pages} стор. × {copies} шт.)</span>
            <span>{basePrice * copies} ₴</span>
          </div>

          {textTypesetting && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <span>Верстка тексту</span>
              <span>+175 ₴</span>
            </div>
          )}

          {photoRetouching && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <span>Ретуш фото</span>
              {retouchChoice === 'specify' ? (
                <span>+{retouchCount * 7} ₴</span>
              ) : (
                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>уточнюється</span>
              )}
            </div>
          )}

          {qrCode && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <span>QR-код на обкладинці</span>
              <span>+50 ₴</span>
            </div>
          )}

          {urgentProduction && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              <span>Термінове (+30%)</span>
              <span>+{Math.round(subtotal * 0.3)} ₴</span>
            </div>
          )}

          <div style={{ borderTop: '1px solid #cbd5e1', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#263A99', fontSize: '18px' }}>
            <span>Разом</span>
            <span>
              {retouchChoice === 'designer-decides' && photoRetouching ? (
                <span>
                  {totalPrice}+ ₴ <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>(+ ретуш)</span>
                </span>
              ) : (
                <span>{totalPrice} ₴</span>
              )}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleConstructor}
              className="flex-1 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-4 rounded-xl text-lg transition-colors"
            >
              Створити у конструкторі
            </button>
            <button
              onClick={handleDesigner}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-lg transition-colors"
            >
              Оформити з дизайнером →
            </button>
          </div>
        </div>

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
            Швидке виготовлення 4–8 робочих днів (або 1–2 з терміновим виготовленням)
          </div>
        </div>
      </main>

      <Footer categories={[]} />
    </div>
  );
}
