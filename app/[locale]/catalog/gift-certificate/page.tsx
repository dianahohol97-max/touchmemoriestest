'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Gift, Mail, Package, Check, Calendar, Info } from 'lucide-react';
import { useCartStore } from '@/lib/store/cart';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/context';

interface CertificateConfig {
  amount: number;
  format: 'electronic' | 'printed';
  recipientName: string;
  recipientEmail: string;
  message: string;
}

export default function GiftCertificatePage() {
  const t = useT();
  const router = useRouter();
  const { addItem } = useCartStore();

  // State
  const [loading, setLoading] = useState(false);
  const [certificateCode] = useState<string>(() => {
    // Generate preview code — real code assigned by DB on purchase
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TM-${year}-${rand}`;
  });

  const [config, setConfig] = useState<CertificateConfig>({
    amount: 500,
    format: 'electronic',
    recipientName: '',
    recipientEmail: '',
    message: '',
  });

  // Calculate total price
  const totalPrice = useMemo(() => config.amount, [config.amount]);

  // Calculate validity date (always 12 months for money certificates)
  const validUntil = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 12);
    return date.toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' });
  }, []);


  // Handle add to cart
  const handleAddToCart = () => {
    if (config.format === 'electronic' && !config.recipientEmail) {
      toast.error(t('gift_certificate.error_email_required'));
      return;
    }

    if (config.amount < 100) {
      toast.error(t('gift_certificate.error_min_amount'));
      return;
    }

    // Create cart item
    const cartItem = {
      id: `gift-certificate-${Date.now()}`,
      productId: 'gift-certificate',
      name: t('gift_certificate.cart_item_name'),
      price: totalPrice,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&q=80',
      options: {
        'Номер': certificateCode,
        'Тип сертифікату': t('gift_certificate.cart_type_money').replace('{amount}', String(config.amount)),
        'Формат': config.format === 'electronic' ? t('gift_certificate.cart_format_electronic') : t('gift_certificate.cart_format_printed'),
        'Отримувач': config.recipientName || config.recipientEmail,
        'Термін дії': validUntil,
      },
      metadata: {
        certificateCode,
        certificateType: 'money',
        amount: config.amount,
        format: config.format,
        recipientName: config.recipientName,
        recipientEmail: config.recipientEmail,
        message: config.message,
        validityMonths: 12,
      },
    };

    addItem(cartItem);
    toast.success(t('gift_certificate.added_to_cart_toast'));
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
        {/* Back button */}
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 text-stone-600 hover:text-[#1e3a8a] transition-colors mb-6 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('gift_certificate.back_to_catalog')}
        </Link>

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
            {t('gift_certificate.page_title')}
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            {t('gift_certificate.page_subtitle')}
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
              <h2 className="text-xl font-bold text-stone-900 mb-6">{t('gift_certificate.section_type')}</h2>

              {/* Money Certificate */}
              <div
                className="p-6 rounded-xl border-2 border-[#1e3a8a] bg-blue-50 mb-4"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                      <span className="text-2xl"></span>
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900">{t('gift_certificate.type_money_title')}</h3>
                      <p className="text-sm text-stone-500">{t('gift_certificate.type_money_subtitle')}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700 mb-2 block">{t('gift_certificate.amount_label')}</span>
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
                    <span>{t('gift_certificate.validity_1_year')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION B — Format */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100">
              <h2 className="text-xl font-bold text-stone-900 mb-6">{t('gift_certificate.section_format')}</h2>

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
                      <h3 className="font-bold text-stone-900">{t('gift_certificate.format_electronic_title')}</h3>
                      <p className="text-sm text-stone-500">{t('gift_certificate.format_electronic_subtitle')}</p>
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
                      <h3 className="font-bold text-stone-900">{t('gift_certificate.format_printed_title')}</h3>
                      <p className="text-sm text-stone-500">{t('gift_certificate.format_printed_subtitle')}</p>
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
              <h2 className="text-xl font-bold text-stone-900 mb-6">{t('gift_certificate.section_recipient')}</h2>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-stone-700 mb-2 block">{t('gift_certificate.recipient_name_label')}</span>
                  <input
                    type="text"
                    value={config.recipientName}
                    onChange={(e) => setConfig({ ...config, recipientName: e.target.value })}
                    placeholder={t('gift_certificate.recipient_name_placeholder')}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  />
                </label>

                {config.format === 'electronic' && (
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700 mb-2 block">{t('gift_certificate.recipient_email_label')}</span>
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
                  <span className="text-sm font-medium text-stone-700 mb-2 block">{t('gift_certificate.message_label')}</span>
                  <textarea
                    value={config.message}
                    onChange={(e) => setConfig({ ...config, message: e.target.value })}
                    placeholder={t('gift_certificate.message_placeholder')}
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
              <h2 className="text-base font-bold text-stone-500 mb-4 uppercase tracking-widest">{t('gift_certificate.preview_title')}</h2>

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
                      <span>{t('gift_certificate.card_on')}</span>
                      <span style={{
                        borderBottom: '1.5px solid rgba(255,255,255,0.6)',
                        minWidth: 110, textAlign: 'center',
                        paddingBottom: 2, letterSpacing: '0.05em',
                        fontSize: config.amount > 0 ? 'clamp(15px,3vw,18px)' : 'inherit',
                      }}>
                        {config.amount > 0 ? config.amount : '·····················'}
                      </span>
                      <span>{t('gift_certificate.card_uah')}</span>
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
                      <span>{t('gift_certificate.card_valid_until')}</span>
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
                    {t('gift_certificate.electronic_info_before')}<strong>{config.recipientEmail || t('gift_certificate.electronic_email_placeholder')}</strong>{t('gift_certificate.electronic_info_after')}
                  </p>
                </div>
              )}

              {config.format === 'printed' && (
                <div className="mt-4 flex items-start gap-2 p-4 bg-amber-50 rounded-lg">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">
                    {t('gift_certificate.printed_info')}
                  </p>
                </div>
              )}
            </div>

            {/* Price Summary */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100">
              <h2 className="text-xl font-bold text-stone-900 mb-6">{t('gift_certificate.price_title')}</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-stone-600">
                  <span>{t('gift_certificate.price_nominal')}</span>
                  <span className="font-semibold">{totalPrice} ₴</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>{t('gift_certificate.price_format')}</span>
                  <span className="font-semibold">{config.format === 'electronic' ? t('gift_certificate.price_format_electronic') : t('gift_certificate.price_format_printed')}</span>
                </div>
                <div className="border-t border-stone-200 pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold text-stone-900">{t('gift_certificate.price_total')}</span>
                  <span className="text-3xl font-bold text-[#1e3a8a]">{totalPrice} ₴</span>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full py-4 bg-[#1e3a8a] text-white rounded-full font-bold text-lg hover:bg-[#1e40af] transition-all hover:shadow-xl hover:scale-105"
              >
                {t('gift_certificate.add_to_cart')}
              </button>

              <div className="mt-4 text-center text-sm text-stone-500">
                {t('gift_certificate.secure_payment')}
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
          <h2 className="text-2xl font-bold text-stone-900 mb-6">{t('gift_certificate.how_it_works_title')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl mb-4">1</div>
              <h3 className="font-bold text-stone-900 mb-2">{t('gift_certificate.step_1_title')}</h3>
              <p className="text-sm text-stone-600">{t('gift_certificate.step_1_description')}</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl mb-4">2</div>
              <h3 className="font-bold text-stone-900 mb-2">{t('gift_certificate.step_2_title')}</h3>
              <p className="text-sm text-stone-600">{t('gift_certificate.step_2_description')}</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl mb-4">3</div>
              <h3 className="font-bold text-stone-900 mb-2">{t('gift_certificate.step_3_title')}</h3>
              <p className="text-sm text-stone-600">{t('gift_certificate.step_3_description')}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
