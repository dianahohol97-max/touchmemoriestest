'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

interface DesignerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  productType: 'photobook' | 'magazine' | 'travelbook';
  productName?: string;
  productSlug?: string; // Optional — if provided, fetch options from DB
}

const PHOTO_RECOMMENDATIONS: Record<number, string> = {
  6: '7-10 фото', 8: '9-12 фото', 10: '11-16 фото', 12: '13-18 фото',
  16: '17-22 фото', 20: '21-26 фото', 24: '25-35 фото', 28: '29-40 фото',
  32: '33-45 фото', 36: '37-50 фото', 40: '41-60 фото', 44: '45-65 фото',
  48: '49-70 фото', 50: '51-75 фото',
};

// Slug → default product slug mapping (when productSlug not provided)
const TYPE_TO_SLUG: Record<string, string> = {
  photobook: 'photobook-velour',
  magazine: 'personalized-glossy-magazine',
  travelbook: 'travelbook-20x30',
};

// Cover types that get color picker + decoration
const DECORATED_COVERS = ['Велюр', 'Шкірзамінник', 'Тканина'];

const DECORATIONS: Record<string, { value: string; label: string }[]> = {
  'Велюр': [
    { value: 'none', label: 'Без оздоблення' }, { value: 'acryl', label: 'Акрил' },
    { value: 'photovstavka', label: 'Фотовставка' }, { value: 'metal', label: 'Металева вставка' },
    { value: 'flex', label: 'Флекс' }, { value: 'graviruvannya', label: 'Гравірування' },
  ],
  'Шкірзамінник': [
    { value: 'none', label: 'Без оздоблення' }, { value: 'acryl', label: 'Акрил' },
    { value: 'photovstavka', label: 'Фотовставка' }, { value: 'metal', label: 'Металева вставка' },
    { value: 'flex', label: 'Флекс' },
  ],
  'Тканина': [
    { value: 'none', label: 'Без оздоблення' }, { value: 'acryl', label: 'Акрил' },
    { value: 'photovstavka', label: 'Фотовставка' }, { value: 'flex', label: 'Флекс' },
  ],
};

const DECO_SUBTYPES: Record<string, { value: string; label: string }[]> = {
  acryl: [{ value: 'acryl_100x100', label: 'Акрил 100×100 мм' }, { value: 'acryl_145', label: 'Акрил Ø145 мм' }],
  photovstavka: [{ value: 'photo_100x100', label: 'Фотовставка 100×100 мм' }],
  metal: [
    { value: 'metal_60x60_gold', label: '60×60 золотий' }, { value: 'metal_60x60_silver', label: '60×60 срібний' },
    { value: 'metal_90x50_gold', label: '90×50 золотий' }, { value: 'metal_90x50_silver', label: '90×50 срібний' },
  ],
};

export default function DesignerConfigModal({ isOpen, onClose, productType, productName, productSlug: slugProp }: DesignerConfigModalProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Cover type selection step (for photobooks and magazines without a fixed slug)
  const needsCoverSelection = (productType === 'photobook' || productType === 'magazine') && !slugProp;
  const COVER_OPTIONS = productType === 'magazine' ? [
    { slug: 'personalized-glossy-magazine', label: 'М\'яка обкладинка', desc: 'Глянцева м\'яка обкладинка', icon: '' },
    { slug: 'fotozhurnal-tverd-obkladynka', label: 'Тверда обкладинка', desc: 'Тверда обкладинка преміум', icon: '' },
  ] : [
    { slug: 'photobook-velour', label: 'Велюр', desc: 'М\'який оксамитовий матеріал', icon: '' },
    { slug: 'photobook-leatherette', label: 'Шкірзамінник', desc: 'Елегантна шкіра', icon: '' },
    { slug: 'photobook-fabric', label: 'Тканина', desc: 'Натуральна льняна тканина', icon: '' },
    { slug: 'photobook-printed', label: 'Друкована', desc: 'Фото на всю обкладинку', icon: '' },
  ];
  const [selectedCoverSlug, setSelectedCoverSlug] = useState('');
  const [coverStepDone, setCoverStepDone] = useState(false);

  const slug = slugProp || (needsCoverSelection ? selectedCoverSlug : TYPE_TO_SLUG[productType]) || '';
  const isPhotobook = productType === 'photobook';

  const [dbProduct, setDbProduct] = useState<any>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [coverColors, setCoverColors] = useState<any[]>([]);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedDeco, setSelectedDeco] = useState('none');
  const [selectedDecoVariant, setSelectedDecoVariant] = useState('');
  const [photoRec, setPhotoRec] = useState('');

  // Fetch product from DB
  useEffect(() => {
    if (!isOpen || !slug) return;
    async function fetch() {
      const { data } = await supabase.from('products').select('*').eq('slug', slug).eq('is_active', true).single();
      if (data) {
        setDbProduct(data);
        // Init config with first option of each group
        const init: Record<string, any> = {};
        if (data.options && Array.isArray(data.options)) {
          data.options.forEach((opt: any) => {
            const items = opt.options || opt.values || [];
            if (items.length > 0) init[opt.name] = items[0].value ?? items[0].name ?? items[0];
          });
        }
        setConfig(init);
        // Photo rec
        const pagesOpt = (data.options || []).find((o: any) => o.name?.includes('сторінок'));
        const firstPages = pagesOpt?.options?.[0]?.value || pagesOpt?.values?.[0] || '20';
        setPhotoRec(PHOTO_RECOMMENDATIONS[parseInt(firstPages)] || '');
      }
    }
    fetch();
    // Fetch cover colors for photobooks
    if (isPhotobook) {
      supabase.from('cover_colors').select('*, cover_type:cover_types(id, name)').eq('active', true)
        .order('sort_order', { ascending: true }).then(({ data }) => { if (data) setCoverColors(data); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, slug]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedColor(null); setSelectedDeco('none'); setSelectedDecoVariant('');
      if (needsCoverSelection) { setSelectedCoverSlug(''); setCoverStepDone(false); }
    }
  }, [isOpen]);

  // Update photo rec when pages change
  useEffect(() => {
    const pages = config['Кількість сторінок'];
    if (pages) setPhotoRec(PHOTO_RECOMMENDATIONS[parseInt(String(pages))] || '');
  }, [config['Кількість сторінок']]);

  const handleChange = (name: string, value: any) => setConfig(prev => ({ ...prev, [name]: value }));

  // Determine cover type from config or slug
  const coverType = config['Тип обкладинки'] || (slug.includes('velour') ? 'Велюр' : slug.includes('leather') ? 'Шкірзамінник' : slug.includes('fabric') ? 'Тканина' : '');
  const showColorAndDeco = isPhotobook && DECORATED_COVERS.includes(coverType);
  const filteredColors = coverColors.filter((c: any) => c.cover_type?.name === coverType);
  const decoOptions = DECORATIONS[coverType] || [];
  const decoSubs = DECO_SUBTYPES[selectedDeco] || [];

  // Calculate price
  const basePrice = dbProduct?.price || 0;
  let totalPrice = basePrice;
  if (dbProduct?.options && Array.isArray(dbProduct.options)) {
    dbProduct.options.forEach((opt: any) => {
      const selected = config[opt.name];
      if (selected === undefined) return;
      const items = opt.options || opt.values || [];
      const match = items.find((i: any) => (i.value ?? i.name ?? i) === selected);
      if (match?.price) totalPrice += Number(match.price);
    });
  }

  const handleContinue = () => {
    const keyMap: Record<string, string> = {
      'Розмір': 'size', 'Кількість сторінок': 'pages', 'Тип ламінації': 'lamination',
      'Калька перед першою сторінкою': 'tracing', 'Тип обкладинки': 'cover',
      'Верстка тексту': 'text_layout', 'Корінець': 'spine', 'Оздоблення': 'decoration',
    };
    const params = new URLSearchParams();
    params.set('product', slug);
    Object.entries(config).forEach(([key, val]) => {
      if (val !== undefined && val !== '') params.set(keyMap[key] || key, String(val));
    });
    if (selectedColor) params.set('color', selectedColor.code);
    if (selectedDeco !== 'none') params.set('decoration', selectedDeco);
    if (selectedDecoVariant) params.set('decoration_variant', selectedDecoVariant);

    sessionStorage.setItem('designerOrderConfig', JSON.stringify({
      productType, productName: dbProduct?.name || productName, slug, config,
      coverColor: selectedColor, decoration: selectedDeco, decorationVariant: selectedDecoVariant,
      totalPrice, timestamp: Date.now(),
    }));

    router.push(`/order/designer?${params.toString()}`);
    onClose();
  };

  if (!isOpen) return null;

  const options = (dbProduct?.options || []) as any[];
  const displayName = dbProduct?.name || productName || 'Продукт';

  // Cover selection step for photobooks
  if (needsCoverSelection && !coverStepDone) {
    const coverStepContent = (
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ zIndex: 99999 }}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div>
              <h2 className="text-2xl font-bold text-[#1e2d7d]">
                {productType === 'magazine' ? 'Тип обкладинки журналу' : 'Тип обкладинки'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {productType === 'magazine' ? 'Глянцевий журнал з дизайнером' : 'Фотокнига з дизайнером'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
          </div>
          <div className="px-6 py-6">
            <p className="text-gray-600 mb-6">Оберіть тип обкладинки. Наш дизайнер створить макет після підтвердження.</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {COVER_OPTIONS.map(opt => (
                <button key={opt.slug}
                  onClick={() => setSelectedCoverSlug(opt.slug)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedCoverSlug === opt.slug
                      ? 'border-[#1e2d7d] bg-[#f0f3ff]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <div className={`font-bold text-sm ${selectedCoverSlug === opt.slug ? 'text-[#1e2d7d]' : 'text-gray-900'}`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 rounded-b-2xl">
            <button onClick={onClose} className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Скасувати
            </button>
            <button
              onClick={() => { if (selectedCoverSlug) setCoverStepDone(true); }}
              disabled={!selectedCoverSlug}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
                selectedCoverSlug
                  ? 'bg-[#1e2d7d] text-white hover:bg-[#263a99]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Далі →
            </button>
          </div>
        </div>
      </div>
    );
    return createPortal(coverStepContent, document.body);
  }

  const modalContent = (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d7d]">Налаштування замовлення</h2>
            <p className="text-sm text-gray-500 mt-1">{displayName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-600 mb-6">Оберіть параметри. Після підтвердження наш дизайнер створить макет для вас.</p>

          <div className="space-y-6">
            {/* Dynamic options from DB */}
            {options.filter((opt: any) => (opt.options?.length > 0 || opt.values?.length > 0)).map((opt: any) => {
              const items = opt.options || opt.values || [];
              return (
                <div key={opt.name}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{opt.name}</label>
                  <select value={config[opt.name] || ''} onChange={(e) => handleChange(opt.name, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] bg-white">
                    {items.map((item: any, idx: number) => {
                      const label = item.label || item.name || item;
                      const value = item.value || item.name || item;
                      const price = Number(item.price || 0);
                      return <option key={idx} value={value}>{label}{price > 0 ? ` (+${price} ₴)` : ''}</option>;
                    })}
                  </select>
                </div>
              );
            })}

            {/* Cover Color Picker (photobooks with non-printed covers) */}
            {showColorAndDeco && filteredColors.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Колір обкладинки: <span className="font-normal text-gray-500">{selectedColor?.name || 'оберіть'}</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {filteredColors.map((c: any) => (
                    <button key={c.id} type="button" title={`${c.name} (${c.code})`}
                      onClick={() => setSelectedColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor?.id === c.id ? 'border-[#1e2d7d] scale-110 shadow-md' : 'border-transparent hover:border-gray-300'}`}
                      style={{ backgroundColor: c.hex_approx }} />
                  ))}
                </div>
              </div>
            )}

            {/* Decoration (photobooks with non-printed covers) */}
            {showColorAndDeco && decoOptions.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Оздоблення обкладинки</label>
                <div className="flex flex-wrap gap-2">
                  {decoOptions.map(d => (
                    <button key={d.value} type="button"
                      onClick={() => { setSelectedDeco(d.value); setSelectedDecoVariant(''); }}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${selectedDeco === d.value ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]' : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d]'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Decoration Subtype */}
            {showColorAndDeco && decoSubs.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Варіант оздоблення</label>
                <div className="flex flex-wrap gap-2">
                  {decoSubs.map(s => (
                    <button key={s.value} type="button"
                      onClick={() => setSelectedDecoVariant(s.value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${selectedDecoVariant === s.value ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]' : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d]'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Photo rec + Price */}
          <div className="mt-6 space-y-3">
            {photoRec && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-1">Рекомендована кількість фото</p>
                <p className="text-sm text-blue-700">Рекомендуємо підготувати <strong>{photoRec}</strong></p>
              </div>
            )}
            <div className="p-4 bg-[#f0f3ff] rounded-lg flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1e2d7d]">Орієнтовна вартість:</span>
              <span className="text-xl font-bold text-[#1e2d7d]">{totalPrice} ₴</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            Скасувати
          </button>
          <button onClick={handleContinue}
            className="flex-1 px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors">
            Продовжити до завантаження фото →
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
