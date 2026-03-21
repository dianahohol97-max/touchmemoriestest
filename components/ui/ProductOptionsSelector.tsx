'use client';
import React from 'react';

type ProductOption = {
  name: string;
  values: string[] | number[];
  type?: 'select' | 'text';
  required?: boolean;
};

type ProductOptionsConfig = {
  [key: string]: ProductOption[];
};

const PRODUCT_OPTIONS: ProductOptionsConfig = {
  photobook: [
    { name: 'Розмір', values: ['20х20', '25х25', '20х30 (книжкова)', '30х20 (альбомна)', '30х30'], required: true },
    { name: 'Кількість сторінок', values: [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50], required: true },
    { name: 'Калька між сторінками', values: ['Без кальки', 'З калькою'], required: true },
  ],
  magazine: [
    { name: 'Розмір', values: ['A4'], type: 'text', required: false },
    { name: 'Кількість сторінок', values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80, 92, 100], required: true },
    { name: 'Текст для журналу', values: ['без тексту', 'з текстом'], required: true },
  ],
  photojournal: [
    { name: 'Розмір', values: ['A4'], type: 'text', required: false },
    { name: 'Кількість сторінок', values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80], required: true },
  ],
  travelbook: [
    { name: 'Розмір', values: ['A4'], type: 'text', required: false },
    { name: 'Кількість сторінок', values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80], required: true },
    { name: 'Ламінація', values: ['без ламінації', 'З ламінацією сторінок'], required: true },
  ],
  wishbook: [
    { name: 'Матеріал обкладинки', values: ['Друкована тверда', 'З тканини', 'Велюрова'], required: true },
    { name: 'Розмір', values: ['23x23', '30x20', '20x30'], required: true },
    { name: 'Колір сторінок', values: ['білі', 'чорні', 'кремові'], required: true },
    { name: 'Кількість сторінок', values: ['32'], type: 'text', required: false },
  ],
};

function detectProductType(slug: string): string | null {
  const s = slug.toLowerCase();

  // Фотокниги
  if (s.includes('photobook') || s.includes('fotokniga') || s.includes('leatherette') || s.includes('velvet') || s.includes('fabric')) {
    return 'photobook';
  }

  // Глянцевий журнал
  if ((s.includes('magazine') || s.includes('zhurnal') || s.includes('glyancevij')) && !s.includes('tverda')) {
    return 'magazine';
  }

  // Фотожурнал з твердою обкладинкою
  if (s.includes('photojournal') || s.includes('tverda')) {
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
  onChange: (options: Record<string, string | number>) => void;
}

export function ProductOptionsSelector({ slug, selectedOptions, onChange }: ProductOptionsSelectorProps) {
  const productType = detectProductType(slug);

  if (!productType) {
    return null; // No custom options for this product type
  }

  const options = PRODUCT_OPTIONS[productType];

  const handleOptionChange = (optionName: string, value: string | number) => {
    onChange({
      ...selectedOptions,
      [optionName]: value,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {options.map((option, idx) => {
        const isText = option.type === 'text';
        const selectedValue = selectedOptions[option.name];

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
                onChange={(e) => handleOptionChange(option.name, e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: selectedValue ? '1px solid #1e2d7d' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  color: selectedValue ? '#1e2d7d' : '#64748b',
                  fontWeight: selectedValue ? 600 : 400,
                  outline: 'none',
                }}
              >
                <option value="" disabled>
                  Оберіть {option.name.toLowerCase()}
                </option>
                {option.values.map((value, valIdx) => (
                  <option key={valIdx} value={value}>
                    {value}
                  </option>
                ))}
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
    return true; // No required options for this product type
  }

  const options = PRODUCT_OPTIONS[productType];
  const requiredOptions = options.filter(opt => opt.required && opt.type !== 'text');

  return requiredOptions.every(opt => {
    const value = selectedOptions[opt.name];
    return value !== undefined && value !== null && value !== '';
  });
}
