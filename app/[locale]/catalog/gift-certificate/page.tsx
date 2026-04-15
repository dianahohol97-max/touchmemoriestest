'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Gift, Mail, Package, Check, Calendar, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/store/cart';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  category_id: string;
}

interface CertificateConfig {
  type: 'money' | 'product';
  amount: number;
  productId: string;
  productName: string;
  productPrice: number;
  format: 'electronic' | 'printed';
  recipientName: string;
  recipientEmail: string;
  message: string;
}

export default function GiftCertificatePage() {
  const router = useRouter();
  const { addItem } = useCartStore();
  const supabase = createClient();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [certificateCode] = useState<string>(() => {
    // Generate preview code — real code assigned by DB on purchase
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TM-${year}-${rand}`;
  });

  const [config, setConfig] = useState<CertificateConfig>({
    type: 'money',
    amount: 500,
    productId: '',
    productName: '',
    productPrice: 0,
    format: 'electronic',
    recipientName: '',
    recipientEmail: '',
    message: '',
  });

  // Fetch products for product certificate option
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, price, category_id')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setProducts(data);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  // Calculate total price
  const totalPrice = useMemo(() => {
    if (config.type === 'money') {
      return config.amount;
    } else {
      return config.productPrice;
    }
  }, [config.type, config.amount, config.productPrice]);

  // Calculate validity date
  const validUntil = useMemo(() => {
    const months = config.type === 'money' ? 12 : 3;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
  }, [config.type]);

  // Handle product selection
  const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProduct = products.find((p) => p.id === e.target.value);
    if (selectedProduct) {
      setConfig({
        ...config,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productPrice: selectedProduct.price,
      });
    }
  };

  // Handle add to cart
  const handleAddToCart = () => {
    if (config.type === 'product' && !config.productId) {
      toast.error('Будь ласка, оберіть продукт');
      return;
    }

    if (config.format === 'electronic' && !config.recipientEmail) {
      toast.error('Будь ласка, вкажіть email отримувача');
      return;
    }

    if (config.type === 'money' && config.amount < 100) {
      toast.error('Мінімальна сума сертифікату: 100 ₴');
      return;
    }

    // Create cart item
    const cartItem = {
      id: `gift-certificate-${Date.now()}`,
      productId: 'gift-certificate',
      name: 'Подарунковий сертифікат',
      price: totalPrice,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&q=80',
      options: {
        'Номер': certificateCode,
        'Тип сертифікату': config.type === 'money' ? `На суму ${config.amount} ₴` : `На продукт: ${config.productName}`,
        'Формат': config.format === 'electronic' ? 'Електронний (PDF)' : 'Друкований',
        'Отримувач': config.recipientName || config.recipientEmail,
        'Термін дії': validUntil,
      },
      metadata: {
        certificateCode,
        certificateType: config.type,
        amount: config.type === 'money' ? config.amount : undefined,
        productId: config.type === 'product' ? config.productId : undefined,
        productName: config.type === 'product' ? config.productName : undefined,
        format: config.format,
        recipientName: config.recipientName,
        recipientEmail: config.recipientEmail,
        message: config.message,
        validityMonths: config.type === 'money' ? 12 : 3,
      },
    };

    addItem(cartItem);
    toast.success('Сертифікат додано до кошика');
    router.push('/cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a8a]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 mb-6">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-light text-stone-900 mb-4">
            Подарунковий сертифікат
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            Ідеальний подарунок для тих, хто цінує спогади. Оберіть грошовий сертифікат або сертифікат на конкретний продукт.
          </p>
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Configuration */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* SECTION A — Certificate Type */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100">
              <h2 className="text-xl font-bold text-stone-900 mb-6">Тип сертифікату</h2>

              {/* Money Certificate */}
              <div
                onClick={() => setConfig({ ...config, type: 'money' })}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all mb-4 ${
                  config.type === 'money'
                    ? 'border-[#1e3a8a] bg-blue-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                      <span className="text-2xl"></span>
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900">На суму</h3>
                      <p className="text-sm text-stone-500">Грошовий сертифікат</p>
                    </div>
                  </div>
                  {config.type === 'money' && (
                    <div className="w-6 h-6 rounded-full bg-[#1e3a8a] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                {config.type === 'money' && (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-sm font-medium text-stone-700 mb-2 block">Сума (₴)</span>
                      <input
                        type="number"
                        min="100"
                        step="50"
                        value={config.amount}
                        onChange={(e) => setConfig({ ...config, amount: parseInt(e.target.value) || 100 })}
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                      />
                    </label>
                    <div className="flex items-center gap-2 text-sm text-stone-600">
                      <Calendar className="w-4 h-4" />
                      <span>Термін дії: 1 рік</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Product Certificate */}
              <div
                onClick={() => setConfig({ ...config, type: 'product' })}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                  config.type === 'product'
                    ? 'border-[#1e3a8a] bg-blue-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                      <span className="text-2xl"></span>
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900">На продукт</h3>
                      <p className="text-sm text-stone-500">Сертифікат на конкретний товар</p>
                    </div>
                  </div>
                  {config.type === 'product' && (
                    <div className="w-6 h-6 rounded-full bg-[#1e3a8a] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                {config.type === 'product' && (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-sm font-medium text-stone-700 mb-2 block">Оберіть продукт</span>
                      <select
                        value={config.productId}
                        onChange={handleProductSelect}
                        className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                      >
                        <option value="">-- Оберіть продукт --</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} — {product.price} ₴
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-center gap-2 text-sm text-stone-600">
                      <Calendar className="w-4 h-4" />
                      <span>Термін дії: 3 місяці</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION B — Format */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100">
              <h2 className="text-xl font-bold text-stone-900 mb-6">Формат доставки</h2>

              {/* Electronic */}
              <div
                onClick={() => setConfig({ ...config, format: 'electronic' })}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all mb-4 ${
                  config.format === 'electronic'
                    ? 'border-[#1e3a8a] bg-blue-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-6 h-6 text-[#1e3a8a]" />
                    <div>
                      <h3 className="font-bold text-stone-900">Електронний</h3>
                      <p className="text-sm text-stone-500">PDF на email, миттєва доставка</p>
                    </div>
                  </div>
                  {config.format === 'electronic' && (
                    <div className="w-6 h-6 rounded-full bg-[#1e3a8a] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* Printed */}
              <div
                onClick={() => setConfig({ ...config, format: 'printed' })}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                  config.format === 'printed'
                    ? 'border-[#1e3a8a] bg-blue-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-6 h-6 text-[#1e3a8a]" />
                    <div>
                      <h3 className="font-bold text-stone-900">Друкований</h3>
                      <p className="text-sm text-stone-500">Преміальний папір, Нова Пошта</p>
                    </div>
                  </div>
                  {config.format === 'printed' && (
                    <div className="w-6 h-6 rounded-full bg-[#1e3a8a] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recipient Information */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100">
              <h2 className="text-xl font-bold text-stone-900 mb-6">Інформація про отримувача</h2>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-stone-700 mb-2 block">Ім'я отримувача (необов'язково)</span>
                  <input
                    type="text"
                    value={config.recipientName}
                    onChange={(e) => setConfig({ ...config, recipientName: e.target.value })}
                    placeholder="Ім'я отримувача"
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  />
                </label>

                {config.format === 'electronic' && (
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700 mb-2 block">Email отримувача *</span>
                    <input
                      type="email"
                      value={config.recipientEmail}
                      onChange={(e) => setConfig({ ...config, recipientEmail: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                      required
                    />
                  </label>
                )}

                <label className="block">
                  <span className="text-sm font-medium text-stone-700 mb-2 block">Подарункове повідомлення (необов'язково)</span>
                  <textarea
                    value={config.message}
                    onChange={(e) => setConfig({ ...config, message: e.target.value })}
                    placeholder="Напишіть особисте повідомлення..."
                    rows={4}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent resize-none"
                  />
                </label>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Preview & Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:sticky lg:top-24 space-y-6"
            style={{ height: 'fit-content' }}
          >
            {/* Certificate Preview */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-stone-100">
              <h2 className="text-base font-bold text-stone-500 mb-4 uppercase tracking-widest">Попередній перегляд</h2>

              {/* Outer wrapper — cream bg like Canva (shows below the blue card) */}
              <div style={{ background: '#F5F0E8', borderRadius: 12, padding: '0 0 16px', overflow: 'visible', position: 'relative' }}>

                {/* Cream pill at top center — sticks out above blue card */}
                <div style={{
                  position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                  width: 72, height: 72, background: '#F5F0E8',
                  borderRadius: '0 0 40px 40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10, paddingTop: 4,
                }}>
                  {/* Gift box icon — blue outline on cream */}
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#2D3DB4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="16" width="30" height="18" rx="1.5"/>
                    <rect x="1" y="10" width="34" height="6" rx="1.5"/>
                    <line x1="18" y1="10" x2="18" y2="34"/>
                    <path d="M18 10C18 10 13 5 9.5 6.5C7 7.5 7 11 9.5 12C12 13 18 10 18 10Z"/>
                    <path d="M18 10C18 10 23 5 26.5 6.5C29 7.5 29 11 26.5 12C24 13 18 10 18 10Z"/>
                  </svg>
                </div>

                {/* Blue certificate card */}
                <div style={{
                  background: '#2D3DB4',
                  borderRadius: 10,
                  margin: '0',
                  position: 'relative',
                  overflow: 'hidden',
                  paddingTop: '42px',
                  paddingBottom: '48px',
                  paddingLeft: '20px',
                  paddingRight: '20px',
                }}>
                  {/* Inner white border frame */}
                  <div style={{
                    position: 'absolute', inset: 12,
                    border: '1.5px solid rgba(255,255,255,0.45)',
                    borderRadius: 5, pointerEvents: 'none',
                  }}/>

                  {/* GIFT large serif + certificate italic overlay */}
                  <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      {/* Large GIFT */}
                      <span style={{
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        fontSize: 'clamp(56px, 14vw, 88px)',
                        fontWeight: 900,
                        color: '#ffffff',
                        letterSpacing: '0.08em',
                        display: 'block',
                        lineHeight: 1,
                      }}>GIFT</span>
                      {/* "certificate" cursive across the middle of GIFT */}
                      <span style={{
                        position: 'absolute',
                        top: '38%', left: '50%',
                        transform: 'translateX(-50%) rotate(-3deg)',
                        fontFamily: '"Dancing Script", "Brush Script MT", cursive',
                        fontSize: 'clamp(16px, 4vw, 24px)',
                        fontStyle: 'italic',
                        color: '#0a0f3d',
                        whiteSpace: 'nowrap',
                        fontWeight: 700,
                        letterSpacing: '0.01em',
                      }}>certificate</span>
                    </div>

                    {/* НА ........... ГРН */}
                    <div style={{
                      marginTop: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 'clamp(13px, 2.5vw, 16px)',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                    }}>
                      <span>НА</span>
                      <span style={{
                        borderBottom: '1.5px solid rgba(255,255,255,0.6)',
                        minWidth: 110, textAlign: 'center',
                        paddingBottom: 2, letterSpacing: '0.05em',
                        fontSize: config.type === 'money' && config.amount > 0 ? 'clamp(15px,3vw,18px)' : 'inherit',
                      }}>
                        {config.type === 'money' && config.amount > 0
                          ? config.amount
                          : config.type === 'product' && config.productPrice > 0
                          ? config.productPrice
                          : '·····················'}
                      </span>
                      <span>ГРН</span>
                    </div>

                    {/* дійсний до ........... */}
                    <div style={{
                      marginTop: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: 'clamp(10px, 2vw, 12px)',
                      letterSpacing: '0.18em',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      <span>дійсний до</span>
                      <span style={{ borderBottom: '1px dotted rgba(255,255,255,0.5)', minWidth: 80, textAlign: 'center', paddingBottom: 1 }}>
                        {validUntil}
                      </span>
                    </div>
                  </div>

                  {/* Certificate number — bottom right */}
                  <div style={{
                    position: 'absolute', bottom: 8, right: 18, zIndex: 2,
                    fontFamily: 'monospace', fontSize: 9,
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.12em',
                  }}>
                    {certificateCode}
                  </div>
                </div>

                {/* Footer OUTSIDE blue card — on cream bg like Canva */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  paddingTop: 10,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="#1a1a1a" stroke="none"/>
                  </svg>
                  <span style={{
                    color: '#1a1a1a',
                    fontSize: 10,
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}>TOUCH.MEMORIES</span>
                </div>
              </div>

              {config.format === 'electronic' && (
                <div className="mt-4 flex items-start gap-2 p-4 bg-blue-50 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900">
                    Електронний сертифікат буде надіслано на email <strong>{config.recipientEmail || '(вкажіть email)'}</strong> одразу після оплати
                  </p>
                </div>
              )}

              {config.format === 'printed' && (
                <div className="mt-4 flex items-start gap-2 p-4 bg-amber-50 rounded-lg">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">
                    Друкований сертифікат буде виготовлено на преміальному папері та доставлено Новою Поштою у святковому конверті
                  </p>
                </div>
              )}
            </div>

            {/* Price Summary */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100">
              <h2 className="text-xl font-bold text-stone-900 mb-6">Вартість</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-stone-600">
                  <span>Номінал сертифікату:</span>
                  <span className="font-semibold">{totalPrice} ₴</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Формат:</span>
                  <span className="font-semibold">{config.format === 'electronic' ? 'Електронний' : 'Друкований'}</span>
                </div>
                <div className="border-t border-stone-200 pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold text-stone-900">Всього:</span>
                  <span className="text-3xl font-bold text-[#1e3a8a]">{totalPrice} ₴</span>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full py-4 bg-[#1e3a8a] text-white rounded-full font-bold text-lg hover:bg-[#1e40af] transition-all hover:shadow-xl hover:scale-105"
              >
                Додати до кошика
              </button>

              <div className="mt-4 text-center text-sm text-stone-500">
                Безпечна оплата онлайн
              </div>
            </div>
          </motion.div>
        </div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 bg-white rounded-2xl p-8 shadow-sm border border-stone-100"
        >
          <h2 className="text-2xl font-bold text-stone-900 mb-6">Як це працює?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl mb-4">1</div>
              <h3 className="font-bold text-stone-900 mb-2">Оберіть тип</h3>
              <p className="text-sm text-stone-600">Грошовий сертифікат (дійсний 1 рік) або на конкретний продукт (дійсний 3 місяці)</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl mb-4">2</div>
              <h3 className="font-bold text-stone-900 mb-2">Оберіть формат</h3>
              <p className="text-sm text-stone-600">Електронний (PDF на email) або друкований (преміальний папір з доставкою)</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl mb-4">3</div>
              <h3 className="font-bold text-stone-900 mb-2">Отримайте сертифікат</h3>
              <p className="text-sm text-stone-600">Отримувач використовує код сертифікату для замовлення будь-якого продукту з каталогу</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
