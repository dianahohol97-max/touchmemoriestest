'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

interface GuestBookConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: {
    size?: string;        // '23x23' | '20x30' | '30x20'
    pageColor?: string;   // 'white' | 'black' | 'cream'
    coverType?: string;   // 'printed' | 'velour' | 'leatherette' | 'fabric'
    coverColor?: string;  // color name from DB (e.g. 'Молочний')
  };
}

const TEXT_SUGGESTIONS = [
  'Наше весілля', 'Найкращий день', 'Our Wedding', 'The Big Day', 'Forever Yours',
];

// Cover material → wishbook_prices.cover_category
const MATERIAL_TO_CATEGORY: Record<string, 'printed' | 'fabric'> = {
  printed: 'printed',
  velour: 'fabric',
  leatherette: 'fabric',
  fabric: 'fabric',
};

// Cover material → human label (UI)
const MATERIAL_LABELS: Record<string, string> = {
  printed: 'Друкована обкладинка',
  velour: 'Велюр',
  leatherette: 'Шкірзамінник',
  fabric: 'Тканина',
};

// Cover material → cover_type_id in DB (for fetching cover_colors)
const MATERIAL_TO_COVER_TYPE_ID: Record<string, string | null> = {
  printed: null, // any CMYK color, no swatch list
  velour:      '0472fb81-56a5-48ed-8a60-8a838b517a33',
  leatherette: '08aaacb3-3686-4b54-9c5e-0c321ecdec26',
  fabric:      '463df25b-3441-4c48-a80b-a8054a787087',
};

// Size codes → labels for UI
const SIZE_LABELS: Record<string, string> = {
  '23x23': '23×23 см (квадратна)',
  '20x30': '20×30 см (вертикальна)',
  '30x20': '30×20 см (горизонтальна)',
};

const PAGE_COLOR_LABELS: Record<string, string> = {
  white: 'Білі сторінки',
  black: 'Чорні сторінки',
  cream: 'Кремові сторінки',
};

// Real flex film colors (4 — from FLEX_COLORS in lib/editor/constants.ts)
// Used for text on velour/leatherette/fabric covers
const TEXT_COLORS_FLEX = [
  { name: 'Золотий', hex: '#D4AF37' },
  { name: 'Срібний', hex: '#C0C0C0' },
  { name: 'Білий',   hex: '#FFFFFF' },
  { name: 'Чорний',  hex: '#1A1A1A' },
];

// Normalizers: accept both new codes (e.g. '23x23') AND legacy human-readable values
// (e.g. '23×23 см') from ProductClient so initialConfig is forward+backward compatible.
function normalizeSize(v?: string): string {
  if (!v) return '23x23';
  const s = v.toLowerCase().replace(/×/g, 'x').replace(/[^0-9x]/g, '');
  if (s.includes('23x23')) return '23x23';
  if (s.includes('20x30')) return '20x30';
  if (s.includes('30x20')) return '30x20';
  return '23x23';
}
function normalizePageColor(v?: string): string {
  if (!v) return 'white';
  const s = v.toLowerCase();
  if (s.includes('білі') || s.includes('white')) return 'white';
  if (s.includes('чорні') || s.includes('black')) return 'black';
  if (s.includes('кремові') || s.includes('cream')) return 'cream';
  if (['white', 'black', 'cream'].includes(s)) return s;
  return 'white';
}
function normalizeCoverType(v?: string): string {
  if (!v) return 'velour';
  const s = v.toLowerCase();
  if (s.includes('друк') || s === 'printed') return 'printed';
  if (s.includes('велюр') || s === 'velour') return 'velour';
  if (s.includes('шкір') || s === 'leatherette') return 'leatherette';
  if (s.includes('тканин') || s === 'fabric') return 'fabric';
  return 'velour';
}

interface CoverColor {
  id: string;
  code: string;
  name: string;
  hex_approx: string;
  cover_type_id: string;
}

interface WishbookPriceRow {
  cover_category: 'printed' | 'fabric';
  page_color: 'white' | 'black' | 'cream';
  size_code: '23x23' | '20x30' | '30x20';
  price: number;
}

export default function GuestBookConfigModal({ isOpen, onClose, initialConfig }: GuestBookConfigModalProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [currentStep, setCurrentStep] = useState<'form' | 'summary'>('form');
  const [coverColors, setCoverColors] = useState<CoverColor[]>([]);
  const [prices, setPrices] = useState<WishbookPriceRow[]>([]);

  const [config, setConfig] = useState({
    size:        normalizeSize(initialConfig?.size),
    pageColor:   normalizePageColor(initialConfig?.pageColor),
    coverType:   normalizeCoverType(initialConfig?.coverType),
    coverColor:  initialConfig?.coverColor || '',
    addNames:    false, names:     '',
    addDate:     false, date:      '',
    addOtherText:false, otherText: '',
    textColor:   'Золотий',
  });

  // Fields already provided via initialConfig — hide them in form
  const prefilledFields = new Set(
    Object.entries(initialConfig || {})
      .filter(([, v]) => v && v !== '')
      .map(([k]) => k)
  );

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('form');
      setConfig({
        size:        normalizeSize(initialConfig?.size),
        pageColor:   normalizePageColor(initialConfig?.pageColor),
        coverType:   normalizeCoverType(initialConfig?.coverType),
        coverColor:  initialConfig?.coverColor || '',
        addNames:    false, names:     '',
        addDate:     false, date:      '',
        addOtherText:false, otherText: '',
        textColor:   'Золотий',
      });
    }
  }, [isOpen]);

  // Fetch cover_colors and wishbook_prices once
  useEffect(() => {
    if (!isOpen) return;
    supabase.from('cover_colors').select('id, code, name, hex_approx, cover_type_id').eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { if (data) setCoverColors(data as CoverColor[]); });
    supabase.from('wishbook_prices').select('cover_category, page_color, size_code, price')
      .then(({ data }) => { if (data) setPrices(data as WishbookPriceRow[]); });
  }, [isOpen, supabase]);

  // Colors filtered by selected material
  const currentColors = useMemo(() => {
    const typeId = MATERIAL_TO_COVER_TYPE_ID[config.coverType];
    if (!typeId) return []; // 'printed' has no swatch list
    return coverColors.filter(c => c.cover_type_id === typeId);
  }, [config.coverType, coverColors]);

  // Reset coverColor when material changes (if current color isn't in new list)
  useEffect(() => {
    if (config.coverType === 'printed') {
      if (config.coverColor) setConfig(prev => ({ ...prev, coverColor: '' }));
      return;
    }
    if (currentColors.length > 0 && !currentColors.find(c => c.name === config.coverColor)) {
      setConfig(prev => ({ ...prev, coverColor: currentColors[0].name }));
    }
  }, [config.coverType, currentColors]);

  // Live price
  const livePrice = useMemo(() => {
    const cat = MATERIAL_TO_CATEGORY[config.coverType];
    const row = prices.find(p =>
      p.cover_category === cat &&
      p.page_color === config.pageColor &&
      p.size_code === config.size
    );
    return row?.price ?? null;
  }, [prices, config.coverType, config.pageColor, config.size]);

  const handleChange = (field: string, value: any) =>
    setConfig(prev => ({ ...prev, [field]: value }));

  const isFormValid = () => {
    if (!config.size || !config.pageColor || !config.coverType) return false;
    if (config.coverType !== 'printed' && !config.coverColor) return false;
    if (config.addNames && !config.names.trim()) return false;
    if (config.addDate && !config.date.trim()) return false;
    if (config.addOtherText && !config.otherText.trim()) return false;
    return true;
  };

  const handleContinue = () => {
    if (currentStep === 'form') {
      setCurrentStep('summary');
    } else {
      const params = new URLSearchParams({
        product: 'wishbook',
        size: config.size,
        cover: config.coverType,
        page_color: config.pageColor,
        cover_color: config.coverColor,
        text_color: config.textColor,
      });
      if (config.addNames && config.names)         params.set('names', config.names);
      if (config.addDate && config.date)           params.set('date', config.date);
      if (config.addOtherText && config.otherText) params.set('other_text', config.otherText);
      router.push(`/order/book?${params.toString()}`);
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep === 'summary') setCurrentStep('form');
    else onClose();
  };

  if (!isOpen) return null;

  const materials = ['printed', 'velour', 'leatherette', 'fabric'];
  const sizes = ['23x23', '20x30', '30x20'];
  const pageColors = ['white', 'black', 'cream'];

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d7d]">
              {currentStep === 'form' ? 'Налаштування книги побажань' : 'Підтвердження конфігурації'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Книга побажань · 32 сторінки</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        <div className="px-6 py-6">
          {currentStep === 'form' ? (
            <div className="space-y-6">
              <p className="text-gray-600">Оберіть параметри. Після підтвердження наш дизайнер створить макет для вас.</p>

              {/* Size */}
              {!prefilledFields.has('size') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Розмір <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {sizes.map(s => (
                      <button key={s} onClick={() => handleChange('size', s)}
                        className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          config.size === s ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}>{SIZE_LABELS[s].replace(/ см.*/, '')}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cover Type */}
              {!prefilledFields.has('coverType') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Матеріал обкладинки <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {materials.map(m => (
                      <button key={m} onClick={() => handleChange('coverType', m)}
                        className={`p-3 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                          config.coverType === m ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}>{MATERIAL_LABELS[m]}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Page Color */}
              {!prefilledFields.has('pageColor') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Колір сторінок <span className="text-red-500">*</span></label>
                  <select value={config.pageColor} onChange={e => handleChange('pageColor', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white">
                    {pageColors.map(c => <option key={c} value={c}>{PAGE_COLOR_LABELS[c]}</option>)}
                  </select>
                </div>
              )}

              {/* Cover Color — only for fabric materials (not printed) */}
              {config.coverType !== 'printed' && currentColors.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Колір обкладинки <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {currentColors.map(color => {
                      const isSelected = config.coverColor === color.name;
                      const isLight = ['#F0EAD6', '#F5F5F0', '#FFFFFF'].includes(color.hex_approx.toUpperCase());
                      return (
                        <button key={color.id} onClick={() => handleChange('coverColor', color.name)}
                          title={color.name}
                          className={`relative flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all ${
                            isSelected ? 'ring-2 ring-[#1e2d7d] ring-offset-2' : 'hover:ring-1 hover:ring-gray-300 hover:ring-offset-1'
                          }`}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 10,
                            background: color.hex_approx,
                            border: isLight ? '1px solid #d1d5db' : 'none',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                          <span className="text-xs text-gray-600 text-center leading-tight max-w-[64px]">{color.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Printed cover note */}
              {config.coverType === 'printed' && (
                <div className="bg-[#f0f3ff] border border-[#c7d2fe] rounded-xl p-4">
                  <p className="text-sm text-[#1e2d7d]">
                    На друкованій обкладинці буде ваше фото або дизайн. Колір обирати не потрібно — друк повнокольоровий.
                  </p>
                </div>
              )}

              {/* Add Names */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Чи додавати імена?</label>
                <div className="flex gap-4 mb-3">
                  {[true, false].map(v => (
                    <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="addNames" checked={config.addNames === v} onChange={() => handleChange('addNames', v)} className="w-4 h-4 text-[#1e2d7d]" />
                      <span className="text-gray-700">{v ? 'Так' : 'Ні'}</span>
                    </label>
                  ))}
                </div>
                {config.addNames && (
                  <input type="text" value={config.names} onChange={e => handleChange('names', e.target.value)}
                    placeholder="Введіть імена..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                )}
              </div>

              {/* Add Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Чи додавати дату?</label>
                <div className="flex gap-4 mb-3">
                  {[true, false].map(v => (
                    <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="addDate" checked={config.addDate === v} onChange={() => handleChange('addDate', v)} className="w-4 h-4 text-[#1e2d7d]" />
                      <span className="text-gray-700">{v ? 'Так' : 'Ні'}</span>
                    </label>
                  ))}
                </div>
                {config.addDate && (
                  <input type="text" value={config.date} onChange={e => handleChange('date', e.target.value)}
                    placeholder="Введіть дату..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                )}
              </div>

              {/* Add Other Text */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Чи додавати інший текст?</label>
                <div className="flex gap-4 mb-3">
                  {[true, false].map(v => (
                    <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="addOtherText" checked={config.addOtherText === v} onChange={() => handleChange('addOtherText', v)} className="w-4 h-4 text-[#1e2d7d]" />
                      <span className="text-gray-700">{v ? 'Так' : 'Ні'}</span>
                    </label>
                  ))}
                </div>
                {config.addOtherText && (
                  <div>
                    <input type="text" value={config.otherText} onChange={e => handleChange('otherText', e.target.value)}
                      placeholder="Введіть текст..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] mb-3" />
                    <div className="flex flex-wrap gap-2">
                      {TEXT_SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => handleChange('otherText', s)}
                          className="px-3 py-1.5 text-xs bg-[#f0f2f8] text-[#1e2d7d] rounded-full hover:bg-[#dbeafe]">{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Text Color — only show if there's any text */}
              {(config.addNames || config.addDate || config.addOtherText) && config.coverType !== 'printed' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Колір надписів <span className="text-red-500">*</span></label>
                  <p className="text-xs text-gray-500 mb-3">Флекс-плівка для тиснення на тканинній обкладинці</p>
                  <div className="flex flex-wrap gap-3">
                    {TEXT_COLORS_FLEX.map(color => {
                      const isLight = color.hex === '#FFFFFF' || color.hex === '#C0C0C0';
                      const isSelected = config.textColor === color.name;
                      return (
                        <button key={color.name} onClick={() => handleChange('textColor', color.name)}
                          title={color.name}
                          className={`relative flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all ${
                            isSelected ? 'ring-2 ring-[#1e2d7d] ring-offset-2' : 'hover:ring-1 hover:ring-gray-300 hover:ring-offset-1'
                          }`}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: color.hex,
                            border: isLight ? '1px solid #d1d5db' : 'none',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                          <span className="text-xs text-gray-600">{color.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Price */}
              {livePrice !== null && (
                <div className="bg-[#f0f3ff] border border-[#c7d2fe] rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#1e2d7d]">Орієнтовна ціна</span>
                  <span className="text-2xl font-bold text-[#1e2d7d]">{livePrice} ₴</span>
                </div>
              )}

              {/* Summary of prefilled fields */}
              {prefilledFields.size > 0 && (
                <div className="bg-[#f0f3ff] rounded-xl p-4 border border-[#c7d2fe]">
                  <p className="text-xs font-semibold text-[#1e2d7d] mb-2">Обрано на сторінці товару:</p>
                  <div className="space-y-1">
                    {prefilledFields.has('size')      && <p className="text-sm text-gray-700">Розмір: <b>{SIZE_LABELS[config.size]}</b></p>}
                    {prefilledFields.has('pageColor') && <p className="text-sm text-gray-700">Колір сторінок: <b>{PAGE_COLOR_LABELS[config.pageColor]}</b></p>}
                    {prefilledFields.has('coverType') && <p className="text-sm text-gray-700">Матеріал: <b>{MATERIAL_LABELS[config.coverType]}</b></p>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Summary */
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">Перевірте конфігурацію перед продовженням.</p>
              <div className="bg-[#f0f2f8] rounded-xl p-4 space-y-2">
                {[
                  ['Розмір', SIZE_LABELS[config.size]],
                  ['Колір сторінок', PAGE_COLOR_LABELS[config.pageColor]],
                  ['Матеріал обкладинки', MATERIAL_LABELS[config.coverType]],
                  config.coverType !== 'printed' ? ['Колір обкладинки', config.coverColor] : null,
                  ['Кількість сторінок', '32'],
                  config.addNames     ? ['Імена', config.names] : null,
                  config.addDate      ? ['Дата', config.date] : null,
                  config.addOtherText ? ['Текст', config.otherText] : null,
                  (config.addNames || config.addDate || config.addOtherText) && config.coverType !== 'printed'
                    ? ['Колір надписів', config.textColor] : null,
                ].filter((x): x is [string, string] => Array.isArray(x)).map(([label, val]) => (
                  <div key={label} className="flex justify-between py-1.5 border-b border-gray-200 last:border-0">
                    <span className="text-sm text-gray-600">{label}:</span>
                    <span className="text-sm font-semibold text-gray-800">{val}</span>
                  </div>
                ))}
                {livePrice !== null && (
                  <div className="flex justify-between pt-3 mt-2 border-t-2 border-[#c7d2fe]">
                    <span className="text-base font-bold text-[#1e2d7d]">Ціна</span>
                    <span className="text-xl font-bold text-[#1e2d7d]">{livePrice} ₴</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button onClick={handleBack}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            {currentStep === 'summary' ? 'Назад до редагування' : 'Скасувати'}
          </button>
          <button onClick={handleContinue} disabled={currentStep === 'form' && !isFormValid()}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
              currentStep === 'form' && !isFormValid()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#1e2d7d] text-white hover:bg-[#263a99]'
            }`}>
            {currentStep === 'form' ? 'Переглянути підсумок →' : 'Продовжити →'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
