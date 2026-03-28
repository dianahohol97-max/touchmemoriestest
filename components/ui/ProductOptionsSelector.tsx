'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

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

// Velour color options
const VELOUR_COLORS = [
  { code: 'B-01', name: 'Кремовий',        hex: '#F2EDE3' },
  { code: 'B-02', name: 'Бежевий',         hex: '#C4A882' },
  { code: 'B-03', name: 'Попелясто-бежевий', hex: '#A8978A' },
  { code: 'B-04', name: 'Рожевий',         hex: '#E8BDB5' },
  { code: 'B-05', name: 'Бордо',           hex: '#8B1A3A' },
  { code: 'B-06', name: 'Сірий',           hex: '#9A9EA8' },
  { code: 'B-07', name: 'Ліловий',         hex: '#C5B5C8' },
  { code: 'B-08', name: 'Темно-синій',     hex: '#1A2545' },
  { code: 'B-09', name: 'Антрацит',        hex: '#4A4E58' },
  { code: 'B-10', name: 'Бірюзовий',       hex: '#28A8B8' },
  { code: 'B-11', name: 'Пурпуровий',      hex: '#9B3585' },
  { code: 'B-12', name: 'Сталево-синій',   hex: '#7A9BB5' },
  { code: 'B-13', name: 'Смарагдовий',     hex: '#1A4530' },
  { code: 'B-14', name: 'Гірчичний',       hex: '#E8C050' },
];

// Velour cover decoration options
const VELOUR_OZDOBLENNYA = [
  { value: 'none',    label: 'Без оздоблення' },
  { value: 'acrylic', label: 'Акрил' },
  { value: 'photo',   label: 'Фотовставка' },
  { value: 'metal',   label: 'Металева вставка' },
  { value: 'stamp',   label: 'Тиснення' },
  { value: 'laser',   label: 'Гравірування' },
];

// Fallback decoration variants for types that may not be in DB
const FALLBACK_DECORATION_VARIANTS: Record<string, string[]> = {
  'Тиснення': ['Тиснення 1', 'Тиснення 2', 'Тиснення 3', 'Тиснення 4', 'Тиснення 5', 'Тиснення 6', 'Тиснення 7', 'Тиснення 8', 'Тиснення 9', 'Тиснення 26'],
  'Гравірування': ['Гравірування 05', 'Гравірування 06', 'Гравірування 07', 'Гравірування 08', 'Гравірування 09', 'Гравірування 10', 'Гравірування 11', 'Гравірування 12', 'Гравірування 13', 'Гравірування 14', 'Гравірування 15', 'Гравірування 16', 'Гравірування 17', 'Гравірування 18', 'Гравірування 19', 'Гравірування 20', 'Гравірування 21', 'Гравірування 22', 'Гравірування 23', 'Гравірування 24', 'Гравірування 25', 'Власний макет'],
  'Гравіювання': ['Гравірування 05', 'Гравірування 06', 'Гравірування 07', 'Гравірування 08', 'Гравірування 09', 'Гравірування 10', 'Гравірування 11', 'Гравірування 12', 'Гравірування 13', 'Гравірування 14', 'Гравірування 15', 'Гравірування 16', 'Гравірування 17', 'Гравірування 18', 'Гравірування 19', 'Гравірування 20', 'Гравірування 21', 'Гравірування 22', 'Гравірування 23', 'Гравірування 24', 'Гравірування 25', 'Власний макет'],
  'Флекс': ['Флекс друк'],
};

// 3D Price table for Velour photobooks: Size -> Pages -> Калька -> Price
const VELOUR_PRICES: Record<string, Record<string, Record<string, number>>> = {
  '20х20': {
    '6':  { 'Без кальки': 1050, 'З калькою': 1350 },
    '8':  { 'Без кальки': 1100, 'З калькою': 1300 },
    '10': { 'Без кальки': 1150, 'З калькою': 1450 },
    '12': { 'Без кальки': 1200, 'З калькою': 1500 },
    '14': { 'Без кальки': 1250, 'З калькою': 1550 },
    '16': { 'Без кальки': 1300, 'З калькою': 1600 },
    '18': { 'Без кальки': 1350, 'З калькою': 1650 },
    '20': { 'Без кальки': 1400, 'З калькою': 1700 },
    '22': { 'Без кальки': 1450, 'З калькою': 1750 },
    '24': { 'Без кальки': 1500, 'З калькою': 1800 },
    '26': { 'Без кальки': 1550, 'З калькою': 1850 },
    '28': { 'Без кальки': 1600, 'З калькою': 1900 },
    '30': { 'Без кальки': 1650, 'З калькою': 1950 },
    '32': { 'Без кальки': 1700, 'З калькою': 2000 },
    '34': { 'Без кальки': 1750, 'З калькою': 2050 },
    '36': { 'Без кальки': 1800, 'З калькою': 2100 },
    '38': { 'Без кальки': 1850, 'З калькою': 2150 },
    '40': { 'Без кальки': 1900, 'З калькою': 2200 },
    '42': { 'Без кальки': 1950, 'З калькою': 2250 },
    '44': { 'Без кальки': 2000, 'З калькою': 2300 },
    '46': { 'Без кальки': 2050, 'З калькою': 2350 },
    '48': { 'Без кальки': 2100, 'З калькою': 2400 },
    '50': { 'Без кальки': 2150, 'З калькою': 2450 },
  },
  '25х25': {
    '8':  { 'Без кальки': 1290, 'З калькою': 1590 },
    '10': { 'Без кальки': 1365, 'З калькою': 1665 },
    '12': { 'Без кальки': 1445, 'З калькою': 1745 },
    '14': { 'Без кальки': 1525, 'З калькою': 1825 },
    '16': { 'Без кальки': 1605, 'З калькою': 1905 },
    '18': { 'Без кальки': 1685, 'З калькою': 1985 },
    '20': { 'Без кальки': 1765, 'З калькою': 2065 },
    '22': { 'Без кальки': 1840, 'З калькою': 2140 },
    '24': { 'Без кальки': 1925, 'З калькою': 2225 },
    '26': { 'Без кальки': 2010, 'З калькою': 2310 },
    '28': { 'Без кальки': 2095, 'З калькою': 2395 },
    '30': { 'Без кальки': 2175, 'З калькою': 2475 },
    '32': { 'Без кальки': 2255, 'З калькою': 2555 },
    '34': { 'Без кальки': 2335, 'З калькою': 2635 },
    '36': { 'Без кальки': 2415, 'З калькою': 2715 },
    '38': { 'Без кальки': 2495, 'З калькою': 2795 },
    '40': { 'Без кальки': 2575, 'З калькою': 2875 },
    '42': { 'Без кальки': 2655, 'З калькою': 2955 },
    '44': { 'Без кальки': 2735, 'З калькою': 3035 },
    '46': { 'Без кальки': 2820, 'З калькою': 3120 },
    '48': { 'Без кальки': 2905, 'З калькою': 3205 },
    '50': { 'Без кальки': 2990, 'З калькою': 3290 },
  },
  '20х30 (книжкова орієнтація)': {
    '10': { 'Без кальки': 1235, 'З калькою': 1535 },
    '12': { 'Без кальки': 1365, 'З калькою': 1665 },
    '14': { 'Без кальки': 1430, 'З калькою': 1730 },
    '16': { 'Без кальки': 1495, 'З калькою': 1795 },
    '18': { 'Без кальки': 1560, 'З калькою': 1860 },
    '20': { 'Без кальки': 1625, 'З калькою': 1925 },
    '22': { 'Без кальки': 1680, 'З калькою': 1980 },
    '24': { 'Без кальки': 1755, 'З калькою': 2055 },
    '26': { 'Без кальки': 1840, 'З калькою': 2140 },
    '28': { 'Без кальки': 1920, 'З калькою': 2220 },
    '30': { 'Без кальки': 2000, 'З калькою': 2300 },
    '32': { 'Без кальки': 2080, 'З калькою': 2380 },
    '34': { 'Без кальки': 2160, 'З калькою': 2460 },
    '36': { 'Без кальки': 2240, 'З калькою': 2540 },
    '38': { 'Без кальки': 2320, 'З калькою': 2620 },
    '40': { 'Без кальки': 2400, 'З калькою': 2700 },
    '42': { 'Без кальки': 2480, 'З калькою': 2780 },
    '44': { 'Без кальки': 2560, 'З калькою': 2860 },
    '46': { 'Без кальки': 2640, 'З калькою': 2940 },
    '48': { 'Без кальки': 2720, 'З калькою': 3020 },
    '50': { 'Без кальки': 2800, 'З калькою': 3100 },
  },
  '30х20 (альбомна орієнтація)': {
    '10': { 'Без кальки': 1235, 'З калькою': 1535 },
    '12': { 'Без кальки': 1365, 'З калькою': 1665 },
    '14': { 'Без кальки': 1430, 'З калькою': 1730 },
    '16': { 'Без кальки': 1495, 'З калькою': 1795 },
    '18': { 'Без кальки': 1560, 'З калькою': 1860 },
    '20': { 'Без кальки': 1625, 'З калькою': 1925 },
    '22': { 'Без кальки': 1680, 'З калькою': 1980 },
    '24': { 'Без кальки': 1755, 'З калькою': 2055 },
    '26': { 'Без кальки': 1840, 'З калькою': 2140 },
    '28': { 'Без кальки': 1920, 'З калькою': 2220 },
    '30': { 'Без кальки': 2000, 'З калькою': 2300 },
    '32': { 'Без кальки': 2080, 'З калькою': 2380 },
    '34': { 'Без кальки': 2160, 'З калькою': 2460 },
    '36': { 'Без кальки': 2240, 'З калькою': 2540 },
    '38': { 'Без кальки': 2320, 'З калькою': 2620 },
    '40': { 'Без кальки': 2400, 'З калькою': 2700 },
    '42': { 'Без кальки': 2480, 'З калькою': 2780 },
    '44': { 'Без кальки': 2560, 'З калькою': 2860 },
    '46': { 'Без кальки': 2640, 'З калькою': 2940 },
    '48': { 'Без кальки': 2720, 'З калькою': 3020 },
    '50': { 'Без кальки': 2800, 'З калькою': 3100 },
  },
  '30х30': {
    '16': { 'Без кальки': 1700, 'З калькою': 2000 },
    '18': { 'Без кальки': 1790, 'З калькою': 2090 },
    '20': { 'Без кальки': 1880, 'З калькою': 2180 },
    '22': { 'Без кальки': 1970, 'З калькою': 2270 },
    '24': { 'Без кальки': 2060, 'З калькою': 2360 },
    '26': { 'Без кальки': 2150, 'З калькою': 2450 },
    '28': { 'Без кальки': 2240, 'З калькою': 2540 },
    '30': { 'Без кальки': 2330, 'З калькою': 2630 },
    '32': { 'Без кальки': 2420, 'З калькою': 2720 },
    '34': { 'Без кальки': 2510, 'З калькою': 2810 },
    '36': { 'Без кальки': 2600, 'З калькою': 2900 },
    '38': { 'Без кальки': 2690, 'З калькою': 2990 },
    '40': { 'Без кальки': 2780, 'З калькою': 3080 },
    '42': { 'Без кальки': 2875, 'З калькою': 3175 },
    '44': { 'Без кальки': 2970, 'З калькою': 3270 },
    '46': { 'Без кальки': 3065, 'З калькою': 3365 },
    '48': { 'Без кальки': 3160, 'З калькою': 3460 },
    '50': { 'Без кальки': 3255, 'З калькою': 3555 },
  },
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
      name: 'Тип ламінації',
      values: ['Глянцева', 'Матова'],
      required: true
    },
    {
      name: 'Калька перед першою сторінкою',
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
      name: 'Тип обкладинки',
      values: ['М\'яка обкладинка', 'Тверда обкладинка'],
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

// Helper function to calculate velour photobook price based on 3 dimensions
function calculateVelourPrice(
  size: string,
  pages: string,
  kalka: string
): number | null {
  return VELOUR_PRICES[size]?.[pages]?.[kalka] ?? null;
}

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

  // Фотокниги (must be checked BEFORE photoprint — "photobook-printed" contains "print")
  if (s.includes('photobook') || s.includes('fotokniga') || s.includes('leatherette') || s.includes('velvet') || s.includes('fabric') || s.includes('velyur') || s.includes('tkanina')) {
    return 'photobook';
  }

  // Фотодрук нестандартний
  if (s.includes('photoprint') && (s.includes('nonstandard') || s.includes('nestandart'))) {
    return 'photoprint_nonstandard';
  }

  // Фотодрук стандартний
  if (s.includes('photoprint') || s.includes('print')) {
    return 'photoprint_standard';
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
  productOptions?: any[];
}

export function ProductOptionsSelector({ slug, selectedOptions, onChange }: ProductOptionsSelectorProps) {
  const productType = detectProductType(slug);
  const s = slug?.toLowerCase() || '';
  const isVelourProduct = s.includes('velour') || s.includes('velyur');
  const isLeatherProduct = s.includes('leather') || s.includes('shkir');
  const isFabricProduct = s.includes('fabric') || s.includes('tkanina');
  const isPrintedProduct = s.includes('printed') || s.includes('drukov');
  const isPhotobookProduct = productType === 'photobook';
  // Non-printed photobooks get colors + decoration options
  const hasColorAndDecoration = isPhotobookProduct && !isPrintedProduct;

  const [selectedColor, setSelectedColor] = useState(VELOUR_COLORS[0]);
  const [selectedOzdoblennya, setSelectedOzdoblennya] = useState('none');
  const [selectedDecorationVariant, setSelectedDecorationVariant] = useState('');
  const [decorationVariants, setDecorationVariants] = useState<any[]>([]);
  const [coverColors, setCoverColors] = useState<any[]>([]);
  const [selectedCoverColor, setSelectedCoverColor] = useState<any>(null);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Determine cover type name for DB queries
  const coverTypeName = isVelourProduct ? 'Велюр'
    : isLeatherProduct ? 'Шкірзамінник'
    : isFabricProduct ? 'Тканина'
    : isPrintedProduct ? 'Друкована' : '';

  // Fetch decoration variants and cover colors for photobook products
  useEffect(() => {
    if (!isPhotobookProduct) return;
    async function fetchData() {
      // Decoration variants
      const { data: varData } = await supabase
        .from('decoration_variants')
        .select('*, decoration_type:decoration_types(id, name), cover_type:cover_types(id, name), size:photobook_sizes(id, name)')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (varData) setDecorationVariants(varData);

      // Cover colors (for non-printed covers)
      if (hasColorAndDecoration && coverTypeName) {
        const { data: colorData } = await supabase
          .from('cover_colors')
          .select('*, cover_type:cover_types(id, name)')
          .eq('active', true)
          .order('sort_order', { ascending: true });
        if (colorData) {
          const filtered = colorData.filter((c: any) => c.cover_type?.name === coverTypeName);
          setCoverColors(filtered);
          if (filtered.length > 0 && !selectedCoverColor) {
            setSelectedCoverColor(filtered[0]);
          }
        }
      }
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhotobookProduct, hasColorAndDecoration, coverTypeName]);

  if (!productType) {
    return null;
  }

  const options = PRODUCT_OPTIONS[productType];

  const calculatePrice = (opts: Record<string, string | number>): number | null => {
    // Фотокниги - check if velour for 3D pricing, otherwise use simple size pricing
    if (productType === 'photobook') {
      const s = slug.toLowerCase();
      const isVelour = s.includes('velyur') || s.includes('velour') || s.includes('велюр');

      if (isVelour) {
        // Velour photobooks use 3D pricing: size + pages + калька
        const size = opts['Розмір'];
        const pages = opts['Кількість сторінок'];
        const kalka = opts['Калька перед першою сторінкою'];

        if (size && pages && kalka &&
            typeof size === 'string' &&
            typeof kalka === 'string') {
          const pagesStr = String(pages);
          return calculateVelourPrice(size, pagesStr, kalka);
        }
      } else {
        // Non-velour photobooks use simple size-based pricing
        const size = opts['Розмір'];
        if (size && typeof size === 'string') {
          return PHOTOBOOK_SIZE_PRICES[size] || null;
        }
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
    // Include velour-specific options if this is a velour product
    if (isVelourProduct) {
      if (selectedColor) {
        newOptions['Колір велюру'] = `${selectedColor.name} (${selectedColor.code})`;
      }
      if (selectedOzdoblennya) {
        const decorationLabel = VELOUR_OZDOBLENNYA.find(o => o.value === selectedOzdoblennya)?.label || 'Без оздоблення';
        newOptions['Тип оздоблення'] = decorationLabel;
      }
    }
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

      {/* Cover Color Picker (velour uses hardcoded, others use DB) */}
      {hasColorAndDecoration && (() => {
        const colors = isVelourProduct ? VELOUR_COLORS : coverColors.map((c: any) => ({ code: c.code, name: c.name, hex: c.hex_approx }));
        const current = isVelourProduct ? selectedColor : selectedCoverColor;
        const colorLabel = isVelourProduct ? 'Колір велюру' : isLeatherProduct ? 'Колір шкірзамінника' : 'Колір тканини';
        if (colors.length === 0) return null;
        return (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1e2d7d' }}>
              {colorLabel}: <span style={{ fontWeight: 400, color: '#64748b' }}>{current?.name ?? 'оберіть колір'}</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {colors.map((color: any) => (
                <button
                  key={color.code}
                  type="button"
                  title={`${color.name} (${color.code})`}
                  onClick={() => {
                    if (isVelourProduct) {
                      setSelectedColor(color);
                    } else {
                      setSelectedCoverColor(color);
                    }
                    const newOptions = { ...selectedOptions, [colorLabel]: `${color.name} (${color.code})` };
                    const price = calculatePrice(newOptions);
                    onChange(newOptions, price || undefined);
                  }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    current?.code === color.code ? 'border-[#1e2d7d] scale-110 shadow-md' : 'border-transparent hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  aria-label={color.name}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Decoration Type Selector (all non-printed photobooks) */}
      {hasColorAndDecoration && (
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 700,
            marginBottom: '12px',
            color: '#1e2d7d'
          }}>
            Тип оздоблення обкладинки
          </label>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {VELOUR_OZDOBLENNYA.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setSelectedOzdoblennya(opt.value);
                  setSelectedDecorationVariant('');
                  // Update parent with new decoration selection
                  const newOptions = {
                    ...selectedOptions,
                    'Тип оздоблення': opt.label,
                    'Варіант оздоблення': ''
                  };
                  const price = calculatePrice(newOptions);
                  onChange(newOptions, price || undefined);
                }}
                className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  selectedOzdoblennya === opt.value
                    ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d] hover:text-[#1e2d7d]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Decoration Sub-Options — conditional on Оздоблення selection */}
      {hasColorAndDecoration && selectedOzdoblennya !== 'none' && (() => {
        const decoLabel = VELOUR_OZDOBLENNYA.find(o => o.value === selectedOzdoblennya)?.label;
        if (!decoLabel) return null;

        const selectedSize = selectedOptions['Розмір'];
        const sizeNormalized = selectedSize ? String(selectedSize).replace(/х/g, '×') : '';

        // 1. Try decoration_variants from Supabase (exact cover+size → any cover+size → type only)
        let variants = decorationVariants.filter((dv: any) =>
          dv.decoration_type?.name === decoLabel &&
          dv.cover_type?.name === coverTypeName &&
          (sizeNormalized ? dv.size?.name === sizeNormalized : true)
        );
        if (variants.length === 0) {
          variants = decorationVariants.filter((dv: any) =>
            dv.decoration_type?.name === decoLabel &&
            (sizeNormalized ? dv.size?.name === sizeNormalized : true)
          );
        }
        if (variants.length === 0) {
          const seen = new Set<string>();
          variants = decorationVariants.filter((dv: any) => {
            if (dv.decoration_type?.name !== decoLabel) return false;
            if (seen.has(dv.variant_name)) return false;
            seen.add(dv.variant_name);
            return true;
          });
        }

        // 2. Build items list: from DB variants or hardcoded fallback
        let items: { name: string; surcharge?: number }[] = [];
        if (variants.length > 0) {
          items = variants.map((v: any) => ({ name: v.variant_name, surcharge: Number(v.surcharge) || 0 }));
        } else {
          const fallback = FALLBACK_DECORATION_VARIANTS[decoLabel];
          if (fallback) {
            items = fallback.map(name => ({ name, surcharge: 0 }));
          }
        }

        if (items.length === 0) return null;

        return (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1e2d7d' }}>
              Варіант {decoLabel.toLowerCase()}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {items.map((item) => (
                <button key={item.name} type="button"
                  onClick={() => {
                    setSelectedDecorationVariant(item.name);
                    const newOptions = { ...selectedOptions, 'Варіант оздоблення': item.name };
                    onChange(newOptions, calculatePrice(newOptions) || undefined);
                  }}
                  className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    selectedDecorationVariant === item.name
                      ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d] hover:text-[#1e2d7d]'
                  }`}>
                  {item.name}{item.surcharge && item.surcharge > 0 ? ` (+${item.surcharge} ₴)` : ''}
                </button>
              ))}
            </div>
          </div>
        );
      })()}
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
