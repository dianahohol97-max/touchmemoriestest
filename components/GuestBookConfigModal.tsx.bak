'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GuestBookConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Example text suggestions
const TEXT_SUGGESTIONS = [
  'Wedding Day',
  'Best Day',
  'The Day We Said I Do',
  'Наше весілля',
  'Найкращий день'
];

// Color options for text
const TEXT_COLORS = [
  { name: 'Золотий', hex: '#FFD700' },
  { name: 'Срібний', hex: '#C0C0C0' },
  { name: 'Білий', hex: '#FFFFFF' },
  { name: 'Чорний', hex: '#000000' },
  { name: 'Бордовий', hex: '#800020' },
  { name: 'Синій', hex: '#1e2d7d' },
  { name: 'Рожевий', hex: '#FFB6C1' },
];

export default function GuestBookConfigModal({ isOpen, onClose }: GuestBookConfigModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<'form' | 'summary'>('form');

  // Configuration state
  const [config, setConfig] = useState({
    size: '',
    pageColor: '',
    coverType: '',
    coverColor: '',
    addNames: false,
    names: '',
    addDate: false,
    date: '',
    addOtherText: false,
    otherText: '',
    textColor: '',
    coverFinish: ''
  });

  // Available sizes - will be populated from Supabase later
  const [availableSizes, setAvailableSizes] = useState<string[]>([
    '20×20 см',
    '25×25 см',
    '30×30 см'
  ]);

  // Cover types - placeholder for now
  const coverTypes = [
    'Друкована обкладинка',
    'Велюр',
    'Шкірзам',
    'Тканина'
  ];

  // Cover colors depend on cover type
  const coverColorsByType: Record<string, string[]> = {
    'Друкована обкладинка': ['Будь-який колір (повнокольоровий друк)'],
    'Велюр': ['Синій', 'Бордовий', 'Зелений', 'Чорний', 'Сірий'],
    'Шкірзам': ['Чорний', 'Коричневий', 'Бордовий', 'Синій'],
    'Тканина': ['Білий', 'Кремовий', 'Сірий', 'Синій']
  };

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setCurrentStep('form');
      setConfig({
        size: availableSizes[0] || '',
        pageColor: 'Білі',
        coverType: coverTypes[0] || '',
        coverColor: '',
        addNames: false,
        names: '',
        addDate: false,
        date: '',
        addOtherText: false,
        otherText: '',
        textColor: TEXT_COLORS[0].name,
        coverFinish: 'Матова'
      });
    }
  }, [isOpen]);

  // Update cover color when cover type changes
  useEffect(() => {
    if (config.coverType) {
      const availableColors = coverColorsByType[config.coverType] || [];
      setConfig(prev => ({ ...prev, coverColor: availableColors[0] || '' }));
    }
  }, [config.coverType]);

  const handleChange = (field: string, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    // Required fields
    if (!config.size || !config.pageColor || !config.coverType || !config.coverColor || !config.textColor || !config.coverFinish) {
      return false;
    }

    // Conditional required fields
    if (config.addNames && !config.names.trim()) {
      return false;
    }
    if (config.addDate && !config.date.trim()) {
      return false;
    }
    if (config.addOtherText && !config.otherText.trim()) {
      return false;
    }

    return true;
  };

  const handleContinue = () => {
    if (currentStep === 'form') {
      setCurrentStep('summary');
    } else {
      // Store configuration and navigate to order page
      const orderConfig = {
        productType: 'guestbook',
        productName: 'Книга побажань',
        config,
        timestamp: Date.now()
      };
      sessionStorage.setItem('designerOrderConfig', JSON.stringify(orderConfig));
      router.push('/order');
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep === 'summary') {
      setCurrentStep('form');
    } else {
      onClose();
    }
  };

  const getSelectedColor = () => {
    return TEXT_COLORS.find(c => c.name === config.textColor)?.hex || '#000000';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d7d]">
              {currentStep === 'form' ? 'Налаштування книги побажань' : 'Підтвердження конфігурації'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Книга побажань</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Закрити"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {currentStep === 'form' ? (
            <>
              <p className="text-gray-600 mb-6">
                Оберіть параметри вашої книги побажань. Після підтвердження ви зможете завантажити фотографії.
              </p>

              {/* Configuration Form */}
              <div className="space-y-6">
                {/* 1. Size */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Розмір <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={config.size}
                    onChange={(e) => handleChange('size', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                  >
                    {availableSizes.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Page Color */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Колір сторінок <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={config.pageColor}
                    onChange={(e) => handleChange('pageColor', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                  >
                    <option value="Білі">Білі</option>
                    <option value="Чорні">Чорні</option>
                    <option value="Кремові">Кремові</option>
                  </select>
                </div>

                {/* 3. Cover Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Вид обкладинки <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={config.coverType}
                    onChange={(e) => handleChange('coverType', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                  >
                    {coverTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Cover Color (depends on Cover Type) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Колір обкладинки <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={config.coverColor}
                    onChange={(e) => handleChange('coverColor', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                    disabled={!config.coverType}
                  >
                    {(coverColorsByType[config.coverType] || []).map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>

                {/* 5. Add Names */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Чи додавати імена?
                  </label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addNames"
                        checked={config.addNames === true}
                        onChange={() => handleChange('addNames', true)}
                        className="w-4 h-4 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                      />
                      <span className="text-gray-700">Так</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addNames"
                        checked={config.addNames === false}
                        onChange={() => handleChange('addNames', false)}
                        className="w-4 h-4 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                      />
                      <span className="text-gray-700">Ні</span>
                    </label>
                  </div>
                  {config.addNames && (
                    <div>
                      <input
                        type="text"
                        value={config.names}
                        onChange={(e) => handleChange('names', e.target.value)}
                        placeholder="Введіть імена..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Вводьте тією мовою, якою імена мають бути надруковані
                      </p>
                    </div>
                  )}
                </div>

                {/* 6. Add Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Чи додавати дату?
                  </label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addDate"
                        checked={config.addDate === true}
                        onChange={() => handleChange('addDate', true)}
                        className="w-4 h-4 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                      />
                      <span className="text-gray-700">Так</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addDate"
                        checked={config.addDate === false}
                        onChange={() => handleChange('addDate', false)}
                        className="w-4 h-4 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                      />
                      <span className="text-gray-700">Ні</span>
                    </label>
                  </div>
                  {config.addDate && (
                    <div>
                      <input
                        type="text"
                        value={config.date}
                        onChange={(e) => handleChange('date', e.target.value)}
                        placeholder="Введіть дату..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Напишіть дату саме у тому форматі, як має бути надруковано
                      </p>
                    </div>
                  )}
                </div>

                {/* 7. Add Other Text */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Чи додавати інший текст?
                  </label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addOtherText"
                        checked={config.addOtherText === true}
                        onChange={() => handleChange('addOtherText', true)}
                        className="w-4 h-4 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                      />
                      <span className="text-gray-700">Так</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addOtherText"
                        checked={config.addOtherText === false}
                        onChange={() => handleChange('addOtherText', false)}
                        className="w-4 h-4 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                      />
                      <span className="text-gray-700">Ні</span>
                    </label>
                  </div>
                  {config.addOtherText && (
                    <div>
                      <input
                        type="text"
                        value={config.otherText}
                        onChange={(e) => handleChange('otherText', e.target.value)}
                        placeholder="Введіть текст..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]"
                      />
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-2">Приклади:</p>
                        <div className="flex flex-wrap gap-2">
                          {TEXT_SUGGESTIONS.map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => handleChange('otherText', suggestion)}
                              className="px-3 py-1.5 text-xs bg-[#f0f2f8] text-[#1e2d7d] rounded-full hover:bg-[#dbeafe] transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 8. Text Color */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Колір надписів <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {TEXT_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => handleChange('textColor', color.name)}
                        className={`flex items-center gap-2 px-3 py-2 border-2 rounded-lg transition-colors ${
                          config.textColor === color.name
                            ? 'border-[#1e2d7d] bg-[#f0f2f8]'
                            : 'border-gray-300 hover:border-[#1e2d7d]/40'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-gray-300"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-xs font-medium text-gray-700">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 9. Cover Finish */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Обкладинка <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={config.coverFinish}
                    onChange={(e) => handleChange('coverFinish', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                  >
                    <option value="Матова">Матова</option>
                    <option value="Глянцева">Глянцева</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            /* Summary Screen */
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">
                Перевірте вашу конфігурацію перед продовженням до завантаження фотографій.
              </p>

              <div className="bg-[#f0f2f8] rounded-xl p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Обрані параметри
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Розмір:</span>
                    <span className="text-sm font-semibold text-gray-800">{config.size}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Колір сторінок:</span>
                    <span className="text-sm font-semibold text-gray-800">{config.pageColor}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Вид обкладинки:</span>
                    <span className="text-sm font-semibold text-gray-800">{config.coverType}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Колір обкладинки:</span>
                    <span className="text-sm font-semibold text-gray-800">{config.coverColor}</span>
                  </div>
                  {config.addNames && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Імена:</span>
                      <span className="text-sm font-semibold text-gray-800">{config.names}</span>
                    </div>
                  )}
                  {config.addDate && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Дата:</span>
                      <span className="text-sm font-semibold text-gray-800">{config.date}</span>
                    </div>
                  )}
                  {config.addOtherText && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Інший текст:</span>
                      <span className="text-sm font-semibold text-gray-800">{config.otherText}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Колір надписів:</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border border-gray-300"
                        style={{ backgroundColor: getSelectedColor() }}
                      />
                      <span className="text-sm font-semibold text-gray-800">{config.textColor}</span>
                    </div>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-600">Обкладинка:</span>
                    <span className="text-sm font-semibold text-gray-800">{config.coverFinish}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 rounded-b-2xl z-10">
          <button
            onClick={handleBack}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            {currentStep === 'summary' ? 'Назад до редагування' : 'Скасувати'}
          </button>
          <button
            onClick={handleContinue}
            disabled={currentStep === 'form' && !isFormValid()}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
              currentStep === 'form' && !isFormValid()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#1e2d7d] text-white hover:bg-[#263a99]'
            }`}
          >
            {currentStep === 'form' ? 'Переглянути підсумок →' : 'Продовжити до завантаження фото →'}
          </button>
        </div>
      </div>
    </div>
  );
}
