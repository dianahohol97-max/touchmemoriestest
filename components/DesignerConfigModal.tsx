'use client';

import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

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

const PHOTO_RECOMMENDATIONS: Record<number, string> = {
  6: '7-10 фото', 8: '9-12 фото', 10: '11-16 фото', 12: '13-18 фото',
  16: '17-22 фото', 20: '21-26 фото', 24: '25-35 фото', 28: '29-40 фото',
  32: '33-45 фото', 36: '37-50 фото', 40: '41-60 фото', 44: '45-65 фото',
  48: '49-70 фото', 50: '51-75 фото',
};

const PRODUCT_CONFIGS: Record<string, ProductAttribute[]> = {
  photobook: [
    { key: 'size', label: 'Розмір', type: 'select', options: ['20×20 см', '25×25 см', '20×30 см', '30×20 см', '30×30 см'], required: true, defaultValue: '20×20 см' },
    { key: 'pages', label: 'Кількість сторінок', type: 'select', options: ['6','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36','38','40','42','44','46','48','50'], required: true, defaultValue: '20' },
    { key: 'coverType', label: 'Тип обкладинки', type: 'select', options: ['Друкована', 'Велюр', 'Шкірзамінник', 'Тканина'], required: true, defaultValue: 'Друкована' },
    { key: 'tracingPaper', label: 'Калька перед першою сторінкою', type: 'select', options: ['Без кальки', 'З калькою'], required: false, defaultValue: 'Без кальки' },
  ],
  magazine: [
    { key: 'size', label: 'Розмір', type: 'select', options: ['A4 (21×29.7 см)'], required: true, defaultValue: 'A4 (21×29.7 см)' },
    { key: 'pages', label: 'Кількість сторінок', type: 'select', options: ['12','16','20','24','28','32','36','40','44','48','52','60','72','80'], required: true, defaultValue: '20' },
    { key: 'coverType', label: 'Тип обкладинки', type: 'select', options: ["М'яка обкладинка", 'Тверда обкладинка'], required: true, defaultValue: "М'яка обкладинка" },
  ],
  travelbook: [
    { key: 'size', label: 'Розмір', type: 'select', options: ['A4 (21×29.7 см)'], required: true, defaultValue: 'A4 (21×29.7 см)' },
    { key: 'pages', label: 'Кількість сторінок', type: 'select', options: ['12','16','20','24','28','32','36','40','44','48','52','60','72','80'], required: true, defaultValue: '20' },
  ],
};

// Decoration options per cover type
const DECORATIONS: Record<string, { value: string; label: string }[]> = {
  'Велюр': [
    { value: 'none', label: 'Без оздоблення' },
    { value: 'acryl', label: 'Акрил' },
    { value: 'photovstavka', label: 'Фотовставка' },
    { value: 'metal', label: 'Металева вставка' },
    { value: 'flex', label: 'Флекс' },
    { value: 'graviruvannya', label: 'Гравірування' },
  ],
  'Шкірзамінник': [
    { value: 'none', label: 'Без оздоблення' },
    { value: 'acryl', label: 'Акрил' },
    { value: 'photovstavka', label: 'Фотовставка' },
    { value: 'metal', label: 'Металева вставка' },
    { value: 'flex', label: 'Флекс' },
  ],
  'Тканина': [
    { value: 'none', label: 'Без оздоблення' },
    { value: 'acryl', label: 'Акрил' },
    { value: 'photovstavka', label: 'Фотовставка' },
    { value: 'flex', label: 'Флекс' },
  ],
};

const DECORATION_SUBTYPES: Record<string, { value: string; label: string }[]> = {
  'acryl': [
    { value: 'acryl_100x100', label: 'Акрил 100×100 мм' },
    { value: 'acryl_145', label: 'Акрил Ø145 мм' },
  ],
  'photovstavka': [
    { value: 'photo_100x100', label: 'Фотовставка 100×100 мм' },
  ],
  'metal': [
    { value: 'metal_60x60_gold', label: '60×60 золотий' },
    { value: 'metal_60x60_silver', label: '60×60 срібний' },
    { value: 'metal_90x50_gold', label: '90×50 золотий' },
    { value: 'metal_90x50_silver', label: '90×50 срібний' },
  ],
};

export default function DesignerConfigModal({ isOpen, onClose, productType, productName }: DesignerConfigModalProps) {
  const router = useRouter();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [photoRecommendation, setPhotoRecommendation] = useState('');

  // Cover colors & decoration
  const [coverColors, setCoverColors] = useState<any[]>([]);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedDecoration, setSelectedDecoration] = useState('none');
  const [selectedDecoVariant, setSelectedDecoVariant] = useState('');

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const attributes = PRODUCT_CONFIGS[productType] || [];
  const coverType = config.coverType || '';
  const showColorAndDecoration = productType === 'photobook' && ['Велюр', 'Шкірзамінник', 'Тканина'].includes(coverType);
  const decoOptions = DECORATIONS[coverType] || [];
  const decoSubtypes = DECORATION_SUBTYPES[selectedDecoration] || [];

  // Initialize config
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, any> = {};
      attributes.forEach(attr => { initial[attr.key] = attr.defaultValue; });
      setConfig(initial);
      setSelectedColor(null);
      setSelectedDecoration('none');
      setSelectedDecoVariant('');
      const pagesAttr = attributes.find(a => a.key === 'pages');
      if (pagesAttr?.defaultValue) setPhotoRecommendation(PHOTO_RECOMMENDATIONS[parseInt(pagesAttr.defaultValue)] || '');
    }
  }, [isOpen, productType]);

  // Fetch cover colors
  useEffect(() => {
    if (!isOpen || productType !== 'photobook') return;
    async function fetchColors() {
      const { data } = await supabase
        .from('cover_colors')
        .select('*, cover_type:cover_types(id, name)')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (data) setCoverColors(data);
    }
    fetchColors();
  }, [isOpen, productType, supabase]);

  // Update photo rec on pages change
  useEffect(() => {
    if (config.pages) setPhotoRecommendation(PHOTO_RECOMMENDATIONS[parseInt(config.pages)] || '');
  }, [config.pages]);

  // Reset color & decoration when cover type changes
  useEffect(() => {
    setSelectedColor(null);
    setSelectedDecoration('none');
    setSelectedDecoVariant('');
  }, [coverType]);

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const filteredColors = coverColors.filter((c: any) => c.cover_type?.name === coverType);

  const handleContinue = () => {
    const params = new URLSearchParams();

    // Map config to URL params
    if (config.size) params.set('size', config.size.replace(/\s*см$/, '').replace(/[()]/g, '').trim());
    if (config.pages) params.set('pages', config.pages);
    if (config.coverType) params.set('cover', config.coverType);
    if (config.tracingPaper) params.set('tracing', config.tracingPaper === 'З калькою' ? 'with' : 'none');
    if (config.lamination) params.set('lamination', config.lamination);
    if (selectedColor) params.set('color', selectedColor.code);
    if (selectedDecoration !== 'none') params.set('decoration', selectedDecoration);
    if (selectedDecoVariant) params.set('decoration_variant', selectedDecoVariant);

    // Determine product slug
    let productSlug = 'photobook-velour';
    if (productType === 'photobook') {
      if (coverType === 'Друкована') productSlug = 'photobook-printed';
      else if (coverType === 'Шкірзамінник') productSlug = 'photobook-leatherette';
      else if (coverType === 'Тканина') productSlug = 'photobook-fabric';
      else productSlug = 'photobook-velour';
    } else if (productType === 'magazine') {
      productSlug = coverType.includes('Тверда') ? 'fotozhurnal-tverd-obkladynka' : 'personalized-glossy-magazine';
    } else {
      productSlug = 'travelbook-20x30';
    }

    params.set('product', productSlug);

    // Store in session too
    sessionStorage.setItem('designerOrderConfig', JSON.stringify({
      productType, productName, config,
      coverColor: selectedColor, decoration: selectedDecoration,
      decorationVariant: selectedDecoVariant, timestamp: Date.now()
    }));

    router.push(`/order/book?${params.toString()}`);
    onClose();
  };

  const isFormValid = () => attributes.filter(a => a.required).every(a => config[a.key] && config[a.key] !== '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d7d]">Налаштування замовлення</h2>
            {productName && <p className="text-sm text-gray-500 mt-1">{productName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-600 mb-6">Оберіть параметри вашого виробу. Після підтвердження ви зможете завантажити фотографії.</p>

          <div className="space-y-6">
            {/* Standard attributes */}
            {attributes.map((attr) => (
              <div key={attr.key}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {attr.label}{attr.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {attr.type === 'select' && (
                  <select value={config[attr.key] || ''} onChange={(e) => handleConfigChange(attr.key, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white">
                    {attr.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {attr.type === 'boolean' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={config[attr.key] || false} onChange={(e) => handleConfigChange(attr.key, e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-[#1e2d7d] focus:ring-[#1e2d7d]" />
                    <span className="text-gray-700">Так</span>
                  </label>
                )}
              </div>
            ))}

            {/* ── Cover Color Picker ── */}
            {showColorAndDecoration && filteredColors.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Колір обкладинки: <span className="font-normal text-gray-500">{selectedColor?.name || 'оберіть колір'}</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {filteredColors.map((c: any) => (
                    <button key={c.id} type="button" title={`${c.name} (${c.code})`}
                      onClick={() => setSelectedColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor?.id === c.id ? 'border-[#1e2d7d] scale-110 shadow-md' : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ backgroundColor: c.hex_approx }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Decoration Type ── */}
            {showColorAndDecoration && decoOptions.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Оздоблення обкладинки</label>
                <div className="flex flex-wrap gap-2">
                  {decoOptions.map(d => (
                    <button key={d.value} type="button"
                      onClick={() => { setSelectedDecoration(d.value); setSelectedDecoVariant(''); }}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        selectedDecoration === d.value
                          ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d]'
                      }`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Decoration Subtype ── */}
            {showColorAndDecoration && decoSubtypes.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Варіант {DECORATIONS[coverType]?.find(d => d.value === selectedDecoration)?.label.toLowerCase()}
                </label>
                <div className="flex flex-wrap gap-2">
                  {decoSubtypes.map(s => (
                    <button key={s.value} type="button"
                      onClick={() => setSelectedDecoVariant(s.value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        selectedDecoVariant === s.value
                          ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d]'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Photo Recommendation */}
          {photoRecommendation && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-1">Рекомендована кількість фото</p>
              <p className="text-sm text-blue-700">Для {config.pages} сторінок рекомендуємо підготувати <strong>{photoRecommendation}</strong></p>
              <p className="text-xs text-blue-600 mt-2">Це орієнтовна кількість — ви можете завантажити більше або менше фото.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            Скасувати
          </button>
          <button onClick={handleContinue} disabled={!isFormValid()}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
              isFormValid() ? 'bg-[#1e2d7d] text-white hover:bg-[#263a99]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}>
            Продовжити до завантаження фото →
          </button>
        </div>
      </div>
    </div>
  );
}
