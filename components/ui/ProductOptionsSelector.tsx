'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { SizeVisualizer } from './SizeVisualizer';
import { useT } from '@/lib/i18n/context';
import { getMagazinePrice, TYPESETTING_PRICE, MAGAZINE_PRICES_WITHOUT_TYPESETTING, getPhotojournalHardPrice, getTravelBookPrice, PHOTO_JOURNAL_HARD, TRAVEL_BOOK, LAMINATION_PRICE_PER_PAGE } from '@/lib/products';

type ProductOption = {
  name: string;
  values: (string | number)[];
  prices?: Record<string, number>;
  type?: 'select' | 'text';
  required?: boolean;
  note?: string;
};

type ProductOptionsConfig = {
  [key: string]: ProductOption[];
};

// Photobook prices are NOT defined here. They live in the `photobook_prices`
// Supabase table and are read by ProductClient via state photobookPricesData
// (for the catalog card) and by the editor via lib/editor/pricing.ts. Adding
// a hardcoded photobook table here causes exactly the drift we spent the
// pricing audit eliminating — selector preview vs DB editor vs DB card.
//
// Derived from the single source of truth (lib/products) so prices can
// never drift between the catalog card and the configurator.
const MAGAZINE_PAGE_PRICES: Record<number, number> = MAGAZINE_PRICES_WITHOUT_TYPESETTING;

// Derived from the single source of truth (lib/products) — soft journal
// uses the same scale as the glossy magazine (8–100 ст starting at 525 ₴).
const PHOTOJOURNAL_PAGE_PRICES: Record<number, number> = MAGAZINE_PRICES_WITHOUT_TYPESETTING;

// Derived from PHOTO_JOURNAL_HARD.prices (lib/products) — single source.
const PHOTOJOURNAL_HARD_PAGE_PRICES: Record<number, number> = PHOTO_JOURNAL_HARD.prices;

// Derived from TRAVEL_BOOK.prices (lib/products) — single source. Travel
// Book scale is identical to hard journal.
const TRAVELBOOK_PAGE_PRICES: Record<number, number> = TRAVEL_BOOK.prices;

// Wishbook (книга побажань) prices by material × size. This constant is the
// single source of truth — both ProductOptionsSelector (card price) and
// BookConstructorConfig (configurator price) import from here. Keep both
// '23×23' and '23x23' style keys so a lookup works regardless of how the
// caller spells the size (BD uses 'x', display uses '×').
// Wishbook prices keyed by: cover_type → page_color → size
// Black/Cream pages cost more than White due to thicker stock.
export const WISHBOOK_PRICES: Record<string, Record<string, Record<string, number>>> = {
  'Друкована':        { 'Білі': { '23x23': 629, '30x20': 679, '20x30': 679, '23×23': 629, '30×20': 679, '20×30': 679 }, 'Чорні': { '23x23': 1009, '30x20': 1049, '20x30': 1049, '23×23': 1009, '30×20': 1049, '20×30': 1049 }, 'Кремові': { '23x23': 1009, '30x20': 1049, '20x30': 1049, '23×23': 1009, '30×20': 1049, '20×30': 1049 } },
  'Друкована тверда': { 'Білі': { '23x23': 629, '30x20': 679, '20x30': 679, '23×23': 629, '30×20': 679, '20×30': 679 }, 'Чорні': { '23x23': 1009, '30x20': 1049, '20x30': 1049, '23×23': 1009, '30×20': 1049, '20×30': 1049 }, 'Кремові': { '23x23': 1009, '30x20': 1049, '20x30': 1049, '23×23': 1009, '30×20': 1049, '20×30': 1049 } },
  'З тканини':        { 'Білі': { '23x23': 1159, '30x20': 1209, '20x30': 1209, '23×23': 1159, '30×20': 1209, '20×30': 1209 }, 'Чорні': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 }, 'Кремові': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 } },
  'Із тканини':       { 'Білі': { '23x23': 1159, '30x20': 1209, '20x30': 1209, '23×23': 1159, '30×20': 1209, '20×30': 1209 }, 'Чорні': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 }, 'Кремові': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 } },
  'Тканина':          { 'Білі': { '23x23': 1159, '30x20': 1209, '20x30': 1209, '23×23': 1159, '30×20': 1209, '20×30': 1209 }, 'Чорні': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 }, 'Кремові': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 } },
  'Велюрова':         { 'Білі': { '23x23': 1159, '30x20': 1209, '20x30': 1209, '23×23': 1159, '30×20': 1209, '20×30': 1209 }, 'Чорні': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 }, 'Кремові': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 } },
  'Велюр':            { 'Білі': { '23x23': 1159, '30x20': 1209, '20x30': 1209, '23×23': 1159, '30×20': 1209, '20×30': 1209 }, 'Чорні': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 }, 'Кремові': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 } },
  'Шкірзамінник':     { 'Білі': { '23x23': 1159, '30x20': 1209, '20x30': 1209, '23×23': 1159, '30×20': 1209, '20×30': 1209 }, 'Чорні': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 }, 'Кремові': { '23x23': 1459, '30x20': 1509, '20x30': 1509, '23×23': 1459, '30×20': 1509, '20×30': 1509 } },
};

export function getWishbookPrice(coverType: string, pageColor: string, size: string): number | undefined {
  return WISHBOOK_PRICES[coverType]?.[pageColor]?.[size];
}

const PHOTOPRINT_STANDARD_PRICES: Record<string, number> = {
  '9х13': 8, '9x13': 8,
  '10х15': 8, '10x15': 8,
  '13х18': 18, '13x18': 18,
  '15х20': 23, '15x20': 23,
  '20х30': 44, '20x30': 44,
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

// Leatherette colors for wishbook
const LEATHERETTE_COLORS_WB = [
  { code: 'L-01', name: 'Білий',              hex: '#F5F5F0' },
  { code: 'L-02', name: 'Бежевий',            hex: '#D9C8B0' },
  { code: 'L-03', name: 'Пісочний',           hex: '#D4A76A' },
  { code: 'L-04', name: 'Рудий',              hex: '#C8844E' },
  { code: 'L-05', name: 'Бордо темний',       hex: '#7A2838' },
  { code: 'L-06', name: 'Золотистий',         hex: '#C4A83A' },
  { code: 'L-07', name: 'Теракотовий',        hex: '#C25A3C' },
  { code: 'L-08', name: 'Рожевий ніжний',     hex: '#E8B4B8' },
  { code: 'L-09', name: 'Червоний насичений', hex: '#A01030' },
  { code: 'L-10', name: 'Коричневий',         hex: '#8E5038' },
  { code: 'L-11', name: 'Вишневий',           hex: '#7A2020' },
  { code: 'L-12', name: 'Графітовий темний',  hex: '#3A3038' },
  { code: 'L-13', name: 'Темно-синій',        hex: '#1A2040' },
  { code: 'L-14', name: 'Чорний',             hex: '#1A1A1A' },
];

// Fabric colors for wishbook
const FABRIC_COLORS_WB = [
  { code: 'F-01', name: 'Бежевий/пісочний',  hex: '#C4AA88' },
  { code: 'F-02', name: 'Теракотовий',        hex: '#A04838' },
  { code: 'F-03', name: 'Фуксія',             hex: '#B838A0' },
  { code: 'F-04', name: 'Марсала/бордо',      hex: '#602838' },
  { code: 'F-05', name: 'Коричневий',         hex: '#6E4830' },
  { code: 'F-06', name: 'Сірий/графітовий',   hex: '#586058' },
  { code: 'F-07', name: 'Червоний яскравий',  hex: '#C02030' },
  { code: 'F-08', name: 'Оливковий/зелений',  hex: '#A0A020' },
];

// Velour cover decoration options
const VELOUR_OZDOBLENNYA = [
  { value: 'none',           label: 'Без оздоблення' },
  { value: 'acryl',          label: 'Акрил' },
  { value: 'photovstavka',   label: 'Фотовставка' },
  { value: 'metal',          label: 'Металева вставка' },
  { value: 'flex',           label: 'Друк кольором' },
  { value: 'graviruvannya',  label: 'Гравірування' },
];


// VELOUR_PRICES and PHOTOBOOK_SIZE_PRICES removed — see comment block at
// the top of the constants section. All photobook pricing now flows from
// the DB photobook_prices table.

const PRODUCT_OPTIONS: ProductOptionsConfig = {
  photobook: [
    {
      name: 'Розмір',
      values: ['20х20', '25х25', '20х30', '30х20', '30х30'],
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
      values: ['Без кальки', 'З калькою (+300 грн)'],
      required: true
    },
  ],
  magazine: [
    { name: 'Розмір', values: ['A4'], type: 'text', required: false },
    {
      name: 'Кількість сторінок',
      values: [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80, 92, 100],
      prices: MAGAZINE_PAGE_PRICES,
      required: true
    },
    {
      name: 'Верстка тексту',
      values: ['none', 'own', 'we'],
      required: false,
      note: '«Власний текст» — ви пишете самі в редакторі. «Ми пишемо» — після замовлення відкриється анкета, де ви оберете пакет і розкажете про події; наш редактор напише текст за вас.'
    },
    {
      name: 'Терміновість',
      values: ['Стандартна (5–8 днів)', 'Термінова 1–3 дні (+30%)'],
      required: false,
      note: 'Пришвидшене виробництво — +30% до вартості'
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
      name: 'Тип обкладинки',
      values: ['Глянцева', 'Матова'],
      required: true,
      note: 'Темні кольори не рекомендуємо для матових обкладинок'
    },
    {
      name: 'Кількість сторінок',
      values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80],
      prices: PHOTOJOURNAL_HARD_PAGE_PRICES,
      required: true
    },
    {
      name: 'Верстка тексту',
      values: ['none', 'own', 'we'],
      required: true,
      note: '«Власний текст» — ви пишете самі в редакторі. «Ми пишемо» — після замовлення відкриється анкета, де ви оберете пакет і розкажете про події; наш редактор напише текст за вас.'
    },
    {
      name: 'Ламінування сторінок',
      values: ['Без ламінування', 'З ламінуванням (+7 ₴/стор)'],
      required: true
    },
    {
      name: 'Терміновість',
      values: ['Стандартна (5–8 днів)', 'Термінова до 5 робочих днів (+30%)'],
      required: false,
      note: 'Пришвидшене виробництво — +30% до вартості'
    },
  ],
  travelbook: [
    { name: 'Розмір', values: ['A4'], type: 'text', required: false },
    {
      name: 'Кількість сторінок',
      values: [12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 60, 72, 80],
      prices: TRAVELBOOK_PAGE_PRICES,
      required: true
    },
    {
      name: 'Ламінація обкладинки',
      values: ['Глянцева', 'Матова'],
      required: true,
    },
    {
      name: 'Ламінація сторінок',
      values: ['Без ламінації', 'З ламінацією сторінок'],
      required: true,
      note: '+7 ₴ × кількість сторінок'
    },
  ],
  wishbook: [
    {
      name: 'Матеріал обкладинки',
      values: ['Друкована тверда', 'З тканини', 'Велюрова', 'Шкірзамінник'],
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
      values: ['9х13', '10х15', '13х18', '15х20', '20х30'],
      prices: PHOTOPRINT_STANDARD_PRICES,
      required: true
    },
  ],
  photoprint_nonstandard: [
    {
      name: 'Розмір',
      values: [
        '5×7.5 (кратно 12)',
        '6×9 (кратно 10)',
        '7.5×10 (кратно 8)',
        '9×9 (кратно 6)',
        '10×10 (кратно 6)',
      ],
      prices: {
        '5×7.5 (кратно 12)': 7.5,
        '6×9 (кратно 10)': 7.5,
        '7.5×10 (кратно 8)': 7.5,
        '9×9 (кратно 6)': 8,
        '10×10 (кратно 6)': 8,
      },
      required: true,
      note: 'Мінімальна кількість залежить від формату. Ціна: 7.5–8 ₴/шт'
    },
  ],
  polaroid: [
    {
      name: 'Формат',
      values: ['7.6 × 10.1 см (кратно 8)', '8.6 × 5.4 см (кратно 10)'],
      prices: { '7.6 × 10.1 см (кратно 8)': 7.5, '8.6 × 5.4 см (кратно 10)': 7.5 },
      required: true,
      note: 'Ціна 7.5 ₴/шт. При замовленні від 200 фото — знижка 7%'
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

// calculateVelourPrice removed — VELOUR_PRICES table is gone; photobook
// prices are looked up from the DB by ProductClient via photobookPricesData.

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
  if ((s.includes('magazine') || s.includes('zhurnal') || s.includes('glyancevij') || s.includes('gloss')) && !s.includes('tverda') && !s.includes('tverd') && !s.includes('hard')) {
    return 'magazine';
  }

  // Журнал з твердою обкладинкою (new hard cover variant with full options:
  // тип обкладинки, верстка тексту, ламінування сторінок). Slugs containing
  // 'tverd'/'tverda'/'hardcover' route here too — they're the same physical
  // product, the old 'photojournal' productType lacked these options.
  if (s.includes('photojournal-hard') || s.includes('tverd') || s.includes('tverda') || s.includes('hardcover')) {
    return 'photojournal-hard';
  }

  // Фотожурнал з м'якою обкладинкою (legacy soft variant)
  if (s.includes('photojournal')) {
    return 'photojournal';
  }

  // Travel Book
  if (s.includes('travel') || s.includes('travelbook')) {
    return 'travelbook';
  }

  // Книга побажань + Альбом для вклейки фото (scrapbook) — same options structure
  if (s.includes('wish') || s.includes('pobazhan') || s.includes('kniga') || s.includes('guestbook') || s.includes('scrapbook')) {
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
  const t = useT();
  const optLabel = (name: string) => { const k = t('option_labels.' + name); return k !== 'option_labels.' + name ? k : name; };
  const optValueLabel = (val: string | number) => {
    const s = String(val);
    // Canonical text-layout values → human labels (Ukrainian). Three
    // values mirror product.options['Верстка тексту'] in the DB so both
    // magazines (soft + hard cover) show the same three choices:
    //   • none — no text, photos only
    //   • own  — customer supplies their own text (+195)
    //   • we   — we write it (from +195); the basic/premium package
    //            choice is made later on the brief questionnaire
    // The selector stores the canonical value; ProductClient maps it to
    // ?text_layout= and routes 'we' to the brief flow.
    const TEXT_LAYOUT_LABELS: Record<string, string> = {
      'none': 'Без тексту (тільки фото)',
      'own': 'Власний текст (+195 ₴)',
      'we': 'Ми пишемо (від 195 ₴)',
      // Legacy values kept so old saved state / orders still render:
      'we-basic': 'Ми пишемо — Базовий пакет (+195 ₴)',
      'we-premium': 'Ми пишемо — Преміум пакет (+395 ₴)',
    };
    if (TEXT_LAYOUT_LABELS[s]) return TEXT_LAYOUT_LABELS[s];
    const kFull = t('option_value_labels.' + s);
    if (kFull !== 'option_value_labels.' + s) return kFull;
    const m = s.match(/^(.+?)\s*(\(.+\))\s*$/);
    if (m) {
      const base = m[1].trim();
      const suffix = m[2];
      const kBase = t('option_value_labels.' + base);
      if (kBase !== 'option_value_labels.' + base) return `${kBase} ${suffix}`;
    }
    return s;
  };

  const productType = detectProductType(slug);
  const s = slug?.toLowerCase() || '';
  const isVelourProduct = s.includes('velour') || s.includes('velyur');
  const isLeatherProduct = s.includes('leather') || s.includes('shkir');
  const isFabricProduct = s.includes('fabric') || s.includes('tkanina');
  const isPrintedProduct = s.includes('printed') || s.includes('drukov');
  const isPhotobookProduct = productType === 'photobook';
  const isWishbookProduct = productType === 'wishbook';
  // Graduation photobooks: printed hard cover only, no decoration, no kalka.
  // Lock it from the slug so neither the decoration selector nor any kalka
  // option can ever appear on the page for випускні фотокниги.
  const isGraduation = s.includes('graduation') || s.includes('vypusk');

  // Photobooks AND wishbook (non-printed) get colors + decoration options
  const hasColorAndDecoration = (isPhotobookProduct || isWishbookProduct) && !isPrintedProduct && !isGraduation;

  // The printed-vs-soft choice can also be a runtime option ("Матеріал
  // обкладинки" -> "Друкована тверда") rather than baked into the slug.
  // Printed hard covers have no decoration (acrylic/photo-insert/metal/
  // engraving etc.), so the decoration selector must be hidden whenever the
  // *selected* material is a printed/hard one — not only when the slug says
  // so (slug check alone missed products like guestbook-wedding).
  const selectedCoverMaterial = String(selectedOptions['Матеріал обкладинки'] || '').toLowerCase();
  const isPrintedMaterialSelected =
    selectedCoverMaterial.includes('друков') ||
    selectedCoverMaterial.includes('printed') ||
    selectedCoverMaterial.includes('тверда');
  const showDecoration = hasColorAndDecoration && !isPrintedMaterialSelected;

  const [selectedColor, setSelectedColor] = useState(VELOUR_COLORS[0]);
  const [selectedWishbookColor, setSelectedWishbookColor] = useState<{code:string;name:string;hex:string}|null>(null);
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
      // Photobook prices come from DB photobook_prices via ProductClient
      // (Source 1) — selector returns null and ProductClient will display
      // the DB price as soon as photobookPricesData loads.
      return null;
    }

    // Журнали - ціна залежить від кількості сторінок
    if (productType === 'magazine') {
      const pages = opts['Кількість сторінок'];
      if (pages && typeof pages === 'number') {
        // IMPORTANT: dynamicPrice for the magazine must return the BASE
        // price without the typesetting surcharge. ProductClient adds
        // the +195 ₴ typesetting on top AFTER applying the urgency
        // multiplier, so if we include it here it gets multiplied too
        // and the customer overpays:
        //   wrong: dynamicPrice=720, then ×1.3 = 936
        //   right: dynamicPrice=525, ×1.3=683, then +195 = 878
        // The typesetting surcharge is read as a separate flat extra
        // from product.options['Верстка тексту'] in ProductClient
        // Source 3 (the 'Верстка тексту' key is no longer in the
        // hardcodedNames exclusion list because we want it priced
        // there now).
        return getMagazinePrice(pages, false);
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
        let total = PHOTOJOURNAL_HARD_PAGE_PRICES[pages] || 0;
        if (!total) return null;
        // Typesetting price by canonical value. On the product page the
        // customer only commits to a category:
        //   own → +195 (writes it themselves)
        //   we  → +195 baseline ("від 195 ₴"); the actual basic/premium
        //         package is chosen on the brief page, where the premium
        //         upcharge (to 395) is added if selected.
        //   none → free
        // Legacy we-basic / we-premium values still price correctly for
        // any pre-existing saved state or orders.
        const tv = String(opts['Верстка тексту'] || '');
        if (tv === 'we-premium') {
          total += 395;
        } else if (tv === 'own' || tv === 'we' || tv === 'we-basic' ||
                   tv.includes('текстом') || tv.includes('верстк') ||
                   tv.includes('Власний') || tv.includes('Базовий') || tv.includes('пишемо')) {
          total += TYPESETTING_PRICE;
        } else if (tv.includes('Преміум')) {
          total += 395;
        }
        // Lamination: 7 UAH per page (Diana's price list, May 2026)
        if (opts['Ламінування сторінок'] === 'З ламінуванням (+7 ₴/стор)' || opts['Ламінування сторінок'] === 'З ламінуванням (+5 ₴/стор)') total += pages * LAMINATION_PRICE_PER_PAGE;
        return total;
      }
    }

    // Travel Book
    if (productType === 'travelbook') {
      const pages = opts['Кількість сторінок'];
      if (pages && typeof pages === 'number') {
        let total = TRAVELBOOK_PAGE_PRICES[pages] || 0;
        if (!total) return null;
        // Lamination: 7 UAH per page (Diana's price list, May 2026)
        if (opts['Ламінація сторінок'] === 'З ламінацією сторінок' || opts['Ламінація сторінок'] === 'З ламінацією (+7 ₴/стор)') total += (pages as number) * LAMINATION_PRICE_PER_PAGE;
        return total;
      }
    }

    // Книга побажань - комбінація матеріалу та розміру
    if (productType === 'wishbook') {
      const material = opts['Матеріал обкладинки'];
      const size = opts['Розмір'];
      const pageColor = (opts['Колір сторінок'] as string) || 'Білі';
      if (material && size && typeof material === 'string' && typeof size === 'string') {
        return getWishbookPrice(material, pageColor, size) || null;
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
        // Clear flex color if switching away from flex
        if (selectedOzdoblennya !== 'flex') delete newOptions['Колір напису'];
      }
    }
    // Printed/hard covers have no decoration. If the user switches the cover
    // material to a printed one, drop any decoration that was selected while
    // a soft cover was active, so it doesn't ride along into the order.
    if (optionName === 'Матеріал обкладинки') {
      const mat = String(value).toLowerCase();
      if (mat.includes('друков') || mat.includes('printed') || mat.includes('тверда')) {
        delete newOptions['Тип оздоблення'];
        delete newOptions['Варіант оздоблення'];
        setSelectedOzdoblennya('none');
        setSelectedDecorationVariant('');
      }
    }
    // When the customer switches Розмір, the new size's min_pages may
    // be higher than the currently-selected page count. The dropdown
    // filter below already hides invalid options, but the previously-
    // selected value remains in state — so a customer who had picked
    // 6 pages on 20×20 and then taps 20×30 (min 10) ends up with an
    // invalid state where `Кількість сторінок = 6` for a size that
    // requires at least 10. Bump it up to the new size's minimum.
    if (optionName === 'Розмір') {
      const MIN_PAGES_BY_SIZE: Record<string, number> = {
        '20х20': 6, '20x20': 6, '20×20': 6,
        '25х25': 8, '25x25': 8, '25×25': 8,
        '20х30': 10, '20x30': 10, '20×30': 10,
        '30х20': 10, '30x20': 10, '30×20': 10,
        '30х30': 16, '30x30': 16, '30×30': 16,
      };
      const minForNewSize = MIN_PAGES_BY_SIZE[String(value)] || 0;
      if (minForNewSize > 0) {
        const currentPages = Number(newOptions['Кількість сторінок'] || 0);
        if (currentPages > 0 && currentPages < minForNewSize) {
          newOptions['Кількість сторінок'] = minForNewSize;
        }
      }
    }
    const price = calculatePrice(newOptions);
    onChange(newOptions, price || undefined);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {options.map((option, idx) => {
        // Skip "Тип обкладинки" for products already split by cover type
        if (option.name === 'Тип обкладинки' && (
          slug === 'personalized-glossy-magazine'
        )) return null;

        // Skip "Тип ламінації" for non-printed photobooks (only printed covers have lamination)
        if (option.name === 'Тип ламінації' && isPhotobookProduct && !isPrintedProduct) return null;

        // Graduation books: no калька (per Diana — printed cover only, no extras).
        if (option.name === 'Калька перед першою сторінкою' && isGraduation) return null;

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
              {optLabel(option.name)}
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
              <>
                {option.name === 'Розмір' && (() => {
                  // Graduation books only offer 20×20, 25×25, 20×30 — drop
                  // 30×20 / 30×30 from the hardcoded photobook size list so
                  // the visualizer matches what the DB allows. Matches all
                  // spellings (х / x / ×) since PRODUCT_OPTIONS uses Cyrillic.
                  const allowed = new Set(['20x20','25x25','20x30']);
                  const norm = (v: string | number) => String(v).toLowerCase().replace(/[х×]/g, 'x').replace(/\s*см\s*$/, '').trim();
                  const sizes = isGraduation
                    ? (option.values as (string|number)[]).filter(v => allowed.has(norm(v)))
                    : option.values;
                  return (
                    <SizeVisualizer
                      sizes={sizes}
                      selected={selectedValue ?? null}
                      onSelect={(size) => handleOptionChange(option.name, size)}
                      prices={option.prices as Record<string, number> | undefined}
                      wrap={sizes.length > 5}
                    />
                  );
                })()}
                {/* Special toggle UI for Терміновість */}
                {option.name === 'Терміновість' && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    {option.values.map((value: string | number, vi: number) => {
                      const v = String(value);
                      const isUrgent = v.includes('Термінова') || v.includes('+30');
                      // selectedValue may be either the verbatim label
                      // ('Термінова 1–3 дні (+30%)') or the canonical DB value
                      // ('urgent' / 'standard'). Match both so the button
                      // reflects state correctly after sessionStorage
                      // re-hydration normalised labels back to values.
                      const sel = String(selectedValue ?? '');
                      const canonical = isUrgent ? 'urgent' : 'standard';
                      const isActive = sel === v || sel === canonical;
                      return (
                        <button key={vi} type="button"
                          onClick={() => handleOptionChange(option.name, v)}
                          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                            border: isActive ? (isUrgent ? '2px solid #f59e0b' : '2px solid #1e2d7d') : '1px solid #e2e8f0',
                            background: isActive ? (isUrgent ? '#fffbeb' : '#f0f3ff') : '#fff',
                            color: isActive ? (isUrgent ? '#d97706' : '#1e2d7d') : '#374151',
                            fontWeight: isActive ? 700 : 500, fontSize: 13, transition: 'all 0.15s',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 18 }}>{isUrgent ? '' : ''}</span>
                          <span>{v}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              {option.name !== 'Розмір' && option.name !== 'Терміновість' && <select
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
                  {t('product_page.choose_option')} {optLabel(option.name).toLowerCase()}
                </option>
                {option.values.filter((value) => {
                  // Filter pages by min_pages of selected size (for photobook)
                  if (option.name === 'Кількість сторінок') {
                    const selectedSize = selectedOptions['Розмір'];
                    if (selectedSize) {
                      // Find min_pages from product options (passed via slug-based config)
                      const MIN_PAGES: Record<string, number> = {
                        '20х20': 6, '20x20': 6, '20×20': 6,
                        '25х25': 8, '25x25': 8, '25×25': 8,
                        '20х30': 10, '20x30': 10, '20×30': 10,
                        '30х20': 10, '30x20': 10, '30×20': 10,
                        '30х30': 16, '30x30': 16, '30×30': 16,
                      };
                      const minPages = MIN_PAGES[String(selectedSize)] || 6;
                      return Number(value) >= minPages;
                    }
                  }
                  return true;
                }).map((value, valIdx) => {
                  const price = option.prices?.[value as string];
                  return (
                    <option key={valIdx} value={value}>
                      {optValueLabel(value)}{price ? ` — ${price} ₴` : ''}
                    </option>
                  );
                })}
              </select>}
              </>
            )}
            {option.note && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 5, fontStyle: 'italic' }}>
                ℹ {option.note}
              </p>
            )}
          </div>
        );
      })}

      {/* Wishbook cover color swatches — shown after material selected */}
      {productType === 'wishbook' && (() => {
        const material = selectedOptions['Матеріал обкладинки'];
        if (!material) return null;
        // Hide color swatches for any printed cover variant
        const matLower = String(material).toLowerCase();
        const isPrintedMaterial = matLower.includes('друков') || matLower.includes('printed') || matLower.includes('тверда');
        if (isPrintedMaterial) return null;
        const isVelour = String(material).toLowerCase().includes('велюр');
        const isLeather = String(material).toLowerCase().includes('ткан') || String(material).toLowerCase().includes('fabric');
        const colors = isVelour ? VELOUR_COLORS : isLeather ? FABRIC_COLORS_WB : LEATHERETTE_COLORS_WB;
        const colorLabel = isVelour ? optLabel('Колір велюру') : isLeather ? optLabel('Колір тканини') : optLabel('Колір шкірзамінника');
        const colorLabelKey = isVelour ? 'Колір велюру' : isLeather ? 'Колір тканини' : 'Колір шкірзамінника';
        const current = selectedWishbookColor;
        return (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1e2d7d' }}>
              {colorLabel}:{' '}
              <span style={{ fontWeight: 400, color: '#64748b' }}>
                {current ? optValueLabel(current.name) : t('product_page.choose_color')}
              </span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {colors.map((color: any) => (
                <button
                  key={color.code}
                  type="button"
                  title={optValueLabel(color.name)}
                  onClick={() => {
                    setSelectedWishbookColor(color);
                    const newOptions = { ...selectedOptions, [colorLabel]: `${color.name} (${color.code})` };
                    const price = calculatePrice(newOptions);
                    onChange(newOptions, price || undefined);
                  }}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    backgroundColor: color.hex,
                    border: current?.code === color.code ? '3px solid #1e2d7d' : '2px solid #e2e8f0',
                    cursor: 'pointer',
                    boxShadow: current?.code === color.code ? '0 0 0 2px #fff, 0 0 0 4px #1e2d7d' : 'none',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                  aria-label={color.name}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Cover Color Picker (velour uses hardcoded, others use DB) */}
      {hasColorAndDecoration && (() => {
        const colors = isVelourProduct ? VELOUR_COLORS : coverColors.map((c: any) => ({ code: c.code, name: c.name, hex: c.hex_approx }));
        const current = isVelourProduct ? selectedColor : selectedCoverColor;
        const colorLabel = isVelourProduct ? 'Колір велюру' : isLeatherProduct ? 'Колір шкірзамінника' : 'Колір тканини';
        if (colors.length === 0) return null;
        return (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1e2d7d' }}>
              {optLabel(colorLabel)}: <span style={{ fontWeight: 400, color: '#64748b' }}>{current ? optValueLabel(current.name) : t('product_page.choose_color')}</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {colors.map((color: any) => (
                <button
                  key={color.code}
                  type="button"
                  title={`${optValueLabel(color.name)} (${color.code})`}
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
                  aria-label={optValueLabel(color.name)}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Decoration Type Selector (non-printed photobooks; hidden when a
          printed/hard cover material is selected) */}
      {showDecoration && (() => {
        // Шкірзамінник не підтримує "Друк кольором" і "Гравірування" —
        // ці оздоблення непридатні до шкірзаму. Інші матеріали (велюр,
        // тканина) можуть мати всі шість опцій.
        const isLeatherette =
          selectedCoverMaterial.includes('шкір') ||
          selectedCoverMaterial.includes('leather');
        const availableOzdoblennya = isLeatherette
          ? VELOUR_OZDOBLENNYA.filter(o => o.value !== 'flex' && o.value !== 'graviruvannya')
          : VELOUR_OZDOBLENNYA;
        return (
        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 700,
            marginBottom: '12px',
            color: '#1e2d7d'
          }}>
            {optLabel('Тип оздоблення обкладинки')}
          </label>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {availableOzdoblennya.map(opt => (
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
                {optValueLabel(opt.label)}
              </button>
            ))}
          </div>
        </div>
        );
      })()}

      {/* Decoration Sub-Options — only "Металева вставка" uses decoration_variants table */}
      {showDecoration && selectedOzdoblennya === 'metal' && (() => {
        // Get size from either internal state or parent props
        const selectedSize = selectedOptions['Розмір'] || '';
        const sizeNormalized = selectedSize ? String(selectedSize).replace(/[хxXх]/g, '×') : '';

        // Filter decoration_variants for Металева вставка by size
        // Show variants matching selected size OR size-independent (size is null)
        let variants = decorationVariants.filter((dv: any) => {
          if (dv.decoration_type?.name !== 'Металева вставка') return false;
          if (!dv.size) return true; // size-independent — always show
          if (!sizeNormalized) return false; // no size selected — only show size-independent
          return dv.size.name === sizeNormalized;
        });
        // Prefer exact cover match
        const exactCover = variants.filter((dv: any) => dv.cover_type?.name === coverTypeName);
        if (exactCover.length > 0) variants = exactCover;
        // Deduplicate
        const seen = new Set<string>();
        variants = variants.filter((dv: any) => {
          if (seen.has(dv.variant_name)) return false;
          seen.add(dv.variant_name);
          return true;
        });

        if (variants.length === 0) return null;

        return (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1e2d7d' }}>
              {optLabel('Варіант металевої вставки')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {variants.map((v: any) => (
                <button key={v.id} type="button"
                  onClick={() => {
                    setSelectedDecorationVariant(v.variant_name);
                    const newOptions = { ...selectedOptions, 'Варіант оздоблення': v.variant_name };
                    onChange(newOptions, calculatePrice(newOptions) || undefined);
                  }}
                  className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    selectedDecorationVariant === v.variant_name
                      ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d] hover:text-[#1e2d7d]'
                  }`}>
                  {optValueLabel(v.variant_name)}{Number(v.surcharge) > 0 ? ` (+${v.surcharge} ₴)` : ''}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Друк кольором — color selection */}
      {hasColorAndDecoration && selectedOzdoblennya === 'flex' && (() => {
        const FLEX_COLORS = [
          { value: 'white',  label: 'Білий' },
          { value: 'black',  label: 'Чорний' },
          { value: 'silver', label: 'Срібло' },
          { value: 'gold',   label: 'Золото' },
        ];
        const selectedFlexColor = String(selectedOptions['Колір напису'] || '');
        return (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1e2d7d' }}>
              {optLabel('Колір напису')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {FLEX_COLORS.map(c => (
                <button key={c.value} type="button"
                  onClick={() => {
                    const newOptions = { ...selectedOptions, 'Колір напису': c.value };
                    onChange(newOptions, undefined);
                  }}
                  className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    selectedFlexColor === c.value
                      ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d] hover:text-[#1e2d7d]'
                  }`}>
                  {optValueLabel(c.label)}
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

  // Generic: if any selected option value signals a custom cover inscription
  // (custom-text / напис / індивідуальн / engrav), the inscription text must
  // be provided. Works for any product, driven purely by the selected
  // values — no per-product code, matches the Level-1 album mechanism.
  const hasInscriptionSelected = Object.values(selectedOptions).some(v => {
    const s = String(v ?? '').toLowerCase();
    return s.includes('custom-text') || s.includes('custom_text') ||
           s.includes('напис') || s.includes('індивідуальн') || s.includes('engrav');
  });
  if (hasInscriptionSelected) {
    const txt = selectedOptions['Напис на обкладинці'];
    if (txt === undefined || txt === null || String(txt).trim() === '') {
      return false;
    }
  }

  if (!productType) {
    return true;
  }

  const options = PRODUCT_OPTIONS[productType];
  // Graduation books don't have калька (it's hidden in the render) — exclude
  // it from the required check too, otherwise the gate would block ordering
  // forever for випускні. Skip is by slug, not by productType, so the
  // graduation rule lives in exactly one place (the slug check above).
  const slugLower = slug.toLowerCase();
  const isGraduationSlug = slugLower.includes('graduation') || slugLower.includes('vypusk');
  const requiredOptions = options.filter(opt => {
    if (!opt.required || opt.type === 'text') return false;
    if (isGraduationSlug && opt.name === 'Калька перед першою сторінкою') return false;
    return true;
  });

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
    // Photobook prices live in DB photobook_prices, not here. Return null
    // so callers know to source from the DB (ProductClient does this).
    return null;
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
      let total = TRAVELBOOK_PAGE_PRICES[pages] || 0;
      if (!total) return null;
      if (selectedOptions['Ламінація сторінок'] === 'З ламінацією сторінок' || selectedOptions['Ламінація сторінок'] === 'З ламінацією (+7 ₴/стор)') total += (pages as number) * LAMINATION_PRICE_PER_PAGE;
      return total;
    }
  }

  // Книга побажань
  if (productType === 'wishbook') {
    const material = selectedOptions['Матеріал обкладинки'];
    const size = selectedOptions['Розмір'];
    const pageColor = (selectedOptions['Колір сторінок'] as string) || 'Білі';
    if (material && size && typeof material === 'string' && typeof size === 'string') {
      return getWishbookPrice(material, pageColor, size) || null;
    }
  }

  // Фотодрук/полароїд/магніти
  if (productType === 'photoprint_standard' || productType === 'photoprint_nonstandard' || productType === 'polaroid' || productType === 'photomagnet') {
    const size = selectedOptions['Розмір'] ?? selectedOptions['Формат'];
    const options = PRODUCT_OPTIONS[productType];
    const sizeOption = options.find(opt => opt.name === 'Розмір' || opt.name === 'Формат');
    if (size && sizeOption?.prices) {
      // Exact match first (hardcoded flow). Fall back to a normalized match
      // because the DB option values ('10×10 см', value '10x10') differ from
      // the hardcoded price keys ('10×10 (кратно 6)'). Without this the lookup
      // returned null, dynamicPrice stayed null, and ProductClient's generic
      // fallback wrongly summed base + size price (e.g. 7.5 + 8 = 15.5 ₴).
      const exact = sizeOption.prices[size as string];
      if (exact != null) return exact;
      const norm = (s: string) => s
        .replace(/\s*\(.*?\)/g, '')          // drop "(кратно N)"
        .replace(/\s*(см|cm|мм|mm)\b/gi, '')  // drop unit
        .replace(/[хx]/gi, '×')
        .replace(/\s+/g, '')
        .toLowerCase();
      const target = norm(String(size));
      for (const [k, v] of Object.entries(sizeOption.prices)) {
        if (norm(k) === target) return v;
      }
      return null;
    }
  }

  return null;
}
