'use client';
import React from 'react';

type ProductOption = {
  name: string;
  values: (string | number)[];
  prices?: Record<string, number>;
  type?: 'select' | 'text';
  required?: boolean;
};

type ProductOptionsConfig = {
  [key: string]: ProductOption[];
};

// Price mappings
const PHOTOBOOK_SIZE_PRICES: Record<string, number> = {
  '20х20': 1050,
  '25х25': 1290,
  '20х30': 1235,
  '30х20': 1235,
  '30х30': 1700,
};

const MAGAZINE_PAGE_PRICES: Record<number, number> = {
  12: 475, 16: 625, 20: 775, 24: 925, 28: 1075, 32: 1225,
  36: 1375, 40: 1525, 44: 1675, 48: 1825, 52: 1950,
  60: 2150, 72: 2450, 80: 2700, 92: 2850, 100: 3050,
};

const PHOTOJOURNAL_PAGE_PRICES: Record<number, number> = {
  12: 600, 16: 750, 20: 900, 24: 1050, 28: 1200, 32: 1350,
  36: 1500, 40: 1650, 44: 1800, 48: 1950, 52: 2075,
  60: 2275, 72: 2575, 80: 2825,
};

const PHOTOJOURNAL_HARD_PAGE_PRICES: Record<number, number> = {
  12: 600, 16: 750, 20: 900, 24: 1050, 28: 1200, 32: 1350,
  36: 1500, 40: 1650, 44: 1800, 48: 1950, 52: 2075,
  60: 2275, 72: 2575, 80: 2825,
};

const TRAVELBOOK_PAGE_PRICES: Record<number, number> = {
  12: 550, 16: 700, 20: 850, 24: 1000, 28: 1150, 32: 1300,
  36: 1450, 40: 1600, 44: 1750, 48: 1900, 52: 2025,
  56: 2125, 60: 2225, 64: 2325, 68: 2425, 72: 2525,
  76: 2650, 80: 2775,
};

const WISHBOOK_PRICES: Record<string, Record<string, number>> = {
  'Друкована тверда': { '23x23': 559, '30x20': 599, '20x30': 559 },
  'З тканини': { '23x23': 999, '30x20': 1059, '20x30': 1059 },
  'Велюрова': { '23x23': 999, '30x20': 1059, '20x30': 1059 },
};

const PHOTOPRINT_STANDARD_PRICES: Record<string, number> = {
  '9х13': 8,
  '10х15': 8,
  '13х15': 18,
  '15х20': 23,
  '20х30': 44,
};

const PHOTOPRINT_NONSTANDARD_PRICES: Record<string, number> = {
  '5х7.5': 7.5,
  '6х9': 7.5,
  '7.5х10': 7.5,
  '9х9': 8,
  '10х10': 8,
};

const POLAROID_PRICES: Record<string, number> = {
  '7.6х10.1': 7.5,
  '8.6х5.4': 7.5,
};

const PRODUCT_OPTIONS: ProductOptionsConfig = {
  photobook: [
    {
      name: 'Розмір',
      values: ['20х20', '25х25', '20х30', '30х20', '30х30'],
      prices: PHOTOBOOK_SIZE_PRICES,
      required: true
    },
    {
      name: 'Кількість сторінок',
      values: [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50],
      required: true
    },
    {
      name: 'Калька між сторінками',
      values: ['Без кальки', 'З калькою'],
      required: true
    },
  ],
  magazine: [
    { name: 'Розмір', values: ['A4'], type: 'text', required: false },
    {
      name: 'Кількість сторінок',
      values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80, 92, 100],
      prices: MAGAZINE_PAGE_PRICES,
      required: true
    },
    {
      name: 'Текст',
      values: ['Без тексту', 'З текстом'],
      required: true
    },
  ],
  photojournal: [
    { name: 'Розмір', values: ['A4'], type: 'text', required: false },
    {
      name: 'Кількість сторінок',
      values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80],
      prices: PHOTOJOURNAL_PAGE_PRICES,
      required: true
    },
  ],
  'photojournal-hard': [
    { name: 'Розмір', values: ['A4 (210×297 мм)'], type: 'text', required: false },
    {
      name: 'Кількість сторінок',
      values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80],
      prices: PHOTOJOURNAL_HARD_PAGE_PRICES,
      required: true
    },
  ],
  travelbook: [
    { name: 'Розмір', values: ['A4'], type: 'text', required: false },
    {
      name: 'Кількість сторінок',
      values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80],
      prices: TRAVELBOOK_PAGE_PRICES,
      required: true
    },
    {
      name: 'Ламінація',
      values: ['Без ламінації', 'З ламінацією сторінок'],
      required: true
    },
  ],
  wishbook: [
    {
      name: 'Матеріал обкладинки',
      values: ['Друкована тверда', 'З тканини', 'Велюрова'],
      required: true
    },
    {
      name: 'Розмір',
      values: ['23x23', '30x20', '20x30'],
      required: true
    },
    {
      name: 'Колір сторінок',
      values: ['Білі', 'Чорні', 'Кремові'],
      required: true
    },
    { name: 'Кількість сторінок', values: ['32'], type: 'text', required: false },
  ],
  photoprint_standard: [
    {
      name: 'Розмір',
      values: ['9х13', '10х15', '13х15', '15х20', '20х30'],
      prices: PHOTOPRINT_STANDARD_PRICES,
      required: true
    },
    {
      name: 'Рамка',
      values: ['З білою рамкою', 'Без білої рамки'],
      required: true
    },
    {
      name: 'Вид',
      values: ['Матові', 'Глянцеві'],
      required: true
    },
  ],
  photoprint_nonstandard: [
    {
      name: 'Розмір',
      values: ['5х7.5', '6х9', '7.5х10', '9х9', '10х10'],
      prices: PHOTOPRINT_NONSTANDARD_PRICES,
      required: true
    },
    {
      name: 'Матеріал',
      values: ['Матові', 'Глянцеві'],
      required: true
    },
  ],
  polaroid: [
    {
      name: 'Розмір',
      values: ['7.6х10.1 см', '8.6х5.4 см'],
      prices: { '7.6х10.1 см': 7.5, '8.6х5.4 см': 7.5 },
      required: true
    },
  ],
  photomagnet: [
    {
      name: 'Розмір',
      values: ['5x7.5', '6x9', '7.5x10', '9x9', '10x10', 'Polaroid 7.6x10.1', 'Polaroid 8.6x5.4'],
      prices: {
        '5x7.5': 215, '6x9': 215, '7.5x10': 215,
        '9x9': 215, '10x10': 215,
        'Polaroid 7.6x10.1': 215,
        'Polaroid 8.6x5.4': 215
      },
      required: true
    },
  ],
};

function detectProductType(slug: string): string | null {
  const s = slug.toLowerCase();

  // Фотомагніти
  if (s.includes('magnet') || s.includes('magnit')) {
    return 'photomagnet';
  }

  // Polaroid
  if (s.includes('polaroid') || s.includes('polaroyd') || s.includes('полароїд') || s.includes('поляроїд')) {
    return 'polaroid';
  }

  // Фотодрук нестандартний
  if (s.includes('photoprint') && (s.includes('nonstandard') || s.includes('nestandart'))) {
    return 'photoprint_nonstandard';
  }

  // Фотодрук стандартний
  if (s.includes('photoprint') || s.includes('print')) {
    return 'photoprint_standard';
  }

  // Фотокниги
  if (s.includes('photobook') || s.includes('fotokniga') || s.includes('leatherette') || s.includes('velvet') || s.includes('fabric') || s.includes('velyur') || s.includes('tkanina')) {
    return 'photobook';
  }

  // Глянцевий журнал
  if ((s.includes('magazine') || s.includes('zhurnal') || s.includes('glyancevij') || s.includes('gloss')) && !s.includes('tverda') && !s.includes('hard')) {
    return 'magazine';
  }

  // Журнал з твердою обкладинкою (new hard cover variant)
  if (s.includes('photojournal-hard')) {
    return 'photojournal-hard';
  }

  // Фотожурнал з твердою обкладинкою
  if (s.includes('photojournal') || s.includes('tverda') || s.includes('hardcover')) {
    return 'photojournal';
  }

  // Travel Book
  if (s.includes('travel') || s.includes('travelbook')) {
    return 'travelbook';
  }

  // Книга побажань
  if (s.includes('wish') || s.includes('pobazhan') || s.includes('kniga') || s.includes('guestbook')) {
    return 'wishbook';
  }

  return null;
}

interface ProductOptionsSelectorProps {
  slug: string;
  selectedOptions: Record<string, string | number>;
  onChange: (options: Record<string, string | number>, calculatedPrice?: number) => void;
}

export function ProductOptionsSelector({ slug, selectedOptions, onChange }: ProductOptionsSelectorProps) {
  const productType = detectProductType(slug);

  if (!productType) {
    return null;
  }

  const options = PRODUCT_OPTIONS[productType];

  const calculatePrice = (opts: Record<string, string | number>): number | null => {
    // Фотокниги - ціна залежить від розміру (базова для 6 сторінок)
    if (productType === 'photobook') {
      const size = opts['Розмір'];
      if (size && typeof size === 'string') {
        return PHOTOBOOK_SIZE_PRICES[size] || null;
      }
    }

    // Журнали - ціна залежить від кількості сторінок
    if (productType === 'magazine') {
      const pages = opts['Кількість сторінок'];
      if (pages && typeof pages === 'number') {
        return MAGAZINE_PAGE_PRICES[pages] || null;
      }
    }

    // Фотожурнал твердий
    if (productType === 'photojournal') {
      const pages = opts['Кількість сторінок'];
      if (pages && typeof pages === 'number') {
        return PHOTOJOURNAL_PAGE_PRICES[pages] || null;
      }
    }

    // Журнал з твердою обкладинкою (hard cover variant)
    if (productType === 'photojournal-hard') {
      const pages = opts['Кількість сторінок'];
      if (pages && typeof pages === 'number') {
        return PHOTOJOURNAL_HARD_PAGE_PRICES[pages] || null;
      }
    }

    // Travel Book
    if (productType === 'travelbook') {
      const pages = opts['Кількість сторінок'];
      if (pages && typeof pages === 'number') {
        return TRAVELBOOK_PAGE_PRICES[pages] || null;
      }
    }

    // Книга побажань - комбінація матеріалу та розміру
    if (productType === 'wishbook') {
      const material = opts['Матеріал обкладинки'];
      const size = opts['Розмір'];
      if (material && size && typeof material === 'string' && typeof size === 'string') {
        return WISHBOOK_PRICES[material]?.[size] || null;
      }
    }

    // Фотодрук, полароїд, магніти - ціна залежить від розміру
    if (productType === 'photoprint_standard' || productType === 'photoprint_nonstandard' || productType === 'polaroid' || productType === 'photomagnet') {
      const sizeOption = options.find(opt => opt.name === 'Розмір');
      const size = opts['Розмір'];
      if (size && sizeOption?.prices) {
        return sizeOption.prices[size as string] || null;
      }
    }

    return null;
  };

  const handleOptionChange = (optionName: string, value: string | number) => {
    const newOptions = {
      ...selectedOptions,
      [optionName]: value,
    };
    const price = calculatePrice(newOptions);
    onChange(newOptions, price || undefined);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {options.map((option, idx) => {
        const isText = option.type === 'text';
        const selectedValue = selectedOptions[option.name];
        const hasPrice = option.prices && selectedValue;
        const priceForValue = hasPrice ? option.prices?.[selectedValue as string] : null;

        return (
          <div key={idx}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 700,
              marginBottom: '8px',
              color: '#1e2d7d'
            }}>
              {option.name}
              {option.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
            </label>

            {isText ? (
              <div style={{
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#64748b',
                backgroundColor: '#f9fafb',
              }}>
                {option.values[0]} (фіксовано)
              </div>
            ) : (
              <select
                value={selectedValue || ''}
                onChange={(e) => {
                  const val = option.values.includes(Number(e.target.value))
                    ? Number(e.target.value)
                    : e.target.value;
                  handleOptionChange(option.name, val);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: selectedValue ? '2px solid #1e2d7d' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  backgroundColor: selectedValue ? '#f0f3ff' : 'white',
                  color: selectedValue ? '#1e2d7d' : '#64748b',
                  fontWeight: selectedValue ? 700 : 400,
                  outline: 'none',
                }}
              >
                <option value="" disabled>
                  Оберіть {option.name.toLowerCase()}
                </option>
                {option.values.map((value, valIdx) => {
                  const price = option.prices?.[value as string];
                  return (
                    <option key={valIdx} value={value}>
                      {value}{price ? ` — ${price} ₴` : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function areAllRequiredOptionsFilled(slug: string, selectedOptions: Record<string, string | number>): boolean {
  const productType = detectProductType(slug);

  if (!productType) {
    return true;
  }

  const options = PRODUCT_OPTIONS[productType];
  const requiredOptions = options.filter(opt => opt.required && opt.type !== 'text');

  return requiredOptions.every(opt => {
    const value = selectedOptions[opt.name];
    return value !== undefined && value !== null && value !== '';
  });
}

export function getCalculatedPrice(slug: string, selectedOptions: Record<string, string | number>): number | null {
  const productType = detectProductType(slug);
  if (!productType) return null;

  // Фотокниги
  if (productType === 'photobook') {
    const size = selectedOptions['Розмір'];
    if (size && typeof size === 'string') {
      return PHOTOBOOK_SIZE_PRICES[size] || null;
    }
  }

  // Журнали
  if (productType === 'magazine') {
    const pages = selectedOptions['Кількість сторінок'];
    if (pages && typeof pages === 'number') {
      return MAGAZINE_PAGE_PRICES[pages] || null;
    }
  }

  // Фотожурнал
  if (productType === 'photojournal') {
    const pages = selectedOptions['Кількість сторінок'];
    if (pages && typeof pages === 'number') {
      return PHOTOJOURNAL_PAGE_PRICES[pages] || null;
    }
  }

  // Журнал з твердою обкладинкою (hard cover variant)
  if (productType === 'photojournal-hard') {
    const pages = selectedOptions['Кількість сторінок'];
    if (pages && typeof pages === 'number') {
      return PHOTOJOURNAL_HARD_PAGE_PRICES[pages] || null;
    }
  }

  // Travel Book
  if (productType === 'travelbook') {
    const pages = selectedOptions['Кількість сторінок'];
    if (pages && typeof pages === 'number') {
      return TRAVELBOOK_PAGE_PRICES[pages] || null;
    }
  }

  // Книга побажань
  if (productType === 'wishbook') {
    const material = selectedOptions['Матеріал обкладинки'];
    const size = selectedOptions['Розмір'];
    if (material && size && typeof material === 'string' && typeof size === 'string') {
      return WISHBOOK_PRICES[material]?.[size] || null;
    }
  }

  // Фотодрук/полароїд/магніти
  if (productType === 'photoprint_standard' || productType === 'photoprint_nonstandard' || productType === 'polaroid' || productType === 'photomagnet') {
    const size = selectedOptions['Розмір'];
    const options = PRODUCT_OPTIONS[productType];
    const sizeOption = options.find(opt => opt.name === 'Розмір');
    if (size && sizeOption?.prices) {
      return sizeOption.prices[size as string] || null;
    }
  }

  return null;
}
