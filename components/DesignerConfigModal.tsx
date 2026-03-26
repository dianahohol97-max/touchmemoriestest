'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProductAttribute {
  key: string;
  label: string;
  type: 'select' | 'color' | 'boolean' | 'number' | 'text';
  options?: string[];
  required?: boolean;
  defaultValue?: any;
}

interface DesignerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  productType: 'photobook' | 'magazine' | 'travelbook';
  productName?: string;
}

// Photo count recommendations based on page count
const PHOTO_RECOMMENDATIONS: Record<number, string> = {
  12: '13-18 фото',
  16: '17-22 фото',
  20: '21-26 фото',
  24: '25-35 фото',
  28: '29-40 фото',
  32: '33-45 фото',
  36: '37-50 фото',
  40: '41-60 фото',
  44: '45-65 фото',
  48: '49-70 фото',
  52: '53-75 фото',
  60: '61-85 фото',
  72: '73-105 фото',
  80: '81-120 фото',
};

// Product-specific configurations
const PRODUCT_CONFIGS: Record<string, ProductAttribute[]> = {
  photobook: [
    {
      key: 'size',
      label: 'Розмір',
      type: 'select',
      options: ['20×20 см', '25×25 см', '20×30 см', '30×20 см', '30×30 см'],
      required: true,
      defaultValue: '20×20 см'
    },
    {
      key: 'pages',
      label: 'Кількість сторінок',
      type: 'select',
      options: ['6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50'],
      required: true,
      defaultValue: '20'
    },
    {
      key: 'coverType',
      label: 'Тип обкладинки',
      type: 'select',
      options: ['Друкована обкладинка', 'Велюр', 'Шкірзам', 'Тканина'],
      required: true,
      defaultValue: 'Друкована обкладинка'
    },
    {
      key: 'tracingPaper',
      label: 'Калька перед першою сторінкою',
      type: 'select',
      options: ['Без кальки', 'З калькою'],
      required: false,
      defaultValue: 'Без кальки'
    }
  ],
  magazine: [
    {
      key: 'size',
      label: 'Розмір',
      type: 'select',
      options: ['A4 (21×29.7 см)'],
      required: true,
      defaultValue: 'A4 (21×29.7 см)'
    },
    {
      key: 'pages',
      label: 'Кількість сторінок',
      type: 'select',
      options: ['12', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '60', '72', '80'],
      required: true,
      defaultValue: '20'
    },
    {
      key: 'coverType',
      label: 'Тип обкладинки',
      type: 'select',
      options: ['М\'яка обкладинка', 'Тверда обкладинка'],
      required: true,
      defaultValue: 'М\'яка обкладинка'
    }
  ],
  travelbook: [
    {
      key: 'size',
      label: 'Розмір',
      type: 'select',
      options: ['A4 (21×29.7 см)'],
      required: true,
      defaultValue: 'A4 (21×29.7 см)'
    },
    {
      key: 'pages',
      label: 'Кількість сторінок',
      type: 'select',
      options: ['12', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '60', '72', '80'],
      required: true,
      defaultValue: '20'
    },
    {
      key: 'lamination',
      label: 'Ламінація',
      type: 'select',
      options: ['Без ламінації', 'З ламінацією сторінок'],
      required: false,
      defaultValue: 'Без ламінації'
    }
  ]
};

export default function DesignerConfigModal({ isOpen, onClose, productType, productName }: DesignerConfigModalProps) {
  const router = useRouter();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [photoRecommendation, setPhotoRecommendation] = useState<string>('');

  const attributes = PRODUCT_CONFIGS[productType] || [];

  useEffect(() => {
    if (isOpen) {
      // Initialize with default values
      const initialConfig: Record<string, any> = {};
      attributes.forEach(attr => {
        initialConfig[attr.key] = attr.defaultValue;
      });
      setConfig(initialConfig);

      // Set initial photo recommendation if pages field exists
      const pagesAttr = attributes.find(a => a.key === 'pages');
      if (pagesAttr?.defaultValue) {
        const pageCount = parseInt(pagesAttr.defaultValue);
        setPhotoRecommendation(PHOTO_RECOMMENDATIONS[pageCount] || '');
      }
    }
  }, [isOpen, productType]);

  useEffect(() => {
    // Update photo recommendation when pages change
    if (config.pages) {
      const pageCount = parseInt(config.pages);
      setPhotoRecommendation(PHOTO_RECOMMENDATIONS[pageCount] || '');
    }
  }, [config.pages]);

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleContinue = () => {
    // Store configuration in sessionStorage
    const orderConfig = {
      productType,
      productName,
      config,
      timestamp: Date.now()
    };
    sessionStorage.setItem('designerOrderConfig', JSON.stringify(orderConfig));

    // Navigate to order page
    router.push('/order');
    onClose();
  };

  const isFormValid = () => {
    return attributes
      .filter(attr => attr.required)
      .every(attr => config[attr.key] && config[attr.key] !== '');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d7d]">Налаштування замовлення</h2>
            {productName && <p className="text-sm text-gray-500 mt-1">{productName}</p>}
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
          <p className="text-gray-600 mb-6">
            Оберіть параметри вашого виробу. Після підтвердження ви зможете завантажити фотографії.
          </p>

          {/* Configuration Options */}
          <div className="space-y-6">
            {attributes.map((attr) => (
              <div key={attr.key}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {attr.label}
                  {attr.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {attr.type === 'select' && (
                  <select
                    value={config[attr.key] || ''}
                    onChange={(e) => handleConfigChange(attr.key, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white"
                  >
                    {attr.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {attr.type === 'boolean' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config[attr.key] || false}
                      onChange={(e) => handleConfigChange(attr.key, e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-[#1e2d7d] focus:ring-[#1e2d7d]"
                    />
                    <span className="text-gray-700">Так</span>
                  </label>
                )}
              </div>
            ))}
          </div>

          {/* Photo Recommendation */}
          {photoRecommendation && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                📸 Рекомендована кількість фото
              </p>
              <p className="text-sm text-blue-700">
                Для {config.pages} сторінок рекомендуємо підготувати <strong>{photoRecommendation}</strong>
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Це орієнтовна кількість — ви можете завантажити більше або менше фото.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={handleContinue}
            disabled={!isFormValid()}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
              isFormValid()
                ? 'bg-[#1e2d7d] text-white hover:bg-[#263a99]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Продовжити до завантаження фото →
          </button>
        </div>
      </div>
    </div>
  );
}
