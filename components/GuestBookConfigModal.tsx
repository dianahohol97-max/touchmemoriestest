'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GuestBookConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: {
    size?: string;
    pageColor?: string;
    coverType?: string;
    coverColor?: string;
  };
}

const TEXT_SUGGESTIONS = [
  'Wedding Day', 'Best Day', 'The Day We Said I Do', 'Наше весілля', 'Найкращий день'
];

// Real cover colors with actual hex values per material
const COVER_COLORS_BY_TYPE: Record<string, { name: string; hex: string }[]> = {
  'Друкована обкладинка': [
    { name: 'Повнокольоровий друк', hex: 'linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff)' },
  ],
  'Велюр': [
    { name: 'Темно-синій', hex: '#1e2d7d' },
    { name: 'Бордовий', hex: '#7b1c2e' },
    { name: 'Смарагдовий', hex: '#1a5c3a' },
    { name: 'Чорний', hex: '#1a1a1a' },
    { name: 'Сірий', hex: '#6b7280' },
    { name: 'Пудровий рожевий', hex: '#d4a0a8' },
    { name: 'Кремовий', hex: '#e8dcc8' },
  ],
  'Шкірзам': [
    { name: 'Чорний', hex: '#1a1a1a' },
    { name: 'Коричневий', hex: '#6b3f1f' },
    { name: 'Бордовий', hex: '#7b1c2e' },
    { name: 'Темно-синій', hex: '#1e2d7d' },
    { name: 'Бежевий', hex: '#c9a87c' },
  ],
  'Тканина': [
    { name: 'Білий', hex: '#f5f5f0' },
    { name: 'Кремовий', hex: '#e8dcc8' },
    { name: 'Сірий', hex: '#9ca3af' },
    { name: 'Темно-синій', hex: '#1e2d7d' },
    { name: 'Пудровий рожевий', hex: '#d4a0a8' },
  ],
};

const TEXT_COLORS = [
  { name: 'Золотий', hex: '#C9A84C' },
  { name: 'Срібний', hex: '#C0C0C0' },
  { name: 'Білий', hex: '#FFFFFF' },
  { name: 'Чорний', hex: '#1a1a1a' },
  { name: 'Бордовий', hex: '#7b1c2e' },
  { name: 'Синій', hex: '#1e2d7d' },
  { name: 'Рожевий', hex: '#d4a0a8' },
];

export default function GuestBookConfigModal({ isOpen, onClose, initialConfig }: GuestBookConfigModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<'form' | 'summary'>('form');

  const coverTypes = ['Друкована обкладинка', 'Велюр', 'Шкірзам', 'Тканина'];
  const availableSizes = ['20×20 см', '25×25 см', '30×30 см'];

  const [config, setConfig] = useState({
    size: initialConfig?.size || availableSizes[0],
    pageColor: initialConfig?.pageColor || 'Білі',
    coverType: initialConfig?.coverType || 'Велюр',
    coverColor: initialConfig?.coverColor || '',
    addNames: false, names: '',
    addDate: false, date: '',
    addOtherText: false, otherText: '',
    textColor: 'Золотий',
    coverFinish: 'Матова',
  });

  // Fields already provided via initialConfig — hide them in form to avoid duplication
  const prefilledFields = new Set(
    Object.entries(initialConfig || {})
      .filter(([, v]) => v && v !== '')
      .map(([k]) => k)
  );

  useEffect(() => {
    if (isOpen) {
      setCurrentStep('form');
      const coverType = initialConfig?.coverType || 'Велюр';
      const colors = COVER_COLORS_BY_TYPE[coverType] || [];
      setConfig({
        size: initialConfig?.size || availableSizes[0],
        pageColor: initialConfig?.pageColor || 'Білі',
        coverType,
        coverColor: initialConfig?.coverColor || colors[0]?.name || '',
        addNames: false, names: '',
        addDate: false, date: '',
        addOtherText: false, otherText: '',
        textColor: 'Золотий',
        coverFinish: 'Матова',
      });
    }
  }, [isOpen]);

  // Update cover color when cover type changes
  useEffect(() => {
    if (config.coverType) {
      const colors = COVER_COLORS_BY_TYPE[config.coverType] || [];
      setConfig(prev => ({ ...prev, coverColor: colors[0]?.name || '' }));
    }
  }, [config.coverType]);

  const handleChange = (field: string, value: any) =>
    setConfig(prev => ({ ...prev, [field]: value }));

  const isFormValid = () => {
    if (!config.size || !config.pageColor || !config.coverType || !config.coverColor || !config.textColor || !config.coverFinish) return false;
    if (config.addNames && !config.names.trim()) return false;
    if (config.addDate && !config.date.trim()) return false;
    if (config.addOtherText && !config.otherText.trim()) return false;
    return true;
  };

  const handleContinue = () => {
    if (currentStep === 'form') {
      setCurrentStep('summary');
    } else {
      router.push('/order/book?product=guestbook-wedding');
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep === 'summary') setCurrentStep('form');
    else onClose();
  };

  const getTextColorHex = () => TEXT_COLORS.find(c => c.name === config.textColor)?.hex || '#000';
  const currentColors = COVER_COLORS_BY_TYPE[config.coverType] || [];

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d7d]">
              {currentStep === 'form' ? 'Налаштування книги побажань' : 'Підтвердження конфігурації'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Книга побажань</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        <div className="px-6 py-6">
          {currentStep === 'form' ? (
            <div className="space-y-6">
              <p className="text-gray-600">Оберіть параметри. Після підтвердження наш дизайнер створить макет для вас.</p>

              {/* Size — hide if prefilled */}
              {!prefilledFields.has('size') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Розмір <span className="text-red-500">*</span></label>
                  <select value={config.size} onChange={e => handleChange('size', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white">
                    {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Page Color — hide if prefilled */}
              {!prefilledFields.has('pageColor') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Колір сторінок <span className="text-red-500">*</span></label>
                  <select value={config.pageColor} onChange={e => handleChange('pageColor', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white">
                    {['Білі', 'Чорні', 'Кремові'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Cover Type — hide if prefilled */}
              {!prefilledFields.has('coverType') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Вид обкладинки <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {coverTypes.map(t => (
                      <button key={t} onClick={() => handleChange('coverType', t)}
                        className={`p-3 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                          config.coverType === t ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cover Color — always show (depends on cover type) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Колір обкладинки <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {currentColors.map(color => {
                    const isGradient = color.hex.startsWith('linear');
                    const isSelected = config.coverColor === color.name;
                    const isLight = ['#f5f5f0', '#e8dcc8', '#d4a0a8', '#c9a87c'].includes(color.hex);
                    return (
                      <button key={color.name} onClick={() => handleChange('coverColor', color.name)}
                        title={color.name}
                        className={`relative flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all ${
                          isSelected ? 'ring-2 ring-[#1e2d7d] ring-offset-2' : 'hover:ring-1 hover:ring-gray-300 hover:ring-offset-1'
                        }`}
                      >
                        <div style={{
                          width: 44, height: 44, borderRadius: 10,
                          background: isGradient ? color.hex : color.hex,
                          border: isLight ? '1px solid #d1d5db' : 'none',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                        <span className="text-xs text-gray-600 text-center leading-tight max-w-[52px]">{color.name}</span>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#1e2d7d] rounded-full flex items-center justify-center">
                            <span className="text-white text-xs"></span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                    placeholder="Введіть імена..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
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
                    placeholder="Введіть дату..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
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
                      placeholder="Введіть текст..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] mb-3" />
                    <div className="flex flex-wrap gap-2">
                      {TEXT_SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => handleChange('otherText', s)}
                          className="px-3 py-1.5 text-xs bg-[#f0f2f8] text-[#1e2d7d] rounded-full hover:bg-[#dbeafe]">{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Text Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Колір надписів <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-3">
                  {TEXT_COLORS.map(color => {
                    const isLight = ['#FFFFFF', '#C0C0C0', '#d4a0a8'].includes(color.hex);
                    const isSelected = config.textColor === color.name;
                    return (
                      <button key={color.name} onClick={() => handleChange('textColor', color.name)}
                        title={color.name}
                        className={`relative flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all ${
                          isSelected ? 'ring-2 ring-[#1e2d7d] ring-offset-2' : 'hover:ring-1 hover:ring-gray-300 hover:ring-offset-1'
                        }`}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: color.hex,
                          border: isLight ? '1px solid #d1d5db' : 'none',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                        <span className="text-xs text-gray-600">{color.name}</span>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#1e2d7d] rounded-full flex items-center justify-center">
                            <span className="text-white text-[10px]"></span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cover Finish */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ламінація обкладинки <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  {['Матова', 'Глянцева'].map(f => (
                    <button key={f} onClick={() => handleChange('coverFinish', f)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        config.coverFinish === f ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}>{f}</button>
                  ))}
                </div>
              </div>

              {/* Summary of prefilled fields */}
              {prefilledFields.size > 0 && (
                <div className="bg-[#f0f3ff] rounded-xl p-4 border border-[#c7d2fe]">
                  <p className="text-xs font-semibold text-[#1e2d7d] mb-2">Обрано на сторінці товару:</p>
                  <div className="space-y-1">
                    {prefilledFields.has('size') && <p className="text-sm text-gray-700"> Розмір: <b>{config.size}</b></p>}
                    {prefilledFields.has('pageColor') && <p className="text-sm text-gray-700"> Колір сторінок: <b>{config.pageColor}</b></p>}
                    {prefilledFields.has('coverType') && <p className="text-sm text-gray-700"> Вид обкладинки: <b>{config.coverType}</b></p>}
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
                  ['Розмір', config.size],
                  ['Колір сторінок', config.pageColor],
                  ['Вид обкладинки', config.coverType],
                  ['Колір обкладинки', config.coverColor],
                  config.addNames ? ['Імена', config.names] : null,
                  config.addDate ? ['Дата', config.date] : null,
                  config.addOtherText ? ['Текст', config.otherText] : null,
                  ['Колір надписів', config.textColor],
                  ['Ламінація', config.coverFinish],
                ].filter((x): x is [string, string] => Array.isArray(x)).map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-1.5 border-b border-gray-200 last:border-0">
                    <span className="text-sm text-gray-600">{label}:</span>
                    <span className="text-sm font-semibold text-gray-800">{val as string}</span>
                  </div>
                ))}
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
            {currentStep === 'form' ? 'Переглянути підсумок →' : 'Продовжити до завантаження фото →'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
