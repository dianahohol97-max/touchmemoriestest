'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Layout, Book, Plane, FileText, Calendar } from 'lucide-react';
import { getConstructorUrl, ProductType } from '@/lib/constructorRouting';

interface ConstructorConfig {
  productType: string;
  format?: string;
  pages?: number;
  coverType?: string;
  tier?: string;
  [key: string]: unknown;
}

const WIZARD_COPY: Record<string, { title: string; subtitle: string; smartLabel: string; manualLabel: string }> = {
  photobook: {
    title: 'Фотокнига',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка фото — просто завантажте фото',
    manualLabel: 'Ручне редагування — обираю макет сам',
  },
  'photobook-standard': {
    title: 'Фотокнига Стандарт',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка фото — просто завантажте фото',
    manualLabel: 'Ручне редагування — обираю макет сам',
  },
  'photobook-premium': {
    title: 'Фотокнига Преміум',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка фото — просто завантажте фото',
    manualLabel: 'Ручне редагування — обираю макет сам',
  },
  travelbook: {
    title: 'Travel Book',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка — завантажте фото з подорожі',
    manualLabel: 'Ручне редагування — хочу обрати кожен макет',
  },
  magazine: {
    title: 'Глянцевий журнал',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка — завантажте фото',
    manualLabel: 'Ручне редагування — редагую як у Canva',
  },
  'photo-journal-soft': {
    title: 'Фотожурнал (м\'яка обкладинка)',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка — завантажте фото',
    manualLabel: 'Ручне редагування — обираю макет сам',
  },
  'photo-journal-hard': {
    title: 'Фотожурнал (тверда обкладинка)',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка — завантажте фото',
    manualLabel: 'Ручне редагування — обираю макет сам',
  },
  calendar: {
    title: 'Календар',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка — один фото на місяць',
    manualLabel: 'Ручне редагування — обираю самостійно',
  },
  'calendar-desktop': {
    title: 'Настільний календар',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка — один фото на місяць',
    manualLabel: 'Ручне редагування — обираю самостійно',
  },
  'calendar-wall': {
    title: 'Настінний календар',
    subtitle: 'Оберіть спосіб створення',
    smartLabel: 'Авторозстановка — один фото на місяць',
    manualLabel: 'Ручне редагування — обираю самостійно',
  },
};

const PRODUCT_OPTIONS = [
  { id: 'photobook', name: 'Фотокнига', icon: Book, color: 'blue' },
  { id: 'travelbook', name: 'Travel Book', icon: Plane, color: 'green' },
  { id: 'magazine', name: 'Глянцевий журнал', icon: FileText, color: 'purple' },
  { id: 'calendar', name: 'Календар', icon: Calendar, color: 'orange' },
];

export default function WizardPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ConstructorConfig | null>(null);
  const [copy, setCopy] = useState(WIZARD_COPY.photobook);
  const [showProductSelector, setShowProductSelector] = useState(false);

  useEffect(() => {
    // Load config from sessionStorage
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('constructorConfig');
      if (saved) {
        try {
          const parsedConfig = JSON.parse(saved) as ConstructorConfig;
          setConfig(parsedConfig);

          // Set copy based on product type
          const productCopy = WIZARD_COPY[parsedConfig.productType] || WIZARD_COPY.photobook;
          setCopy(productCopy);
        } catch (e) {
          console.error('Failed to parse constructor config:', e);
          // Show product selector instead of redirecting
          setShowProductSelector(true);
        }
      } else {
        // No config found, show product selector
        setShowProductSelector(true);
      }
    }
  }, [router]);

  const handleProductSelection = (productType: string) => {
    // Create a minimal config for the selected product
    const newConfig: ConstructorConfig = {
      productType,
      format: '20x20', // Default format
      pages: 20, // Default pages
    };

    setConfig(newConfig);
    setShowProductSelector(false);

    // Set copy based on product type
    const productCopy = WIZARD_COPY[productType] || WIZARD_COPY.photobook;
    setCopy(productCopy);

    // Save to sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('constructorConfig', JSON.stringify(newConfig));
    }
  };

  const handleModeSelection = (mode: 'smart' | 'manual') => {
    if (!config) return;

    // Update config with selected mode
    const updatedConfig = {
      ...config,
      mode,
    };

    // Save updated config
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('constructorConfig', JSON.stringify(updatedConfig));
    }

    // Navigate to the appropriate constructor
    const url = getConstructorUrl(config.productType as ProductType);
    router.push(url);
  };

  // Product Selector UI
  if (showProductSelector) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
              Оберіть тип продукту
            </h1>
            <p className="text-xl text-gray-600">
              Що ви хочете створити?
            </p>
          </div>

          {/* Product Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRODUCT_OPTIONS.map((product) => {
              const Icon = product.icon;
              const colorClasses = {
                blue: 'border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100',
                green: 'border-green-500 bg-green-50 text-green-600 hover:bg-green-100',
                purple: 'border-purple-500 bg-purple-50 text-purple-600 hover:bg-purple-100',
                orange: 'border-orange-500 bg-orange-50 text-orange-600 hover:bg-orange-100',
              }[product.color];

              return (
                <button
                  key={product.id}
                  onClick={() => handleProductSelection(product.id)}
                  className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:${colorClasses} text-left`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`p-3 rounded-xl ${colorClasses}`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {product.name}
                    </h2>
                  </div>

                  <div className="flex items-center justify-center py-3 bg-gray-900 text-white rounded-lg font-semibold group-hover:bg-gray-800 transition-colors">
                    Обрати →
                  </div>
                </button>
              );
            })}
          </div>

          {/* Back Button */}
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/catalog')}
              className="text-gray-600 hover:text-gray-900 underline text-sm"
            >
              ← Повернутись до каталогу
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Завантаження...</p>
        </div>
      </div>
    );
  }

  // Mode Selection UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
            {copy.title}
          </h1>
          <p className="text-xl text-gray-600">
            {copy.subtitle}
          </p>
        </div>

        {/* Mode Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Smart Mode Card */}
          <button
            onClick={() => handleModeSelection('smart')}
            className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-blue-500 text-left"
          >
            <div className="absolute top-6 right-6">
              <Sparkles className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
            </div>

            <div className="mb-6">
              <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-4">
                РЕКОМЕНДОВАНО
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Smart режим
              </h2>
              <p className="text-gray-600 leading-relaxed">
                {copy.smartLabel}
              </p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Автоматичне розміщення фото</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Швидке створення за 5 хвилин</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Підходить для початківців</span>
              </li>
            </ul>

            <div className="flex items-center justify-center py-3 bg-blue-600 text-white rounded-lg font-semibold group-hover:bg-blue-700 transition-colors">
              Обрати Smart режим
            </div>
          </button>

          {/* Manual Mode Card */}
          <button
            onClick={() => handleModeSelection('manual')}
            className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-purple-500 text-left"
          >
            <div className="absolute top-6 right-6">
              <Layout className="w-8 h-8 text-purple-500 group-hover:scale-110 transition-transform" />
            </div>

            <div className="mb-6">
              <div className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold mb-4">
                ДЛЯ ТВОРЧИХ
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Manual режим
              </h2>
              <p className="text-gray-600 leading-relaxed">
                {copy.manualLabel}
              </p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Повний контроль над макетом</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Професійний редактор як Canva</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Унікальний дизайн</span>
              </li>
            </ul>

            <div className="flex items-center justify-center py-3 bg-purple-600 text-white rounded-lg font-semibold group-hover:bg-purple-700 transition-colors">
              Обрати Manual режим
            </div>
          </button>

        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/catalog')}
            className="text-gray-600 hover:text-gray-900 underline text-sm"
          >
            ← Повернутись до каталогу
          </button>
        </div>
      </div>
    </div>
  );
}
